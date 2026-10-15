"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { LISTINGS } from "@/app/copy-project/airbnb-data"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { OVERVIEW_BUILD_PROMPT, PORTAL_BUILD_FRAME_PROMPT, PORTAL_TURNS } from "./agent-script"
import { captureInBuildMode, CODEBASE, TRIP_CARD } from "./hero-demo"
import {
  agentDone,
  COMPOSER,
  ensureSent,
  moveOverCanvas,
  openChat,
  panToShow,
  PORTAL_FIELD,
  PROMPT_FIELD,
  scene,
  textOf,
  typePrompt,
} from "./hero-demo-v1"
import { HeroScreen, WHEEL_ZOOM_SPEED, type HeroStart } from "./hero-screen"

/*
 * The feature cards' clips. One panel = one idea, each its own scenario: a clip plays once when it
 * scrolls into view, stops on its key moment and stays there as a still (the screen is then the
 * visitor's to play with; see ScriptedStage's `holdLastFrame`).
 *  0. "overview"      Everything in one place: starts on the canvas, the familiar ground: select the
 *                     trip card's frame and give it a new fill, ask the frame's Build Agent to
 *                     update the app with it, then open the Codebase frame in Build Mode → the
 *                     live app, running from the code, with the card's new background.
 *  1. "capture"       Live product on canvas: capture the trip card from the live app → back on a
 *                     calm canvas (just the Codebase frame), the captured card glides in and is
 *                     selected, editable.
 *  2. "visual-edits"  Controls, not prompts: drag the Check-in Banner's corner-radius thumb on the
 *                     canvas → rounded corners, the panel's Corner radius following along.
 *  3. "test"          Test the real thing: click through the live app in Build Mode while the
 *                     Viewport menu takes it from desktop to tablet to mobile → the phone layout.
 *  4. "build"         Canvas to code: the trip card's frame (with its designed badge) is added to
 *                     the Build Mode agent and built → the badge in the live app, 1:1 as designed.
 *  5. "share"         Collaborate and ship: with the change live in the Codebase frame, open Share
 *                     and create the preview link → the Preview URL window, published.
 */

const BACK_TO_CANVAS = 'button[aria-label="Back to canvas"]'
const CHECK_IN_BANNER = '[data-cursor-id="frame-check-in-tile"]'
const RADIUS_THUMB = `${CHECK_IN_BANNER} [data-cursor-id="radius-top-left"]`
const CORNER_RADIUS_FIELD = '[aria-label="Corner radius"]'
const SHARE_BUTTON = '[data-cursor-id="share"]'
const SHARE_DIALOG = '[role="dialog"][aria-label="Preview URL"]'

/* Build Mode and its agent (the Portal). */
const OPEN_BUILD_MODE = '[data-cursor-id="open-build-mode"]'
const PORTAL_SCREEN = "[data-portal-screen]"
const PORTAL_MESSAGES = '[data-cursor-id="portal-chat-messages"]'
/** The settings panel's editable Fill hex (a selected app frame). */
const FILL_HEX = 'input[aria-label="Fill hex"]'
/** The trip card's new fill in the overview: a soft tint of the brand plum. */
const OVERVIEW_FILL = "#f6e9f3"
/** The agent chat's "Add canvas frame" menu, and the trip card's frame in it. */
const ADD_CANVAS_FRAME = 'button[aria-label="Add canvas frame"]'
const TRIP_CARD_OPTION = '[data-cursor-id="portal-frame-card-upcoming-trip"]'
/** The built badge on the trip card in the live app. */
const BUILT_BADGE = '[data-cursor-id="built-component"]'
/** The trip card's built background in the live app (its flash, over the card). */
const BUILT_FILL = '[data-cursor-id="built-fill"]'
/** "Worked for …" of the build turn: shows once its reply is done. */
const BUILD_DONE = PORTAL_TURNS.find((t) => t.prompt === PORTAL_BUILD_FRAME_PROMPT)?.workedFor ?? "Worked for"

/** The Portal chat's send button. */
const portalSend = (api: ScriptApi) => () =>
  api.stage.querySelector(PORTAL_FIELD)?.closest("form")?.querySelector('button[type="submit"]')

/** Select the Codebase frame and open it in Build Mode. */
async function openBuildMode(api: ScriptApi) {
  await api.click(CODEBASE, { fx: 0.5, fy: 0.35 })
  await api.wait(350)
  await api.click(OPEN_BUILD_MODE)
  await api.find(PORTAL_SCREEN)
}

/**
 * Open the trip card frame's Build Agent chat: straight from its Build Agent button while it's
 * selected (its right side is the card itself, so nothing needs re-selecting), else by selecting it.
 */
async function openTripCardAgent(api: ScriptApi) {
  if (api.exists(PROMPT_FIELD)) return
  const button = `${TRIP_CARD} button[aria-label="Build Agent"]`
  if (!api.exists(button)) await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
  const found = await api.find(button, 1500).then(
    () => true,
    (error) => {
      if (api.aborted()) throw error
      return false
    },
  )
  if (found) {
    await api.click(button)
    await api.find(PROMPT_FIELD)
    return
  }
  await openChat(api, TRIP_CARD)
}

/**
 * 0. Everything in one place; key moment: in Build Mode, the live app running from the code with
 * the trip card's new background. It gets there from the canvas, what a new user already knows: a
 * frame selected and given a new fill in the settings panel; then the canvas's Build Agent is
 * asked to update the app with it, and the Codebase frame is opened in Build Mode to show it.
 */
const overviewScript: DemoScript = async (api) => {
  await scene(api, "the canvas", async () => {
    await api.wait(400)
  })
  await scene(api, "a visual edit", async () => {
    await zoomToFill(api, TRIP_CARD)
    // Its right side is the card itself (its text hugs the left), so this selects it.
    await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
    await api.find(FILL_HEX)
    await api.wait(450)
    await api.click(FILL_HEX)
    await api.type(OVERVIEW_FILL, { into: FILL_HEX, replace: true })
    await api.press("Enter", { on: FILL_HEX })
    await api.wait(900)
  })
  await scene(api, "ask the build agent", async () => {
    // The card is still selected: open its Build Agent, ask it to update the app, wait for the build.
    await openTripCardAgent(api)
    await typePrompt(api, TRIP_CARD, OVERVIEW_BUILD_PROMPT)
    await api.wait(250)
    await api.click(`${COMPOSER} button[type="submit"]`)
    await ensureSent(api, TRIP_CARD, OVERVIEW_BUILD_PROMPT)
    // The chat closes while it builds (the frame's badge spins); reopen it to read the summary.
    await agentDone(api, 20000)
    await api.wait(300)
    await openTripCardAgent(api)
    await api.wait(2000)
    if (api.exists(PROMPT_FIELD)) await api.press("Escape", { on: PROMPT_FIELD })
    await api.wait(300)
  })
  await scene(api, "into the codebase", async () => {
    await zoomOutTo(api, CODEBASE, CODEBASE_SHARE)
    await api.wait(300)
    await openBuildMode(api)
    // The trip card repaints with the built background, with a blue flash.
    await api.find(BUILT_FILL, 6000)
    await api.wait(400)
    // Rest beside the updated card.
    await api.moveTo(BUILT_FILL, { fx: 0.5, fy: 1, dy: 40, duration: 800 })
  })
}

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
 * Real canvas zoom, as a visitor would: with the frame (`target`) centred, the cursor rests on it
 * and ⌘-scrolls by exactly the amount that scales it from its current share of the canvas to
 * FILL_AIM (zoom × exp(−deltaY × WHEEL_ZOOM_SPEED)). Checks again afterwards, then pans it to
 * FOCUS_FX, leaving room on the right for the settings panel.
 */
async function zoomToFill(api: ScriptApi, target: string) {
  await panToShow(api, [target], { fx: 0.5, fy: 0.5 })
  for (let attempt = 0; attempt < 3; attempt++) {
    const frame = api.boxOf(target)
    const canvas = api.boxOf(CANVAS)
    if (!frame || !canvas || !canvas.width || !canvas.height) return
    const share = Math.max(frame.width / canvas.width, frame.height / canvas.height)
    if (share >= FILL_SHARE) break
    const deltaY = -Math.log(FILL_AIM / share) / WHEEL_ZOOM_SPEED
    await api.moveTo(target, { fx: 0.5, fy: 0.5 })
    await api.wheel(0, deltaY, { mods: { ctrl: true }, duration: 1100 })
    await api.wait(200)
  }
  await panToShow(api, [target], { fx: FOCUS_FX, fy: 0.5 })
}

/** Share of the canvas's width the Codebase frame takes once zoomed back out to it. */
const CODEBASE_SHARE = 0.55

/**
 * Zoom back out (⌘-scroll over the canvas) until `target` takes `share` of the canvas's width, by
 * exactly that amount (zoom × exp(−deltaY × WHEEL_ZOOM_SPEED)), then centre it.
 */
async function zoomOutTo(api: ScriptApi, target: string, share: number) {
  await moveOverCanvas(api)
  const frame = api.boxOf(target)
  const canvas = api.boxOf(CANVAS)
  if (frame && canvas && canvas.width) {
    const current = frame.width / canvas.width
    if (current > share) {
      await api.wheel(0, Math.log(current / share) / WHEEL_ZOOM_SPEED, { mods: { ctrl: true }, duration: 900 })
      await api.wait(200)
    }
  }
  await panToShow(api, [target], { fx: 0.45, fy: 0.5 })
}

/**
 * 1. Live product on canvas; key moment: the captured trip card on the canvas, selected and
 * editable. The canvas holds only the Codebase frame, so the card gliding in after the capture is
 * the one thing that changes.
 */
const captureScript: DemoScript = async (api) => {
  await captureInBuildMode(api)
  await scene(api, "back to canvas", async () => {
    await api.click(BACK_TO_CANVAS)
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    // The captured card glides in beside the Codebase frame.
    await api.wait(2300)
  })
  await scene(api, "the snapshot on canvas", async () => {
    await zoomToFill(api, TRIP_CARD)
    // Its right side is the card itself (its text hugs the left), so this selects it.
    await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
    await api.wait(400)
  })
}

/**
 * 2. Controls, not prompts; key moment: the Check-in Banner with rounded corners, made by dragging
 * its radius thumb on the canvas, while the settings panel's Corner radius follows.
 */
const visualEditsScript: DemoScript = async (api) => {
  await scene(api, "round the corners", async () => {
    await zoomToFill(api, CHECK_IN_BANNER)
    await api.click(CHECK_IN_BANNER, { fx: 0.8, fy: 0.5 })
    await api.find(RADIUS_THUMB)
    await api.wait(600)
    // Drag the top-left thumb diagonally inward: the radius grows by the distance travelled.
    const banner = api.boxOf(CHECK_IN_BANNER)
    const thumb = api.boxOf(RADIUS_THUMB)
    if (banner && thumb) {
      const inward = Math.min(banner.width, banner.height) * 0.16
      const to = { x: thumb.left + thumb.width / 2 + inward, y: thumb.top + thumb.height / 2 + inward }
      await api.drag(RADIUS_THUMB, to, { duration: 1100 })
    }
    await api.wait(400)
    // Point at the panel's Corner radius, which followed the drag.
    if (api.exists(CORNER_RADIUS_FIELD)) await api.moveTo(CORNER_RADIUS_FIELD, { fx: 0.5, fy: 1, dy: 14, duration: 700 })
    await api.wait(300)
  })
}

/**
 * 4. Canvas to code in one shot; key moment: in Build Mode, the trip card in the live app with the
 * "Check in" badge exactly as it was designed into its frame on the canvas. The frame is added to
 * the Build Mode agent ("Add canvas frame") and built.
 */
const buildScript: DemoScript = async (api) => {
  await scene(api, "the designed frame", async () => {
    // The trip card's frame on the canvas, with the badge designed into it.
    await zoomToFill(api, TRIP_CARD)
    await api.wait(900)
  })
  await scene(api, "into build mode", async () => {
    await zoomOutTo(api, CODEBASE, CODEBASE_SHARE)
    await api.wait(300)
    await openBuildMode(api)
    await api.wait(600)
  })
  await scene(api, "add the frame and build", async () => {
    await api.click('button[aria-label="New agent"]')
    await api.wait(300)
    await api.click(ADD_CANVAS_FRAME)
    await api.find(TRIP_CARD_OPTION)
    await api.wait(350)
    await api.click(TRIP_CARD_OPTION)
    await api.wait(400)
    await api.click(PORTAL_FIELD)
    await api.type(PORTAL_BUILD_FRAME_PROMPT, { into: PORTAL_FIELD })
    await api.wait(250)
    await api.click(portalSend(api))
    await api.until(() => textOf(api, PORTAL_MESSAGES).includes(BUILD_DONE), 15000)
  })
  await scene(api, "1:1 in the live app", async () => {
    // The built badge swaps in on the trip card with a blue flash.
    await api.find(BUILT_BADGE, 6000)
    await api.wait(400)
    await api.moveTo(BUILT_BADGE, { fx: 0.5, fy: 2.2, duration: 800 })
  })
}

/** The Share popover's "Create Preview Link" button. */
const createPreviewLink = (api: ScriptApi) => () =>
  Array.from(api.stage.querySelectorAll(`${SHARE_DIALOG} button`)).find((el) =>
    el.textContent?.includes("Create Preview Link"),
  )

/**
 * 5. Collaborate and ship; key moment: the Preview URL window, published, with Open / Copy, over
 * the Codebase frame running the built change (the real thing being shared).
 */
const shareScript: DemoScript = async (api) => {
  await scene(api, "share", async () => {
    await panToShow(api, [CODEBASE], { fx: 0.45, fy: 0.55 })
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

const VIEWPORT_MENU = 'button[aria-label="Viewport"]'
const viewportOption = (id: string) => `[data-cursor-id="viewport-${id}"]`
/** The live app's screen at a viewport (see AirbnbDevice in portal-view). */
const screenAt = (viewport: string) => `[data-portal-screen][data-viewport="${viewport}"]`

/** A button in the live app at `viewport` whose text is `label`. */
const appButton = (api: ScriptApi, viewport: string, label: string) => () =>
  Array.from(api.stage.querySelectorAll(`${screenAt(viewport)} button`)).find((el) => el.textContent?.trim() === label)

/** Switch the Portal's preview to `viewport` through its Viewport menu. */
async function switchViewport(api: ScriptApi, viewport: string) {
  await api.click(VIEWPORT_MENU)
  await api.find(viewportOption(viewport))
  await api.wait(450)
  await api.click(viewportOption(viewport))
  await api.find(screenAt(viewport))
  await api.wait(700)
}

/**
 * 3. Test the real thing; key moment: the live app on a phone, a stay just saved to the wishlist.
 * In Build Mode the app is clicked through on desktop, then the Viewport menu takes it to tablet
 * and mobile, where it reflows to each breakpoint's own layout and stays live.
 */
const testScript: DemoScript = async (api) => {
  await scene(api, "desktop", async () => {
    await api.find(screenAt("desktop"))
    await api.wait(500)
    // Real components: pick a category in the live app.
    await api.click(appButton(api, "desktop", "Cabins"))
    await api.wait(700)
  })
  await scene(api, "tablet", async () => {
    await switchViewport(api, "tablet")
    await api.click(appButton(api, "tablet", "Arctic"))
    await api.wait(800)
  })
  await scene(api, "mobile", async () => {
    await switchViewport(api, "mobile")
    await api.click(appButton(api, "mobile", "Beachfront"))
    await api.wait(500)
    // Save the first stay: its heart fills with the brand plum.
    await api.click(`${screenAt("mobile")} [data-wishlist-heart="${LISTINGS[0].id}"]`)
    await api.wait(400)
    await api.moveTo(`${screenAt("mobile")} [data-wishlist-heart="${LISTINGS[0].id}"]`, { fx: -1.5, fy: 2.5, duration: 500 })
  })
}

export type FeatureClipId = "overview" | "capture" | "visual-edits" | "test" | "build" | "share"

type ClipConfig = {
  script: DemoScript
  start: HeroStart
  /** Only these app frames are on the canvas (see HeroScreen's `elementIds`). Omitted: all. */
  elementIds?: string[]
  /** Leaving Build Mode, the canvas frames glide in (see HeroScreen's `canvasEntrance`). Default off. */
  canvasEntrance?: boolean
  /** The Portal's browser window shows the live app's address (see HeroScreen's `portalShowUrl`). Default on. */
  portalShowUrl?: boolean
}

const CLIPS: Record<FeatureClipId, ClipConfig> = {
  // Opens on the canvas, around the Codebase frame.
  overview: { script: overviewScript, start: "canvas" },
  // A calm canvas: just the Codebase frame, then the captured trip card gliding in beside it.
  capture: { script: captureScript, start: "portal", elementIds: ["card-upcoming-trip"], canvasEntrance: true },
  "visual-edits": { script: visualEditsScript, start: "canvas" },
  // Opens in Build Mode, on the live app; its browser window has no address in the title bar.
  test: { script: testScript, start: "portal", portalShowUrl: false },
  // The trip card's frame carries the designed "Check in" badge: that's what gets built.
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

/**
 * A clip starts once it's fully in the viewport. Checked at a few ratios near 1, since a box drawn
 * at fractional px may never report exactly 1. A clip taller than the viewport counts as fully in
 * view once it fills the viewport's height.
 */
const VISIBLE_THRESHOLDS = [0.9, 0.95, 0.99, 1]
const FULLY_VISIBLE_RATIO = 0.99

/** One feature clip (see CLIPS): plays once when fully scrolled into view, then holds its key moment. */
export function FeatureClip({ clip, className }: { clip: FeatureClipId; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Fully scrolled into view (latched): the clip may start. */
  const [ready, setReady] = useState(false)
  const { script, start, elementIds, canvasEntrance = false, portalShowUrl = true } = CLIPS[clip]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        const fillsViewport = entry.intersectionRect.height >= window.innerHeight * FULLY_VISIBLE_RATIO
        if (entry.intersectionRatio < FULLY_VISIBLE_RATIO && !fillsViewport) return
        setReady(true)
        observer.disconnect()
      },
      { threshold: VISIBLE_THRESHOLDS },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Bumped by the reset button: remounts the stage, so the clip replays from its first frame. */
  const [runId, setRunId] = useState(0)

  return (
    <div ref={ref} className={cn("group/clip relative overflow-hidden rounded-lg bg-mi-canvas", className)}>
      <ScaledScreen>
        <ScriptedStage key={runId} script={script} pace={PACE} ready={ready} loop={false} holdLastFrame className="min-h-0">
          <HeroScreen
            className="h-auto min-h-0 flex-1"
            start={start}
            portalLoadMs={PORTAL_LOAD_MS}
            portalShowUrl={portalShowUrl}
            maxZoom={MAX_ZOOM}
            canvasEntrance={canvasEntrance}
            elementIds={elementIds}
          />
        </ScriptedStage>
      </ScaledScreen>

      {/* Reset: shown while the screen is hovered (or the button has keyboard focus). */}
      <button
        type="button"
        onClick={() => {
          setReady(true)
          setRunId((id) => id + 1)
        }}
        aria-label="Replay"
        className="absolute bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 opacity-0 shadow-[0_0_0_1px_#c9c7c3,0_4px_12px_rgba(17,17,16,0.2)] transition-opacity duration-200 hover:bg-neutral-100 focus-visible:opacity-100 group-hover/clip:opacity-100"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Replay
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
