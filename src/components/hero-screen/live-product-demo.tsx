"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { captureInBuildMode, focusTripCard, TRIP_CARD } from "./hero-demo"
import { agentDone, COMPOSER, ensureSent, openChat, panToShow, revealInList, scene, typePrompt } from "./hero-demo-v1"
import { HeroScreen, WHEEL_ZOOM_SPEED, type HeroStart } from "./hero-screen"

/*
 * The feature cards' clips. One panel = one idea: each clip plays once when it scrolls into view,
 * stops on its key moment and stays there as a still (the screen is then the visitor's to play
 * with; see ScriptedStage's `holdLastFrame`).
 *  1. "capture"       Capture the trip card from the live app → it lands on the canvas, selected.
 *  2. "visual-edits"  Select the captured card and recolour it through the settings panel's Fill.
 *  4. "build"         Send the selected frame to the Build Agent chat → its summary of the build.
 *  5. "share"         Open Share and create the preview link → "Published just now".
 */

const BACK_TO_CANVAS = 'button[aria-label="Back to canvas"]'
/** The selected frame's Fill hex in the settings panel, and the colour typed into it (a light grey). */
const FILL_HEX = 'input[aria-label="Fill hex"]'
const NEW_FILL = "#ededed"
const SHARE_BUTTON = '[data-cursor-id="share"]'
const SHARE_DIALOG = '[role="dialog"][aria-label="Preview URL"]'
const BUILD_PROMPT = "Build this frame into the codebase"

/** Share of the canvas (its larger dimension) the captured card fills once zoomed in. */
const FILL_SHARE = 0.45
/** Aim a little past FILL_SHARE, so it clears it comfortably. */
const FILL_AIM = FILL_SHARE * 1.08
/** The canvas zooms in this far here (0.4 elsewhere), so the card can fill FILL_SHARE of it. */
const MAX_ZOOM = 1.5
const CANVAS = "[data-hero-canvas]"
/** Where the card is centred across the canvas: left of the middle, clear of the settings panel. */
const FOCUS_FX = 0.4

/**
 * Real canvas zoom, as a visitor would: with the card centred, the cursor rests on it and
 * ⌘-scrolls by exactly the amount that scales the card from its current share of the canvas to
 * FILL_AIM (zoom × exp(−deltaY × WHEEL_ZOOM_SPEED)). Checks again afterwards, then pans the card
 * to FOCUS_FX, leaving room on the right for the settings panel.
 */
async function zoomToFill(api: ScriptApi) {
  await panToShow(api, [TRIP_CARD], { fx: 0.5, fy: 0.5 })
  for (let attempt = 0; attempt < 3; attempt++) {
    const card = api.boxOf(TRIP_CARD)
    const canvas = api.boxOf(CANVAS)
    if (!card || !canvas || !canvas.width || !canvas.height) return
    const share = Math.max(card.width / canvas.width, card.height / canvas.height)
    if (share >= FILL_SHARE) break
    const deltaY = -Math.log(FILL_AIM / share) / WHEEL_ZOOM_SPEED
    await api.moveTo(TRIP_CARD, { fx: 0.5, fy: 0.5 })
    await api.wheel(0, deltaY, { mods: { ctrl: true }, duration: 1100 })
    await api.wait(200)
  }
  await panToShow(api, [TRIP_CARD], { fx: FOCUS_FX, fy: 0.5 })
}

/** Select the trip card: its right side is the card itself (its text hugs the left). */
async function selectTripCard(api: ScriptApi) {
  await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
}

/** 1. Capture the trip card in Build Mode; key moment: the snapshot on the canvas, selected. */
const captureScript: DemoScript = async (api) => {
  await captureInBuildMode(api)
  await scene(api, "back to canvas", async () => {
    // The elements are already on the canvas (no entrance): just let the Portal fade out.
    await api.click(BACK_TO_CANVAS)
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    await api.wait(500)
  })
  await scene(api, "the snapshot on canvas", async () => {
    await zoomToFill(api)
    await selectTripCard(api)
    await api.wait(400)
  })
}

/** 2. Visual edits; key moment: the card takes its new Fill, the settings panel open beside it. */
const visualEditsScript: DemoScript = async (api) => {
  await scene(api, "select and recolour", async () => {
    await zoomToFill(api)
    await selectTripCard(api)
    await api.find(FILL_HEX)
    await api.wait(600)
    revealInList(api, FILL_HEX)
    // Click into the Fill hex and type over it: the card takes the colour as the last digit lands.
    await api.click(FILL_HEX)
    await api.wait(250)
    await api.type(NEW_FILL, { into: FILL_HEX, replace: true })
    await api.wait(300)
    await api.press("Enter", { on: FILL_HEX })
    await api.wait(400)
  })
}

/** 4. Send the selected frame to the Build Agent; key moment: the chat with its build summary. */
const buildScript: DemoScript = async (api) => {
  await scene(api, "send to build chat", async () => {
    await focusTripCard(api)
    await typePrompt(api, TRIP_CARD, BUILD_PROMPT)
    await api.wait(250)
    await api.click(`${COMPOSER} button[type="submit"]`)
    await ensureSent(api, TRIP_CARD, BUILD_PROMPT)
    // The chat closes while it builds (the frame's badge spins); reopen it on the summary.
    await agentDone(api, 20000)
    await api.wait(400)
    await openChat(api, TRIP_CARD)
    await api.wait(300)
  })
}

/** The Share popover's "Create Preview Link" button. */
const createPreviewLink = (api: ScriptApi) => () =>
  Array.from(api.stage.querySelectorAll(`${SHARE_DIALOG} button`)).find((el) =>
    el.textContent?.includes("Create Preview Link"),
  )

/** 5. Share; key moment: the Preview URL window, published, with Open / Copy. */
const shareScript: DemoScript = async (api) => {
  await scene(api, "share", async () => {
    await panToShow(api, [TRIP_CARD], { fx: 0.45, fy: 0.55 })
    await api.wait(300)
    await api.click(SHARE_BUTTON)
    await api.find(SHARE_DIALOG)
    await api.wait(600)
    await api.click(createPreviewLink(api))
    await api.wait(500)
    // Rest beside the window, so it reads clearly.
    await api.moveTo(SHARE_DIALOG, { fx: 0.3, fy: 1, dy: 28, duration: 600 })
  })
}

export type FeatureClipId = "capture" | "visual-edits" | "build" | "share"

const CLIPS: Record<FeatureClipId, { script: DemoScript; start: HeroStart }> = {
  capture: { script: captureScript, start: "portal" },
  "visual-edits": { script: visualEditsScript, start: "canvas" },
  // The trip card carries the designed "Check in" badge: that's what gets built.
  build: { script: buildScript, start: "designed" },
  // Built into the code, so there's a real change to share.
  share: { script: shareScript, start: "built" },
}

/** Same tempo as the hero demo (scripted times × 0.85). */
const PACE = 0.85

/** The live app is simply there in the showcase: no loading state, no intro (the Portal's default is 2s). */
const PORTAL_LOAD_MS = 0

/**
 * The screen is laid out at this desktop size and drawn scaled to fit the card. Narrower than the
 * hero's 1280px, so the UI is drawn a little larger in the card.
 */
const LAYOUT = { width: 1100, height: 688 }

/** Share of the showcase that must be on screen before it starts playing. */
const VISIBLE_THRESHOLD = 0.4

/** One feature clip (see CLIPS): plays once when scrolled into view, then holds its key moment. */
export function FeatureClip({ clip, className }: { clip: FeatureClipId; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Scrolled into view (latched): the clip may start. */
  const [ready, setReady] = useState(false)
  const { script, start } = CLIPS[clip]

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
        <ScriptedStage script={script} pace={PACE} ready={ready} loop={false} holdLastFrame className="min-h-0">
          <HeroScreen
            className="h-auto min-h-0 flex-1"
            start={start}
            portalLoadMs={PORTAL_LOAD_MS}
            maxZoom={MAX_ZOOM}
            canvasEntrance={false}
          />
        </ScriptedStage>
      </ScaledScreen>
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
