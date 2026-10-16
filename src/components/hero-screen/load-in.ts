"use client"

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties } from "react"

/**
 * Shared pieces of the "flip" load-in (the homepage hero): the flip-down of canvas frames, and the
 * side panels moving in with their contents appearing one after another.
 */

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Soft ease-out with no bounce: fast start, long gentle settle. */
const SETTLE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/* -------------------------------- Flip up --------------------------------- */

/** How far below its place a frame starts its flip by default (screen px). */
const FLIP_RISE_PX = 36
/**
 * Perspective of the flip (px): lower = more dramatic depth. Strong, so a frame lifted towards the
 * viewer reads clearly larger before it settles down to its true size.
 */
const FLIP_PERSPECTIVE_PX = 900
/**
 * How far towards the viewer a frame starts (px along the z axis). Under FLIP_PERSPECTIVE_PX it
 * starts ≈ 900 / (900 − 220) ≈ 1.3× its size, and comes down onto the screen as it lands.
 */
const FLIP_LIFT_PX = 220
/** While in flight a frame stacks over the canvas's other frames (still under the bars and panels). */
const FLIP_FLIGHT_Z = 12
/** How far a frame is tipped up off the screen when it starts (degrees, about its bottom edge). */
const FLIP_START_ANGLE_DEG = 30
/**
 * The flip's motion: it tips back slowly, gathers speed like something falling under its own
 * weight, and lands softly (no bounce: it can't pass through the screen).
 */
const FLIP_EASING = "cubic-bezier(0.5, 0, 0.2, 1)"

/**
 * A canvas frame comes up from below and lands on the screen: it starts lifted towards the viewer
 * (FLIP_LIFT_PX, so it looks larger), tipped up off the screen (rotated FLIP_START_ANGLE_DEG about
 * its bottom edge, its top edge towards the viewer), `rise` px lower than its place and
 * transparent; then it rises, fades in, comes down and tips back at once until it lies flat in
 * place at its true size. While in flight it stacks above the other frames. Uses `transform` only
 * (positioning in these frames uses the `translate` property and left / top), so it composes with
 * them. `backwards` keeps the start frame applied during the delay. `origin`: the hinge (default:
 * the element's own bottom edge).
 */
export function playFlipIn(
  el: HTMLElement,
  {
    delay,
    duration,
    origin = "50% 100%",
    rise = FLIP_RISE_PX,
  }: { delay: number; duration: number; origin?: string; rise?: number },
) {
  if (reducedMotion()) return []
  const timing = { delay, duration, fill: "backwards" } as const
  const flip = el.animate(
    [
      {
        zIndex: FLIP_FLIGHT_Z,
        transformOrigin: origin,
        transform: `perspective(${FLIP_PERSPECTIVE_PX}px) translateY(${rise}px) translateZ(${FLIP_LIFT_PX}px) rotateX(-${FLIP_START_ANGLE_DEG}deg)`,
      },
      {
        zIndex: FLIP_FLIGHT_Z,
        transformOrigin: origin,
        transform: `perspective(${FLIP_PERSPECTIVE_PX}px) translateY(0px) translateZ(0px) rotateX(0deg)`,
      },
    ],
    { ...timing, easing: FLIP_EASING },
  )
  // It starts tilted but face-on, so it fades in over the first part of the motion.
  const fade = el.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.3 },
      { opacity: 1, offset: 1 },
    ],
    { ...timing, easing: "linear" },
  )
  return [flip, fade]
}

/* ------------------------------ Side panels ------------------------------- */

/**
 * True while the load-in's panel step is on: a side panel (the sidebar's panel, the settings
 * panel) that mounts then moves in with its contents appearing one by one, instead of its usual
 * quick fade. Outside the load-in (or without one) it's false.
 */
export const PanelLoadInContext = createContext(false)

/** Marks a piece of a side panel that appears on its own during the panel load-in. */
export const LOAD_ITEM = { "data-load-item": "" } as const

/** A side panel's slide in (ms). */
const PANEL_MOVE_MS = 650
/** Its contents start appearing this far into the slide (ms)… */
const PANEL_ITEMS_AT = 220
/** …one after another, this far apart (ms), the gaps capped so long lists still finish promptly. */
const PANEL_ITEM_STAGGER_MS = 35
const PANEL_ITEMS_MAX_SPREAD_MS = 700
const PANEL_ITEM_MS = 420

/** The `[data-load-item]` pieces inside `root` rise a few px and fade in, one after another. */
export function playItemsIn(root: HTMLElement, startAt = PANEL_ITEMS_AT) {
  if (reducedMotion()) return []
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-load-item]"))
  const step = Math.min(PANEL_ITEM_STAGGER_MS, PANEL_ITEMS_MAX_SPREAD_MS / Math.max(1, items.length))
  return items.map((item, i) =>
    item.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      { delay: startAt + i * step, duration: PANEL_ITEM_MS, easing: SETTLE_EASING, fill: "backwards" },
    ),
  )
}

/**
 * A panel docked to the `from` edge slides in from beyond it and fades in; its pieces then appear
 * (see playItemsIn).
 */
export function playPanelIn(el: HTMLElement, from: "left" | "right") {
  if (reducedMotion()) return []
  const away = from === "left" ? "calc(-100% - 12px)" : "calc(100% + 12px)"
  const move = el.animate(
    [
      { opacity: 0, transform: `translateX(${away})` },
      { opacity: 1, transform: "translateX(0px)" },
    ],
    { duration: PANEL_MOVE_MS, easing: SETTLE_EASING, fill: "backwards" },
  )
  return [move, ...playItemsIn(el)]
}

/**
 * A docked panel's load-in entrance (see playPanelIn). It plays when the panel mounts during the
 * panel step (PanelLoadInContext), or, for a panel mounted ahead of time while `concealed` (so it's
 * loaded and laid out long before it shows), the moment it's revealed. `playing`: the panel is part
 * of the load-in, so it should skip its usual quick entrance.
 */
export function usePanelLoadIn<T extends HTMLElement>(from: "left" | "right", concealed = false) {
  const active = useContext(PanelLoadInContext)
  const ref = useRef<T>(null)
  const [playing] = useState(active || concealed)
  useLayoutEffect(() => {
    const el = ref.current
    if (!playing || concealed || !el) return
    const animations = playPanelIn(el, from)
    return () => animations.forEach((a) => a.cancel())
  }, [playing, concealed, from])
  return { ref, playing }
}

/** Style for a panel mounted ahead of its load-in: laid out and painted-ready, but unseen and unreachable. */
export const CONCEALED_STYLE: CSSProperties = { visibility: "hidden", pointerEvents: "none" }

/**
 * A panel growing out of the rail it's attached to (the left sidebar): the box is revealed from
 * the rail's size out to its full size (right and down), then its pieces appear. Sizes are layout
 * px, so a scaled screen doesn't matter.
 */
export function playExpandFrom(el: HTMLElement, from: { width: number; height: number }) {
  if (reducedMotion()) return []
  const right = Math.max(0, el.offsetWidth - from.width)
  const bottom = Math.max(0, el.offsetHeight - from.height)
  const expand = el.animate(
    [
      { clipPath: `inset(0px ${right}px ${bottom}px 0px round 12px)` },
      { clipPath: "inset(0px 0px 0px 0px round 12px)" },
    ],
    { duration: PANEL_MOVE_MS + 100, easing: SETTLE_EASING, fill: "backwards" },
  )
  return [expand, ...playItemsIn(el, PANEL_ITEMS_AT + 80)]
}
