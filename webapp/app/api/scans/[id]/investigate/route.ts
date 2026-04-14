import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fireAgentRun } from '@/lib/fire-agent-run';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/scans/[id]/investigate
 * Body: { agentId: string }
 *
 * Starts an agent run targeted at investigating this scan's findings.
 * Returns { runId, agentId } so the client can navigate to the console.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: scanId } = await params;
  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 });

  // Load scan + verify ownership
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, userId: session.user.id },
    select: {
      id: true, repo: true, branch: true, score: true, grade: true,
      findings: true, secrets: true, vulns: true, cves: true, report: true,
    },
  });
  if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404 });

  // Load agent + running deployment
  const orgIds = await prisma.orgMember
    .findMany({ where: { userId: session.user.id }, select: { orgId: true } })
    .then(ms => ms.map(m => m.orgId));

  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      OR: [
        { userId: session.user.id },
        ...(orgIds.length > 0 ? [{ orgId: { in: orgIds } }] : []),
      ],
    },
  });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const deployment = await prisma.deployment.findFirst({
    where: { agentId, status: 'running' },
    orderBy: { createdAt: 'desc' },
  });
  if (!deployment) return NextResponse.json({ error: 'Agent is not running' }, { status: 400 });

  // Build context-rich prompt from scan results
  const report = scan.report as Record<string, unknown> | null;
  const topFindings: string[] = [];
  if (report?.findings && Array.isArray(report.findings)) {
    (report.findings as Array<{ severity: string; title: string; file?: string; description?: string }>)
      .filter(f => ['critical','high'].includes(f.severity))
      .slice(0, 10)
      .forEach(f => topFindings.push(`- [${f.severity.toUpperCase()}] ${f.title}${f.file ? ` in ${f.file}` : ''}${f.description ? `: ${f.description}` : ''}`));
  }

  const prompt = `You are investigating a security scan report for the repository **${scan.repo}** (branch: ${scan.branch}).

**Scan summary:**
- Security score: ${scan.score ?? 'N/A'}/100 (${scan.grade ?? 'N/A'})
- Total findings: ${scan.findings}
- Secrets exposed: ${scan.secrets}
- Code vulnerabilities: ${scan.vulns}
- Known CVEs in dependencies: ${scan.cves}

${topFindings.length > 0 ? `**Top critical/high findings:**\n${topFindings.join('\n')}\n` : ''}
Your goal: Investigate these findings in depth. For each critical or high issue:
1. Confirm whether it is a real vulnerability or a false positive
2. Identify the root cause and affected code paths
3. Propose a concrete remediation
4. Output each confirmed issue as a FINDING line

Start with the most critical issues first.`;

  // Create run + user message
  const run = await prisma.agentRun.create({
    data: { deploymentId: deployment.id, status: 'running' },
  });
  await prisma.chatMessage.create({
    data: { runId: run.id, role: 'user', content: prompt },
  });

  // Fire async — don't await
  fireAgentRun({ runId: run.id, deploymentPort: deployment.port!, message: prompt }).catch(() => {});

  return NextResponse.json({ runId: run.id, agentId: agent.id });
}
