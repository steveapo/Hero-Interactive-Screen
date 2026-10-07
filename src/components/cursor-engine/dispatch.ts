/**
 * Synthetic input: makes playback actually drive the UI instead of just drawing a cursor.
 * Events are fired at the element under the point (the cursor overlay is pointer-events-none),
 * in the same order a real mouse produces them, so React `onPointerDown` / `onClick` handlers,
 * outside-click listeners, etc. all react as they would to the user.
 */

import type { CursorGestureEvent, CursorWheelEvent, KeyModifiers } from "./types"

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

/** `buttons` bitmask for a mouse button (left 1, right 2, middle 4). */
export function buttonsFor(button: number) {
  return button === 1 ? 4 : button === 2 ? 2 : 1
}

function pointerInit(point: Point, buttons: number, button = 0, mods?: KeyModifiers): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: point.clientX,
    screenY: point.clientY,
    button,
    buttons,
    ctrlKey: !!mods?.ctrl,
    metaKey: !!mods?.meta,
    shiftKey: !!mods?.shift,
    altKey: !!mods?.alt,
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

/**
 * Press: pointerdown + mousedown (+ focus for the left button, contextmenu for the right).
 * Returns the pressed element (for move/up).
 */
export function dispatchDown(point: Point, button = 0, mods?: KeyModifiers): Element | null {
  const target = document.elementFromPoint(point.clientX, point.clientY)
  if (!target) return null
  const buttons = buttonsFor(button)
  withoutPointerCapture(() => {
    const notCancelled = target.dispatchEvent(new PointerEvent("pointerdown", pointerInit(point, buttons, button, mods)))
    if (notCancelled) {
      target.dispatchEvent(new MouseEvent("mousedown", pointerInit(point, buttons, button, mods)))
      if (button === 0) focusTarget(target)
    }
    if (button === 2) target.dispatchEvent(new MouseEvent("contextmenu", pointerInit(point, buttons, button, mods)))
  })
  return target
}

/** Drag move while pressed: sent to the pressed element, as pointer capture would. */
export function dispatchMove(pressed: Element, point: Point, button = 0, mods?: KeyModifiers) {
  const buttons = buttonsFor(button)
  withoutPointerCapture(() => {
    // Moves report button -1: no button changed state.
    pressed.dispatchEvent(new PointerEvent("pointermove", pointerInit(point, buttons, -1, mods)))
    pressed.dispatchEvent(new MouseEvent("mousemove", pointerInit(point, buttons, 0, mods)))
  })
}

/**
 * Release: pointerup + mouseup, then (released over the pressed element) click for the left
 * button, auxclick for the others.
 */
export function dispatchUp(pressed: Element | null, point: Point, button = 0, mods?: KeyModifiers) {
  const over = document.elementFromPoint(point.clientX, point.clientY)
  const target = pressed ?? over
  if (!target) return
  withoutPointerCapture(() => {
    target.dispatchEvent(new PointerEvent("pointerup", pointerInit(point, 0, button, mods)))
    target.dispatchEvent(new MouseEvent("mouseup", pointerInit(point, 0, button, mods)))
    if (pressed && over && (pressed.contains(over) || over.contains(pressed))) {
      // Browsers fire click on the nearest common ancestor of the press and release targets.
      const clickTarget = pressed.contains(over) ? pressed : over
      if (button !== 0) {
        clickTarget.dispatchEvent(new MouseEvent("auxclick", { ...pointerInit(point, 0, button), detail: 1 }))
        return
      }
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
 * Key press (keydown + keyup) on `target`, with the modifiers held. Also performs the browser's
 * default actions that synthetic events don't trigger: Enter submits a form input, and Enter /
 * Space activate a focused button or link.
 */
export function dispatchKey(target: Element, key: string, code?: string, mods?: KeyModifiers) {
  if (target instanceof HTMLElement && target !== document.body) target.focus({ preventScroll: true })
  const init: KeyboardEventInit = {
    key,
    code: code ?? key,
    ctrlKey: !!mods?.ctrl,
    metaKey: !!mods?.meta,
    shiftKey: !!mods?.shift,
    altKey: !!mods?.alt,
    bubbles: true,
    cancelable: true,
    composed: true,
  }
  const notCancelled = target.dispatchEvent(new KeyboardEvent("keydown", init))
  const keyupNotCancelled = target.dispatchEvent(new KeyboardEvent("keyup", init))
  if (!notCancelled) return
  if (key === "Tab") {
    moveFocus(target, !!mods?.shift)
  } else if (key === "Enter" && target instanceof HTMLInputElement && target.form) {
    target.form.requestSubmit()
  } else if (key === "Enter" && (target instanceof HTMLButtonElement || (target instanceof HTMLAnchorElement && target.href))) {
    target.click()
  } else if (key === " " && keyupNotCancelled && target instanceof HTMLButtonElement) {
    target.click()
  }
}

/* ---------------------------------- Tab ----------------------------------- */

const FOCUSABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])'

/** Elements Tab visits, in the browser's order: positive tabindex ascending first, then DOM order. */
function tabOrder(): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest("[inert]") &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  )
  const positive = candidates.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex)
  return [...positive, ...candidates.filter((el) => el.tabIndex === 0)]
}

/**
 * Tab's default action (which synthetic key events don't perform): focus the next (or with
 * Shift, previous) element in tab order after `from`, showing its keyboard focus ring.
 */
function moveFocus(from: Element, backwards: boolean) {
  const order = tabOrder()
  if (order.length === 0) return
  const current = order.indexOf(from as HTMLElement)
  let next: number
  if (current === -1) {
    // Not in the order itself (e.g. the page): start at the first element after it in the DOM.
    const after = order.findIndex((el) => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    next = backwards ? (after === -1 ? order.length - 1 : after - 1) : after === -1 ? 0 : after
    if (from === document.body) next = backwards ? order.length - 1 : 0
  } else {
    next = current + (backwards ? -1 : 1)
  }
  const el = order[(next + order.length) % order.length]
  // `focusVisible` shows the ring as for real keyboard focus (Chrome / Firefox; ignored elsewhere).
  el.focus({ preventScroll: false, focusVisible: true } as FocusOptions)
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select()
}

/* --------------------------------- Hover ---------------------------------- */

/**
 * CSS :hover only follows the real mouse, so the replayed cursor's hover is mirrored onto a
 * `data-cursor-hover` attribute (on the hovered element and its ancestors, as :hover applies),
 * and every `:hover` rule in the page's stylesheets gets a twin matching that attribute instead.
 * Twins are inserted right after their original (same @media / @layer / order in the cascade)
 * and match nothing unless playback is hovering.
 */
const HOVER_ATTR = "data-cursor-hover"
const mirroredSheets = new WeakSet<CSSStyleSheet>()

function mirrorHoverRules(rules: CSSRuleList, parent: CSSStyleSheet | CSSGroupingRule) {
  // Backwards, so inserting after rule i doesn't shift the rules still to visit.
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]
    if (rule instanceof CSSStyleRule && rule.selectorText.includes(":hover")) {
      const selector = rule.selectorText.replace(/:hover\b/g, `[${HOVER_ATTR}]`)
      try {
        parent.insertRule(`${selector} { ${rule.style.cssText} }`, i + 1)
      } catch {
        // Selector the parser rejects after rewriting: skip that rule.
      }
    }
    // @media, @supports, @layer blocks, and nested rules.
    if (rule instanceof CSSGroupingRule) mirrorHoverRules(rule.cssRules, rule)
  }
}

/** Mirror :hover rules of any stylesheet not seen yet (new sheets load, HMR replaces them). */
function ensureHoverStyles() {
  for (const sheet of Array.from(document.styleSheets)) {
    if (mirroredSheets.has(sheet)) continue
    mirroredSheets.add(sheet)
    try {
      mirrorHoverRules(sheet.cssRules, sheet)
    } catch {
      // Cross-origin stylesheet: its rules can't be read.
    }
  }
}

function setHoverChain(from: Element[], to: Element[]) {
  for (const el of from) if (!to.includes(el)) el.removeAttribute(HOVER_ATTR)
  for (const el of to) el.setAttribute(HOVER_ATTR, "")
}

let hovered: Element | null = null

/** Chain from `el` up to the root (el first). */
function ancestors(el: Element | null) {
  const chain: Element[] = []
  for (let node = el; node; node = node.parentElement) chain.push(node)
  return chain
}

/**
 * Hover without a button pressed: pointerover/out and enter/leave as the element under the
 * cursor changes (so hover handlers, tooltips etc. react), then pointermove on it. CSS :hover
 * styles follow through the `data-cursor-hover` mirror above.
 */
export function dispatchHover(point: Point) {
  const target = document.elementFromPoint(point.clientX, point.clientY)
  withoutPointerCapture(() => {
    if (target !== hovered) {
      const previous = hovered
      hovered = target
      const oldChain = ancestors(previous)
      const newChain = ancestors(target)
      ensureHoverStyles()
      setHoverChain(oldChain, newChain)
      if (previous) {
        previous.dispatchEvent(new PointerEvent("pointerout", { ...pointerInit(point, 0, -1), relatedTarget: target }))
        previous.dispatchEvent(new MouseEvent("mouseout", { ...pointerInit(point, 0), relatedTarget: target }))
        for (const el of oldChain) {
          if (newChain.includes(el)) break
          el.dispatchEvent(new PointerEvent("pointerleave", { ...pointerInit(point, 0, -1), bubbles: false, relatedTarget: target }))
          el.dispatchEvent(new MouseEvent("mouseleave", { ...pointerInit(point, 0), bubbles: false, relatedTarget: target }))
        }
      }
      if (target) {
        target.dispatchEvent(new PointerEvent("pointerover", { ...pointerInit(point, 0, -1), relatedTarget: previous }))
        target.dispatchEvent(new MouseEvent("mouseover", { ...pointerInit(point, 0), relatedTarget: previous }))
        // Enter fires outermost first.
        for (const el of newChain.filter((el) => !oldChain.includes(el)).reverse()) {
          el.dispatchEvent(new PointerEvent("pointerenter", { ...pointerInit(point, 0, -1), bubbles: false, relatedTarget: previous }))
          el.dispatchEvent(new MouseEvent("mouseenter", { ...pointerInit(point, 0), bubbles: false, relatedTarget: previous }))
        }
      }
    }
    if (target) {
      target.dispatchEvent(new PointerEvent("pointermove", pointerInit(point, 0, -1)))
      target.dispatchEvent(new MouseEvent("mousemove", pointerInit(point, 0)))
    }
  })
}

/** Forget the hovered element and clear its hover styling (playback ended or restarts). */
export function resetHover() {
  for (const el of Array.from(document.querySelectorAll(`[${HOVER_ATTR}]`))) el.removeAttribute(HOVER_ATTR)
  hovered = null
}

/* ----------------------------- Wheel + gestures ----------------------------- */

/** Wheel event at the point: scroll, trackpad pan, or (with ctrl / meta) pinch / ⌘-scroll zoom. */
export function dispatchWheel(point: Point, wheel: CursorWheelEvent) {
  const target = document.elementFromPoint(point.clientX, point.clientY)
  if (!target) return
  target.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: point.clientX,
      clientY: point.clientY,
      screenX: point.clientX,
      screenY: point.clientY,
      deltaX: wheel.deltaX,
      deltaY: wheel.deltaY,
      deltaZ: wheel.deltaZ ?? 0,
      deltaMode: wheel.deltaMode,
      ctrlKey: !!wheel.mods?.ctrl,
      metaKey: !!wheel.mods?.meta,
      shiftKey: !!wheel.mods?.shift,
      altKey: !!wheel.mods?.alt,
    }),
  )
}

/**
 * Safari gesture event at the point. There's no GestureEvent constructor outside Safari, so it's
 * a plain UIEvent carrying the same fields (scale, rotation, clientX/Y) that listeners read.
 */
export function dispatchGesture(point: Point, gesture: CursorGestureEvent) {
  const target = document.elementFromPoint(point.clientX, point.clientY)
  if (!target) return
  const event = new UIEvent(gesture.type, { bubbles: true, cancelable: true, composed: true, view: window })
  Object.defineProperties(event, {
    scale: { value: gesture.scale },
    rotation: { value: gesture.rotation },
    clientX: { value: point.clientX },
    clientY: { value: point.clientY },
  })
  target.dispatchEvent(event)
}
