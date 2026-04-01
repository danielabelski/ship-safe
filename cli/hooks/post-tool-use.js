#!/usr/bin/env node
/**
 * ship-safe PostToolUse Hook
 * ===========================
 *
 * Runs after Write / Edit / MultiEdit completes. Scans the modified file
 * for secrets and security issues, then returns findings as a message
 * that Claude Code injects back into the conversation context.
 *
 * This is advisory — exit 0 always (PostToolUse cannot block).
 * Claude sees the stdout message and can act on findings immediately.
 *
 * Protocol (claw-code / Claude Code hooks spec):
 *   - Input:  JSON payload on stdin
 *   - Exit 0: always (PostToolUse never blocks)
 *   - stdout: message injected into Claude's context (empty = silent)
 *
 * Install via:  npx ship-safe hooks install
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same critical patterns as pre-tool-use (inline for startup speed)
const CRITICAL_PATTERNS = [
  { name: 'AWS Access Key ID',            severity: 'critical', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub PAT (classic)',          severity: 'critical', re: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub OAuth Token',            severity: 'critical', re: /gho_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub App Token',              severity: 'critical', re: /ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub Fine-Grained PAT',       severity: 'critical', re: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/ },
  { name: 'Anthropic API Key',             severity: 'critical', re: /sk-ant-api03-[a-zA-Z0-9\-_]{93}/ },
  { name: 'OpenAI API Key',                severity: 'critical', re: /sk-[a-zA-Z0-9]{48}/ },
  { name: 'Stripe Live Secret Key',        severity: 'critical', re: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'npm Auth Token',                severity: 'critical', re: /npm_[A-Za-z0-9]{36}/ },
  { name: 'Private Key (PEM)',             severity: 'critical', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

// Broader high-severity patterns only checked post-write (advisory, not blocking)
const HIGH_PATTERNS = [
  { name: 'Hardcoded password assignment', severity: 'high',     re: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i },
  { name: 'Database URL with credentials', severity: 'high',     re: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]{4,}@/ },
  { name: 'Generic high-entropy token',    severity: 'high',     re: /(?:token|secret|key)\s*[:=]\s*["'][A-Za-z0-9+/=_\-]{32,}["']/i },
];

// Files we should never block or report on (test fixtures, examples)
const SKIP_PATHS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__[/\\]/,
  /[/\\]tests?[/\\]/,
  /[/\\]fixtures?[/\\]/,
  /[/\\]mocks?[/\\]/,
  /\.example$/,
  /\.sample$/,
  /CHANGELOG/i,
  /\.md$/,
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  let payload;
  try {
    const raw = await readStdin();
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const { tool_name, tool_input, tool_result_is_error } = payload;

  // Only scan on successful file writes
  if (tool_result_is_error) process.exit(0);
  if (!['Write', 'Edit', 'MultiEdit'].includes(tool_name)) process.exit(0);

  const filePath = tool_input && (tool_input.file_path || tool_input.path);
  if (!filePath) process.exit(0);

  // Skip test/example files
  if (SKIP_PATHS.some(p => p.test(filePath))) process.exit(0);

  // Read the file that was just written
  let fileContent;
  try {
    if (!existsSync(filePath)) process.exit(0);
    fileContent = readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }

  const findings = [];

  for (const { name, severity, re } of [...CRITICAL_PATTERNS, ...HIGH_PATTERNS]) {
    if (re.test(fileContent)) {
      findings.push({ name, severity });
    }
  }

  if (findings.length === 0) {
    // Silent — no output means no noise when everything is clean
    process.exit(0);
  }

  // Format findings as a message Claude Code will inject into context
  const critical = findings.filter(f => f.severity === 'critical');
  const high = findings.filter(f => f.severity === 'high');

  const lines = [
    `[ship-safe] Security findings in ${path.basename(filePath)}:`,
    '',
  ];

  if (critical.length > 0) {
    lines.push('CRITICAL — rotate these credentials immediately:');
    critical.forEach(f => lines.push(`  • ${f.name}`));
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('HIGH — review these:');
    high.forEach(f => lines.push(`  • ${f.name}`));
    lines.push('');
  }

  lines.push('Run `npx ship-safe scan .` for full details and auto-fix options.');

  process.stdout.write(lines.join('\n'));
  process.exit(0); // PostToolUse never blocks
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) return resolve('');
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
    setTimeout(() => resolve(''), 3000);
  });
}

main().catch(() => process.exit(0));
