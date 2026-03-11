import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { resolve, normalize } from 'path';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FileChange } from './diagnose.js';
import { validateFixScope, type Severity, ALLOWED_PATHS } from './safety.js';

export interface ApplyResult {
  success: boolean;
  branch: string;
  changedFiles: string[];
  diffLines: number;
  diff: string;
  error?: string;
}

/** Validate and normalize a file path, ensuring it stays within allowed directories */
function normalizePath(filePath: string): string | null {
  const normalized = normalize(filePath);
  // Block path traversal
  if (normalized.includes('..')) return null;
  // Verify still within allowed paths after normalization
  const inAllowed = ALLOWED_PATHS.some((p) => normalized.startsWith(p));
  return inAllowed ? normalized : null;
}

/**
 * Apply AI-generated file changes to source code on a new branch.
 * Returns the branch name and diff for review.
 */
export function applyFix(
  incidentId: string,
  files: FileChange[],
  severity: Severity,
): ApplyResult {
  const branch = `autofix/${incidentId.slice(0, 8)}`;

  // Normalize and validate all file paths first
  const normalizedFiles: Array<FileChange & { normalizedPath: string }> = [];
  for (const file of files) {
    const normalized = normalizePath(file.path);
    if (!normalized) {
      return {
        success: false,
        branch,
        changedFiles: files.map((f) => f.path),
        diffLines: 0,
        diff: '',
        error: `Path rejected: ${file.path} (traversal or outside allowed dirs)`,
      };
    }
    normalizedFiles.push({ ...file, normalizedPath: normalized });
  }

  const changedFiles = normalizedFiles.map((f) => f.normalizedPath);

  // Pre-flight: validate scope
  const estimatedDiff = files.reduce(
    (sum, f) => sum + f.original.split('\n').length + f.modified.split('\n').length,
    0,
  );
  const scopeCheck = validateFixScope(changedFiles, estimatedDiff, severity);
  if (!scopeCheck.allowed) {
    return {
      success: false,
      branch,
      changedFiles,
      diffLines: estimatedDiff,
      diff: '',
      error: scopeCheck.reason,
    };
  }

  try {
    // Create branch from main
    execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['checkout', '-b', branch, 'origin/main'], { stdio: 'pipe' });

    // Apply each file change
    for (const file of normalizedFiles) {
      const content = readFileSync(file.normalizedPath, 'utf-8');
      if (!content.includes(file.original)) {
        const trimmedOriginal = file.original.trim();
        if (!content.includes(trimmedOriginal)) {
          return {
            success: false,
            branch,
            changedFiles,
            diffLines: 0,
            diff: '',
            error: `Could not find original code block in ${file.normalizedPath}`,
          };
        }
        const newContent = content.replace(trimmedOriginal, file.modified.trim());
        writeFileSync(file.normalizedPath, newContent, 'utf-8');
      } else {
        const newContent = content.replace(file.original, file.modified);
        writeFileSync(file.normalizedPath, newContent, 'utf-8');
      }
    }

    // Stage files safely (array args, no shell interpolation)
    execFileSync('git', ['add', ...changedFiles], { stdio: 'pipe' });
    const diff = execFileSync('git', ['diff', '--cached'], { encoding: 'utf-8' });
    const diffLines = diff.split('\n').length;

    // Final scope check with actual diff
    const finalCheck = validateFixScope(changedFiles, diffLines, severity);
    if (!finalCheck.allowed) {
      execFileSync('git', ['checkout', 'main'], { stdio: 'pipe' });
      execFileSync('git', ['branch', '-D', branch], { stdio: 'pipe' });
      return {
        success: false,
        branch,
        changedFiles,
        diffLines,
        diff,
        error: finalCheck.reason,
      };
    }

    // Commit with safe message (no shell interpolation)
    const commitMsg = `autofix: remediate ${changedFiles[0]} [incident ${incidentId.slice(0, 8)}]`;
    execFileSync('git', ['commit', '-m', commitMsg], { stdio: 'pipe' });

    return { success: true, branch, changedFiles, diffLines, diff };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    try {
      execFileSync('git', ['checkout', 'main'], { stdio: 'pipe' });
      execFileSync('git', ['branch', '-D', branch], { stdio: 'pipe' });
    } catch {
      // Best effort cleanup
    }
    return {
      success: false,
      branch,
      changedFiles,
      diffLines: 0,
      diff: '',
      error: `Git operation failed: ${errorMsg}`,
    };
  }
}

/** Build the API to verify the fix compiles */
export function verifyBuild(): { success: boolean; error?: string } {
  try {
    execSync('pnpm build:api', {
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: 'pipe',
    });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? (err as { stderr?: string }).stderr ?? err.message : String(err);
    return { success: false, error: errorMsg.slice(0, 1000) };
  }
}

/** Push branch and create PR (uses temp file for body to avoid shell injection) */
export function pushAndCreatePR(
  branch: string,
  incidentId: string,
  diagnosis: string,
  diff: string,
): { prNumber: number | null; error?: string } {
  let tmpDir: string | null = null;

  try {
    execFileSync('git', ['push', 'origin', branch], { stdio: 'pipe' });

    const prBody = [
      '## Auto-Remediation Fix',
      '',
      `**Incident:** \`${incidentId}\``,
      `**Diagnosis:** ${diagnosis}`,
      '',
      '### Changes',
      '```diff',
      diff.slice(0, 3000),
      '```',
      '',
      '---',
      '_This PR was automatically generated by the Lingtin auto-remediation system._',
      '_Review carefully before merging._',
    ].join('\n');

    // Write body to temp file to avoid shell injection
    tmpDir = mkdtempSync(join(tmpdir(), 'remediation-'));
    const bodyFile = join(tmpDir, 'pr-body.md');
    writeFileSync(bodyFile, prBody, 'utf-8');

    const title = `autofix: ${diagnosis.slice(0, 60).replace(/[`$"\\]/g, '')}`;
    const result = execFileSync(
      'gh',
      ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body-file', bodyFile],
      { encoding: 'utf-8', stdio: 'pipe' },
    );

    const prMatch = result.match(/\/pull\/(\d+)/);
    const prNumber = prMatch ? parseInt(prMatch[1], 10) : null;

    return { prNumber };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { prNumber: null, error: errorMsg };
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ }
    }
  }
}

/** Auto-merge a PR (only when config allows) */
export function autoMergePR(prNumber: number): boolean {
  try {
    execFileSync('gh', ['pr', 'merge', String(prNumber), '--merge', '--auto'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Revert the last commit on main (emergency rollback) */
export function revertLastCommit(): string | null {
  try {
    execFileSync('git', ['checkout', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['pull', 'origin', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['revert', 'HEAD', '--no-edit'], { stdio: 'pipe' });
    execFileSync('git', ['push', 'origin', 'main'], { stdio: 'pipe' });
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
    return sha;
  } catch (err) {
    console.error('Rollback failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
