import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string; memberId: string }> };

/** DELETE /api/teams/[id]/members/[memberId] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId, memberId } = await params;

  // Verify team ownership
  const team = await prisma.agentTeam.findFirst({ where: { id: teamId, userId: session.user.id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.agentTeamMember.deleteMany({ where: { id: memberId, teamId } });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/teams/[id]/members/[memberId] — update role or label */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId, memberId } = await params;
  const team = await prisma.agentTeam.findFirst({ where: { id: teamId, userId: session.user.id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { role, label } = await req.json();
  const data: Record<string, unknown> = {};
  if (role) data.role  = role;
  if (typeof label === 'string') data.label = label.trim().slice(0, 60);

  const member = await prisma.agentTeamMember.update({ where: { id: memberId }, data });
  return NextResponse.json({ member });
}
