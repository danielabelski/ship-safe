export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  keywords: string[];
  content: string;
}

export const posts: BlogPost[] = [
  {
    slug: 'vibe-coding-security-risks',
    title: 'Vibe Coding Is Fast, But Is It Safe? 7 Security Risks in AI-Generated Code',
    description: 'AI coding tools ship code fast but skip security checks. Here are the 7 most common vulnerabilities in AI-generated code and how to catch them automatically.',
    date: '2026-03-25',
    author: 'Ship Safe Team',
    tags: ['AI security', 'vibe coding', 'best practices'],
    keywords: ['vibe coding security', 'AI generated code vulnerabilities', 'Cursor security', 'Copilot security risks', 'Claude Code security', 'AI coding assistant security'],
    content: `
Vibe coding, the practice of building apps by describing what you want to an AI and letting it write the code, is the fastest way to ship software in 2025. Cursor, Claude Code, Copilot, and Windsurf have made it possible to go from idea to deployed app in hours.

But there's a problem: **AI coding tools optimize for functionality, not security.**

We've scanned hundreds of vibe-coded projects with Ship Safe, and the same security patterns keep appearing. Here's what we found.

## 1. Hardcoded Secrets

The most common finding by far. AI assistants frequently complete configuration with real-looking API keys, database URLs, and auth tokens.

\`\`\`javascript
// AI-generated config
const stripe = require('stripe')('sk_live_51ABC...');
const db = new Pool({ connectionString: 'postgresql://admin:password123@...' });
\`\`\`

**Fix:** Always use environment variables. Run \`npx ship-safe scan .\` to catch any that slip through.

## 2. API Routes Without Authentication

AI generates the endpoint logic beautifully but forgets the auth middleware.

\`\`\`typescript
// AI-generated: "create an API endpoint to delete a user"
export async function DELETE(req: Request) {
  const { userId } = await req.json();
  await db.user.delete({ where: { id: userId } });
  return Response.json({ success: true });
}
// Anyone can delete any user
\`\`\`

**Fix:** Always wrap state-changing routes with auth middleware. Ship Safe's AuthBypassAgent flags these automatically.

## 3. Raw SQL Queries

AI sometimes reaches for raw queries instead of parameterized ones, especially for complex filtering.

\`\`\`python
# AI-generated: "search users by name"
@app.route('/search')
def search():
    name = request.args.get('name')
    results = db.execute(f"SELECT * FROM users WHERE name LIKE '%{name}%'")
    return jsonify(results)
\`\`\`

**Fix:** Always use parameterized queries. Ship Safe's InjectionTester catches SQL injection, NoSQL injection, and command injection patterns.

## 4. Missing Input Validation

Server Actions, API routes, and form handlers that trust user input blindly. A common pattern: AI generates a form handler that passes \`role\` from the form directly to the database, letting users promote themselves to admin.

**Fix:** Use Zod schemas to validate all user input. Whitelist allowed fields explicitly.

## 5. Excessive LLM Agency

If you're building AI features, AI assistants often give the LLM too much power: direct database writes, shell commands, file system access, all without human approval.

**Fix:** Restrict destructive tools behind a human-in-the-loop approval step. Ship Safe's AgenticSecurityAgent checks for OWASP LLM04 (Excessive Agency).

## 6. Docker Running as Root

AI generates a working Dockerfile, but usually without a non-root user. This is a container escape risk.

**Fix:** Add a \`USER\` directive to your Dockerfile. Ship Safe's ConfigAuditor flags this.

## 7. Wildcard Dependencies

AI often adds dependencies without pinning versions, or uses \`*\` for quick setup. This is a supply chain attack vector.

**Fix:** Pin exact versions. Use \`npx ship-safe audit .\` to catch wildcard versions and known CVEs in your dependency tree.

## The Fix: One Command After Every Vibe Coding Session

\`\`\`bash
npx ship-safe audit .
\`\`\`

18 agents, 80+ attack classes, 3 seconds. Free and open source.

Add it to your pre-commit hook to make it automatic:

\`\`\`bash
npx husky init
echo "npx ship-safe diff --staged" > .husky/pre-commit
\`\`\`

Ship fast. Ship safe.
    `.trim(),
  },
  {
    slug: 'securing-nextjs-app',
    title: 'How to Secure Your Next.js App: A Complete Guide with Ship Safe',
    description: 'Next.js has unique security patterns that generic scanners miss. Learn how to find and fix NEXT_PUBLIC_ leaks, unprotected server actions, and API route vulnerabilities.',
    date: '2026-03-24',
    author: 'Ship Safe Team',
    tags: ['Next.js', 'security', 'tutorial'],
    keywords: ['Next.js security', 'secure Next.js app', 'NEXT_PUBLIC_ security', 'Next.js API route authentication', 'Next.js server actions validation', 'Next.js security headers', 'Supabase RLS Next.js'],
    content: `
Next.js is one of the most popular frameworks for building full-stack web applications. But with great power comes great attack surface: API routes, server components, middleware, environment variables, and client-side rendering all introduce security considerations.

This guide shows you how to use Ship Safe to audit your Next.js app for vulnerabilities and fix them before they ship.

## Quick Start

\`\`\`bash
cd your-nextjs-app
npx ship-safe audit .
\`\`\`

Ship Safe automatically detects Next.js and adjusts its scanning accordingly.

## 1. Leaked Environment Variables

The most common Next.js security mistake: accidentally exposing secrets through \`NEXT_PUBLIC_\` prefixed variables.

\`\`\`
[SECRETS] API key exposed via NEXT_PUBLIC_ prefix
  .env.local:5 → NEXT_PUBLIC_STRIPE_SECRET_KEY should not use NEXT_PUBLIC_ prefix
  Severity: CRITICAL
\`\`\`

**The rule:** Only use \`NEXT_PUBLIC_\` for values that are safe to expose in the browser. Never for API keys, database URLs, or auth secrets.

## 2. Unprotected API Routes

Next.js API routes (both \`pages/api/\` and \`app/api/\`) without authentication or rate limiting.

\`\`\`
[AUTH] API route without authentication check
  app/api/users/route.ts:1 → Add auth middleware
  OWASP: A07:2025 Authentication Failures
\`\`\`

**Fix:** Add auth checks and rate limiting to every state-changing route.

## 3. Server Actions Without Validation

Next.js Server Actions that accept user input without validation are vulnerable to injection and mass assignment attacks.

\`\`\`
[INJECTION] Server Action processes unvalidated user input
  app/actions.ts:15 → Validate input with Zod schema
  OWASP: A03:2025 Injection
\`\`\`

**Fix:** Use Zod schemas to validate all Server Action inputs. Whitelist allowed fields.

## 4. XSS via dangerouslySetInnerHTML

React's escape hatch for rendering raw HTML is a common XSS vector.

**Fix:** Always sanitize with DOMPurify before rendering user-provided HTML.

## 5. Missing Security Headers

Next.js doesn't set security headers by default. Ship Safe checks your \`next.config.js\` and middleware for Content-Security-Policy, X-Frame-Options, and others.

**Fix:** Configure headers in \`next.config.js\` using the \`headers()\` function.

## 6. Supabase RLS Issues

If you use Supabase with Next.js, Ship Safe's dedicated SupabaseRLSAgent checks for Row Level Security misconfigurations and \`service_role\` key exposure in client-side code.

## CI/CD Integration

\`\`\`yaml
name: Security Audit
on: [push, pull_request]

jobs:
  ship-safe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: asamassekou10/ship-safe@v6
        with:
          path: .
          threshold: 70
          github-pr: true
\`\`\`

## Next.js Security Checklist

After running \`npx ship-safe audit .\`, verify:

- No secrets in \`NEXT_PUBLIC_\` variables
- All API routes have authentication
- Rate limiting on auth endpoints
- Server Actions validate input with Zod
- \`dangerouslySetInnerHTML\` uses DOMPurify
- Security headers configured in \`next.config.js\`
- Supabase RLS enabled (if applicable)
- Docker runs as non-root user
- Dependencies are up to date
- CI/CD pipeline includes security scanning

Ship fast. Ship safe.
    `.trim(),
  },
  {
    slug: 'owasp-2025-what-changed',
    title: 'OWASP Top 10 2025: What Changed and How to Scan for It',
    description: 'The OWASP Top 10 2025 reshuffles the rankings and adds new categories. Here is what changed and how Ship Safe covers every category with its 18 AI security agents.',
    date: '2026-03-23',
    author: 'Ship Safe Team',
    tags: ['OWASP', 'security', 'compliance'],
    keywords: ['OWASP Top 10 2025', 'OWASP 2025 changes', 'OWASP scanner', 'OWASP compliance tool', 'application security testing', 'OWASP vulnerability scanner', 'A01 2025 broken access control'],
    content: `
The OWASP Top 10 2025 is the latest update to the most widely referenced standard for web application security. If you're building or maintaining web applications, this is the benchmark your security posture is measured against.

Here's what changed from 2021 to 2025, and how Ship Safe's 18 agents map to every category.

## The 2025 Top 10

| Rank | Category | What's New |
|------|----------|-----------|
| A01 | Broken Access Control | Still #1. Now includes BOLA and mass assignment |
| A02 | Cryptographic Failures | Expanded to cover weak JWT secrets and missing TLS |
| A03 | Injection | Now includes template injection and prompt injection |
| A04 | Insecure Design | Architecture-level flaws, not just implementation bugs |
| A05 | Security Misconfiguration | Docker, K8s, CORS, CSP, and cloud misconfigs |
| A06 | Vulnerable Components | Supply chain attacks now explicitly included |
| A07 | Authentication Failures | Rate limiting, MFA bypass, session fixation |
| A08 | Data Integrity Failures | Insecure deserialization, unsigned updates |
| A09 | Logging & Monitoring | Expanded to include missing audit trails |
| A10 | Server-Side Request Forgery | SSRF promoted from sub-category to its own entry |

## What Changed from 2021

**Injection (A03) now includes prompt injection.** This is the biggest shift. With LLMs embedded in production applications, prompt injection is now an OWASP-recognized web vulnerability, not just an AI concern.

**Supply chain attacks are now explicit in A06.** Typosquatting, dependency confusion, and malicious packages are no longer edge cases. They're mainstream attack vectors.

**SSRF got its own category (A10).** Previously a sub-item, SSRF is now important enough to stand alone, driven by cloud metadata attacks and internal service exploitation.

## How Ship Safe Covers OWASP 2025

Ship Safe's 18 agents map to every OWASP 2025 category:

| OWASP 2025 | Ship Safe Agents |
|------------|-----------------|
| A01: Broken Access Control | AuthBypassAgent, APIFuzzer |
| A02: Cryptographic Failures | AuthBypassAgent (JWT), Scanner (secrets) |
| A03: Injection | InjectionTester, LLMRedTeam (prompt injection) |
| A04: Insecure Design | VibeCodingAgent, AgenticSecurityAgent |
| A05: Security Misconfiguration | ConfigAuditor, CICDScanner |
| A06: Vulnerable Components | SupplyChainAudit, dependency audit |
| A07: Authentication Failures | AuthBypassAgent, APIFuzzer |
| A08: Data Integrity Failures | SupplyChainAudit, InjectionTester |
| A09: Logging & Monitoring | ExceptionHandlerAgent |
| A10: SSRF | SSRFProber |

Beyond the standard Top 10, Ship Safe also covers:

- **OWASP LLM Top 10 2025** via LLMRedTeam, MCPSecurityAgent, RAGSecurityAgent
- **OWASP Agentic AI Top 10** via AgenticSecurityAgent
- **OWASP Mobile Top 10 2024** via MobileScanner
- **OWASP CI/CD Top 10** via CICDScanner

## Scan Your Project Against OWASP 2025

\`\`\`bash
npx ship-safe audit .
\`\`\`

Every finding includes its OWASP category, CWE identifier, and a prioritized fix. The scoring engine weights findings by OWASP 2025 severity to produce a 0-100 score.

For compliance reporting, Ship Safe maps findings to SOC 2 Type II, ISO 27001:2022, and NIST AI RMF controls.

Ship fast. Ship safe.
    `.trim(),
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}
