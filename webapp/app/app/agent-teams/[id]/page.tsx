'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './team.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentDeployment { id: string; status: string }
interface AgentInfo       { id: string; name: string; description: string | null; status: string; deployments: AgentDeployment[] }
interface Member          { id: string; role: string; label: string | null; order: number; agent: AgentInfo }
interface Team            { id: string; name: string; description: string | null; members: Member[]; _count: { runs: number } }
interface RunSummary      { id: string; target: string; status: string; phase: string; startedAt: string; completedAt: string | null; _count: { agentRuns: number } }
interface AgentOpt        { id: string; name: string; status: string; deployments: AgentDeployment[] }

type Tab = 'members' | 'runs' | 'settings';

const ROLE_LABELS: Record<string, string> = {
  lead:        'Lead',
  pen_tester:  'Pen Tester',
  red_team:    'Red Team',
  secrets:     'Secrets Scanner',
  cve_analyst: 'CVE Analyst',
  custom:      'Custom',
};
const ROLES = Object.keys(ROLE_LABELS);

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function duration(start: string, end: string | null) {
  if (!end) return '';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [team,    setTeam]    = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('members');
  const [error,   setError]   = useState('');

  // Runs
  const [runs,       setRuns]       = useState<RunSummary[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);

  // Run target modal
  const [runModal,   setRunModal]   = useState(false);
  const [target,     setTarget]     = useState('');
  const [starting,   setStarting]   = useState(false);
  const [runErr,     setRunErr]     = useState('');

  // Add member
  const [showAdd,    setShowAdd]    = useState(false);
  const [agents,     setAgents]     = useState<AgentOpt[]>([]);
  const [selAgent,   setSelAgent]   = useState('');
  const [selRole,    setSelRole]    = useState('pen_tester');
  const [addErr,     setAddErr]     = useState('');
  const [adding,     setAdding]     = useState(false);

  // Settings edit
  const [editName,   setEditName]   = useState('');
  const [editDesc,   setEditDesc]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const load = useCallback(async () => {
    const res  = await fetch(`/api/teams/${id}`);
    if (!res.ok) { setError('Team not found'); setLoading(false); return; }
    const data = await res.json();
    setTeam(data.team);
    setEditName(data.team.name);
    setEditDesc(data.team.description ?? '');
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'runs' && !runsLoaded) {
      fetch(`/api/teams/${id}/runs`).then(r => r.json()).then(d => {
        setRuns(d.runs ?? []);
        setRunsLoaded(true);
      });
    }
  }, [tab, id, runsLoaded]);

  useEffect(() => {
    if (showAdd && agents.length === 0) {
      fetch('/api/agents').then(r => r.json()).then(d => setAgents(d.agents ?? []));
    }
  }, [showAdd, agents.length]);

  async function handleAddMember() {
    if (!selAgent) return;
    setAdding(true); setAddErr('');
    const res  = await fetch(`/api/teams/${id}/members`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ agentId: selAgent, role: selRole }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setAddErr(data.error || 'Failed to add member'); return; }
    setTeam(prev => prev ? { ...prev, members: [...prev.members, data.member] } : prev);
    setSelAgent(''); setShowAdd(false); setAddErr('');
  }

  async function handleRemoveMember(memberId: string) {
    await fetch(`/api/teams/${id}/members/${memberId}`, { method: 'DELETE' });
    setTeam(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== memberId) } : prev);
  }

  async function handleStartRun() {
    if (!target.trim()) return;
    setStarting(true); setRunErr('');
    const res  = await fetch(`/api/teams/${id}/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target }),
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) { setRunErr(data.error || 'Failed to start run'); return; }
    router.push(`/app/team-runs/${data.teamRunId}`);
  }

  async function handleSave() {
    setSaving(true); setSaveOk(false);
    const res  = await fetch(`/api/teams/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editName, description: editDesc }),
    });
    setSaving(false);
    if (res.ok) { setSaveOk(true); setTeam(prev => prev ? { ...prev, name: editName, description: editDesc } : prev); }
  }

  async function handleDelete() {
    if (!confirm('Delete this team? This cannot be undone.')) return;
    setDeleting(true);
    await fetch(`/api/teams/${id}`, { method: 'DELETE' });
    router.push('/app/agent-teams');
  }

  const hasLead    = team?.members.some(m => m.role === 'lead') ?? false;
  const hasRunning = team?.members.some(m => m.agent.deployments.length > 0) ?? false;
  const canRun     = hasLead && hasRunning;

  if (loading) return <div className={styles.page} style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  if (error)   return <div className={styles.page} style={{ color: 'var(--red)' }}>{error}</div>;
  if (!team)   return null;

  return (
    <div className={styles.page}>
      <Link href="/app/agent-teams" className={styles.backLink}>← Agent Teams</Link>

      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1 className={styles.name}>{team.name}</h1>
          {team.description && <p className={styles.desc}>{team.description}</p>}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.runBtn}
            onClick={() => { setRunModal(true); setTarget(''); setRunErr(''); }}
            disabled={!canRun}
            title={!hasLead ? 'Assign a Lead agent first' : !hasRunning ? 'Deploy at least one agent first' : ''}
          >
            ▶ Run Team
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['members', 'runs', 'settings'] as Tab[]).map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'members' && ` (${team.members.length})`}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Team roster</div>

            {!hasLead && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '0.65rem 0.9rem', marginBottom: '0.85rem', fontSize: '0.81rem', color: '#f59e0b' }}>
                Add a <strong>Lead</strong> agent to coordinate the team and synthesize results.
              </div>
            )}

            <div className={styles.memberList}>
              {team.members.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', padding: '1rem 0' }}>
                  No team members yet. Add agents below.
                </div>
              ) : (
                // Lead first, then others by order
                [...team.members]
                  .sort((a, b) => {
                    if (a.role === 'lead') return -1;
                    if (b.role === 'lead') return 1;
                    return a.order - b.order;
                  })
                  .map(m => (
                    <div key={m.id} className={`${styles.memberCard} ${styles[m.role] ?? ''}`}>
                      <span className={`${styles.memberRole} ${styles[`roleTag_${m.role}`] ?? ''}`}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberName}>{m.label ?? m.agent.name}</div>
                        {m.agent.description && <div className={styles.memberDesc}>{m.agent.description}</div>}
                      </div>
                      <div className={styles.memberStatus}>
                        <span className={styles.statusDot}>
                          {m.agent.deployments.length > 0
                            ? <><span className={styles.dotGreen} />Live</>
                            : <><span className={styles.dotGray}  />Offline</>
                          }
                        </span>
                      </div>
                      <Link href={`/app/agents/${m.agent.id}`} style={{ fontSize: '0.72rem', color: 'var(--cyan)', textDecoration: 'none', flexShrink: 0 }}>
                        View
                      </Link>
                      <button className={styles.removeBtn} onClick={() => handleRemoveMember(m.id)}>Remove</button>
                    </div>
                  ))
              )}
            </div>

            {/* Add member */}
            {showAdd ? (
              <div className={styles.addMemberForm}>
                <div className={styles.addMemberRow}>
                  <select
                    className={styles.formSelect}
                    value={selAgent}
                    onChange={e => setSelAgent(e.target.value)}
                  >
                    <option value="">Select agent…</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.deployments.length > 0 ? ' ●' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.formSelect}
                    value={selRole}
                    onChange={e => setSelRole(e.target.value)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button className={styles.addMemberBtn} onClick={handleAddMember} disabled={adding || !selAgent}>
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                  <button className={styles.editBtn} onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
                {addErr && <p className={styles.formErr}>{addErr}</p>}
              </div>
            ) : (
              <button className={styles.showAddBtn} onClick={() => setShowAdd(true)}>+ Add agent to team</button>
            )}
          </div>
        </div>
      )}

      {/* Runs tab */}
      {tab === 'runs' && (
        <div>
          {!runsLoaded ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>Loading runs…</div>
          ) : runs.length === 0 ? (
            <div className={styles.emptyRuns}>
              No runs yet. Click <strong>Run Team</strong> to start an assessment.
            </div>
          ) : (
            <div className={styles.runList}>
              {runs.map(r => (
                <Link key={r.id} href={`/app/team-runs/${r.id}`} className={styles.runCard}>
                  <span className={`${styles.runStatus} ${
                    r.status === 'running'   ? styles.statusRunning   :
                    r.status === 'completed' ? styles.statusCompleted :
                    styles.statusError
                  }`}>
                    {r.status}
                  </span>
                  <span className={styles.runTarget}>{r.target}</span>
                  {r.status === 'running' && (
                    <span className={styles.runPhase}>{r.phase}</span>
                  )}
                  <span className={styles.runMeta}>
                    {r._count.agentRuns} agent run{r._count.agentRuns !== 1 ? 's' : ''}
                    {' · '}
                    {r.completedAt
                      ? `${duration(r.startedAt, r.completedAt)} · ${timeAgo(r.startedAt)}`
                      : timeAgo(r.startedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Team details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className={styles.editField}>
                <label className={styles.editLabel}>Name</label>
                <input className={styles.editInput} value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>Description</label>
                <textarea className={styles.editTextarea} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
              <div className={styles.settingsActions}>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !editName.trim()}>
                  {saving ? 'Saving…' : saveOk ? 'Saved!' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.dangerZone}>
              <div className={styles.dangerTitle}>Danger zone</div>
              <div className={styles.dangerRow}>
                <div>
                  <div className={styles.dangerLabel}>Delete this team</div>
                  <div className={styles.dangerDesc}>Removes the team and all run history. Agent agents are not deleted.</div>
                </div>
                <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run target modal */}
      {runModal && (
        <div className={styles.overlay} onClick={() => setRunModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Run Team — {team.name}</span>
              <button className={styles.modalClose} onClick={() => setRunModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <label className={styles.formLabel}>Assessment target</label>
                <textarea
                  className={styles.formTextarea}
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="Describe what the team should assess. e.g.&#10;&#10;Repo: github.com/acme/api-server&#10;Focus: authentication, secrets, dependency CVEs&#10;Branch: main"
                  autoFocus
                />
                <p className={styles.formHint}>
                  The Lead agent will receive this target, plan the assessment, and delegate tasks to each team member.
                </p>
              </div>
              {runErr && <p style={{ color: 'var(--red)', fontSize: '0.78rem', margin: 0 }}>{runErr}</p>}
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setRunModal(false)}>Cancel</button>
                <button className={styles.startBtn} onClick={handleStartRun} disabled={starting || !target.trim()}>
                  {starting ? 'Starting…' : '▶ Start Assessment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
