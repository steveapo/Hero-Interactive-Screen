import type { CursorRecording } from "@/components/cursor-engine"

/**
 * Fallback cursor recording for the homepage hero, used only while no take is stored on the
 * server (`data/hero-recording.json`, see `src/lib/recording-store.ts`).
 *
 * To (re)record: open `/screen` (recorder open by default), press Record, drive the screen, press
 * ⇧Esc, preview with Play. Each take is stored on the server and plays on `/` for every visitor.
 * To polish it (zooms, typing speed, pacing), open `/screen?edit=true`; edits are stored too.
 * To bake a take into the code instead, "Copy JSON" and paste it here in place of `null`.
 */
export const heroRecording: CursorRecording | null = null
