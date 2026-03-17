import Link from 'next/link';
import { plans } from '@/data/plans';
import styles from './PricingTeaser.module.css';

const teaserPlans = plans.filter((p) => p.name !== 'Enterprise');
const maxFeatures = 4;

export default function PricingTeaser() {
  return (
    <section className={styles.pricing} id="pricing">
      <div className="container">
        <span className="section-label">Pricing</span>
        <h2>Simple, transparent pricing.</h2>
        <p className="section-sub">
          The CLI is always free and open-source. Pay only for the cloud dashboard.
        </p>

        <div className={styles.grid}>
          {teaserPlans.map((plan, i) => (
            <div
              key={plan.name}
              className={`${styles.planCard} card ${plan.featured ? styles.featured : ''}`}
              data-animate
              data-delay={String(i * 60)}
            >
              {plan.featured && <div className={styles.popularBadge}>Most Popular</div>}
              <div className={styles.planHeader}>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>
                  <span className={styles.priceNum}>{plan.price}</span>
                  {plan.period && <span className={styles.pricePeriod}>{plan.period}</span>}
                </div>
                <p className={styles.planDesc}>{plan.desc}</p>
              </div>
              <Link
                href={plan.ctaHref}
                className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} ${styles.planCta}`}
              >
                {plan.cta}
              </Link>
              <ul className={styles.featureList}>
                {plan.features.slice(0, maxFeatures).map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
                {plan.features.length > maxFeatures && (
                  <li className={styles.featureMore}>
                    +{plan.features.length - maxFeatures} more features
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.allPlans} data-animate>
          <Link href="/pricing" className={styles.allPlansLink}>
            Compare all plans →
          </Link>
        </div>
      </div>
    </section>
  );
}
