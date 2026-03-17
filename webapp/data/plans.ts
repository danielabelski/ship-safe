export interface Plan {
  name: string;
  price: string;
  period: string;
  desc: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
}

export const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for solo devs and open-source projects.',
    cta: 'Get started',
    ctaHref: '/signup',
    featured: false,
    features: [
      '5 cloud scans per month',
      'Public repos via GitHub URL',
      'All 16 security agents',
      '80+ attack classes',
      'HTML report viewer',
      'Full CLI (unlimited, local)',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    desc: 'For developers who ship fast and need full coverage.',
    cta: 'Start Pro free',
    ctaHref: '/signup?plan=pro',
    featured: true,
    features: [
      'Unlimited cloud scans',
      'Private repos (GitHub, GitLab, upload)',
      'All 16 security agents',
      'AI deep analysis (no API key needed)',
      'Scan history + score trends',
      'PDF reports (branded)',
      'API access for CI/CD webhooks',
      'Email notifications',
      'Priority support',
    ],
  },
  {
    name: 'Team',
    price: '$49',
    period: 'per seat / month',
    desc: 'For teams that need collaboration and shared visibility.',
    cta: 'Start Team free',
    ctaHref: '/signup?plan=team',
    featured: false,
    features: [
      'Everything in Pro',
      'Shared team workspace',
      'Role-based access (owner, admin, viewer)',
      'Slack + webhook notifications',
      'GitHub App (PR comments + checks)',
      'Aggregate team security score',
      'Audit log',
      'Dedicated support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'On-premise, SSO, SLA, and custom policies.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@shipsafe.dev',
    featured: false,
    features: [
      'Everything in Team',
      'On-premise deployment',
      'SSO / SAML',
      'Custom security policies',
      'SLA & dedicated support',
      'Volume pricing',
    ],
  },
];

export const pricingFaq = [
  {
    q: 'Is the CLI always free?',
    a: 'Yes. The CLI is MIT open-source and will always be free. You can run unlimited scans locally on any repo. The paid plans are for the hosted web dashboard, cloud scans, team features, and AI analysis without needing your own API key.',
  },
  {
    q: 'What counts as a cloud scan?',
    a: 'A cloud scan is when you submit a repo through the web dashboard for scanning. Running the CLI locally never counts against any limit.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel anytime from your account settings. Your plan stays active until the end of the billing period.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Pro and Team plans include a 14-day free trial. No credit card required.',
  },
];
