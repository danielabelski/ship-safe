'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './TrustBar.module.css';
import { formatNumber } from '@/lib/stats';

const INTEGRATIONS = [
  { label: 'GitHub Actions', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.166 6.839 9.489.5.09.682-.218.682-.484 0-.236-.009-.866-.013-1.699-2.782.602-3.369-1.34-3.369-1.34-.455-1.157-1.11-1.465-1.11-1.465-.909-.62.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.891 1.529 2.341 1.089 2.91.833.091-.647.349-1.086.635-1.337-2.22-.251-4.555-1.111-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.254-.447-1.27.097-2.646 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.748-1.025 2.748-1.025.546 1.376.202 2.394.1 2.646.64.699 1.026 1.591 1.026 2.682 0 3.841-2.337 4.687-4.565 4.935.359.307.679.917.679 1.852 0 1.335-.012 2.415-.012 2.741 0 .269.18.579.688.481C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>
  )},
  { label: 'Claude Code', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  )},
  { label: 'Node.js', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.998 24a2.96 2.96 0 01-1.479-.396L7.03 21.367c-.44-.247-.226-.334-.08-.385a8.3 8.3 0 001.67-.76.357.357 0 01.342.026l2.635 1.562c.099.054.24.054.33 0l10.26-5.922a.334.334 0 00.165-.29V7.405a.338.338 0 00-.168-.294L11.923 1.2a.333.333 0 00-.33 0L1.336 7.111a.338.338 0 00-.168.294v11.846c0 .12.064.23.165.29l2.81 1.622c1.524.762 2.457-.136 2.457-1.043V8.297a.3.3 0 01.302-.305h1.317a.3.3 0 01.3.305V19.12c0 2.042-1.112 3.21-3.047 3.21-.595 0-1.064 0-2.372-.644L.679 20.14a3.317 3.317 0 01-1.66-2.87V5.423a3.317 3.317 0 011.66-2.87L10.51.376a3.396 3.396 0 013.303 0l9.833 5.175a3.318 3.318 0 011.661 2.87v11.846a3.319 3.319 0 01-1.661 2.87l-9.833 5.175a2.962 2.962 0 01-1.815.309z"/></svg>
  )},
  { label: 'Python', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.963 3.403 5.963h2.03v-2.867s-.109-3.402 3.35-3.402h5.766s3.24.052 3.24-3.13V3.19S18.28 0 11.914 0zm-3.21 1.84a1.041 1.041 0 110 2.083 1.041 1.041 0 010-2.083z"/><path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.1s3.9.445 3.9-5.735c0-6.18-3.403-5.963-3.403-5.963H18.57v2.867s.109 3.402-3.35 3.402H9.452s-3.24-.052-3.24 3.13v5.342S5.72 24 12.086 24zm3.21-1.84a1.041 1.041 0 110-2.082 1.041 1.041 0 010 2.083z"/></svg>
  )},
  { label: 'Docker', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.483 2.408 3.139 1.182.738 3.1 1.161 5.275 1.161 1.046.002 2.09-.092 3.12-.28 1.423-.26 2.79-.795 4.024-1.582a10.355 10.355 0 002.87-2.89c1.379-1.677 2.196-3.542 2.8-5.198h.243c1.504 0 2.433-.6 2.945-1.103.317-.306.564-.68.72-1.094l.1-.307z"/></svg>
  )},
  { label: 'GitLab CI', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/></svg>
  )},
];

function useCounter(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        function tick(now: number) {
          const p = Math.min((now - start) / duration, 1);
          const ep = 1 - Math.pow(1 - p, 3);
          setCount(Math.round(ep * target));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

interface TrustBarProps {
  stars?: number;
  downloads?: number;
}

export default function TrustBar({ stars, downloads }: TrustBarProps) {
  const starsNum = stars ?? 1200;
  const downloadsNum = downloads ?? 8000;
  const { count: starsCount, ref: starsRef } = useCounter(starsNum);
  const { count: dlCount, ref: dlRef } = useCounter(downloadsNum);

  return (
    <section className={styles.trustBar}>
      <div className="container">
        <div className={styles.inner}>

          {/* Animated star count */}
          <div className={styles.stat} data-animate>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className={styles.statIcon}>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            <span ref={starsRef} className={styles.statNum}>
              ★ {formatNumber(starsCount)}
            </span>
            <span className={styles.statLabel}>GitHub stars</span>
          </div>

          <span className={styles.sep} aria-hidden="true" />

          {/* Animated download count */}
          <div className={styles.stat} data-animate data-delay="60">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.statIcon}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span ref={dlRef} className={styles.statNum}>
              {formatNumber(dlCount)}
            </span>
            <span className={styles.statLabel}>weekly downloads</span>
          </div>

          <span className={styles.sep} aria-hidden="true" />

          {/* Integration badges */}
          <div className={styles.integrations} data-animate data-delay="120">
            <span className={styles.intLabel}>Works with</span>
            {INTEGRATIONS.map((b) => (
              <span key={b.label} className={styles.badge}>
                <span className={styles.badgeIcon}>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
