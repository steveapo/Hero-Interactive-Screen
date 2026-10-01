/**
 * Typing: reading/writing editable fields in a way React notices, and the pacing rules that
 * turn a recorded before → after edit into steady, length-aware playback.
 */

import { inScope, resolveAnchorElement } from "./anchors"
import type { CursorAnchor, SmoothingOptions } from "./types"

export type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", ""])

/**
 * The field a typing run or key targets at playback: its anchor (or an editable inside it, when
 * the anchor is a tagged container), falling back to whichever field in the stage (or one of its
 * portals) has focus.
 */
export function resolveField(stage: HTMLElement, anchor: CursorAnchor | undefined): EditableElement | null {
  const el = anchor ? resolveAnchorElement(stage, anchor) : null
  const fromAnchor =
    findEditable(el) ?? findEditable(el?.querySelector('input, textarea, [contenteditable]:not([contenteditable="false"])') ?? null)
  if (fromAnchor) return fromAnchor
  const focused = findEditable(document.activeElement)
  return focused && inScope(stage, focused) ? focused : null
}

/** The editable field `target` belongs to (text input, textarea or contenteditable), if any. */
export function findEditable(target: EventTarget | null): EditableElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (target instanceof HTMLTextAreaElement) return target
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type) ? target : null
  if (target.isContentEditable) {
    return target.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])') ?? target
  }
  return null
}

export function readEditable(el: EditableElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
  return el.textContent ?? ""
}

/**
 * Set a field's text and fire `input` so React's onChange runs. Inputs go through the native
 * prototype setter: assigning `.value` directly would be swallowed by React's value tracking.
 * Contenteditable fields are set as plain text.
 */
export function writeEditable(el: EditableElement, value: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
    try {
      el.setSelectionRange(value.length, value.length) // keep the caret at the end
    } catch {
      // Some input types (e.g. email, number) don't support selection.
    }
  } else {
    el.textContent = value
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }))
}

/**
 * Number of single-character steps from `from` to `to`: backspace to the shared prefix,
 * then type the rest. (Retyping a word you corrected shows as delete-then-type.)
 */
export function typingSteps(from: string, to: string) {
  const prefix = sharedPrefix(from, to)
  return from.length - prefix + (to.length - prefix)
}

/** The field's text after `step` of `typingSteps(from, to)` steps. */
export function textAtStep(from: string, to: string, step: number) {
  const prefix = sharedPrefix(from, to)
  const deletes = from.length - prefix
  if (step <= deletes) return from.slice(0, from.length - step)
  return to.slice(0, Math.min(to.length, prefix + (step - deletes)))
}

/**
 * How long a run takes: typingMsPerChar × steps^typingGrowth, capped at maxTypingDuration.
 * With growth < 1, long text is typed faster per character, but the rate within one run stays
 * constant.
 */
export function typingDuration(steps: number, options: SmoothingOptions) {
  if (steps <= 0) return 0
  return Math.min(options.maxTypingDuration, options.typingMsPerChar * Math.pow(steps, options.typingGrowth))
}

function sharedPrefix(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}
