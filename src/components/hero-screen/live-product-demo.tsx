"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { CANVAS_AGENT_PROMPT } from "./agent-script"
import {
  backToCanvas,
  BUILT_BADGE_BUTTON,
  captureInBuildMode,
  CODEBASE,
  designSystemClip,
  focusTripCard,
  PORTAL_SCREEN,
  TRIP_CARD,
} from "./hero-demo"
import { agentDone, COMPOSER, ensureSent, openChat, panToShow, PROMPT_FIELD, scene, typePrompt } from "./hero-demo-v1"
import { HeroScreen } from "./hero-screen"

/**
 * The "Live product on canvas" showcase: the hero demo's story cut down to five steps, played in a
 * loop on one screen (the steps follow on from each other, so it's a single run, not clips):
 *
 *  1. Capture the trip card from the live app in Build Mode.
 *  2. Back to the canvas, the capture beside the Codebase frame.
 *  3. Drop the design system's Badge onto it and design with it.
 *  4. Ask the Canvas Agent to make it check in and build it (the scripted chat in agent-script.ts
 *     for CANVAS_AGENT_PROMPT builds the badge already functional).
 *  5. Open the codebase in Build Mode and tap the new badge: the stay is checked in.
 */
const STEPS = [
  "Capture an element in Build Mode",
  "Go to the canvas",
  "Edit it with a component",
  "Ask the Canvas Agent to update it",
  "Open the codebase and use it",
]

/** Same tempo as the hero demo (scripted times × 0.85). */
const PACE = 0.85

/** The screen is laid out at this desktop size and drawn scaled to fit the card. */
const LAYOUT = { width: 1280, height: 800 }

/** Share of the showcase that must be on screen before it starts playing. */
const VISIBLE_THRESHOLD = 0.4

function liveProductScript(setStep: (step: number) => void): DemoScript {
  return async (api: ScriptApi) => {
    setStep(0)
    await captureInBuildMode(api)

    setStep(1)
    await backToCanvas(api)

    setStep(2)
    await designSystemClip(api)

    setStep(3)
    await scene(api, "canvas agent", async () => {
      await focusTripCard(api)
      await typePrompt(api, TRIP_CARD, CANVAS_AGENT_PROMPT)
      await api.wait(200)
      await api.click(`${COMPOSER} button[type="submit"]`)
      await ensureSent(api, TRIP_CARD, CANVAS_AGENT_PROMPT)
      // The chat closes while it builds (the frame's badge spins); reopen it to read the summary.
      await agentDone(api, 20000)
      await api.wait(400)
      await openChat(api, TRIP_CARD)
      await api.wait(2200)
      if (api.exists(PROMPT_FIELD)) await api.press("Escape", { on: PROMPT_FIELD })
      await api.wait(300)
    })

    setStep(4)
    await scene(api, "use the new feature", async () => {
      await panToShow(api, [CODEBASE], { fx: 0.45, fy: 0.5 })
      await api.click(CODEBASE, { fx: 0.5, fy: 0.35 })
      await api.wait(350)
      await api.click('[data-cursor-id="open-build-mode"]')
      await api.find(PORTAL_SCREEN)
      // The built (and wired-up) badge swaps in on the trip card after the app's intro.
      await api.find(BUILT_BADGE_BUTTON, 9000)
      await api.wait(600)
      await api.click(BUILT_BADGE_BUTTON)
      await api.wait(2200)
    })
  }
}

export function LiveProductDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Scrolled into view (latched): the demo may start. */
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [script] = useState(() => liveProductScript(setStep))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setReady(true)
        observer.disconnect()
      },
      { threshold: VISIBLE_THRESHOLD },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn("relative overflow-hidden rounded-lg bg-mi-canvas", className)}>
      <ScaledScreen>
        <ScriptedStage script={script} pace={PACE} ready={ready} loopDelay={1500} className="min-h-0">
          <HeroScreen className="h-auto min-h-0 flex-1" start="portal" />
        </ScriptedStage>
      </ScaledScreen>
      <StepPill step={step} />
    </div>
  )
}

/** The step playing, e.g. "3/5 · Edit it with a component", re-keyed so it fades in on each change. */
function StepPill({ step }: { step: number }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-[70] -translate-x-1/2">
      <div
        key={step}
        aria-live="polite"
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#2a2a2a]/90 px-2.5 py-1 text-xs font-medium text-[#f4f4f5] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md animate-in fade-in duration-300"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-mi-lime" />
        <span className="tabular-nums text-[#a3a3a3]">
          {step + 1}/{STEPS.length}
        </span>
        {STEPS[step]}
      </div>
    </div>
  )
}

/**
 * Lays the screen out at LAYOUT (a desktop size it's designed for) and draws it scaled to the
 * card's width, keeping its aspect. The scale is registered (see lib/screen-scale) so the cursor
 * script and the canvas map pointer positions correctly.
 */
function ScaledScreen({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const host = hostRef.current
    const content = contentRef.current
    if (!host || !content) return
    const fit = () => {
      const next = host.clientWidth / LAYOUT.width
      if (!next) return
      setScreenScale(content, next)
      setScale(next)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="relative aspect-[16/10] w-full">
      <div
        ref={contentRef}
        {...{ [SCREEN_SCALE_ATTR]: "" }}
        className="absolute left-0 top-0 flex origin-top-left flex-col"
        style={{ width: LAYOUT.width, height: LAYOUT.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
