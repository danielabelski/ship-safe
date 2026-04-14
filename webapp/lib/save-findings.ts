/**
 * save-findings.ts
 *
 * Upserts agent findings with deduplication by (agentId, title, location).
 * If the same finding already exists:
 *   - Updates updatedAt
 *   - Re-opens it if it was marked fixed/false_positive (regression)
 * Returns the count of new vs reopened findings.
 */
import { prisma } from '@/lib/prisma';

export interface FindingInput {
  severity:     string;
  title:        string;
  location?:    string | null;
  cve?:         string | null;
  remediation?: string | null;
}

export async function saveFindings(opts: {
  agentId:  string;
  runId:    string;
  findings: FindingInput[];
}): Promise<{ created: number; reopened: number }> {
  const { agentId, runId, findings } = opts;
  if (findings.length === 0) return { created: 0, reopened: 0 };

  let created = 0;
  let reopened = 0;

  for (const f of findings) {
    const title    = f.title    || 'Untitled finding';
    const location = f.location || null;
    const severity = f.severity || 'info';

    // Check for existing finding with same signature
    const existing = await prisma.finding.findFirst({
      where: { agentId, title, location },
      select: { id: true, status: true },
    });

    if (existing) {
      const wasResolved = existing.status === 'fixed' || existing.status === 'false_positive';
      await prisma.finding.update({
        where: { id: existing.id },
        data: {
          runId,               // link to latest run
          severity,            // update severity in case it changed
          cve:         f.cve         || null,
          remediation: f.remediation || null,
          updatedAt:   new Date(),
          ...(wasResolved && { status: 'open' }), // reopen regressions
        },
      });
      if (wasResolved) reopened++;
    } else {
      await prisma.finding.create({
        data: {
          agentId,
          runId,
          severity,
          title,
          location,
          cve:         f.cve         || null,
          remediation: f.remediation || null,
        },
      });
      created++;
    }
  }

  return { created, reopened };
}
