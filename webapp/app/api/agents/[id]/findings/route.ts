import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

/** GET /api/agents/[id]/findings */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const agent = await prisma.agent.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const findings = await prisma.finding.findMany({
    where: { agentId: id },
    orderBy: [{ createdAt: 'desc' }],
    include: { run: { select: { id: true, startedAt: true } } },
  });

  return NextResponse.json({ findings });
}
