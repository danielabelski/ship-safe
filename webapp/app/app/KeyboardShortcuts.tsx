'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './keyboard.module.css';

const SHORTCUTS = [
  { keys: ['n'],      label: 'New scan' },
  { keys: ['h'],      label: 'History' },
  { keys: ['g', 'd'], label: 'Dashboard' },
  { keys: ['g', 's'], label: 'Settings' },
  { keys: ['g', 'r'], label: 'Repos' },
  { keys: ['?'],      label: 'Show shortcuts' },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let gTimer: ReturnType<typeof setTimeout>;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG) {
        clearTimeout(gTimer);
        setPendingG(false);
        if (e.key === 'd') router.push('/app');
        if (e.key === 's') router.push('/app/settings');
        if (e.key === 'r') router.push('/app/repos');
        if (e.key === 'h') router.push('/app/history');
        return;
      }

      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === '?') { setOpen(prev => !prev); return; }
      if (e.key === 'n') { router.push('/app/scan'); return; }
      if (e.key === 'h') { router.push('/app/history'); return; }
      if (e.key === 'g') {
        setPendingG(true);
        gTimer = setTimeout(() => setPendingG(false), 1500);
        return;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer); };
  }, [router, pendingG]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Keyboard shortcuts</span>
          <button className={styles.closeBtn} onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className={styles.list}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.desc}>{s.label}</span>
              <div className={styles.keys}>
                {s.keys.map((k, j) => <kbd key={j} className={styles.key}>{k}</kbd>)}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.hint}>Press <kbd className={styles.key}>?</kbd> to toggle this panel</div>
      </div>
    </div>
  );
}
