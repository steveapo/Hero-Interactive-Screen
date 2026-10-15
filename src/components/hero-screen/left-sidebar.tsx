"use client"

import { memo, useState } from "react"
import { FileText, Layers, MessageCircleQuestionMark, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AIRBNB_ELEMENTS } from "./airbnb-elements"
import { COMPONENT_PREVIEWS } from "./component-previews"
import { FAIRBNB_COMPONENT_PREVIEWS } from "./fairbnb-component-previews"
import { isInsertable, type ComponentLibrary, type InsertableComponent } from "./library-components"
import { FrameGlyph } from "./planner-frame"

export type RailPanel = "layers" | "components" | "help"

const PANEL_BG = "bg-[#f2f2f1]"

/**
 * `onLibraryDragStart`: a press on an insertable component tile in the Components library; the
 * canvas takes over the drag (a ghost follows the pointer, dropping it on a frame inserts it).
 * Memoized (the canvas passes stable props), so camera frames don't re-render the library.
 */
export const LeftSidebar = memo(function LeftSidebar({
  ref,
  onLibraryDragStart,
  names,
  library = "default",
  initialPanel = null,
  className,
  style,
}: {
  ref?: React.Ref<HTMLElement>
  /** The rail panel open on mount (e.g. "layers"). Default: none. Only read on mount. */
  initialPanel?: RailPanel | null
  onLibraryDragStart?: (e: React.PointerEvent, component: InsertableComponent) => void
  /** Current frame names by element id (renamed on the canvas); falls back to each element's own name. */
  names?: Record<string, string>
  /** The design system the Components library shows (see ComponentLibrary). Default: "default". */
  library?: ComponentLibrary
  /** Extra classes / style on the sidebar (e.g. a load-in entrance). */
  className?: string
  style?: React.CSSProperties
}) {
  const [panel, setPanel] = useState<RailPanel | null>(initialPanel)
  const open = panel === "layers" || panel === "components"

  return (
    <aside
      ref={ref}
      style={style}
      className={cn(
        // Soft shadow cast to the right (onto the canvas), plus a faint hairline so it lifts off it.
        "absolute left-1 top-[46px] z-30 flex overflow-hidden rounded-xl border border-transparent shadow-[6px_4px_20px_-6px_rgba(17,17,16,0.14),2px_1px_4px_-1px_rgba(17,17,16,0.06),0_0_0_1px_rgba(17,17,16,0.05)]",
        PANEL_BG,
        open && "bottom-1",
        className,
      )}
    >
      {/* Rail */}
      <nav className={cn("flex flex-col items-center gap-0.5 p-0.5", open && "border-r border-stone-700/10")}>
        {RAIL.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-cursor-id={`sidebar-${id}`}
            aria-label={label}
            aria-pressed={panel === id}
            onClick={() => setPanel((current) => (current === id ? null : id))}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-stone-700 transition-colors",
              panel === id ? "bg-mi-selected text-stone-900" : "hover:bg-stone-700/5",
            )}
          >
            <Icon active={panel === id} />
          </button>
        ))}
      </nav>

      {panel === "layers" && <LayersPanel names={names} />}
      {panel === "components" && <ComponentsPanel onDragStart={onLibraryDragStart} library={library} />}
    </aside>
  )
})

/* --------------------------------- Layers --------------------------------- */

function LayersPanel({ names }: { names?: Record<string, string> }) {
  return (
    <div className="flex w-[280px] flex-col">
      <section className="flex h-[30%] shrink-0 flex-col px-1.5 pt-2.5">
        <div className="mb-1.5 flex items-center justify-between pl-1 pr-0.5">
          <h2 className="text-px-11 font-semibold text-stone-900">Pages</h2>
          <button
            type="button"
            aria-label="Add page"
            className="flex size-5 items-center justify-center rounded text-stone-600 hover:bg-stone-700/5"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <button
          type="button"
          className="flex h-7 w-full items-center gap-2 rounded-[6px] bg-mi-selected px-2 text-left text-px-12 text-stone-900"
        >
          <FileText className="size-3.5 text-stone-600" strokeWidth={1.25} />
          Page
        </button>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-stone-700/10 px-1.5 pt-2.5">
        <div className="mb-1.5 flex items-center justify-between pl-1 pr-0.5">
          <h2 className="text-px-11 font-semibold text-stone-900">Layers</h2>
          <Layers className="size-3.5 text-stone-500" strokeWidth={1.5} />
        </div>
        <button
          type="button"
          className="flex h-7 w-full items-center gap-2 rounded-md pl-4 pr-2 text-left text-px-12 text-stone-900 hover:bg-stone-700/5"
        >
          <CodebaseIcon />
          Codebase
        </button>
        {AIRBNB_ELEMENTS.map((el) => (
          <button
            key={el.id}
            type="button"
            className="flex h-7 w-full shrink-0 items-center gap-2 rounded-md pl-4 pr-2 text-left text-px-12 text-stone-900 hover:bg-stone-700/5"
          >
            <FrameGlyph />
            <span className="truncate">{names?.[el.id] ?? el.name}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

/* ------------------------------- Components ------------------------------- */

function ComponentsPanel({
  onDragStart,
  library,
}: {
  onDragStart?: (e: React.PointerEvent, component: InsertableComponent) => void
  library: ComponentLibrary
}) {
  const [query, setQuery] = useState("")
  const previews = library === "fairbnb" ? FAIRBNB_COMPONENT_PREVIEWS : COMPONENT_PREVIEWS
  const results = previews.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex w-[280px] flex-col">
      <div className="px-2.5 pt-2.5">
        <h2 className="mb-2 text-px-11 font-semibold text-stone-900">Components</h2>
        <input
          type="search"
          aria-label="Search components"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components..."
          className="h-8 w-full rounded-md border border-stone-300 bg-white px-2 text-px-13 text-stone-900 outline-none placeholder:text-stone-500 focus:border-[#2f6bf6]"
        />
      </div>

      <ul
        data-cursor-id="components-list"
        className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-1.5 gap-y-3.5 overflow-y-auto px-2 pb-3 pt-3.5 [scrollbar-width:thin]"
      >
        {results.map(({ name, preview }) => {
          const insertable = isInsertable(name)
          return (
            <li
              key={name}
              data-cursor-id={`library-${name}`}
              className={cn("group/tile min-w-0", insertable && onDragStart && "cursor-grab active:cursor-grabbing")}
              onPointerDown={
                insertable && onDragStart
                  ? (e) => {
                      if (e.button !== 0) return
                      e.preventDefault() // no text selection while dragging
                      onDragStart(e, name)
                    }
                  : undefined
              }
            >
              <p className="mb-1 truncate pl-0.5 text-px-12 text-stone-800">{name}</p>
              <div
                inert
                className={cn(
                  "relative flex h-16 items-center justify-center overflow-hidden rounded-md bg-stone-200/80",
                  insertable && onDragStart && "transition-shadow group-hover/tile:shadow-[0_0_0_1px_rgba(47,107,246,0.6)]",
                )}
              >
                {preview}
              </div>
            </li>
          )
        })}
        {results.length === 0 && (
          <li className="col-span-2 pt-4 text-center text-px-12 text-stone-500">No components match “{query}”</li>
        )}
      </ul>
    </div>
  )
}

/* ---------------------------------- Rail ---------------------------------- */

type RailIcon = (props: { active: boolean }) => React.JSX.Element

const RAIL: { id: RailPanel; label: string; icon: RailIcon }[] = [
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "components", label: "Components", icon: GridIcon },
  { id: "help", label: "Help", icon: HelpIcon },
]

/**
 * Rail icons share one rendered stroke weight with the toolbar icons: ~1.14px at 16px (1 unit on
 * the 14-unit custom icons, 1.7 on lucide's 24-unit grid), ~1.33px when the panel is open.
 */
const LUCIDE_STROKE = { rest: 1.7, active: 2 }
const CUSTOM_STROKE = { rest: 1, active: 7 / 6 }

function LayersIcon({ active }: { active: boolean }) {
  return <Layers className="size-4" strokeWidth={active ? LUCIDE_STROKE.active : LUCIDE_STROKE.rest} />
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? CUSTOM_STROKE.active : CUSTOM_STROKE.rest}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" />
    </svg>
  )
}

function HelpIcon({ active }: { active: boolean }) {
  return <MessageCircleQuestionMark className="size-4" strokeWidth={active ? LUCIDE_STROKE.active : LUCIDE_STROKE.rest} />
}

function CodebaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-700">
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}
