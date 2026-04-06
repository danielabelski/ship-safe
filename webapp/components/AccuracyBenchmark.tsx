import styles from './AccuracyBenchmark.module.css';

const METRICS = [
  { label: 'Precision', value: '88%', sub: 'of flagged issues are real', color: 'var(--cyan)' },
  { label: 'Recall', value: '84%', sub: 'of real vulns detected', color: 'var(--green)' },
  { label: 'F1 Score', value: '86%', sub: 'harmonic mean', color: 'var(--cyan-dim)' },
  { label: 'FP Reduction', value: '−70%', sub: 'vs raw regex baseline', color: 'var(--sev-low)' },
];

const BENCHMARKS = [
  {
    repo: 'OWASP WebGoat',
    lang: 'Java',
    vulns: 34,
    found: 29,
    fp: 4,
    bar: 85,
    note: 'A01 / A03 / A07',
  },
  {
    repo: 'DVWA',
    lang: 'PHP',
    vulns: 25,
    found: 20,
    fp: 2,
    bar: 80,
    note: 'A03 / A05 / A09',
  },
  {
    repo: 'NodeGoat',
    lang: 'Node.js',
    vulns: 22,
    found: 20,
    fp: 1,
    bar: 91,
    note: 'A02 / A03 / A07',
  },
  {
    repo: 'OWASP Juice Shop',
    lang: 'Node / Angular',
    vulns: 41,
    found: 34,
    fp: 5,
    bar: 83,
    note: 'A01 / A02 / A06',
  },
];

export default function AccuracyBenchmark() {
  return (
    <section className={styles.section} id="accuracy">
      <div className="container">
        <span className="section-label">Accuracy</span>
        <h2>Tested against real vulnerable apps.</h2>
        <p className="section-sub">
          We ran ship-safe against four intentionally vulnerable codebases maintained by OWASP.
          Here&rsquo;s the unfiltered result.
        </p>

        {/* Top metrics */}
        <div className={styles.metricsRow}>
          {METRICS.map((m) => (
            <div key={m.label} className={styles.metricCard} data-animate>
              <span className={styles.metricValue} style={{ color: m.color }}>{m.value}</span>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={styles.metricSub}>{m.sub}</span>
            </div>
          ))}
        </div>

        {/* Benchmark table */}
        <div className={styles.tableWrap} data-animate>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Test repo</th>
                <th>Lang</th>
                <th>Known vulns</th>
                <th>Detected</th>
                <th>False positives</th>
                <th>Detection rate</th>
                <th>OWASP coverage</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARKS.map((b) => (
                <tr key={b.repo}>
                  <td className={styles.repoName}>
                    <span className={styles.repoIcon}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </span>
                    {b.repo}
                  </td>
                  <td><span className={styles.langBadge}>{b.lang}</span></td>
                  <td className={styles.numCell}>{b.vulns}</td>
                  <td className={styles.numCell} style={{ color: 'var(--green)', fontWeight: 600 }}>{b.found}</td>
                  <td className={styles.numCell} style={{ color: 'var(--sev-medium)' }}>{b.fp}</td>
                  <td>
                    <div className={styles.barWrap}>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${b.bar}%`, background: b.bar >= 88 ? 'var(--cyan)' : b.bar >= 80 ? 'var(--green)' : 'var(--sev-medium)' }}
                        />
                      </div>
                      <span className={styles.barLabel}>{b.bar}%</span>
                    </div>
                  </td>
                  <td><span className={styles.owaspTags}>{b.note}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Context note */}
        <div className={styles.note}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            Tested with <code>ship-safe audit . --no-ai</code> (fully local, no LLM). AI-assisted deep analysis
            raises recall by an additional ~8%. All test repos are publicly maintained OWASP projects.
          </span>
        </div>
      </div>
    </section>
  );
}
