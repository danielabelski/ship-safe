import type { Metadata } from 'next';
import Providers from './providers';
import AuroraBackground from '@/components/AuroraBackground';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Ship Safe — AI-Powered Security Scanner for Developers',
    template: '%s | Ship Safe',
  },
  description: 'Scan your codebase for secrets, vulnerabilities, and dependency CVEs with 18 AI security agents. Get a 0-100 security score in seconds. Free CLI, no signup required.',
  metadataBase: new URL('https://www.shipsafecli.com'),
  keywords: ['security scanner', 'code security', 'secret detection', 'vulnerability scanner', 'OWASP 2025', 'AI security', 'LLM security', 'DevSecOps', 'application security', 'dependency CVE scanner', 'open source security tool'],
  alternates: {
    canonical: 'https://www.shipsafecli.com',
  },
  openGraph: {
    title: 'Ship Safe — AI-Powered Security Scanner for Developers',
    description: '18 AI security agents scan your codebase for secrets, vulnerabilities, and CVEs in one command. Free and open source.',
    type: 'website',
    url: 'https://www.shipsafecli.com',
    siteName: 'Ship Safe',
    images: [{ url: 'https://www.shipsafecli.com/api/og', width: 1200, height: 630, alt: 'Ship Safe - AI-Powered Security Scanner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ship Safe — AI-Powered Security Scanner for Developers',
    description: '18 AI security agents scan your codebase for secrets, vulnerabilities, and CVEs in one command. Free and open source.',
    images: ['https://www.shipsafecli.com/api/og'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuroraBackground />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
