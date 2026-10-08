"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { captureInBuildMode, TRIP_CARD } from "./hero-demo"
import { panToShow, revealInList, scene } from "./hero-demo-v1"
import { HeroScreen, WHEEL_ZOOM_SPEED } from "./hero-screen"

/**
 * The "Live product on canvas" showcase: the hero demo's opening, on a loop.
 *  1. Capture the trip card from the live app in Build Mode.
 *  2. Back to the canvas; the cursor zooms the canvas in on the captured trip card until it fills
 *     at least FILL_SHARE of the canvas, selects it (its settings panel opens) and changes its
 *     background through the panel's Fill.
 * When it ends, the screen crossfades back to the live app and it plays again.
 */
const script: DemoScript = async (api) => {
  await captureInBuildMode(api)
  await scene(api, "back to canvas", async () => {
    // The elements are already on the canvas (no entrance): just let the Portal fade out.
    await api.click(BACK_TO_CANVAS)
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    await api.wait(500)
  })
  await scene(api, "zoom to the capture", async () => {
    await zoomToFill(api)
  })
  await scene(api, "select and recolour", async () => {
    // The card's right side is the card itself (its text hugs the left), so this selects it.
    await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
    await api.find(FILL_HEX)
    await api.wait(600)
    revealInList(api, FILL_HEX)
    // Click into the Fill hex and type over it: the card takes the colour as the last digit lands.
    await api.click(FILL_HEX)
    await api.wait(250)
    await api.type(NEW_FILL, { into: FILL_HEX, replace: true })
    await api.wait(300)
    await api.press("Enter", { on: FILL_HEX })
    await api.wait(1800) // hold on it before the loop starts over
  })
}

const BACK_TO_CANVAS = 'button[aria-label="Back to canvas"]'
/** The selected frame's Fill hex in the settings panel, and the colour typed into it (a light grey). */
const FILL_HEX = 'input[aria-label="Fill hex"]'
const NEW_FILL = "#ededed"

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

export function LiveProductDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Scrolled into view (latched): the demo may start. */
  const [ready, setReady] = useState(false)

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
        <ScriptedStage script={script} pace={PACE} ready={ready} loop loopDelay={1500} className="min-h-0">
          <HeroScreen className="h-auto min-h-0 flex-1" start="portal" portalLoadMs={PORTAL_LOAD_MS} maxZoom={MAX_ZOOM} canvasEntrance={false} />
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
