import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* The Desktop Area with the canvas window only (no Code Changes window; see hero-showcase.tsx).
            The two-window version plays at /showcase; the four-clip demo at /demo. */}
        <HeroShowcase showCodeWindow={false} />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
