'use client';

import { useState, useRef } from 'react';
import styles from './rotate.module.css';

interface AffectedEnvVar {
  projectId: string;
  projectName: string;
  envVar: string;
  envId: string;
  envType: string;
}

interface IssuerGroup {
  issuer: string;
  name: string;
  rotateUrl: string | null;
  affected: AffectedEnvVar[];
}

interface DiscoverResult {
  projectsScanned: number;
  totalEnvVars: number;
  issuers: IssuerGroup[];
  accountSlug: string;
  generatedAt: string;
  teamId: string | null;
}

type Phase = 'input' | 'loading' | 'results';

const ISSUER_ICONS: Record<string, string> = {
  github:         '#',
  vercel:         '▲',
  openai:         '◎',
  anthropic:      '⌬',
  stripe:         '$',
  'stripe-webhook': '$',
  supabase:       '⚡',
  database:       '⬡',
  aws:            '☁',
  linear:         '◈',
  slack:          '#',
  sendgrid:       '✉',
  resend:         '✉',
  google:         '◉',
  twilio:         '☎',
  datadog:        '🐶',
  sentry:         '◎',
  neon:           '⚡',
  planetscale:    '⬡',
  clerk:          '🔑',
  workos:         '◈',
  hubspot:        '⬡',
  livekit:        '◎',
  upstash:        '⬡',
  replicate:      '◎',
};

function IssuerCard({ group, accountSlug, expanded, onToggle }: {
  group: IssuerGroup;
  accountSlug: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = ISSUER_ICONS[group.issuer] ?? '●';
  const projectCount = new Set(group.affected.map(a => a.projectId)).size;

  function vercelEnvUrl(projectName: string) {
    if (accountSlug) return `https://vercel.com/${accountSlug}/${projectName}/settings/environment-variables`;
    return `https://vercel.com/dashboard`;
  }

  return (
    <div className={styles.issuerCard}>
      <button className={styles.issuerHeader} onClick={onToggle}>
        <div className={styles.issuerLeft}>
          <span className={styles.issuerIcon}>{icon}</span>
          <div>
            <div className={styles.issuerName}>{group.name}</div>
            <div className={styles.issuerMeta}>
              {group.affected.length} env var{group.affected.length !== 1 ? 's' : ''} across{' '}
              {projectCount} project{projectCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className={styles.issuerRight}>
          {group.rotateUrl && (
            <a
              href={group.rotateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.rotateLink}
              onClick={e => e.stopPropagation()}
            >
              1. Generate new key →
            </a>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className={styles.issuerBody}>
          {group.rotateUrl && (
            <div className={styles.issuerSteps}>
              <span className={styles.stepPill}>
                <a href={group.rotateUrl} target="_blank" rel="noopener noreferrer">
                  1. Generate a new {group.name} key
                </a>
              </span>
              <span className={styles.stepArrow}>→</span>
              <span className={styles.stepPill}>2. Update each project below</span>
            </div>
          )}
          <table className={styles.envTable}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Env Var</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {group.affected.map((a, i) => (
                <tr key={i}>
                  <td className={styles.projectCell}>{a.projectName}</td>
                  <td><code className={styles.envKey}>{a.envVar}</code></td>
                  <td>
                    <a
                      href={vercelEnvUrl(a.projectName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.updateLink}
                    >
                      Update in Vercel →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RotateWizard() {
  const [phase, setPhase] = useState<Phase>('input');
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tokenRef = useRef<HTMLInputElement>(null);

  function toggleExpand(issuer: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(issuer)) next.delete(issuer);
      else next.add(issuer);
      return next;
    });
  }

  async function handleDiscover() {
    if (!token.trim()) {
      setError('Vercel API token is required.');
      tokenRef.current?.focus();
      return;
    }
    setError('');
    setPhase('loading');

    try {
      const res = await fetch('/api/rotate/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vercelToken: token.trim(), teamId: teamId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Discovery failed. Please check your token and try again.');
        setPhase('input');
        return;
      }
      setResult(data);
      // Auto-expand all groups if there are 4 or fewer issuers
      if (data.issuers.length <= 4) {
        setExpanded(new Set(data.issuers.map((g: IssuerGroup) => g.issuer)));
      }
      setPhase('results');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setPhase('input');
    }
  }

  return (
    <section className={styles.wizardSection}>
      <div className={styles.wizardInner}>

        {/* ── Input phase ── */}
        {(phase === 'input' || phase === 'loading') && (
          <div className={styles.inputCard}>
            <div className={styles.inputCardHeader}>
              <h2>Discover credentials</h2>
              <p>Enter your Vercel API token. We&apos;ll scan all your projects for high-value env var names — values are never fetched.</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="vercel-token" className={styles.label}>
                Vercel API Token
                <span className={styles.required}>required</span>
              </label>
              <input
                id="vercel-token"
                ref={tokenRef}
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                placeholder="vercel_••••••••••••••••••••••••••••••••••••"
                className={styles.input}
                autoComplete="off"
                spellCheck={false}
                disabled={phase === 'loading'}
              />
              <p className={styles.fieldHint}>
                Go to{' '}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer">
                  vercel.com/account/tokens
                </a>{' '}
                and create a token with read access.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="team-id" className={styles.label}>
                Team ID
                <span className={styles.optional}>optional</span>
              </label>
              <input
                id="team-id"
                type="text"
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                placeholder="team_xxxxxxxxxxxxxx"
                className={styles.input}
                autoComplete="off"
                spellCheck={false}
                disabled={phase === 'loading'}
              />
              <p className={styles.fieldHint}>Required if your projects are under a Vercel team. Find it in Settings → General.</p>
            </div>

            {error && (
              <div className={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <div className={styles.securityNote}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Your token is used only for the Vercel API request and is never stored or logged. Env var values are never fetched.
            </div>

            <button
              className={`btn btn-primary ${styles.discoverBtn}`}
              onClick={handleDiscover}
              disabled={phase === 'loading'}
            >
              {phase === 'loading' ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Scanning projects...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Discover credentials
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Results phase ── */}
        {phase === 'results' && result && (
          <div className={styles.results}>

            {/* Stats row */}
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{result.projectsScanned}</span>
                <span className={styles.statLabel}>projects scanned</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>{result.totalEnvVars}</span>
                <span className={styles.statLabel}>env vars found</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>{result.issuers.length}</span>
                <span className={styles.statLabel}>credential types</span>
              </div>
            </div>

            {result.issuers.length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p>No high-value credentials found across {result.projectsScanned} project{result.projectsScanned !== 1 ? 's' : ''}.</p>
                <p className={styles.emptyHint}>Either no credentials match our 25+ patterns, or the scanned projects don&apos;t have env vars set.</p>
              </div>
            ) : (
              <>
                <div className={styles.issuerList}>
                  {result.issuers.map(group => (
                    <IssuerCard
                      key={group.issuer}
                      group={group}
                      accountSlug={result.accountSlug}
                      expanded={expanded.has(group.issuer)}
                      onToggle={() => toggleExpand(group.issuer)}
                    />
                  ))}
                </div>

                <div className={styles.actions}>
                  <button className="btn btn-ghost" onClick={() => { setPhase('input'); setResult(null); setError(''); }}>
                    ← Scan again
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
