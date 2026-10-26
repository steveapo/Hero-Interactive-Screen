"use client"

import { HeroScreen } from "@/components/hero-screen/hero-screen"
import { ONBOARDING_AGENT_PROMPT } from "@/components/hero-screen/agent-script"
import { ONBOARDING_ELEMENTS, START_FRAME_ID } from "./onboarding-elements"

/**
 * The canvas-only onboarding: a new user lands in a demo canvas whose frames are the onboarding.
 * The steps are notes, screenshots and videos on the canvas next to the live app (the Codebase
 * frame), plus a real card to edit; there's no tour or overlay, the visitor reads and tries things
 * at their own pace. The canvas opens on the "Start here" note.
 */
export function CanvasOnboarding() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <HeroScreen
        className="h-full"
        start="canvas"
        // Agents give working replies (not the sign-up reply), as in the guided onboarding.
        guided
        agentPrompt={ONBOARDING_AGENT_PROMPT}
        agentCursors={false}
        // Only the onboarding's own frames next to the Codebase frame (none of the Fairbnb app's).
        extraElements={ONBOARDING_ELEMENTS}
        elementIds={ONBOARDING_ELEMENTS.map((el) => el.id)}
        openOnId={START_FRAME_ID}
        // The step cards' scenes hold small UI: let the visitor zoom right in to read them (100%).
        maxZoom={1}
        componentLibrary="fairbnb"
      />
    </div>
  )
}
