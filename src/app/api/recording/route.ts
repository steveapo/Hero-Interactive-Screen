import type { CursorRecording } from "@/components/cursor-engine"
import { deleteRecording, readRecording, writeRecording } from "@/lib/recording-store"

/** The shared hero recording: GET reads it, PUT replaces it, DELETE removes it. */
export async function GET() {
  return Response.json(await readRecording())
}

export async function PUT(request: Request) {
  const recording = (await request.json()) as CursorRecording | null
  if (!recording || recording.version !== 1 || !Array.isArray(recording.samples)) {
    return Response.json({ error: "Invalid recording" }, { status: 400 })
  }
  await writeRecording(recording)
  return new Response(null, { status: 204 })
}

export async function DELETE() {
  await deleteRecording()
  return new Response(null, { status: 204 })
}
