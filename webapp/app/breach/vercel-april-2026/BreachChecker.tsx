'use client';

import { useState, useCallback } from 'react';
import styles from './breach.module.css';

/* ── Types ── */
type Severity = 'critical' | 'high' | 'medium' | 'info';

interface CheckFinding {
  severity: Severity;
  title: string;
  detail: string;
  fix: string;
}

interface CheckResult {
  status: 'clean' | 'findings' | 'error';
  summary: string;
  findings: CheckFinding[];
}

type CheckState = { phase: 'idle' } | { phase: 'running' } | { phase: 'done'; result: CheckResult };

/* ── Icons ── */
const icons = {
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  ),
  vercel: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z" />
    </svg>
  ),
  log: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  config: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  lock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  run: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
};

/* ── Result renderer ── */
function ResultView({ result }: { result: CheckResult }) {
  if (result.status === 'clean') {
    return (
      <div className={styles.resultClean}>
        {icons.check}
        <span>{result.summary}</span>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className={styles.resultError}>
        {icons.x}
        <span>{result.summary}</span>
      </div>
    );
  }

  return (
    <div className={styles.resultFindings}>
      <div className={styles.resultFindingsHeader}>
        {icons.alert}
        <span>{result.summary}</span>
      </div>
      <div className={styles.findingsList}>
        {result.findings.map((f, i) => (
          <div key={i} className={styles.findingItem}>
            <div className={styles.findingTop}>
              <span className={styles.findingSev} data-sev={f.severity}>{f.severity}</span>
              <span className={styles.findingTitle}>{f.title}</span>
            </div>
            <p className={styles.findingDetail}>{f.detail}</p>
            <div className={styles.findingFix}>
              <strong>Fix: </strong>{f.fix.includes('\n') ? (
                <code className={styles.findingFixCode}>{f.fix}</code>
              ) : f.fix}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════ */
export default function BreachChecker() {
  // Check 1 — GitHub
  const [repoUrl, setRepoUrl]   = useState('');
  const [ghState, setGhState]   = useState<CheckState>({ phase: 'idle' });

  // Check 2 + 3 — Vercel (shared token)
  const [vercelToken, setVercelToken] = useState('');
  const [teamId, setTeamId]           = useState('');
  const [intState, setIntState] = useState<CheckState>({ phase: 'idle' });
  const [auditState, setAuditState] = useState<CheckState>({ phase: 'idle' });

  // Check 4 — Config paste
  const [configText, setConfigText] = useState('');
  const [cfgState, setCfgState] = useState<CheckState>({ phase: 'idle' });

  const runCheck = useCallback(async (
    body: Record<string, string>,
    setState: React.Dispatch<React.SetStateAction<CheckState>>,
  ) => {
    setState({ phase: 'running' });
    try {
      const res = await fetch('/api/breach/vercel-april-2026', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: CheckResult | { error: string } = await res.json();
      if ('error' in data) {
        setState({ phase: 'done', result: { status: 'error', summary: data.error, findings: [] } });
      } else {
        setState({ phase: 'done', result: data });
      }
    } catch {
      setState({ phase: 'done', result: { status: 'error', summary: 'Request failed. Check your network connection.', findings: [] } });
    }
  }, []);

  const runVercelBoth = useCallback(() => {
    const token = vercelToken.trim();
    const team  = teamId.trim() || undefined;
    if (!token) return;
    runCheck({ check: 'vercel-integrations', vercelToken: token, ...(team ? { teamId: team } : {}) }, setIntState);
    runCheck({ check: 'vercel-audit',        vercelToken: token, ...(team ? { teamId: team } : {}) }, setAuditState);
  }, [vercelToken, teamId, runCheck]);

  const hasAnyResult =
    ghState.phase === 'done' ||
    intState.phase === 'done' ||
    auditState.phase === 'done' ||
    cfgState.phase === 'done';

  const totalFindings = [ghState, intState, auditState, cfgState].reduce((acc, s) => {
    if (s.phase === 'done' && s.result.status === 'findings') return acc + s.result.findings.length;
    return acc;
  }, 0);

  return (
    <>
      <div className={styles.checks}>

        {/* ── Check 1: GitHub workflows ── */}
        <div className={styles.checkCard}>
          <div className={styles.checkHeader}>
            <div className={styles.checkIconWrap}>{icons.github}</div>
            <div className={styles.checkMeta}>
              <div className={styles.checkNumber}>Check 1 of 4 — No auth required</div>
              <div className={styles.checkTitle}>GitHub Workflow AI Action Pinning</div>
              <p className={styles.checkDesc}>
                Scans your public repo&apos;s <code>.github/workflows/</code> for AI-named GitHub Actions
                referenced by mutable tags instead of commit SHAs — the exact vector used to compromise
                pipelines in April 2026.
              </p>
            </div>
          </div>
          <div className={styles.checkBody}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="url"
                placeholder="https://github.com/your-org/your-repo"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && repoUrl.trim()) {
                    runCheck({ check: 'github', repoUrl: repoUrl.trim() }, setGhState);
                  }
                }}
              />
              <button
                className={styles.runBtn}
                disabled={!repoUrl.trim() || ghState.phase === 'running'}
                onClick={() => runCheck({ check: 'github', repoUrl: repoUrl.trim() }, setGhState)}
              >
                {icons.run} Scan
              </button>
            </div>
          </div>
          {ghState.phase === 'running' && (
            <div className={styles.result}>
              <div className={styles.resultRunning}>
                <div className={styles.spinner} />
                Fetching workflows from GitHub API…
              </div>
            </div>
          )}
          {ghState.phase === 'done' && (
            <div className={styles.result}>
              <ResultView result={ghState.result} />
            </div>
          )}
        </div>

        {/* ── Check 2 + 3: Vercel ── */}
        <div className={styles.checkCard}>
          <div className={styles.checkHeader}>
            <div className={styles.checkIconWrap}>{icons.vercel}</div>
            <div className={styles.checkMeta}>
              <div className={styles.checkNumber}>Checks 2 &amp; 3 of 4 — Vercel API token required</div>
              <div className={styles.checkTitle}>Vercel Integration Scopes &amp; Audit Log</div>
              <p className={styles.checkDesc}>
                Checks your installed integrations for dangerous scope combinations (env:read +
                deployments:write) and scans your audit log for suspicious activity between
                March 28 – April 12, 2026 — the confirmed incident window.
              </p>
              <p className={styles.checkDisclaimer}>
                <strong>Note:</strong> Integration flagging is scope-based — any integration holding
                env:read, deployments:write, or secrets:read is flagged as a risk, regardless of vendor.
                Vercel has not published a list of confirmed-compromised integration names.
              </p>
            </div>
          </div>
          <div className={styles.checkBody}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="password"
                placeholder="Vercel API token (read access)"
                value={vercelToken}
                onChange={e => setVercelToken(e.target.value)}
              />
            </div>
            <div className={styles.inputOptional}>
              <span className={styles.optionalLabel}>Team ID (optional):</span>
              <input
                className={styles.input}
                type="text"
                placeholder="team_xxxxxxxxxxxxxxxxxxxx"
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
              />
            </div>
            <div className={styles.tokenNotice}>
              {icons.lock}
              Your token is sent directly to our API for a single request and is never stored or logged.
              Create a read-only token at vercel.com/account/tokens.
            </div>
            <button
              className={`${styles.runBtn} ${styles.runBtnFull}`}
              disabled={!vercelToken.trim() || intState.phase === 'running' || auditState.phase === 'running'}
              onClick={runVercelBoth}
            >
              {icons.run} Run both checks
            </button>
          </div>

          {/* Integration result */}
          {(intState.phase === 'running' || intState.phase === 'done') && (
            <div className={styles.result}>
              <div className={styles.checkNumber} style={{ padding: '0 0 0.5rem', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                CHECK 2 — INTEGRATION SCOPES
              </div>
              {intState.phase === 'running' ? (
                <div className={styles.resultRunning}>
                  <div className={styles.spinner} />
                  Fetching integrations from Vercel API…
                </div>
              ) : (
                <ResultView result={intState.result} />
              )}
            </div>
          )}

          {/* Audit log result */}
          {(auditState.phase === 'running' || auditState.phase === 'done') && (
            <div className={styles.result}>
              <div className={styles.checkNumber} style={{ padding: '0.75rem 0 0.5rem', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                CHECK 3 — AUDIT LOG (MAR 28 – APR 12)
              </div>
              {auditState.phase === 'running' ? (
                <div className={styles.resultRunning}>
                  <div className={styles.spinner} />
                  Scanning audit log for incident-window events…
                </div>
              ) : (
                <ResultView result={auditState.result} />
              )}
            </div>
          )}
        </div>

        {/* ── Check 4: Config paste ── */}
        <div className={styles.checkCard}>
          <div className={styles.checkHeader}>
            <div className={styles.checkIconWrap}>{icons.config}</div>
            <div className={styles.checkMeta}>
              <div className={styles.checkNumber}>Check 4 of 4 — No auth required</div>
              <div className={styles.checkTitle}>MCP / Hermes Config Cross-Boundary Token Scan</div>
              <p className={styles.checkDesc}>
                Paste your <code>.mcp.json</code>, <code>hermes.json</code>, or any agent config.
                We run the same patterns as <code>AgenticSupplyChainAgent</code> to detect credentials
                being forwarded to third-party tool servers — the silent exfiltration channel at the
                core of the April 2026 attack.
              </p>
            </div>
          </div>
          <div className={styles.checkBody}>
            <textarea
              className={styles.textarea}
              placeholder={`Paste your .mcp.json, hermes.json, or agent config here…\n\nExample:\n{\n  "servers": {\n    "ai-deployer": {\n      "url": "https://mcp.vendor.com/vercel",\n      "env": { "VERCEL_TOKEN": "\${VERCEL_TOKEN}" }\n    }\n  }\n}`}
              value={configText}
              onChange={e => setConfigText(e.target.value)}
            />
            <button
              className={`${styles.runBtn} ${styles.runBtnFull}`}
              disabled={!configText.trim() || cfgState.phase === 'running'}
              onClick={() => runCheck({ check: 'config', configText: configText.trim() }, setCfgState)}
            >
              {icons.run} Scan config
            </button>
          </div>
          {cfgState.phase === 'running' && (
            <div className={styles.result}>
              <div className={styles.resultRunning}>
                <div className={styles.spinner} />
                Scanning for cross-boundary token patterns…
              </div>
            </div>
          )}
          {cfgState.phase === 'done' && (
            <div className={styles.result}>
              <ResultView result={cfgState.result} />
            </div>
          )}
        </div>

      </div>

      {/* ── Summary CTA ── */}
      {hasAnyResult && (
        <div className={styles.summarySection}>
          <div className={styles.summaryCard}>
            {totalFindings > 0 ? (
              <>
                <h3>{totalFindings} issue{totalFindings === 1 ? '' : 's'} found across your checks</h3>
                <p>
                  The findings above need your attention. Rotate any tokens that may have been exposed,
                  revoke integrations with dangerous scopes, and pin all GitHub Actions to commit SHAs.
                  For a full codebase scan including CI/CD pipeline analysis and MCP server enumeration,
                  run Ship Safe locally:
                </p>
              </>
            ) : (
              <>
                <h3>All checks passed</h3>
                <p>
                  No issues were detected in the checks you ran. To verify your full codebase
                  — including all CI/CD workflows, agent configs, and webhook handlers — run a
                  complete Ship Safe audit locally:
                </p>
              </>
            )}
            <pre style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', margin: 0 }}>
              <code>npx ship-safe audit .</code>
            </pre>
            <div className={styles.summaryActions}>
              <a href="/signup" className="btn btn-primary">Get continuous monitoring</a>
              <a href="/blog/vercel-april-2026-ai-integration-supply-chain-attack" className="btn btn-ghost">Read incident analysis</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
