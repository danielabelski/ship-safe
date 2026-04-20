import { NextRequest, NextResponse } from 'next/server';

/* ── Rate limiting (in-memory, per-IP) ── */
const rateMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

/* ── Credential patterns matched against env var NAMES (never values) ── */
interface CredentialPattern {
  pattern: RegExp;
  issuer: string;
  name: string;
  rotateUrl: string | null;
  priority: number; // lower = shown first
}

const CREDENTIAL_PATTERNS: CredentialPattern[] = [
  { pattern: /^(GITHUB_TOKEN|GH_TOKEN|GH_PAT|GITHUB_PAT|GITHUB_ACCESS_TOKEN)$/, issuer: 'github', name: 'GitHub', rotateUrl: 'https://github.com/settings/tokens', priority: 1 },
  { pattern: /^(VERCEL_TOKEN|VERCEL_ACCESS_TOKEN)$/, issuer: 'vercel', name: 'Vercel', rotateUrl: 'https://vercel.com/account/tokens', priority: 2 },
  { pattern: /^(OPENAI_API_KEY|OPENAI_KEY)$/, issuer: 'openai', name: 'OpenAI', rotateUrl: 'https://platform.openai.com/api-keys', priority: 3 },
  { pattern: /^(ANTHROPIC_API_KEY|ANTHROPIC_KEY)$/, issuer: 'anthropic', name: 'Anthropic', rotateUrl: 'https://console.anthropic.com/settings/keys', priority: 4 },
  { pattern: /^(STRIPE_SECRET_KEY|STRIPE_SK|STRIPE_LIVE_SECRET_KEY|STRIPE_KEY)$/, issuer: 'stripe', name: 'Stripe', rotateUrl: 'https://dashboard.stripe.com/apikeys', priority: 5 },
  { pattern: /^(STRIPE_WEBHOOK_SECRET|STRIPE_WEBHOOK_SIGNING_SECRET)$/, issuer: 'stripe-webhook', name: 'Stripe Webhooks', rotateUrl: 'https://dashboard.stripe.com/webhooks', priority: 6 },
  { pattern: /^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY|SUPABASE_ANON_KEY)$/, issuer: 'supabase', name: 'Supabase', rotateUrl: 'https://supabase.com/dashboard/project/_/settings/api', priority: 7 },
  { pattern: /^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|DATABASE_URL_NON_POOLING|POSTGRES_URL_NON_POOLING)$/, issuer: 'database', name: 'Database', rotateUrl: null, priority: 8 },
  { pattern: /^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)$/, issuer: 'aws', name: 'AWS', rotateUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials', priority: 9 },
  { pattern: /^(LINEAR_API_KEY|LINEAR_KEY)$/, issuer: 'linear', name: 'Linear', rotateUrl: 'https://linear.app/settings/api', priority: 10 },
  { pattern: /^(SLACK_BOT_TOKEN|SLACK_TOKEN|SLACK_WEBHOOK_URL|SLACK_SIGNING_SECRET)$/, issuer: 'slack', name: 'Slack', rotateUrl: 'https://api.slack.com/apps', priority: 11 },
  { pattern: /^(SENDGRID_API_KEY)$/, issuer: 'sendgrid', name: 'SendGrid', rotateUrl: 'https://app.sendgrid.com/settings/api_keys', priority: 12 },
  { pattern: /^(RESEND_API_KEY)$/, issuer: 'resend', name: 'Resend', rotateUrl: 'https://resend.com/api-keys', priority: 13 },
  { pattern: /^(GOOGLE_CLIENT_SECRET|GOOGLE_API_KEY|GOOGLE_SERVICE_ACCOUNT_KEY)$/, issuer: 'google', name: 'Google', rotateUrl: 'https://console.cloud.google.com/apis/credentials', priority: 14 },
  { pattern: /^(TWILIO_AUTH_TOKEN|TWILIO_API_KEY|TWILIO_API_SECRET)$/, issuer: 'twilio', name: 'Twilio', rotateUrl: 'https://console.twilio.com/us1/account/keys-credentials/api-keys', priority: 15 },
  { pattern: /^(DATADOG_API_KEY|DD_API_KEY|DATADOG_APP_KEY|DD_APP_KEY)$/, issuer: 'datadog', name: 'Datadog', rotateUrl: 'https://app.datadoghq.com/organization-settings/api-keys', priority: 16 },
  { pattern: /^(SENTRY_AUTH_TOKEN|SENTRY_DSN)$/, issuer: 'sentry', name: 'Sentry', rotateUrl: 'https://sentry.io/settings/auth-tokens/', priority: 17 },
  { pattern: /^(NEON_DATABASE_URL|NEON_DIRECT_URL|NEON_POOLED_URL)$/, issuer: 'neon', name: 'Neon', rotateUrl: 'https://console.neon.tech', priority: 18 },
  { pattern: /^(PLANETSCALE_DATABASE_URL|PSCALE_PASSWORD)$/, issuer: 'planetscale', name: 'PlanetScale', rotateUrl: 'https://app.planetscale.com', priority: 19 },
  { pattern: /^(CLERK_SECRET_KEY|CLERK_API_KEY)$/, issuer: 'clerk', name: 'Clerk', rotateUrl: 'https://dashboard.clerk.com', priority: 20 },
  { pattern: /^(AUTHKIT_SECRET|WORKOS_API_KEY)$/, issuer: 'workos', name: 'WorkOS/AuthKit', rotateUrl: 'https://dashboard.workos.com/api-keys', priority: 21 },
  { pattern: /^(HUBSPOT_ACCESS_TOKEN|HUBSPOT_API_KEY)$/, issuer: 'hubspot', name: 'HubSpot', rotateUrl: 'https://app.hubspot.com/l/api-key', priority: 22 },
  { pattern: /^(LIVEKIT_API_KEY|LIVEKIT_API_SECRET)$/, issuer: 'livekit', name: 'LiveKit', rotateUrl: 'https://cloud.livekit.io', priority: 23 },
  { pattern: /^(UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_URL)$/, issuer: 'upstash', name: 'Upstash', rotateUrl: 'https://console.upstash.com', priority: 24 },
  { pattern: /^(REPLICATE_API_TOKEN|REPLICATE_API_KEY)$/, issuer: 'replicate', name: 'Replicate', rotateUrl: 'https://replicate.com/account/api-tokens', priority: 25 },
];

function matchPattern(key: string): CredentialPattern | null {
  for (const p of CREDENTIAL_PATTERNS) {
    if (p.pattern.test(key)) return p;
  }
  return null;
}

/* ── Vercel API helpers ── */
function vercelHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface VercelProject { id: string; name: string; }
interface VercelEnvVar  { id: string; key: string; type: string; }

export interface AffectedEnvVar {
  projectId: string;
  projectName: string;
  envVar: string;
  envId: string;
  envType: string;
}

export interface IssuerGroup {
  issuer: string;
  name: string;
  rotateUrl: string | null;
  priority: number;
  affected: AffectedEnvVar[];
}

async function getAccountSlug(token: string, teamId?: string): Promise<string> {
  if (teamId) {
    const r = await fetch(`https://api.vercel.com/v2/teams/${teamId}`, {
      headers: vercelHeaders(token),
    });
    if (r.ok) {
      const data = await r.json();
      return String(data.slug ?? '');
    }
    return '';
  }
  const r = await fetch('https://api.vercel.com/v2/user', { headers: vercelHeaders(token) });
  if (r.ok) {
    const data = await r.json();
    return String(data.user?.username ?? '');
  }
  return '';
}

async function getAllProjects(token: string, teamId?: string): Promise<VercelProject[]> {
  const projects: VercelProject[] = [];
  let cursor: number | undefined;
  const MAX_PAGES = 20;

  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ limit: '100' });
    if (teamId) params.set('teamId', teamId);
    if (cursor) params.set('from', String(cursor));

    const r = await fetch(`https://api.vercel.com/v9/projects?${params}`, {
      headers: vercelHeaders(token),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`${r.status}::${body}`);
    }
    const data = await r.json();
    const batch: VercelProject[] = (data.projects ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ''),
      name: String(p.name ?? ''),
    }));
    projects.push(...batch);
    if (!data.pagination?.next || batch.length < 100) break;
    cursor = data.pagination.next;
  }
  return projects;
}

async function getProjectEnvVars(token: string, projectId: string, teamId?: string): Promise<VercelEnvVar[]> {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const r = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?${params}`, {
    headers: vercelHeaders(token),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.envs ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id ?? ''),
    key: String(e.key ?? ''),
    type: String(e.type ?? 'plain'),
  }));
}

/* ── Route handler ── */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
  }

  let body: { vercelToken: string; teamId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { vercelToken, teamId } = body;
  if (!vercelToken?.trim()) {
    return NextResponse.json({ error: 'vercelToken is required' }, { status: 400 });
  }

  let projects: VercelProject[];
  let accountSlug = '';
  try {
    [projects, accountSlug] = await Promise.all([
      getAllProjects(vercelToken.trim(), teamId?.trim() || undefined),
      getAccountSlug(vercelToken.trim(), teamId?.trim() || undefined),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('401') || msg.includes('403')) {
      return NextResponse.json({ error: 'Invalid or expired Vercel token. Make sure it has read access.' }, { status: 400 });
    }
    if (msg.includes('400')) {
      return NextResponse.json({ error: 'Vercel returned 400. If your projects are under a team, add your Team ID (team_xxxxxx) above.' }, { status: 400 });
    }
    return NextResponse.json({ error: `Vercel API error: ${msg}` }, { status: 500 });
  }

  if (projects.length === 0) {
    return NextResponse.json({
      projectsScanned: 0,
      totalEnvVars: 0,
      issuers: [],
      accountSlug,
      generatedAt: new Date().toISOString(),
      teamId: teamId?.trim() || null,
    });
  }

  // Fetch env var names from each project (batched to avoid rate limits)
  const issuerMap = new Map<string, IssuerGroup>();
  const BATCH_SIZE = 5;

  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (project) => {
      const envVars = await getProjectEnvVars(
        vercelToken.trim(),
        project.id,
        teamId?.trim() || undefined,
      );
      for (const env of envVars) {
        const match = matchPattern(env.key);
        if (!match) continue;
        if (!issuerMap.has(match.issuer)) {
          issuerMap.set(match.issuer, {
            issuer: match.issuer,
            name: match.name,
            rotateUrl: match.rotateUrl,
            priority: match.priority,
            affected: [],
          });
        }
        issuerMap.get(match.issuer)!.affected.push({
          projectId: project.id,
          projectName: project.name,
          envVar: env.key,
          envId: env.id,
          envType: env.type,
        });
      }
    }));
  }

  const issuers = Array.from(issuerMap.values()).sort((a, b) => a.priority - b.priority);
  const totalEnvVars = issuers.reduce((sum, g) => sum + g.affected.length, 0);

  return NextResponse.json({
    projectsScanned: projects.length,
    totalEnvVars,
    issuers,
    accountSlug,
    generatedAt: new Date().toISOString(),
    teamId: teamId?.trim() || null,
  });
}
