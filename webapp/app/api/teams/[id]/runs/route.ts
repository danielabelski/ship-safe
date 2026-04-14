import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

/** GET /api/teams/[id]/runs — list team runs */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId } = await params;
  const team = await prisma.agentTeam.findFirst({ where: { id: teamId, userId: session.user.id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const runs = await prisma.teamRun.findMany({
    where:   { teamId },
    orderBy: { startedAt: 'desc' },
    take:    50,
    select: {
      id: true, target: true, status: true, phase: true,
      startedAt: true, completedAt: true,
      _count: { select: { agentRuns: true } },
    },
  });

  return NextResponse.json({ runs });
}
