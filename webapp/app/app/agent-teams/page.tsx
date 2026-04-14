'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './teams.module.css';

interface AgentMember {
  id:      string;
  role:    string;
  agent:   { id: string; name: string; status: string };
}

interface Team {
  id:          string;
  name:        string;
  description: string | null;
  members:     AgentMember[];
  _count:      { runs: number };
  createdAt:   string;
}

const ROLE_COLORS: Record<string, string> = {
  lead:        'lead',
  pen_tester:  'pen_tester',
  red_team:    'red_team',
  secrets:     'secrets',
  cve_analyst: 'cve_analyst',
  custom:      'custom',
};

const ROLE_LABELS: Record<string, string> = {
  lead:        'Lead',
  pen_tester:  'Pen Tester',
  red_team:    'Red Team',
  secrets:     'Secrets',
  cve_analyst: 'CVE Analyst',
  custom:      'Custom',
};

export default function AgentTeamsPage() {
  const router = useRouter();
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [name,    setName]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(d => {
      setTeams(d.teams ?? []);
      setLoading(false);
    });
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true); setErr('');
    const res  = await fetch('/api/teams', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, description: desc }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.error || 'Failed to create team'); return; }
    router.push(`/app/agent-teams/${data.team.id}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Agent Teams</h1>
          <p className={styles.subtitle}>Hierarchical cybersecurity teams that collaborate on assessments.</p>
        </div>
        <button className={styles.newBtn} onClick={() => { setModal(true); setName(''); setDesc(''); setErr(''); }}>
          + New Team
        </button>
      </div>

      {loading ? (
        <div className={styles.empty}><p className={styles.emptyTitle}>Loading…</p></div>
      ) : teams.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No teams yet</p>
          <p className={styles.emptyDesc}>
            Create a team to orchestrate multiple agents — Lead, Pen Tester, Red Team, and more.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {teams.map(t => (
            <Link key={t.id} href={`/app/agent-teams/${t.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardName}>{t.name}</div>
                  {t.description && <p className={styles.cardDesc}>{t.description}</p>}
                </div>
                <span className={styles.runsBadge}>{t._count.runs} run{t._count.runs !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.memberChips}>
                {t.members.map(m => (
                  <span key={m.id} className={`${styles.roleChip} ${styles[ROLE_COLORS[m.role] ?? 'custom']}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                ))}
                {t.members.length === 0 && (
                  <span className={styles.roleChip}>No members</span>
                )}
              </div>
              <div className={styles.cardMeta}>
                <span>{t.members.length} agent{t.members.length !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {modal && (
        <div className={styles.overlay} onClick={() => setModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Create Agent Team</span>
              <button className={styles.modalClose} onClick={() => setModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <label className={styles.formLabel}>Team name</label>
                <input
                  className={styles.formInput}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Red Team Alpha"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>
              <div>
                <label className={styles.formLabel}>Description <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                <textarea
                  className={styles.formTextarea}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="What does this team specialise in?"
                />
              </div>
              {err && <p className={styles.formErr}>{err}</p>}
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setModal(false)}>Cancel</button>
                <button className={styles.submitBtn} onClick={handleCreate} disabled={saving || !name.trim()}>
                  {saving ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
