import type { CursorRecording } from "@/components/cursor-engine"

/**
 * The cursor recording played over the homepage hero.
 *
 * To (re)record: open the homepage with `?record=true`, press Record, drive the screen, press
 * Esc, preview with Play. To polish it (zooms, typing speed, pacing), open `?edit=true`.
 * Then "Copy JSON" and paste it here in place of `null` (edits are included).
 * Hide either panel with its × button or `?record=false` / `?edit=false`.
 */
export const heroRecording: CursorRecording | null = null
