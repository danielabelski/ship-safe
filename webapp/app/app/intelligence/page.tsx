import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import RunIntelligenceButton from './RunIntelligenceButton';
import styles from './intelligence.module.css';

export const metadata: Metadata = { title: 'Security Intelligence — Ship Safe' };

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function timeAgo(date: Date | string | null) {
  if (!date) return 'unknown date';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function IntelligencePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [items, runs, repos, latestScan] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where: { userId: session.user.id, status: { not: 'dismissed' } },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 24,
    }),
    prisma.intelligenceRun.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.monitoredRepo.count({ where: { userId: session.user.id, enabled: true } }),
    prisma.scan.findFirst({
      where: { userId: session.user.id, status: 'done' },
      orderBy: { createdAt: 'desc' },
      select: { repo: true, score: true, secrets: true, vulns: true, cves: true, createdAt: true },
    }),
  ]);

  const highCount = items.filter((item) => item.urgency === 'critical' || item.urgency === 'high').length;
  const latestRun = runs[0];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Security Intelligence</h1>
          <p className={styles.subtitle}>Fresh security news mapped to what Ship Safe can help you check now.</p>
        </div>
        <RunIntelligenceButton />
      </header>

      <section className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{items.length}</span>
          <span className={styles.statLabel}>Active items</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{highCount}</span>
          <span className={styles.statLabel}>High urgency</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{repos}</span>
          <span className={styles.statLabel}>Known repos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{latestRun ? timeAgo(latestRun.createdAt) : 'Never'}</span>
          <span className={styles.statLabel}>Last check</span>
        </div>
      </section>

      {latestScan && (
        <section className={styles.contextBand}>
          <span>Context:</span>
          <strong>{latestScan.repo}</strong>
          <span>score {latestScan.score ?? 'n/a'}</span>
          <span>{latestScan.secrets} secrets</span>
          <span>{latestScan.vulns + latestScan.cves} dependency signals</span>
        </section>
      )}

      <section className={styles.grid}>
        <div className={styles.feed}>
          <div className={styles.sectionHeader}>
            <h2>Today’s Signals</h2>
            <Link href="/app/scan" className={styles.secondaryLink}>Run scan</Link>
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>
              <strong>No intelligence items yet</strong>
              <span>Run today’s check to pull fresh security news, social signals, and advisories.</span>
            </div>
          ) : items.map((item) => {
            const riskTypes = asStringArray(item.riskTypes);
            const affectedAreas = asStringArray(item.affectedAreas);
            const actions = asStringArray(item.recommendedActions);
            const reasons = asStringArray(item.reasons);

            return (
              <article key={item.id} className={styles.item}>
                <div className={styles.itemTop}>
                  <span className={`${styles.urgency} ${styles[`urgency_${item.urgency}`] ?? ''}`}>{item.urgency}</span>
                  <span className={styles.score}>{item.score}/100</span>
                  <span className={styles.source}>{item.sourceType} · {timeAgo(item.publishedAt ?? item.createdAt)}</span>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className={styles.title}>{item.title}</a>
                <p>{item.excerpt || reasons[0] || 'Fresh security signal discovered from monitored sources.'}</p>
                <div className={styles.pillRow}>
                  {riskTypes.slice(0, 4).map((risk) => <span key={risk}>{risk}</span>)}
                  {affectedAreas.slice(0, 4).map((area) => <span key={area}>{area}</span>)}
                </div>
                <div className={styles.actions}>
                  {actions.map((action) => <span key={action}>{action}</span>)}
                </div>
              </article>
            );
          })}
        </div>

        <aside className={styles.side}>
          <div className={styles.panel}>
            <h2>Run History</h2>
            {runs.length === 0 ? (
              <p>No intelligence checks yet.</p>
            ) : runs.map((run) => (
              <div key={run.id} className={styles.runRow}>
                <span className={`${styles.runStatus} ${styles[`run_${run.status}`] ?? ''}`}>{run.status}</span>
                <span>{run.selectedCount} items</span>
                <span>{timeAgo(run.createdAt)}</span>
              </div>
            ))}
          </div>

          <div className={styles.panel}>
            <h2>What This Uses</h2>
            <p>News RSS, Reddit, Hacker News, vendor blogs, your recent scans, monitored repos, and configured agents.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
