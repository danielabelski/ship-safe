# Ship Safe Plugin for Claude Code

Security audit your projects directly inside Claude Code. 12 agents, 50+ attack classes, zero setup.

## Install

```bash
claude plugin add github:asamassekou10/ship-safe
```

## Skills

| Command | Description |
|---------|-------------|
| `/ship-safe` | Full security audit — 12 agents, 50+ attack classes, prioritized remediation plan |
| `/ship-safe-scan` | Quick scan for leaked secrets (API keys, passwords, tokens) |
| `/ship-safe-score` | Security health score (0-100, A-F grade) |

## How It Works

These skills invoke [ship-safe](https://www.npmjs.com/package/ship-safe) via `npx`, so you always get the latest version. No API keys required — Claude Code itself interprets the results, explains findings in plain language, and can directly fix issues in your codebase.

## Examples

```
> /ship-safe
Runs full audit with 12 security agents, shows score, findings grouped
by severity, and offers to fix critical issues in your code.

> /ship-safe-scan src/
Scans src/ directory for leaked secrets and offers to move them to
environment variables.

> /ship-safe-score
Quick score check — tells you if your project is safe to ship.
```

## What Gets Scanned

- Secrets (API keys, passwords, tokens, database URLs)
- Injection vulnerabilities (SQL, NoSQL, XSS, command injection)
- Auth bypass (JWT, CSRF, OAuth, IDOR)
- SSRF (user input in HTTP clients, cloud metadata)
- Supply chain (typosquatting, wildcard versions)
- Config (Docker, Terraform, Kubernetes, CORS, CSP)
- LLM security (prompt injection, system prompt leakage)
- CI/CD (pipeline poisoning, unpinned actions)
- API (missing auth, mass assignment, GraphQL introspection)
- Dependencies (known CVEs in npm, pip, bundler)

## Requirements

- Node.js 18+
- Claude Code CLI

## Links

- [Ship Safe on npm](https://www.npmjs.com/package/ship-safe)
- [Ship Safe on GitHub](https://github.com/asamassekou10/ship-safe)
