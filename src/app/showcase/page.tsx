import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

/**
 * STORED VERSION of the homepage: the hero's Desktop Area showcase (the canvas with the GitHub Sync
 * popover open, plus the Code Changes window; see hero-showcase.tsx). The homepage (/) plays the
 * four-clip hero demo again (hero-demo.tsx).
 */
export default function ShowcasePage() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        <HeroShowcase />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
