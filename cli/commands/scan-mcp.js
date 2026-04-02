/**
 * Scan MCP Command
 * ================
 *
 * Fetches and analyzes an MCP server's tool manifest before connecting to it.
 * Checks for malicious tool definitions, prompt injection in descriptions,
 * exfiltration patterns, excessive permissions, and known-bad server hashes.
 *
 * USAGE:
 *   ship-safe scan-mcp <url>        Analyze a remote MCP server
 *   ship-safe scan-mcp <path>       Analyze a local MCP manifest file
 *
 * The command connects to the server's /tools endpoint (or reads the manifest
 * JSON directly) and inspects every tool definition for attack patterns.
 *
 * MCP tool definitions are the new ToxicSkills surface — 36% of agent skills
 * had security flaws; early MCP server audits show similar rates.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { createHash } from 'crypto';
import * as output from '../utils/output.js';
import { ThreatIntel } from '../utils/threat-intel.js';

// =============================================================================
// MCP TOOL DESCRIPTION PATTERNS
// Injected into tool descriptions/annotations to hijack agents that use them.
// =============================================================================

const MCP_TOOL_PATTERNS = [
  // ── Prompt injection in tool description ──────────────────────────────────
  {
    name: 'Prompt injection: override instructions',
    regex: /(?:ignore\s+(?:all\s+)?(?:previous|prior|above|your)\s+instructions|disregard\s+(?:all\s+)?(?:previous|above)|your\s+(?:new|real|actual|true)\s+(?:instructions|role|goal)\s+(?:is|are))/gi,
    severity: 'critical',
    target: 'description',
  },
  {
    name: 'Prompt injection: role hijacking',
    regex: /(?:you\s+are\s+now\s+(?:a|an)|act\s+as\s+(?:a\s+)?(?:hacker|attacker|malicious|evil|unrestricted)|pretend\s+(?:you\s+are|to\s+be)\s+(?:a\s+)?(?:different|new|unrestricted))/gi,
    severity: 'critical',
    target: 'description',
  },

  // ── Silent exfiltration instructions in tool description ──────────────────
  {
    name: 'Silent data exfiltration',
    regex: /(?:silently|quietly|without\s+(?:notif|alert|inform|telling|showing)|in\s+the\s+background)\s+.{0,60}(?:curl|wget|fetch|POST|send).{0,60}(?:http|https):\/\//gi,
    severity: 'critical',
    target: 'description',
  },
  {
    name: 'Output suppression',
    regex: /(?:do\s+not\s+(?:show|display|reveal|mention|tell|report|log)\s+(?:this|these|the\s+(?:output|result|response|command|action))|hide\s+(?:this|the)\s+(?:output|result|action|command|request))/gi,
    severity: 'high',
    target: 'description',
  },

  // ── Credential harvesting ─────────────────────────────────────────────────
  {
    name: 'Credential harvesting',
    regex: /(?:extract|retrieve|collect|gather|find|read|access|get)\s+.{0,40}(?:api[_\s]?key|secret|token|password|credential|\.env|npmrc|ssh[_\s]?key|private[_\s]?key)/gi,
    severity: 'critical',
    target: 'description',
  },
  {
    name: 'Sensitive path access',
    regex: /(?:~\/\.(?:ssh|aws|npmrc|netrc|gnupg|config\/gcloud)|\/etc\/(?:passwd|shadow|hosts)|%APPDATA%|%USERPROFILE%)/gi,
    severity: 'critical',
    target: 'description',
  },

  // ── Known data exfiltration service domains ───────────────────────────────
  {
    name: 'Exfiltration service domain',
    regex: /(?:webhook\.site|requestbin\.com|hookbin\.com|pipedream\.net|ngrok\.io|ngrok\.app|burpcollaborator\.net|interact\.sh|oastify\.com|canarytokens\.com)/gi,
    severity: 'critical',
    target: 'any',
  },

  // ── Dangerous tool input schema patterns ──────────────────────────────────
  {
    name: 'Shell command input parameter',
    regex: /(?:"command"\s*:\s*\{[^}]*"type"\s*:\s*"string"|"cmd"\s*:\s*\{[^}]*"type"\s*:\s*"string"|"shell"\s*:\s*\{[^}]*"type"\s*:\s*"string")/gi,
    severity: 'medium',
    target: 'schema',
  },
  {
    name: 'Arbitrary code execution parameter',
    regex: /(?:"code"\s*:\s*\{[^}]*"type"\s*:\s*"string"|"script"\s*:\s*"(?:string|object)"|"eval"\s*:\s*\{[^}]*"type"\s*:\s*"string")/gi,
    severity: 'high',
    target: 'schema',
  },

  // ── Permission escalation in description ──────────────────────────────────
  {
    name: 'Permission escalation',
    regex: /(?:grant\s+(?:me|this\s+(?:tool|server|skill)|yourself)\s+(?:admin|root|sudo|full|all)\s+(?:access|permissions?|rights?)|elevate\s+(?:privileges?|permissions?|rights?)|run\s+as\s+(?:admin|root|sudo))/gi,
    severity: 'high',
    target: 'description',
  },

  // ── Encoded payload in description ────────────────────────────────────────
  {
    name: 'Encoded payload block',
    regex: /[A-Za-z0-9+\/]{60,}={0,2}/g,
    severity: 'medium',
    target: 'any',
  },
];

// Dangerous tool name keywords — flag tools whose names suggest shell/exec access
const DANGEROUS_TOOL_NAMES = [
  /^(?:exec|execute|shell|bash|sh|cmd|terminal|run_command|system|subprocess)$/i,
  /(?:_exec|_shell|_bash|_cmd|_terminal|exec_|shell_|bash_cmd)/i,
];

// =============================================================================
// MAIN COMMAND
// =============================================================================

export async function scanMcpCommand(target, options = {}) {
  if (!target) {
    output.error('Usage: ship-safe scan-mcp <url|path>');
    output.info('  Analyze an MCP server\'s tool manifest for security issues before connecting.');
    process.exit(1);
  }

  console.log();
  output.header('Ship Safe — MCP Server Security Analysis');
  console.log();

  let manifest, serverName, source;

  if (target.startsWith('http://') || target.startsWith('https://')) {
    console.log(chalk.gray(`  Fetching MCP manifest from: ${target}`));
    try {
      manifest = await fetchMcpManifest(target);
      serverName = new URL(target).hostname;
      source = target;
    } catch (err) {
      output.error(`Failed to fetch MCP manifest: ${err.message}`);
      process.exit(1);
    }
  } else {
    const filePath = path.resolve(target);
    if (!fs.existsSync(filePath)) {
      output.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    try {
      manifest = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      serverName = path.basename(filePath);
      source = filePath;
    } catch (err) {
      output.error(`Failed to parse manifest: ${err.message}`);
      process.exit(1);
    }
  }

  const tools = extractTools(manifest);
  console.log(chalk.gray(`  Server: ${serverName}`));
  console.log(chalk.gray(`  Tools found: ${tools.length}`));
  console.log();

  if (tools.length === 0) {
    output.warning('No tools found in manifest. Is this a valid MCP tools response?');
    return;
  }

  const findings = analyzeManifest(manifest, tools, serverName, source);

  if (options.json) {
    console.log(JSON.stringify({ server: serverName, source, toolCount: tools.length, findings, summary: getSummary(findings) }, null, 2));
    return;
  }

  printFindings(findings, serverName, tools.length);

  if (getSummary(findings).critical > 0) {
    process.exit(1);
  }
}

// =============================================================================
// MCP MANIFEST FETCHING
// =============================================================================

async function fetchMcpManifest(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');

  // Try MCP tools/list endpoint first (JSON-RPC 2.0)
  const jsonRpcBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  });

  const jsonRpcRes = await fetch(`${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonRpcBody,
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (jsonRpcRes?.ok) {
    const data = await jsonRpcRes.json();
    if (data?.result?.tools) return data.result;
  }

  // Fall back to GET /tools (some servers expose this)
  const getRes = await fetch(`${url}/tools`, {
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (getRes?.ok) {
    return await getRes.json();
  }

  // Fall back to root endpoint
  const rootRes = await fetch(`${url}`, {
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (rootRes?.ok) {
    const text = await rootRes.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Server responded but returned non-JSON content');
    }
  }

  throw new Error('Could not retrieve MCP manifest (tried tools/list JSON-RPC, GET /tools, GET /)');
}

// =============================================================================
// TOOL EXTRACTION — handles multiple MCP manifest formats
// =============================================================================

function extractTools(manifest) {
  // MCP tools/list result: { tools: [...] }
  if (Array.isArray(manifest?.tools)) return manifest.tools;
  // Direct array
  if (Array.isArray(manifest)) return manifest;
  // { result: { tools: [...] } }
  if (Array.isArray(manifest?.result?.tools)) return manifest.result.tools;
  return [];
}

// =============================================================================
// ANALYSIS
// =============================================================================

function analyzeManifest(manifest, tools, serverName, source) {
  const findings = [];
  const rawJson = JSON.stringify(manifest);

  // 1. Threat intel hash check on full manifest
  const hash = createHash('sha256').update(rawJson).digest('hex');
  const intelMatch = ThreatIntel.lookupHash(hash);
  if (intelMatch) {
    findings.push({
      check: 'threat-intel',
      name: `Known malicious MCP server: ${intelMatch.name}`,
      severity: 'critical',
      tool: null,
      matched: `SHA-256: ${hash} — ${intelMatch.description}`,
    });
  }

  // 2. Threat intel signature check on raw manifest
  const sigMatches = ThreatIntel.matchSignatures(rawJson);
  for (const sig of sigMatches) {
    findings.push({
      check: 'threat-intel',
      name: `Threat intel match: ${sig.description}`,
      severity: sig.severity || 'critical',
      tool: null,
      matched: `Pattern: ${sig.pattern}`,
    });
  }

  // 3. Per-tool analysis
  for (const tool of tools) {
    findings.push(...analyzeToolDefinition(tool));
  }

  // 4. Server-level checks
  findings.push(...checkServerLevel(manifest, serverName));

  return findings;
}

function analyzeToolDefinition(tool) {
  const findings = [];
  const name = tool.name || '(unnamed)';
  const description = tool.description || '';
  const schemaStr = JSON.stringify(tool.inputSchema || tool.input_schema || {});

  // Check description against patterns
  for (const pattern of MCP_TOOL_PATTERNS) {
    if (pattern.target === 'schema') continue; // schema checked separately below
    pattern.regex.lastIndex = 0;
    const text = pattern.target === 'description' ? description
      : pattern.target === 'any' ? description + ' ' + schemaStr
      : description;
    if (pattern.regex.test(text)) {
      findings.push({
        check: 'static-analysis',
        name: pattern.name,
        severity: pattern.severity,
        tool: name,
        matched: (description + schemaStr).slice(0, 120),
      });
    }
  }

  // Check schema for dangerous input patterns
  for (const pattern of MCP_TOOL_PATTERNS) {
    if (pattern.target !== 'schema') continue;
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(schemaStr)) {
      findings.push({
        check: 'schema-analysis',
        name: pattern.name,
        severity: pattern.severity,
        tool: name,
        matched: schemaStr.slice(0, 120),
      });
    }
  }

  // Check tool name against dangerous name list
  for (const namePattern of DANGEROUS_TOOL_NAMES) {
    if (namePattern.test(name)) {
      findings.push({
        check: 'tool-name',
        name: `Dangerous tool name: "${name}"`,
        severity: 'high',
        tool: name,
        matched: `Tool name matches high-risk pattern: ${namePattern}`,
      });
      break;
    }
  }

  // Check for excessive required parameters (information harvesting)
  const required = tool.inputSchema?.required || tool.input_schema?.required || [];
  const properties = tool.inputSchema?.properties || tool.input_schema?.properties || {};
  const propNames = Object.keys(properties);
  const sensitiveParams = propNames.filter(p =>
    /(?:api[_\s]?key|token|password|secret|credential|auth|private)/i.test(p)
  );
  if (sensitiveParams.length > 0) {
    findings.push({
      check: 'schema-analysis',
      name: `Tool requires sensitive parameters: ${sensitiveParams.join(', ')}`,
      severity: 'high',
      tool: name,
      matched: `Required sensitive params: [${sensitiveParams.join(', ')}]`,
    });
  }

  return findings;
}

function checkServerLevel(manifest, serverName) {
  const findings = [];
  const raw = JSON.stringify(manifest);

  // Check for excessively large manifest (may hide payloads)
  if (raw.length > 500_000) {
    findings.push({
      check: 'server-level',
      name: 'Unusually large manifest',
      severity: 'medium',
      tool: null,
      matched: `Manifest size: ${(raw.length / 1024).toFixed(1)} KB (>500 KB is suspicious)`,
    });
  }

  // Check for tools with no description (reduces reviewability)
  const tools = extractTools(manifest);
  const noDesc = tools.filter(t => !t.description || t.description.trim().length < 10);
  if (noDesc.length > 0 && noDesc.length === tools.length) {
    findings.push({
      check: 'server-level',
      name: 'All tools lack descriptions',
      severity: 'medium',
      tool: null,
      matched: `${noDesc.length}/${tools.length} tools have no meaningful description — cannot assess intent`,
    });
  }

  return findings;
}

// =============================================================================
// OUTPUT
// =============================================================================

function printFindings(findings, serverName, toolCount) {
  const summary = getSummary(findings);

  if (findings.length === 0) {
    console.log(chalk.green.bold(`  ✔ ${serverName}: No security issues found across ${toolCount} tool(s).`));
    console.log();
    return;
  }

  console.log(chalk.red.bold(`  ✘ ${serverName}: ${findings.length} issue(s) found across ${toolCount} tool(s)`));
  console.log();

  // Group by tool
  const byTool = new Map();
  for (const f of findings) {
    const key = f.tool || '(server-level)';
    if (!byTool.has(key)) byTool.set(key, []);
    byTool.get(key).push(f);
  }

  for (const [toolName, toolFindings] of byTool) {
    if (toolName !== '(server-level)') {
      console.log(chalk.cyan(`  Tool: ${toolName}`));
    } else {
      console.log(chalk.cyan(`  Server-level`));
    }

    for (const f of toolFindings) {
      const sevColor = f.severity === 'critical' ? chalk.red.bold
        : f.severity === 'high' ? chalk.yellow
        : chalk.blue;
      console.log(`    ${sevColor(`[${f.severity.toUpperCase()}]`)} ${chalk.white(f.name)}`);
      if (f.matched) console.log(chalk.gray(`      ${f.matched.slice(0, 120)}`));
    }
    console.log();
  }

  if (summary.critical > 0) {
    console.log(chalk.red.bold('    ⚠ DO NOT CONNECT to this MCP server — critical security issues detected.'));
    console.log();
  }
}

function getSummary(findings) {
  return {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
  };
}
