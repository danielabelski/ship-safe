import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ findingId: string }> };

const VALID_STATUSES = ['open', 'acknowledged', 'fixed', 'false_positive'];

/** PATCH /api/findings/[findingId] — update status */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { findingId } = await params;

  // Verify ownership via agent
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { agent: { select: { userId: true } } },
  });
  if (!finding || finding.agent.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const updated = await prisma.finding.update({
    where: { id: findingId },
    data: { status, updatedAt: new Date() },
  });

  return NextResponse.json({ finding: updated });
}
