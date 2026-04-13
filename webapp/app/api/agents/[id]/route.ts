import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getAgentForUser(id: string, userId: string) {
  return prisma.agent.findFirst({ where: { id, userId } });
}

/** GET /api/agents/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const agent = await prisma.agent.findFirst({
    where: { id, userId: session.user.id },
    include: {
      deployments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, version: true, status: true, securityScore: true,
          subdomain: true, deployLog: true, startedAt: true, stoppedAt: true, createdAt: true,
        },
      },
    },
  });

  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ agent });
}

/** PATCH /api/agents/[id] */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getAgentForUser(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, description, tools, memoryProvider, maxDepth, skills, envVars, ciProvider } = body;

  const data: Record<string, unknown> = {};
  if (name && typeof name === 'string') data.name = name.trim().slice(0, 80);
  if (typeof description === 'string') data.description = description.trim().slice(0, 300);
  if (Array.isArray(tools)) data.tools = tools;
  if (['builtin', 'honcho', 'hindsight', 'mem0', 'none'].includes(memoryProvider)) data.memoryProvider = memoryProvider;
  if (typeof maxDepth === 'number') data.maxDepth = Math.min(Math.max(maxDepth, 1), 2);
  if (Array.isArray(skills)) data.skills = skills;
  if (typeof envVars === 'object' && !Array.isArray(envVars)) data.envVars = envVars;
  if (['github', 'gitlab', 'none'].includes(ciProvider)) data.ciProvider = ciProvider;

  const agent = await prisma.agent.update({ where: { id }, data });
  return NextResponse.json({ agent });
}

/** DELETE /api/agents/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getAgentForUser(id, session.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
