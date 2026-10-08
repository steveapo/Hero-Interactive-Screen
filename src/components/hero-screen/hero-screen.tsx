"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { ArrowLeft, Check, Ellipsis, SquarePen, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { screenScale } from "@/lib/screen-scale"
import { COMPONENT_PULL_REQUEST, PULL_REQUEST, type PullRequest } from "./agent-script"
import { AgentsPopover } from "./agents-popover"
import { BuildAgentComposer, COMPOSER_HEIGHT, COMPOSER_WIDTH } from "./build-agent-composer"
import { useBuildAgents, type PlaceVariants, type VariantState } from "./build-agents"
import { AIRBNB_ELEMENTS } from "./airbnb-elements"
import { CanvasText, DrawnFrame, TEXT_LINE_HEIGHT, type CanvasElement } from "./canvas-elements"
import { builtVariantChange } from "./built-change"
import { CODE_CHANGES, CodeChangesPopover, totalsOf } from "./code-changes-popover"
import { CodebaseFrame, CANVAS_ZOOM, CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"
import { CodebaseSettingsPanel } from "./codebase-settings-panel"
import { trackDrag, useMeasuredRect, type CanvasRect } from "./drag"
import { FrameSettingsPanel } from "./frame-settings-panel"
import { GithubButton } from "./github-popover"
import { LeftSidebar } from "./left-sidebar"
import {
  builtComponentsChange,
  ComponentDragGhost,
  ComponentSettingsPanel,
  FrameComponentsLayer,
  NEW_BADGE,
  NEW_BADGE_SIZE,
  type FrameComponent,
  type InsertableComponent,
} from "./library-components"
import { BuildAgentButton, DesignFrame, type CanvasEntrance, type Corner } from "./planner-frame"
import { PortalView } from "./portal-view"
import { ShareButton } from "./share-popover"
import { TextSettingsPanel } from "./text-settings-panel"
import { AgentCursor, agentPartSelector, VariantFrame } from "./variant-frame"

type Tool = "select" | "frame" | "text" | "code"

/* ------------------------------ Camera limits ------------------------------ */
// The hero canvas is a showcase, not an infinite canvas: zoom and pan are both bounded.

/**
 * Furthest the user can zoom out / in: 12% to 40% in the zoom readout (the canvas opens at 30%).
 * Zoomed right out, the ring of explored screens around the app's elements comes into view.
 */
const MIN_ZOOM = 0.12
const MAX_ZOOM = 0.4

/**
 * Pan limits follow the frames: the viewport centre can travel over the area the frames cover
 * (plus this margin, in canvas units), so a moved frame can never end up out of reach.
 */
const PAN_MARGIN_X = 20
const PAN_MARGIN_Y = 10

/** Wheel → zoom sensitivity for pinch / ⌘-scroll. */
const WHEEL_ZOOM_SPEED = 0.01

/** Smallest a frame can be resized to, in canvas units. */
const MIN_FRAME_SIZE = 80

/** Frames drawn with the Frame tool: a plain click makes one this size; resizing stops at the min. */
const DEFAULT_NEW_FRAME_SIZE = 100
const MIN_NEW_FRAME_SIZE = 1

/** Centre-based rect of a top-left-positioned drawn element (for bounds and hit tests). */
function elementRect(el: CanvasElement): CanvasRect {
  return { x: el.x + el.w / 2, y: el.y + el.h / 2, w: el.w, h: el.h }
}

/** Screen-px gap between the Build Agent input and the frame / side panels / screen edges. */
const COMPOSER_GAP = 12
/** Top bar height: the input never slides under it. */
const TOP_BAR_HEIGHT = 44
/** Measured sizes (for the Build Agent chat's placement) update once a resize has settled (ms). */
const MEASURE_SETTLE_MS = 120
/** A top-bar group's panel: the side panels' background, border and shadow, in a 36px pill that
 * fits the 32px buttons (1px border + 1px padding). */
const TOP_GROUP =
  "h-9 rounded-xl border border-stone-700/10 bg-[#f2f2f1] p-px shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)]"

/**
 * Canvas entrance after leaving the Portal: elements start this fraction of their (screen-px)
 * distance from the Codebase frame further out, at least ENTER_MIN_TRAVEL px. Their delays sweep
 * clockwise around the frame over ENTER_SWEEP_MS, starting at the top-left diagonal; the sweep is
 * shorter than each element's glide (see ENTRANCE_DURATION_MS in planner-frame), so sides overlap.
 */
const ENTER_SPREAD = 0.6
const ENTER_MIN_TRAVEL = 60
/** Portal fade-out before the canvas entrance starts (matches PortalView's `closing` transition). */
const PORTAL_EXIT_MS = 300
/** After the Portal opens, it has faded in (150ms) and fully covers the canvas by then (ms). */
const PORTAL_COVER_MS = 400
const ENTER_BASE_DELAY = 120
const ENTER_SWEEP_MS = 1440
/** Where the sweep starts, in turns clockwise from straight up (−⅛ = the top-left diagonal). */
const ENTER_SWEEP_START = -1 / 8

/**
 * Build Agent variants: each source's variants form a row below everything on the canvas, starting
 * under the source's left edge, VARIANT_GAP apart; rows are VARIANT_ROW_GAP apart (canvas units).
 */
const VARIANT_GAP = 90
const VARIANT_ROW_GAP = 240
/** Screen-px gap from the agent's cursor badge to the corner of the piece it's editing. */
const AGENT_CURSOR_INSET = 2

/** x/y: screen-px offset of the canvas origin from the viewport centre. */
type Camera = { x: number; y: number; zoom: number }

/**
 * Canvas-unit area the viewport centre may pan over, and the canvas's `fit`: its width over
 * REFERENCE_CANVAS_WIDTH. Zoom levels (the opening view, the limits, every scripted zoom) are
 * tuned at the reference width and scale with the fit, so the canvas shows the same composition
 * at any screen size.
 */
type Bounds = { minX: number; maxX: number; minY: number; maxY: number; fit: number }

/** Canvas width (px) the zoom levels are tuned at; see Bounds.fit. */
const REFERENCE_CANVAS_WIDTH = 1280

/** Selection box in screen px. */
type Marquee = { left: number; top: number; width: number; height: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function frameBounds(rects: CanvasRect[], fit: number): Bounds {
  return {
    minX: Math.min(...rects.map((r) => r.x - r.w / 2)) - PAN_MARGIN_X,
    maxX: Math.max(...rects.map((r) => r.x + r.w / 2)) + PAN_MARGIN_X,
    minY: Math.min(...rects.map((r) => r.y - r.h / 2)) - PAN_MARGIN_Y,
    maxY: Math.max(...rects.map((r) => r.y + r.h / 2)) + PAN_MARGIN_Y,
    fit,
  }
}

function clampCamera({ x, y, zoom }: Camera, bounds: Bounds): Camera {
  const z = clamp(zoom, MIN_ZOOM * bounds.fit, MAX_ZOOM * bounds.fit)
  return {
    zoom: z,
    x: clamp(x, -bounds.maxX * z, -bounds.minX * z),
    y: clamp(y, -bounds.maxY * z, -bounds.minY * z),
  }
}

/** Zoom to `nextZoom`, keeping the point under the cursor (px, py from viewport centre) fixed. */
function zoomAt(camera: Camera, nextZoom: number, px: number, py: number, bounds: Bounds): Camera {
  const zoom = clamp(nextZoom, MIN_ZOOM * bounds.fit, MAX_ZOOM * bounds.fit)
  const ratio = zoom / camera.zoom
  return clampCamera({ zoom, x: px - (px - camera.x) * ratio, y: py - (py - camera.y) * ratio }, bounds)
}

/**
 * Opening view: the Codebase frame (centred on the canvas origin) centred in the viewport, with
 * the Fairbnb desktop elements spread around it. This is the view at the reference width; it's
 * scaled to the canvas's real width before the first paint (see the fit effect in HeroScreen).
 */
function initialCamera(): Camera {
  return { zoom: CANVAS_ZOOM, x: 0, y: 0 }
}

/** Safari's trackpad-pinch event (not in lib.dom). */
type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number }

/**
 * Where the screen opens (the demo clips each start from one of these):
 * - "portal": in the Portal, the live app (default).
 * - "canvas": on the canvas, the Portal already left.
 * - "designed": on the canvas, with the "Check in" badge designed into the trip card's frame.
 * - "built": like "designed", and that badge is already built into the codebase (live app).
 */
export type HeroStart = "portal" | "canvas" | "designed" | "built"

/** Badge size in the trip card frame, in canvas units (a large "Check in", see library-components). */
const DESIGNED_BADGE_SIZE = { w: 8 * (CODEBASE_WIDTH / 100), h: 2.55 * (CODEBASE_WIDTH / 100) }

/**
 * The "Check in" badge as the demo designs it: red, large, in the trip card's top-right corner,
 * inset by the card's own padding (≈ 4.5% of its width).
 */
function designedCheckInBadge(): FrameComponent {
  const card = AIRBNB_ELEMENTS.find((el) => el.id === "card-upcoming-trip")!
  const inset = card.rect.w * 0.045
  return {
    id: "component-1",
    component: "Badge",
    frameId: card.id,
    cardTitle: card.cardTitle!,
    x: card.rect.w - inset - DESIGNED_BADGE_SIZE.w,
    y: inset,
    label: "Check in",
    tone: "red",
    size: "lg",
  }
}

export function HeroScreen({
  className,
  reopened = false,
  start = "portal",
}: {
  className?: string
  /** Follows a previous demo run: open the Portal out of the canvas colour it ended on. */
  reopened?: boolean
  /** Where the screen opens; see HeroStart. Only read on mount. */
  start?: HeroStart
} = {}) {
  /** Library components already in frames when the screen opens. */
  const [seededComponents] = useState<FrameComponent[]>(() =>
    start === "designed" || start === "built" ? [designedCheckInBadge()] : [],
  )
  const [tool, setTool] = useState<Tool>("select")
  const [codebaseSelected, setCodebaseSelected] = useState(false)
  /** Ids of the selected Fairbnb element frames. */
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [agentOpen, setAgentOpen] = useState(false)
  /** Simulated Build Agents: sessions per selection, the variants they generate, their cursors. */
  const agents = useBuildAgents(start === "built" ? seededComponents : [])
  /** Where each generating agent's cursor sits, in canvas units (measured from the piece it edits). */
  const [cursorAt, setCursorAt] = useState<Record<number, { x: number; y: number }>>({})
  /** "Choose where to build" is on for this agent session: clicking one of its variants builds it. */
  const [pickSession, setPickSession] = useState<number | null>(null)
  /** Code changes made this session (the built variant's / components' diffs) on top of the project's. */
  // Memoized (along with what's derived from it) so the top bar's memoized controls skip camera frames.
  const { builtComponents, builtVariant } = agents
  const sessionChanges = useMemo(
    () => [
      ...(builtComponents.length > 0 ? [builtComponentsChange(builtComponents)] : []),
      ...(builtVariant ? [builtVariantChange(builtVariant)] : []),
    ],
    [builtComponents, builtVariant],
  )
  const changeTotals = useMemo(() => totalsOf([...sessionChanges, ...CODE_CHANGES]), [sessionChanges])
  const githubChanges = useMemo(
    () => ({ files: sessionChanges.length + CODE_CHANGES.length, ...changeTotals }),
    [sessionChanges, changeTotals],
  )
  /** The agents' thumbs for the AgentsPopover (memoized: it only changes with the sessions). */
  const agentThumbs = useMemo(() => agents.sessions.map((s) => ({ id: s.id, working: s.working })), [agents.sessions])
  /** What syncing opens: the library-component story's PR once a frame was built, else the variants one. */
  const pullRequest: PullRequest = agents.builtComponents.length > 0 ? COMPONENT_PULL_REQUEST : PULL_REQUEST
  /** Library components dropped into frames (see library-components), and the selected one. */
  const [frameComponents, setFrameComponents] = useState<FrameComponent[]>(seededComponents)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const selectedComponent = frameComponents.find((c) => c.id === selectedComponentId)
  const nextComponentId = useRef(seededComponents.length + 1)
  /** A library component being dragged out of the sidebar: the ghost's spot, in root px. */
  const [libraryDrag, setLibraryDrag] = useState<{ x: number; y: number } | null>(null)
  /** The pull request was merged: the canvas closes (end of the story). */
  const [canvasClosed, setCanvasClosed] = useState(false)
  const closeCanvas = useCallback(() => setCanvasClosed(true), [])
  /** Rendered Build Agent height (it grows with the chat), so it can be kept on screen. */
  const [composerHeight, setComposerHeight] = useState(COMPOSER_HEIGHT)
  const [changesOpen, setChangesOpen] = useState(false)
  const closeChanges = useCallback(() => setChangesOpen(false), [])
  /**
   * The Codebase frame is open in the Portal View (double-click the frame). The screen opens
   * inside the Portal; leaving it reveals the canvas.
   */
  const [portalOpen, setPortalOpen] = useState(start === "portal")
  /** The Portal is fading out (PORTAL_EXIT_MS); the canvas elements stay hidden until it's gone. */
  const [portalClosing, setPortalClosing] = useState(false)
  /** Bumped once the Portal has closed: the canvas elements replay their entrance (see `entranceFor`). */
  const [revealId, setRevealId] = useState(0)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Sequence: fade the Portal out first, then unmount it and start the canvas entrance. Only the
  // first close plays the entrance; after that the elements are simply there when the Portal goes.
  // A screen that opened on the canvas never plays it (its elements were there from the start).
  const opensInPortal = start === "portal"
  const closePortal = useCallback(() => {
    if (closeTimerRef.current !== undefined) return // already closing
    setPortalClosing(true)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined
      setPortalClosing(false)
      setPortalOpen(false)
      if (opensInPortal) setRevealId((id) => (id === 0 ? 1 : id))
    }, PORTAL_EXIT_MS)
  }, [opensInPortal])
  useEffect(() => () => clearTimeout(closeTimerRef.current), [])
  const [camera, setCamera] = useState<Camera>(initialCamera)
  const [panning, setPanning] = useState(false)
  /** Select-tool selection box, in screen px relative to the hero root. */
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  /** Frame positions/sizes in canvas units (centre-based); the Codebase frame starts at the origin. */
  const [codebaseRect, setCodebaseRect] = useState<CanvasRect>({ x: 0, y: 0, w: CODEBASE_WIDTH, h: CODEBASE_HEIGHT })
  const [elementRects, setElementRects] = useState<Record<string, CanvasRect>>(() =>
    Object.fromEntries(AIRBNB_ELEMENTS.map((el) => [el.id, el.rect])),
  )
  /** Corner radius per Fairbnb element frame, in canvas units (null = square); editable via the radius thumbs. */
  const [elementRadii, setElementRadii] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(AIRBNB_ELEMENTS.map((el) => [el.id, el.radius])),
  )
  const canvasRef = useRef<HTMLDivElement>(null)
  /**
   * The canvas's width over REFERENCE_CANVAS_WIDTH (see Bounds). Measured before the first paint
   * and on every resize; when it changes, the camera is scaled by the same ratio (zoom and pan
   * offset alike), so whatever was in view stays in view at the same place, just larger or smaller.
   */
  const [fit, setFit] = useState(1)
  const fitRef = useRef(1)
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const canvas = el
    function measure() {
      const width = canvas.clientWidth
      if (!width) return
      const next = width / REFERENCE_CANVAS_WIDTH
      const ratio = next / fitRef.current
      if (Math.abs(ratio - 1) < 1e-4) return
      fitRef.current = next
      setFit(next)
      setCamera((c) => ({ zoom: c.zoom * ratio, x: c.x * ratio, y: c.y * ratio }))
    }
    measure()
    // Applied synchronously, within the frame that resized the canvas (ResizeObserver runs after
    // layout, before paint). A regular update would commit after that frame is painted, so while
    // the hero window grows with the page scroll the canvas would trail its window by a frame and
    // wobble; flushed here, the window and its contents move as one.
    const observer = new ResizeObserver(() => flushSync(measure))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  /**
   * The Portal has fully faded in over the canvas (it's opaque and covers the whole screen). The
   * Codebase frame's live app underneath is then skipped from rendering (see CodebaseFrame's
   * `covered`): it keeps its state, but no longer re-lays out and repaints, unseen, on every frame
   * of the hero window's growth or its intro. It's back the moment the Portal starts closing (and
   * while the Portal fades in over it), so nothing visible ever changes.
   */
  const [portalSettled, setPortalSettled] = useState(false)
  useEffect(() => {
    if (!portalOpen || portalClosing) return
    const timer = setTimeout(() => setPortalSettled(true), PORTAL_COVER_MS)
    return () => {
      clearTimeout(timer)
      setPortalSettled(false)
    }
  }, [portalOpen, portalClosing])
  const canvasCovered = portalSettled && portalOpen && !portalClosing
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  /** Frames and text the user adds with the Frame / Text tools (selected via `selectedIds` too). */
  const [drawnElements, setDrawnElements] = useState<CanvasElement[]>([])
  /** Text element whose content is being typed. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const nextDrawnId = useRef(1)
  const frameCount = useRef(0)
  // The root and the settings panel resize every frame while the hero window grows / shrinks with
  // the page scroll; re-measure once that settles rather than re-rendering the screen each frame
  // (the canvas itself is laid out in CSS and follows along on its own).
  const [rootRef, rootRect, rootBox] = useMeasuredRect(MEASURE_SETTLE_MS)
  const [sidebarRef, , sidebarBox] = useMeasuredRect()
  const [panelRef, , panelBox] = useMeasuredRect(MEASURE_SETTLE_MS)

  /**
   * A screen point (pointer clientX / Y) in the root's layout px, with the root's layout size.
   * The hero window may draw the screen scaled while it grows (see lib/screen-scale), so screen
   * distances are divided by that scale; unscaled it's a plain offset. Measured fresh, so it's
   * right wherever the page has scrolled to. (The canvas fills the root exactly.)
   */
  function toLocal(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    const k = screenScale(canvas)
    return { x: (clientX - r.left) / k, y: (clientY - r.top) / k, width: r.width / k, height: r.height / k, k }
  }

  /** The one element frame that owns the settings panel and Build Agent (single selection only). */
  const activeElement =
    !codebaseSelected && selectedIds.length === 1 ? AIRBNB_ELEMENTS.find((el) => el.id === selectedIds[0]) : undefined
  const activeRect = activeElement ? elementRects[activeElement.id] : undefined
  /** A single selected drawn frame / text (its settings panel shows). */
  const activeDrawn =
    !codebaseSelected && selectedIds.length === 1 ? drawnElements.find((el) => el.id === selectedIds[0]) : undefined

  // The native wheel/gesture listeners are registered once, so they read the bounds from a ref.
  const bounds = useMemo(
    () =>
      frameBounds(
        [codebaseRect, ...Object.values(elementRects), ...drawnElements.map(elementRect), ...agents.variants.map((v) => v.rect)],
        fit,
      ),
    [codebaseRect, elementRects, drawnElements, agents.variants, fit],
  )
  /** What the Share button compares against its last publish (memoized: same values, same array). */
  const shareChanges = useMemo(
    () => [drawnElements, elementRects, elementRadii, frameComponents],
    [drawnElements, elementRects, elementRadii, frameComponents],
  )
  const boundsRef = useRef(bounds)
  useEffect(() => {
    boundsRef.current = bounds
  })

  // Clicking a frame that's already part of the selection keeps the selection (so a
  // multi-selection can be dragged together); clicking an unselected frame selects only it.
  function selectCodebase() {
    if (codebaseSelected) return
    setCodebaseSelected(true)
    setSelectedIds([])
    setSelectedComponentId(null)
    setAgentOpen(false)
  }

  /** Select a frame; with Shift, add it to (or remove it from) the selection instead. */
  function selectElement(id: string, additive = false) {
    setSelectedComponentId(null)
    if (additive) {
      setAgentOpen(false)
      setCodebaseSelected(false)
      setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))
      return
    }
    if (selectedIds.includes(id)) return
    setAgentOpen(false)
    setSelectedIds([id])
    setCodebaseSelected(false)
  }

  /**
   * Drag a frame with the Select tool: screen-px movement ÷ zoom = canvas units. Pressing a frame
   * that was already selected moves every selected frame; otherwise only the pressed one.
   * Shift-presses only change the selection.
   */
  function startMove(e: React.PointerEvent, frame: "codebase" | { elementId: string }) {
    if (tool !== "select" || e.button !== 0 || e.shiftKey) return
    const zoom = camera.zoom
    const pressedId = frame === "codebase" ? null : frame.elementId
    const wasSelected = pressedId === null ? codebaseSelected : selectedIds.includes(pressedId)
    const moveCodebase = pressedId === null || (wasSelected && codebaseSelected)
    const movedIds = wasSelected ? selectedIds : pressedId === null ? [] : [pressedId]
    const fromCodebase = codebaseRect
    const fromElements = elementRects
    const fromDrawn = drawnElements
    trackDrag(e, (dx, dy) => {
      if (moveCodebase) setCodebaseRect({ ...fromCodebase, x: fromCodebase.x + dx / zoom, y: fromCodebase.y + dy / zoom })
      if (movedIds.length === 0) return
      setElementRects((current) => {
        const next = { ...current }
        for (const id of movedIds) {
          const from = fromElements[id]
          if (!from) continue // a drawn element, moved below
          next[id] = { ...from, x: from.x + dx / zoom, y: from.y + dy / zoom }
        }
        return next
      })
      const moved = new Map(
        fromDrawn.filter((el) => movedIds.includes(el.id)).map((el) => [el.id, { x: el.x + dx / zoom, y: el.y + dy / zoom }]),
      )
      if (moved.size > 0) setDrawnElements((els) => els.map((el) => (moved.has(el.id) ? { ...el, ...moved.get(el.id) } : el)))
    })
  }

  /** Screen point → canvas units. */
  function toCanvas(clientX: number, clientY: number) {
    const p = toLocal(clientX, clientY)
    return {
      x: (p.x - p.width / 2 - camera.x) / camera.zoom,
      y: (p.y - p.height / 2 - camera.y) / camera.zoom,
    }
  }

  /**
   * Frame / Text tool press anywhere on the canvas. Frame: drag to draw (a click drops a default
   * size frame). Text: place a text element and start typing. Either way, the new element gets
   * selected and the tool returns to Select.
   */
  function startCreate(e: React.PointerEvent) {
    if (!rootRect) return
    const origin = toCanvas(e.clientX, e.clientY)
    const id = `drawn-${nextDrawnId.current++}`
    setCodebaseSelected(false)
    setAgentOpen(false)

    if (tool === "text") {
      // Keep focus off the canvas so the new text can take it.
      e.preventDefault()
      setDrawnElements((els) => [
        ...els,
        { id, kind: "text", name: "Text", content: "", x: origin.x, y: origin.y - TEXT_LINE_HEIGHT / 2, w: 0, h: TEXT_LINE_HEIGHT },
      ])
      setSelectedIds([id])
      setEditingId(id)
      setTool("select")
      return
    }

    const name = `Frame ${++frameCount.current}`
    const zoom = camera.zoom
    let drawn = false
    setSelectedIds([])
    trackDrag(
      e,
      (dx, dy) => {
        const box = {
          x: origin.x + Math.min(0, dx) / zoom,
          y: origin.y + Math.min(0, dy) / zoom,
          w: Math.max(MIN_NEW_FRAME_SIZE, Math.abs(dx) / zoom),
          h: Math.max(MIN_NEW_FRAME_SIZE, Math.abs(dy) / zoom),
        }
        if (!drawn) {
          drawn = true
          setDrawnElements((els) => [...els, { id, kind: "frame", name, ...box }])
          setSelectedIds([id])
        } else {
          setDrawnElements((els) => els.map((el) => (el.id === id ? { ...el, ...box } : el)))
        }
      },
      () => {
        if (!drawn) {
          setDrawnElements((els) => [
            ...els,
            { id, kind: "frame", name, x: origin.x, y: origin.y, w: DEFAULT_NEW_FRAME_SIZE, h: DEFAULT_NEW_FRAME_SIZE },
          ])
        }
        setSelectedIds([id])
        setTool("select")
      },
    )
  }

  /**
   * Drag a component out of the Components library: a ghost follows the pointer; dropped on an
   * event frame, an instance lands there (centred on the drop point) and gets selected. Dropped
   * anywhere else (back on the sidebar, empty canvas, a non-event frame), nothing is added: only
   * event cards can carry it into the live app.
   */
  function startLibraryDrag(e: React.PointerEvent, component: InsertableComponent) {
    if (!rootRect) return
    const startX = e.clientX
    const startY = e.clientY
    // The ghost is placed in the root's layout px; the drop is hit-tested at the screen point.
    const start = toLocal(startX, startY)
    let last: { clientX: number; clientY: number } | null = null
    trackDrag(
      e,
      (dx, dy) => {
        last = { clientX: startX + dx * start.k, clientY: startY + dy * start.k }
        setLibraryDrag({ x: start.x + dx, y: start.y + dy })
      },
      () => {
        setLibraryDrag(null)
        if (last) dropComponent(component, last.clientX, last.clientY)
      },
    )
  }
  /**
   * Stable handle for the (memoized) sidebar: it always runs the latest `startLibraryDrag`, so a
   * press reads the current camera and rects exactly as passing the function directly did.
   */
  const startLibraryDragRef = useRef(startLibraryDrag)
  useLayoutEffect(() => {
    startLibraryDragRef.current = startLibraryDrag
  })
  const onLibraryDragStart = useCallback(
    (e: React.PointerEvent, component: InsertableComponent) => startLibraryDragRef.current(e, component),
    [],
  )

  function dropComponent(component: InsertableComponent, clientX: number, clientY: number) {
    // Hit-tested in the root's layout px (the sidebar's layout box is relative to the root).
    const at = toLocal(clientX, clientY)
    const overSidebar =
      sidebarBox &&
      at.x >= sidebarBox.left &&
      at.x <= sidebarBox.left + sidebarBox.width &&
      at.y >= sidebarBox.top &&
      at.y <= sidebarBox.top + sidebarBox.height
    if (overSidebar) return
    const p = toCanvas(clientX, clientY)
    const inside = (r: CanvasRect) => Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.y - r.y) <= r.h / 2
    // Topmost first: later elements paint over earlier ones. Only cards (they carry a title) take components.
    const target = [...AIRBNB_ELEMENTS].reverse().find((el) => el.cardTitle && inside(elementRects[el.id]))
    const cardTitle = target?.cardTitle
    if (!target || !cardTitle) return
    const r = elementRects[target.id]
    const id = `component-${nextComponentId.current++}`
    setFrameComponents((list) => [
      ...list,
      {
        id,
        component,
        frameId: target.id,
        cardTitle,
        x: Math.max(0, p.x - (r.x - r.w / 2) - NEW_BADGE_SIZE.w / 2),
        y: Math.max(0, p.y - (r.y - r.h / 2) - NEW_BADGE_SIZE.h / 2),
        ...NEW_BADGE,
      },
    ])
    setSelectedComponentId(id)
    setSelectedIds([])
    setCodebaseSelected(false)
    setAgentOpen(false)
  }

  /** Press a component instance: select it; with the Select tool, drag it around inside its frame. */
  function pressComponent(e: React.PointerEvent, id: string) {
    setSelectedComponentId(id)
    setSelectedIds([])
    setCodebaseSelected(false)
    setAgentOpen(false)
    setPickSession(null)
    if (tool !== "select" || e.button !== 0) return
    const from = frameComponents.find((c) => c.id === id)
    if (!from) return
    const zoom = camera.zoom
    trackDrag(e, (dx, dy) =>
      setFrameComponents((list) => list.map((c) => (c.id === id ? { ...c, x: from.x + dx / zoom, y: from.y + dy / zoom } : c))),
    )
  }

  /** Finish typing: empty text is removed, otherwise the content is saved. */
  function commitText(id: string, content: string) {
    setEditingId((current) => (current === id ? null : current))
    if (content.trim() === "") {
      setDrawnElements((els) => els.filter((el) => el.id !== id))
      setSelectedIds((ids) => ids.filter((i) => i !== id))
      return
    }
    setDrawnElements((els) => els.map((el) => (el.id === id && el.kind === "text" ? { ...el, content } : el)))
  }

  function measureText(id: string, w: number, h: number) {
    setDrawnElements((els) => els.map((el) => (el.id === id && (el.w !== w || el.h !== h) ? { ...el, w, h } : el)))
  }

  /** Drag a corner thumb of a drawn frame: the opposite corner stays put. */
  function startDrawnResize(e: React.PointerEvent, id: string, { sx, sy }: Corner) {
    if (e.button !== 0) return
    const from = drawnElements.find((el) => el.id === id)
    if (!from) return
    const zoom = camera.zoom
    trackDrag(e, (dx, dy) => {
      const w = Math.max(MIN_NEW_FRAME_SIZE, from.w + (sx * dx) / zoom)
      const h = Math.max(MIN_NEW_FRAME_SIZE, from.h + (sy * dy) / zoom)
      const box = { w, h, x: sx < 0 ? from.x + from.w - w : from.x, y: sy < 0 ? from.y + from.h - h : from.y }
      setDrawnElements((els) => els.map((el) => (el.id === id ? { ...el, ...box } : el)))
    })
  }

  /** Select tool drag on empty canvas: draw a selection box; frames it touches get selected. */
  function startMarquee(e: React.PointerEvent) {
    if (!rootRect) return
    const origin = toLocal(e.clientX, e.clientY)
    const originX = origin.x
    const originY = origin.y
    const z = camera.zoom
    const centreX = origin.width / 2 + camera.x
    const centreY = origin.height / 2 + camera.y
    const touches = (r: CanvasRect, box: Marquee) =>
      centreX + (r.x - r.w / 2) * z < box.left + box.width &&
      centreX + (r.x + r.w / 2) * z > box.left &&
      centreY + (r.y - r.h / 2) * z < box.top + box.height &&
      centreY + (r.y + r.h / 2) * z > box.top
    trackDrag(
      e,
      (dx, dy) => {
        const box = {
          left: Math.min(originX, originX + dx),
          top: Math.min(originY, originY + dy),
          width: Math.abs(dx),
          height: Math.abs(dy),
        }
        setMarquee(box)
        setCodebaseSelected(touches(codebaseRect, box))
        setSelectedIds([
          ...AIRBNB_ELEMENTS.filter((el) => touches(elementRects[el.id], box)).map((el) => el.id),
          ...drawnElements.filter((el) => touches(elementRect(el), box)).map((el) => el.id),
        ])
      },
      () => setMarquee(null),
    )
  }

  /** Drag a corner thumb: the opposite corner stays put. */
  function startResize(e: React.PointerEvent, { sx, sy }: Corner, elementId: string) {
    if (e.button !== 0) return
    const zoom = camera.zoom
    const from = elementRects[elementId]
    trackDrag(e, (dx, dy) => {
      const w = Math.max(MIN_FRAME_SIZE, from.w + (sx * dx) / zoom)
      const h = Math.max(MIN_FRAME_SIZE, from.h + (sy * dy) / zoom)
      setElementRects((current) => ({
        ...current,
        [elementId]: { w, h, x: from.x + (sx * (w - from.w)) / 2, y: from.y + (sy * (h - from.h)) / 2 },
      }))
    })
  }

  /**
   * Drag a radius thumb: movement diagonally toward the frame's centre (the average of the two
   * axes, in screen px ÷ zoom) grows the radius of all four corners; away from it shrinks it.
   * The radius stays between 0 and half the frame's shorter side, in whole canvas units.
   */
  function startRadiusDrag(
    e: React.PointerEvent,
    { sx, sy }: Corner,
    from: { w: number; h: number; radius: number },
    apply: (radius: number) => void,
  ) {
    if (e.button !== 0) return
    const zoom = camera.zoom
    const maxRadius = Math.min(from.w, from.h) / 2
    trackDrag(e, (dx, dy) => {
      const inward = (-sx * dx - sy * dy) / 2
      apply(Math.round(clamp(from.radius + inward / zoom, 0, maxRadius)))
    })
  }

  /**
   * The Build Agent works on the selected Fairbnb frames (one or several, nothing else
   * selected). `agentRect` is the bounding box of the selection, centre-based, in canvas units.
   */
  const agentIds = !codebaseSelected && selectedIds.length > 0 && selectedIds.every((id) => id in elementRects) ? selectedIds : []
  let agentRect: CanvasRect | undefined
  if (agentIds.length > 0) {
    const rects = agentIds.map((id) => elementRects[id])
    const left = Math.min(...rects.map((r) => r.x - r.w / 2))
    const right = Math.max(...rects.map((r) => r.x + r.w / 2))
    const top = Math.min(...rects.map((r) => r.y - r.h / 2))
    const bottom = Math.max(...rects.map((r) => r.y + r.h / 2))
    agentRect = { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top }
  }
  /**
   * The selection's chat. A single frame with no chat of its own picks up the latest chat that
   * generated variants from it (e.g. one card of a multi-card run reopens that run).
   */
  const agentSession =
    agentIds.length === 0
      ? undefined
      : (agents.sessionFor(agentIds) ??
        (agentIds.length === 1
          ? agents.sessions.findLast(
              (s) => s.elementIds.includes(agentIds[0]) && agents.variants.some((v) => v.sessionId === s.id),
            )
          : undefined))
  /** Frames an agent is reading / replying about, with its chat open (tint + dashed outline). */
  const workingIds = new Set(
    agents.sessions
      .filter((s) => s.working && s.phase !== "generating" && s.phase !== "building")
      .flatMap((s) => s.elementIds),
  )
  /** Frames an agent is generating variants from / building: their spinning agent badge. */
  const busySessions = agents.sessions.filter((s) => s.working && (s.phase === "generating" || s.phase === "building"))
  const busyIds = new Set(busySessions.flatMap((s) => s.elementIds))

  // When the open chat's agent starts generating / building, the chat closes and the selection
  // clears: the canvas shows the work, the originals only their spinning agent badge.
  const busyKey = busySessions.map((s) => s.id).join(",")
  const openSessionId = agentOpen ? agentSession?.id : undefined
  useEffect(() => {
    if (openSessionId === undefined || !busySessions.some((s) => s.id === openSessionId)) return
    setAgentOpen(false)
    setSelectedIds([])
    setPickSession(null)
    // Only when an agent starts (or the open chat changes); busySessions is derived from busyKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyKey, openSessionId])

  /** Variant rows go below everything on the canvas, one row per source (see VARIANT_GAP). */
  const placeVariants: PlaceVariants = (sources) => {
    // Below the app's own elements, in the lane the explored screens leave free (they sit above
    // and to either side).
    const appRects = AIRBNB_ELEMENTS.filter((el) => !el.exploration).map((el) => elementRects[el.id])
    const occupied = [codebaseRect, ...appRects, ...agents.variants.map((v) => v.rect)]
    let top = Math.max(...occupied.map((r) => r.y + r.h / 2)) + VARIANT_ROW_GAP
    return sources.map(({ elementId, count }) => {
      const source = elementRects[elementId]
      const left = source.x - source.w / 2
      const row = Array.from({ length: count }, (_, i) => ({
        x: left + i * (source.w + VARIANT_GAP) + source.w / 2,
        y: top + source.h / 2,
        w: source.w,
        h: source.h,
      }))
      top += source.h + VARIANT_ROW_GAP
      return row
    })
  }

  // Agent cursors: after each step, find the piece being edited and park the cursor at its
  // top-left corner (canvas units, so panning / zooming doesn't move it).
  const focus = agents.focus
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    // Screen px → the canvas's layout px (the screen may be drawn scaled).
    const k = screenScale(canvas)
    const next: Record<number, { x: number; y: number }> = {}
    for (const [id, f] of Object.entries(focus)) {
      if (!f) continue
      const piece = canvas.querySelector(agentPartSelector(f.variantId, f.part))
      if (!piece) continue
      const r = piece.getBoundingClientRect()
      next[Number(id)] = {
        x: ((r.left - box.left) / k - AGENT_CURSOR_INSET - box.width / k / 2 - camera.x) / camera.zoom,
        y: ((r.top - box.top) / k - AGENT_CURSOR_INSET - box.height / k / 2 - camera.y) / camera.zoom,
      }
    }
    setCursorAt(next)
    // Re-measure only when an agent moves on to another piece; the camera is read as it is then.
  }, [focus])

  /**
   * Build Agent input: sits right of the selection's top-right corner. The shift keeps it clear of
   * the left sidebar, the settings panel and the top bar; it's animated so the input glides aside.
   * While picking a variant it glides to the selection's left instead: variant rows run rightward
   * from their source, so on the right it would sit over the variants being picked from.
   */
  // Placed in the root's layout px, from layout boxes, so it holds while the screen is drawn scaled.
  let composer: { left: number; top: number; shiftX: number; shiftY: number } | null = null
  if (agentRect && agentOpen && rootBox) {
    const z = camera.zoom
    const left = rootBox.width / 2 + camera.x + (agentRect.x + agentRect.w / 2) * z + COMPOSER_GAP
    const top = rootBox.height / 2 + camera.y + (agentRect.y - agentRect.h / 2) * z
    const picking = !!agentSession && pickSession === agentSession.id
    const leftOfSelection = rootBox.width / 2 + camera.x + (agentRect.x - agentRect.w / 2) * z - COMPOSER_GAP - COMPOSER_WIDTH
    const minLeft = (sidebarBox ? sidebarBox.left + sidebarBox.width : 0) + COMPOSER_GAP
    const maxLeft = (panelBox ? panelBox.left : rootBox.width) - COMPOSER_GAP - COMPOSER_WIDTH
    const minTop = TOP_BAR_HEIGHT + COMPOSER_GAP
    const maxTop = rootBox.height - COMPOSER_GAP - composerHeight
    const clampedLeft = Math.max(minLeft, Math.min(picking ? leftOfSelection : left, maxLeft))
    const clampedTop = Math.max(minTop, Math.min(top, maxTop))
    composer = { left, top, shiftX: clampedLeft - left, shiftY: clampedTop - top }
  }

  /**
   * Leaving the Portal reveals only the Codebase frame; everything else glides in from the side of
   * it that the element sits on: elements above the frame's top edge come from above (Status Bar,
   * Scrubber), below its bottom edge from below (events), otherwise from the left or right
   * (Background, Toolbar). The delays sweep clockwise around the frame (top, right, bottom, left);
   * each element starts before the previous ones have settled, so the reveal travels in a circle.
   */
  function entranceFor(rect: CanvasRect): CanvasEntrance | null {
    // Before the first reveal (the screen opens in the Portal): only the Codebase frame is on the
    // canvas. After it, the elements stay loaded under the Portal, so closing it again shows them
    // in place instead of bringing them in again.
    if (revealId === 0) return portalOpen ? "hidden" : null
    const z = camera.zoom
    const dx = (rect.x - codebaseRect.x) * z
    const dy = (rect.y - codebaseRect.y) * z
    const outsideVertically = Math.abs(rect.y - codebaseRect.y) > codebaseRect.h / 2
    const travel = (along: number) => Math.sign(along) * Math.max(ENTER_MIN_TRAVEL, Math.abs(along) * ENTER_SPREAD)
    // Clockwise sweep: angle from straight up (0 = top, ¼ = right, ½ = bottom, ¾ = left), measured
    // from the top-left diagonal so everything above the frame starts the sweep.
    const angle = Math.atan2(dx, -dy) / (2 * Math.PI) // −½…½, clockwise from up
    const sweep = (((angle - ENTER_SWEEP_START) % 1) + 1) % 1 // 0…1 from the start diagonal
    return {
      x: outsideVertically ? 0 : travel(dx),
      y: outsideVertically ? travel(dy) : 0,
      delay: Math.round(ENTER_BASE_DELAY + sweep * ENTER_SWEEP_MS),
    }
  }

  // Scroll / trackpad pans; pinch or ⌘/Ctrl + scroll zooms toward the cursor.
  // Registered natively so preventDefault works (React wheel listeners are passive).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const canvas = el

    function fromCentre(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect()
      // In the canvas's layout px (the screen may be drawn scaled).
      const k = screenScale(canvas)
      return { px: (clientX - rect.left - rect.width / 2) / k, py: (clientY - rect.top - rect.height / 2) / k }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : 1 // line-based deltas (some mice) → px
      if (e.ctrlKey || e.metaKey) {
        const { px, py } = fromCentre(e.clientX, e.clientY)
        setCamera((c) => zoomAt(c, c.zoom * Math.exp(-e.deltaY * unit * WHEEL_ZOOM_SPEED), px, py, boundsRef.current))
      } else {
        setCamera((c) => clampCamera({ ...c, x: c.x - e.deltaX * unit, y: c.y - e.deltaY * unit }, boundsRef.current))
      }
    }

    // Safari reports trackpad pinch as gesture events instead of ctrl + wheel.
    let lastScale = 1
    function onGestureStart(e: Event) {
      e.preventDefault()
      lastScale = 1
    }
    function onGestureChange(e: Event) {
      e.preventDefault()
      const g = e as GestureEvent
      const factor = g.scale / lastScale
      lastScale = g.scale
      const { px, py } = fromCentre(g.clientX, g.clientY)
      setCamera((c) => zoomAt(c, c.zoom * factor, px, py, boundsRef.current))
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("gesturestart", onGestureStart)
    canvas.addEventListener("gesturechange", onGestureChange)
    return () => {
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("gesturestart", onGestureStart)
      canvas.removeEventListener("gesturechange", onGestureChange)
    }
  }, [])

  function endPan() {
    lastPointer.current = null
    setPanning(false)
  }

  // Single-key tool shortcuts shown in the toolbar labels (V, F, T, P)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      const match = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase())
      if (match) setTool(match.id)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div
      ref={rootRef}
      data-hero-root
      className={cn("relative h-dvh w-full select-none overflow-hidden bg-mi-canvas", className)}
    >
      {/*
        Canvas: clicking empty space clears the selection. With the Select tool, dragging empty
        space pans the camera (Shift + drag draws a selection box); the Frame / Text tools create
        an element wherever they're pressed (even over another frame); other tools (or the middle
        button) pan. Scroll / trackpad always pans.
      */}
      <div
        ref={canvasRef}
        data-hero-canvas
        className={cn(
          "absolute inset-0 touch-none",
          panning
            ? "cursor-grabbing"
            : tool === "select"
              ? "cursor-default"
              : tool === "frame"
                ? "cursor-crosshair"
                : tool === "text"
                  ? "cursor-text"
                  : "cursor-grab",
        )}
        onPointerDownCapture={(e) => {
          if (e.button !== 0 || (tool !== "frame" && tool !== "text")) return
          e.stopPropagation()
          startCreate(e)
        }}
        onPointerDown={(e) => {
          setCodebaseSelected(false)
          setSelectedIds([])
          setSelectedComponentId(null)
          setAgentOpen(false)
          setPickSession(null)
          if (e.button === 0 && tool === "select" && e.shiftKey) {
            startMarquee(e)
            return
          }
          if (e.button !== 0 && e.button !== 1) return
          lastPointer.current = { x: e.clientX, y: e.clientY }
          e.currentTarget.setPointerCapture(e.pointerId)
          setPanning(true)
        }}
        onPointerMove={(e) => {
          const last = lastPointer.current
          if (!last) return
          const k = screenScale(e.currentTarget) // screen px → layout px
          const dx = (e.clientX - last.x) / k
          const dy = (e.clientY - last.y) / k
          lastPointer.current = { x: e.clientX, y: e.clientY }
          setCamera((c) => clampCamera({ ...c, x: c.x + dx, y: c.y + dy }, bounds))
        }}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <CodebaseFrame
          selected={codebaseSelected}
          onSelect={selectCodebase}
          onMoveStart={(e) => startMove(e, "codebase")}
          onOpen={() => setPortalOpen(true)}
          covered={canvasCovered}
          zoom={camera.zoom}
          offsetX={camera.x + codebaseRect.x * camera.zoom}
          offsetY={camera.y + codebaseRect.y * camera.zoom}
        />
        {AIRBNB_ELEMENTS.map((el) => (
          <DesignFrame
            // Remount on each reveal so the entrance animation replays.
            key={`${el.id}-${revealId}`}
            id={el.id}
            label={el.name}
            rect={elementRects[el.id]}
            naturalSize={el.rect}
            fill={el.fill}
            radius={elementRadii[el.id]}
            border={el.border}
            bare={el.bare}
            labelOnSelect={el.labelOnSelect}
            selected={selectedIds.includes(el.id)}
            onSelect={(e) => selectElement(el.id, e.shiftKey)}
            onMoveStart={(e) => startMove(e, { elementId: el.id })}
            onResizeStart={(e, corner) => startResize(e, corner, el.id)}
            onRadiusStart={(e, corner) => {
              const { w, h } = elementRects[el.id]
              startRadiusDrag(e, corner, { w, h, radius: elementRadii[el.id] ?? 0 }, (radius) =>
                setElementRadii((current) => ({ ...current, [el.id]: radius })),
              )
            }}
            showAgentButton={activeElement?.id === el.id && !agentOpen}
            onOpenAgent={() => setAgentOpen(true)}
            working={workingIds.has(el.id)}
            agentBusy={busyIds.has(el.id)}
            zoom={camera.zoom}
            offsetX={camera.x}
            offsetY={camera.y}
            entrance={entranceFor(elementRects[el.id])}
          >
            {el.content}
          </DesignFrame>
        ))}
        {/* Library components dropped into the frames, over them */}
        <FrameComponentsLayer
          components={frameComponents}
          frameRects={elementRects}
          camera={camera}
          selectedId={selectedComponentId}
          onPress={pressComponent}
        />
        {/* Variants generated by the Build Agent, then the agents' cursors over them */}
        {agents.variants.map((variant) => (
          <VariantFrame
            key={variant.id}
            variant={variant}
            zoom={camera.zoom}
            offsetX={camera.x}
            offsetY={camera.y}
            pickable={pickSession === variant.sessionId && variant.status === "done"}
            onPick={() => {
              // Building starts: the chat closes and the selection clears right away.
              setPickSession(null)
              setAgentOpen(false)
              setSelectedIds([])
              agents.build(variant.sessionId, variant.id)
            }}
            built={agents.builtVariant?.id === variant.id}
          />
        ))}
        {Object.entries(cursorAt).map(([id, at]) => (
          <AgentCursor key={id} x={at.x} y={at.y} zoom={camera.zoom} offsetX={camera.x} offsetY={camera.y} />
        ))}
        {/* Several frames selected: their bounding box, with the Build Agent button off its corner */}
        {agentRect && agentIds.length > 1 && (
          <div
            data-cursor-id="selection-group"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${camera.x + agentRect.x * camera.zoom}px)`,
              top: `calc(50% + ${camera.y + agentRect.y * camera.zoom}px)`,
              width: agentRect.w * camera.zoom,
              height: agentRect.h * camera.zoom,
            }}
          >
            <div className="absolute -inset-[3px] border border-[#2f6bf6]/60" />
            {!agentOpen && <BuildAgentButton onClick={() => setAgentOpen(true)} />}
          </div>
        )}
        {drawnElements.map((el) =>
          el.kind === "frame" ? (
            <DrawnFrame
              key={`${el.id}-${revealId}`}
              el={el}
              camera={camera}
              entrance={entranceFor(elementRect(el))}
              selected={selectedIds.includes(el.id)}
              onPointerDown={(e) => {
                selectElement(el.id)
                startMove(e, { elementId: el.id })
              }}
              onResizeStart={(e, corner) => startDrawnResize(e, el.id, corner)}
              onRadiusStart={(e, corner) =>
                startRadiusDrag(e, corner, { w: el.w, h: el.h, radius: el.radius ?? 0 }, (radius) =>
                  setDrawnElements((els) => els.map((d) => (d.id === el.id && d.kind === "frame" ? { ...d, radius } : d))),
                )
              }
            />
          ) : (
            <CanvasText
              key={`${el.id}-${revealId}`}
              el={el}
              camera={camera}
              entrance={entranceFor(elementRect(el))}
              selected={selectedIds.includes(el.id)}
              editing={editingId === el.id}
              onPointerDown={(e) => {
                selectElement(el.id)
                startMove(e, { elementId: el.id })
              }}
              onStartEditing={() => {
                selectElement(el.id)
                setEditingId(el.id)
              }}
              onCommit={(content) => commitText(el.id, content)}
              onMeasure={(w, h) => measureText(el.id, w, h)}
            />
          ),
        )}
      </div>

      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 border border-[#2f6bf6] bg-[#2f6bf6]/10"
          style={marquee}
        />
      )}

      {composer && (
        <BuildAgentComposer
          // One composer per selection, so a half-typed prompt doesn't carry over. Prefixed: a bare
          // element id would collide with the settings panel's key (a sibling keyed by the same id),
          // and duplicate keys make React duplicate the composer on every re-render.
          key={`composer:${[...agentIds].sort().join("+")}`}
          {...composer}
          session={agentSession}
          variants={agents.variants}
          onSend={(text) =>
            agents.send({
              // A reopened chat (single frame showing a group's run) keeps talking to that run.
              elementIds: agentSession?.elementIds ?? agentIds,
              text,
              place: placeVariants,
              originOf: (id) => ({ x: elementRects[id].x, y: elementRects[id].y }),
              components: frameComponents,
            })
          }
          onStop={() => agentSession && agents.stop(agentSession.id)}
          onClear={() => agentSession && agents.clear(agentSession.id)}
          onChooseBuild={() => {
            if (!agentSession || !agents.variants.some((v) => v.sessionId === agentSession.id)) return
            setPickSession((current) => (current === agentSession.id ? null : agentSession.id))
          }}
          picking={!!agentSession && pickSession === agentSession.id}
          onClose={() => setAgentOpen(false)}
          onHeightChange={setComposerHeight}
        />
      )}

      <AgentsPopover agents={agentThumbs} />

      {/* Top bar: two floating groups (canvas title on the left, actions on the right), each on
          its own panel background so they read over whatever is on the canvas beneath them.
          While the Portal is open it stays on top of it, with "Back to Canvas" on the left. */}
      <header
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex h-11 items-center justify-between pl-1 pr-1.5 *:pointer-events-auto",
          portalOpen && !portalClosing ? "z-[60]" : "z-40",
        )}
      >
        {portalOpen && !portalClosing ? (
          <button
            type="button"
            onClick={closePortal}
            className={cn(
              "flex items-center gap-1.5 px-2.5 text-px-13 font-medium text-stone-900 hover:bg-[#e9e9e7]",
              TOP_GROUP,
            )}
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Back to Canvas
          </button>
        ) : (
          <div className={cn("flex items-center gap-1.5 pr-1", TOP_GROUP)}>
            <button
              type="button"
              aria-label="Home"
              className="flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
            >
              <HomeIcon />
            </button>
            <CanvasTitle />
          </div>
        )}

        <div className={cn("flex items-center gap-1 pr-1.5", TOP_GROUP)}>
          <button
            type="button"
            aria-label="Undo"
            className="group relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <UndoIcon />
            <Tooltip label="Undo" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            className="group relative mr-2 flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <RedoIcon />
            <Tooltip label="Redo" />
          </button>
          <button
            type="button"
            aria-label="View code changes"
            aria-haspopup="dialog"
            aria-expanded={changesOpen}
            onClick={() => setChangesOpen((open) => !open)}
            className={cn(
              "group relative flex h-8 items-center gap-1.5 rounded-md px-2 text-px-11 font-medium tabular-nums hover:bg-stone-700/5",
              changesOpen && "bg-stone-700/5",
            )}
          >
            <span className="text-green-700">+{changeTotals.added}</span>
            <span className="text-red-600">−{changeTotals.removed}</span>
            <Tooltip label="View code changes" />
          </button>
          {/* Not in the Portal's toolbar: the Portal is the preview */}
          {!portalOpen && (
            <button
              type="button"
              aria-label="Open preview"
              className="group relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
            >
              <PlayCircleIcon />
              <Tooltip label="Open preview" />
            </button>
          )}
          {/* Draft project: no repo linked yet, so the button offers to create one */}
          <GithubButton
            connected={false}
            defaultRepoName="Hero-Interactive-Screen"
            changes={githubChanges}
            pullRequest={pullRequest}
            onMerged={closeCanvas}
          />
          {/* Any drawn element or moved/resized frame since the last publish makes the preview outdated */}
          <ShareButton
            previewUrl="https://hero-interactive-screen.modeinspect.app"
            changes={shareChanges}
          />
          <span className="ml-1 flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200">
            <img
              src="/avatars/modeinspect-avatar.png"
              alt="Your profile"
              className="size-[80%] object-contain"
            />
          </span>
        </div>
      </header>

      {changesOpen && <CodeChangesPopover onClose={closeChanges} extra={sessionChanges} />}

      {/* Tool bar */}
      <div className="absolute left-1/2 top-2.5 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-stone-700/10 bg-white/90 p-1 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] backdrop-blur-md">
        {TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-cursor-id={`tool-${id}`}
            aria-label={label}
            aria-keyshortcuts={shortcut}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            className={cn(
              "group relative flex size-8 items-center justify-center rounded-lg transition-colors",
              tool === id ? "bg-[#2f6bf6] text-white" : "text-stone-700 hover:bg-stone-700/5",
            )}
          >
            <Icon />
            <Tooltip label={`${label} (${shortcut})`} />
          </button>
        ))}
      </div>

      <LeftSidebar ref={sidebarRef} onLibraryDragStart={onLibraryDragStart} />

      {libraryDrag && <ComponentDragGhost x={libraryDrag.x} y={libraryDrag.y} zoom={camera.zoom} />}

      {/* Settings show for a single selection only */}
      {codebaseSelected && selectedIds.length === 0 && <CodebaseSettingsPanel onOpenBuildMode={() => setPortalOpen(true)} />}
      {selectedComponent && selectedIds.length === 0 && (
        <ComponentSettingsPanel
          key={`component-settings:${selectedComponent.id}`}
          instance={selectedComponent}
          onChange={(patch) =>
            setFrameComponents((list) => list.map((c) => (c.id === selectedComponent.id ? { ...c, ...patch } : c)))
          }
        />
      )}
      {activeElement && activeRect && (
        <FrameSettingsPanel
          key={`settings:${activeElement.id}`}
          ref={panelRef}
          x={activeRect.x - activeRect.w / 2 - (codebaseRect.x - codebaseRect.w / 2)}
          y={activeRect.y - activeRect.h / 2 - (codebaseRect.y - codebaseRect.h / 2)}
          width={activeRect.w}
          height={activeRect.h}
          fill={activeElement.fill}
          radius={elementRadii[activeElement.id]}
          border={activeElement.border}
          tag={activeElement.tag}
          position={activeElement.position}
          inset={activeElement.inset}
          layout={activeElement.layout}
          padding={activeElement.padding}
          clip={activeElement.clip}
          colors={activeElement.colors}
        />
      )}
      {activeDrawn?.kind === "frame" && (
        <FrameSettingsPanel
          key={`settings:${activeDrawn.id}`}
          x={activeDrawn.x - (codebaseRect.x - codebaseRect.w / 2)}
          y={activeDrawn.y - (codebaseRect.y - codebaseRect.h / 2)}
          width={activeDrawn.w}
          height={activeDrawn.h}
          fill="#ffffff"
          radius={activeDrawn.radius ?? null}
          border={null}
        />
      )}
      {activeDrawn?.kind === "text" && (
        <TextSettingsPanel
          key={`text-settings:${activeDrawn.id}`}
          x={activeDrawn.x - (codebaseRect.x - codebaseRect.w / 2)}
          y={activeDrawn.y - (codebaseRect.y - codebaseRect.h / 2)}
          width={activeDrawn.w}
          height={activeDrawn.h}
        />
      )}

      {/* Zoom */}
      <div className="absolute bottom-3 right-3 z-20 rounded-md border border-stone-700/10 bg-white/90 px-1.5 py-0.5 text-px-10 font-medium tabular-nums text-stone-700 shadow-[0_1px_2px_rgba(17,17,16,0.06)]">
        {/* Relative to the fit, so it reads the same at any screen size (30% on opening). */}
        {Math.round((camera.zoom / fit) * 100)}%
      </div>

      {portalOpen && (
        <PortalView
          onClose={closePortal}
          closing={portalClosing}
          builtVariant={agents.builtVariant}
          builtComponents={agents.builtComponents}
        />
      )}

      {canvasClosed && (
        <CanvasClosed pullRequest={pullRequest} variant={pullRequest === PULL_REQUEST ? agents.builtVariant : null} />
      )}

      {reopened && <CanvasReopen />}
    </div>
  )
}

/* ------------------------------ Canvas closed ------------------------------ */

/** The closing card is read for this long, then fades, leaving the plain canvas colour (ms). */
const CLOSED_CARD_HOLD_MS = 3400
/** The closing card's fade out (ms). */
const CLOSED_CARD_OUT_MS = 450

/**
 * End of the story: the pull request is merged, so the canvas closes. The screen folds away into
 * the canvas colour and a closing card sums up what shipped; then the card fades too, leaving the
 * plain canvas colour that the next run opens out of (see CanvasReopen).
 */
function CanvasClosed({ pullRequest, variant }: { pullRequest: PullRequest; variant: VariantState | null }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), CLOSED_CARD_HOLD_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div
      data-cursor-id="canvas-closed"
      className="absolute inset-0 z-[55] flex items-center justify-center bg-mi-canvas animate-in fade-in duration-700"
    >
      <div
        className={cn(
          "flex max-w-[380px] flex-col items-center gap-3 px-6 text-center",
          leaving
            ? "animate-out fade-out zoom-out-95 slide-out-to-top-2"
            : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500",
        )}
        // The card follows once the screen has folded away; on the way out it stays gone.
        style={
          leaving
            ? { animationDuration: `${CLOSED_CARD_OUT_MS}ms`, animationFillMode: "forwards" }
            : { animationDelay: "300ms", animationFillMode: "both" }
        }
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-mi-lime text-stone-900 shadow-[0_6px_18px_-6px_rgba(90,122,24,0.5)]">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
        <h2 className="text-[17px] font-semibold text-stone-900">
          Pull request #{pullRequest.number} merged into main
        </h2>
        <p className="text-px-13 leading-5 text-stone-600">
          {pullRequest.title}
          {variant ? ` (${variant.source.title}: ${variant.spec.label})` : ""}. The canvas is closed. Goal achieved.
        </p>
      </div>
    </div>
  )
}

/** The Portal opening out of the canvas colour at the start of a looped run (ms). */
const REOPEN_DELAY_MS = 150
const REOPEN_MS = 1100

/**
 * Start of a run that follows a previous one: the screen begins as the plain canvas colour the
 * last run ended on (CanvasClosed, once its card has gone), and the Portal opens out of it from
 * the centre, as a rounded window growing to fill the screen. The cover is a window-shaped hole
 * whose huge box-shadow paints the canvas colour around it, so only its inset needs animating.
 */
function CanvasReopen() {
  const ref = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const animation = el.animate(
      [
        { inset: "50% 50%", borderRadius: "28px" },
        { inset: "-24px", borderRadius: "0px" },
      ],
      { duration: REOPEN_MS, delay: REOPEN_DELAY_MS, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "both" },
    )
    animation.onfinish = () => setDone(true)
    return () => animation.cancel()
  }, [])
  if (done) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[55] overflow-hidden">
      <div ref={ref} className="absolute shadow-[0_0_0_200vmax_var(--color-mi-canvas)]" />
    </div>
  )
}

/* ------------------------------ Canvas title ------------------------------- */

/** Canvas name + file menu. "Rename" turns the name into an input: Enter/blur saves, Escape cancels. */
function CanvasTitle() {
  const [name, setName] = useState("Hero Interactive Screen")
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close the menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  // Focus and select the name when rename starts
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startRename() {
    setMenuOpen(false)
    setDraft(name)
    setEditing(true)
  }

  function commitRename() {
    const next = draft.trim()
    if (next) setName(next)
    setEditing(false)
  }

  return (
    <>
      {editing ? (
        <input
          ref={inputRef}
          aria-label="Canvas name"
          value={draft}
          size={Math.max(draft.length, 1)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename()
            if (e.key === "Escape") setEditing(false)
          }}
          className="-my-1 max-w-[220px] select-text rounded-md bg-white px-1.5 py-1 text-px-13 font-medium text-stone-900 shadow-[0_0_0_1px_rgba(47,107,246,0.6)] outline-none"
        />
      ) : (
        <span
          onDoubleClick={startRename}
          className="max-w-[140px] truncate pl-0.5 text-px-13 font-medium text-stone-900"
        >
          {name}
        </span>
      )}

      <div ref={menuRef} className="relative ml-4">
        <button
          type="button"
          aria-label="File menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5",
            menuOpen && "bg-stone-700/5",
          )}
        >
          <Ellipsis className="size-4" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 flex min-w-[160px] flex-col rounded-lg border border-stone-700/10 bg-white p-1 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <button
              type="button"
              role="menuitem"
              onClick={startRename}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-px-13 text-stone-800 hover:bg-stone-700/5"
            >
              <SquarePen className="size-3.5" strokeWidth={1.5} />
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-px-13 text-red-600 hover:bg-red-50"
            >
              <X className="size-3.5" strokeWidth={1.5} />
              Delete canvas
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/* --------------------------------- Icons ---------------------------------- */

const TOOLS: { id: Tool; label: string; shortcut: string; icon: () => React.JSX.Element }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: SelectIcon },
  { id: "frame", label: "Frame", shortcut: "F", icon: FrameIcon },
  { id: "text", label: "Text", shortcut: "T", icon: TextIcon },
  { id: "code", label: "Portal", shortcut: "P", icon: TerminalIcon },
]

/** Hover/focus label shown below a top-bar control. Parent needs `group relative`. */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] font-normal leading-4 text-stone-800 -translate-y-1 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2 1.5 4.5 4 7" />
      <path d="M1.5 4.5h7a3.5 3.5 0 0 1 0 7H5" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2l2.5 2.5L10 7" />
      <path d="M12.5 4.5h-7a3.5 3.5 0 0 0 0 7H9" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.19629 7.89293L6.99986 2.08936L12.8034 7.89293" />
      <path d="M2.98193 6.10742V11.911H11.0176V6.10742" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.7532 4.66913L1.829 1.1069C1.62722 1.0411 1.40557 1.09419 1.2555 1.24426C1.09984 1.39992 1.049 1.63194 1.12531 1.83843L5.16555 12.7708C5.21637 12.9083 5.34745 12.9996 5.49404 12.9996C5.64654 12.9996 5.78151 12.9009 5.82775 12.7556L7.3584 7.94503C7.44821 7.66276 7.65854 7.43484 7.93269 7.32268L12.7777 5.34062C12.9122 5.2856 13.0001 5.1547 13.0001 5.00938C13.0001 4.85447 12.9004 4.71715 12.7532 4.66913Z" />
    </svg>
  )
}

function FrameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1v12M10 1v12M1 4h12M1 10h12" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v12" />
      <path d="M4.5 13h5" />
      <path d="M1 3.5V2c0-.55.45-1 1-1h10c.55 0 1 .45 1 1v1.5" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}

function PlayCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6.5" fill="currentColor" />
      <path d="M5.6 4.4v5.2L9.6 7z" fill="white" />
    </svg>
  )
}
