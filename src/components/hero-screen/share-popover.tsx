"use client"

import { memo, useEffect, useRef, useState } from "react"

/**
 * Top-bar Share control: publishes the canvas to a preview URL.
 * - Not published: "Create Preview Link".
 * - Published, nothing changed since: "Everything up to date" (disabled) + Open / Copy.
 * - Published, changed since: "Update" + Open / Copy.
 *
 * `changes` lists the values that make up the current canvas content. Publishing snapshots them;
 * once any of them is a different value, the preview is out of date.
 */
export const ShareButton = memo(function ShareButton({
  previewUrl,
  changes,
}: {
  previewUrl: string
  changes: readonly unknown[]
}) {
  const [open, setOpen] = useState(false)
  const [publishedAt, setPublishedAt] = useState<number | null>(null)
  const [publishedChanges, setPublishedChanges] = useState<readonly unknown[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const published = publishedAt !== null && publishedChanges !== null
  const upToDate =
    published &&
    publishedChanges.length === changes.length &&
    publishedChanges.every((value, i) => Object.is(value, changes[i]))

  function publish() {
    setPublishedAt(Date.now())
    setPublishedChanges(changes)
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative ml-0.5">
      <button
        type="button"
        data-cursor-id="share"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center rounded-md bg-mi-lime px-3 text-px-13 font-medium text-stone-900 shadow-[0_1px_2px_rgba(22,33,10,0.12)] hover:bg-mi-lime-deep"
      >
        Share
      </button>

      {open && (
        <SharePopover
          previewUrl={previewUrl}
          publishedAt={publishedAt}
          upToDate={upToDate}
          onPublish={publish}
        />
      )}
    </div>
  )
})

function SharePopover({
  previewUrl,
  publishedAt,
  upToDate,
  onPublish,
}: {
  previewUrl: string
  publishedAt: number | null
  upToDate: boolean
  onPublish: () => void
}) {
  const now = useNow()
  const [copied, setCopied] = useState(false)

  // Reset the "Copied" label after a moment
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
    } catch {
      // Clipboard access denied: leave the label as is
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Preview URL"
      className="absolute right-0 top-full z-50 mt-1.5 flex w-64 flex-col rounded-xl border border-stone-700/10 bg-[#f3f3f1] p-3 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <h2 className="text-px-13 font-medium text-stone-900">Preview URL</h2>
      <p className="mt-0.5 text-px-12 text-stone-600">
        {publishedAt === null ? "Not published" : `Published ${timeAgo(publishedAt, now)}`}
      </p>

      {publishedAt === null ? (
        <button
          type="button"
          onClick={onPublish}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-md bg-mi-lime text-px-12 font-medium text-stone-900 shadow-[0_1px_2px_rgba(22,33,10,0.12)] hover:bg-mi-lime-deep"
        >
          Create Preview Link
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onPublish}
            disabled={upToDate}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-md bg-mi-lime text-px-12 font-medium text-stone-900 shadow-[0_1px_2px_rgba(22,33,10,0.12)] hover:bg-mi-lime-deep disabled:text-stone-500 disabled:shadow-none disabled:hover:bg-mi-lime"
          >
            {upToDate ? "Everything up to date" : "Update"}
          </button>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center justify-center rounded-md bg-stone-700/5 text-px-13 font-medium text-stone-800 hover:bg-stone-700/10"
            >
              Open
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex h-8 items-center justify-center rounded-md bg-stone-700/5 text-px-13 font-medium text-stone-800 hover:bg-stone-700/10"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Current time, refreshed every 30s so the "Published …" label stays current while open. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** "just now", "about 1 minute ago", "about 22 hours ago", "about 3 days ago". */
function timeAgo(from: number, now: number) {
  const minutes = Math.floor(Math.max(0, now - from) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `about ${plural(minutes, "minute")} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `about ${plural(hours, "hour")} ago`
  return `about ${plural(Math.floor(hours / 24), "day")} ago`
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`
}
