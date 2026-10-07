import { HeroDemo } from "@/components/hero-screen/hero-demo"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        {/* The scripted end-to-end demo (see hero-demo.tsx); recorded takes still live on /screen. */}
        <HeroDemo />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
