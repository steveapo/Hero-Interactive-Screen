"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Folder, Search, X } from "lucide-react"
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
  /** Deleted in this change ("Removed" in the file tree). */
  isRemoved?: boolean
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

/** Where the review opens when nothing was built this session: the file with a diff preview. */
const DEFAULT_FILE = "src/components/hero-screen/codebase-frame.tsx"

/**
 * "Code changes" view opened from the top bar's +/− counter: a filterable file tree on the left,
 * the selected file's split diff on the right, centred over a dimmed backdrop. Closes on ×, Escape
 * or a backdrop click.
 * `extra`: changes made this session (e.g. a variant the Build Agent built); the first is selected.
 */
export function CodeChangesPopover({ onClose, extra = [] }: { onClose: () => void; extra?: ChangedFile[] }) {
  const files = [...extra, ...CODE_CHANGES]
  const totals = totalsOf(files)
  const [selected, setSelected] = useState(() => extra[0]?.path ?? DEFAULT_FILE)
  const [query, setQuery] = useState("")
  /** Folder paths the user has collapsed (all open by default). */
  const [collapsed, setCollapsed] = useState<string[]>([])
  const selectedFile = files.find((f) => f.path === selected)

  const q = query.trim().toLowerCase()
  const tree = buildTree(q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  function toggleFolder(path: string) {
    setCollapsed((paths) => (paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path]))
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    return (
      <>
        {node.folders.map((folder) => {
          const open = !collapsed.includes(folder.path)
          return (
            <li key={folder.path}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleFolder(folder.path)}
                className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-px-12 text-stone-700 hover:bg-stone-700/5"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                <ChevronDown
                  className={cn("size-3.5 shrink-0 text-stone-500 transition-transform", !open && "-rotate-90")}
                  strokeWidth={1.25}
                />
                <Folder className="size-3.5 shrink-0 text-stone-600" strokeWidth={1.25} />
                <span className="truncate">{folder.name}</span>
              </button>
              {open && <ul>{renderNode(folder, depth + 1)}</ul>}
            </li>
          )
        })}
        {node.files.map((file) => {
          const name = file.path.slice(file.path.lastIndexOf("/") + 1)
          const active = file.path === selected
          return (
            <li key={file.path} data-file-path={file.path}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setSelected(file.path)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-px-11 transition-colors",
                  active ? "bg-stone-700/10" : "hover:bg-stone-700/5",
                )}
                // Lines up with the folder names above (chevron + folder icon + gaps).
                style={{ paddingLeft: 8 + depth * 12 + 20 }}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{name}</span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {file.isNew && <span className="text-stone-700">Added</span>}
                  {file.isRemoved && <span className="text-stone-700">Removed</span>}
                  <span>
                    <span className="text-green-700">+{file.added}</span>
                    <span className="text-red-600">−{file.removed}</span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </>
    )
  }

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-stone-900/30 p-6 animate-in fade-in duration-150"
      onPointerDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Code changes"
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-[72%] w-[75%] min-w-0 flex-col overflow-hidden rounded-2xl bg-[#f3f3f1] shadow-[0_12px_40px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in zoom-in-95 duration-150"
      >
      <header className="flex shrink-0 items-start justify-between gap-4 px-3.5 pb-3 pt-3">
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-medium leading-5 text-stone-900">Code changes</h2>
          <p className="flex items-center gap-2 text-px-11 tabular-nums text-stone-600">
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

      <div className="flex min-h-0 flex-1 border-t border-stone-700/10">
        {/* File tree */}
        <aside className="flex w-[400px] max-w-[40%] shrink-0 flex-col border-r border-stone-700/10">
          <label className="m-1 flex h-8 shrink-0 items-center gap-2 rounded-md border border-stone-700/15 bg-white px-2 focus-within:border-stone-700/30">
            <Search className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />
            <input
              aria-label="Filter files"
              placeholder="Filter files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              className="min-w-0 flex-1 select-text bg-transparent text-px-13 text-stone-900 outline-none placeholder:text-stone-500"
            />
          </label>
          <ul data-file-tree className="min-h-0 flex-1 overflow-y-auto px-1 pb-2 pt-1">
            {tree.folders.length === 0 && tree.files.length === 0 ? (
              <li className="px-2 py-3 text-px-12 text-stone-500">No files match “{query}”.</li>
            ) : (
              renderNode(tree, 0)
            )}
          </ul>
        </aside>

        {/* Selected file's diff */}
        <div className="min-w-0 flex-1 bg-white">
          {selectedFile ? <FileDiff key={selectedFile.path} file={selectedFile} /> : null}
        </div>
      </div>
      </div>
    </div>
  )
}

/* ------------------------------- File tree -------------------------------- */

type TreeNode = { name: string; path: string; folders: TreeNode[]; files: ChangedFile[] }

/**
 * Folders from the file paths: folders before files, each alphabetical. A folder holding nothing
 * but one subfolder is merged into it ("public/airbnb", "api/recording").
 */
function buildTree(files: ChangedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", folders: [], files: [] }
  for (const file of files) {
    const dirs = file.path.split("/").slice(0, -1)
    let node = root
    for (const dir of dirs) {
      const path = node.path ? `${node.path}/${dir}` : dir
      let child = node.folders.find((f) => f.path === path)
      if (!child) {
        child = { name: dir, path, folders: [], files: [] }
        node.folders.push(child)
      }
      node = child
    }
    node.files.push(file)
  }
  return tidy(root)
}

function tidy(node: TreeNode): TreeNode {
  const folders = node.folders.map((folder) => {
    let merged = folder
    while (merged.files.length === 0 && merged.folders.length === 1) {
      const only = merged.folders[0]
      merged = { ...only, name: `${merged.name}/${only.name}` }
    }
    return tidy(merged)
  })
  const byName = (a: string, b: string) => a.localeCompare(b)
  return {
    ...node,
    folders: folders.sort((a, b) => byName(a.name, b.name)),
    files: [...node.files].sort((a, b) => byName(a.path, b.path)),
  }
}

/* --------------------------------- Diff ----------------------------------- */

function FileDiff({ file }: { file: ChangedFile }) {
  if (!file.diff) {
    return <p className="px-4 py-3 text-px-12 text-stone-500">No preview available for this file.</p>
  }
  return (
    <div data-diff className="grid size-full grid-cols-2 overflow-y-auto font-mono text-px-11 leading-[18px]">
      <div className="min-w-0 overflow-x-auto border-r border-stone-700/15">
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
  if (!side) return <div className="h-[18px] bg-stone-50" aria-hidden="true" />
  return (
    <div
      className={cn(
        "flex h-[18px] w-max min-w-full",
        side.kind === "add" && "bg-green-300/70",
        side.kind === "del" && "bg-red-100",
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
      <span className="whitespace-pre pl-1 pr-3 text-stone-800">{side.text}</span>
    </div>
  )
}
