import { normalize } from 'path';
import {
  getEndpointConfig,
  countTodayAttempts,
  countTodayGlobalAttempts,
  getLastIncident,
  type RemediationConfig,
} from './supabase-client.js';

/** Maximum number of remediation attempts across ALL endpoints per day */
const GLOBAL_DAILY_LIMIT = 5;

/** Only these directories can be modified by auto-fix */
export const ALLOWED_PATHS = ['apps/api/src/'];

/** Severity tiers with corresponding scope limits */
export type Severity = 'minor' | 'moderate' | 'major';

const VALID_SEVERITIES: ReadonlySet<string> = new Set<Severity>(['minor', 'moderate', 'major']);

export function isValidSeverity(value: string): value is Severity {
  return VALID_SEVERITIES.has(value);
}

export interface ScopeLimits {
  maxFiles: number;
  maxDiffLines: number;
  autoMergeEligible: boolean;
}

const SEVERITY_LIMITS: Record<Severity, ScopeLimits> = {
  minor:    { maxFiles: 1, maxDiffLines: 20,  autoMergeEligible: true },
  moderate: { maxFiles: 3, maxDiffLines: 80,  autoMergeEligible: false },
  major:    { maxFiles: 5, maxDiffLines: 150, autoMergeEligible: false },
};

const SEVERITY_ORDER: Severity[] = ['minor', 'moderate', 'major'];

export function getLimitsForSeverity(severity: Severity): ScopeLimits {
  return SEVERITY_LIMITS[severity] ?? SEVERITY_LIMITS.moderate;
}

export function isSeverityAllowed(severity: Severity, maxSeverity: Severity): boolean {
  return SEVERITY_ORDER.indexOf(severity) <= SEVERITY_ORDER.indexOf(maxSeverity);
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface SafetyCheckWithConfig extends SafetyCheckResult {
  config?: RemediationConfig;
}

/** Run pre-diagnosis safety checks (rate limits, cooldowns). Returns config for reuse. */
export async function checkSafety(endpoint: string): Promise<SafetyCheckWithConfig> {
  const config = await getEndpointConfig(endpoint);

  if (!config.auto_fix_enabled) {
    return { allowed: false, reason: `Auto-fix disabled for ${endpoint}` };
  }

  // Parallel: check daily counts and last incident simultaneously
  const [todayCount, globalCount, lastIncident] = await Promise.all([
    countTodayAttempts(endpoint),
    countTodayGlobalAttempts(),
    getLastIncident(endpoint),
  ]);

  if (todayCount >= config.max_attempts_per_day) {
    return {
      allowed: false,
      reason: `Endpoint ${endpoint} hit daily limit (${todayCount}/${config.max_attempts_per_day})`,
    };
  }

  if (globalCount >= GLOBAL_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `Global daily limit reached (${globalCount}/${GLOBAL_DAILY_LIMIT})`,
    };
  }

  if (lastIncident) {
    const elapsed = Date.now() - new Date(lastIncident.created_at).getTime();
    const cooldownMs = config.cooldown_minutes * 60 * 1000;
    if (elapsed < cooldownMs) {
      const remainMin = Math.ceil((cooldownMs - elapsed) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active for ${endpoint} (${remainMin}min remaining)`,
      };
    }
  }

  return { allowed: true, config };
}

/** Check severity against endpoint config (pass config to avoid redundant DB call) */
export function checkSeverityAllowed(
  config: RemediationConfig,
  severity: Severity,
): SafetyCheckResult {
  if (!isSeverityAllowed(severity, config.max_severity)) {
    return {
      allowed: false,
      reason: `Severity "${severity}" exceeds max allowed "${config.max_severity}" for ${config.endpoint}`,
    };
  }
  return { allowed: true };
}

/** Validate that a proposed fix stays within severity-based scope limits */
export function validateFixScope(
  changedFiles: string[],
  diffLines: number,
  severity: Severity,
): SafetyCheckResult {
  const limits = getLimitsForSeverity(severity);

  if (changedFiles.length > limits.maxFiles) {
    return {
      allowed: false,
      reason: `Fix touches ${changedFiles.length} files (max ${limits.maxFiles} for "${severity}")`,
    };
  }

  if (diffLines > limits.maxDiffLines) {
    return {
      allowed: false,
      reason: `Fix is ${diffLines} lines (max ${limits.maxDiffLines} for "${severity}")`,
    };
  }

  for (const file of changedFiles) {
    const normalized = normalize(file);
    if (normalized.includes('..')) {
      return { allowed: false, reason: `Path traversal detected: ${file}` };
    }
    const inAllowedPath = ALLOWED_PATHS.some((p) => normalized.startsWith(p));
    if (!inAllowedPath) {
      return {
        allowed: false,
        reason: `Fix modifies ${file} which is outside allowed paths: ${ALLOWED_PATHS.join(', ')}`,
      };
    }
  }

  return { allowed: true };
}
