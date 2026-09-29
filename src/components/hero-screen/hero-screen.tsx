"use client"

import { useEffect, useState } from "react"
import { Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"
import { CodebaseFrame, CANVAS_ZOOM } from "./codebase-frame"
import { CodebaseSettingsPanel } from "./codebase-settings-panel"
import { LeftSidebar } from "./left-sidebar"

type Tool = "select" | "frame" | "text" | "code"

export function HeroScreen() {
  const [tool, setTool] = useState<Tool>("select")
  const [codebaseSelected, setCodebaseSelected] = useState(false)

  // Single-key tool shortcuts shown in the toolbar labels (V, F, T, P)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      const match = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase())
      if (match) setTool(match.id)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-mi-canvas">
      {/* Canvas: clicking empty space clears the selection */}
      <div className="absolute inset-0" onPointerDown={() => setCodebaseSelected(false)}>
        <CodebaseFrame selected={codebaseSelected} onSelect={() => setCodebaseSelected(true)} />
      </div>

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-11 items-center justify-between pl-2 pr-3 *:pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Home"
            className="flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <HomeIcon />
          </button>
          <span className="max-w-[140px] truncate pl-0.5 text-px-13 font-medium text-stone-900">
            Hero Interactive Screen
          </span>
          <button
            type="button"
            aria-label="File menu"
            className="ml-4 flex size-8 items-center justify-center rounded-md text-stone-700 hover:bg-stone-700/5"
          >
            <Ellipsis className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Undo"
            className="group relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <UndoIcon />
            <Tooltip label="Undo" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            className="group relative mr-2 flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <RedoIcon />
            <Tooltip label="Redo" />
          </button>
          <button
            type="button"
            aria-label="View code changes"
            className="group relative flex h-8 items-center gap-1.5 rounded-md px-2 text-px-11 font-medium tabular-nums hover:bg-stone-700/5"
          >
            <span className="text-green-700">+1302</span>
            <span className="text-red-600">−1</span>
            <Tooltip label="View code changes" />
          </button>
          <button
            type="button"
            aria-label="Open preview"
            className="group relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <PlayCircleIcon />
            <Tooltip label="Open preview" />
          </button>
          <button
            type="button"
            aria-label="GitHub"
            className="flex size-8 items-center justify-center rounded-md bg-stone-700/5 text-stone-800 hover:bg-stone-700/10"
          >
            <GithubIcon />
          </button>
          <button
            type="button"
            className="ml-0.5 flex h-8 items-center rounded-md bg-mi-lime px-3 text-px-13 font-medium text-stone-900 shadow-[0_1px_2px_rgba(22,33,10,0.12)] hover:bg-mi-lime-deep"
          >
            Share
          </button>
          <img
            src="/avatars/modeinspect-avatar.png"
            alt="Your profile"
            className="ml-1 size-6 shrink-0 overflow-hidden rounded-full bg-stone-200 object-cover"
          />
        </div>
      </header>

      {/* Tool bar */}
      <div className="absolute left-1/2 top-2.5 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-stone-700/10 bg-white/90 p-1 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] backdrop-blur-md">
        {TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-keyshortcuts={shortcut}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            className={cn(
              "group relative flex size-8 items-center justify-center rounded-lg transition-colors",
              tool === id ? "bg-[#2f6bf6] text-white" : "text-stone-700 hover:bg-stone-700/5",
            )}
          >
            <Icon />
            <Tooltip label={`${label} (${shortcut})`} />
          </button>
        ))}
      </div>

      <LeftSidebar />

      {codebaseSelected && <CodebaseSettingsPanel />}

      {/* Zoom */}
      <div className="absolute bottom-3 right-3 z-20 rounded-md border border-stone-700/10 bg-white/90 px-1.5 py-0.5 text-px-10 font-medium tabular-nums text-stone-700 shadow-[0_1px_2px_rgba(17,17,16,0.06)]">
        {Math.round(CANVAS_ZOOM * 100)}%
      </div>
    </div>
  )
}

/* --------------------------------- Icons ---------------------------------- */

const TOOLS: { id: Tool; label: string; shortcut: string; icon: () => React.JSX.Element }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: SelectIcon },
  { id: "frame", label: "Frame", shortcut: "F", icon: FrameIcon },
  { id: "text", label: "Text", shortcut: "T", icon: TextIcon },
  { id: "code", label: "Portal", shortcut: "P", icon: TerminalIcon },
]

/** Hover/focus label shown below a top-bar control. Parent needs `group relative`. */
function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] font-normal leading-4 text-stone-800 -translate-y-1 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2 1.5 4.5 4 7" />
      <path d="M1.5 4.5h7a3.5 3.5 0 0 1 0 7H5" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2l2.5 2.5L10 7" />
      <path d="M12.5 4.5h-7a3.5 3.5 0 0 0 0 7H9" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.19629 7.89293L6.99986 2.08936L12.8034 7.89293" />
      <path d="M2.98193 6.10742V11.911H11.0176V6.10742" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.7532 4.66913L1.829 1.1069C1.62722 1.0411 1.40557 1.09419 1.2555 1.24426C1.09984 1.39992 1.049 1.63194 1.12531 1.83843L5.16555 12.7708C5.21637 12.9083 5.34745 12.9996 5.49404 12.9996C5.64654 12.9996 5.78151 12.9009 5.82775 12.7556L7.3584 7.94503C7.44821 7.66276 7.65854 7.43484 7.93269 7.32268L12.7777 5.34062C12.9122 5.2856 13.0001 5.1547 13.0001 5.00938C13.0001 4.85447 12.9004 4.71715 12.7532 4.66913Z" />
    </svg>
  )
}

function FrameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1v12M10 1v12M1 4h12M1 10h12" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v12" />
      <path d="M4.5 13h5" />
      <path d="M1 3.5V2c0-.55.45-1 1-1h10c.55 0 1 .45 1 1v1.5" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}

function PlayCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6.5" fill="currentColor" />
      <path d="M5.6 4.4v5.2L9.6 7z" fill="white" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 0C7.16 0 0 7.3411 0 16.4047C0 23.6638 4.58 29.795 10.94 31.9687C11.74 32.1122 12.04 31.6201 12.04 31.1894C12.04 30.7998 12.02 29.508 12.02 28.1341C8 28.8928 6.96 27.1293 6.64 26.2065C6.46 25.7349 5.68 24.279 5 23.8893C4.44 23.5818 3.64 22.823 4.98 22.8025C6.24 22.782 7.14 23.9919 7.44 24.484C8.88 26.9652 11.18 26.268 12.1 25.8374C12.24 24.7711 12.66 24.0534 13.12 23.6433C9.56 23.2332 5.84 21.8183 5.84 15.5435C5.84 13.7594 6.46 12.283 7.48 11.1347C7.32 10.7246 6.76 9.04309 7.64 6.78745C7.64 6.78745 8.98 6.35682 12.04 8.46893C13.32 8.09982 14.68 7.91527 16.04 7.91527C17.4 7.91527 18.76 8.09982 20.04 8.46893C23.1 6.33632 24.44 6.78745 24.44 6.78745C25.32 9.04309 24.76 10.7246 24.6 11.1347C25.62 12.283 26.24 13.7389 26.24 15.5435C26.24 21.8388 22.5 23.2332 18.94 23.6433C19.52 24.1559 20.02 25.1402 20.02 26.6781C20.02 28.8723 20 30.6358 20 31.1894C20 31.6201 20.3 32.1327 21.1 31.9687C27.42 29.795 32 23.6433 32 16.4047C32 7.3411 24.84 0 16 0Z"
      />
    </svg>
  )
}
