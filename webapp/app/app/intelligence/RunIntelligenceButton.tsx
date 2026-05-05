'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './intelligence.module.css';

export default function RunIntelligenceButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setRunning(true);
    setMessage('');

    try {
      const res = await fetch('/api/intelligence/run', { method: 'POST' });
      const data = await res.json() as { error?: string; run?: { selectedCount?: number; candidateCount?: number; status?: string; error?: string } };
      if (!res.ok) throw new Error(data.error ?? data.run?.error ?? 'Intelligence run failed');
      setMessage(`Found ${data.run?.selectedCount ?? 0} relevant items from ${data.run?.candidateCount ?? 0} candidates.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Intelligence run failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={styles.runControl}>
      <button className={styles.primaryButton} onClick={run} disabled={running}>
        {running ? 'Checking...' : 'Check today'}
      </button>
      {message && <span className={styles.runMessage}>{message}</span>}
    </div>
  );
}
