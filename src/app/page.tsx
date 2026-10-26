import { CanvasOnboarding } from "@/components/canvas-onboarding/canvas-onboarding"

/**
 * Onboarding workspace: a new user lands in a demo canvas whose frames are the onboarding itself
 * (see components/canvas-onboarding). The previous guided-tour onboarding is stored at
 * /onboarding/v1; the previous homepage hero (HeroShowcase) is still used by /showcase.
 */
export default function Home() {
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden">
      <CanvasOnboarding />
    </main>
  )
}
