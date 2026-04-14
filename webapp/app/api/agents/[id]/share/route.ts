import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/agents/[id]/share
 * Body: { orgId: string }
 * Shares the agent with the given org. Caller must own the agent AND be an org member.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { orgId } = await req.json();
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  // Verify ownership
  const agent = await prisma.agent.findFirst({ where: { id, userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  // Verify user is a member of the target org
  const membership = await prisma.orgMember.findFirst({
    where: { orgId, userId: session.user.id },
  });
  if (!membership) return NextResponse.json({ error: 'You are not a member of that org' }, { status: 403 });

  await prisma.agent.update({ where: { id }, data: { orgId } });

  // Return the org info by looking it up separately (Agent has no direct org relation)
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ agent: { id, orgId, org } });
}

/**
 * DELETE /api/agents/[id]/share
 * Removes org sharing — agent becomes private again.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const agent = await prisma.agent.findFirst({ where: { id, userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  await prisma.agent.update({ where: { id }, data: { orgId: null } });
  return NextResponse.json({ ok: true });
}
