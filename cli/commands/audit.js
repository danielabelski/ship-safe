/**
 * Audit Command — Full Security Audit
 * =====================================
 *
 * One command to run everything: secrets, agents, deps, score, and
 * generate a comprehensive report with a prioritized remediation plan.
 *
 * USAGE:
 *   npx ship-safe audit [path]                 Full audit with HTML report
 *   npx ship-safe audit . --json               JSON output
 *   npx ship-safe audit . --html report.html   Custom report path
 *   npx ship-safe audit . --no-deps            Skip dependency audit
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fg from 'fast-glob';
import { buildOrchestrator } from '../agents/index.js';
import { ScoringEngine } from '../agents/scoring-engine.js';
import { PolicyEngine } from '../agents/policy-engine.js';
import { HTMLReporter } from '../agents/html-reporter.js';
import { SBOMGenerator } from '../agents/sbom-generator.js';
import { autoDetectProvider } from '../providers/llm-provider.js';
import { runDepsAudit } from './deps.js';
import {
  SECRET_PATTERNS,
  SECURITY_PATTERNS,
  SKIP_DIRS,
  SKIP_EXTENSIONS,
  MAX_FILE_SIZE
} from '../utils/patterns.js';
import { isHighEntropyMatch, getConfidence } from '../utils/entropy.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALL_PATTERNS = [...SECRET_PATTERNS, ...SECURITY_PATTERNS];

const SEV_ORDER = ['critical', 'high', 'medium', 'low'];

const CATEGORY_LABELS = {
  secrets: 'Secrets',
  injection: 'Code Vulnerabilities',
  deps: 'Dependencies',
  auth: 'Auth & Access Control',
  config: 'Configuration',
  'supply-chain': 'Supply Chain',
  api: 'API Security',
  llm: 'AI/LLM Security',
};

const EFFORT_MAP = {
  secrets: 'low',
  config: 'low',
  deps: 'medium',
  injection: 'medium',
  auth: 'medium',
  'supply-chain': 'medium',
  api: 'medium',
  llm: 'high',
};

// =============================================================================
// MAIN COMMAND
// =============================================================================

export async function auditCommand(targetPath = '.', options = {}) {
  const absolutePath = path.resolve(targetPath);
  const machineOutput = options.json || options.sarif;

  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`  Path does not exist: ${absolutePath}`));
    process.exit(1);
  }

  if (!machineOutput) {
    console.log();
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan.bold('  Ship Safe v4.0 — Full Security Audit'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();
  }

  // ── Phase 1: Secret Scan ──────────────────────────────────────────────────
  const secretSpinner = machineOutput ? null : ora({ text: chalk.white('[Phase 1/4] Scanning for secrets...'), color: 'cyan' }).start();
  let secretFindings = [];
  let filesScanned = 0;

  try {
    const files = await findFiles(absolutePath);
    filesScanned = files.length;

    for (const file of files) {
      const fileResults = scanFileForSecrets(file);
      for (const f of fileResults) {
        secretFindings.push({
          file,
          line: f.line,
          column: f.column,
          severity: f.severity,
          category: f.category || 'secrets',
          rule: f.patternName,
          title: f.patternName.replace(/_/g, ' '),
          description: f.description,
          matched: f.matched,
          confidence: f.confidence,
          fix: `Move to environment variable or secrets manager`,
        });
      }
    }

    if (secretSpinner) secretSpinner.succeed(
      secretFindings.length === 0
        ? chalk.green('[Phase 1/4] Secrets: clean')
        : chalk.red(`[Phase 1/4] Secrets: ${secretFindings.length} found`)
    );
  } catch (err) {
    if (secretSpinner) secretSpinner.fail(chalk.red(`[Phase 1/4] Secret scan failed: ${err.message}`));
  }

  // ── Phase 2: Agent Scan ───────────────────────────────────────────────────
  const agentSpinner = machineOutput ? null : ora({ text: chalk.white('[Phase 2/4] Running 12 security agents...'), color: 'cyan' }).start();
  let agentFindings = [];
  let recon = null;
  let agentResults = [];

  try {
    const orchestrator = buildOrchestrator();
    // Suppress individual agent spinners by using quiet mode
    const results = await orchestrator.runAll(absolutePath, { quiet: true });
    recon = results.recon;
    agentFindings = results.findings;
    agentResults = results.agentResults;

    const totalAgentFindings = agentFindings.length;
    const agentCount = agentResults.filter(a => a.success).length;
    if (agentSpinner) agentSpinner.succeed(
      totalAgentFindings === 0
        ? chalk.green(`[Phase 2/4] ${agentCount} agents: clean`)
        : chalk.yellow(`[Phase 2/4] ${agentCount} agents: ${totalAgentFindings} finding(s)`)
    );
  } catch (err) {
    if (agentSpinner) agentSpinner.fail(chalk.red(`[Phase 2/4] Agent scan failed: ${err.message}`));
  }

  // ── Phase 3: Dependency Audit ─────────────────────────────────────────────
  let depVulns = [];
  if (options.deps !== false) {
    const depSpinner = machineOutput ? null : ora({ text: chalk.white('[Phase 3/4] Auditing dependencies...'), color: 'cyan' }).start();
    try {
      const depResult = await runDepsAudit(absolutePath);
      depVulns = depResult.vulns || [];
      if (depSpinner) depSpinner.succeed(
        depVulns.length === 0
          ? chalk.green('[Phase 3/4] Dependencies: clean')
          : chalk.red(`[Phase 3/4] Dependencies: ${depVulns.length} CVE(s)`)
      );
    } catch {
      if (depSpinner) depSpinner.succeed(chalk.gray('[Phase 3/4] Dependencies: skipped (no manifest)'));
    }
  } else if (!machineOutput) {
    console.log(chalk.gray('  [Phase 3/4] Dependencies: skipped (--no-deps)'));
  }

  // ── Phase 4: Merge, Score, and Build Plan ─────────────────────────────────
  const scoreSpinner = machineOutput ? null : ora({ text: chalk.white('[Phase 4/4] Computing security score...'), color: 'cyan' }).start();

  // Merge secret findings + agent findings, deduplicate
  const allFindings = deduplicateFindings([...secretFindings, ...agentFindings]);

  // Apply policy
  const policy = PolicyEngine.load(absolutePath);
  const filteredFindings = policy.applyPolicy(allFindings);

  // Score
  const scoringEngine = new ScoringEngine();
  const scoreResult = scoringEngine.compute(filteredFindings, depVulns);
  scoringEngine.saveToHistory(absolutePath, scoreResult);

  const gradeColor = scoreResult.score >= 75 ? chalk.green.bold : scoreResult.score >= 60 ? chalk.yellow.bold : chalk.red.bold;
  if (scoreSpinner) scoreSpinner.succeed(
    chalk.white('[Phase 4/4] Score: ') + gradeColor(`${scoreResult.score}/100 ${scoreResult.grade.letter}`)
  );

  // ── AI Classification (optional) ─────────────────────────────────────────
  if (options.ai !== false) {
    const provider = autoDetectProvider(absolutePath);
    if (provider && filteredFindings.length > 0 && filteredFindings.length <= 50) {
      const aiSpinner = machineOutput ? null : ora({ text: `Classifying with ${provider.name}...`, color: 'cyan' }).start();
      try {
        const classifications = await provider.classify(filteredFindings);
        for (const cl of classifications) {
          const finding = filteredFindings.find(f => `${f.file}:${f.line}` === cl.id);
          if (finding) {
            finding.aiClassification = cl.classification;
            finding.aiReason = cl.reason;
            finding.aiFix = cl.fix;
          }
        }
        if (aiSpinner) aiSpinner.succeed(chalk.green(`AI classification complete (${provider.name})`));
      } catch (err) {
        if (aiSpinner) aiSpinner.fail(chalk.yellow(`AI classification failed: ${err.message}`));
      }
    }
  }

  // ── Build Remediation Plan ────────────────────────────────────────────────
  const remediationPlan = buildRemediationPlan(filteredFindings, depVulns, absolutePath);

  // ── Output ────────────────────────────────────────────────────────────────
  console.log();

  if (options.json) {
    outputJSON(scoreResult, filteredFindings, depVulns, recon, agentResults, remediationPlan);
  } else if (options.sarif) {
    outputSARIF(filteredFindings, absolutePath);
  } else {
    printReport(scoreResult, filteredFindings, depVulns, recon, remediationPlan, absolutePath, filesScanned);
  }

  // ── HTML Report (always generate unless --json/--sarif) ───────────────────
  if (!options.json && !options.sarif) {
    const htmlPath = typeof options.html === 'string' ? options.html : 'ship-safe-report.html';
    const reporter = new HTMLReporter();
    reporter.generateFullReport(scoreResult, filteredFindings, depVulns, recon, remediationPlan, absolutePath, htmlPath);
    console.log();
    console.log(chalk.cyan(`  Full report: ${chalk.white.bold(htmlPath)}`));
  }

  // ── Policy Violations ────────────────────────────────────────────────────
  const violations = policy.evaluate(scoreResult, filteredFindings);
  if (violations.length > 0) {
    console.log();
    console.log(chalk.red.bold('  Policy Violations:'));
    for (const v of violations.slice(0, 5)) {
      console.log(chalk.red(`    ✗ ${v.message}`));
    }
  }

  // ── Trend ─────────────────────────────────────────────────────────────────
  const trend = scoringEngine.getTrend(absolutePath, scoreResult.score);
  if (trend) {
    const arrow = trend.diff > 0 ? chalk.green('↑') : trend.diff < 0 ? chalk.red('↓') : chalk.gray('→');
    console.log(chalk.gray(`  Trend: ${trend.previousScore} → ${trend.currentScore} ${arrow} (${trend.diff > 0 ? '+' : ''}${trend.diff})`));
  }

  console.log();
  console.log(chalk.cyan('═'.repeat(60)));
  console.log();

  process.exit(scoreResult.score >= 75 ? 0 : 1);
}

// =============================================================================
// REMEDIATION PLAN BUILDER
// =============================================================================

function buildRemediationPlan(findings, depVulns, rootPath) {
  const plan = [];
  let priority = 1;

  // Priority order: secrets first, then by severity
  const secretFindings = findings.filter(f => f.category === 'secrets' || f.category === 'secret');
  const otherFindings = findings.filter(f => f.category !== 'secrets' && f.category !== 'secret');

  // Group and sort
  for (const sev of SEV_ORDER) {
    // Secrets at this severity
    for (const f of secretFindings.filter(s => s.severity === sev)) {
      plan.push({
        priority: priority++,
        severity: sev,
        category: 'secrets',
        categoryLabel: 'SECRETS',
        title: f.title || f.rule,
        file: `${path.relative(rootPath, f.file).replace(/\\/g, '/')}:${f.line}`,
        action: f.aiFix || f.fix || f.description,
        effort: 'low',
      });
    }

    // Other findings at this severity
    for (const f of otherFindings.filter(s => s.severity === sev)) {
      plan.push({
        priority: priority++,
        severity: sev,
        category: f.category,
        categoryLabel: (CATEGORY_LABELS[f.category] || f.category).toUpperCase(),
        title: f.title || f.rule,
        file: `${path.relative(rootPath, f.file).replace(/\\/g, '/')}:${f.line}`,
        action: f.aiFix || f.fix || f.description,
        effort: EFFORT_MAP[f.category] || 'medium',
      });
    }

    // Dep vulns at this severity
    for (const d of depVulns.filter(v => v.severity === sev || (sev === 'medium' && v.severity === 'moderate'))) {
      plan.push({
        priority: priority++,
        severity: sev,
        category: 'deps',
        categoryLabel: 'DEPENDENCIES',
        title: `Vulnerable: ${d.package || d.id}`,
        file: 'package.json',
        action: d.description ? `${d.description.slice(0, 80)}` : 'Update to patched version',
        effort: 'medium',
      });
    }
  }

  return plan;
}

// =============================================================================
// CONSOLE OUTPUT
// =============================================================================

function printReport(scoreResult, findings, depVulns, recon, plan, rootPath, filesScanned) {
  const GRADE_COLOR = { A: chalk.green.bold, B: chalk.cyan.bold, C: chalk.yellow.bold, D: chalk.red, F: chalk.red.bold };
  const SEV_ICON = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
  const SEV_LABEL = { critical: 'CRITICAL — fix immediately', high: 'HIGH — fix before deploy', medium: 'MEDIUM — fix soon', low: 'LOW — review when possible' };

  // ── Score ─────────────────────────────────────────────────────────────────
  const gradeColor = GRADE_COLOR[scoreResult.grade.letter] || chalk.white;
  const scoreColor = scoreResult.score >= 75 ? chalk.green.bold : scoreResult.score >= 60 ? chalk.yellow.bold : chalk.red.bold;

  console.log(chalk.cyan('  ' + '═'.repeat(56)));
  console.log(
    chalk.white.bold('  Security Score: ') +
    scoreColor(`${scoreResult.score}/100 `) +
    gradeColor(scoreResult.grade.letter) +
    chalk.gray(` — ${scoreResult.grade.label}`)
  );
  console.log(chalk.cyan('  ' + '═'.repeat(56)));
  console.log();

  // ── Category Breakdown ────────────────────────────────────────────────────
  console.log(chalk.white.bold('  Category Breakdown'));
  console.log(chalk.gray('  ' + '─'.repeat(56)));

  for (const [key, cat] of Object.entries(scoreResult.categories)) {
    const count = Object.values(cat.counts).reduce((a, b) => a + b, 0);
    const icon = count === 0 ? chalk.green('✔') : chalk.red('✘');
    const status = count === 0 ? chalk.green('clean') : chalk.red(`${count} issue(s)`);
    const deduction = cat.deduction > 0 ? chalk.red(`-${cat.deduction} pts`) : chalk.gray('+0');
    console.log(`  ${icon}  ${chalk.white(cat.label.padEnd(22))} ${status.padEnd(25)} ${deduction}`);
  }

  // Deps row
  const depIcon = depVulns.length === 0 ? chalk.green('✔') : chalk.red('✘');
  const depStatus = depVulns.length === 0 ? chalk.green('clean') : chalk.red(`${depVulns.length} CVE(s)`);
  console.log(`  ${depIcon}  ${chalk.white('Dependencies'.padEnd(22))} ${depStatus}`);

  console.log(chalk.gray(`\n  Files scanned: ${filesScanned} | Findings: ${findings.length} | CVEs: ${depVulns.length}`));

  // ── Remediation Plan ──────────────────────────────────────────────────────
  if (plan.length > 0) {
    console.log();
    console.log(chalk.cyan('  ' + '═'.repeat(56)));
    console.log(chalk.cyan.bold('  Remediation Plan'));
    console.log(chalk.cyan('  ' + '═'.repeat(56)));

    let currentSev = null;
    let shown = 0;
    const maxItems = 30;

    for (const item of plan) {
      if (shown >= maxItems) {
        console.log(chalk.gray(`\n  ... and ${plan.length - maxItems} more items in the full report`));
        break;
      }

      if (item.severity !== currentSev) {
        currentSev = item.severity;
        console.log();
        console.log(chalk.white.bold(`  ${SEV_ICON[currentSev] || '⚪'} ${SEV_LABEL[currentSev] || currentSev.toUpperCase()}`));
        console.log(chalk.gray('  ' + '─'.repeat(56)));
      }

      console.log(
        chalk.white(`  ${String(item.priority).padStart(2)}.`) +
        chalk.gray(` [${item.categoryLabel}] `) +
        chalk.white(item.title)
      );
      console.log(
        chalk.gray(`      ${item.file}`) +
        chalk.gray(' → ') +
        chalk.green((item.action || '').slice(0, 70))
      );
      shown++;
    }
  } else {
    console.log();
    console.log(chalk.green.bold('  All clear — safe to ship!'));
  }

  // ── Attack Surface ────────────────────────────────────────────────────────
  if (recon) {
    console.log();
    console.log(chalk.gray('  Attack Surface:'));
    if (recon.frameworks?.length) console.log(chalk.gray(`    Frameworks:  ${recon.frameworks.join(', ')}`));
    if (recon.databases?.length) console.log(chalk.gray(`    Databases:   ${recon.databases.join(', ')}`));
    if (recon.authPatterns?.length) console.log(chalk.gray(`    Auth:        ${recon.authPatterns.join(', ')}`));
    if (recon.apiRoutes?.length) console.log(chalk.gray(`    API Routes:  ${recon.apiRoutes.length} discovered`));
  }
}

// =============================================================================
// JSON OUTPUT
// =============================================================================

function outputJSON(scoreResult, findings, depVulns, recon, agentResults, remediationPlan) {
  console.log(JSON.stringify({
    score: scoreResult.score,
    grade: scoreResult.grade.letter,
    gradeLabel: scoreResult.grade.label,
    totalFindings: findings.length,
    totalDepVulns: depVulns.length,
    categories: Object.fromEntries(
      Object.entries(scoreResult.categories).map(([k, v]) => [k, {
        label: v.label,
        findingCount: Object.values(v.counts).reduce((a, b) => a + b, 0),
        deduction: v.deduction,
        counts: v.counts,
      }])
    ),
    findings: findings.map(f => ({
      file: f.file, line: f.line, severity: f.severity, category: f.category,
      rule: f.rule, title: f.title, description: f.description, fix: f.fix,
      cwe: f.cwe, owasp: f.owasp,
    })),
    depVulns: depVulns.map(d => ({
      severity: d.severity, package: d.package || d.id, description: d.description,
    })),
    remediationPlan,
    recon,
    agents: agentResults,
  }, null, 2));
}

// =============================================================================
// SARIF OUTPUT
// =============================================================================

function outputSARIF(findings, rootPath) {
  const rules = {};
  for (const f of findings) {
    if (!rules[f.rule]) {
      rules[f.rule] = {
        id: f.rule,
        name: f.title || f.rule,
        shortDescription: { text: f.title || f.rule },
        fullDescription: { text: f.description || '' },
        defaultConfiguration: {
          level: ['critical', 'high'].includes(f.severity) ? 'error' : 'warning',
        },
      };
    }
  }

  console.log(JSON.stringify({
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'ship-safe',
          version: '4.0.0',
          informationUri: 'https://github.com/asamassekou10/ship-safe',
          rules: Object.values(rules),
        }
      },
      results: findings.map(f => ({
        ruleId: f.rule,
        level: ['critical', 'high'].includes(f.severity) ? 'error' : 'warning',
        message: { text: `${f.title}: ${f.description}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: path.relative(rootPath, f.file).replace(/\\/g, '/'), uriBaseId: '%SRCROOT%' },
            region: { startLine: f.line, startColumn: f.column || 1 },
          }
        }],
      })),
    }],
  }, null, 2));
}

// =============================================================================
// FILE SCANNING (inline from scan.js to avoid circular deps)
// =============================================================================

async function findFiles(rootPath) {
  const globIgnore = Array.from(SKIP_DIRS).map(dir => `**/${dir}/**`);

  // Load .ship-safeignore
  const ignorePath = path.join(rootPath, '.ship-safeignore');
  if (fs.existsSync(ignorePath)) {
    try {
      const patterns = fs.readFileSync(ignorePath, 'utf-8')
        .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      for (const p of patterns) {
        if (p.endsWith('/')) { globIgnore.push(`**/${p}**`); }
        else { globIgnore.push(`**/${p}`); globIgnore.push(p); }
      }
    } catch { /* skip */ }
  }

  const files = await fg('**/*', {
    cwd: rootPath, absolute: true, onlyFiles: true, ignore: globIgnore, dot: true
  });

  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) return false;
    if (path.basename(file).endsWith('.min.js') || path.basename(file).endsWith('.min.css')) return false;
    try { if (fs.statSync(file).size > MAX_FILE_SIZE) return false; } catch { return false; }
    return true;
  });
}

function scanFileForSecrets(filePath) {
  const findings = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (/ship-safe-ignore/i.test(line)) continue;
      for (const pattern of SECRET_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(line)) !== null) {
          if (pattern.requiresEntropyCheck && !isHighEntropyMatch(match[0])) continue;
          findings.push({
            line: lineNum + 1, column: match.index + 1, matched: match[0],
            patternName: pattern.name, severity: pattern.severity,
            confidence: getConfidence(pattern, match[0]),
            description: pattern.description, category: pattern.category || 'secret'
          });
        }
      }
    }
  } catch { /* skip */ }

  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.line}:${f.matched}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateFindings(findings) {
  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.file}:${f.line}:${f.rule}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
