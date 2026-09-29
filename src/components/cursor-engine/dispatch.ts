/**
 * Synthetic input: makes playback actually drive the UI instead of just drawing a cursor.
 * Events are fired at the element under the point (the cursor overlay is pointer-events-none),
 * in the same order a real mouse produces them, so React `onPointerDown` / `onClick` handlers,
 * outside-click listeners, etc. all react as they would to the user.
 */

/** Mouse pointer id; browsers treat it as always active (Chrome/Safari use 1, Firefox 0). */
let mousePointerId = 1
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.isTrusted && e.pointerType === "mouse") mousePointerId = e.pointerId
    },
    { capture: true, passive: true },
  )
}

type Point = { clientX: number; clientY: number }

function pointerInit(point: Point, buttons: number): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: point.clientX,
    screenY: point.clientY,
    button: 0,
    buttons,
    pointerId: mousePointerId,
    pointerType: "mouse",
    isPrimary: true,
  }
}

/**
 * Components often call `setPointerCapture(e.pointerId)` in their handlers. A synthetic
 * pointer can make that throw, so capture calls are made no-ops only for the duration of a
 * synthetic dispatch.
 */
function withoutPointerCapture(run: () => void) {
  const proto = Element.prototype
  const set = proto.setPointerCapture
  const release = proto.releasePointerCapture
  proto.setPointerCapture = function () {}
  proto.releasePointerCapture = function () {}
  try {
    run()
  } finally {
    proto.setPointerCapture = set
    proto.releasePointerCapture = release
  }
}

function focusTarget(target: Element) {
  const focusable = target.closest<HTMLElement>(
    'input, textarea, select, button, a[href], [tabindex], [contenteditable="true"]',
  )
  if (focusable) focusable.focus({ preventScroll: true })
  else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}

/** Press: pointerdown + mousedown + focus. Returns the pressed element (for move/up). */
export function dispatchDown(point: Point): Element | null {
  const target = document.elementFromPoint(point.clientX, point.clientY)
  if (!target) return null
  withoutPointerCapture(() => {
    const notCancelled = target.dispatchEvent(new PointerEvent("pointerdown", pointerInit(point, 1)))
    if (notCancelled) {
      target.dispatchEvent(new MouseEvent("mousedown", pointerInit(point, 1)))
      focusTarget(target)
    }
  })
  return target
}

/** Drag move while pressed: sent to the pressed element, as pointer capture would. */
export function dispatchMove(pressed: Element, point: Point) {
  withoutPointerCapture(() => {
    pressed.dispatchEvent(new PointerEvent("pointermove", pointerInit(point, 1)))
    pressed.dispatchEvent(new MouseEvent("mousemove", pointerInit(point, 1)))
  })
}

/** Release: pointerup + mouseup, then click if released over the pressed element. */
export function dispatchUp(pressed: Element | null, point: Point) {
  const over = document.elementFromPoint(point.clientX, point.clientY)
  const target = pressed ?? over
  if (!target) return
  withoutPointerCapture(() => {
    target.dispatchEvent(new PointerEvent("pointerup", pointerInit(point, 0)))
    target.dispatchEvent(new MouseEvent("mouseup", pointerInit(point, 0)))
    if (pressed && over && (pressed.contains(over) || over.contains(pressed))) {
      // Browsers fire click on the nearest common ancestor of the press and release targets.
      const clickTarget = pressed.contains(over) ? pressed : over
      // A second click on the same element within the double-click window is a double-click.
      const now = performance.now()
      const isDouble = lastClick?.target === clickTarget && now - lastClick.time < DOUBLE_CLICK_MS
      clickTarget.dispatchEvent(new MouseEvent("click", { ...pointerInit(point, 0), detail: isDouble ? 2 : 1 }))
      if (isDouble) {
        clickTarget.dispatchEvent(new MouseEvent("dblclick", { ...pointerInit(point, 0), detail: 2 }))
        lastClick = null
      } else {
        lastClick = { target: clickTarget, time: now }
      }
    }
  })
}

const DOUBLE_CLICK_MS = 500
let lastClick: { target: Element; time: number } | null = null

/**
 * Key press on a field (keydown + keyup). Enter in a form input also submits the form, as the
 * browser would, unless a keydown handler prevented it.
 */
export function dispatchKey(field: HTMLElement, key: string) {
  field.focus({ preventScroll: true })
  const init: KeyboardEventInit = { key, code: key, bubbles: true, cancelable: true, composed: true }
  const notCancelled = field.dispatchEvent(new KeyboardEvent("keydown", init))
  field.dispatchEvent(new KeyboardEvent("keyup", init))
  if (notCancelled && key === "Enter" && field instanceof HTMLInputElement && field.form) {
    field.form.requestSubmit()
  }
}
