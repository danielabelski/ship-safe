import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Ship Safe account. Get access to cloud scanning, scan history, team collaboration, and security reports.',
  alternates: {
    canonical: 'https://www.shipsafecli.com/signup',
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
