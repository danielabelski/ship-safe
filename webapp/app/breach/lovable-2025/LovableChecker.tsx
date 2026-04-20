'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './lovable.module.css';

interface Question {
  id: string;
  text: string;
  sub?: string;
  yesRisk: number;
}

const QUESTIONS: Question[] = [
  {
    id: 'used-before-dec',
    text: 'Did you use Lovable before December 2025?',
    sub: 'December 2025 is when Lovable switched to private-by-default across all tiers.',
    yesRisk: 1,
  },
  {
    id: 'projects-public',
    text: 'Were any of your projects set to "Public" — or were you on the free tier before May 2025?',
    sub: 'Free tier users could not create private projects before May 2025. All projects were public by default.',
    yesRisk: 2,
  },
  {
    id: 'pasted-credentials',
    text: 'Did you paste API keys, tokens, database URLs, or other credentials into the chat?',
    sub: 'This includes anything you shared to give the AI context — connection strings, API keys for integrations, service passwords.',
    yesRisk: 4,
  },
  {
    id: 'sensitive-context',
    text: 'Did your chats contain internal system details, user data references, or business-sensitive information?',
    sub: 'Internal endpoint URLs, schema details, user identifiers, business logic, or anything you would not want public.',
    yesRisk: 2,
  },
];

type Answer = 'yes' | 'no' | null;

type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

function calcRisk(answers: Record<string, Answer>): RiskLevel {
  const usedBefore = answers['used-before-dec'] === 'yes';
  const wasPublic = answers['projects-public'] === 'yes';
  const pastedCreds = answers['pasted-credentials'] === 'yes';
  const sensitiveContext = answers['sensitive-context'] === 'yes';

  if (!usedBefore || !wasPublic) return 'none';
  if (pastedCreds && sensitiveContext) return 'critical';
  if (pastedCreds) return 'high';
  if (sensitiveContext) return 'medium';
  return 'low';
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; icon: string }> = {
  none:     { label: 'No action needed',     color: 'var(--green, #22c55e)',  icon: '✓' },
  low:      { label: 'Low risk',             color: 'var(--cyan)',            icon: '◎' },
  medium:   { label: 'Medium risk',          color: '#f59e0b',               icon: '⚠' },
  high:     { label: 'High risk',            color: 'var(--red)',            icon: '!' },
  critical: { label: 'Critical — act now',  color: 'var(--red)',            icon: '!!' },
};

function RiskResult({ risk, answers }: { risk: RiskLevel; answers: Record<string, Answer> }) {
  const cfg = RISK_CONFIG[risk];
  const pastedCreds = answers['pasted-credentials'] === 'yes';
  const sensitiveContext = answers['sensitive-context'] === 'yes';

  return (
    <div className={styles.result}>
      <div className={styles.riskBadge} style={{ borderColor: cfg.color, color: cfg.color }}>
        <span className={styles.riskIcon}>{cfg.icon}</span>
        {cfg.label}
      </div>

      {risk === 'none' && (
        <p className={styles.resultDesc}>
          Based on your answers, you were either not using Lovable before the exposure window or your projects were private. No immediate action required.
        </p>
      )}

      {risk === 'low' && (
        <>
          <p className={styles.resultDesc}>
            Your projects were public during the window, but you did not paste credentials or sensitive information into chats. The main exposure is your generated code being visible - which is lower risk but worth auditing.
          </p>
          <div className={styles.actions}>
            <div className={styles.actionCard}>
              <div className={styles.actionTitle}>Audit your generated code</div>
              <p className={styles.actionDesc}>Run Ship Safe on your Lovable-generated codebase to catch hardcoded values, missing auth, and other issues from iterative AI prompting.</p>
              <pre className={styles.actionCode}><code>npx ship-safe audit .</code></pre>
            </div>
          </div>
        </>
      )}

      {(risk === 'medium' || risk === 'high' || risk === 'critical') && (
        <>
          <p className={styles.resultDesc}>
            {risk === 'critical'
              ? 'Your public chats likely contained both credentials and sensitive context. Treat this as a confirmed exposure and act immediately.'
              : risk === 'high'
              ? 'You pasted credentials into chats that were public during the exposure window. Rotate those credentials now.'
              : 'Your chats contained sensitive context that was publicly accessible. Review what was shared and take the steps below.'}
          </p>

          <div className={styles.actions}>
            {pastedCreds && (
              <div className={styles.actionCard} data-priority="high">
                <div className={styles.actionBadge}>Do this first</div>
                <div className={styles.actionTitle}>Rotate every credential you pasted into chats</div>
                <p className={styles.actionDesc}>
                  This includes API keys, tokens, database connection strings, and any secret you shared to give the AI context. If you used Vercel, our rotation wizard scans all your projects and links directly to each settings page.
                </p>
                <Link href="/rotate" className="btn btn-primary">
                  Open credential rotation wizard
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            )}

            <div className={styles.actionCard}>
              <div className={styles.actionTitle}>Audit your generated code</div>
              <p className={styles.actionDesc}>
                Lovable-generated code can contain hardcoded credentials, missing authentication, insecure API patterns, and SSRF risks that accumulate from iterative prompting. Run a full audit:
              </p>
              <pre className={styles.actionCode}><code>npx ship-safe audit .</code></pre>
            </div>

            {sensitiveContext && (
              <div className={styles.actionCard}>
                <div className={styles.actionTitle}>Review what internal context was shared</div>
                <p className={styles.actionDesc}>
                  If you discussed internal endpoint URLs, user data, schema details, or business logic in chats that were public - review those details and assess whether any operational security actions are needed.
                </p>
              </div>
            )}

            <div className={styles.actionCard}>
              <div className={styles.actionTitle}>Check your current project visibility</div>
              <p className={styles.actionDesc}>
                Log into Lovable and confirm all existing projects are set to private. Lovable switched to private-by-default in December 2025, but older projects may still have their original setting.
              </p>
              <a href="https://lovable.dev/projects" target="_blank" rel="noopener noreferrer" className={styles.actionLink}>
                Open Lovable projects →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function LovableChecker() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = QUESTIONS.every(q => answers[q.id] !== undefined && answers[q.id] !== null);
  const risk = submitted ? calcRisk(answers) : null;

  function setAnswer(id: string, val: Answer) {
    setAnswers(prev => ({ ...prev, [id]: val }));
    setSubmitted(false);
  }

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Self-audit checklist</h2>
            <p>Answer 4 questions to assess your exposure and get specific action items.</p>
          </div>

          <div className={styles.questions}>
            {QUESTIONS.map((q, i) => (
              <div key={q.id} className={styles.questionRow}>
                <div className={styles.questionLeft}>
                  <span className={styles.questionNum}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div className={styles.questionText}>{q.text}</div>
                    {q.sub && <div className={styles.questionSub}>{q.sub}</div>}
                  </div>
                </div>
                <div className={styles.questionAnswers}>
                  <button
                    className={`${styles.answerBtn} ${answers[q.id] === 'yes' ? styles.answerYes : ''}`}
                    onClick={() => setAnswer(q.id, 'yes')}
                  >
                    Yes
                  </button>
                  <button
                    className={`${styles.answerBtn} ${answers[q.id] === 'no' ? styles.answerNo : ''}`}
                    onClick={() => setAnswer(q.id, 'no')}
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={!allAnswered}
            onClick={() => setSubmitted(true)}
          >
            Assess my risk
          </button>
        </div>

        {submitted && risk && (
          <RiskResult risk={risk} answers={answers} />
        )}
      </div>
    </section>
  );
}
