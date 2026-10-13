import { HeroDemo } from "@/components/hero-screen/hero-demo"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* The interactive screen playing the end-to-end story as four short looping clips (see hero-demo.tsx).
            The stored Desktop Area showcase plays at /showcase. */}
        <HeroDemo />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
