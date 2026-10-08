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

/** A file that's new in this change: every line added. */
const newFile = (lines: string[]): DiffRow[] => lines.map((text, i) => add(i + 1, text))

const FAIRBNB_SCREEN_DIFF: DiffRow[] = [
  ctx(1, 1, `"use client"`),
  ctx(2, 2, ""),
  change(3, `import { useState } from "react"`, 3, `import { useEffect, useRef, useState } from "react"`),
  change(4, `import { AIRBNB_TRIPS } from "./airbnb-data"`, 4, `import { FAIRBNB_TRIPS, type Trip } from "./fairbnb-data"`),
  ctx(5, 5, `import { cn } from "./utils"`),
  ctx(6, 6, ""),
  change(7, "/** The Airbnb home screen, at desktop size. */", 7, "/** The Fairbnb home screen, laid out in cqw so it scales with its frame. */"),
  change(8, "export function AirbnbScreen() {", 8, "export function FairbnbScreen({ className }: { className?: string }) {"),
  ctx(9, 9, "  const [tab, setTab] = useState<\"stays\" | \"trips\">(\"stays\")"),
  add(10, "  const rootRef = useRef<HTMLDivElement>(null)"),
  add(11, ""),
  add(12, "  // Cards come in one by one once the screen is on the page."),
  add(13, "  useEffect(() => {"),
  add(14, "    rootRef.current?.setAttribute(\"data-intro\", \"on\")"),
  add(15, "  }, [])"),
  ctx(10, 16, ""),
  ctx(11, 17, "  return ("),
  change(12, `    <div className="flex h-[900px] w-[1440px] flex-col bg-white">`, 18, `    <div ref={rootRef} className={cn("@container flex size-full flex-col bg-white", className)}>`),
  change(13, `      <nav className="flex h-20 items-center justify-between px-12">`, 19, `      <nav className="flex h-[5.5cqw] items-center justify-between px-[3.3cqw]">`),
  change(14, `        <span className="text-2xl font-bold text-[#ff385c]">airbnb</span>`, 20, `        <span className="text-[1.7cqw] font-bold text-[#ff385c]">fairbnb</span>`),
  ctx(15, 21, "        <Tabs value={tab} onChange={setTab} />"),
  ctx(16, 22, "      </nav>"),
  change(17, `      <section className="grid grid-cols-4 gap-6 px-12">`, 23, `      <section className="grid grid-cols-4 gap-[1.6cqw] px-[3.3cqw]">`),
  change(18, "        {AIRBNB_TRIPS.map((trip) => (", 24, "        {FAIRBNB_TRIPS.map((trip: Trip) => ("),
  ctx(19, 25, "          <TripCard key={trip.id} trip={trip} />"),
  ctx(20, 26, "        ))}"),
  ctx(21, 27, "      </section>"),
  ctx(22, 28, "    </div>"),
  ctx(23, 29, "  )"),
  ctx(24, 30, "}"),
  ctx(25, 31, ""),
  change(26, "function TripCard({ trip }: { trip: (typeof AIRBNB_TRIPS)[number] }) {", 32, "function TripCard({ trip }: { trip: Trip }) {"),
  ctx(27, 33, "  return ("),
  change(28, `    <article className="flex flex-col gap-3">`, 34, `    <article data-anim="card" className="relative flex flex-col gap-[0.8cqw]">`),
  change(29, `      <img src={trip.image} alt="" className="aspect-square rounded-xl object-cover" />`, 35, `      <img src={trip.image} alt="" className="aspect-square rounded-[0.9cqw] object-cover" />`),
  change(30, `      <p className="text-[15px] font-semibold">{trip.title}</p>`, 36, `      <p className="text-[1.6cqw] font-semibold tracking-tight text-[#222222]">{trip.title}</p>`),
]

const HERO_SCREEN_DIFF: DiffRow[] = [
  ctx(1, 1, `"use client"`),
  ctx(2, 2, ""),
  change(3, `import { useState } from "react"`, 3, `import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"`),
  add(4, `import { flushSync } from "react-dom"`),
  ctx(4, 5, `import { cn } from "@/lib/utils"`),
  add(6, `import { screenScale } from "@/lib/screen-scale"`),
  ctx(5, 7, `import { CodebaseFrame, CANVAS_ZOOM, CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"`),
  add(8, `import { FrameSettingsPanel } from "./frame-settings-panel"`),
  add(9, `import { PortalView } from "./portal-view"`),
  ctx(6, 10, ""),
  change(7, `type Tool = "select" | "frame"`, 11, `type Tool = "select" | "frame" | "text" | "code"`),
  ctx(8, 12, ""),
  add(13, "/* ------------------------------ Camera limits ------------------------------ */"),
  add(14, "// The hero canvas is a showcase, not an infinite canvas: zoom and pan are both bounded."),
  add(15, ""),
  add(16, "const MIN_ZOOM = 0.24"),
  add(17, "const MAX_ZOOM = 0.4"),
  add(18, ""),
  add(19, "/** Wheel → zoom sensitivity for pinch / ⌘-scroll. */"),
  add(20, "const WHEEL_ZOOM_SPEED = 0.01"),
  ctx(9, 21, ""),
  ctx(10, 22, "export function HeroScreen({ className }: { className?: string }) {"),
  ctx(11, 23, `  const [tool, setTool] = useState<Tool>("select")`),
  change(12, "  const [selected, setSelected] = useState(false)", 24, "  const [codebaseSelected, setCodebaseSelected] = useState(false)"),
  add(25, "  /** Ids of the selected Fairbnb element frames. */"),
  add(26, "  const [selectedIds, setSelectedIds] = useState<string[]>([])"),
  add(27, "  const [portalOpen, setPortalOpen] = useState(true)"),
  ctx(13, 28, "  const [camera, setCamera] = useState(initialCamera)"),
  ctx(14, 29, ""),
  ctx(15, 30, "  return ("),
  change(16, `    <div className="relative h-dvh w-full overflow-hidden bg-stone-100">`, 31, `    <div ref={rootRef} data-hero-root className={cn("relative h-dvh w-full select-none overflow-hidden bg-mi-canvas", className)}>`),
  ctx(17, 32, "      <div ref={canvasRef} data-hero-canvas className=\"absolute inset-0 touch-none\">"),
  ctx(18, 33, "        <CodebaseFrame"),
  change(19, "          selected={selected}", 34, "          selected={codebaseSelected}"),
  add(35, "          onOpen={() => setPortalOpen(true)}"),
]

const FRAME_SETTINGS_PANEL_DIFF: DiffRow[] = newFile([
  `"use client"`,
  "",
  `import { memo, useState } from "react"`,
  `import { ChevronDown, ChevronRight, Ellipsis, Minus, Plus, Scan } from "lucide-react"`,
  `import { cn } from "@/lib/utils"`,
  `import { FrameGlyph } from "./planner-frame"`,
  "",
  "/* --------------------------------- Types ---------------------------------- */",
  "",
  `export type LayoutMode = "freeform" | "row" | "column" | "grid"`,
  `export type CssPosition = "static" | "relative" | "absolute"`,
  "/** Per-side lengths in canvas px. */",
  "export type Sides = { top: number; right: number; bottom: number; left: number }",
  "",
  "export const NO_SIDES: Sides = { top: 0, right: 0, bottom: 0, left: 0 }",
  "",
  `const SELECT_BLUE = "#2f6bf6"`,
  "",
  `/** 16.384 → "16.4px"; null → "auto". */`,
  "export function px(value: number | null) {",
  "  return value === null ? \"auto\" : `${Math.round(value * 10) / 10}px`",
  "}",
  "",
  "/* ------------------------------ Frame panel ------------------------------- */",
  "",
  "/** Right-side settings for a selected design frame. */",
  "export const FrameSettingsPanel = memo(function FrameSettingsPanel({",
  "  tag = \"div\",",
  "  position = \"static\",",
  "  x,",
  "  y,",
  "  width,",
  "  height,",
  "  layout = \"freeform\",",
  "  padding = NO_SIDES,",
  "  fill,",
  "  radius,",
  "  border,",
  "}: FrameSettingsProps) {",
  "  return (",
  "    <SettingsPanelShell icon={<FrameGlyph />} title={tag}>",
  "      <PositionSection position={position} x={x} y={y} />",
  "      <SizeSection width={px(width)} height={px(height)} />",
  "      <LayoutSection layout={layout} padding={padding} />",
  "      <FillSection fill={fill} />",
  "    </SettingsPanelShell>",
  "  )",
  "})",
])

/** The project's changes before this session: the screen and a few components, each with its diff. */
export const CODE_CHANGES: ChangedFile[] = [
  { path: "src/app/copy-project/fairbnb-screen.tsx", added: 123, removed: 104, diff: FAIRBNB_SCREEN_DIFF },
  { path: "src/components/hero-screen/codebase-frame.tsx", added: 23, removed: 9, diff: CODEBASE_FRAME_DIFF },
  { path: "src/components/hero-screen/frame-settings-panel.tsx", added: 388, removed: 0, isNew: true, diff: FRAME_SETTINGS_PANEL_DIFF },
  { path: "src/components/hero-screen/hero-screen.tsx", added: 702, removed: 18, diff: HERO_SCREEN_DIFF },
]

export const CODE_CHANGES_TOTAL = {
  added: CODE_CHANGES.reduce((sum, f) => sum + f.added, 0),
  removed: CODE_CHANGES.reduce((sum, f) => sum + f.removed, 0),
}

/**
 * This session's changes (`extra`) on top of the project's, one entry per file: a file changed in
 * both shows once, with both changes' line counts and the session's diff.
 */
export function allChanges(extra: ChangedFile[] = []): ChangedFile[] {
  const merged = new Map<string, ChangedFile>()
  for (const file of [...extra, ...CODE_CHANGES]) {
    const seen = merged.get(file.path)
    merged.set(
      file.path,
      seen
        ? { ...seen, added: seen.added + file.added, removed: seen.removed + file.removed, diff: seen.diff ?? file.diff }
        : file,
    )
  }
  return [...merged.values()]
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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-stone-900/30 p-6 animate-in fade-in duration-150"
      onPointerDown={onClose}
    >
      <CodeChangesPanel
        role="dialog"
        onClose={onClose}
        extra={extra}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-[72%] w-[75%] rounded-2xl shadow-[0_12px_40px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in zoom-in-95 duration-150"
      />
    </div>
  )
}

/**
 * The code changes review itself (header, file tree, split diff), without a backdrop: the popover
 * centres it over the screen; the hero's Desktop Area shows it as a window of its own. The close
 * button only shows when `onClose` is given.
 */
export function CodeChangesPanel({
  onClose,
  extra = [],
  className,
  role,
  onPointerDown,
}: {
  onClose?: () => void
  extra?: ChangedFile[]
  className?: string
  role?: "dialog"
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const files = allChanges(extra)
  const totals = totalsOf(files)
  const [selected, setSelected] = useState(() => extra[0]?.path ?? DEFAULT_FILE)
  const [query, setQuery] = useState("")
  /** Folder paths the user has collapsed (all open by default). */
  const [collapsed, setCollapsed] = useState<string[]>([])
  const selectedFile = files.find((f) => f.path === selected)

  const q = query.trim().toLowerCase()
  const tree = buildTree(q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files)

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
        role={role}
        aria-label="Code changes"
        onPointerDown={onPointerDown}
        className={cn("flex min-w-0 flex-col overflow-hidden bg-[#f3f3f1]", className)}
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
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
          >
            <X className="size-4" strokeWidth={1.25} />
          </button>
        )}
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
  // A preview: it shows as many lines as fit and doesn't scroll (long lines and files are clipped).
  return (
    <div data-diff className="grid size-full grid-cols-2 overflow-hidden font-mono text-px-11 leading-[18px]">
      <div className="min-w-0 overflow-hidden border-r border-stone-700/15">
        {file.diff.map(([left], i) => (
          <DiffLine key={i} side={left} />
        ))}
      </div>
      <div className="min-w-0 overflow-hidden">
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
