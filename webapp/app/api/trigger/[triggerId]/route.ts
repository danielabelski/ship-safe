import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fireAgentRun } from '@/lib/fire-agent-run';

const triggerHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(triggerId: string): boolean {
  const now = Date.now();
  const entry = triggerHits.get(triggerId);
  if (!entry || now >= entry.resetAt) {
    triggerHits.set(triggerId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

type Params = { params: Promise<{ triggerId: string }> };

/**
 * POST /api/trigger/[triggerId]
 *
 * Public webhook endpoint. Callers authenticate with:
 *   Authorization: Bearer <trigger.secret>
 *
 * The request body (JSON or text) is injected into the agent prompt via
 * the trigger's promptTpl, replacing {payload}.
 *
 * Returns 202 immediately; agent runs in the background.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { triggerId } = await params;

  // Auth: Bearer token
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const trigger = await prisma.trigger.findUnique({
    where:   { id: triggerId },
    include: {
      agent: {
        include: {
          deployments: {
            where:   { status: 'running' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!trigger || !trigger.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (trigger.secret !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!checkRateLimit(triggerId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const deployment = trigger.agent.deployments[0];
  if (!deployment?.port) {
    return NextResponse.json({ error: 'Agent is not deployed' }, { status: 400 });
  }

  // Parse body — accept JSON or raw text
  let payload: string;
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const json = await req.json();
      payload = JSON.stringify(json, null, 2);
    } catch {
      payload = await req.text();
    }
  } else {
    payload = await req.text();
  }

  // Build the message from the prompt template
  const message = trigger.promptTpl.replace('{payload}', payload || '(no payload)');

  // Create run + user message
  const run = await prisma.agentRun.create({
    data: {
      deploymentId: deployment.id,
      triggerId:    trigger.id,
      status:       'running',
    },
  });

  await prisma.chatMessage.create({
    data: { runId: run.id, role: 'user', content: message },
  });

  // Update trigger's lastFiredAt
  await prisma.trigger.update({
    where: { id: trigger.id },
    data:  { lastFiredAt: new Date() },
  });

  // Fire agent in background — don't await
  fireAgentRun({
    runId:          run.id,
    deploymentPort: deployment.port,
    message,
  }).catch(() => { /* background — already persisted as error */ });

  return NextResponse.json({ runId: run.id, status: 'accepted' }, { status: 202 });
}
