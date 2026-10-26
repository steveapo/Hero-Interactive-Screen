import { redirect } from "next/navigation"
import { CAPTURE_PIECES } from "@/components/canvas-onboarding/onboarding-elements"

/** The capture pages start at the first step. */
export default function OnboardingStepsPage() {
  redirect(`/onboarding/steps/${CAPTURE_PIECES[0].slug}`)
}
