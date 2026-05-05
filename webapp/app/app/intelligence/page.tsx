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
  const topItem = items[0];
  const watchCount = items.filter((item) => item.urgency === 'watch').length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Threat-informed workflow</span>
          <h1>Security Intelligence</h1>
          <p className={styles.subtitle}>Fresh security news, social chatter, and advisories mapped to the checks Ship Safe can run for your stack.</p>
        </div>
        <RunIntelligenceButton />
      </header>

      <section className={styles.statsRow}>
        <div className={`${styles.stat} ${styles.statHot}`}>
          <span className={styles.statValue}>{items.length}</span>
          <span className={styles.statLabel}>Active items</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{highCount}</span>
          <span className={styles.statLabel}>High urgency</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{watchCount}</span>
          <span className={styles.statLabel}>Watch list</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{latestRun ? timeAgo(latestRun.createdAt) : 'Never'}</span>
          <span className={styles.statLabel}>Last check</span>
        </div>
      </section>

      {topItem && (
        <section className={styles.leadSignal}>
          <div className={styles.leadMeta}>
            <span className={`${styles.urgency} ${styles[`urgency_${topItem.urgency}`] ?? ''}`}>{topItem.urgency}</span>
            <span>{topItem.score}/100</span>
            <span>{topItem.sourceType} · {timeAgo(topItem.publishedAt ?? topItem.createdAt)}</span>
          </div>
          <a href={topItem.url} target="_blank" rel="noreferrer">{topItem.title}</a>
          <p>{topItem.excerpt || asStringArray(topItem.reasons)[0] || 'Highest ranked signal from the latest intelligence run.'}</p>
        </section>
      )}

      <section className={styles.grid}>
        <div className={styles.feed}>
          <div className={styles.sectionHeader}>
            <h2>Today’s Signals</h2>
            <span>{items.length ? `${items.length} ranked by urgency and relevance` : 'No active signals'}</span>
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
                {reasons.length > 0 && (
                  <div className={styles.reasonLine}>{reasons[0]}</div>
                )}
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
            <h2>Recommended Next</h2>
            <div className={styles.actionStack}>
              <Link href="/app/scan">Run a targeted scan</Link>
              <Link href="/app/findings">Review open findings</Link>
              <Link href="/app/agents">Check agent configs</Link>
            </div>
          </div>

          <div className={styles.panel}>
            <h2>Your Context</h2>
            <div className={styles.contextList}>
              <span><strong>{repos}</strong> monitored repos</span>
              {latestScan ? (
                <>
                  <span><strong>{latestScan.repo}</strong> latest scan</span>
                  <span><strong>{latestScan.score ?? 'n/a'}</strong> security score</span>
                  <span><strong>{latestScan.secrets}</strong> secrets · <strong>{latestScan.vulns + latestScan.cves}</strong> dependency signals</span>
                </>
              ) : (
                <span>No completed scans yet</span>
              )}
            </div>
          </div>

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
            <p>News RSS, Reddit, Hacker News, vendor blogs, recent scans, monitored repos, and configured agents.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
