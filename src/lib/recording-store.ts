import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { connection } from "next/server"
import type { CursorRecording } from "@/components/cursor-engine"
import { heroRecording } from "@/components/hero-screen/hero-recording"

/**
 * The shared hero recording, stored as JSON on the server's disk so every visitor of `/` (and
 * `/screen`) sees the latest take. Written by `/api/recording` when a take is recorded / edited
 * on `/screen`. Commit `data/hero-recording.json` to ship it with the repo.
 */
const FILE = path.join(process.cwd(), "data", "hero-recording.json")

/** The stored take, else the one shipped in `hero-recording.ts`. Read per request, never prerendered. */
export async function readRecording(): Promise<CursorRecording | null> {
  await connection()
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as CursorRecording
  } catch {
    return heroRecording
  }
}

export async function writeRecording(recording: CursorRecording) {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(recording))
}

export async function deleteRecording() {
  await rm(FILE, { force: true })
}
