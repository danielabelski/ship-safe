import Link from 'next/link';
import { formatNumber } from '@/lib/stats';
import styles from './HomeRedesign.module.css';

type HomeRedesignProps = {
  stars: number;
  downloads: number;
};

const coverage = ['Secrets', 'Dependencies', 'Code vulns', 'CI/CD', 'Cloud config', 'LLM security', 'Mobile', 'Agents'];

const workflows = [
  {
    label: '01',
    title: 'Scan before you ship',
    copy: 'Run local or cloud checks across code, dependencies, secrets, config, CI/CD, AI usage, and mobile risk.',
    points: ['One-command CLI', 'Hosted scan history', 'Security score'],
  },
  {
    label: '02',
    title: 'Fix what matters',
    copy: 'Prioritize the risks that can hurt your app now, then turn them into concrete fixes and team work.',
    points: ['AI remediation guidance', 'GitHub issues', 'Finding workflow'],
  },
  {
    label: '03',
    title: 'Stay ahead of new risk',
    copy: 'Track fresh advisories, security news, Reddit, Hacker News, vendor blogs, and agent signals in one place.',
    points: ['Security Intelligence', 'Breach playbooks', 'Hermes agents'],
  },
];

const productShots = [
  {
    title: 'Scan results',
    copy: 'Prioritized findings, severity, confidence, and the context your team needs to fix the issue.',
    src: '/scan%20result.png',
  },
  {
    title: 'Security Intelligence',
    copy: 'Fresh advisories and social signals ranked against your own repos, scans, and agents.',
    src: '/app%20intelligence.png',
  },
  {
    title: 'Hermes agent teams',
    copy: 'Custom agents for deploy checks, monitoring, investigation, and security workflows.',
    src: '/Agent%20Team.png',
  },
  {
    title: 'PR Guardian',
    copy: 'Review pull requests before risky code, secrets, or config changes reach production.',
    src: '/PR%20Guardian.png',
  },
];

export default function HomeRedesign({ stars, downloads }: HomeRedesignProps) {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy} data-animate="left">
            <span className={styles.kicker}>Security for builders shipping fast</span>
            <h1>Know what is risky before you ship.</h1>
            <p>
              Ship Safe scans your code, dependencies, secrets, configs, CI/CD, LLM usage, and cloud exposure,
              then turns the results into fixes, reports, and security intelligence your team can act on.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryCta}>Start free scan</Link>
              <Link href="/docs" className={styles.secondaryCta}>View docs</Link>
            </div>
            <div className={styles.installBox} aria-label="Install Ship Safe CLI">
              <span>$</span>
              <code>npx ship-safe scan</code>
            </div>
          </div>

          <div className={styles.productPreview} data-animate="right" aria-label="Ship Safe dashboard screenshot">
            <div className={styles.browserBar}>
              <span />
              <span />
              <span />
              <strong>shipsafecli.com/app</strong>
            </div>
            <img
              src="/Dashboard.png"
              alt="Ship Safe dashboard showing scans, findings, and security status"
              className={styles.heroScreenshot}
            />
            <div className={styles.heroOverlay}>
              <span>Security Intelligence</span>
              <strong>New advisory matches your app context.</strong>
              <p>Run a targeted scan, review open findings, and rotate affected credentials.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.coverageStrip} aria-label="Ship Safe coverage">
        {coverage.map((item) => <span key={item}>{item}</span>)}
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.sectionHeader} data-animate>
          <span className={styles.kicker}>Workflows, not noise</span>
          <h2>One security loop from scan to action.</h2>
          <p>Most tools stop at findings. Ship Safe helps you decide what matters, fix it, and keep watching.</p>
        </div>
        <div className={styles.workflowGrid}>
          {workflows.map((workflow) => (
            <article key={workflow.title} className={styles.workflowCard} data-animate>
              <span className={styles.workflowLabel}>{workflow.label}</span>
              <h3>{workflow.title}</h3>
              <p>{workflow.copy}</p>
              <div>
                {workflow.points.map((point) => <span key={point}>{point}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className={`${styles.section} ${styles.demoSection}`}>
        <div className={styles.demoCopy} data-animate="left">
          <span className={styles.kicker}>Product surface</span>
          <h2>A dashboard built for security triage.</h2>
          <p>
            See active findings, recent scans, agent runs, and fresh intelligence in one operator view.
            It is designed for repeated use, not a one-time report download.
          </p>
          <ul>
            <li>Prioritized findings with severity, confidence, and remediation context.</li>
            <li>Security Intelligence mapped to your repos and recent scans.</li>
            <li>Hermes agents for monitoring, deploy checks, and custom security workflows.</li>
          </ul>
        </div>
        <div className={styles.mediaPanel} data-animate="right">
          <img src="/app%20intelligence.png" alt="Ship Safe Security Intelligence page" />
          <div>
            <span>Intelligence run</span>
            <strong>12 relevant signals ranked by urgency and relevance.</strong>
          </div>
        </div>
      </section>

      <section className={styles.productGallery} aria-label="Ship Safe product screenshots">
        {productShots.map((shot) => (
          <article key={shot.title} className={styles.productShot} data-animate>
            <img src={shot.src} alt={`${shot.title} screenshot`} />
            <div>
              <h3>{shot.title}</h3>
              <p>{shot.copy}</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.intelligenceSpotlight}>
        <div className={styles.spotlightInner}>
          <div data-animate>
            <span className={styles.kicker}>New</span>
            <h2>Security news becomes app-specific action.</h2>
            <p>
              Checking the news matters in cybersecurity. Ship Safe turns fresh incidents, CVEs, and social
              signals into ranked next steps for your own application.
            </p>
          </div>
          <div className={styles.videoFrame} data-animate>
            <video
              src="/demo%20app%20intelligence.mov"
              controls
              muted
              playsInline
              preload="metadata"
              poster="/app%20intelligence.png"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader} data-animate>
          <span className={styles.kicker}>Different by design</span>
          <h2>Built for small teams that actually ship.</h2>
        </div>
        <div className={styles.compareGrid}>
          <div className={styles.compareCard} data-animate>
            <h3>Traditional scanners</h3>
            <p>Long setup, disconnected alerts, generic severity, and findings that pile up after the release.</p>
            <span>Findings first</span>
            <span>Manual triage</span>
            <span>Separate tools</span>
          </div>
          <div className={`${styles.compareCard} ${styles.comparePrimary}`} data-animate>
            <h3>Ship Safe</h3>
            <p>One loop for scans, findings, fixes, agents, breach workflows, reports, and live security intelligence.</p>
            <span>App-specific priority</span>
            <span>Actionable next steps</span>
            <span>CLI plus dashboard</span>
          </div>
        </div>
      </section>

      <section className={styles.proofBand}>
        <div>
          <strong>{formatNumber(stars)}</strong>
          <span>GitHub stars</span>
        </div>
        <div>
          <strong>{formatNumber(downloads)}</strong>
          <span>npm downloads</span>
        </div>
        <div>
          <strong>MIT</strong>
          <span>open-source CLI</span>
        </div>
        <div>
          <strong>Local</strong>
          <span>core scans can run without sending code to an LLM</span>
        </div>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.pricingCopy} data-animate>
          <span className={styles.kicker}>Simple start</span>
          <h2>Free CLI. Cloud dashboard when you need history, teams, and automation.</h2>
          <p>
            Start with the open-source scanner. Add hosted workflows when you want reports, team review,
            agents, and Security Intelligence.
          </p>
        </div>
        <div className={styles.priceCards}>
          <div className={styles.priceCard} data-animate>
            <h3>Free CLI</h3>
            <strong>$0</strong>
            <p>Local scans, CI checks, security score, secrets, dependencies, and core app security coverage.</p>
            <img src="/demo-cli.gif" alt="Ship Safe CLI demo" className={styles.cliPreview} />
          </div>
          <div className={`${styles.priceCard} ${styles.priceFeatured}`} data-animate>
            <h3>Cloud dashboard</h3>
            <strong>Pro</strong>
            <p>Scan history, teams, reports, AI-assisted fixes, agents, and Security Intelligence.</p>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.kicker}>Ready when you are</span>
        <h2>Check your app before the next deploy.</h2>
        <div className={styles.heroActions}>
          <Link href="/signup" className={styles.primaryCta}>Start free scan</Link>
          <a href="https://github.com/asamassekou10/ship-safe" className={styles.secondaryCta}>View GitHub</a>
        </div>
      </section>
    </main>
  );
}
