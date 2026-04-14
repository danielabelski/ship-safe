import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

/** GET /api/agents/[id]/runs — list runs with summary stats */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const runs = await prisma.agentRun.findMany({
    where: { deployment: { agentId: id } },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      _count: { select: { messages: true, findings: true } },
      messages: {
        where: { role: 'user' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { content: true },
      },
      deployment: { select: { version: true } },
    },
  });

  const shaped = runs.map(r => ({
    id:           r.id,
    status:       r.status,
    startedAt:    r.startedAt,
    completedAt:  r.completedAt,
    tokensUsed:   r.tokensUsed,
    triggerId:    r.triggerId,
    messageCount: r._count.messages,
    findingCount: r._count.findings,
    firstMessage: r.messages[0]?.content ?? null,
    deployVersion: r.deployment.version,
  }));

  return NextResponse.json({ runs: shaped });
}
