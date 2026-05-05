import { prisma } from '@/lib/prisma';
import type { BlogPost } from '@/data/blog';
import type { ContentAgentConfig, ScoredItem } from '@/lib/content-agent';

interface DraftInput {
  topic: ScoredItem;
  supportingSources: ScoredItem[];
  config: ContentAgentConfig;
}

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4099';
const ORCHESTRATOR_SECRET = process.env.ORCHESTRATOR_SECRET;

export async function draftWithHermesProvider({ topic, supportingSources, config }: DraftInput): Promise<BlogPost | undefined> {
  const agentId = config.hermesAgentId ?? process.env.CONTENT_AGENT_HERMES_AGENT_ID;
  if (!agentId) return undefined;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      deployments: {
        where: { status: 'running' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const deployment = agent?.deployments[0];
  if (!deployment?.port) return undefined;

  const message = [
    'You are the Ship Safe content research and writing agent.',
    'Return only valid JSON matching this schema:',
    JSON.stringify({
      slug: 'kebab-case string',
      title: 'string',
      description: 'string under 180 chars',
      date: new Date().toISOString().slice(0, 10),
      author: `${config.brandName} Content Agent`,
      tags: ['3-5 strings'],
      keywords: ['6-12 SEO strings'],
      content: 'Markdown body with a ## Sources section. Cite only provided URLs.',
    }),
    '',
    'Rules:',
    '- Do not invent sources, dates, quotes, or claims.',
    '- Treat social discussion as signal, not proof.',
    '- Keep the angle practical for developers and SaaS founders.',
    '- Mention Ship Safe only where it naturally helps with the risk.',
    '- Prefer a timely news angle: what happened, why it matters this week, what builders should do now.',
    '- Write a substantial draft, roughly 1,200-1,600 words, unless the source material cannot support it.',
    '- Include sections for What Happened, Why It Matters, What Teams Should Check, and Sources.',
    '- Explain uncertainty plainly when a source is social discussion rather than primary reporting.',
    '',
    'Selected topic:',
    JSON.stringify(topic),
    '',
    'Supporting sources:',
    JSON.stringify(supportingSources),
  ].join('\n');

  const res = await fetch(`${ORCHESTRATOR_URL}/chat/${deployment.port}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ORCHESTRATOR_SECRET ? { Authorization: `Bearer ${ORCHESTRATOR_SECRET}` } : {}),
    },
    body: JSON.stringify({ message, sessionId: `content-agent-${Date.now()}` }),
  });

  if (!res.ok || !res.body) return undefined;

  const text = await collectSseTokens(res.body);
  const parsed = parseJsonFromText<BlogPost>(text);
  if (!parsed) return undefined;

  return {
    ...parsed,
    slug: slugify(parsed.slug || parsed.title),
    date: parsed.date || new Date().toISOString().slice(0, 10),
    author: parsed.author || `${config.brandName} Content Agent`,
  };
}

async function collectSseTokens(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let fullText = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (currentEvent === 'token' && line.startsWith('data: ')) {
        const raw = line.slice(6);
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string') fullText += parsed;
        } catch {
          fullText += raw;
        }
      }
    }
  }

  return fullText;
}

function parseJsonFromText<T>(text: string): T | undefined {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return undefined;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}
