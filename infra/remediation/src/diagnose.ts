import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { ALLOWED_PATHS, type Severity } from './safety.js';

const anthropic = new Anthropic();

export interface DiagnosisResult {
  action: 'fix' | 'escalate';
  severity: Severity;
  root_cause: string;
  diagnosis: string;
  files_to_modify?: FileChange[];
}

export interface FileChange {
  path: string;
  original: string;
  modified: string;
  explanation: string;
}

/** Build context about the failing endpoint by reading relevant source files */
function gatherCodeContext(endpoint: string): string {
  const parts: string[] = [];

  // Map endpoint to likely source module
  const moduleMap: Record<string, string[]> = {
    '/api/audio': ['apps/api/src/modules/audio/'],
    '/api/auth': ['apps/api/src/modules/auth/'],
    '/api/dashboard': ['apps/api/src/modules/dashboard/'],
    '/api/chat': ['apps/api/src/modules/chat/'],
    '/api/action-items': ['apps/api/src/modules/action-items/'],
    '/api/meeting': ['apps/api/src/modules/meeting/'],
    '/api/daily-summary': ['apps/api/src/modules/daily-summary/'],
    '/api/question-templates': ['apps/api/src/modules/question-templates/'],
    '/api/staff': ['apps/api/src/modules/staff/'],
    '/api/feedback': ['apps/api/src/modules/feedback/'],
  };

  // Find matching module
  const matchedDirs: string[] = [];
  for (const [prefix, dirs] of Object.entries(moduleMap)) {
    if (endpoint.startsWith(prefix)) {
      matchedDirs.push(...dirs);
      break;
    }
  }

  // Always include common module (shared utilities)
  matchedDirs.push('apps/api/src/common/');

  for (const dir of matchedDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = execSync(`find ${dir} -name '*.ts' -not -name '*.spec.ts'`, {
        encoding: 'utf-8',
      }).trim().split('\n').filter(Boolean);

      for (const file of files.slice(0, 8)) {
        try {
          const content = readFileSync(file, 'utf-8');
          if (content.length <= 5000) {
            parts.push(`--- ${file} ---\n${content}`);
          } else {
            parts.push(`--- ${file} (truncated) ---\n${content.slice(0, 5000)}\n... (${content.length} chars total)`);
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // find command failed
    }
  }

  return parts.join('\n\n');
}

/** Fetch Zeabur deployment logs for recent errors */
function getDeploymentLogs(): string {
  try {
    const logs = execSync(
      'zeabur deployment list 2>/dev/null | head -5',
      { encoding: 'utf-8', timeout: 10000 },
    );
    return logs.trim() || '(no deployment logs available)';
  } catch {
    return '(unable to fetch deployment logs)';
  }
}

/** Ask Claude to diagnose the issue and propose a fix */
export async function diagnose(
  endpoint: string,
  errorMessage: string,
  httpStatus: number | null,
  recentErrors: Array<{ error_message: string | null; http_status: number | null; created_at: string }>,
): Promise<DiagnosisResult> {
  const codeContext = gatherCodeContext(endpoint);
  const deployLogs = getDeploymentLogs();

  const errorHistory = recentErrors
    .map((e) => `  [${e.created_at}] HTTP ${e.http_status}: ${e.error_message}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an auto-remediation system for a NestJS backend (Lingtin voice management platform).

A health check endpoint is failing. Diagnose the issue and provide a targeted fix.

## Failing Endpoint
- Path: ${endpoint}
- Current error: ${errorMessage}
- HTTP status: ${httpStatus ?? 'N/A'}

## Recent Error History
${errorHistory || '(no recent errors)'}

## Deployment Logs
${deployLogs}

## Source Code (relevant modules)
${codeContext || '(no source code found for this endpoint)'}

## Constraints
- You may ONLY modify files under: ${ALLOWED_PATHS.join(', ')}
- Do NOT change database schema, environment variables, or external service configs
- Do NOT add new dependencies
- If the issue is external (third-party service down, infrastructure problem), return "escalate"

## Severity Tiers (pick one based on fix complexity)
- "minor": Single-file fix, typo/config, ≤1 file ≤20 lines diff (eligible for auto-merge)
- "moderate": Logic bug, missing validation, ≤3 files ≤80 lines diff
- "major": Cross-module issue, ≤5 files ≤150 lines diff
- If the fix would exceed "major" limits, return "escalate" instead

## Response Format (JSON only)
If you can fix it:
\`\`\`json
{
  "action": "fix",
  "severity": "minor|moderate|major",
  "root_cause": "runtime_error|dependency_timeout|db_query|auth|config|unknown",
  "diagnosis": "Brief explanation of what went wrong",
  "files_to_modify": [
    {
      "path": "apps/api/src/...",
      "original": "exact original code block to replace",
      "modified": "the fixed code block",
      "explanation": "what this change does"
    }
  ]
}
\`\`\`

If you cannot fix it or need human intervention:
\`\`\`json
{
  "action": "escalate",
  "severity": "major",
  "root_cause": "...",
  "diagnosis": "Why this needs human intervention"
}
\`\`\`

Respond with ONLY the JSON, no other text.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const jsonStr = (jsonMatch[1] ?? text).trim();

  try {
    return JSON.parse(jsonStr) as DiagnosisResult;
  } catch {
    console.error('Failed to parse Claude response:', text);
    return {
      action: 'escalate',
      severity: 'major',
      root_cause: 'unknown',
      diagnosis: `AI response parse error. Raw: ${text.slice(0, 500)}`,
    };
  }
}
