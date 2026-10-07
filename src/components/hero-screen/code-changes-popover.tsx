"use client"

import { useEffect, useState } from "react"
import { ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

/* ------------------------------- Mock data -------------------------------- */

type LineKind = "context" | "add" | "del"
/** One side of a split-diff row; `null` is the empty filler opposite an added/removed line. */
export type DiffSide = { n: number; text: string; kind: LineKind } | null
export type DiffRow = [left: DiffSide, right: DiffSide]

export type ChangedFile = {
  path: string
  added: number
  removed: number
  isNew?: boolean
  /** Split-diff rows shown when the file is expanded. */
  diff?: DiffRow[]
}

const ctx = (l: number, r: number, text: string): DiffRow => [
  { n: l, text, kind: "context" },
  { n: r, text, kind: "context" },
]
const add = (r: number, text: string): DiffRow => [null, { n: r, text, kind: "add" }]
const change = (l: number, lText: string, r: number, rText: string): DiffRow => [
  { n: l, text: lText, kind: "del" },
  { n: r, text: rText, kind: "add" },
]

const CODEBASE_FRAME_DIFF: DiffRow[] = [
  ctx(1, 1, `"use client"`),
  ctx(2, 2, ""),
  ctx(3, 3, `import { Play, ScanLine, SquareDashedMousePointer } from "lucide-react"`),
  add(4, `import { FairbnbScreen } from "@/app/copy-project/fairbnb-screen"`),
  ctx(4, 5, ""),
  ctx(5, 6, `/** The canvas opens at this zoom; the user can then zoom between the hero's min/max. */`),
  change(6, "export const CANVAS_ZOOM = 0.54", 7, "export const CANVAS_ZOOM = 0.3"),
  change(7, "", 8, ""),
  change(8, "const SCREEN_WIDTH = 1440", 9, "/**"),
  change(
    9,
    "const SCREEN_HEIGHT = 900",
    10,
    " * Canvas-unit size of the Codebase frame: the desktop preview resolution (1440\u00d7900).",
  ),
  add(11, " * Its centre is the canvas origin at load."),
  add(12, " */"),
  add(13, "export const CODEBASE_WIDTH = 1440"),
  add(14, "export const CODEBASE_HEIGHT = 900"),
  ctx(10, 15, ""),
  ctx(11, 16, "/** Focus colour for the Codebase frame: label, icon, border and size tag. */"),
  ctx(12, 17, `const CODEBASE_GREEN = "#1fc15a"`),
  ctx(13, 18, `const LABEL_GREY = "#78716c"`),
  ctx(14, 19, ""),
  ctx(15, 20, "export function CodebaseFrame({"),
  ctx(16, 21, "  selected,"),
  ctx(17, 22, "  onSelect,"),
  add(23, "  onMoveStart,"),
  ctx(18, 24, "  zoom,"),
]

export const CODE_CHANGES: ChangedFile[] = [
  { path: "package.json", added: 1, removed: 0 },
  { path: "public/status.png", added: 1, removed: 0, isNew: true },
  { path: "src/app/copy-project/fairbnb-screen.tsx", added: 123, removed: 104 },
  { path: "src/components/hero-screen/fairbnb-elements.tsx", added: 271, removed: 0, isNew: true },
  { path: "src/components/hero-screen/build-agent-composer.tsx", added: 79, removed: 0, isNew: true },
  { path: "src/components/hero-screen/canvas-elements.tsx", added: 209, removed: 0, isNew: true },
  { path: "src/components/hero-screen/codebase-frame.tsx", added: 23, removed: 9, diff: CODEBASE_FRAME_DIFF },
  { path: "src/components/hero-screen/codebase-settings-panel.tsx", added: 122, removed: 4 },
  { path: "src/components/hero-screen/drag.tsx", added: 86, removed: 0, isNew: true },
  { path: "src/components/hero-screen/frame-settings-panel.tsx", added: 388, removed: 0, isNew: true },
  { path: "src/components/hero-screen/hero-screen.tsx", added: 702, removed: 18 },
  { path: "src/components/hero-screen/left-sidebar.tsx", added: 46, removed: 0 },
  { path: "src/components/hero-screen/planner-frame.tsx", added: 241, removed: 6 },
  { path: "src/components/hero-screen/text-settings-panel.tsx", added: 196, removed: 0, isNew: true },
]

export const CODE_CHANGES_TOTAL = {
  added: CODE_CHANGES.reduce((sum, f) => sum + f.added, 0),
  removed: CODE_CHANGES.reduce((sum, f) => sum + f.removed, 0),
}

/** Totals over a list of changed files. */
export function totalsOf(files: ChangedFile[]) {
  return {
    added: files.reduce((sum, f) => sum + f.added, 0),
    removed: files.reduce((sum, f) => sum + f.removed, 0),
  }
}

/* -------------------------------- Popover --------------------------------- */

/**
 * "Code changes" panel opened from the top bar's +/− counter. Closes on ×, Escape or backdrop click.
 * `extra`: changes made this session (e.g. a variant the Build Agent built), listed first and open.
 */
export function CodeChangesPopover({ onClose, extra = [] }: { onClose: () => void; extra?: ChangedFile[] }) {
  const files = [...extra, ...CODE_CHANGES]
  const totals = totalsOf(files)
  const [expanded, setExpanded] = useState<string[]>(() => [
    ...extra.map((f) => f.path),
    "src/components/hero-screen/codebase-frame.tsx",
  ])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function toggle(path: string) {
    setExpanded((paths) => (paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path]))
  }

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/10 animate-in fade-in duration-150" onPointerDown={onClose}>
      <div
        role="dialog"
        aria-label="Code changes"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute inset-x-16 bottom-14 top-[52px] flex flex-col overflow-hidden rounded-2xl bg-[#f3f3f1] shadow-[0_12px_40px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in zoom-in-95 duration-150"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-700/5 px-3 pb-3 pt-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-[15px] font-medium leading-5 text-stone-900">Code changes</h2>
            <p className="flex items-center gap-1.5 text-px-12 tabular-nums text-stone-500">
              {files.length} files changed
              <span className="text-green-700">+{totals.added}</span>
              <span className="text-red-600">−{totals.removed}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <X className="size-4" strokeWidth={1.25} />
          </button>
        </header>

        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
          {files.map((file) => {
            const open = expanded.includes(file.path)
            return (
              <li key={file.path} data-file-path={file.path} className="shrink-0 overflow-hidden rounded-lg bg-white">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(file.path)}
                  className="flex min-h-[26px] w-full items-center gap-2 px-2.5 py-1.5 text-left text-px-12 hover:bg-stone-700/[0.02]"
                >
                  <ChevronRight
                    className={cn("size-3 shrink-0 text-stone-500 transition-transform", open && "rotate-90")}
                    strokeWidth={1.5}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{file.path}</span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                    {file.isNew && <span className="text-stone-700">Added</span>}
                    <span>
                      <span className="text-green-700">+{file.added}</span>
                      <span className="text-red-600">−{file.removed}</span>
                    </span>
                  </span>
                </button>
                {open && <FileDiff file={file} />}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function FileDiff({ file }: { file: ChangedFile }) {
  if (!file.diff) {
    return (
      <p className="border-t border-stone-700/5 px-8 py-3 text-px-12 text-stone-500">No preview available for this file.</p>
    )
  }
  return (
    <div className="grid grid-cols-2 border-t border-stone-700/5 font-mono text-px-10 leading-[13px]">
      <div className="min-w-0 overflow-x-auto border-r border-stone-700/10">
        {file.diff.map(([left], i) => (
          <DiffLine key={i} side={left} />
        ))}
      </div>
      <div className="min-w-0 overflow-x-auto">
        {file.diff.map(([, right], i) => (
          <DiffLine key={i} side={right} />
        ))}
      </div>
    </div>
  )
}

function DiffLine({ side }: { side: DiffSide }) {
  if (!side) return <div className="h-[13px] bg-stone-100" aria-hidden="true" />
  return (
    <div
      className={cn(
        "flex h-[13px] w-max min-w-full",
        side.kind === "add" && "bg-green-200/70",
        side.kind === "del" && "bg-red-200/70",
      )}
    >
      <span
        className={cn(
          "w-9 shrink-0 select-none border-l-2 border-transparent pr-2 text-right text-stone-500",
          side.kind === "add" && "border-green-600 text-green-800",
          side.kind === "del" && "border-red-600 text-red-700",
        )}
      >
        {side.n}
      </span>
      <span className="whitespace-pre pr-3 text-stone-800">{side.text}</span>
    </div>
  )
}
