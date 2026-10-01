"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Ellipsis, SquarePen, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { BuildAgentComposer, COMPOSER_HEIGHT, COMPOSER_WIDTH } from "./build-agent-composer"
import { CALENDAR_ELEMENTS } from "./calendar-elements"
import { CanvasText, DrawnFrame, TEXT_LINE_HEIGHT, type CanvasElement } from "./canvas-elements"
import { CodeChangesPopover, CODE_CHANGES_TOTAL } from "./code-changes-popover"
import { CodebaseFrame, CANVAS_ZOOM, CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"
import { CodebaseSettingsPanel } from "./codebase-settings-panel"
import { trackDrag, useMeasuredRect, type CanvasRect } from "./drag"
import { FrameSettingsPanel } from "./frame-settings-panel"
import { GithubButton } from "./github-popover"
import { LeftSidebar } from "./left-sidebar"
import { DesignFrame, type Corner } from "./planner-frame"
import { PortalView } from "./portal-view"
import { ShareButton } from "./share-popover"
import { TextSettingsPanel } from "./text-settings-panel"

type Tool = "select" | "frame" | "text" | "code"

/* ------------------------------ Camera limits ------------------------------ */
// The hero canvas is a showcase, not an infinite canvas: zoom and pan are both bounded.

/**
 * Furthest the user can zoom out / in. The floor reads as 0% in the zoom readout; it stays just
 * above a true 0 because zoom is multiplicative (0 × anything = 0, so it could never zoom back in).
 */
const MIN_ZOOM = 0.004
const MAX_ZOOM = 1.5

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

/** x/y: screen-px offset of the canvas origin from the viewport centre. */
type Camera = { x: number; y: number; zoom: number }

/** Canvas-unit area the viewport centre may pan over. */
type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

/** Selection box in screen px. */
type Marquee = { left: number; top: number; width: number; height: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function frameBounds(rects: CanvasRect[]): Bounds {
  return {
    minX: Math.min(...rects.map((r) => r.x - r.w / 2)) - PAN_MARGIN_X,
    maxX: Math.max(...rects.map((r) => r.x + r.w / 2)) + PAN_MARGIN_X,
    minY: Math.min(...rects.map((r) => r.y - r.h / 2)) - PAN_MARGIN_Y,
    maxY: Math.max(...rects.map((r) => r.y + r.h / 2)) + PAN_MARGIN_Y,
  }
}

function clampCamera({ x, y, zoom }: Camera, bounds: Bounds): Camera {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  return {
    zoom: z,
    x: clamp(x, -bounds.maxX * z, -bounds.minX * z),
    y: clamp(y, -bounds.maxY * z, -bounds.minY * z),
  }
}

/** Zoom to `nextZoom`, keeping the point under the cursor (px, py from viewport centre) fixed. */
function zoomAt(camera: Camera, nextZoom: number, px: number, py: number, bounds: Bounds): Camera {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  const ratio = zoom / camera.zoom
  return clampCamera({ zoom, x: px - (px - camera.x) * ratio, y: py - (py - camera.y) * ratio }, bounds)
}

/**
 * Opening view: the Codebase frame (centred on the canvas origin) centred in the viewport, with
 * the iPad Calendar elements spread around it.
 */
function initialCamera(): Camera {
  return { zoom: CANVAS_ZOOM, x: 0, y: 0 }
}

/** Safari's trackpad-pinch event (not in lib.dom). */
type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number }

export function HeroScreen() {
  const [tool, setTool] = useState<Tool>("select")
  const [codebaseSelected, setCodebaseSelected] = useState(false)
  /** Ids of the selected iPad Calendar element frames. */
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [agentOpen, setAgentOpen] = useState(false)
  /** The Build Agent is "working" on the active frame (its prompt was sent, no reply yet). */
  const [agentWorking, setAgentWorking] = useState(false)
  /** Rendered Build Agent height (it grows with the chat), so it can be kept on screen. */
  const [composerHeight, setComposerHeight] = useState(COMPOSER_HEIGHT)
  const [changesOpen, setChangesOpen] = useState(false)
  const closeChanges = useCallback(() => setChangesOpen(false), [])
  /** The Codebase frame is open in the Portal View (double-click the frame). */
  const [portalOpen, setPortalOpen] = useState(false)
  const closePortal = useCallback(() => setPortalOpen(false), [])
  const [camera, setCamera] = useState<Camera>(initialCamera)
  const [panning, setPanning] = useState(false)
  /** Select-tool selection box, in screen px relative to the hero root. */
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  /** Frame positions/sizes in canvas units (centre-based); the Codebase frame starts at the origin. */
  const [codebaseRect, setCodebaseRect] = useState<CanvasRect>({ x: 0, y: 0, w: CODEBASE_WIDTH, h: CODEBASE_HEIGHT })
  const [elementRects, setElementRects] = useState<Record<string, CanvasRect>>(() =>
    Object.fromEntries(CALENDAR_ELEMENTS.map((el) => [el.id, el.rect])),
  )
  /** Corner radius per iPad Calendar element frame, in canvas units (null = square); editable via the radius thumbs. */
  const [elementRadii, setElementRadii] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(CALENDAR_ELEMENTS.map((el) => [el.id, el.radius])),
  )
  const canvasRef = useRef<HTMLDivElement>(null)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  /** Frames and text the user adds with the Frame / Text tools (selected via `selectedIds` too). */
  const [drawnElements, setDrawnElements] = useState<CanvasElement[]>([])
  /** Text element whose content is being typed. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const nextDrawnId = useRef(1)
  const frameCount = useRef(0)
  const [rootRef, rootRect] = useMeasuredRect()
  const [sidebarRef, sidebarRect] = useMeasuredRect()
  const [panelRef, panelRect] = useMeasuredRect()

  /** The one element frame that owns the settings panel and Build Agent (single selection only). */
  const activeElement =
    !codebaseSelected && selectedIds.length === 1 ? CALENDAR_ELEMENTS.find((el) => el.id === selectedIds[0]) : undefined
  const activeRect = activeElement ? elementRects[activeElement.id] : undefined
  /** A single selected drawn frame / text (its settings panel shows). */
  const activeDrawn =
    !codebaseSelected && selectedIds.length === 1 ? drawnElements.find((el) => el.id === selectedIds[0]) : undefined

  // The native wheel/gesture listeners are registered once, so they read the bounds from a ref.
  const bounds = frameBounds([codebaseRect, ...Object.values(elementRects), ...drawnElements.map(elementRect)])
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
    setAgentOpen(false)
  }

  function selectElement(id: string) {
    if (selectedIds.includes(id)) return
    setAgentOpen(false)
    setSelectedIds([id])
    setCodebaseSelected(false)
  }

  /**
   * Drag a frame with the Select tool: screen-px movement ÷ zoom = canvas units. Pressing a frame
   * that was already selected moves every selected frame; otherwise only the pressed one.
   */
  function startMove(e: React.PointerEvent, frame: "codebase" | { elementId: string }) {
    if (tool !== "select" || e.button !== 0) return
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
    const r = rootRect!
    return {
      x: (clientX - r.left - r.width / 2 - camera.x) / camera.zoom,
      y: (clientY - r.top - r.height / 2 - camera.y) / camera.zoom,
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
    const originX = e.clientX - rootRect.left
    const originY = e.clientY - rootRect.top
    const z = camera.zoom
    const centreX = rootRect.width / 2 + camera.x
    const centreY = rootRect.height / 2 + camera.y
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
          ...CALENDAR_ELEMENTS.filter((el) => touches(elementRects[el.id], box)).map((el) => el.id),
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
   * Build Agent input: sits right of the frame's top-right corner. The shift keeps it clear of the
   * left sidebar, the settings panel and the top bar; it's animated so the input glides aside.
   */
  let composer: { left: number; top: number; shiftX: number; shiftY: number } | null = null
  if (activeRect && agentOpen && rootRect) {
    const z = camera.zoom
    const left = rootRect.width / 2 + camera.x + (activeRect.x + activeRect.w / 2) * z + COMPOSER_GAP
    const top = rootRect.height / 2 + camera.y + (activeRect.y - activeRect.h / 2) * z
    const minLeft = (sidebarRect ? sidebarRect.right - rootRect.left : 0) + COMPOSER_GAP
    const maxLeft = (panelRect ? panelRect.left - rootRect.left : rootRect.width) - COMPOSER_GAP - COMPOSER_WIDTH
    const minTop = TOP_BAR_HEIGHT + COMPOSER_GAP
    const maxTop = rootRect.height - COMPOSER_GAP - composerHeight
    const clampedLeft = Math.max(minLeft, Math.min(left, maxLeft))
    const clampedTop = Math.max(minTop, Math.min(top, maxTop))
    composer = { left, top, shiftX: clampedLeft - left, shiftY: clampedTop - top }
  }

  // Scroll / trackpad pans; pinch or ⌘/Ctrl + scroll zooms toward the cursor.
  // Registered natively so preventDefault works (React wheel listeners are passive).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const canvas = el

    function fromCentre(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect()
      return { px: clientX - rect.left - rect.width / 2, py: clientY - rect.top - rect.height / 2 }
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
    <div ref={rootRef} className="relative h-dvh w-full select-none overflow-hidden bg-mi-canvas">
      {/*
        Canvas: clicking empty space clears the selection. With the Select tool, dragging empty
        space draws a selection box; the Frame / Text tools create an element wherever they're
        pressed (even over another frame); other tools (or the middle button) pan.
        Scroll / trackpad always pans.
      */}
      <div
        ref={canvasRef}
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
          setAgentOpen(false)
          if (e.button === 0 && tool === "select") {
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
          const dx = e.clientX - last.x
          const dy = e.clientY - last.y
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
          zoom={camera.zoom}
          offsetX={camera.x + codebaseRect.x * camera.zoom}
          offsetY={camera.y + codebaseRect.y * camera.zoom}
        />
        {CALENDAR_ELEMENTS.map((el) => (
          <DesignFrame
            key={el.id}
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
            onSelect={() => selectElement(el.id)}
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
            working={agentOpen && agentWorking && activeElement?.id === el.id}
            zoom={camera.zoom}
            offsetX={camera.x}
            offsetY={camera.y}
          >
            {el.content}
          </DesignFrame>
        ))}
        {drawnElements.map((el) =>
          el.kind === "frame" ? (
            <DrawnFrame
              key={el.id}
              el={el}
              camera={camera}
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
              key={el.id}
              el={el}
              camera={camera}
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
          {...composer}
          onClose={() => setAgentOpen(false)}
          onWorkingChange={setAgentWorking}
          onHeightChange={setComposerHeight}
        />
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-11 items-center justify-between pl-2 pr-3 *:pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Home"
            className="flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <HomeIcon />
          </button>
          <CanvasTitle />
        </div>

        <div className="flex items-center gap-1">
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
            <span className="text-green-700">+{CODE_CHANGES_TOTAL.added}</span>
            <span className="text-red-600">−{CODE_CHANGES_TOTAL.removed}</span>
            <Tooltip label="View code changes" />
          </button>
          <button
            type="button"
            aria-label="Open preview"
            className="group relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <PlayCircleIcon />
            <Tooltip label="Open preview" />
          </button>
          {/* Draft project: no repo linked yet, so the button offers to create one */}
          <GithubButton connected={false} defaultRepoName="Hero-Interactive-Screen" />
          {/* Any drawn element or moved/resized frame since the last publish makes the preview outdated */}
          <ShareButton
            previewUrl="https://hero-interactive-screen.modeinspect.app"
            changes={[drawnElements, elementRects, elementRadii]}
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

      {changesOpen && <CodeChangesPopover onClose={closeChanges} />}

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

      <LeftSidebar ref={sidebarRef} />

      {/* Settings show for a single selection only */}
      {codebaseSelected && selectedIds.length === 0 && <CodebaseSettingsPanel />}
      {activeElement && activeRect && (
        <FrameSettingsPanel
          key={activeElement.id}
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
          key={activeDrawn.id}
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
          key={activeDrawn.id}
          x={activeDrawn.x - (codebaseRect.x - codebaseRect.w / 2)}
          y={activeDrawn.y - (codebaseRect.y - codebaseRect.h / 2)}
          width={activeDrawn.w}
          height={activeDrawn.h}
        />
      )}

      {/* Zoom */}
      <div className="absolute bottom-3 right-3 z-20 rounded-md border border-stone-700/10 bg-white/90 px-1.5 py-0.5 text-px-10 font-medium tabular-nums text-stone-700 shadow-[0_1px_2px_rgba(17,17,16,0.06)]">
        {Math.round(camera.zoom * 100)}%
      </div>

      {portalOpen && <PortalView onClose={closePortal} />}
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
