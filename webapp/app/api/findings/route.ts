import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/findings
 * Global findings across all agents for the authenticated user.
 * Query params: severity, status, agentId, limit (default 100)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const severity = searchParams.get('severity');
  const status   = searchParams.get('status');
  const agentId  = searchParams.get('agentId');
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const findings = await prisma.finding.findMany({
    where: {
      agent: { userId: session.user.id },
      ...(severity ? { severity }    : {}),
      ...(status   ? { status }      : {}),
      ...(agentId  ? { agentId }     : {}),
    },
    orderBy: [
      // Sort critical first, then by date
      { createdAt: 'desc' },
    ],
    take: limit,
    include: {
      agent: { select: { id: true, name: true, slug: true } },
      run:   { select: { id: true, startedAt: true } },
    },
  });

  // Summary counts
  const counts = await prisma.finding.groupBy({
    by: ['severity'],
    where: { agent: { userId: session.user.id }, status: 'open' },
    _count: { _all: true },
  });

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const c of counts) {
    const sev = c.severity as keyof typeof summary;
    if (sev in summary) summary[sev] = c._count._all;
  }

  return NextResponse.json({ findings, summary });
}
