/**
 * run-team.ts
 *
 * Team run orchestration engine.
 *
 * Flow:
 *  Phase 1 (planning)    — Lead agent receives the target + team roster.
 *                          It may output DELEGATE: markers for sub-tasks.
 *  Phase 2 (delegating)  — Sub-agents run in parallel, each with their
 *                          specific task. Their findings + full responses
 *                          are collected.
 *  Phase 3 (synthesizing)— Lead agent receives all sub-agent results and
 *                          produces a final consolidated security report.
 *  Phase 4 (done)        — TeamRun is marked completed with the report.
 */

import { prisma } from '@/lib/prisma';
import { collectAgentRun, FindingEntry, DelegationEntry } from '@/lib/fire-agent-run';
import { saveFindings } from '@/lib/save-findings';

// ── Role metadata ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  lead:        'Lead Security Analyst',
  pen_tester:  'Penetration Tester',
  red_team:    'Red Team Operator',
  secrets:     'Secrets & Credentials Scanner',
  cve_analyst: 'CVE & Dependency Analyst',
  custom:      'Security Specialist',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildLeadPlanPrompt(
  target:      string,
  teamRoster:  Array<{ role: string; agentName: string; description: string | null }>,
): string {
  const rosterLines = teamRoster
    .filter(m => m.role !== 'lead')
    .map(m => `- **${roleLabel(m.role)}** (${m.agentName}): ${m.description ?? 'No description'}`)
    .join('\n');

  return `You are the **Lead Security Analyst** coordinating a cybersecurity assessment team.

**Target:** ${target}

**Your team:**
${rosterLines || '(No sub-agents assigned — you will perform the full assessment alone)'}

**Your task for this phase:**
1. Briefly outline the overall attack surface and risk areas for the target
2. For each team member, delegate a specific focused task using a DELEGATE line
3. Add your own preliminary FINDING lines for any obvious issues you can identify directly

The delegation format is:
DELEGATE: {"role":"pen_tester","task":"Test all authentication endpoints for SQLi, IDOR, brute-force vulnerabilities"}

Delegate one task per team member. Be specific — each member will work independently.`;
}

function buildSubAgentPrompt(
  target:   string,
  role:     string,
  task:     string,
): string {
  return `You are a **${roleLabel(role)}** on a cybersecurity assessment team.

**Target:** ${target}

**Your assigned task:** ${task}

Investigate this task thoroughly. For every security issue you find, output a FINDING line.
Be precise: include file paths, line numbers, or component names in the location field where possible.
Focus only on your assigned task — do not investigate other areas.`;
}

function buildLeadSynthesisPrompt(
  target:     string,
  subResults: Array<{ role: string; agentName: string; text: string; findingCount: number }>,
): string {
  const sections = subResults.map(r =>
    `### ${roleLabel(r.role)} (${r.agentName}) — ${r.findingCount} finding(s)\n\n${r.text || '*(No output)*'}`
  ).join('\n\n---\n\n');

  return `You are the **Lead Security Analyst**. Your team has completed their assessments of **${target}**.

Here are all team member reports:

---

${sections}

---

**Your task:**
1. Synthesize all findings into a final executive security report
2. Prioritize findings by severity and business impact
3. Identify any patterns, attack chains, or correlated risks across multiple findings
4. Provide a risk summary (Overall posture: Critical/High/Medium/Low)
5. Propose a prioritized remediation roadmap (immediate / short-term / long-term)

Output any new or confirmed findings you identify using FINDING lines.
End with a clear executive summary paragraph.`;
}

// ── Run a single agent and persist results ────────────────────────────────────

interface SingleRunResult {
  runId:       string;
  fullText:    string;
  findings:    FindingEntry[];
  delegations: DelegationEntry[];
  tokens:      number;
  error?:      string;
}

async function runAgent(opts: {
  deploymentId: string;
  deploymentPort: number;
  agentId:      string;
  agentName:    string;
  agentUserId:  string;
  teamRunId:    string;
  parentRunId?: string;
  role:         string;
  message:      string;
}): Promise<SingleRunResult> {
  const { deploymentId, deploymentPort, agentId, agentName, agentUserId, teamRunId, parentRunId, role, message } = opts;

  // Create AgentRun
  const run = await prisma.agentRun.create({
    data: {
      deploymentId,
      teamRunId,
      parentRunId: parentRunId ?? null,
      role,
      status: 'running',
    },
  });

  await prisma.chatMessage.create({
    data: { runId: run.id, role: 'user', content: message },
  });

  // Collect SSE
  const result = await collectAgentRun({ runId: run.id, deploymentPort, message });

  if (!result.ok) {
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: 'error', completedAt: new Date() } });
    await prisma.chatMessage.create({ data: { runId: run.id, role: 'assistant', content: `Error: ${result.error}` } });
    return { runId: run.id, fullText: '', findings: [], delegations: [], tokens: 0, error: result.error };
  }

  const { fullText, tokens, toolCalls, findings, delegations } = result.data;

  // Save findings
  if (findings.length > 0) {
    await saveFindings({ agentId, runId: run.id, findings });
  }

  // Persist assistant message
  await prisma.chatMessage.create({
    data: {
      runId:      run.id,
      role:       'assistant',
      content:    fullText,
      toolCalls:  toolCalls.length > 0 ? (toolCalls as object[]) : undefined,
      tokensUsed: tokens,
    },
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: 'completed', completedAt: new Date(), tokensUsed: { increment: tokens } },
  });

  void agentName; void agentUserId; // used for future notification hooks

  return { runId: run.id, fullText, findings, delegations, tokens };
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function fireTeamRun(teamRunId: string): Promise<void> {
  // ── Load everything ──────────────────────────────────────
  const teamRun = await prisma.teamRun.findUnique({
    where: { id: teamRunId },
    include: {
      team: {
        include: {
          members: {
            orderBy: { order: 'asc' },
            include: {
              agent: {
                include: {
                  deployments: {
                    where:   { status: 'running' },
                    orderBy: { createdAt: 'desc' },
                    take:    1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teamRun) return;

  const members = teamRun.team.members;
  const lead    = members.find(m => m.role === 'lead');

  async function failRun(msg: string) {
    await prisma.teamRun.update({
      where: { id: teamRunId },
      data:  { status: 'error', phase: 'done', completedAt: new Date(), report: msg },
    });
  }

  if (!lead) {
    await failRun('Team has no lead agent assigned.');
    return;
  }

  const leadDeployment = lead.agent.deployments[0];
  if (!leadDeployment?.port) {
    await failRun('Lead agent is not currently running. Deploy it first.');
    return;
  }

  const subMembers = members.filter(m => m.role !== 'lead');
  const roster = members.map(m => ({
    role:        m.role,
    agentName:   m.agent.name,
    description: m.agent.description,
  }));

  // ── Phase 1: Lead plans + delegates ─────────────────────
  await prisma.teamRun.update({ where: { id: teamRunId }, data: { phase: 'planning' } });

  const leadPlanPrompt = buildLeadPlanPrompt(teamRun.target, roster);

  const leadPlanResult = await runAgent({
    deploymentId:   leadDeployment.id,
    deploymentPort: leadDeployment.port,
    agentId:        lead.agent.id,
    agentName:      lead.agent.name,
    agentUserId:    lead.agent.userId,
    teamRunId,
    role:           'lead',
    message:        leadPlanPrompt,
  });

  const leadPlanRunId = leadPlanResult.runId;

  // ── Phase 2: Sub-agents run in parallel ──────────────────
  await prisma.teamRun.update({ where: { id: teamRunId }, data: { phase: 'delegating' } });

  // Map delegations to sub-members by role
  const subResults: Array<{ role: string; agentName: string; text: string; findingCount: number }> = [];

  // Build task list: explicit delegations first, then default tasks for remaining members
  const explicitDelegations = leadPlanResult.delegations;
  const taskMap = new Map<string, string>();

  for (const d of explicitDelegations) {
    taskMap.set(d.role, d.task);
  }

  // If no delegation for a role, assign a default task
  for (const m of subMembers) {
    if (!taskMap.has(m.role)) {
      taskMap.set(m.role, `Perform a thorough ${roleLabel(m.role)} assessment on: ${teamRun.target}`);
    }
  }

  // Fire all sub-agents in parallel
  const subPromises = subMembers.map(async m => {
    const dep = m.agent.deployments[0];
    if (!dep?.port) {
      subResults.push({
        role:         m.role,
        agentName:    m.agent.name,
        text:         `Agent "${m.agent.name}" is not running (no active deployment).`,
        findingCount: 0,
      });
      return;
    }

    const task   = taskMap.get(m.role) ?? `Assess target: ${teamRun.target}`;
    const prompt = buildSubAgentPrompt(teamRun.target, m.role, task);

    const r = await runAgent({
      deploymentId:   dep.id,
      deploymentPort: dep.port,
      agentId:        m.agent.id,
      agentName:      m.agent.name,
      agentUserId:    m.agent.userId,
      teamRunId,
      parentRunId:    leadPlanRunId,
      role:           m.role,
      message:        prompt,
    });

    subResults.push({
      role:         m.role,
      agentName:    m.agent.name,
      text:         r.fullText,
      findingCount: r.findings.length,
    });
  });

  await Promise.all(subPromises);

  // ── Phase 3: Lead synthesizes ────────────────────────────
  await prisma.teamRun.update({ where: { id: teamRunId }, data: { phase: 'synthesizing' } });

  let finalReport = '';

  if (subResults.length > 0) {
    // Re-check that lead deployment is still running before synthesis phase.
    // If the container crashed between phases, fail gracefully with the
    // sub-agent results rather than silently losing all work.
    const freshLead = await prisma.deployment.findFirst({
      where: { id: leadDeployment.id, status: 'running' },
      select: { id: true, port: true },
    });

    if (!freshLead?.port) {
      // Lead went offline — store sub-agent results as the final report anyway
      const partialReport = subResults
        .map(r => `### ${roleLabel(r.role)} (${r.agentName})\n\n${r.text || '*(No output)*'}`)
        .join('\n\n---\n\n');
      await prisma.teamRun.update({
        where: { id: teamRunId },
        data: {
          status:      'completed',
          phase:       'done',
          report:      `[Lead agent went offline before synthesis. Sub-agent reports below:]\n\n${partialReport}`,
          completedAt: new Date(),
        },
      });
      return;
    }

    const synthPrompt = buildLeadSynthesisPrompt(teamRun.target, subResults);

    const synthResult = await runAgent({
      deploymentId:   freshLead.id,
      deploymentPort: freshLead.port,
      agentId:        lead.agent.id,
      agentName:      lead.agent.name,
      agentUserId:    lead.agent.userId,
      teamRunId,
      parentRunId:    leadPlanRunId,
      role:           'lead',
      message:        synthPrompt,
    });

    finalReport = synthResult.fullText;
  } else {
    // No sub-agents — lead's plan is the report
    finalReport = leadPlanResult.fullText;
  }

  // ── Phase 4: Done ────────────────────────────────────────
  await prisma.teamRun.update({
    where: { id: teamRunId },
    data:  {
      status:      'completed',
      phase:       'done',
      report:      finalReport,
      completedAt: new Date(),
    },
  });
}
