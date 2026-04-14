/**
 * fire-agent-run.ts
 *
 * Shared helper: POST a message to an agent container, collect the full SSE
 * stream, and persist the assistant reply + run completion to the DB.
 *
 * Used by the chat route (alongside a browser stream), the trigger route
 * (fire-and-forget), and the team run orchestrator.
 */

import { prisma } from '@/lib/prisma';
import { notifyAgentFindings } from '@/lib/notifications';
import { saveFindings } from '@/lib/save-findings';

const ORCHESTRATOR_URL    = process.env.ORCHESTRATOR_URL    || 'http://localhost:4099';
const ORCHESTRATOR_SECRET = process.env.ORCHESTRATOR_SECRET;

export interface ToolCallEntry {
  tool:    string;
  args:    unknown;
  result?: string;
}

export interface FindingEntry {
  severity:     string;
  title:        string;
  location?:    string;
  cve?:         string;
  remediation?: string;
}

export interface DelegationEntry {
  role:  string;  // pen_tester | red_team | secrets | cve_analyst | custom
  task:  string;
}

export interface CollectedRun {
  fullText:    string;
  tokens:      number;
  toolCalls:   ToolCallEntry[];
  findings:    FindingEntry[];
  delegations: DelegationEntry[];
}

/**
 * Sends a message to an agent container and collects the complete SSE stream.
 * Does NOT write to DB — the caller is responsible for persistence.
 * Returns early with an error-shaped result on network failure.
 */
// Maximum time to wait for a single agent run (5 minutes).
// Prevents hung connections from blocking team runs indefinitely.
const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '300000', 10);

export async function collectAgentRun(opts: {
  deploymentPort: number;
  message:        string;
  runId:          string;
}): Promise<{ ok: true; data: CollectedRun } | { ok: false; error: string }> {
  const { deploymentPort, message, runId } = opts;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  let agentRes: Response;
  try {
    agentRes = await fetch(`${ORCHESTRATOR_URL}/chat/${deploymentPort}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ORCHESTRATOR_SECRET ? { Authorization: `Bearer ${ORCHESTRATOR_SECRET}` } : {}),
      },
      body:   JSON.stringify({ message, sessionId: runId }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error
      ? (e.name === 'AbortError' ? `Agent timed out after ${AGENT_TIMEOUT_MS / 1000}s` : e.message)
      : 'Agent unreachable';
    return { ok: false, error: msg };
  }

  if (!agentRes.ok || !agentRes.body) {
    clearTimeout(timeoutId);
    return { ok: false, error: `Agent HTTP ${agentRes.status}` };
  }

  const reader    = agentRes.body.getReader();
  const decoder   = new TextDecoder();
  let   fullText  = '';
  let   tokens    = 0;
  const toolCalls:   ToolCallEntry[]   = [];
  const findings:    FindingEntry[]    = [];
  const delegations: DelegationEntry[] = [];
  let   pending      = '';
  let   currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });

    const lines = pending.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: '))  { currentEvent = line.slice(7).trim(); continue; }
      if (!line.startsWith('data: '))   continue;

      const raw = line.slice(6);
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }

      if (currentEvent === 'token') {
        fullText += typeof parsed === 'string' ? parsed : '';
      } else if (currentEvent === 'tool_call' && parsed && typeof parsed === 'object') {
        const tc = parsed as { tool: string; args: unknown };
        toolCalls.push({ tool: tc.tool, args: tc.args });
      } else if (currentEvent === 'tool_result' && parsed && typeof parsed === 'object') {
        const tr = parsed as { tool: string; result: string };
        const last = toolCalls[toolCalls.length - 1];
        if (last && last.tool === tr.tool) last.result = tr.result;
      } else if (currentEvent === 'finding' && parsed && typeof parsed === 'object') {
        findings.push(parsed as FindingEntry);
      } else if (currentEvent === 'delegation' && parsed && typeof parsed === 'object') {
        const d = parsed as { role?: string; task?: string };
        if (d.role && d.task) delegations.push({ role: d.role, task: d.task });
      } else if (currentEvent === 'done' && parsed && typeof parsed === 'object') {
        tokens = (parsed as { tokensUsed?: number }).tokensUsed ?? 0;
      }
    }
  }

  clearTimeout(timeoutId);
  return { ok: true, data: { fullText, tokens, toolCalls, findings, delegations } };
}

/**
 * Fire the agent container for a given run, collect the response, and save it.
 * Returns once the run is complete (or failed).
 */
export async function fireAgentRun(opts: {
  runId:          string;
  deploymentPort: number;
  message:        string;
}): Promise<void> {
  const { runId, deploymentPort, message } = opts;

  const result = await collectAgentRun({ runId, deploymentPort, message });

  if (!result.ok) {
    await prisma.agentRun.update({ where: { id: runId }, data: { status: 'error', completedAt: new Date() } });
    await prisma.chatMessage.create({ data: { runId, role: 'assistant', content: `Error: ${result.error}` } });
    return;
  }

  const { fullText, tokens, toolCalls, findings, delegations: _delegations } = result.data;

  // Save findings + notify
  if (findings.length > 0) {
    const runInfo = await prisma.agentRun.findUnique({
      where: { id: runId },
      select: { deployment: { select: { agent: { select: { id: true, name: true, userId: true } } } } },
    });
    const agent = runInfo?.deployment.agent;

    if (agent) {
      await saveFindings({ agentId: agent.id, runId, findings });
      notifyAgentFindings({
        userId:    agent.userId,
        agentId:   agent.id,
        agentName: agent.name,
        findings,
      }).catch(() => {});
    }
  }

  await prisma.chatMessage.create({
    data: {
      runId,
      role:       'assistant',
      content:    fullText,
      toolCalls:  toolCalls.length > 0 ? (toolCalls as object[]) : undefined,
      tokensUsed: tokens,
    },
  });

  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status:      'completed',
      completedAt: new Date(),
      tokensUsed:  { increment: tokens },
    },
  });
}
