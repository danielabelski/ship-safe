import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fireTeamRun } from '@/lib/run-team';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/teams/[id]/run
 * Body: { target: string }
 *
 * Starts a team run. Returns { teamRunId } immediately;
 * the orchestration runs async in the background.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: teamId } = await params;

  const team = await prisma.agentTeam.findFirst({
    where:   { id: teamId, userId: session.user.id },
    include: { members: { where: { role: 'lead' }, take: 1 } },
  });
  if (!team)                  return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  if (!team.members.length)   return NextResponse.json({ error: 'Team has no lead agent' }, { status: 400 });

  const { target } = await req.json();
  if (!target?.trim()) return NextResponse.json({ error: 'target is required' }, { status: 400 });

  // Create team run record
  const teamRun = await prisma.teamRun.create({
    data: {
      teamId,
      userId:  session.user.id,
      target:  target.trim().slice(0, 500),
      status:  'running',
      phase:   'planning',
    },
  });

  // Fire async — do NOT await
  fireTeamRun(teamRun.id).catch(async err => {
    await prisma.teamRun.update({
      where: { id: teamRun.id },
      data:  { status: 'error', phase: 'done', completedAt: new Date(), report: String(err) },
    });
  });

  return NextResponse.json({ teamRunId: teamRun.id });
}
