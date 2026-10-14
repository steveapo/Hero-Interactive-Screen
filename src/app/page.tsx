import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { FeatureSection, LastMileSection, ShareSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* The Desktop Area with the canvas window only (no Code Changes window). The canvas loads linked
            to its repo with the GitHub Sync popover open, and the Codebase frame opens in the Portal; see
            hero-showcase.tsx. The two-window version plays at /showcase; the four-clip demo at /demo. */}
        <HeroShowcase showCodeWindow={false} portalEnabled githubPrSheet={false} />
      </SiteHero>
      <FeatureSection />
      <LastMileSection />
      <ShareSection />
    </main>
  )
}
