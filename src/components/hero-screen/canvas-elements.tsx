"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { RadiusThumbs, type Corner } from "./planner-frame"

const SELECT_BLUE = "#2f6bf6"
const LABEL_GREY = "#78716c"

/** Text defaults: Tailwind `text-base` on `stone-950`, normal weight. */
export const TEXT_FONT_SIZE = 16
export const TEXT_LINE_HEIGHT = 24

/** x/y = top-left corner, in canvas units. Text w/h are measured from its content (hug). */
type ElementBox = { id: string; name: string; x: number; y: number; w: number; h: number }
/** radius: corner radius in canvas units (unset = square). */
export type FrameElement = ElementBox & { kind: "frame"; radius?: number }
export type TextElement = ElementBox & { kind: "text"; content: string }
export type CanvasElement = FrameElement | TextElement

const CORNERS: (Corner & { cursor: string })[] = [
  { sx: -1, sy: -1, cursor: "nwse-resize" },
  { sx: 1, sy: -1, cursor: "nesw-resize" },
  { sx: -1, sy: 1, cursor: "nesw-resize" },
  { sx: 1, sy: 1, cursor: "nwse-resize" },
]

type Camera = { x: number; y: number; zoom: number }

/** Screen position of an element's top-left, relative to the canvas container. */
function placement(el: CanvasElement, camera: Camera) {
  return {
    left: `calc(50% + ${camera.x + el.x * camera.zoom}px)`,
    top: `calc(50% + ${camera.y + el.y * camera.zoom}px)`,
  }
}

/** Blue selection outline + size tag, shared by frames and text. */
function SelectionChrome({ el }: { el: CanvasElement }) {
  return (
    <>
      <div className="pointer-events-none absolute -inset-px" style={{ border: `1px solid ${SELECT_BLUE}` }} />
      <span
        className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-[2px] px-1 py-px font-mono font-semibold tabular-nums text-white"
        style={{ background: SELECT_BLUE, fontSize: 10, lineHeight: "16px" }}
      >
        {Math.round(el.w)} × {Math.round(el.h)}
      </span>
    </>
  )
}

/** An empty design frame drawn with the Frame tool. */
export function DrawnFrame({
  el,
  camera,
  selected,
  onPointerDown,
  onResizeStart,
  onRadiusStart,
}: {
  el: FrameElement
  camera: Camera
  selected: boolean
  /** Pointer pressed on the frame: select it and maybe start moving it. */
  onPointerDown: (e: React.PointerEvent) => void
  onResizeStart: (e: React.PointerEvent, corner: Corner) => void
  onRadiusStart: (e: React.PointerEvent, corner: Corner) => void
}) {
  return (
    <div
      className="absolute"
      style={{ ...placement(el, camera), width: el.w * camera.zoom, height: el.h * camera.zoom }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(e)
      }}
    >
      <span
        className="absolute -top-7 left-0 flex h-6 items-center whitespace-nowrap font-medium transition-colors"
        style={{ fontSize: 13, color: selected ? SELECT_BLUE : LABEL_GREY }}
      >
        {el.name}
      </span>

      <div className="size-full bg-white" style={{ borderRadius: (el.radius ?? 0) * camera.zoom }} />

      {selected && (
        <>
          <SelectionChrome el={el} />
          {CORNERS.map(({ sx, sy, cursor }) => (
            <span
              key={`${sx}${sy}`}
              aria-hidden="true"
              className="absolute z-10 flex size-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: sx < 0 ? 0 : "100%", top: sy < 0 ? 0 : "100%", cursor }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onResizeStart(e, { sx, sy })
              }}
            >
              <span className="size-2 border bg-white" style={{ borderColor: SELECT_BLUE }} />
            </span>
          ))}
          <RadiusThumbs w={el.w} h={el.h} radius={el.radius ?? 0} zoom={camera.zoom} onRadiusStart={onRadiusStart} />
        </>
      )}
    </div>
  )
}

/**
 * A text element placed with the Text tool. The text is laid out at canvas size and scaled by the
 * zoom, so its measured box is already in canvas units. While editing it's a plaintext
 * contentEditable; blur (or Escape) commits.
 */
export function CanvasText({
  el,
  camera,
  selected,
  editing,
  onPointerDown,
  onStartEditing,
  onCommit,
  onMeasure,
}: {
  el: TextElement
  camera: Camera
  selected: boolean
  editing: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onStartEditing: () => void
  onCommit: (content: string) => void
  /** Reports the hugged content size, in canvas units. */
  onMeasure: (w: number, h: number) => void
}) {
  const textRef = useRef<HTMLDivElement>(null)
  const onMeasureRef = useRef(onMeasure)
  useEffect(() => {
    onMeasureRef.current = onMeasure
  })

  // Hug: keep the element's w/h in sync with its rendered text (unaffected by the zoom transform).
  useEffect(() => {
    const node = textRef.current
    if (!node) return
    const measure = () => onMeasureRef.current(node.offsetWidth, node.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [editing])

  // Focus once editing starts, on the next frame so the creating click can't steal it back.
  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => {
      const node = textRef.current
      if (!node) return
      node.focus()
      const range = document.createRange()
      range.selectNodeContents(node)
      range.collapse(false)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  return (
    <div
      className="absolute"
      style={{ ...placement(el, camera), width: el.w * camera.zoom, height: el.h * camera.zoom }}
      onPointerDown={(e) => {
        e.stopPropagation()
        // While editing, let the press place the caret instead of moving the element.
        if (!editing) onPointerDown(e)
      }}
      onDoubleClick={() => {
        if (!editing) onStartEditing()
      }}
    >
      <div
        // Remount per editing session so React never reconciles against user-typed DOM.
        key={editing ? "editing" : "static"}
        ref={textRef}
        contentEditable={editing ? "plaintext-only" : undefined}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => onCommit(e.currentTarget.textContent ?? "")}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur()
        }}
        className={cn(
          "absolute left-0 top-0 min-w-px origin-top-left whitespace-pre text-stone-950 outline-none",
          editing && "select-text",
        )}
        style={{
          transform: `scale(${camera.zoom})`,
          fontSize: TEXT_FONT_SIZE,
          lineHeight: `${TEXT_LINE_HEIGHT}px`,
          minHeight: TEXT_LINE_HEIGHT,
          cursor: editing ? "text" : "default",
        }}
      >
        {el.content}
      </div>

      {(selected || editing) && <SelectionChrome el={el} />}
    </div>
  )
}
