import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* A single showcase: the canvas with the GitHub Sync popover open (see hero-showcase.tsx). */}
        <HeroShowcase />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
