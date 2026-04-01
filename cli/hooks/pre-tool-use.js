#!/usr/bin/env node
/**
 * ship-safe PreToolUse Hook
 * ==========================
 *
 * Runs before every Claude Code tool call. Blocks:
 *   - Write / Edit / MultiEdit: content containing critical secrets
 *   - Bash: known-dangerous command patterns
 *
 * Protocol (claw-code / Claude Code hooks spec):
 *   - Input:  JSON payload on stdin
 *   - Exit 0: allow the tool to run (stdout = optional advisory message)
 *   - Exit 2: BLOCK the tool (stdout = reason shown to Claude and user)
 *   - Exit 1: warn but allow (stdout = warning message)
 *
 * Install via:  npx ship-safe hooks install
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Load secret patterns (critical-only subset for low false-positive blocking)
// =============================================================================

// Inline critical patterns rather than importing the full 1100-line patterns.js
// to keep hook startup time under 100ms.
const CRITICAL_PATTERNS = [
  { name: 'AWS Access Key ID',            re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub PAT (classic)',          re: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub OAuth Token',            re: /gho_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub App Token',              re: /ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub Fine-Grained PAT',       re: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/ },
  { name: 'Anthropic API Key',             re: /sk-ant-api03-[a-zA-Z0-9\-_]{93}/ },
  { name: 'OpenAI API Key',                re: /sk-[a-zA-Z0-9]{48}/ },
  { name: 'Stripe Live Secret Key',        re: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Stripe Restricted Key',         re: /rk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Slack Bot Token',               re: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/ },
  { name: 'Slack User Token',              re: /xoxp-[0-9]{11}-[0-9]{11}-[0-9]{12}-[a-zA-Z0-9]{32}/ },
  { name: 'Twilio Account SID',            re: /AC[a-z0-9]{32}/ },
  { name: 'Twilio Auth Token',             re: /SK[a-z0-9]{32}/ },
  { name: 'Google API Key',                re: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: 'Firebase Server Key',           re: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/ },
  { name: 'npm Auth Token',                re: /npm_[A-Za-z0-9]{36}/ },
  { name: 'PyPI API Token',                re: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}/ },
  { name: 'Cloudflare API Token',          re: /[A-Za-z0-9_-]{40}(?=.*cloudflare)/i },
  { name: 'Supabase Service Role Key',     re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=\-_]+/ },
  { name: 'Private Key (PEM)',             re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

// Dangerous bash command patterns — exit 2 blocks execution
const DANGEROUS_BASH_PATTERNS = [
  {
    name: 'curl/wget piped to shell',
    re: /(?:curl|wget)\s+[^|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|dash|ksh)/,
    reason: 'Executing remote scripts without verification is the #1 CI/CD supply chain attack vector (Trivy/CanisterWorm 2026). Download first, verify checksum, then execute.',
  },
  {
    name: 'Recursive force delete of system paths',
    re: /rm\s+(?:-[a-z]*f[a-z]*\s+|--force\s+)(?:-[a-z]*r[a-z]*\s+|--recursive\s+)?\/(?:\s|$|[a-z])/,
    reason: 'Destructive operation targeting the filesystem root or system paths.',
  },
  {
    name: 'npm install with --ignore-scripts disabled in suspicious context',
    re: /npm\s+(?:i|install)\s+[^\n]*--unsafe-perm/,
    reason: '--unsafe-perm elevates install script privileges. Use sandboxed installs instead.',
  },
  {
    name: 'Credential file exfiltration',
    re: /(?:cat|type|Get-Content)\s+[^\n]*(?:~\/\.(?:aws|ssh|npmrc|pypirc|netrc|gitconfig|gnupg)|\/etc\/(?:passwd|shadow))/,
    reason: 'Reading sensitive credential files — potential exfiltration attempt.',
  },
  {
    name: 'Environment variable exfiltration via network',
    re: /(?:curl|wget|Invoke-WebRequest)\s+[^\n]*\$(?:AWS_|GITHUB_TOKEN|NPM_TOKEN|ANTHROPIC_|OPENAI_|SECRET|PASSWORD|TOKEN)/,
    reason: 'Sending environment variables containing likely credentials over the network.',
  },
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
    // Non-blocking: if we can't parse stdin, let the tool run
    process.exit(0);
  }

  const { tool_name, tool_input } = payload;

  // ── File write hooks ───────────────────────────────────────────────────────
  if (tool_name === 'Write' || tool_name === 'Edit' || tool_name === 'MultiEdit') {
    const content = extractWriteContent(tool_name, tool_input);
    if (content) {
      const hits = scanForSecrets(content);
      if (hits.length > 0) {
        const list = hits.map(h => `  • ${h.name}`).join('\n');
        process.stdout.write(
          `ship-safe blocked this write — critical secret(s) detected in content:\n${list}\n\n` +
          `Move the value(s) to environment variables before writing this file.\n` +
          `Run \`npx ship-safe scan .\` for a full report.`
        );
        process.exit(2);
      }
    }
  }

  // ── Bash hooks ─────────────────────────────────────────────────────────────
  if (tool_name === 'Bash') {
    const command = (tool_input && tool_input.command) ? String(tool_input.command) : '';
    if (command) {
      const hit = DANGEROUS_BASH_PATTERNS.find(p => p.re.test(command));
      if (hit) {
        process.stdout.write(
          `ship-safe blocked this command — ${hit.name}\n\n${hit.reason}`
        );
        process.exit(2);
      }
    }
  }

  // Allow by default
  process.exit(0);
}

// =============================================================================
// Helpers
// =============================================================================

function extractWriteContent(toolName, input) {
  if (!input) return null;
  if (toolName === 'Write') return input.content || null;
  if (toolName === 'Edit') return input.new_string || null;
  if (toolName === 'MultiEdit') {
    // MultiEdit has an array of edits
    if (Array.isArray(input.edits)) {
      return input.edits.map(e => e.new_string || '').join('\n');
    }
  }
  return null;
}

function scanForSecrets(content) {
  const hits = [];
  for (const { name, re } of CRITICAL_PATTERNS) {
    if (re.test(content)) {
      hits.push({ name });
    }
  }
  return hits;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) return resolve('');
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
    // Safety timeout — never hang Claude Code
    setTimeout(() => resolve(''), 3000);
  });
}

main().catch(() => process.exit(0)); // Never crash — silently allow on error
