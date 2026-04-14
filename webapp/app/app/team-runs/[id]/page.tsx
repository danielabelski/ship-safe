'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './run.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRunNode {
  id:          string;
  role:        string | null;
  status:      string;
  parentRunId: string | null;
  startedAt:   string;
  completedAt: string | null;
  tokensUsed:  number | null;
  deployment:  { agent: { id: string; name: string } };
  _count:      { messages: number; findings: number };
}

interface TeamRunData {
  id:          string;
  target:      string;
  status:      string;
  phase:       string;
  report:      string | null;
  startedAt:   string;
  completedAt: string | null;
  team:        { id: string; name: string };
  agentRuns:   AgentRunNode[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  lead:        'Lead',
  pen_tester:  'Pen Tester',
  red_team:    'Red Team',
  secrets:     'Secrets Scanner',
  cve_analyst: 'CVE Analyst',
  custom:      'Custom',
};

const PHASES = ['planning', 'delegating', 'synthesizing', 'done'] as const;

function duration(start: string, end: string | null): string {
  if (!end) return '';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function phaseIndex(phase: string): number {
  return PHASES.indexOf(phase as typeof PHASES[number]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamRunPage() {
  const { id } = useParams<{ id: string }>();
  const [run,     setRun]     = useState<TeamRunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/team-runs/${id}`);
    if (!res.ok) { setError('Run not found'); setLoading(false); return; }
    const data = await res.json();
    setRun(data.teamRun);
    setLoading(false);
    return data.teamRun as TeamRunData;
  }, [id]);

  useEffect(() => {
    load().then(r => {
      if (!r || r.status !== 'running') return;
      // Poll every 4s while running
      pollRef.current = setInterval(async () => {
        const updated = await load();
        if (updated && updated.status !== 'running') {
          clearInterval(pollRef.current!);
        }
      }, 4000);
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  if (loading) return <div className={styles.page} style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  if (error)   return <div className={styles.page} style={{ color: 'var(--red)' }}>{error}</div>;
  if (!run)    return null;

  // Build tree: lead runs + sub-agent runs by parentRunId
  const leadRuns = run.agentRuns.filter(r => r.role === 'lead');
  const subRuns  = run.agentRuns.filter(r => r.role !== 'lead');

  // Group sub-runs by parentRunId
  const byParent: Record<string, AgentRunNode[]> = {};
  for (const r of subRuns) {
    const key = r.parentRunId ?? '__root__';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(r);
  }

  const curPhaseIdx = phaseIndex(run.phase);
  const totalFindings = run.agentRuns.reduce((n, r) => n + r._count.findings, 0);

  return (
    <div className={styles.page}>
      <Link href={`/app/agent-teams/${run.team.id}`} className={styles.backLink}>
        ← {run.team.name}
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Team Assessment</h1>
          <span className={`${styles.statusBadge} ${
            run.status === 'running'   ? styles.statusRunning   :
            run.status === 'completed' ? styles.statusCompleted :
            styles.statusError
          }`}>
            {run.status === 'running' ? <><span className={styles.spinner} /> {run.phase}</> : run.status}
          </span>
        </div>
        <p className={styles.teamName}>{run.team.name}</p>
        <div className={styles.target}>{run.target}</div>
        <div className={styles.metaBar}>
          <span>Started {timeAgo(run.startedAt)}</span>
          {run.completedAt && <span>Duration: {duration(run.startedAt, run.completedAt)}</span>}
          <span>{run.agentRuns.length} agent run{run.agentRuns.length !== 1 ? 's' : ''}</span>
          {totalFindings > 0 && <span className={styles.findingsBadge}>{totalFindings} finding{totalFindings !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Phase progress bar */}
      <div className={styles.phaseBar}>
        {PHASES.map((p, i) => (
          <div
            key={p}
            className={`${styles.phase} ${
              i < curPhaseIdx ? styles.phaseDone :
              i === curPhaseIdx && run.status === 'running' ? styles.phaseActive : ''
            }`}
          >
            {i < curPhaseIdx ? '✓ ' : ''}{p}
          </div>
        ))}
      </div>

      {/* Agent run tree */}
      <div className={styles.tree}>
        {leadRuns.length === 0 && run.status === 'running' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={styles.spinner} /> Waiting for lead agent to start…
          </div>
        )}

        {leadRuns.map((lead, li) => {
          const children = byParent[lead.id] ?? [];
          const isSynth  = li > 0; // second lead run = synthesis
          return (
            <div key={lead.id} className={styles.leadRow}>
              <RunNode
                node={lead}
                label={isSynth ? 'Lead (Synthesis)' : 'Lead (Planning)'}
                isSynth={isSynth}
              />
              {children.length > 0 && (
                <div className={styles.childrenRow}>
                  {children.map(child => (
                    <RunNode key={child.id} node={child} />
                  ))}
                </div>
              )}
              {/* Show pending sub-agents when lead is done planning but subs haven't started */}
              {!isSynth && lead.status === 'completed' && children.length === 0 && run.status === 'running' && (
                <div className={styles.childrenRow}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className={styles.spinner} /> Sub-agents initialising…
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {run.status === 'running' && (
          <p className={styles.pollNote}>Auto-refreshing every 4s…</p>
        )}
      </div>

      {/* Final report */}
      {run.report && run.status !== 'error' && (
        <div className={styles.reportCard}>
          <div className={styles.reportTitle}>Final Security Report</div>
          <div className={styles.reportText}>{run.report}</div>
        </div>
      )}
      {run.status === 'error' && run.report && (
        <div className={styles.reportCard} style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className={styles.reportTitle} style={{ color: '#ef4444' }}>Error</div>
          <div className={styles.reportText} style={{ color: '#ef4444' }}>{run.report}</div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: individual run node ────────────────────────────────────────

function RunNode({ node, label, isSynth }: { node: AgentRunNode; label?: string; isSynth?: boolean }) {
  const roleCls  = node.role ?? 'custom';
  const roleText = label ?? (ROLE_LABELS[node.role ?? ''] ?? node.role ?? 'Agent');
  const tagCls   = `roleTag_${roleCls}`;

  return (
    <div className={`${styles.runNode} ${styles[roleCls] ?? ''} ${isSynth ? '' : ''}`}>
      <div className={styles.runNodeTop}>
        <span className={`${styles.runRole} ${styles[tagCls] ?? ''}`}>{roleText}</span>
        <span className={styles.runAgentName}>{node.deployment.agent.name}</span>
        <span className={`${styles.runNodeStatus} ${
          node.status === 'running'   ? styles.nodeRunning   :
          node.status === 'completed' ? styles.nodeCompleted :
          styles.nodeError
        }`}>
          {node.status === 'running' && <span className={styles.spinner} style={{ marginRight: 4 }} />}
          {node.status}
        </span>
      </div>
      <div className={styles.runNodeMeta}>
        {node.status === 'running' ? (
          <span>Running…</span>
        ) : (
          <span>{duration(node.startedAt, node.completedAt)}</span>
        )}
        {node._count.findings > 0 && (
          <span className={styles.findingsBadge}>{node._count.findings} finding{node._count.findings !== 1 ? 's' : ''}</span>
        )}
        {node.tokensUsed != null && node.tokensUsed > 0 && (
          <span>{node.tokensUsed.toLocaleString()} tokens</span>
        )}
        <Link
          href={`/app/agents/${node.deployment.agent.id}`}
          style={{ color: 'var(--cyan)', textDecoration: 'none', fontSize: '0.72rem' }}
          onClick={e => e.stopPropagation()}
        >
          Agent →
        </Link>
      </div>
    </div>
  );
}
