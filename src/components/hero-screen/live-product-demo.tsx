"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
import { HeroScreen, type HeroStart } from "./hero-screen"

/**
 * The "Live product on canvas" showcase: the hero demo's story cut down to five steps. Played in
 * one go, each step follows on from the last on the same screen:
 *
 *  1. Capture the trip card from the live app in Build Mode.
 *  2. Back to the canvas, the capture beside the Codebase frame.
 *  3. Drop the design system's Badge onto it and design with it.
 *  4. Ask the Canvas Agent to make it check in and build it (the scripted chat in agent-script.ts
 *     for CANVAS_AGENT_PROMPT builds the badge already functional).
 *  5. Open the codebase in Build Mode and tap the new badge: the stay is checked in.
 *
 * The step buttons below the screen jump to any step: a fresh screen opens in the state that step
 * starts from (`start`) and the run plays on from there. After the last step it starts over at 1.
 */
type Step = { label: string; start: HeroStart; run: (api: ScriptApi) => Promise<void> }

const STEPS: Step[] = [
  { label: "Capture an element in Build Mode", start: "portal", run: captureInBuildMode },
  { label: "Go to the canvas", start: "portal", run: backToCanvas },
  { label: "Edit it with a component", start: "canvas", run: designSystemClip },
  { label: "Ask the Canvas Agent to update it", start: "designed", run: askCanvasAgent },
  { label: "Open the codebase and use it", start: "wired", run: tryInCodebase },
]

/** Same tempo as the hero demo (scripted times × 0.85). */
const PACE = 0.85

/** The live app loads this fast in the showcase (the Portal's default is 2s). */
const PORTAL_LOAD_MS = 600

/**
 * The screen is laid out at this desktop size and drawn scaled to fit the card. Narrower than the
 * hero's 1280px, so the UI is drawn a little larger in the card.
 */
const LAYOUT = { width: 1100, height: 688 }

/** Share of the showcase that must be on screen before it starts playing. */
const VISIBLE_THRESHOLD = 0.4

async function askCanvasAgent(api: ScriptApi) {
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
}

async function tryInCodebase(api: ScriptApi) {
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

/** Plays the steps from `from` to the last, reporting each one as it starts. */
function scriptFrom(from: number, onStep: (step: number) => void): DemoScript {
  return async (api) => {
    for (let i = from; i < STEPS.length; i++) {
      onStep(i)
      await STEPS[i].run(api)
    }
  }
}

export function LiveProductDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Scrolled into view (latched): the demo may start. */
  const [ready, setReady] = useState(false)
  /** The step the current run started at (its screen opens in that step's state). */
  const [from, setFrom] = useState(0)
  /** Bumped on every (re)start: keys a fresh stage and screen. */
  const [take, setTake] = useState(0)
  /** The step playing now. */
  const [step, setStep] = useState(0)

  function playFrom(index: number) {
    setFrom(index)
    setStep(index)
    setTake((t) => t + 1)
  }

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
    <div ref={ref} className={cn("flex flex-col gap-[clamp(0.5rem,1vw,0.75rem)]", className)}>
      <div className="relative overflow-hidden rounded-lg bg-mi-canvas">
        <ScaledScreen>
          <div key={take} className={cn("flex min-h-0 flex-1 flex-col", take > 0 && "animate-in fade-in duration-500")}>
            <ScriptedStage
              script={scriptFrom(from, setStep)}
              pace={PACE}
              ready={ready}
              loop={false}
              loopDelay={1500}
              onFinish={() => playFrom(0)}
              className="min-h-0"
            >
              <HeroScreen className="h-auto min-h-0 flex-1" start={STEPS[from].start} portalLoadMs={PORTAL_LOAD_MS} />
            </ScriptedStage>
          </div>
        </ScaledScreen>
      </div>
      <StepControls step={step} onSelect={playFrom} />
    </div>
  )
}

/**
 * Previous / next, and one button per step: the playing step's button shows its label. Any of
 * them plays from that step.
 */
function StepControls({ step, onSelect }: { step: number; onSelect: (index: number) => void }) {
  const last = STEPS.length - 1
  return (
    <div className="flex items-center justify-center gap-1 text-[#f4f4f5]">
      <button
        type="button"
        aria-label="Previous step"
        disabled={step === 0}
        onClick={() => onSelect(step - 1)}
        className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div role="tablist" aria-label="Demo steps" className="flex min-w-0 items-center gap-1">
        {STEPS.map((s, i) => {
          const selected = i === step
          return (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${i + 1}. ${s.label}`}
              title={s.label}
              onClick={() => onSelect(i)}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center gap-2 rounded-full px-2.5 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60",
                selected ? "bg-[#f4f4f5] text-mi-ink" : "bg-white/10 text-[#d4d4d4] hover:bg-white/20",
              )}
            >
              {i + 1}
              {selected && <span className="truncate whitespace-nowrap animate-in fade-in duration-300">{s.label}</span>}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        aria-label="Next step"
        disabled={step === last}
        onClick={() => onSelect(step + 1)}
        className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="size-4" />
      </button>
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
    <div ref={hostRef} className="relative w-full" style={{ aspectRatio: `${LAYOUT.width} / ${LAYOUT.height}` }}>
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
