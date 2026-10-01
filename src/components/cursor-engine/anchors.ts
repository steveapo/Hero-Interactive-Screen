import type { AnchorFingerprint, CursorAnchor } from "./types"

/**
 * Anchors tie a press (or key, typing run, scroll) to the element it happened on, so playback
 * can find that element again — even after re-renders, siblings coming and going, lists
 * growing, or when it lives in a portal (popover, dropdown, dialog rendered into <body>).
 *
 * An anchor names a *base* element and a short child path (`rel`) from it down to the element:
 * - `data-cursor-id="..."` on the element or an ancestor: most robust, use it on key controls.
 * - Otherwise the nearest ancestor-or-self that identifies itself: role / aria-label / title /
 *   alt / name / placeholder, or short text ("Clear", "Rename"), plus `nth` among equal matches.
 * - Otherwise the old structural child-index path from the stage.
 * An anchor whose base isn't on screen resolves to null (never to some other element), so
 * playback can wait for it to appear instead of clicking the wrong thing.
 */

const ANCHOR_ATTR = "data-cursor-id"
const IGNORE_ATTR = "data-cursor-ignore"

/** Attributes that identify an element, most specific first; the first one present is used (plus role). */
const LABEL_ATTRS = ["aria-label", "title", "alt", "name", "data-testid", "placeholder"]
/** Text longer than this is content, not a label. */
const MAX_TEXT = 40

/** Controls a press snaps to, so the anchor is the button rather than the icon inside it. */
const CONTROL = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "summary",
  "label",
  ...["button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "tab", "checkbox", "radio", "switch", "treeitem"].map(
    (role) => `[role="${role}"]`,
  ),
  '[contenteditable]:not([contenteditable="false"])',
].join(", ")

/** <body> children that are never app portals. */
const NOT_PORTAL = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE", "NEXTJS-PORTAL", "NEXT-ROUTE-ANNOUNCER"])

/* --------------------------------- Scope ---------------------------------- */

/** The direct child of <body> that contains `node`. */
function topLevel(node: Node): Element | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement
  while (el && el.parentElement && el.parentElement !== document.body) el = el.parentElement
  return el?.parentElement === document.body ? el : null
}

/** Portal containers: <body> children other than the one holding the stage (popovers, dialogs, dropdowns). */
export function portalRoots(stage: HTMLElement): Element[] {
  const own = topLevel(stage)
  return Array.from(document.body.children).filter(
    (el) => el !== own && !NOT_PORTAL.has(el.tagName) && !el.hasAttribute(IGNORE_ATTR),
  )
}

/** Whether `node` is part of what's recorded and replayed: inside the stage, or in a portal. */
export function inScope(stage: HTMLElement, node: Node | null): boolean {
  if (!node) return false
  if (stage.contains(node)) return true
  const top = topLevel(node)
  return !!top && top !== topLevel(stage) && !NOT_PORTAL.has(top.tagName)
}

/* ------------------------------ Fingerprints ------------------------------ */

type FingerprintKey = Omit<AnchorFingerprint, "nth">

const normText = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim()
const isVisible = (el: Element) => el.getClientRects().length > 0 && !el.closest(`[${IGNORE_ATTR}]`)

/** What identifies `el` on its own, or null if nothing does (a plain wrapper div, an icon path). */
function fingerprintKey(el: Element): FingerprintKey | null {
  // Shapes inside icons change with state (fill, stroke) and say nothing about the control.
  if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) return null
  const tag = el.tagName.toLowerCase()
  const attrs: Record<string, string> = {}
  const role = el.getAttribute("role")
  if (role) attrs.role = role
  for (const name of LABEL_ATTRS) {
    const value = el.getAttribute(name)
    if (value) {
      attrs[name] = value
      break
    }
  }
  if (Object.keys(attrs).length > 0) return { tag, attrs }
  if (el instanceof SVGElement) return null
  const text = normText(el)
  if (text && text.length <= MAX_TEXT) return { tag, text }
  return null
}

function matches(el: Element, key: FingerprintKey) {
  if (key.attrs) {
    for (const [name, value] of Object.entries(key.attrs)) if (el.getAttribute(name) !== value) return false
  }
  if (key.text !== undefined && normText(el) !== key.text) return false
  return true
}

/** Visible elements matching `key` in the stage, then in portals, in document order. */
function candidates(stage: HTMLElement, key: FingerprintKey): Element[] {
  if (key.top) return portalRoots(stage).filter((el) => el.tagName.toLowerCase() === key.tag && isVisible(el))
  const selector =
    key.tag +
    Object.entries(key.attrs ?? {})
      .map(([name, value]) => `[${name}="${CSS.escape(value)}"]`)
      .join("")
  const found: Element[] = []
  for (const root of [stage, ...portalRoots(stage)]) {
    if (root.matches(selector) && matches(root, key) && isVisible(root)) found.push(root)
    for (const el of Array.from(root.querySelectorAll(selector))) {
      if (matches(el, key) && isVisible(el)) found.push(el)
    }
  }
  return found
}

/* -------------------------------- Describe -------------------------------- */

type AnchorBase = Omit<CursorAnchor, "fx" | "fy">

/** Walk up from `el` to the nearest element that can be found again, noting the path down. */
function identify(stage: HTMLElement, el: Element): AnchorBase | undefined {
  const rel: number[] = []
  const withRel = (base: AnchorBase): AnchorBase => (rel.length ? { ...base, rel: [...rel] } : base)
  let node: Element = el
  for (;;) {
    const id = node.getAttribute(ANCHOR_ATTR)
    if (id) return withRel({ id })
    const key = fingerprintKey(node)
    if (key) {
      const nth = candidates(stage, key).indexOf(node)
      if (nth >= 0) return withRel({ fp: { ...key, nth } })
    }
    if (node === stage) return { path: [...rel] }
    const parent: Element | null = node.parentElement
    if (!parent) return undefined
    if (parent === document.body) {
      // Top of a portal with nothing identifiable on the way: the container itself, by order.
      const key: FingerprintKey = { tag: node.tagName.toLowerCase(), top: true }
      const nth = candidates(stage, key).indexOf(node)
      return nth >= 0 ? withRel({ fp: { ...key, nth } }) : undefined
    }
    rel.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
}

/** Build an anchor for a press on `target` at client point (clientX, clientY). */
export function describeAnchor(
  stage: HTMLElement,
  target: Element,
  clientX: number,
  clientY: number,
): CursorAnchor | undefined {
  if (!inScope(stage, target)) return undefined

  // Snap to the nearest tagged element or control (whichever is closer to the target).
  const tagged = target.closest(`[${ANCHOR_ATTR}]`)
  const control = target.closest(CONTROL)
  const near = [tagged, control].filter((n): n is Element => !!n && inScope(stage, n))
  const el = near.length === 2 ? (near[0].contains(near[1]) ? near[1] : near[0]) : (near[0] ?? target)

  const base = identify(stage, el)
  if (!base) return undefined
  const rect = el.getBoundingClientRect()
  const fx = rect.width ? (clientX - rect.left) / rect.width : 0.5
  const fy = rect.height ? (clientY - rect.top) / rect.height : 0.5
  return { ...base, fx, fy }
}

/** Anchor for `el` itself (not a control around it), e.g. a scroll container or focused element. */
export function describeElementAnchor(stage: HTMLElement, el: Element): CursorAnchor | undefined {
  if (!inScope(stage, el)) return undefined
  const base = identify(stage, el)
  return base ? { ...base, fx: 0.5, fy: 0.5 } : undefined
}

/* -------------------------------- Resolve --------------------------------- */

/**
 * Resolution runs every frame for the next target (re-aiming, waiting for it to appear), so a
 * result is reused for a moment while its element is still in the page.
 */
const RESOLVE_CACHE_MS = 50
const resolveCache = new WeakMap<CursorAnchor, { el: Element | null; at: number }>()

function resolveUncached(stage: HTMLElement, anchor: CursorAnchor): Element | null {
  let el: Element | null = null
  if (anchor.id) {
    const selector = `[${ANCHOR_ATTR}="${CSS.escape(anchor.id)}"]`
    for (const root of [stage, ...portalRoots(stage)]) {
      el = root.matches(selector) ? root : root.querySelector(selector)
      if (el) break
    }
  } else if (anchor.fp) {
    el = candidates(stage, anchor.fp)[anchor.fp.nth] ?? null
  } else if (anchor.path) {
    el = stage
    for (const index of anchor.path) {
      el = el?.children[index] ?? null
      if (!el) break
    }
    return el
  }
  for (const index of anchor.rel ?? []) {
    el = el?.children[index] ?? null
    if (!el) break
  }
  return el
}

/** Find the element an anchor points at, or null if it isn't in the page (yet). */
export function resolveAnchorElement(stage: HTMLElement, anchor: CursorAnchor): Element | null {
  const now = performance.now()
  const cached = resolveCache.get(anchor)
  if (cached && now - cached.at < RESOLVE_CACHE_MS && (!cached.el || cached.el.isConnected)) return cached.el
  const el = resolveUncached(stage, anchor)
  resolveCache.set(anchor, { el, at: now })
  return el
}

/** Resolve an anchor to a point in current stage px, or null if its element is gone / hidden. */
export function resolveAnchor(stage: HTMLElement, anchor: CursorAnchor): { x: number; y: number } | null {
  const el = resolveAnchorElement(stage, anchor)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  const stageRect = stage.getBoundingClientRect()
  return {
    x: rect.left - stageRect.left + rect.width * anchor.fx,
    y: rect.top - stageRect.top + rect.height * anchor.fy,
  }
}
