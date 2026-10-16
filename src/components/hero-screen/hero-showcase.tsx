"use client"

import Image from "next/image"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { CodeChangesPanel } from "./code-changes-popover"
import { trackDrag } from "./drag"
import { HeroScreen, type LoadIntro } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

type WindowId = "main" | "secondary"

/** Load-in: "waiting" until the Desktop Area is centred in the viewport, then "play" (once). */
type IntroPhase = "waiting" | "play"

/**
 * The load-in plays once the Desktop Area's vertical centre has scrolled up to this fraction of
 * the viewport's height (0.5 = the middle), i.e. the window is fully in place.
 */
const INTRO_CENTER_AT = 0.5

/**
 * The Canvas window shows the product as on a larger screen: its contents are laid out this much
 * bigger and drawn back down to fit. The canvas keeps its composition (it scales with its width);
 * the bars, panels and labels come out proportionally as slim as in the real product, instead of
 * a desktop-sized UI crammed into a ~1000px window.
 */
const CANVAS_DENSITY = 0.85

/**
 * The load-in, in ms from when it starts. Each step begins as the one before it is settling, so
 * the sequence reads as one continuous build-up:
 *   1. the empty Desktop Area, on its own for a beat
 *   2. the empty Canvas window opens (scales up from 85%, fades in, rises 20px)
 *   3. the bars and tools come in, one after another
 *   4. the Codebase frame fades in; its live app's own opening plays on through the next step
 *   5. the GitHub Sync popover opens
 *   6. the canvas elements glide in around the Codebase frame, and at the same time the Code
 *      Changes window opens (as the Canvas window did) and its diff streams in row by row
 */
/** Pace of the whole load-in: every step's time (and the windows' opening) is scaled by this. 0.512 = 20% faster, three times over. */
const INTRO_TIME_SCALE = 0.512
const INTRO = {
  canvasWindowAt: 400 * INTRO_TIME_SCALE,
  chromeAt: 950 * INTRO_TIME_SCALE,
  codebaseAt: 1700 * INTRO_TIME_SCALE,
  githubAt: 2500 * INTRO_TIME_SCALE,
  elementsAt: 3000 * INTRO_TIME_SCALE,
  /** Opens together with the canvas elements' entrance. */
  codeWindowAt: 3000 * INTRO_TIME_SCALE,
}
/** How long a window takes to open (ms). */
const WINDOW_OPEN_MS = 700 * INTRO_TIME_SCALE
/**
 * The Code Changes window's whole animation (its opening, and its diff rows' reveal) plays at 55%
 * of the Canvas window's speed (45% slower): every duration, gap and offset of it lasts 1 / 0.55×.
 */
const CODE_WINDOW_TIME_SCALE = 1 / 0.55
const CODE_WINDOW_OPEN_MS = WINDOW_OPEN_MS * CODE_WINDOW_TIME_SCALE
/** The canvas elements' entrance (its sweep of delays and each glide) plays 20% faster than leaving the Portal's. */
const ELEMENTS_TIME_SCALE = 0.8
/** The diff rows start coming in once the Code Changes window is mostly open (at its slower pace). */
const CODE_LINES_AT = INTRO.codeWindowAt + 450 * INTRO_TIME_SCALE * CODE_WINDOW_TIME_SCALE

/**
 * The "flip" load-in (the homepage), in ms from when it starts. Every step is mounted (hidden) from
 * the start, and the load-in only starts PRELOAD_MS after mount (and once the fonts and wallpaper
 * have loaded), so each step has been loaded for well over a second before it shows. Each step
 * starts as the one before it lands:
 *   1. the Canvas window is drawn in: its outline traces once round it, then the window fills in
 *      inside the closed outline (DRAW_IN)
 *   2. the Codebase frame flips down onto the screen from above; once it has landed, the canvas
 *      elements follow, top of the canvas first, slowly
 *   3. as the last elements settle, the bars come in from their own edges (top bar from the top,
 *      the sidebar rail from the left, the zoom readout from the bottom)
 *   4. the two side panels move in (the Components library grows out of the sidebar rail, the trip
 *      card's settings slide in from the right) and their contents appear one by one
 * It's interactive throughout: whatever has come in can already be pressed, dragged and panned.
 */
const FLIP_INTRO = {
  codebaseAt: 1750,
  elementsAt: 2850,
  chromeAt: 5300,
  panelsAt: 6300,
  githubAt: 7500,
}
/** The window's draw-in (ms): the outline traces round; once it has closed, the window fills in. */
const DRAW_IN = {
  outlineMs: 1000,
  fillAt: 1000,
  fillMs: 700,
}
/** The "flip" load-in starts at least this long after mount (ms), with everything loaded by then. */
const PRELOAD_MS = 1000
/** Don't hold the load-in back more than this for the wallpaper (ms). */
const WALLPAPER_TIMEOUT_MS = 3000

/**
 * A window on the Desktop Area: rounded, with a shadow; positioned by its `placement` classes.
 * No CSS border here: a border on the clipping box thins out and turns jagged at the corners where
 * the content is clipped. The outline is the first shadow instead: a solid 1px #c9c7c3 ring just
 * outside the clipped edge, so it never blends with the content or the wallpaper.
 */
const DESKTOP_WINDOW =
  "absolute flex flex-col overflow-hidden rounded-xl shadow-[0_0_0_1px_#c9c7c3,0_24px_60px_-20px_rgba(17,17,16,0.35),0_2px_6px_rgba(17,17,16,0.08)]"

/**
 * The homepage hero's showcase: a "Desktop Area" holding two windows.
 * - Main: the canvas (the interactive screen). Frames can be selected and moved, but the Portal
 *   never opens from it (no double-click into the Codebase frame, no "Open Build Mode").
 * - Secondary: the code diff, open as a window of its own.
 * Pressing anywhere in a window focuses it and brings it to the front (the other one goes behind,
 * its traffic lights turning grey); dragging a window's title bar moves it around the desktop.
 *
 * Load-in, once the Desktop Area scrolls into view: see INTRO.
 */
export function HeroShowcase({
  className,
  showCodeWindow = true,
  showGithubPopover = true,
  githubPopoverOpen = true,
  portalEnabled = false,
  githubPrSheet = true,
  introOnMount = false,
  introStyle = "rise",
}: {
  className?: string
  /**
   * How the showcase loads in. "rise" (default, the stored v1): the Canvas window scales up into
   * place and the canvas glides in (see INTRO). "flip": the window is drawn in and the canvas
   * flips in, then its bars and panels (see FLIP_INTRO).
   */
  introStyle?: "rise" | "flip"
  /**
   * The load-in plays as soon as the showcase mounts, instead of waiting for the Desktop Area to be
   * scrolled to the viewport's centre (INTRO_CENTER_AT). Only read on mount.
   */
  introOnMount?: boolean
  /** With `showGithubPopover`, whether the GitHub Sync popover opens. Off: the repo stays linked, popover closed. */
  githubPopoverOpen?: boolean
  /** The GitHub popover's "View on Github" opens the pull request sheet. Off: it does nothing but show a hint. */
  githubPrSheet?: boolean
  /** Whether the secondary Code Changes window is on the desktop. Without it, only the canvas window shows (focused). */
  showCodeWindow?: boolean
  /** Whether the canvas opens linked to its repo with the GitHub Sync popover open (see HeroScreen's githubSyncOpen). */
  showGithubPopover?: boolean
  /** Whether the Codebase frame opens in the Portal (double-click it, or "Open Build Mode"). See HeroScreen's portalEnabled. */
  portalEnabled?: boolean
}) {
  /** Front to back: the first is the focused window. */
  const [stack, setStack] = useState<WindowId[]>(showCodeWindow ? ["secondary", "main"] : ["main"])
  const focus = (id: WindowId) => setStack((s) => (s[0] === id ? s : [id, ...s.filter((w) => w !== id)]))

  const desktopRef = useRef<HTMLDivElement>(null)
  const [intro, setIntro] = useState<IntroPhase>("waiting")

  // "flip": the load-in waits until everything it shows is loaded: at least PRELOAD_MS after mount
  // (the whole screen is mounted, hidden, from the start), the fonts, and the wallpaper (or
  // WALLPAPER_TIMEOUT_MS). The "rise" load-in starts as before.
  const preloadGate = introStyle === "flip"
  const [preloaded, setPreloaded] = useState(!preloadGate)
  const [wallpaperReady, setWallpaperReady] = useState(!preloadGate)
  useEffect(() => {
    if (!preloadGate) return
    let cancelled = false
    const minimum = new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_MS))
    const fonts = document.fonts ? document.fonts.ready.then(() => undefined, () => undefined) : Promise.resolve()
    Promise.all([minimum, fonts]).then(() => {
      if (!cancelled) setPreloaded(true)
    })
    const giveUp = setTimeout(() => setWallpaperReady(true), WALLPAPER_TIMEOUT_MS)
    return () => {
      cancelled = true
      clearTimeout(giveUp)
    }
    // Only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const ready = preloaded && wallpaperReady

  useEffect(() => {
    if (!ready) return
    // Played on mount: no waiting for the Desktop Area to scroll to the viewport's centre.
    if (introOnMount) {
      // Started on a fresh frame, so its first animation frame isn't shared with other work.
      const frame = requestAnimationFrame(() => setIntro("play"))
      return () => cancelAnimationFrame(frame)
    }
    const el = desktopRef.current
    if (!el) return
    let frame = 0
    function check() {
      frame = 0
      if (!el) return
      const rect = el.getBoundingClientRect()
      const centered = rect.top + rect.height / 2 <= window.innerHeight * INTRO_CENTER_AT
      // A page too short (or a viewport too tall) to ever centre it: play once scrolled to the end.
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1
      if (!centered && !atBottom) return
      setIntro("play")
      stop()
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(check)
    }
    function stop() {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    check()
    return stop
    // Starts once ready; the rest is only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  /** The canvas's part of the load-in (bars, Codebase, GitHub popover, elements). */
  const canvasIntro = useMemo<LoadIntro>(
    () =>
      introStyle === "flip"
        ? {
            phase: intro,
            style: "flip",
            chromeAt: FLIP_INTRO.chromeAt,
            codebaseAt: FLIP_INTRO.codebaseAt,
            githubAt: FLIP_INTRO.githubAt,
            elementsAt: FLIP_INTRO.elementsAt,
            panelsAt: FLIP_INTRO.panelsAt,
            sidebarPanel: "components",
          }
        : {
            phase: intro,
            chromeAt: INTRO.chromeAt,
            codebaseAt: INTRO.codebaseAt,
            githubAt: INTRO.githubAt,
            elementsAt: INTRO.elementsAt,
            elementsTimeScale: ELEMENTS_TIME_SCALE,
          },
    [intro, introStyle],
  )

  return (
    <div
      ref={desktopRef}
      data-desktop-area
      className={cn(
        // Its dark tone shows while the wallpaper loads.
        "relative flex min-h-0 w-full flex-1 overflow-hidden bg-[#12120e]",
        className,
      )}
    >
      {/* Desktop wallpaper (bg.png from the canvas): covers the whole Desktop Area, centred. Served
          through next/image, so visitors get a resized AVIF / WebP instead of the full PNG. */}
      <Image
        src="/hero/bg.png"
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        draggable={false}
        onLoad={() => setWallpaperReady(true)}
        className="pointer-events-none select-none object-cover object-center"
      />
      <DesktopWindow
        title="ModeInspect Canvas"
        // Centred on the desktop (equal margins on each side).
        placement="left-[11%] top-[6%] h-[88%] w-[78%]"
        active={stack[0] === "main"}
        z={stack.length - stack.indexOf("main")}
        onFocus={() => focus("main")}
        opening={intro}
        openDelay={introStyle === "flip" ? 0 : INTRO.canvasWindowAt}
        drawIn={introStyle === "flip"}
      >
        <div className="flex min-h-0 flex-1 flex-col bg-mi-canvas">
          <DensityScale scale={CANVAS_DENSITY}>
            <HeroScreen
              className="h-auto min-h-0 flex-1"
              start="built"
              githubSyncOpen={showGithubPopover}
              githubPopoverOpen={githubPopoverOpen}
              portalEnabled={portalEnabled}
              // Visitors typing in the Portal's agent chat get a proper scripted prompt and reply.
              portalAutoPrompt={portalEnabled}
              githubPrSheet={githubPrSheet}
              toolsEnabled={false}
              scrollPans={false}
              loadIntro={canvasIntro}
              // Opens with the Layers panel showing and the trip card frame selected (its settings panel
              // open). "flip": the sidebar's Components panel opens during the load-in instead.
              layersOpen={introStyle !== "flip"}
              initialSelectedId="card-upcoming-trip"
            />
          </DensityScale>
        </div>
      </DesktopWindow>

      {showCodeWindow && (
        <DesktopWindow
          title="Code Changes"
          // Overlaps the canvas's lower right, only just past its edge, so the pair stays centred.
          placement="bottom-[5%] right-[6%] h-[50%] w-[38%]"
          active={stack[0] === "secondary"}
          z={stack.length - stack.indexOf("secondary")}
          onFocus={() => focus("secondary")}
          opening={intro}
          openDelay={INTRO.codeWindowAt}
          openDuration={CODE_WINDOW_OPEN_MS}
        >
          <CodeChangesPanel
            // Zoomed out (CSS zoom re-lays it out smaller, so more of the tree and diff fits; the
            // window's title bar keeps its size).
            className="min-h-0 flex-1 [zoom:0.85]"
            sidebarClassName="max-w-[32%]"
            revealDelay={intro === "play" ? CODE_LINES_AT : undefined}
            revealTimeScale={CODE_WINDOW_TIME_SCALE}
          />
        </DesktopWindow>
      )}
    </div>
  )
}

/**
 * One window: compact Safari chrome with a centred title. Any press inside focuses it (captured,
 * so it works even where the content stops the press); pressing the title bar also drags it, kept
 * entirely within the Desktop Area's borders.
 */
function DesktopWindow({
  title,
  placement,
  active,
  z,
  onFocus,
  opening,
  openDelay = 0,
  openDuration = WINDOW_OPEN_MS,
  drawIn = false,
  children,
}: {
  title: string
  /** Initial position and size within the Desktop Area (Tailwind classes). */
  placement: string
  active: boolean
  /** Stacking order: higher is in front. */
  z: number
  onFocus: () => void
  /** Opening animation: hidden while "waiting"; "play" opens it after `openDelay`. Omitted: simply there. */
  opening?: IntroPhase
  /** How long after "play" the window opens (ms). */
  openDelay?: number
  /** How long the opening takes (ms). */
  openDuration?: number
  /** The opening draws the window in (see DRAW_IN) instead of scaling it up. */
  drawIn?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<SVGSVGElement>(null)
  /** How far the window has been dragged from its placement, in layout px. */
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Opening: the window scales up from 85% to 100%, fades in (0 → 100% opacity) and moves up 20px,
  // easing out. Animated through the `scale` / `translate` properties so it composes with the drag
  // offset (`transform`). Its first frame is hidden, so during the delay it's invisible and can't be
  // pressed. Runs in a layout effect: the frame that drops the "waiting" style never shows it early.
  //
  // Drawn in instead: a light outline traces once round the window's edge (from its top-left
  // corner, clockwise). Only once it has closed does the window fill in inside it: it fades up from
  // nothing, shadow and all, in place, so there's no clip to come off and nothing jumps at the end.
  // The outline fades into the window's own edge as it fills.
  useLayoutEffect(() => {
    const el = ref.current
    if (opening !== "play" || !el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (drawIn) {
      const outline = outlineRef.current
      const rect = outline?.querySelector("rect")
      const animations: Animation[] = []
      if (outline && rect) {
        animations.push(
          rect.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
            duration: DRAW_IN.outlineMs,
            delay: openDelay,
            easing: "cubic-bezier(0.45, 0, 0.25, 1)",
            fill: "backwards",
          }),
          // Base style is hidden: it shows while the outline draws and the window fills in, then
          // fades out over the second half of the fill.
          outline.animate(
            [
              { opacity: 1, offset: 0 },
              { opacity: 1, offset: (DRAW_IN.fillAt + DRAW_IN.fillMs * 0.4) / (DRAW_IN.fillAt + DRAW_IN.fillMs) },
              { opacity: 0, offset: 1 },
            ],
            { duration: DRAW_IN.fillAt + DRAW_IN.fillMs, delay: openDelay, fill: "backwards" },
          ),
        )
      }
      animations.push(
        el.animate(
          [
            { visibility: "hidden", opacity: 0, offset: 0 },
            { visibility: "visible", opacity: 0, offset: 0.001 },
            { visibility: "visible", opacity: 1, offset: 1 },
          ],
          {
            duration: DRAW_IN.fillMs,
            delay: openDelay + DRAW_IN.fillAt,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "backwards",
          },
        ),
      )
      return () => animations.forEach((a) => a.cancel())
    }
    const animation = el.animate(
      [
        { visibility: "hidden", opacity: 0, scale: "0.85", translate: "0 20px" },
        { visibility: "visible", opacity: 1, scale: "1", translate: "0 0" },
      ],
      {
        duration: openDuration,
        delay: openDelay,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      },
    )
    return () => animation.cancel()
    // The delay is fixed per window; the animation only (re)starts with the phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening])

  function startMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    const desktop = el?.parentElement
    if (e.button !== 0 || !el || !desktop) return
    e.preventDefault()
    const from = offset
    // offsetLeft / offsetTop ignore the transform: the placement before any drag. The whole
    // window stays within the Desktop Area's borders.
    const minX = -el.offsetLeft
    const maxX = desktop.clientWidth - el.offsetLeft - el.offsetWidth
    const minY = -el.offsetTop
    const maxY = desktop.clientHeight - el.offsetTop - el.offsetHeight
    trackDrag(e, (dx, dy) =>
      setOffset({
        x: Math.min(maxX, Math.max(minX, from.x + dx)),
        y: Math.min(maxY, Math.max(minY, from.y + dy)),
      }),
    )
  }

  return (
    <>
    <div
      ref={ref}
      data-desktop-window={title}
      onPointerDownCapture={onFocus}
      style={{
        zIndex: z,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        visibility: opening === "waiting" ? "hidden" : undefined,
      }}
      className={cn(DESKTOP_WINDOW, placement)}
    >
      <SafariChrome
        compact
        title={title}
        active={active}
        onBarPointerDown={startMove}
        // Rounded like the window, so the content's own edge follows the same curve as the clip.
        className="rounded-[inherit]"
      >
        {children}
      </SafariChrome>
    </div>
    {drawIn && (
      // The draw-in's outline: over the window's edge (same placement and drag offset), hidden
      // except while the opening plays. pathLength 1 lets the dash run 1 → 0 at any size.
      <svg
        ref={outlineRef}
        aria-hidden="true"
        className={cn("pointer-events-none absolute overflow-visible", placement)}
        style={{ zIndex: 100, opacity: 0, transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <rect
          width="100%"
          height="100%"
          rx={12}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1.5}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={0}
        />
      </svg>
    )}
    </>
  )
}

/**
 * Draws its contents at `scale`: they're laid out 1 / scale as large as the space they fill (pure
 * CSS percentages, so it follows every resize) and scaled back down to it. The scale is registered
 * as a screen-scale host (see lib/screen-scale), so the canvas's pointer math (dragging, marquee,
 * zoom, drops) stays exact; it multiplies with the hero window's own growth scale around it.
 */
function DensityScale({ scale, children }: { scale: number; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (contentRef.current) setScreenScale(contentRef.current, scale)
  }, [scale])
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={contentRef}
        {...{ [SCREEN_SCALE_ATTR]: "" }}
        className="absolute left-0 top-0 flex origin-top-left flex-col"
        style={{
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
