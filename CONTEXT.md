# ShipSafe — Full Project Context

> **For new Claude sessions.** Read this before doing anything. It covers what the product is, what's been built, how everything is wired together, and what still needs doing.

---

## What is ShipSafe?

ShipSafe is an **AI-powered security platform** with two distinct products:

1. **CLI (open-source, MIT)** — `npx ship-safe audit .` — scans a local or GitHub repo for secrets, injection flaws, CVEs, broken auth, etc. Lives at `d:/ship-safe/` root (not the webapp).

2. **Web dashboard (paid SaaS)** — `d:/ship-safe/webapp/` — a Next.js app deployed on Vercel at `shipsafecli.com`. Provides cloud scanning, AI security agents, agent teams, findings tracking, org management, and more.

The business model: CLI stays free forever, the web dashboard requires a paid plan for most features.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 App Router, TypeScript, CSS Modules |
| Database | PostgreSQL on Neon, Prisma ORM |
| Auth | Auth.js (GitHub + Google OAuth) |
| Payments | Stripe (one-time, webhook at `/api/webhook`) |
| Email | Resend (`RESEND_API_KEY`) |
| Agent runtime | Hermes CLI wrapped in Flask (Python), on a Hetzner VPS |
| Agent orchestrator | Node.js proxy on VPS port 4099 (`orchestrator-index.js`) |
| Deployment | Vercel (Hobby plan — cron limited to once/day) |
| Repo | github.com/asamassekou10/ship-safe, branch: `main` |

---

## Repository Layout

```
d:/ship-safe/
├── webapp/               ← Next.js app (THE main codebase)
│   ├── app/              ← Next.js App Router
│   │   ├── app/          ← Authenticated dashboard (/app/*)
│   │   └── api/          ← API routes
│   ├── lib/              ← Shared server utilities
│   ├── prisma/           ← schema.prisma + migrations
│   ├── public/
│   ├── vercel.json       ← Cron: "0 0 * * *" (daily, Hobby limit)
│   └── next.config.mjs
├── vps/                  ← Files deployed to VPS
│   ├── agent-wrapper.py  ← Flask SSE wrapper around hermes CLI
│   ├── agent.Dockerfile
│   └── orchestrator-index.js
└── cli/                  ← The open-source CLI (separate product)
```

---

## VPS Infrastructure

- **IP:** `5.78.197.127` — SSH as `root@5.78.197.127`
- Files live at `/root/` (not git-managed — scp'd manually)
- **Orchestrator** runs on port `4099`, handles container lifecycle
- Agent containers bind to `127.0.0.1:4100–4250`
- Docker image: `shipsafe/hermes-agent:latest`

### Deploy VPS changes:
```bash
scp vps/agent-wrapper.py root@5.78.197.127:/root/agent-wrapper.py
ssh root@5.78.197.127 "docker build -t ship-safe-agent -f /root/agent.Dockerfile /root/ && docker tag ship-safe-agent:latest shipsafe/hermes-agent:latest"
# Then restart running containers
```

---

## Environment Variables (Vercel + local .env)

```env
DATABASE_URL=                  # Neon PostgreSQL
AUTH_SECRET=                   # Auth.js secret
GITHUB_ID= / GITHUB_SECRET=    # GitHub OAuth
GOOGLE_ID= / GOOGLE_SECRET=    # Google OAuth
STRIPE_SECRET_KEY=             # Stripe
STRIPE_WEBHOOK_SECRET=         # Stripe webhook
RESEND_API_KEY=                # Email notifications
EMAIL_FROM=                    # "Ship Safe <noreply@shipsafe.dev>"
ORCHESTRATOR_URL=              # http://5.78.197.127:4099 on Vercel
ORCHESTRATOR_SECRET=           # Bearer token for orchestrator auth
CRON_SECRET=                   # Auto-set by Vercel; protects /api/cron
AGENT_TIMEOUT_MS=300000        # 5 min agent timeout
AUTH_URL=                      # https://shipsafecli.com on prod
NEXT_PUBLIC_APP_URL=           # https://shipsafecli.com
GITHUB_TOKEN=                  # Optional, for higher GitHub API rate limits
ADMIN_EMAILS=                  # Comma-separated, grants /app/admin access
```

---

## Database Schema (Prisma)

Models:
- **User** — plan: `free | pro | team | enterprise`
- **Account** — Auth.js OAuth accounts
- **Org** / **OrgMember** — team orgs with roles (owner/admin/member/viewer)
- **Scan** — cloud scans; trigger: `manual | scheduled | webhook | pr | api`
- **MonitoredRepo** — repos with optional cron schedule for auto-scanning
- **Policy** — org security policies
- **ApiKey** — scoped API keys for `/api/v1/`
- **Webhook** — outbound webhooks on scan events
- **NotificationSetting** — per-user email/Slack alert preferences
- **GitHubInstallation** — GitHub App installs
- **PRGuardianRun** / **GuardianConfig** — PR Guardian automation
- **Agent** — Hermes agent config; `orgId` for sharing (no `org` relation — look up separately)
- **Deployment** — running containers; `status: pending | running | stopped | failed`
- **AgentRun** — per-run record; self-referential RunTree (`parentRunId / childRuns`)
- **ChatMessage** — messages in an agent run
- **Finding** — security findings emitted by agents (severity: critical/high/medium/low/info)
- **Trigger** — agent triggers: `webhook | cron`
- **AgentTeam** — multi-agent team
- **AgentTeamMember** — agent + role in a team; roles: `lead | pen_tester | red_team | secrets | cve_analyst | custom`
- **TeamRun** — team execution; phases: `planning | delegating | synthesizing | done`
- **Payment** — Stripe payments
- **AuditLog** — audit trail

> **DB management:** Use `prisma db push` for dev. Do NOT run `prisma migrate dev` — the existing DB was set up with `db push` and `migrate dev` will try to reset it.

---

## All Dashboard Pages (`/app/*`)

| Route | Description |
|---|---|
| `/app` | Dashboard — scan stats, recent scans |
| `/app/scan` | New scan form (GitHub repo, Git URL, or ZIP upload) |
| `/app/scans/[id]` | Scan results viewer |
| `/app/history` | Scan history table |
| `/app/compare` | Compare two scans |
| `/app/repos` | Monitored repos with scheduled scanning |
| `/app/guardian` | PR Guardian — auto-fix/merge PRs |
| `/app/findings` | Aggregated findings dashboard across all agents |
| `/app/agents` | Agent list — create/manage Hermes agents |
| `/app/agents/new` | Create agent wizard |
| `/app/agents/[id]` | Agent detail: Chat / Deploy / Triggers / Settings tabs |
| `/app/agent-teams` | Agent Teams list |
| `/app/agent-teams/[id]` | Team detail: Members / Runs / Settings tabs |
| `/app/team-runs/[id]` | Live team run viewer (4-phase progress, hierarchical run tree) |
| `/app/team` | Org/team management |
| `/app/policies` | Security policies |
| `/app/deploy` | "Hermes Setup" — config wizard for self-hosted Hermes (unrelated to managed agents) |
| `/app/settings` | User settings, notifications, API keys, billing |
| `/app/checkout` | Post-Stripe checkout landing |
| `/app/admin` | Admin panel (restricted by `ADMIN_EMAILS`) |

---

## All API Routes

```
POST /api/scan                  — run a cloud scan
POST /api/scan/upload           — scan a ZIP upload
GET  /api/scans                 — list user's scans
GET  /api/scans/[id]            — get scan result
POST /api/scans/[id]/investigate — investigate a scan finding with an agent
GET  /api/cron                  — Vercel cron: fires agent triggers + scheduled repo scans
POST /api/webhook               — Stripe webhook
POST /api/webhooks/[id]         — outbound webhook delivery
GET  /api/agents                — list agents (own + org-shared)
POST /api/agents                — create agent
GET/PATCH/DELETE /api/agents/[id]
POST/DELETE /api/agents/[id]/share
GET  /api/agents/[id]/chat      — SSE chat stream
POST /api/trigger/[id]          — fire a webhook trigger
GET  /api/findings              — list findings
GET  /api/findings/stats        — findings stats for charts
GET/POST /api/teams             — list/create agent teams
GET/PATCH/DELETE /api/teams/[id]
GET/POST /api/teams/[id]/members
DELETE/PATCH /api/teams/[id]/members/[memberId]
POST /api/teams/[id]/run        — start a team run
GET  /api/teams/[id]/runs       — list team runs
GET  /api/team-runs/[id]        — get team run state
GET  /api/orgs                  — list user's orgs
POST /api/orgs                  — create org
GET/PATCH/DELETE /api/orgs/[id]
POST /api/orgs/[id]/invite
GET/POST /api/repos             — monitored repos
GET  /api/reports/[id]          — scan report export
POST /api/checkout              — create Stripe checkout session
GET  /api/notifications         — get notification settings
PATCH /api/notifications        — update notification settings
GET/POST /api/policies          — org policies
POST /api/fix/[id]              — AI-powered fix suggestion
POST /api/guardian              — PR Guardian webhook
GET  /api/v1/key                — API key management
GET  /api/badge/[repo]          — SVG security badge
POST /api/setup                 — generate Hermes setup command
POST /api/github/webhook        — GitHub App webhook
```

---

## Key Library Files (`webapp/lib/`)

| File | Purpose |
|---|---|
| `prisma.ts` | Prisma client singleton |
| `auth.ts` | Auth.js config (GitHub + Google) |
| `stripe.ts` | Stripe client |
| `fire-agent-run.ts` | `collectAgentRun()` — streams SSE from agent container; `fireAgentRun()` — fires + saves a single agent run |
| `run-team.ts` | `fireTeamRun()` — 4-phase team orchestration engine |
| `save-findings.ts` | Upserts findings from agent output |
| `notifications.ts` | Email (Resend) + Slack notifications for scans and agent findings |
| `audit.ts` | Writes AuditLog entries |

---

## Agent / Team Run Architecture

### Single Agent Run
1. User chats or trigger fires → `POST /api/agents/[id]/chat` or `/api/trigger/[id]`
2. `fireAgentRun()` → `collectAgentRun()` → `POST ORCHESTRATOR_URL/chat/:port`
3. Orchestrator proxies to Flask container which runs Hermes CLI
4. SSE stream: `event: token` (text chunks), `event: finding` (parsed findings), `event: tool_call/result`, `event: done` (token count)
5. Findings saved to `Finding` table; messages saved to `ChatMessage`

### Team Run (4 phases)
1. `POST /api/teams/[id]/run` creates `TeamRun`, calls `fireTeamRun()` fire-and-forget
2. **Phase 1 — Planning:** Lead agent gets target + roster, outputs `DELEGATE: {"role":"pen_tester","task":"..."}` markers
3. **Phase 2 — Delegating:** All sub-agents run in parallel via `Promise.all`, each gets their delegated task
4. **Phase 3 — Synthesizing:** Lead reads all sub-agent outputs, writes executive report
5. **Phase 4 — Done:** `TeamRun` marked completed with final report

### DELEGATE Protocol
Agent outputs `DELEGATE: {"role":"pen_tester","task":"..."}` in its response.
`agent-wrapper.py` on VPS parses these and emits `event: delegation` SSE events.
`collectAgentRun()` collects them into `delegations[]` array returned to orchestrator.

---

## Nav Structure (both desktop `NavLinks.tsx` and mobile `MobileNav.tsx`)

Both files have their own hardcoded NAV arrays — **they must be kept in sync manually.**

Current nav items (in order):
Dashboard → New Scan → Repos → PR Guardian → Agents → Agent Teams → Findings → Hermes Setup → History → Compare → Team → Policies → Settings → (Admin — conditional)

---

## Middleware Auth Protection

`webapp/middleware.ts` checks for Auth.js session cookie and redirects to `/login` if missing.

Protected route prefixes:
`/app/*`, `/api/scan/*`, `/api/scans/*`, `/api/checkout/*`, `/api/notifications/*`, `/api/orgs/*`, `/api/repos/*`, `/api/policies/*`, `/api/reports/*`, `/api/fix/*`, `/api/guardian/*`, `/api/v1/key/*`, `/api/agents/*`, `/api/findings/*`, `/api/teams/*`, `/api/team-runs/*`

---

## Vercel Cron

`vercel.json` cron schedule: `"0 0 * * *"` (daily midnight UTC — Hobby plan limit).

The `/api/cron` route:
1. Fires all enabled `Trigger` (agent cron triggers) whose expression matches
2. Fires all enabled `MonitoredRepo` whose schedule matches
3. Both protected by `CRON_SECRET` Bearer token

---

## Important Quirks / Gotchas

1. **`Agent` has no `org` Prisma relation** — it has `orgId String?` but no `org Org? @relation(...)`. Never use `include: { org: ... }` on Agent queries. Fetch org separately when needed.

2. **Windows build fails with EISDIR** — `next build` on Windows fails because webpack's enhanced-resolve calls `readlink()` inside dynamic route dirs like `[id]`. Workaround: `config.resolve.symlinks = false` in `next.config.mjs`. Not a Vercel problem — Linux builds fine.

3. **`prisma db push` only** — DB was bootstrapped with `db push`, never `migrate dev`. Running `migrate dev` will try to reset the DB. Don't do it.

4. **`ship-safe` package in `serverExternalPackages`** — excluded from webpack bundling, included via `outputFileTracingIncludes` for `/api/scan` and `/api/cron` Lambdas.

5. **Branch default is empty string** — scan form branch defaults to `""` which maps to `HEAD` in the GitHub tarball API. This handles repos using `master` or any non-`main` default branch.

6. **Vercel Hobby cron = once/day max** — don't change `vercel.json` cron back to `* * * * *` unless upgrading to Vercel Pro.

---

## Demo Setup (for recording)

Target repo: `juice-shop/juice-shop` (OWASP intentionally vulnerable Node.js app — guaranteed findings)

Pre-created agents:
- **Atlas** (role: Lead) — "Senior Security Analyst coordinating the team. Maps the full attack surface, delegates tasks to specialists, and synthesises all findings into an executive risk report."
- **Vex** (role: Pen Tester) — "Offensive security specialist focused on authentication bypasses, injection flaws, IDOR, and broken access control."
- **Cipher** (role: Secrets Scanner) — "Credentials and secrets hunter. Scans for hardcoded API keys, tokens, passwords across source code, config files, and commit history."

Team name: **Phantom Team** (Atlas as Lead, Vex + Cipher as members)

Demo flow: Scan → Findings → Deploy agent → Chat → Run team → Show report

---

## What's Done ✓

- Full landing + pricing pages
- Auth (GitHub + Google OAuth)
- Stripe payments + webhook (marks payment paid, upgrades user plan)
- Cloud scanning (GitHub repos, ZIP upload, URL)
- Scan results viewer, history, compare
- Monitored repos with cron schedules (now wired to `/api/cron`)
- PR Guardian
- Findings dashboard with severity chart + trend data
- Org/team management
- Security policies
- API keys
- Notification settings (email via Resend, Slack webhook)
- GitHub App webhook handler
- Agent Studio — full CRUD, deploy to VPS, live chat with SSE streaming
- Agent triggers — webhook + cron
- Agent sharing — share to org
- Agent Teams — full 4-phase orchestration (planning → delegating → synthesizing → done)
- Team run live viewer (auto-polls, phase progress bar, hierarchical run tree)
- Findings tab on agent detail page
- How-it-works explainers on Agents and Agent Teams pages
- Global 404 (`not-found.tsx`) and 500 (`error.tsx`) error pages
- Mobile nav (synced with desktop)

---

## What's Incomplete / Missing

- **Plan downgrade** — Settings page has no downgrade button (only upgrade path)
- **Stripe is one-time payments** — no subscription model; webhook correctly marks paid and upgrades plan, but there's no recurring billing or cancellation flow
- **Email notifications not fully tested** — Resend is wired, but delivery not verified end-to-end in prod
- **GitHub webhook handlers** — partially implemented; PR Guardian flow may need more testing
- **`/app/deploy` (Hermes Setup)** — config generator only; doesn't actually deploy anything to the VPS

---

## Run Locally

```bash
cd webapp
npx next dev --turbopack
# Runs on http://localhost:3000
```

Build (Linux/Vercel only — Windows EISDIR bug):
```bash
cd webapp
npm run build
```
