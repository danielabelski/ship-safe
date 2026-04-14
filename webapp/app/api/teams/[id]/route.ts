import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getTeam(id: string, userId: string) {
  return prisma.agentTeam.findFirst({ where: { id, userId } });
}

/** GET /api/teams/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const team = await prisma.agentTeam.findFirst({
    where: { id, userId: session.user.id },
    include: {
      members: {
        orderBy: { order: 'asc' },
        include: {
          agent: {
            select: {
              id: true, name: true, description: true, status: true,
              deployments: {
                where:   { status: 'running' },
                take:    1,
                select:  { id: true, status: true, port: true },
              },
            },
          },
        },
      },
      _count: { select: { runs: true } },
    },
  });

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ team });
}

/** PATCH /api/teams/[id] */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getTeam(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name, description } = await req.json();
  const data: Record<string, unknown> = {};
  if (name && typeof name === 'string') data.name = name.trim().slice(0, 80);
  if (typeof description === 'string')  data.description = description.trim().slice(0, 300);

  const team = await prisma.agentTeam.update({ where: { id }, data });
  return NextResponse.json({ team });
}

/** DELETE /api/teams/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getTeam(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.agentTeam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
