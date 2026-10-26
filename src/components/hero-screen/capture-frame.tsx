"use client"

import { CODEBASE_WIDTH } from "./codebase-frame"

/**
 * A piece of the live app captured in Build mode (Area capture, or the whole page), to be placed
 * on the canvas as a frame. It's a static copy of the element's markup as it was on screen, laid
 * out again at the size it had, inside a container as wide as the app's, so its cqw sizes (and
 * everything inherited from the app) resolve the same.
 */
export type CapturedElement = {
  /** Shown above the frame on the canvas. */
  name: string
  /** The element's markup (outerHTML). */
  html: string
  /** Its size on screen when captured (layout px). */
  width: number
  height: number
  /** Width of the container its cqw sizes resolve against (layout px). */
  containerWidth: number
  /** Text styles it inherited from the app. */
  font: { family: string; size: string; lineHeight: string; color: string; letterSpacing: string }
}

/** A captured element on the canvas: x/y = top-left, w/h = size, in canvas units. */
export type CanvasCapture = { id: string; capture: CapturedElement; x: number; y: number; w: number; h: number }

/** Attributes that only mean something in the live app (e.g. hidden behind a built variant). */
const LIVE_ONLY_ATTRIBUTES = ["data-built-swapped", "data-cursor-id"]

/**
 * Copy an element of the live app (inside the Portal's device screen). `scale`: the screen's drawn
 * scale (screen px per layout px).
 */
export function captureElement(el: Element, name: string, scale = 1): CapturedElement | null {
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const container = containerOf(el)
  const clone = el.cloneNode(true) as Element
  for (const attr of LIVE_ONLY_ATTRIBUTES) {
    clone.removeAttribute(attr)
    clone.querySelectorAll(`[${attr}]`).forEach((node) => node.removeAttribute(attr))
  }
  const inherited = getComputedStyle(el.parentElement ?? el)
  return {
    name,
    html: clone.outerHTML,
    width: rect.width / scale,
    height: rect.height / scale,
    containerWidth: (container?.getBoundingClientRect().width ?? rect.width) / scale,
    font: {
      family: inherited.fontFamily,
      size: inherited.fontSize,
      lineHeight: inherited.lineHeight,
      color: inherited.color,
      letterSpacing: inherited.letterSpacing,
    },
  }
}

/** The nearest size container above an element (what its cqw sizes resolve against). */
function containerOf(el: Element): Element | null {
  let node = el.parentElement
  while (node) {
    const type = getComputedStyle(node).containerType
    if (type && type !== "normal") return node
    node = node.parentElement
  }
  return null
}

/** A readable name for a captured element: its label, its first words, or its tag. */
export function captureName(el: Element) {
  const label = el.getAttribute("aria-label") ?? el.getAttribute("alt")
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim()
  const what = label || (text ? (text.length > 28 ? `${text.slice(0, 28)}…` : text) : el.tagName.toLowerCase())
  return `Captured — ${what}`
}

/** Canvas units per layout px of a capture: the app is laid out CODEBASE_WIDTH units wide. */
export function captureUnits(capture: CapturedElement) {
  return CODEBASE_WIDTH / capture.containerWidth
}

/**
 * A captured element on the canvas: its copy drawn at its captured layout, scaled to the frame.
 * Dragging it moves it.
 */
export function CapturedFrame({
  item,
  camera,
  selected,
  onPointerDown,
}: {
  item: CanvasCapture
  camera: { x: number; y: number; zoom: number }
  selected: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const { capture } = item
  const width = item.w * camera.zoom
  const height = item.h * camera.zoom
  return (
    <div
      data-cursor-id={`capture-${item.id}`}
      className="absolute"
      style={{
        left: `calc(50% + ${camera.x + item.x * camera.zoom}px)`,
        top: `calc(50% + ${camera.y + item.y * camera.zoom}px)`,
        width,
        height,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(e)
      }}
    >
      <span
        className="absolute -top-7 left-0 flex h-6 max-w-full items-center overflow-hidden whitespace-nowrap font-medium"
        style={{ fontSize: 10, color: selected ? "#2f6bf6" : "#78716c", maxWidth: Math.max(width, 80) }}
      >
        <span className="truncate">{item.capture.name}</span>
      </span>
      <div className="pointer-events-none relative size-full overflow-hidden bg-white shadow-[0_0_0_1px_rgba(17,17,16,0.08)]">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: capture.width, height: capture.height, transform: `scale(${width / capture.width})` }}
        >
          <div className="absolute left-0 top-0 [container-type:inline-size]" style={{ width: capture.containerWidth }}>
            <div
              className="relative"
              style={{
                width: capture.width,
                height: capture.height,
                fontFamily: capture.font.family,
                fontSize: capture.font.size,
                lineHeight: capture.font.lineHeight,
                color: capture.font.color,
                letterSpacing: capture.font.letterSpacing,
              }}
              // A copy of the app's own markup, captured from this page.
              dangerouslySetInnerHTML={{ __html: capture.html }}
            />
          </div>
        </div>
      </div>
      {selected && <div className="pointer-events-none absolute -inset-px border border-[#2f6bf6]" />}
    </div>
  )
}
