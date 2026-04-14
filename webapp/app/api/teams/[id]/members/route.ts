import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

const VALID_ROLES = ['lead', 'pen_tester', 'red_team', 'secrets', 'cve_analyst', 'custom'];

/** GET /api/teams/[id]/members */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId } = await params;
  const team = await prisma.agentTeam.findFirst({ where: { id: teamId, userId: session.user.id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const members = await prisma.agentTeamMember.findMany({
    where:   { teamId },
    orderBy: { order: 'asc' },
    include: {
      agent: {
        select: {
          id: true, name: true, description: true, status: true,
          deployments: {
            where:  { status: 'running' },
            take:   1,
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ members });
}

/** POST /api/teams/[id]/members — add a member */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId } = await params;
  const team = await prisma.agentTeam.findFirst({ where: { id: teamId, userId: session.user.id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { agentId, role, label } = await req.json();
  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  // Verify agent ownership
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  // Only one lead per team
  if (role === 'lead') {
    const existingLead = await prisma.agentTeamMember.findFirst({ where: { teamId, role: 'lead' } });
    if (existingLead) {
      return NextResponse.json({ error: 'Team already has a lead. Remove the existing lead first.' }, { status: 409 });
    }
  }

  // Count existing members to set order
  const count = await prisma.agentTeamMember.count({ where: { teamId } });

  const member = await prisma.agentTeamMember.create({
    data: {
      teamId,
      agentId,
      role,
      label: typeof label === 'string' ? label.trim().slice(0, 60) : null,
      order: count,
    },
    include: {
      agent: {
        select: {
          id: true, name: true, description: true, status: true,
          deployments: {
            where:  { status: 'running' },
            take:   1,
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
