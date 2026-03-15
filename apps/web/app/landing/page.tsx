// Landing Page - Public product introduction + beta signup
// v2.2 - Expanded product content + file decomposition

'use client';

import { useLandingAnalytics } from './use-landing-analytics';
import { HeroSection } from './sections/hero';
import { ProblemSection } from './sections/problem';
import { ClosedLoopSection } from './sections/closed-loop';
import { ProvenCapabilitiesSection } from './sections/proven-capabilities';
import { CapabilitiesSection } from './sections/capabilities';
import { ValueTimelineSection } from './sections/value-timeline';
import { RolesSection } from './sections/roles';
import { ParadigmSection } from './sections/paradigm';
import { SignupSection } from './sections/signup';
import { Footer, ShareButton } from './sections/footer';

export default function LandingPage() {
  const { track } = useLandingAnalytics();

  return (
    <main className="min-h-screen">
      <HeroSection />
      <ProblemSection />
      <ClosedLoopSection />
      <ProvenCapabilitiesSection />
      <CapabilitiesSection />
      <ValueTimelineSection />
      <RolesSection />
      <ParadigmSection />
      <SignupSection track={track} />
      <Footer />
      <ShareButton onShare={() => track('share_click')} />
    </main>
  );
}
