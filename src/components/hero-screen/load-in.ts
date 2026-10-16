"use client"

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react"

/**
 * Shared pieces of the "flip" load-in (the homepage hero): the flip-down of canvas frames, and the
 * side panels moving in with their contents appearing one after another.
 */

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Soft ease-out with no bounce: fast start, long gentle settle. */
const SETTLE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/* ------------------------------- Flip down -------------------------------- */

/** How far above its place a frame starts its flip (screen px). */
const FLIP_RISE_PX = 36
/** Perspective of the flip (px): lower = more dramatic depth. */
const FLIP_PERSPECTIVE_PX = 1400

/**
 * A canvas frame flips down onto the screen from above: it starts standing straight up out of the
 * screen (rotated 90° about its top edge, so it's edge-on and invisible) and a little higher than its
 * place, then lowers until it lies flat in place. Uses `transform` only (positioning in these frames
 * uses the `translate` property and left / top), so it composes with them. `backwards` keeps the
 * start frame applied during the delay.
 */
export function playFlipIn(el: HTMLElement, { delay, duration }: { delay: number; duration: number }) {
  if (reducedMotion()) return []
  const timing = { delay, duration, fill: "backwards" } as const
  const flip = el.animate(
    [
      {
        transformOrigin: "50% 0%",
        transform: `perspective(${FLIP_PERSPECTIVE_PX}px) translateY(-${FLIP_RISE_PX}px) rotateX(90deg)`,
      },
      {
        transformOrigin: "50% 0%",
        transform: `perspective(${FLIP_PERSPECTIVE_PX}px) translateY(0px) rotateX(0deg)`,
      },
    ],
    { ...timing, easing: SETTLE_EASING },
  )
  const fade = el.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.45 },
      { opacity: 1, offset: 1 },
    ],
    { ...timing, easing: "ease-out" },
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
 * A docked panel plays the load-in entrance when it mounts during the panel step (see
 * PanelLoadInContext). `playing` is read on mount: whether it should skip its usual quick entrance.
 */
export function usePanelLoadIn<T extends HTMLElement>(from: "left" | "right") {
  const active = useContext(PanelLoadInContext)
  const ref = useRef<T>(null)
  const [playing] = useState(active)
  useLayoutEffect(() => {
    const el = ref.current
    if (!playing || !el) return
    const animations = playPanelIn(el, from)
    return () => animations.forEach((a) => a.cancel())
  }, [playing, from])
  return { ref, playing }
}

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
