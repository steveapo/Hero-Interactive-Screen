import { HeroShowcase } from "@/components/hero-screen/hero-showcase"
import { FeatureSection } from "@/components/marketing/feature-section"
import { SiteHero } from "@/components/marketing/site-hero"

/**
 * STORED VERSION of the homepage's interactive screen: the canvas window alone, with its original
 * load-in (the window scales up, the bars come in, the Codebase frame fades in and the elements
 * glide in around it, Layers panel open). The homepage (/) plays the reworked "flip" load-in.
 */
export default function HeroV1Page() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <SiteHero>
        <HeroShowcase showCodeWindow={false} githubPopoverOpen={false} portalEnabled githubPrSheet={false} introOnMount />
      </SiteHero>
      <FeatureSection />
    </main>
  )
}
