import styles from './ComparisonTable.module.css';

type CellValue = boolean | string;

interface Row {
  feature: string;
  shipsafe: CellValue;
  semgrep: CellValue;
  snyk: CellValue;
  ghas: CellValue;
  highlight?: boolean;
}

const ROWS: Row[] = [
  { feature: 'Setup',               shipsafe: 'npx — zero config', semgrep: 'Config required',   snyk: 'Account + config',     ghas: 'GitHub repos only' },
  { feature: 'Secrets scanning',    shipsafe: true,                semgrep: 'Limited',            snyk: true,                   ghas: true },
  { feature: 'SAST (code vulns)',   shipsafe: true,                semgrep: true,                 snyk: true,                   ghas: true },
  { feature: 'Dependency CVEs',     shipsafe: true,                semgrep: false,                snyk: true,                   ghas: true },
  { feature: 'LLM / AI security',   shipsafe: true,                semgrep: false,                snyk: false,                  ghas: false,  highlight: true },
  { feature: 'MCP server scanning', shipsafe: true,                semgrep: false,                snyk: false,                  ghas: false,  highlight: true },
  { feature: 'AI agent config',     shipsafe: true,                semgrep: false,                snyk: false,                  ghas: false,  highlight: true },
  { feature: 'Vibe coding patterns',shipsafe: true,                semgrep: false,                snyk: false,                  ghas: false,  highlight: true },
  { feature: 'AI-assisted fix gen', shipsafe: true,                semgrep: false,                snyk: 'Limited',              ghas: false,  highlight: true },
  { feature: 'Fully offline',       shipsafe: true,                semgrep: 'Partial',            snyk: false,                  ghas: false },
  { feature: 'PII / GDPR checks',   shipsafe: true,                semgrep: false,                snyk: false,                  ghas: false,  highlight: true },
  { feature: 'Git history scan',    shipsafe: true,                semgrep: false,                snyk: false,                  ghas: 'Limited' },
  { feature: 'CI/CD integration',   shipsafe: true,                semgrep: true,                 snyk: true,                   ghas: true },
  { feature: 'SARIF output',        shipsafe: true,                semgrep: true,                 snyk: true,                   ghas: true },
  { feature: 'Free to use',         shipsafe: 'CLI — MIT free',    semgrep: 'Free tier',          snyk: 'Freemium',             ghas: 'GitHub Enterprise' },
];

function Cell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === true) {
    return (
      <td className={`${styles.cell} ${highlight ? styles.cellHighlight : ''}`}>
        <span className={styles.yes}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      </td>
    );
  }
  if (value === false) {
    return (
      <td className={styles.cell}>
        <span className={styles.no}>—</span>
      </td>
    );
  }
  return (
    <td className={`${styles.cell} ${highlight ? styles.cellHighlight : ''}`}>
      <span className={styles.partial}>{value}</span>
    </td>
  );
}

export default function ComparisonTable() {
  return (
    <section className={styles.section} id="compare">
      <div className="container">
        <span className="section-label">vs the alternatives</span>
        <h2>Simple, but not shallow.</h2>
        <p className="section-sub">
          Semgrep and Snyk are excellent tools — they just weren&rsquo;t built for the AI-native dev stack.
          Ship-safe covers the gaps they don&rsquo;t, without the setup tax.
        </p>

        <div className={styles.tableWrap} data-animate>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.featureCol}>Feature</th>
                <th className={`${styles.toolCol} ${styles.ourCol}`}>
                  <div className={styles.toolHeader}>
                    <span className={styles.toolBadge}>ship-safe</span>
                  </div>
                </th>
                <th className={styles.toolCol}>Semgrep</th>
                <th className={styles.toolCol}>Snyk</th>
                <th className={styles.toolCol}>GitHub<br />Advanced Security</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} className={row.highlight ? styles.highlightRow : ''}>
                  <td className={styles.featureCell}>
                    {row.highlight && (
                      <span className={styles.uniqueBadge}>unique</span>
                    )}
                    {row.feature}
                  </td>
                  <Cell value={row.shipsafe} highlight={row.highlight} />
                  <Cell value={row.semgrep} />
                  <Cell value={row.snyk} />
                  <Cell value={row.ghas} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.disclaimer}>
          Comparison reflects publicly documented capabilities as of April 2026. Semgrep and Snyk offer
          paid tiers with additional features not listed above.
        </p>
      </div>
    </section>
  );
}
