import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import TrustBar from '@/components/TrustBar';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import PricingTeaser from '@/components/PricingTeaser';
import FAQ from '@/components/FAQ';
import CTA from '@/components/CTA';
import ScrollAnimator from '@/components/ScrollAnimator';

export default function Home() {
  return (
    <>
      <ScrollAnimator />
      <Nav />
      <main>
        <Hero />
        <TrustBar />
        <HowItWorks />
        <Features />
        <PricingTeaser />
        <FAQ />
      </main>
      <CTA />
    </>
  );
}
