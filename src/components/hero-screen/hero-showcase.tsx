"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
 * The load-in, in ms from when it starts. Each step begins as the one before it is settling, so
 * the sequence reads as one continuous build-up:
 *   1. the empty Desktop Area, on its own for a beat
 *   2. the empty Canvas window opens (scales up from 85%, fades in, rises 20px)
 *   3. the bars and tools come in, one after another
 *   4. the Codebase frame fades in; its live app's own opening plays on through the next step
 *   5. the GitHub Sync popover opens
 *   6. the canvas elements glide in around the Codebase frame
 *   7. the Code Changes window opens (as the Canvas window did) and its diff streams in row by row
 */
/** Pace of the whole load-in: every step's time (and the windows' opening) is scaled by this. 0.512 = 20% faster, three times over. */
const INTRO_TIME_SCALE = 0.512
const INTRO = {
  canvasWindowAt: 400 * INTRO_TIME_SCALE,
  chromeAt: 950 * INTRO_TIME_SCALE,
  codebaseAt: 1700 * INTRO_TIME_SCALE,
  githubAt: 2500 * INTRO_TIME_SCALE,
  elementsAt: 3000 * INTRO_TIME_SCALE,
  codeWindowAt: 4300 * INTRO_TIME_SCALE,
}
/** How long a window takes to open (ms). */
const WINDOW_OPEN_MS = 700 * INTRO_TIME_SCALE
/** The diff rows start coming in once the Code Changes window is mostly open. */
const CODE_LINES_AT = INTRO.codeWindowAt + 450 * INTRO_TIME_SCALE

/** A window on the Desktop Area: rounded, with a shadow; positioned by its `placement` classes. */
const DESKTOP_WINDOW =
  "absolute flex flex-col overflow-hidden rounded-xl border border-black/10 shadow-[0_24px_60px_-20px_rgba(17,17,16,0.35),0_2px_6px_rgba(17,17,16,0.08)]"

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
    }),
    [intro],
  )

  return (
    <div
      ref={desktopRef}
      data-desktop-area
      className={cn(
        "relative flex min-h-0 w-full flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#e4e9d4_0%,#d6d3cd_55%,#c9c5bf_100%)]",
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
          <HeroScreen
            className="h-auto min-h-0 flex-1"
            start="built"
            githubSyncOpen
            portalEnabled={false}
            toolsEnabled={false}
            scrollPans={false}
            loadIntro={canvasIntro}
          />
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
      >
        <CodeChangesPanel
          className="min-h-0 flex-1"
          sidebarClassName="max-w-[32%]"
          revealDelay={intro === "play" ? CODE_LINES_AT : undefined}
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
        duration: WINDOW_OPEN_MS,
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
      <SafariChrome compact title={title} active={active} onBarPointerDown={startMove}>
        {children}
      </SafariChrome>
    </div>
  )
}
