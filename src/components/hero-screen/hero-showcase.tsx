"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { CodeChangesPanel } from "./code-changes-popover"
import { trackDrag } from "./drag"
import { HeroScreen, type LoadIntro } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

type WindowId = "main" | "secondary"

/** Load-in: "waiting" until the Desktop Area is in view, then "play" (once). */
type IntroPhase = "waiting" | "play"

/** Share of the Desktop Area that must be on screen before the load-in plays. */
const INTRO_VISIBLE_THRESHOLD = 0.35

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
 * A window on the Desktop Area: rounded, with a shadow; positioned by its `placement` classes.
 * No CSS border here: a border on the clipping box thins out and turns jagged at the corners where
 * the content is clipped. The outline is drawn on top instead (see WINDOW_OUTLINE).
 */
const DESKTOP_WINDOW =
  "absolute flex flex-col overflow-hidden rounded-xl shadow-[0_24px_60px_-20px_rgba(17,17,16,0.35),0_2px_6px_rgba(17,17,16,0.08)]"

/**
 * The window's outline: one solid grey 1px ring over the window (above all its content), following
 * the window's own rounded edge, so it keeps the same width and a smooth curve all the way round.
 */
const WINDOW_OUTLINE = "pointer-events-none absolute inset-0 z-[100] rounded-[inherit] border border-[#c9c7c3]"

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
export function HeroShowcase({ className }: { className?: string }) {
  /** Front to back: the first is the focused window. */
  const [stack, setStack] = useState<WindowId[]>(["secondary", "main"])
  const focus = (id: WindowId) => setStack((s) => (s[0] === id ? s : [id, ...s.filter((w) => w !== id)]))

  const desktopRef = useRef<HTMLDivElement>(null)
  const [intro, setIntro] = useState<IntroPhase>("waiting")
  useEffect(() => {
    const el = desktopRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setIntro("play")
        observer.disconnect()
      },
      { threshold: INTRO_VISIBLE_THRESHOLD },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** The canvas's part of the load-in (bars, Codebase, GitHub popover, elements). */
  const canvasIntro = useMemo<LoadIntro>(
    () => ({
      phase: intro,
      chromeAt: INTRO.chromeAt,
      codebaseAt: INTRO.codebaseAt,
      githubAt: INTRO.githubAt,
      elementsAt: INTRO.elementsAt,
      elementsTimeScale: ELEMENTS_TIME_SCALE,
    }),
    [intro],
  )

  return (
    <div
      ref={desktopRef}
      data-desktop-area
      className={cn(
        // Desktop wallpaper (bg.png from the canvas): covers the whole Desktop Area, centred; its dark tone shows while it loads.
        "relative flex min-h-0 w-full flex-1 overflow-hidden bg-[#12120e] bg-[url(/hero/bg.png)] bg-cover bg-center bg-no-repeat",
        className,
      )}
    >
      <DesktopWindow
        title="ModeInspect Canvas"
        // Centred on the desktop (equal margins on each side).
        placement="left-[11%] top-[6%] h-[88%] w-[78%]"
        active={stack[0] === "main"}
        z={stack.length - stack.indexOf("main")}
        onFocus={() => focus("main")}
        opening={intro}
        openDelay={INTRO.canvasWindowAt}
      >
        <div className="flex min-h-0 flex-1 flex-col bg-mi-canvas">
          <DensityScale scale={CANVAS_DENSITY}>
            <HeroScreen
              className="h-auto min-h-0 flex-1"
              start="built"
              githubSyncOpen
              portalEnabled={false}
              toolsEnabled={false}
              scrollPans={false}
              loadIntro={canvasIntro}
            />
          </DensityScale>
        </div>
      </DesktopWindow>

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
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  /** How far the window has been dragged from its placement, in layout px. */
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Opening: the window scales up from 85% to 100%, fades in (0 → 100% opacity) and moves up 20px,
  // easing out. Animated through the `scale` / `translate` properties so it composes with the drag
  // offset (`transform`). Its first frame is hidden, so during the delay it's invisible and can't be
  // pressed. Runs in a layout effect: the frame that drops the "waiting" style never shows it early.
  useLayoutEffect(() => {
    const el = ref.current
    if (opening !== "play" || !el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
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
      <span aria-hidden="true" className={WINDOW_OUTLINE} />
    </div>
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
