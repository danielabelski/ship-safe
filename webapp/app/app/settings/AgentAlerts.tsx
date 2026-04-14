'use client';
import { useEffect, useState } from 'react';
import s from './settings.module.css';
import { useToast } from '@/app/app/Toast';

interface Settings {
  agentSlackOnCritical: boolean;
  agentSlackOnHigh:     boolean;
  agentEmailOnCritical: boolean;
  slackWebhookUrl:      string | null;
  githubTokenSet:       boolean;
}

export default function AgentAlerts() {
  const [settings,  setSettings]  = useState<Settings | null>(null);
  const [ghToken,   setGhToken]   = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(setSettings);
  }, []);

  async function save(updates: Partial<Settings & { githubToken?: string }>) {
    setSaving(true);
    const res = await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast(data.error || 'Failed to save', 'error'); return; }
    setSettings(data);
    toast('Saved', 'success');
  }

  async function saveGitHubToken() {
    if (!ghToken.trim()) return;
    await save({ githubToken: ghToken.trim() });
    setGhToken('');
    setShowToken(false);
  }

  async function removeGitHubToken() {
    await save({ githubToken: '' });
  }

  if (!settings) return <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Loading…</p>;

  return (
    <div className={s.settingsGroup}>
      {/* Agent alert toggles */}
      <div className={s.settingsCard}>
        <div className={s.settingsCardTitle}>Agent Finding Alerts</div>
        {!settings.slackWebhookUrl && (
          <p style={{ fontSize: '0.78rem', color: 'var(--yellow)', margin: '0 0 0.75rem' }}>
            Add a Slack webhook URL in Notifications → Slack Integration to enable Slack alerts.
          </p>
        )}
        <div className={s.settingsRow}>
          <div>
            <span className={s.settingsLabel}>Slack: critical findings</span>
            <br />
            <span className={s.settingsDesc}>Post to Slack when an agent surfaces a critical issue</span>
          </div>
          <input
            type="checkbox"
            className={s.checkbox}
            checked={settings.agentSlackOnCritical}
            onChange={e => {
              setSettings(prev => prev ? { ...prev, agentSlackOnCritical: e.target.checked } : prev);
              save({ agentSlackOnCritical: e.target.checked });
            }}
          />
        </div>
        <div className={s.settingsRow}>
          <div>
            <span className={s.settingsLabel}>Slack: high findings</span>
            <br />
            <span className={s.settingsDesc}>Post to Slack when an agent surfaces a high-severity issue</span>
          </div>
          <input
            type="checkbox"
            className={s.checkbox}
            checked={settings.agentSlackOnHigh}
            onChange={e => {
              setSettings(prev => prev ? { ...prev, agentSlackOnHigh: e.target.checked } : prev);
              save({ agentSlackOnHigh: e.target.checked });
            }}
          />
        </div>
        <div className={s.settingsRow}>
          <div>
            <span className={s.settingsLabel}>Email: critical findings</span>
            <br />
            <span className={s.settingsDesc}>Send an email when an agent surfaces a critical issue</span>
          </div>
          <input
            type="checkbox"
            className={s.checkbox}
            checked={settings.agentEmailOnCritical}
            onChange={e => {
              setSettings(prev => prev ? { ...prev, agentEmailOnCritical: e.target.checked } : prev);
              save({ agentEmailOnCritical: e.target.checked });
            }}
          />
        </div>
      </div>

      {/* GitHub integration */}
      <div className={s.settingsCard}>
        <div className={s.settingsCardTitle}>GitHub Integration</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '0 0 0.75rem', lineHeight: '1.5' }}>
          Store a GitHub Personal Access Token to create issues directly from findings.
          Requires <code style={{ fontSize: '0.75rem' }}>repo</code> scope.
        </p>

        {settings.githubTokenSet ? (
          <div className={s.settingsRow}>
            <div>
              <span className={s.settingsLabel}>GitHub token</span>
              <br />
              <span className={s.settingsDesc}>Token is stored — click to replace or remove</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={s.settingsSelect}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowToken(v => !v)}
              >
                {showToken ? 'Cancel' : 'Replace'}
              </button>
              <button
                className={s.settingsSelect}
                style={{ cursor: 'pointer', color: 'var(--red)' }}
                onClick={removeGitHubToken}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className={s.settingsRow}>
            <span className={s.settingsLabel}>No token stored</span>
            <button className={s.settingsSelect} style={{ cursor: 'pointer' }} onClick={() => setShowToken(v => !v)}>
              {showToken ? 'Cancel' : 'Add token'}
            </button>
          </div>
        )}

        {showToken && (
          <div className={s.settingsInputRow} style={{ marginTop: '0.75rem' }}>
            <input
              type="password"
              className={s.settingsInput}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={ghToken}
              onChange={e => setGhToken(e.target.value)}
              autoComplete="off"
            />
            <button
              className={s.settingsSelect}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={saveGitHubToken}
              disabled={saving || !ghToken.trim()}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
