"use client"

import { useState } from "react"
import { FileText, Layers, MessageCircleQuestionMark, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CALENDAR_ELEMENTS } from "./calendar-elements"
import { COMPONENT_PREVIEWS } from "./component-previews"
import { FrameGlyph } from "./planner-frame"

export type RailPanel = "layers" | "components" | "help"

const PANEL_BG = "bg-[#f2f2f1]"

export function LeftSidebar({ ref }: { ref?: React.Ref<HTMLElement> }) {
  const [panel, setPanel] = useState<RailPanel | null>(null)
  const open = panel === "layers" || panel === "components"

  return (
    <aside
      ref={ref}
      className={cn(
        "absolute left-1 top-[46px] z-30 flex overflow-hidden rounded-xl border border-stone-700/10 shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)]",
        PANEL_BG,
        open && "bottom-1",
      )}
    >
      {/* Rail */}
      <nav className={cn("flex flex-col items-center gap-1 p-1", open && "border-r border-stone-700/10")}>
        {RAIL.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-cursor-id={`sidebar-${id}`}
            aria-label={label}
            aria-pressed={panel === id}
            onClick={() => setPanel((current) => (current === id ? null : id))}
            className={cn(
              "flex size-8 items-center justify-center rounded-[6px] text-stone-700 transition-colors",
              panel === id ? "bg-mi-selected text-stone-900" : "hover:bg-stone-700/5",
            )}
          >
            <Icon active={panel === id} />
          </button>
        ))}
      </nav>

      {panel === "layers" && <LayersPanel />}
      {panel === "components" && <ComponentsPanel />}
    </aside>
  )
}

/* --------------------------------- Layers --------------------------------- */

function LayersPanel() {
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
        {CALENDAR_ELEMENTS.map((el) => (
          <button
            key={el.id}
            type="button"
            className="flex h-7 w-full shrink-0 items-center gap-2 rounded-md pl-4 pr-2 text-left text-px-12 text-stone-900 hover:bg-stone-700/5"
          >
            <FrameGlyph />
            <span className="truncate">{el.name}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

/* ------------------------------- Components ------------------------------- */

function ComponentsPanel() {
  const [query, setQuery] = useState("")
  const results = COMPONENT_PREVIEWS.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex w-[280px] flex-col">
      <div className="px-2.5 pt-2.5">
        <h2 className="mb-2 text-px-11 font-semibold text-stone-900">Components</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components..."
          className="h-8 w-full rounded-md border border-stone-300 bg-white px-2 text-px-13 text-stone-900 outline-none placeholder:text-stone-500 focus:border-[#2f6bf6]"
        />
      </div>

      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-1.5 gap-y-3.5 overflow-y-auto px-2 pb-3 pt-3.5 [scrollbar-width:thin]">
        {results.map(({ name, preview }) => (
          <li key={name} className="min-w-0">
            <p className="mb-1 truncate pl-0.5 text-px-12 text-stone-800">{name}</p>
            <div
              inert
              className="relative flex h-16 items-center justify-center overflow-hidden rounded-md bg-stone-200/80"
            >
              {preview}
            </div>
          </li>
        ))}
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

/** Outline icon; slightly heavier stroke when its panel is open. */
function LayersIcon({ active }: { active: boolean }) {
  return <Layers className="size-4" strokeWidth={active ? 1.5 : 1.25} />
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 1.25 : 1}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  )
}

function HelpIcon({ active }: { active: boolean }) {
  return <MessageCircleQuestionMark className="size-4" strokeWidth={active ? 1.5 : 1.25} />
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
