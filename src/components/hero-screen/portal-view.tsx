"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Laptop,
  Link,
  Mic,
  Monitor,
  Plus,
  RotateCw,
  Scaling,
  ScanLine,
  Smartphone,
  SquareDashedMousePointer,
  SquarePen,
  Tablet,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react"
import { AirbnbScreen } from "@/app/copy-project/airbnb-screen"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { screenScale } from "@/lib/screen-scale"
import { PORTAL_FALLBACK, PORTAL_TURNS, type PortalTurn } from "./agent-script"
import { wordsOf, type VariantState } from "./build-agents"
import { CQW, FrameBadge, type FrameComponent } from "./library-components"
import { AgentStar } from "./planner-frame"
import { FinishedEventCard } from "./variant-frame"

/** Portal Agent: thinking time before a reply, and one streamed word (ms). */
const PORTAL_THINK_MS = 1300
const PORTAL_WORD_MS = 40

type PortalChatEntry = { id: number; name: string; seeded: boolean }
type PortalMessage = { id: number; role: "user" | "agent"; text: string; shown?: number; turn?: PortalTurn }

/** How long the darkened loading state shows before the live Fairbnb app loads in. */
const PORTAL_LOAD_MS = 2000

/** Route the portal previews. */
const PORTAL_PATH = "/"

/**
 * Loading phases of the preview:
 * - "start": progress bar at 0, about to animate
 * - "loading": darkened preview + spinner, progress bar creeping toward the end
 * - "loaded": live app, progress bar completes and fades out
 */
type LoadPhase = "start" | "loading" | "loaded"

/** A highlighted area in preview-box px (left/top relative to the preview), with the element's corner radius. */
type Box = { left: number; top: number; width: number; height: number; radius: string }

/** A capture flash: an element's box, or the whole page. `id` restarts the animation per capture. */
type Pulse = { id: number; box: Box | "page" }

/** Length of the capture flash; matches `--animate-mi-capture-pulse` in globals.css. */
const CAPTURE_PULSE_MS = 1100

/** Capture highlight colour (the canvas selection blue). */
const CAPTURE_BLUE = "#2f6bf6"

/**
 * Portal View: the live Codebase app opened full-screen (double-click the Codebase frame).
 * The preview is darkened with a spinner for ~2s, then the Fairbnb app loads in and plays its
 * intro. Back (or Escape / ⇧O) returns to the canvas; reload replays the loading. While
 * `closing`, the view fades out before the canvas unmounts it.
 *
 * Capture: "Capture a selection" enters Area capture mode (the button becomes a badge). Hovering
 * an element of the app outlines it; clicking it flashes a blue overlay over it (the mode stays
 * on until the badge's ✕ or Escape). "Capture the page" flashes the whole page.
 *
 * Memoized: the canvas around it re-renders on every resize frame (the hero window growing with
 * the page scroll), while the Portal only changes with its own props and state.
 */
export const PortalView = memo(function PortalView({
  onClose,
  closing = false,
  builtVariant = null,
  builtComponents = [],
}: {
  onClose: () => void
  closing?: boolean
  /** A variant the Build Agent built into the codebase: it replaces its source card in the live app. */
  builtVariant?: VariantState | null
  /** Library components the Build Agent built into the codebase: they show on their cards in the live app. */
  builtComponents?: FrameComponent[]
}) {
  const [phase, setPhase] = useState<LoadPhase>("start")
  /** Bumped by reload: restarts the loading and remounts the app. */
  const [loadId, setLoadId] = useState(0)
  const [capturing, setCapturing] = useState(false)
  /** Element under the cursor in Area capture mode. */
  const [hover, setHover] = useState<Box | null>(null)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  /** Changes the Portal Agent has applied to the live app (see `data-portal-applied` in globals.css). */
  const [applied, setApplied] = useState<string[]>([])
  /** Stable, so the chat (memoized) doesn't re-render with every hover / phase change here. */
  const applyChange = useCallback(
    (change: string) => setApplied((list) => (list.includes(change) ? list : [...list, change])),
    [],
  )
  const previewRef = useRef<HTMLDivElement>(null)
  const nextPulseId = useRef(1)

  useEffect(() => {
    // Next frame: start the progress bar transition from 0.
    const frame = requestAnimationFrame(() => setPhase("loading"))
    const timer = setTimeout(() => setPhase("loaded"), PORTAL_LOAD_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [loadId])

  // The capture flash removes itself once it has faded.
  useEffect(() => {
    if (!pulse) return
    const timer = setTimeout(() => setPulse((p) => (p?.id === pulse.id ? null : p)), CAPTURE_PULSE_MS)
    return () => clearTimeout(timer)
  }, [pulse])

  // Escape (or ⇧O, for hosts where Escape is already taken) leaves Area capture mode first, then the portal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      const isShiftO = e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "o"
      if (e.key !== "Escape" && !isShiftO) return
      if (capturing) stopCapture()
      else onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, capturing])

  function reload() {
    setPhase("start")
    setLoadId((id) => id + 1)
  }

  function stopCapture() {
    setCapturing(false)
    setHover(null)
  }

  /** The app element under the pointer (inside the device screen), or null. SVG parts resolve to their whole icon. */
  function captureTarget(target: EventTarget): Element | null {
    if (!(target instanceof Element) || !target.closest("[data-portal-screen]")) return null
    return target instanceof SVGElement ? (target.closest("svg") ?? target) : target
  }

  /** An element's box relative to the preview (its layout px), with its own corner radius. */
  function boxOf(el: Element): Box | null {
    const preview = previewRef.current
    if (!preview) return null
    const p = preview.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const k = screenScale(preview) // the screen may be drawn scaled
    return {
      left: (r.left - p.left) / k,
      top: (r.top - p.top) / k,
      width: r.width / k,
      height: r.height / k,
      radius: getComputedStyle(el).borderRadius,
    }
  }

  function flash(box: Box | "page") {
    setPulse({ id: nextPulseId.current++, box })
  }

  /** Area capture click: flash the element (the mode stays on until exited). */
  function captureElement(target: EventTarget) {
    const el = captureTarget(target)
    const box = el && boxOf(el)
    if (!box) return
    flash(box)
  }

  function capturePage() {
    stopCapture()
    flash("page")
  }

  const loaded = phase === "loaded"

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex bg-stone-100",
        // Closing: fade out (the canvas waits for this before its elements come in).
        closing ? "pointer-events-none" : "animate-in fade-in duration-150",
      )}
      // Inline so the fade never depends on a utility class being generated.
      style={closing ? { opacity: 0, transition: "opacity 300ms ease-out" } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Preview column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Browser bar */}
        <header className="relative grid h-11 shrink-0 grid-cols-[1fr_minmax(0,440px)_1fr] items-center gap-3 border-b border-stone-200 bg-stone-50 px-2">
          <div className="flex items-center gap-0.5">
            <BarButton label="Back to canvas" onClick={onClose}>
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </BarButton>
            <BarButton label="Forward">
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </BarButton>
          </div>

          <div className="flex h-7 items-center gap-2 rounded-lg bg-stone-100 pl-2.5 pr-1 text-px-13 text-stone-900">
            <Link className="size-3 shrink-0 text-stone-500" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-center">{PORTAL_PATH}</span>
            <button
              type="button"
              aria-label="Reload"
              onClick={reload}
              className="flex size-6 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5"
            >
              <RotateCw className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 text-stone-800">
            {capturing ? (
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#e3f1e5] pl-2.5 pr-1 text-px-13 font-medium text-[#1e7b36] animate-in fade-in zoom-in-95 duration-150">
                <SquareDashedMousePointer className="size-3.5" strokeWidth={1.5} />
                Area capture
                <button
                  type="button"
                  aria-label="Exit area capture"
                  onClick={stopCapture}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-[#1e7b36]/10"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </span>
            ) : (
              <BarButton label="Capture a selection to the canvas (⌘S)" onClick={() => setCapturing(true)}>
                <SquareDashedMousePointer className="size-4" strokeWidth={1.25} />
              </BarButton>
            )}
            <BarButton label="Capture the page to the canvas (⇧⌘S)" onClick={capturePage}>
              <ScanLine className="size-4" strokeWidth={1.25} />
            </BarButton>
            <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-stone-300" />
            <ViewportSelect />
          </div>

          {/* Page-load progress */}
          <div
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-0.5 bg-[#2f6bf6]"
            style={{
              width: phase === "start" ? "0%" : phase === "loading" ? "93%" : "100%",
              opacity: loaded ? 0 : 1,
              transition:
                phase === "start"
                  ? "none"
                  : phase === "loading"
                    ? `width ${PORTAL_LOAD_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)`
                    : "width 200ms ease-out, opacity 300ms ease-out 200ms",
            }}
          />
        </header>

        {/* Preview */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-9">
          <div
            ref={previewRef}
            data-portal-applied={applied.join(" ")}
            className="relative min-h-0 flex-1 overflow-hidden rounded-b-md border-x border-b border-stone-200 bg-white"
          >
            {/*
              isolate: the app's own z-indexes stay below the loading overlay.
              In Area capture mode the app's own clicks are blocked (capture phase): hovering
              outlines the element under the cursor, clicking captures it.
            */}
            <div
              className={cn("isolate flex size-full p-6", capturing && "[&_*]:!cursor-default")}
              onPointerMoveCapture={
                capturing
                  ? (e) => {
                      const el = captureTarget(e.target)
                      const next = el ? boxOf(el) : null
                      // Same element, same box: keep the current one (no re-render per pointer move).
                      setHover((prev) => (prev && next && sameBox(prev, next) ? prev : next))
                    }
                  : undefined
              }
              onPointerLeave={capturing ? () => setHover(null) : undefined}
              onPointerDownCapture={
                capturing
                  ? (e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }
                  : undefined
              }
              onClickCapture={
                capturing
                  ? (e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      captureElement(e.target)
                    }
                  : undefined
              }
            >
              {/* Size container: the device fits both its width and height (the whole app stays visible) */}
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
                <AirbnbDevice key={`${loadId}-${loaded ? "live" : "loading"}`} loaded={loaded} />
              </div>
            </div>

            {loaded && builtVariant && <BuiltVariantOverlay key={loadId} variant={builtVariant} previewRef={previewRef} />}

            {loaded &&
              [...new Set(builtComponents.map((c) => c.cardTitle))].map((title) => (
                <BuiltCardComponents
                  key={`${loadId}:${title}`}
                  title={title}
                  components={builtComponents.filter((c) => c.cardTitle === title)}
                  functional={applied.includes("badge-check-in")}
                  previewRef={previewRef}
                />
              ))}

            {!loaded && (
              <div
                role="status"
                aria-label="Loading preview"
                className="absolute inset-0 z-10 flex items-center justify-center bg-stone-900/60"
              >
                <Spinner className="size-7 text-stone-200" strokeWidth={1.5} />
              </div>
            )}

            {/* Area capture: outline of the element under the cursor */}
            {capturing && hover && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 border-2"
                style={{ ...boxStyle(hover), borderColor: CAPTURE_BLUE }}
              />
            )}

            {/* Capture flash: blue overlay over the captured element, or the whole page */}
            {pulse && (
              <div
                key={pulse.id}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute z-20 border-2 animate-mi-capture-pulse",
                  pulse.box === "page" && "inset-0",
                )}
                style={{
                  ...(pulse.box === "page" ? {} : boxStyle(pulse.box)),
                  borderColor: CAPTURE_BLUE,
                  background: `${CAPTURE_BLUE}1f`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <PortalChat onApply={applyChange} />
    </div>
  )
})

/** Absolute-position style for a capture Box. */
function boxStyle(box: Box): React.CSSProperties {
  return { left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius }
}

function sameBox(a: Box, b: Box) {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.radius === b.radius
}

/** The live app plays its intro first; the built variant swaps in once it has settled (ms after load). */
const REPLACE_AFTER_MS = 1700

/**
 * A built variant in the live app: it takes its source card's place in the desktop screen (found by
 * its title). It renders inside the same container as the card's
 * painted pieces, at the union of their layout boxes (offset*, so the intro's transforms don't
 * skew it), and hides those pieces while it's there, so the app's card is swapped, not covered.
 * It swaps in after the intro with a blue flash.
 */
function BuiltVariantOverlay({
  variant,
  previewRef,
}: {
  variant: VariantState
  previewRef: React.RefObject<HTMLDivElement | null>
}) {
  const [place, setPlace] = useState<{ host: Element; left: number; top: number; width: number; height: number } | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), REPLACE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  // Find the source card's pieces, hide them, and track their box (every frame: resizes move it).
  useEffect(() => {
    if (!shown) return
    let frame = 0
    let hidden: HTMLElement[] = []
    const unhide = () => {
      hidden.forEach((el) => el.removeAttribute("data-built-swapped"))
      hidden = []
    }
    const measure = () => {
      const screen = previewRef.current?.querySelector("[data-portal-screen]")
      const titleBlock = screen ? sourceTitleBlock(screen, variant.source.title) : undefined
      const host = titleBlock?.parentElement
      if (titleBlock && host) {
        const order = titleBlock.dataset.order
        const pieces = Array.from(
          host.querySelectorAll<HTMLElement>(`:scope > [data-anim="block"][data-order="${order}"], :scope > [data-anim="fillet"][data-order="${order}"]`),
        )
        if (pieces.some((el) => !hidden.includes(el)) || hidden.length !== pieces.length) {
          unhide()
          pieces.forEach((el) => el.setAttribute("data-built-swapped", ""))
          hidden = pieces
        }
        const blocks = pieces.filter((el) => el.dataset.anim === "block")
        const left = Math.min(...blocks.map((el) => el.offsetLeft))
        const top = Math.min(...blocks.map((el) => el.offsetTop))
        const right = Math.max(...blocks.map((el) => el.offsetLeft + el.offsetWidth))
        const bottom = Math.max(...blocks.map((el) => el.offsetTop + el.offsetHeight))
        const next = { host, left, top, width: right - left, height: bottom - top }
        setPlace((p) =>
          p && p.host === host && p.left === next.left && p.top === next.top && p.width === next.width && p.height === next.height
            ? p
            : next,
        )
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => {
      cancelAnimationFrame(frame)
      unhide()
    }
  }, [shown, previewRef, variant.source.title])

  if (!shown || !place) return null
  return createPortal(
    <div
      data-cursor-id="built-variant"
      className="pointer-events-none absolute z-20 animate-in fade-in zoom-in-95 duration-500"
      style={{ left: place.left, top: place.top, width: place.width, height: place.height }}
    >
      <FinishedEventCard variant={variant} />
      <div
        aria-hidden="true"
        className="absolute -inset-[0.3cqw] rounded-[1.3cqw] border-[0.2cqw] animate-mi-capture-pulse"
        style={{ borderColor: CAPTURE_BLUE, background: `${CAPTURE_BLUE}1f` }}
      />
    </div>,
    place.host,
  )
}

/**
 * Library components built into a card of the live app (found by its title). They render inside
 * the same container as the card's painted pieces, offset from the
 * card's top-left by the spot they were placed at in their frame (canvas units ÷ 1cqw → cqw of the
 * desktop screen, which is what the frame's artwork is authored in). They swap in after the intro
 * with a blue flash. Once `functional` (the Portal Agent wired them up), a badge is a button that
 * checks in to the stay: the card fades back and the badge flips to a check; tapping again undoes it.
 */
function BuiltCardComponents({
  title,
  components,
  functional,
  previewRef,
}: {
  title: string
  components: FrameComponent[]
  functional: boolean
  previewRef: React.RefObject<HTMLDivElement | null>
}) {
  const [place, setPlace] = useState<{ host: Element; left: number; top: number; width: number; height: number } | null>(null)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), REPLACE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  // Track the card's box (every frame: resizes and the day's animations move it).
  useEffect(() => {
    if (!shown) return
    let frame = 0
    const measure = () => {
      const screen = previewRef.current?.querySelector("[data-portal-screen]")
      const titleBlock = screen ? sourceTitleBlock(screen, title) : undefined
      const host = titleBlock?.parentElement
      if (titleBlock && host) {
        const blocks = Array.from(
          host.querySelectorAll<HTMLElement>(`:scope > [data-anim="block"][data-order="${titleBlock.dataset.order}"]`),
        )
        const left = Math.min(...blocks.map((el) => el.offsetLeft))
        const top = Math.min(...blocks.map((el) => el.offsetTop))
        const right = Math.max(...blocks.map((el) => el.offsetLeft + el.offsetWidth))
        const bottom = Math.max(...blocks.map((el) => el.offsetTop + el.offsetHeight))
        const next = { host, left, top, width: right - left, height: bottom - top }
        setPlace((p) =>
          p && p.host === host && p.left === next.left && p.top === next.top && p.width === next.width && p.height === next.height
            ? p
            : next,
        )
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [shown, previewRef, title])

  if (!shown || !place) return null
  return createPortal(
    <>
      {/* Checked in: the card fades back under a veil (the cards' own 1cqw radius) */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-20 rounded-[1cqw] bg-white/60 transition-opacity duration-300",
          done ? "opacity-100" : "opacity-0",
        )}
        style={{ left: place.left, top: place.top, width: place.width, height: place.height }}
      />
      {components.map((c) => (
        <BuiltBadge
          key={c.id}
          component={c}
          title={title}
          functional={functional}
          done={done}
          onToggle={() => setDone((d) => !d)}
          card={place}
        />
      ))}
    </>,
    place.host,
  )
}

/**
 * One built badge on its card. Checking in swaps its label for a check and "Checked in", which is
 * wider, so the badge is pinned by the card edge it sits nearer: placed in the top-right corner,
 * it grows to the left and stays inside the card instead of running off its right edge. The pin
 * is measured once (as it lands, in cqw of the screen), so it scales with the screen.
 */
function BuiltBadge({
  component: c,
  title,
  functional,
  done,
  onToggle,
  card,
}: {
  component: FrameComponent
  title: string
  functional: boolean
  done: boolean
  onToggle: () => void
  /** The card's box in the host, px. */
  card: { left: number; top: number; width: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  /** The badge's resting width (cqw) and which side it's pinned by; null until measured. */
  const [slot, setSlot] = useState<{ widthCqw: number; pinRight: boolean } | null>(null)

  useLayoutEffect(() => {
    if (slot || done) return
    const el = ref.current
    const screen = el?.closest<HTMLElement>("[data-portal-screen]")
    if (!el || !screen || !el.offsetWidth || !screen.clientWidth) return
    setSlot({
      widthCqw: el.offsetWidth / (screen.clientWidth / 100),
      pinRight: el.offsetLeft + el.offsetWidth / 2 > card.left + card.width / 2,
    })
  }, [slot, done, card.left, card.width])

  return (
    <div
      ref={ref}
      data-cursor-id="built-component"
      className="pointer-events-none absolute z-20 animate-in fade-in zoom-in-90 duration-500"
      style={{
        left: `calc(${card.left}px + ${c.x / CQW}cqw)`,
        top: `calc(${card.top}px + ${c.y / CQW}cqw)`,
        width: slot ? `${slot.widthCqw}cqw` : undefined,
      }}
    >
      {/* Pinned right: a wider badge overflows to the left (flex-end), into the card. */}
      <div className={cn("flex", slot?.pinRight ? "justify-end" : "justify-start")}>
        {functional ? (
          <button
            type="button"
            aria-label={done ? `Undo check-in at ${title}` : `Check in at ${title}`}
            aria-pressed={done}
            onClick={onToggle}
            className="pointer-events-auto block shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            <FrameBadge instance={c} done={done} />
          </button>
        ) : (
          <span className="block shrink-0">
            <FrameBadge instance={c} />
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute -inset-[0.3cqw] rounded-[0.6cqw] border-[0.2cqw] animate-mi-capture-pulse"
        style={{ borderColor: CAPTURE_BLUE, background: `${CAPTURE_BLUE}1f` }}
      />
    </div>
  )
}

/**
 * The painted block carrying a card's title: the first visible match (a block inside a hidden
 * `day-layer`, if the app stacks any, is skipped), else the first match.
 */
function sourceTitleBlock(screen: Element, title: string): HTMLElement | undefined {
  const matches = Array.from(screen.querySelectorAll<HTMLElement>('[data-anim="block"]')).filter(
    (el) => el.querySelector('[data-anim="title"] p')?.textContent?.trim() === title,
  )
  const visible = matches.find((el) => {
    const layer = el.closest<HTMLElement>('[data-anim="day-layer"]')
    if (!layer) return true
    const style = getComputedStyle(layer)
    return style.visibility !== "hidden" && Number(style.opacity) > 0
  })
  return visible ?? matches[0]
}

/**
 * Window height ÷ width: the 3.2cqw title bar plus the 1440×900 viewport (900/1440 = 0.625)
 * → 0.032 + 0.625 = 0.657.
 */
const WINDOW_ASPECT = 0.657

/**
 * The app at `/`: the Fairbnb desktop app in a desktop browser window, as large as fits the
 * preview (100% of its width, or its height if that is shorter). While loading it renders the
 * finished screen instantly (sped-up intro) under the dark overlay; once loaded it remounts and
 * plays the intro at its normal pace.
 */
function AirbnbDevice({ loaded }: { loaded: boolean }) {
  return (
    <div className="@container" style={{ width: `min(100cqw, calc(100cqh / ${WINDOW_ASPECT}))` }}>
      <div className="overflow-hidden rounded-[0.9cqw] bg-white shadow-[0_0_0_1px_rgba(17,17,16,0.14),0_2.4cqw_5cqw_-1.6cqw_rgba(17,17,16,0.35)]">
        {/* Title bar: traffic lights and the address */}
        <div className="relative flex h-[3.2cqw] items-center border-b border-black/[0.08] bg-[#f6f6f6] px-[1.2cqw]">
          <span className="flex gap-[0.6cqw]" aria-hidden="true">
            <span className="size-[0.95cqw] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
            <span className="size-[0.95cqw] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
            <span className="size-[0.95cqw] rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
          </span>
          <span className="absolute left-1/2 flex h-[2cqw] w-[34cqw] -translate-x-1/2 items-center justify-center rounded-[0.6cqw] bg-black/[0.05] text-[0.95cqw] text-stone-500">
            fairbnb.com
          </span>
        </div>
        <div data-portal-screen className="@container aspect-[1440/900] overflow-hidden bg-white">
          <AirbnbScreen introSpeed={loaded ? 1 : 1000} />
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- Chat ---------------------------------- */

const CHAT_FILES: { path: string; note: string }[] = [
  { path: "src/app/page.tsx", note: "the route, which renders FairbnbDevice." },
  { path: "src/components/fairbnb-device.tsx", note: "the browser window around the screen." },
  { path: "src/components/fairbnb-screen.tsx", note: "the home page: header, categories, your trip and listings (about 470 lines)." },
  { path: "src/lib/fairbnb-data.ts", note: "the trip, the listings and the screen's layout." },
  { path: "src/lib/use-fairbnb-intro.ts", note: "the GSAP opening sequence (about 170 lines)." },
]

/** Previous Build Agent chats (pseudo names), newest first; the first is the open one. */
const CHATS = [
  "Building Portal View",
  "Capturing Scroll Recording",
  "Adding Curve Handles To Frames",
  "Making Chat Pseudofunctional",
  "Adjusting Codebase Speed And Spacing",
  "Designing Share Button Functionality",
  "Making GitHub Button Interactive",
  "Opening Code Changes In Popover",
  "Implementing Fairbnb Desktop Codebase",
  "Making Frames And Text Elements",
  "Setting Up Hero Canvas",
]

/** Gray disc with the Build Agent star: the chat icon. While its agent works the star spins on lime. */
function ChatIcon({ working = false }: { working?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full transition-colors",
        working ? "bg-mi-lime text-stone-900" : "bg-stone-200 text-stone-500",
      )}
    >
      <AgentStar className={cn("size-2.5", working && "animate-spin [animation-duration:1.6s]")} />
    </span>
  )
}

/**
 * Header chat title: click opens a popover listing the chats; picking one makes it the open chat.
 * While `renaming`, the title is an input: Enter / blur saves, Escape cancels.
 */
function ChatSwitcher({
  chats,
  currentIndex,
  onSelect,
  renaming,
  onRenameEnd,
  working = false,
}: {
  chats: string[]
  currentIndex: number
  onSelect: (index: number) => void
  renaming: boolean
  /** Rename finished: the new name, or null when cancelled. */
  onRenameEnd: (name: string | null) => void
  /** The open chat's agent is working: its icon spins and its title shimmers. */
  working?: boolean
}) {
  const current = chats[currentIndex]
  const [open, setOpen] = useState(false)
  /** Which list the popover shows: the chats, or the (empty) archive. */
  const [view, setView] = useState<"chats" | "archived">("chats")
  const [draft, setDraft] = useState(current)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Rename starts: fill the input with the current name and select it.
  useEffect(() => {
    if (!renaming) return
    setDraft(current)
    requestAnimationFrame(() => inputRef.current?.select())
    // Only when rename starts, not on every name change.
  }, [renaming])

  /** Close the popover; it reopens on the chat list. */
  function close() {
    setOpen(false)
    setView("chats")
  }

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setView("chats")
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      setView("chats")
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="min-w-0">
      {renaming ? (
        <div className="flex h-7 min-w-0 items-center gap-1.5 px-1">
          <ChatIcon />
          <input
            ref={inputRef}
            aria-label="Chat name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onRenameEnd(draft.trim() || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameEnd(draft.trim() || null)
              if (e.key === "Escape") onRenameEnd(null)
            }}
            className="-my-1 w-[220px] min-w-0 select-text rounded-md bg-white px-1.5 py-1 text-px-13 font-medium text-stone-900 shadow-[0_0_0_1px_rgba(47,107,246,0.6)] outline-none"
          />
        </div>
      ) : (
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 text-px-13 font-medium text-stone-900 hover:bg-stone-700/5",
          open && "bg-stone-700/5",
        )}
      >
        <ChatIcon working={working} />
        <span
          key={current}
          className={cn(
            "truncate animate-in fade-in duration-300",
            working &&
              "bg-[linear-gradient(110deg,#57534e_40%,#d6d3d1_50%,#57534e_60%)] bg-[length:300%_100%] bg-clip-text text-transparent animate-mi-shine",
          )}
        >
          {current}
        </span>
        <ChevronDown className="size-3 shrink-0 text-stone-500" strokeWidth={1.5} />
      </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute inset-x-1.5 top-full z-50 flex flex-col rounded-xl border border-stone-200 bg-white shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {view === "archived" ? (
            <>
              <div className="flex h-12 items-center gap-2 border-b border-stone-200 px-1.5">
                <button
                  type="button"
                  aria-label="Back to chats"
                  onClick={() => setView("chats")}
                  className="flex size-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-700/5 hover:text-stone-800"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                <span className="text-px-13 font-medium text-stone-900">Archived</span>
              </div>
              <p className="px-3.5 py-3 text-px-13 text-stone-500">No archived agents</p>
            </>
          ) : (
            <>
              <div className="flex max-h-[320px] flex-col overflow-y-auto p-1.5">
                {chats.map((chat, i) => (
                  <button
                    key={i}
                    type="button"
                    role="menuitemradio"
                    aria-checked={i === currentIndex}
                    onClick={() => {
                      onSelect(i)
                      close()
                    }}
                    className="flex h-[34px] shrink-0 items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-900 hover:bg-stone-700/5"
                  >
                    <ChatIcon working={working && i === currentIndex} />
                    <span className="min-w-0 flex-1 truncate">{chat}</span>
                    {i === currentIndex && <Check className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />}
                  </button>
                ))}
              </div>
              <div className="border-t border-stone-200 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView("archived")}
                  className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-700 hover:bg-stone-700/5"
                >
                  <Archive className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />
                  <span className="flex-1">Archived</span>
                  <ChevronRight className="size-3.5 shrink-0 text-stone-400" strokeWidth={1.5} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Right-side Build Agent chat for the portal. "New agent" opens a fresh chat; replies are scripted (PORTAL_TURNS). */
const PortalChat = memo(function PortalChat({ onApply }: { onApply: (change: string) => void }) {
  const [prompt, setPrompt] = useState("")
  /** Chat names (renamable) and which one is open. Seeded chats show the earlier conversation. */
  const [chats, setChats] = useState<PortalChatEntry[]>(() => CHATS.map((name, id) => ({ id, name, seeded: true })))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [renaming, setRenaming] = useState(false)
  /** Messages sent / received this session, per chat id. */
  const [messages, setMessages] = useState<Record<number, PortalMessage[]>>({})
  /** The agent is thinking (before its reply starts streaming). */
  const [thinking, setThinking] = useState(false)
  /** Chat whose agent is working (thinking or streaming its reply), if any. */
  const [busyChat, setBusyChat] = useState<number | null>(null)
  const busy = busyChat !== null
  const nextId = useRef(1)
  const nextChatId = useRef(CHATS.length)
  /** Indexes of the PORTAL_TURNS used so far (each plays once per session). */
  const usedTurns = useRef(new Set<number>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const empty = prompt.trim() === ""
  const current = chats[currentIndex]
  const currentMessages = messages[current.id] ?? []

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Keep the newest message in view as replies stream in.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, thinking, currentIndex])

  function endRename(name: string | null) {
    setRenaming(false)
    if (name) setChats((c) => c.map((chat, i) => (i === currentIndex ? { ...chat, name } : chat)))
  }

  function newAgent() {
    const id = nextChatId.current++
    setChats((c) => [{ id, name: "New agent", seeded: false }, ...c])
    setCurrentIndex(0)
  }

  function addMessage(chatId: number, message: PortalMessage) {
    setMessages((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), message] }))
  }

  function patchMessage(chatId: number, id: number, patch: Partial<PortalMessage>) {
    setMessages((all) => ({ ...all, [chatId]: (all[chatId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  }

  function send() {
    const text = prompt.trim()
    if (text === "" || busy) return
    const chatId = current.id
    addMessage(chatId, { id: nextId.current++, role: "user", text })
    setPrompt("")

    // Scripted reply: think, stream it in word by word, then apply its change to the preview. The
    // turn written for exactly this message, else the next general one.
    let index = PORTAL_TURNS.findIndex((t, i) => !usedTurns.current.has(i) && t.prompt === text)
    if (index < 0) index = PORTAL_TURNS.findIndex((t, i) => !usedTurns.current.has(i) && t.prompt === undefined)
    if (index >= 0) usedTurns.current.add(index)
    const turn = index >= 0 ? PORTAL_TURNS[index] : PORTAL_FALLBACK
    const replyId = nextId.current++
    const words = wordsOf(turn.reply).length
    const at = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms))
    const think = turn.thinkMs ?? PORTAL_THINK_MS
    setBusyChat(chatId)
    setThinking(true)
    at(think, () => {
      setThinking(false)
      addMessage(chatId, { id: replyId, role: "agent", text: turn.reply, shown: 0, turn })
    })
    for (let i = 1; i <= words; i++) at(think + i * PORTAL_WORD_MS, () => patchMessage(chatId, replyId, { shown: i }))
    at(think + words * PORTAL_WORD_MS + 150, () => {
      setBusyChat(null)
      if (turn.applies) onApply(turn.applies)
      if (turn.title) {
        const title = turn.title
        setChats((c) => c.map((chat) => (chat.id === chatId && chat.name === "New agent" ? { ...chat, name: title } : chat)))
      }
    })
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col bg-white">
      <header className="relative flex h-10 shrink-0 items-center justify-between gap-2 pl-3 pr-2">
        <ChatSwitcher
          chats={chats.map((c) => c.name)}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          renaming={renaming}
          onRenameEnd={endRename}
          working={busyChat === current.id}
        />
        <div className="flex shrink-0 items-center gap-0.5 text-stone-700">
          <BarButton label="New agent" onClick={newAgent}>
            <Plus className="size-4" strokeWidth={1.5} />
          </BarButton>
          <MoreOptionsMenu onRename={() => setRenaming(true)} />
        </div>
      </header>

      <div
        ref={listRef}
        data-cursor-id="portal-chat-messages"
        className="flex min-h-0 flex-1 select-text flex-col gap-3 overflow-y-auto px-4 pb-4 pt-2 text-px-13 leading-[18px] text-stone-800"
      >
        {!current.seeded && currentMessages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center animate-in fade-in duration-200">
            <span className="flex size-8 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <AgentStar className="size-4" />
            </span>
            <p className="max-w-[220px] text-stone-500">Ask for a change and watch it land in the live app.</p>
          </div>
        )}
        {current.seeded && (
          <>
        <p className="select-text">
          The app you see at <Code>/</Code> is the Fairbnb home page, and it&apos;s built from <strong>5 files</strong>:
        </p>
        <ol className="flex select-text list-decimal flex-col gap-1.5 pl-5">
          {CHAT_FILES.map((file) => (
            <li key={file.path}>
              <Code>{file.path}</Code>: {file.note}
            </li>
          ))}
        </ol>
        <p className="select-text">
          Together they come to about 800 lines. It also uses the shared <Code>cn</Code> helper in{" "}
          <Code>src/lib/utils.ts</Code>, and the listing photos in <Code>public/fairbnb</Code>.
        </p>
        <MessageMeta />

        <UserBubble>
          can you create a copy of the files in a folder title &quot;copy-project&quot; without the browser window? The rest
          should be included
        </UserBubble>

        <button type="button" className="-ml-0.5 flex items-center gap-1 self-start text-stone-600 hover:text-stone-900">
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
          Worked for 4 minutes
        </button>

        <p className="select-text">
          I made a copy of the app in a new <Code>copy-project</Code> folder, without the browser window. Because
          it&apos;s inside the app folder (<Code>src/app/copy-project/</Code>), it also works as its own page at{" "}
          <Code>/copy-project</Code>. I haven&apos;t opened that page, so how it looks is unchecked. The original at{" "}
          <Code>/</Code> is untouched.
        </p>
        <p className="font-semibold text-stone-900">What&apos;s in the folder:</p>
        <ul className="flex select-text list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>page.tsx</strong> replaces <Code>fairbnb-device.tsx</Code>, which held the browser window. It shows
            just the screen, centred on white, at the same 1440×900 proportions it had inside the window.
          </li>
          <li>
            <strong>fairbnb-screen.tsx</strong>, <strong>fairbnb-data.ts</strong>, <strong>use-fairbnb-intro.ts</strong>{" "}
            and <strong>utils.ts</strong> are exact copies of the originals. The
            only change is that their imports point at each other inside the folder, so the copy doesn&apos;t depend on
            the original files.
          </li>
        </ul>
        <p className="font-semibold text-stone-900">Two things to know:</p>
        <ul className="flex select-text list-disc flex-col gap-1.5 pl-5">
          <li>
            The avatar and the photos in <Code>public/fairbnb</Code> still come from
            the shared <Code>public</Code> folder rather than being duplicated.
          </li>
          <li>
            The photos load through <Code>next/image</Code>, so the copy gets the same resized versions as the original.
          </li>
        </ul>
        <p className="select-text">
          If you meant a standalone folder outside the app instead of a page inside it, I can move it.
        </p>
        <p className="text-px-11 font-medium tabular-nums">
          <span className="text-green-700">+812</span> <span className="text-red-600">−0</span>
        </p>
        <MessageMeta />
          </>
        )}

        {currentMessages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id}>{m.text}</UserBubble>
          ) : (
            <div key={m.id} className="flex flex-col gap-2">
              <p className="select-text">
                {m.shown === undefined ? m.text : wordsOf(m.text).slice(0, m.shown).join("")}
              </p>
              {m.turn && (m.shown ?? 0) >= wordsOf(m.text).length && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                  <span className="-ml-0.5 flex items-center gap-1 text-stone-600">
                    <ChevronRight className="size-3.5" strokeWidth={1.5} />
                    {m.turn.workedFor}
                  </span>
                  <p className="text-px-11 font-medium tabular-nums">
                    <span className="text-green-700">+{m.turn.added}</span>{" "}
                    <span className="text-red-600">−{m.turn.removed}</span>
                  </p>
                  {m.turn.tests && (
                    <div
                      data-cursor-id="portal-test-results"
                      className="flex flex-col gap-1.5 rounded-lg border border-[#c6dfc9] bg-[#f3f8f3] px-2.5 py-2"
                    >
                      <p className="flex items-center gap-1.5 font-medium text-[#1e7b36]">
                        <Check className="size-3.5" strokeWidth={2.25} />
                        {m.turn.tests.passed} tests passed, 0 failed
                      </p>
                      <p className="font-mono text-[12px] text-stone-600">{m.turn.tests.file}</p>
                      <ul className="flex flex-col gap-1">
                        {m.turn.tests.names.map((name) => (
                          <li key={name} className="flex items-start gap-1.5 text-px-12 text-stone-700">
                            <Check className="mt-0.5 size-3 shrink-0 text-[#1e7b36]" strokeWidth={2.25} />
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <MessageMeta when="Just now" />
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <p
            aria-live="polite"
            className="self-start bg-[linear-gradient(110deg,#a8a29e_40%,#44403c_50%,#a8a29e_60%)] bg-[length:300%_100%] bg-clip-text font-medium text-transparent animate-mi-shine"
          >
            Working...
          </p>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="mx-1.5 mb-1.5 flex flex-col rounded-xl border border-stone-200 bg-white px-2.5 pb-2 pt-2.5 shadow-[0_1px_2px_rgba(17,17,16,0.04)]"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="Describe the change..."
          aria-label="Describe the change"
          className="resize-none select-text bg-transparent text-px-13 text-stone-900 outline-none placeholder:text-stone-500"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 text-stone-600">
            <BarButton label="Select element" side="top">
              <SquareDashedMousePointer className="size-3.5" strokeWidth={1.5} />
            </BarButton>
            <BarButton label="Capture page" side="top">
              <ScanLine className="size-3.5" strokeWidth={1.5} />
            </BarButton>
          </div>
          <div className="flex items-center gap-1">
            <BarButton label="Dictate" side="top">
              <Mic className="size-3.5" strokeWidth={1.5} />
            </BarButton>
            <button
              type="submit"
              disabled={empty}
              aria-label="Send"
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors",
                empty ? "bg-stone-200/80 text-stone-400" : "bg-[#2f6bf6] text-white hover:bg-[#2159dc]",
              )}
            >
              <ArrowUp className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </form>
    </aside>
  )
})

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[85%] select-text self-end whitespace-pre-wrap break-words rounded-[14px] bg-stone-100 px-2.5 py-1.5 text-stone-900">
      {children}
    </p>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[3px] bg-stone-100 px-1 py-px font-mono text-[12px] text-stone-900">{children}</code>
}

/**
 * Thumbs + timestamp under an agent reply. Like the Build Agent chat, a thumb toggles on click
 * (blue outline when given, with the row slightly faded) and giving one replaces the other.
 */
function MessageMeta({ when = "1 day ago" }: { when?: string }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)

  function rate(value: "up" | "down") {
    setFeedback((current) => (current === value ? null : value))
  }

  return (
    <div className={cn("-ml-1.5 flex items-center gap-0.5 transition-opacity", feedback && "opacity-70")}>
      <BarButton label="Good response" side="top" pressed={feedback === "up"} onClick={() => rate("up")}>
        <ThumbsUp
          className={cn("size-3.5", feedback === "up" ? "text-[#2f6bf6]" : "text-stone-400")}
          strokeWidth={1.75}
        />
      </BarButton>
      <BarButton label="Bad response" side="top" pressed={feedback === "down"} onClick={() => rate("down")}>
        <ThumbsDown
          className={cn("size-3.5", feedback === "down" ? "text-[#2f6bf6]" : "text-stone-400")}
          strokeWidth={1.75}
        />
      </BarButton>
      <span className="ml-1 text-px-13 text-stone-500">{when}</span>
    </div>
  )
}

/** Smallest gap, in px, a label keeps from the window's left/right edge. */
const TOOLTIP_EDGE_GAP = 8

/**
 * Horizontal area a label may occupy: the window, narrowed to the nearest ancestor whose
 * overflow clips (anything past its edges would be cut off).
 */
function tooltipBounds(el: HTMLElement): { left: number; right: number } {
  let left = 0
  let right = window.innerWidth
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node)
    if (overflowX !== "visible" || overflowY !== "visible") {
      const r = node.getBoundingClientRect()
      left = Math.max(left, r.left)
      right = Math.min(right, r.right)
      break
    }
  }
  return { left, right }
}

/**
 * Icon button with a hover/focus label. `side` puts the label below (default) or above the
 * button; `align="end"` right-aligns it. Either way the label is nudged to stay on screen.
 */
function BarButton({
  label,
  onClick,
  side = "bottom",
  align = "center",
  active,
  pressed,
  children,
}: {
  label: string
  onClick?: () => void
  side?: "top" | "bottom"
  align?: "center" | "end"
  /** The button's menu is open: keep it highlighted and hide the label. */
  active?: boolean
  /** Toggle button state (e.g. a thumb that's been given). */
  pressed?: boolean
  children: React.ReactNode
}) {
  /** Horizontal px nudge that keeps the label inside the window (0 = default placement). */
  const [shift, setShift] = useState(0)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  /**
   * Measure the label where it would sit unshifted and nudge it back inside its bounds: the
   * window, narrowed to the nearest ancestor that clips overflow (e.g. the chat's scrolling list).
   */
  function fitTooltip() {
    const tip = tooltipRef.current
    if (!tip) return
    const rect = tip.getBoundingClientRect()
    // `shift` is in layout px; the rects are screen px (the screen may be drawn scaled).
    const k = screenScale(tip)
    const left = rect.left - shift * k
    const right = rect.right - shift * k
    const bounds = tooltipBounds(tip)
    const minLeft = bounds.left + TOOLTIP_EDGE_GAP
    const maxRight = bounds.right - TOOLTIP_EDGE_GAP
    if (left < minLeft) setShift((minLeft - left) / k)
    else if (right > maxRight) setShift((maxRight - right) / k)
    else setShift(0)
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={fitTooltip}
      onFocus={fitTooltip}
      aria-expanded={active}
      aria-pressed={pressed}
      className={cn(
        "group relative flex size-7 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5",
        active && "bg-stone-700/5",
      )}
    >
      {children}
      <span
        ref={tooltipRef}
        role="tooltip"
        style={{ marginLeft: shift }}
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] font-normal leading-4 text-stone-800 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
          side === "bottom" ? "top-full mt-1.5 -translate-y-1" : "bottom-full mb-1.5 translate-y-1",
          align === "center" ? "left-1/2 -translate-x-1/2" : "right-0",
          active && "hidden",
        )}
      >
        {label}
      </span>
    </button>
  )
}

/** Chat header "More options": a menu with Rename (renames the open chat) and Archive (unavailable). */
function MoreOptionsMenu({ onRename }: { onRename: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <BarButton label="More options" align="end" active={open} onClick={() => setOpen((o) => !o)}>
        <Ellipsis className="size-4" strokeWidth={1.5} />
      </BarButton>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 flex w-[180px] flex-col rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onRename()
            }}
            className="flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-900 hover:bg-stone-700/5"
          >
            <SquarePen className="size-3.5 shrink-0 text-stone-600" strokeWidth={1.5} />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            className="flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-400"
          >
            <Archive className="size-3.5 shrink-0" strokeWidth={1.5} />
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------- Viewport -------------------------------- */

type Viewport = { id: string; name: string; detail: string; icon: LucideIcon }

const VIEWPORTS: Viewport[] = [
  { id: "full", name: "Full width", detail: "Fill the stage", icon: Scaling },
  { id: "mobile", name: "Mobile", detail: "390 × 844", icon: Smartphone },
  { id: "tablet", name: "Tablet", detail: "768 × 1024", icon: Tablet },
  { id: "laptop", name: "Laptop", detail: "1280 × 800", icon: Laptop },
  { id: "desktop", name: "Desktop", detail: "1440 × 900", icon: Monitor },
]

/** Viewport picker: the trigger shows the chosen viewport's icon; click opens the list. */
function ViewportSelect() {
  const [selectedId, setSelectedId] = useState("desktop")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const TriggerIcon = VIEWPORTS.find((v) => v.id === selectedId)?.icon ?? Scaling

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Viewport"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-1.5 text-stone-800 hover:bg-stone-700/5",
          open && "bg-stone-700/5",
        )}
      >
        <TriggerIcon className="size-4" strokeWidth={1.5} />
        <ChevronDown
          className={cn("size-3 text-stone-500 transition-transform duration-200", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Viewport"
          className="absolute right-0 top-full z-50 mt-1.5 flex w-[220px] flex-col rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {VIEWPORTS.map(({ id, name, detail, icon: Icon }) => (
            <li key={id} role="option" aria-selected={id === selectedId}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-stone-100",
                  id === selectedId && "bg-stone-100",
                )}
              >
                <Icon className="size-4 shrink-0 text-stone-800" strokeWidth={1.5} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-px-13 font-medium leading-[18px] text-stone-900">{name}</span>
                  <span className="text-px-11 leading-4 tabular-nums text-stone-500">{detail}</span>
                </span>
                {id === selectedId && <Check className="size-4 shrink-0 text-stone-800" strokeWidth={1.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
