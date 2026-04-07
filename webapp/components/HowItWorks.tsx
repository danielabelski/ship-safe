import styles from './HowItWorks.module.css';

const steps = [
  {
    num: 1,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
      </svg>
    ),
    title: 'Scan for secrets',
    body: '50+ secret patterns with entropy scoring. Respects .gitignore but always checks .env, .pem, and config files.',
  },
  {
    num: 2,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Run 19 security agents',
    body: 'Injection, auth bypass, SSRF, supply chain, LLM/MCP, memory poisoning, agent config, CI/CD, and more. OWASP Agentic AI Top 10 mapped.',
  },
  {
    num: 3,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
    title: 'Audit dependencies',
    body: 'npm, yarn, pnpm, pip, bundler. Known CVEs enriched with EPSS exploit probability scores so you prioritize real risk.',
  },
  {
    num: 4,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Score & fix plan',
    body: '0–100 score across 8 OWASP 2025 categories. Prioritized remediation plan — CRITICAL first so you know exactly what to tackle.',
  },
  {
    num: 5,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    title: 'Interactive report',
    body: 'Standalone HTML report with severity filters, search, category charts, and click-to-copy ignore annotations. PR-ready.',
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.howItWorks} id="how-it-works">
      <div className="container">
        <span className="section-label">How it works</span>
        <h2>One command. Five phases.</h2>
        <p className="section-sub">
          From zero to a full security report with prioritized fixes in under 60 seconds.
        </p>

        <div className={styles.timeline}>
          {/* Connector track */}
          <div className={styles.track} aria-hidden="true">
            <div className={styles.trackFill} />
          </div>

          {steps.map((s, i) => (
            <div
              key={s.num}
              className={styles.step}
              data-animate
              style={{ '--delay': `${i * 100}ms` } as React.CSSProperties}
            >
              {/* Number node */}
              <div className={styles.node}>
                <div className={styles.nodeIcon}>{s.icon}</div>
                <span className={styles.nodeNum}>{s.num}</span>
              </div>

              {/* Content */}
              <div className={styles.stepBody}>
                <h4 className={styles.stepTitle}>{s.title}</h4>
                <p className={styles.stepDesc}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
