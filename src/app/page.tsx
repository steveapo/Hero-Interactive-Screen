import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { EngineersSection } from "@/components/marketing/engineers-section"
import { FaqSection } from "@/components/marketing/faq-section"
import { FeatureSection, LastMileSection, ProofSection, ShareSection } from "@/components/marketing/feature-section"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* The Desktop Area with the canvas window only (no Code Changes window). The canvas loads linked
            to its repo with the GitHub Sync popover closed, and the Codebase frame opens in the Portal; see
            hero-showcase.tsx. Its "flip" load-in plays right away (no waiting to be scrolled to the
            viewport's centre): the window is drawn in, the canvas flips in, then its bars and panels. The
            previous version (rise / glide load-in) is stored at /hero/v1; the two-window version plays at
            /showcase; the four-clip demo at /demo. */}
        <HeroShowcase
          showCodeWindow={false}
          githubPopoverOpen={false}
          portalEnabled
          githubPrSheet={false}
          introOnMount
          introStyle="flip"
        />
      </SiteHero>
      <FeatureSection />
      <LastMileSection />
      <ShareSection />
      <ProofSection />
      <EngineersSection />
      <FaqSection />
      <SiteFooter />
    </main>
  )
}
