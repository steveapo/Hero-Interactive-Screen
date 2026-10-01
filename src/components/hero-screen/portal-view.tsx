"use client"

import { useEffect, useRef, useState } from "react"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Laptop,
  Link,
  Mic,
  Monitor,
  Plus,
  RotateCw,
  Scaling,
  ScanLine,
  Smartphone,
  SquareDashedMousePointer,
  SquarePen,
  Tablet,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react"
import { PlannerScreen } from "@/app/copy-project/planner-screen"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { AgentStar } from "./planner-frame"

/** How long the darkened loading state shows before the live Calendar app loads in. */
const PORTAL_LOAD_MS = 2000

/** Route the portal previews. */
const PORTAL_PATH = "/"

/**
 * Loading phases of the preview:
 * - "start": progress bar at 0, about to animate
 * - "loading": darkened preview + spinner, progress bar creeping toward the end
 * - "loaded": live app, progress bar completes and fades out
 */
type LoadPhase = "start" | "loading" | "loaded"

/** A highlighted area in preview-box px (left/top relative to the preview), with the element's corner radius. */
type Box = { left: number; top: number; width: number; height: number; radius: string }

/** A capture flash: an element's box, or the whole page. `id` restarts the animation per capture. */
type Pulse = { id: number; box: Box | "page" }

/** Length of the capture flash; matches `--animate-mi-capture-pulse` in globals.css. */
const CAPTURE_PULSE_MS = 1100

/** Capture highlight colour (the canvas selection blue). */
const CAPTURE_BLUE = "#2f6bf6"

/**
 * Portal View: the live Codebase app opened full-screen (double-click the Codebase frame).
 * The preview is darkened with a spinner for ~2s, then the Calendar app loads in and plays its
 * intro. Back (or Escape) returns to the canvas; reload replays the loading.
 *
 * Capture: "Capture a selection" enters Area capture mode (the button becomes a badge). Hovering
 * an element of the app outlines it; clicking it flashes a blue overlay over it (the mode stays
 * on until the badge's ✕ or Escape). "Capture the page" flashes the whole page.
 */
export function PortalView({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<LoadPhase>("start")
  /** Bumped by reload: restarts the loading and remounts the app. */
  const [loadId, setLoadId] = useState(0)
  const [capturing, setCapturing] = useState(false)
  /** Element under the cursor in Area capture mode. */
  const [hover, setHover] = useState<Box | null>(null)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const nextPulseId = useRef(1)

  useEffect(() => {
    // Next frame: start the progress bar transition from 0.
    const frame = requestAnimationFrame(() => setPhase("loading"))
    const timer = setTimeout(() => setPhase("loaded"), PORTAL_LOAD_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [loadId])

  // The capture flash removes itself once it has faded.
  useEffect(() => {
    if (!pulse) return
    const timer = setTimeout(() => setPulse((p) => (p?.id === pulse.id ? null : p)), CAPTURE_PULSE_MS)
    return () => clearTimeout(timer)
  }, [pulse])

  // Escape leaves Area capture mode first, then the portal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      if (e.key !== "Escape") return
      if (capturing) stopCapture()
      else onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, capturing])

  function reload() {
    setPhase("start")
    setLoadId((id) => id + 1)
  }

  function stopCapture() {
    setCapturing(false)
    setHover(null)
  }

  /** The app element under the pointer (inside the device screen), or null. SVG parts resolve to their whole icon. */
  function captureTarget(target: EventTarget): Element | null {
    if (!(target instanceof Element) || !target.closest("[data-portal-screen]")) return null
    return target instanceof SVGElement ? (target.closest("svg") ?? target) : target
  }

  /** An element's box relative to the preview, with its own corner radius. */
  function boxOf(el: Element): Box | null {
    const preview = previewRef.current
    if (!preview) return null
    const p = preview.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { left: r.left - p.left, top: r.top - p.top, width: r.width, height: r.height, radius: getComputedStyle(el).borderRadius }
  }

  function flash(box: Box | "page") {
    setPulse({ id: nextPulseId.current++, box })
  }

  /** Area capture click: flash the element (the mode stays on until exited). */
  function captureElement(target: EventTarget) {
    const el = captureTarget(target)
    const box = el && boxOf(el)
    if (!box) return
    flash(box)
  }

  function capturePage() {
    stopCapture()
    flash("page")
  }

  const loaded = phase === "loaded"

  return (
    <div
      className="absolute inset-0 z-50 flex bg-stone-100 animate-in fade-in duration-150"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Preview column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Browser bar */}
        <header className="relative grid h-11 shrink-0 grid-cols-[1fr_minmax(0,440px)_1fr] items-center gap-3 border-b border-stone-200 bg-stone-50 px-2">
          <div className="flex items-center gap-0.5">
            <BarButton label="Back to canvas" onClick={onClose}>
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </BarButton>
            <BarButton label="Forward">
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </BarButton>
          </div>

          <div className="flex h-7 items-center gap-2 rounded-lg bg-stone-100 pl-2.5 pr-1 text-px-13 text-stone-900">
            <Link className="size-3 shrink-0 text-stone-500" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-center">{PORTAL_PATH}</span>
            <button
              type="button"
              aria-label="Reload"
              onClick={reload}
              className="flex size-6 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5"
            >
              <RotateCw className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 text-stone-800">
            {capturing ? (
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#e3f1e5] pl-2.5 pr-1 text-px-13 font-medium text-[#1e7b36] animate-in fade-in zoom-in-95 duration-150">
                <SquareDashedMousePointer className="size-3.5" strokeWidth={1.5} />
                Area capture
                <button
                  type="button"
                  aria-label="Exit area capture"
                  onClick={stopCapture}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-[#1e7b36]/10"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </span>
            ) : (
              <BarButton label="Capture a selection to the canvas (⌘S)" onClick={() => setCapturing(true)}>
                <SquareDashedMousePointer className="size-4" strokeWidth={1.25} />
              </BarButton>
            )}
            <BarButton label="Capture the page to the canvas (⇧⌘S)" onClick={capturePage}>
              <ScanLine className="size-4" strokeWidth={1.25} />
            </BarButton>
            <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-stone-300" />
            <ViewportSelect />
          </div>

          {/* Page-load progress */}
          <div
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-0.5 bg-[#2f6bf6]"
            style={{
              width: phase === "start" ? "0%" : phase === "loading" ? "93%" : "100%",
              opacity: loaded ? 0 : 1,
              transition:
                phase === "start"
                  ? "none"
                  : phase === "loading"
                    ? `width ${PORTAL_LOAD_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)`
                    : "width 200ms ease-out, opacity 300ms ease-out 200ms",
            }}
          />
        </header>

        {/* Preview */}
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-9">
          <div
            ref={previewRef}
            className="relative min-h-0 flex-1 overflow-hidden rounded-b-md border-x border-b border-stone-200 bg-white"
          >
            {/*
              isolate: the app's own z-indexes stay below the loading overlay.
              In Area capture mode the app's own clicks are blocked (capture phase): hovering
              outlines the element under the cursor, clicking captures it.
            */}
            <div
              className={cn("isolate flex size-full p-6", capturing && "[&_*]:!cursor-default")}
              onPointerMoveCapture={
                capturing
                  ? (e) => {
                      const el = captureTarget(e.target)
                      setHover(el ? boxOf(el) : null)
                    }
                  : undefined
              }
              onPointerLeave={capturing ? () => setHover(null) : undefined}
              onPointerDownCapture={
                capturing
                  ? (e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }
                  : undefined
              }
              onClickCapture={
                capturing
                  ? (e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      captureElement(e.target)
                    }
                  : undefined
              }
            >
              {/* Size container: the device fits both its width and height (the whole app stays visible) */}
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
                <PlannerDevice key={`${loadId}-${loaded ? "live" : "loading"}`} loaded={loaded} />
              </div>
            </div>

            {!loaded && (
              <div
                role="status"
                aria-label="Loading preview"
                className="absolute inset-0 z-10 flex items-center justify-center bg-stone-900/60"
              >
                <Spinner className="size-7 text-stone-200" strokeWidth={1.5} />
              </div>
            )}

            {/* Area capture: outline of the element under the cursor */}
            {capturing && hover && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 border-2"
                style={{ ...boxStyle(hover), borderColor: CAPTURE_BLUE }}
              />
            )}

            {/* Capture flash: blue overlay over the captured element, or the whole page */}
            {pulse && (
              <div
                key={pulse.id}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute z-20 border-2 animate-mi-capture-pulse",
                  pulse.box === "page" && "inset-0",
                )}
                style={{
                  ...(pulse.box === "page" ? {} : boxStyle(pulse.box)),
                  borderColor: CAPTURE_BLUE,
                  background: `${CAPTURE_BLUE}1f`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <PortalChat />
    </div>
  )
}

/** Absolute-position style for a capture Box. */
function boxStyle(box: Box): React.CSSProperties {
  return { left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius }
}

/**
 * Device height ÷ width: the screen (2048×2732) plus the 4.2cqw bezel on each side
 * → 0.084 + 0.916 × 2732/2048 ≈ 1.30593.
 */
const DEVICE_ASPECT = 1.30593

/**
 * The app at `/`: the iPad Calendar inside its device frame, as large as fits the preview
 * (100% of its height, or its width if that is narrower). While loading it renders the
 * finished screen instantly (sped-up intro) under the dark overlay; once loaded it remounts and
 * plays the intro at its normal pace.
 */
function PlannerDevice({ loaded }: { loaded: boolean }) {
  return (
    <div className="@container" style={{ width: `min(100cqw, calc(100cqh / ${DEVICE_ASPECT}))` }}>
      <div className="relative rounded-[6.5cqw] bg-[#1c1c1e] p-[4.2cqw] shadow-[0_0_0_0.3cqw_#3a3a3c]">
        {/* Camera */}
        <span className="absolute left-1/2 top-[1.8cqw] size-[1cqw] -translate-x-1/2 rounded-full bg-[#2c2c2e]" />
        {/* Side buttons */}
        <span className="absolute -top-[0.4cqw] right-[10cqw] h-[0.4cqw] w-[6cqw] rounded-t-[0.3cqw] bg-[#3a3a3c]" />
        <span className="absolute -right-[0.5cqw] top-[10cqw] h-[5cqw] w-[0.5cqw] rounded-r-[0.3cqw] bg-[#3a3a3c]" />
        <span className="absolute -right-[0.5cqw] top-[16.5cqw] h-[5cqw] w-[0.5cqw] rounded-r-[0.3cqw] bg-[#3a3a3c]" />
        <div data-portal-screen className="@container aspect-[2048/2732] overflow-hidden rounded-[2.2cqw] bg-white">
          <PlannerScreen introSpeed={loaded ? 1 : 1000} />
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- Chat ---------------------------------- */

const CHAT_FILES: { path: string; note: string }[] = [
  { path: "src/app/page.tsx", note: "the route, which renders PlannerDevice." },
  { path: "src/components/planner-device.tsx", note: "the device frame around the screen." },
  { path: "src/components/planner-screen.tsx", note: "the main planner UI (about 670 lines)." },
  { path: "src/components/rolling-readout.tsx", note: "the animated rolling number display." },
  { path: "src/lib/planner-days.ts", note: "the day data and helpers." },
  { path: "src/lib/use-planner-intro.ts", note: "the GSAP intro and day-change animations (about 920 lines)." },
]

/** Previous Build Agent chats (pseudo names), newest first; the first is the open one. */
const CHATS = [
  "Building Portal View",
  "Capturing Scroll Recording",
  "Adding Curve Handles To Frames",
  "Making Chat Pseudofunctional",
  "Adjusting Codebase Speed And Spacing",
  "Designing Share Button Functionality",
  "Making GitHub Button Interactive",
  "Opening Code Changes In Popover",
  "Implementing iPad Calendar Codebase",
  "Making Frames And Text Elements",
  "Setting Up Hero Canvas",
]

/** Gray disc with the Build Agent star: the chat icon. */
function ChatIcon() {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-500">
      <AgentStar className="size-2.5" />
    </span>
  )
}

/**
 * Header chat title: click opens a popover listing the chats; picking one makes it the open chat.
 * While `renaming`, the title is an input: Enter / blur saves, Escape cancels.
 */
function ChatSwitcher({
  chats,
  currentIndex,
  onSelect,
  renaming,
  onRenameEnd,
}: {
  chats: string[]
  currentIndex: number
  onSelect: (index: number) => void
  renaming: boolean
  /** Rename finished: the new name, or null when cancelled. */
  onRenameEnd: (name: string | null) => void
}) {
  const current = chats[currentIndex]
  const [open, setOpen] = useState(false)
  /** Which list the popover shows: the chats, or the (empty) archive. */
  const [view, setView] = useState<"chats" | "archived">("chats")
  const [draft, setDraft] = useState(current)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Rename starts: fill the input with the current name and select it.
  useEffect(() => {
    if (!renaming) return
    setDraft(current)
    requestAnimationFrame(() => inputRef.current?.select())
    // Only when rename starts, not on every name change.
  }, [renaming])

  /** Close the popover; it reopens on the chat list. */
  function close() {
    setOpen(false)
    setView("chats")
  }

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setView("chats")
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      setView("chats")
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="min-w-0">
      {renaming ? (
        <div className="flex h-7 min-w-0 items-center gap-1.5 px-1">
          <ChatIcon />
          <input
            ref={inputRef}
            aria-label="Chat name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onRenameEnd(draft.trim() || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameEnd(draft.trim() || null)
              if (e.key === "Escape") onRenameEnd(null)
            }}
            className="-my-1 w-[220px] min-w-0 select-text rounded-md bg-white px-1.5 py-1 text-px-13 font-medium text-stone-900 shadow-[0_0_0_1px_rgba(47,107,246,0.6)] outline-none"
          />
        </div>
      ) : (
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 text-px-13 font-medium text-stone-900 hover:bg-stone-700/5",
          open && "bg-stone-700/5",
        )}
      >
        <ChatIcon />
        <span className="truncate">{current}</span>
        <ChevronDown className="size-3 shrink-0 text-stone-500" strokeWidth={1.5} />
      </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute inset-x-1.5 top-full z-50 flex flex-col rounded-xl border border-stone-200 bg-white shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {view === "archived" ? (
            <>
              <div className="flex h-12 items-center gap-2 border-b border-stone-200 px-1.5">
                <button
                  type="button"
                  aria-label="Back to chats"
                  onClick={() => setView("chats")}
                  className="flex size-7 items-center justify-center rounded-md text-stone-500 hover:bg-stone-700/5 hover:text-stone-800"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                <span className="text-px-13 font-medium text-stone-900">Archived</span>
              </div>
              <p className="px-3.5 py-3 text-px-13 text-stone-500">No archived agents</p>
            </>
          ) : (
            <>
              <div className="flex max-h-[320px] flex-col overflow-y-auto p-1.5">
                {chats.map((chat, i) => (
                  <button
                    key={i}
                    type="button"
                    role="menuitemradio"
                    aria-checked={i === currentIndex}
                    onClick={() => {
                      onSelect(i)
                      close()
                    }}
                    className="flex h-[34px] shrink-0 items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-900 hover:bg-stone-700/5"
                  >
                    <ChatIcon />
                    <span className="min-w-0 flex-1 truncate">{chat}</span>
                    {i === currentIndex && <Check className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />}
                  </button>
                ))}
              </div>
              <div className="border-t border-stone-200 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView("archived")}
                  className="flex h-[34px] w-full items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-700 hover:bg-stone-700/5"
                >
                  <Archive className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />
                  <span className="flex-1">Archived</span>
                  <ChevronRight className="size-3.5 shrink-0 text-stone-400" strokeWidth={1.5} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Right-side Build Agent chat for the portal. */
function PortalChat() {
  const [prompt, setPrompt] = useState("")
  const [sent, setSent] = useState<string[]>([])
  /** Chat names (renamable) and which one is open. */
  const [chats, setChats] = useState(CHATS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [renaming, setRenaming] = useState(false)
  const empty = prompt.trim() === ""

  function endRename(name: string | null) {
    setRenaming(false)
    if (name) setChats((c) => c.map((chat, i) => (i === currentIndex ? name : chat)))
  }

  function send() {
    const text = prompt.trim()
    if (text === "") return
    setSent((s) => [...s, text])
    setPrompt("")
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col bg-white">
      <header className="relative flex h-10 shrink-0 items-center justify-between gap-2 pl-3 pr-2">
        <ChatSwitcher
          chats={chats}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          renaming={renaming}
          onRenameEnd={endRename}
        />
        <div className="flex shrink-0 items-center gap-0.5 text-stone-700">
          <BarButton label="New agent">
            <Plus className="size-4" strokeWidth={1.5} />
          </BarButton>
          <MoreOptionsMenu onRename={() => setRenaming(true)} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-2 text-px-13 leading-[18px] text-stone-800">
        <p className="select-text">
          The calendar you see at <Code>/</Code> is the day planner, and it&apos;s built from <strong>6 files</strong>:
        </p>
        <ol className="flex select-text list-decimal flex-col gap-1.5 pl-5">
          {CHAT_FILES.map((file) => (
            <li key={file.path}>
              <Code>{file.path}</Code>: {file.note}
            </li>
          ))}
        </ol>
        <p className="select-text">
          Together they come to about 2,000 lines. It also uses the shared <Code>cn</Code> helper in{" "}
          <Code>src/lib/utils.ts</Code>. <Code>src/app/tuesday/page.tsx</Code> is just a 9-line redirect, so I didn&apos;t
          count it.
        </p>
        <MessageMeta />

        <UserBubble>
          can you create a copy of the files in a folder title &quot;copy-project&quot; without the ipad outline? The rest
          should be included
        </UserBubble>

        <button type="button" className="-ml-0.5 flex items-center gap-1 self-start text-stone-600 hover:text-stone-900">
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
          Worked for 4 minutes
        </button>

        <p className="select-text">
          I made a copy of the calendar in a new <Code>copy-project</Code> folder, without the iPad outline. Because
          it&apos;s inside the app folder (<Code>src/app/copy-project/</Code>), it also works as its own page at{" "}
          <Code>/copy-project</Code>. I haven&apos;t opened that page, so how it looks is unchecked. The original at{" "}
          <Code>/</Code> is untouched.
        </p>
        <p className="font-semibold text-stone-900">What&apos;s in the folder:</p>
        <ul className="flex select-text list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>page.tsx</strong> replaces <Code>planner-device.tsx</Code>, which held the iPad outline. It shows
            just the screen, centred on white, at the same proportions and height the screen had inside the iPad.
          </li>
          <li>
            <strong>planner-screen.tsx</strong>, <strong>rolling-readout.tsx</strong>, <strong>planner-days.ts</strong>,{" "}
            <strong>use-planner-intro.ts</strong> and <strong>utils.ts</strong> are exact copies of the originals. The
            only change is that their imports point at each other inside the folder, so the copy doesn&apos;t depend on
            the original files.
          </li>
        </ul>
        <p className="font-semibold text-stone-900">Two things to know:</p>
        <ul className="flex select-text list-disc flex-col gap-1.5 pl-5">
          <li>
            The status-bar image (<Code>/status.png</Code>) still comes from the shared <Code>public</Code> folder rather
            than being duplicated.
          </li>
          <li>
            I didn&apos;t copy the <Code>/tuesday</Code> redirect, since it isn&apos;t part of the calendar itself.
          </li>
        </ul>
        <p className="select-text">
          If you meant a standalone folder outside the app instead of a page inside it, I can move it.
        </p>
        <p className="text-px-11 font-medium tabular-nums">
          <span className="text-green-700">+1995</span> <span className="text-red-600">−0</span>
        </p>
        <MessageMeta />

        {sent.map((text, i) => (
          <UserBubble key={i}>{text}</UserBubble>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="mx-1.5 mb-1.5 flex flex-col rounded-xl border border-stone-200 bg-white px-2.5 pb-2 pt-2.5 shadow-[0_1px_2px_rgba(17,17,16,0.04)]"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          placeholder="Describe the change..."
          aria-label="Describe the change"
          className="resize-none select-text bg-transparent text-px-13 text-stone-900 outline-none placeholder:text-stone-500"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 text-stone-600">
            <BarButton label="Select element" side="top">
              <SquareDashedMousePointer className="size-3.5" strokeWidth={1.5} />
            </BarButton>
            <BarButton label="Capture page" side="top">
              <ScanLine className="size-3.5" strokeWidth={1.5} />
            </BarButton>
          </div>
          <div className="flex items-center gap-1">
            <BarButton label="Dictate" side="top">
              <Mic className="size-3.5" strokeWidth={1.5} />
            </BarButton>
            <button
              type="submit"
              disabled={empty}
              aria-label="Send"
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors",
                empty ? "bg-stone-200/80 text-stone-400" : "bg-[#2f6bf6] text-white hover:bg-[#2159dc]",
              )}
            >
              <ArrowUp className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </form>
    </aside>
  )
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[85%] select-text self-end whitespace-pre-wrap break-words rounded-[14px] bg-stone-100 px-2.5 py-1.5 text-stone-900">
      {children}
    </p>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[3px] bg-stone-100 px-1 py-px font-mono text-[12px] text-stone-900">{children}</code>
}

/**
 * Thumbs + timestamp under an agent reply. Like the Build Agent chat, a thumb toggles on click
 * (blue outline when given, with the row slightly faded) and giving one replaces the other.
 */
function MessageMeta() {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)

  function rate(value: "up" | "down") {
    setFeedback((current) => (current === value ? null : value))
  }

  return (
    <div className={cn("-ml-1.5 flex items-center gap-0.5 transition-opacity", feedback && "opacity-70")}>
      <BarButton label="Good response" side="top" pressed={feedback === "up"} onClick={() => rate("up")}>
        <ThumbsUp
          className={cn("size-3.5", feedback === "up" ? "text-[#2f6bf6]" : "text-stone-400")}
          strokeWidth={1.75}
        />
      </BarButton>
      <BarButton label="Bad response" side="top" pressed={feedback === "down"} onClick={() => rate("down")}>
        <ThumbsDown
          className={cn("size-3.5", feedback === "down" ? "text-[#2f6bf6]" : "text-stone-400")}
          strokeWidth={1.75}
        />
      </BarButton>
      <span className="ml-1 text-px-13 text-stone-500">1 day ago</span>
    </div>
  )
}

/** Smallest gap, in px, a label keeps from the window's left/right edge. */
const TOOLTIP_EDGE_GAP = 8

/**
 * Horizontal area a label may occupy: the window, narrowed to the nearest ancestor whose
 * overflow clips (anything past its edges would be cut off).
 */
function tooltipBounds(el: HTMLElement): { left: number; right: number } {
  let left = 0
  let right = window.innerWidth
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node)
    if (overflowX !== "visible" || overflowY !== "visible") {
      const r = node.getBoundingClientRect()
      left = Math.max(left, r.left)
      right = Math.min(right, r.right)
      break
    }
  }
  return { left, right }
}

/**
 * Icon button with a hover/focus label. `side` puts the label below (default) or above the
 * button; `align="end"` right-aligns it. Either way the label is nudged to stay on screen.
 */
function BarButton({
  label,
  onClick,
  side = "bottom",
  align = "center",
  active,
  pressed,
  children,
}: {
  label: string
  onClick?: () => void
  side?: "top" | "bottom"
  align?: "center" | "end"
  /** The button's menu is open: keep it highlighted and hide the label. */
  active?: boolean
  /** Toggle button state (e.g. a thumb that's been given). */
  pressed?: boolean
  children: React.ReactNode
}) {
  /** Horizontal px nudge that keeps the label inside the window (0 = default placement). */
  const [shift, setShift] = useState(0)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  /**
   * Measure the label where it would sit unshifted and nudge it back inside its bounds: the
   * window, narrowed to the nearest ancestor that clips overflow (e.g. the chat's scrolling list).
   */
  function fitTooltip() {
    const tip = tooltipRef.current
    if (!tip) return
    const rect = tip.getBoundingClientRect()
    const left = rect.left - shift
    const right = rect.right - shift
    const bounds = tooltipBounds(tip)
    const minLeft = bounds.left + TOOLTIP_EDGE_GAP
    const maxRight = bounds.right - TOOLTIP_EDGE_GAP
    if (left < minLeft) setShift(minLeft - left)
    else if (right > maxRight) setShift(maxRight - right)
    else setShift(0)
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={fitTooltip}
      onFocus={fitTooltip}
      aria-expanded={active}
      aria-pressed={pressed}
      className={cn(
        "group relative flex size-7 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5",
        active && "bg-stone-700/5",
      )}
    >
      {children}
      <span
        ref={tooltipRef}
        role="tooltip"
        style={{ marginLeft: shift }}
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] font-normal leading-4 text-stone-800 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
          side === "bottom" ? "top-full mt-1.5 -translate-y-1" : "bottom-full mb-1.5 translate-y-1",
          align === "center" ? "left-1/2 -translate-x-1/2" : "right-0",
          active && "hidden",
        )}
      >
        {label}
      </span>
    </button>
  )
}

/** Chat header "More options": a menu with Rename (renames the open chat) and Archive (unavailable). */
function MoreOptionsMenu({ onRename }: { onRename: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <BarButton label="More options" align="end" active={open} onClick={() => setOpen((o) => !o)}>
        <Ellipsis className="size-4" strokeWidth={1.5} />
      </BarButton>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 flex w-[180px] flex-col rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onRename()
            }}
            className="flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-900 hover:bg-stone-700/5"
          >
            <SquarePen className="size-3.5 shrink-0 text-stone-600" strokeWidth={1.5} />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            className="flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-left text-px-13 text-stone-400"
          >
            <Archive className="size-3.5 shrink-0" strokeWidth={1.5} />
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------- Viewport -------------------------------- */

type Viewport = { id: string; name: string; detail: string; icon: LucideIcon }

const VIEWPORTS: Viewport[] = [
  { id: "full", name: "Full width", detail: "Fill the stage", icon: Scaling },
  { id: "mobile", name: "Mobile", detail: "390 × 844", icon: Smartphone },
  { id: "tablet", name: "Tablet", detail: "768 × 1024", icon: Tablet },
  { id: "laptop", name: "Laptop", detail: "1280 × 800", icon: Laptop },
  { id: "desktop", name: "Desktop", detail: "1440 × 900", icon: Monitor },
]

/** Viewport picker: the trigger shows the chosen viewport's icon; click opens the list. */
function ViewportSelect() {
  const [selectedId, setSelectedId] = useState("full")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const TriggerIcon = VIEWPORTS.find((v) => v.id === selectedId)?.icon ?? Scaling

  // Close on outside click or Escape (Escape is caught first so it doesn't also leave the portal).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Viewport"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-1.5 text-stone-800 hover:bg-stone-700/5",
          open && "bg-stone-700/5",
        )}
      >
        <TriggerIcon className="size-4" strokeWidth={1.5} />
        <ChevronDown
          className={cn("size-3 text-stone-500 transition-transform duration-200", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Viewport"
          className="absolute right-0 top-full z-50 mt-1.5 flex w-[220px] flex-col rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(17,17,16,0.2),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {VIEWPORTS.map(({ id, name, detail, icon: Icon }) => (
            <li key={id} role="option" aria-selected={id === selectedId}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-stone-100",
                  id === selectedId && "bg-stone-100",
                )}
              >
                <Icon className="size-4 shrink-0 text-stone-800" strokeWidth={1.5} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-px-13 font-medium leading-[18px] text-stone-900">{name}</span>
                  <span className="text-px-11 leading-4 tabular-nums text-stone-500">{detail}</span>
                </span>
                {id === selectedId && <Check className="size-4 shrink-0 text-stone-800" strokeWidth={1.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
