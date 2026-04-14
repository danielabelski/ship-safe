import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/findings/stats
 * Returns:
 *   - daily: findings created per day (last 30 days) by severity
 *   - mttr: mean time to remediation in hours (for 'fixed' findings)
 *   - openByAge: open findings bucketed by age (< 1d, 1-7d, 7-30d, > 30d)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recentFindings, fixedFindings, openFindings] = await Promise.all([
    // All findings created in last 30 days
    prisma.finding.findMany({
      where:   { agent: { userId: session.user.id }, createdAt: { gte: since } },
      select:  { createdAt: true, severity: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Fixed findings — for MTTR
    prisma.finding.findMany({
      where:  { agent: { userId: session.user.id }, status: 'fixed' },
      select: { createdAt: true, updatedAt: true },
      take:   500,
    }),
    // Open findings — for age buckets
    prisma.finding.findMany({
      where:  { agent: { userId: session.user.id }, status: 'open' },
      select: { createdAt: true },
    }),
  ]);

  // ── Daily trend ──────────────────────────────────────────
  const dayMap: Record<string, Record<string, number>> = {};
  for (const f of recentFindings) {
    const day = f.createdAt.toISOString().slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    dayMap[day][f.severity] = (dayMap[day][f.severity] ?? 0) + 1;
  }
  // Fill all 30 days even if no findings
  const daily: { date: string; critical: number; high: number; medium: number; low: number; info: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const m = dayMap[d];
    daily.push({
      date:     d,
      critical: m?.critical ?? 0,
      high:     m?.high     ?? 0,
      medium:   m?.medium   ?? 0,
      low:      m?.low      ?? 0,
      info:     m?.info     ?? 0,
    });
  }

  // ── MTTR (hours) ─────────────────────────────────────────
  let mttrHours: number | null = null;
  if (fixedFindings.length > 0) {
    const totalMs = fixedFindings.reduce((sum, f) =>
      sum + (f.updatedAt.getTime() - f.createdAt.getTime()), 0);
    mttrHours = Math.round(totalMs / fixedFindings.length / (1000 * 60 * 60));
  }

  // ── Open findings by age ─────────────────────────────────
  const now = Date.now();
  const openByAge = { lt1d: 0, d1to7: 0, d7to30: 0, gt30d: 0 };
  for (const f of openFindings) {
    const ageDays = (now - f.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if      (ageDays <  1)  openByAge.lt1d++;
    else if (ageDays <  7)  openByAge.d1to7++;
    else if (ageDays < 30)  openByAge.d7to30++;
    else                    openByAge.gt30d++;
  }

  return NextResponse.json({ daily, mttrHours, openByAge, fixedCount: fixedFindings.length });
}
