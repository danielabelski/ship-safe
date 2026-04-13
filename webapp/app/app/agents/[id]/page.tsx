'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './agent.module.css';

interface Tool { name: string; sourceUrl?: string }

interface Deployment {
  id: string;
  version: number;
  status: string;
  securityScore: number | null;
  subdomain: string | null;
  deployLog: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tools: Tool[];
  memoryProvider: string;
  maxDepth: number;
  skills: string[];
  envVars: Record<string, string>;
  ciProvider: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deployments: Deployment[];
}

type Tab = 'overview' | 'deployments' | 'settings';

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusLabel(status: string) {
  if (status === 'deployed') return { label: 'Live',    cls: 'statusLive' };
  if (status === 'running')  return { label: 'Running', cls: 'statusLive' };
  if (status === 'stopped')  return { label: 'Stopped', cls: 'statusStopped' };
  if (status === 'failed')   return { label: 'Failed',  cls: 'statusFailed' };
  if (status === 'pending')  return { label: 'Pending', cls: 'statusPending' };
  return { label: 'Draft', cls: 'statusDraft' };
}

function scoreColor(n: number) {
  if (n >= 80) return 'var(--green)';
  if (n >= 60) return 'var(--yellow)';
  return 'var(--red)';
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [agent, setAgent]       = useState<Agent | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('overview');
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    const res  = await fetch(`/api/agents/${id}`);
    if (!res.ok) { setError('Agent not found'); setLoading(false); return; }
    const data = await res.json();
    setAgent(data.agent);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirm(`Delete "${agent?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    router.push('/app/agents');
  }

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.skeleton} />
    </div>
  );

  if (error || !agent) return (
    <div className={styles.page}>
      <div className={styles.errorState}>{error || 'Something went wrong'}</div>
    </div>
  );

  const { label, cls } = statusLabel(agent.status);
  const lastDeploy = agent.deployments[0];

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <Link href="/app/agents" className={styles.back}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          Agents
        </Link>
        <div className={styles.titleRow}>
          <div className={styles.titleLeft}>
            <h1 className={styles.title}>{agent.name}</h1>
            <span className={`${styles.statusBadge} ${styles[cls]}`}>{label}</span>
          </div>
          <div className={styles.headerActions}>
            <Link href={`/app/agents/${id}/edit`} className={styles.editBtn}>Edit</Link>
            <button
              className={styles.deployBtn}
              title="Deploy coming in Phase 2"
              disabled
            >
              Deploy
            </button>
          </div>
        </div>
        {agent.description && <p className={styles.desc}>{agent.description}</p>}
        {lastDeploy?.subdomain && (
          <div className={styles.liveUrl}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {lastDeploy.subdomain}.shipsafecli.com
          </div>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className={styles.tabs}>
        {(['overview', 'deployments', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ───────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className={styles.tabContent}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{agent.tools.length}</div>
              <div className={styles.statLabel}>Tools</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{agent.maxDepth}</div>
              <div className={styles.statLabel}>Max depth</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{agent.deployments.length}</div>
              <div className={styles.statLabel}>Deployments</div>
            </div>
            {lastDeploy?.securityScore != null && (
              <div className={styles.stat}>
                <div className={styles.statValue} style={{ color: scoreColor(lastDeploy.securityScore) }}>
                  {lastDeploy.securityScore}/100
                </div>
                <div className={styles.statLabel}>Security score</div>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Configuration</div>
            <div className={styles.configCard}>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Memory provider</span>
                <span className={styles.configVal}>{agent.memoryProvider}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>CI provider</span>
                <span className={styles.configVal}>{agent.ciProvider}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Delegation depth</span>
                <span className={styles.configVal}>{agent.maxDepth}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Created</span>
                <span className={styles.configVal}>{timeAgo(agent.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Tools ({agent.tools.length})</div>
            <div className={styles.toolList}>
              {agent.tools.map(t => (
                <span key={t.name} className={styles.toolTag}>{t.name}</span>
              ))}
              {agent.tools.length === 0 && <span className={styles.empty}>No tools configured</span>}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Next step</div>
            <div className={styles.nextCard}>
              <div className={styles.nextIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div>
                <div className={styles.nextTitle}>Ready to deploy</div>
                <div className={styles.nextDesc}>VPS deployment is coming in Phase 2. Your agent config is saved — one-click deploy will be available soon.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deployments ────────────────────────────────────── */}
      {tab === 'deployments' && (
        <div className={styles.tabContent}>
          {agent.deployments.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No deployments yet</div>
              <div className={styles.emptyDesc}>VPS deployment launches in Phase 2. Your agent config is ready.</div>
            </div>
          ) : (
            <div className={styles.deployList}>
              {agent.deployments.map(d => {
                const { label: dl, cls: dc } = statusLabel(d.status);
                return (
                  <div key={d.id} className={styles.deployCard}>
                    <div className={styles.deployTop}>
                      <span className={styles.deployVersion}>v{d.version}</span>
                      <span className={`${styles.statusBadge} ${styles[dc]}`}>{dl}</span>
                      {d.securityScore != null && (
                        <span className={styles.deployScore} style={{ color: scoreColor(d.securityScore) }}>
                          {d.securityScore}/100
                        </span>
                      )}
                    </div>
                    {d.subdomain && <div className={styles.deployUrl}>{d.subdomain}.shipsafecli.com</div>}
                    <div className={styles.deployMeta}>{timeAgo(d.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Settings ───────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Agent info</div>
            <div className={styles.configCard}>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Agent ID</span>
                <span className={`${styles.configVal} ${styles.mono}`}>{agent.id}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Slug</span>
                <span className={`${styles.configVal} ${styles.mono}`}>{agent.slug}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Last updated</span>
                <span className={styles.configVal}>{timeAgo(agent.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.dangerZone}>
              <div className={styles.dangerTitle}>Danger zone</div>
              <div className={styles.dangerRow}>
                <div>
                  <div className={styles.dangerLabel}>Delete this agent</div>
                  <div className={styles.dangerDesc}>Permanently removes the agent and all deployment history.</div>
                </div>
                <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete Agent'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
