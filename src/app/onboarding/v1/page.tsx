import { Onboarding } from "@/components/onboarding/onboarding"

/**
 * The stored v1 onboarding: a new user's first canvas with the guided tour over it (see
 * components/onboarding). The current, canvas-only onboarding plays on /.
 */
export default function OnboardingV1Page() {
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden">
      <Onboarding />
    </main>
  )
}
