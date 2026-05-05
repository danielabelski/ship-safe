import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { discoverRankedItems, type ScoredItem } from '@/lib/content-agent';

const MAX_INTELLIGENCE_ITEMS = 12;

interface UserContext {
  repos: string[];
  recentFindings: {
    secrets: number;
    vulns: number;
    cves: number;
    findings: number;
  };
  hasAgents: boolean;
  hasGitHubActions: boolean;
}

export async function runSecurityIntelligence(userId: string) {
  const run = await prisma.intelligenceRun.create({ data: { userId } });

  try {
    const [context, discovery] = await Promise.all([
      loadUserContext(userId),
      discoverRankedItems(),
    ]);

    const items = discovery.ranked
      .map((item) => enrichItem(item, context))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_INTELLIGENCE_ITEMS);

    for (const item of items) {
      await prisma.intelligenceItem.upsert({
        where: { userId_url: { userId, url: item.url } },
        update: {
          runId: run.id,
          title: item.title,
          sourceId: item.sourceId,
          sourceType: item.sourceType,
          excerpt: item.excerpt,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          engagement: item.engagement,
          score: item.score,
          urgency: item.urgency,
          confidence: item.confidence,
          riskTypes: item.riskTypes as Prisma.InputJsonValue,
          affectedAreas: item.affectedAreas as Prisma.InputJsonValue,
          recommendedActions: item.recommendedActions as Prisma.InputJsonValue,
          reasons: item.reasons as Prisma.InputJsonValue,
        },
        create: {
          userId,
          runId: run.id,
          title: item.title,
          url: item.url,
          sourceId: item.sourceId,
          sourceType: item.sourceType,
          excerpt: item.excerpt,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          engagement: item.engagement,
          score: item.score,
          urgency: item.urgency,
          confidence: item.confidence,
          riskTypes: item.riskTypes as Prisma.InputJsonValue,
          affectedAreas: item.affectedAreas as Prisma.InputJsonValue,
          recommendedActions: item.recommendedActions as Prisma.InputJsonValue,
          reasons: item.reasons as Prisma.InputJsonValue,
        },
      });
    }

    return prisma.intelligenceRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        sourceCount: discovery.config.sources.length,
        candidateCount: discovery.discovered.length,
        selectedCount: items.length,
        completedAt: new Date(),
      },
      include: { items: { orderBy: { score: 'desc' } } },
    });
  } catch (error) {
    return prisma.intelligenceRun.update({
      where: { id: run.id },
      data: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Security intelligence run failed',
        completedAt: new Date(),
      },
      include: { items: true },
    });
  }
}

async function loadUserContext(userId: string): Promise<UserContext> {
  const [repos, scans, agentCount] = await Promise.all([
    prisma.monitoredRepo.findMany({ where: { userId, enabled: true }, select: { repo: true } }),
    prisma.scan.findMany({
      where: { userId, status: 'done' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { repo: true, secrets: true, vulns: true, cves: true, findings: true, report: true },
    }),
    prisma.agent.count({ where: { userId } }),
  ]);

  const repoNames = Array.from(new Set([
    ...repos.map((repo) => repo.repo),
    ...scans.map((scan) => scan.repo),
  ])).slice(0, 20);

  return {
    repos: repoNames,
    recentFindings: {
      secrets: scans.reduce((sum, scan) => sum + scan.secrets, 0),
      vulns: scans.reduce((sum, scan) => sum + scan.vulns, 0),
      cves: scans.reduce((sum, scan) => sum + scan.cves, 0),
      findings: scans.reduce((sum, scan) => sum + scan.findings, 0),
    },
    hasAgents: agentCount > 0,
    hasGitHubActions: scans.some((scan) => JSON.stringify(scan.report ?? {}).toLowerCase().includes('github actions')),
  };
}

function enrichItem(item: ScoredItem, context: UserContext) {
  const haystack = `${item.title} ${item.excerpt}`.toLowerCase();
  const riskTypes = classifyRiskTypes(haystack);
  const affectedAreas = classifyAffectedAreas(haystack, context);
  const recommendedActions = recommendActions(riskTypes, affectedAreas, context);
  const ageHours = item.publishedAt ? (Date.now() - new Date(item.publishedAt).getTime()) / 3_600_000 : 168;
  const contextBoost = contextBoostFor(riskTypes, affectedAreas, context);
  const score = Math.min(100, item.score + contextBoost);

  return {
    ...item,
    score,
    urgency: urgencyFor(score, ageHours, riskTypes),
    confidence: confidenceFor(item),
    riskTypes,
    affectedAreas,
    recommendedActions,
    reasons: [
      ...item.reasons,
      ...contextReasons(riskTypes, affectedAreas, context),
    ].slice(0, 8),
  };
}

function classifyRiskTypes(text: string) {
  const risks = new Set<string>();
  if (/secret|token|credential|api key|oauth|pat\b/.test(text)) risks.add('credential exposure');
  if (/npm|pypi|package|dependency|supply chain|maintainer/.test(text)) risks.add('supply chain');
  if (/cve|zero-day|0-day|vulnerability|rce|exploit/.test(text)) risks.add('vulnerability');
  if (/prompt injection|mcp|agent|llm|ai app|model/.test(text)) risks.add('AI agent risk');
  if (/github actions|ci\/cd|workflow|pipeline|deploy/.test(text)) risks.add('CI/CD');
  if (/webhook|callback|signature/.test(text)) risks.add('webhook trust');
  return Array.from(risks.size ? risks : new Set(['security news']));
}

function classifyAffectedAreas(text: string, context: UserContext) {
  const areas = new Set<string>();
  if (/secret|token|credential|oauth|api key/.test(text) || context.recentFindings.secrets > 0) areas.add('secrets');
  if (/github|workflow|ci\/cd|deploy|pipeline/.test(text) || context.hasGitHubActions) areas.add('GitHub Actions');
  if (/npm|pypi|dependency|package|cve/.test(text) || context.recentFindings.vulns > 0 || context.recentFindings.cves > 0) areas.add('dependencies');
  if (/mcp|agent|llm|prompt injection|tool/.test(text) || context.hasAgents) areas.add('AI agents');
  if (/webhook|signature|callback/.test(text)) areas.add('webhooks');
  return Array.from(areas.size ? areas : new Set(['general security posture']));
}

function recommendActions(riskTypes: string[], affectedAreas: string[], context: UserContext) {
  const actions = new Set<string>();
  if (affectedAreas.includes('secrets')) actions.add('Run a secrets scan');
  if (affectedAreas.includes('dependencies')) actions.add('Run dependency/CVE scan');
  if (affectedAreas.includes('GitHub Actions')) actions.add('Audit GitHub Actions permissions');
  if (affectedAreas.includes('AI agents')) actions.add('Review MCP/Hermes agent tool permissions');
  if (affectedAreas.includes('webhooks')) actions.add('Verify webhook signatures');
  if (context.repos.length > 0) actions.add(`Check ${context.repos[0]} first`);
  if (riskTypes.includes('security news')) actions.add('Watch for follow-up details');
  return Array.from(actions).slice(0, 5);
}

function contextBoostFor(riskTypes: string[], affectedAreas: string[], context: UserContext) {
  let boost = 0;
  if (affectedAreas.includes('secrets') && context.recentFindings.secrets > 0) boost += 12;
  if (affectedAreas.includes('dependencies') && (context.recentFindings.vulns > 0 || context.recentFindings.cves > 0)) boost += 10;
  if (affectedAreas.includes('AI agents') && context.hasAgents) boost += 8;
  if (affectedAreas.includes('GitHub Actions') && context.hasGitHubActions) boost += 8;
  if (riskTypes.includes('credential exposure')) boost += 6;
  return boost;
}

function urgencyFor(score: number, ageHours: number, riskTypes: string[]) {
  if (score >= 78 && ageHours <= 72) return 'critical';
  if (score >= 65 || riskTypes.includes('credential exposure')) return 'high';
  if (score >= 45) return 'medium';
  return 'watch';
}

function confidenceFor(item: ScoredItem) {
  if (item.sourceType === 'rss') return 'high';
  if (item.sourceType === 'hackernews' || item.sourceType === 'reddit') return 'medium';
  return 'low';
}

function contextReasons(riskTypes: string[], affectedAreas: string[], context: UserContext) {
  const reasons: string[] = [];
  if (context.repos.length > 0) reasons.push(`Mapped against ${context.repos.length} known repo${context.repos.length === 1 ? '' : 's'}`);
  if (context.recentFindings.secrets > 0 && affectedAreas.includes('secrets')) reasons.push('You have recent secrets findings');
  if (context.hasAgents && affectedAreas.includes('AI agents')) reasons.push('You have Ship Safe agents configured');
  if (riskTypes.includes('supply chain')) reasons.push('Relevant to dependency and package trust');
  return reasons;
}
