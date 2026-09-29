"use client"

import { useState } from "react"
import { AppWindow, Component, Frame, RefreshCw, Search, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { DESIGN_COMPONENTS, type CanvasFrame, type FrameId } from "./data"

const FRAME_ICON = { portal: AppWindow, desktop: Frame, mobile: Smartphone }

const CHILD_LAYERS = ["Card", "LineItems", "PromoField", "Button"]

export function LeftPanel({
  frames,
  selectedId,
  onSelect,
  className,
}: {
  frames: CanvasFrame[]
  selectedId: FrameId | null
  onSelect: (id: FrameId) => void
  className?: string
}) {
  const [tab, setTab] = useState<"layers" | "components">("layers")

  return (
    <aside
      className={cn(
        "absolute bottom-2 left-2 top-14 z-30 flex w-60 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_8px_24px_-12px_rgba(17,17,16,0.18)]",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-stone-100 px-2 py-2">
        {(["layers", "components"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "h-7 rounded-md px-2.5 text-px-12 font-medium capitalize transition-colors",
              tab === t ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:text-stone-800",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "layers" ? (
        <div key="layers" className="flex-1 overflow-hidden px-2 py-2 animate-in fade-in duration-200">
          <p className="px-2 pb-1 text-px-11 font-medium text-stone-500">Pages</p>
          <div className="mb-3 flex h-7 items-center rounded-md bg-stone-100 px-2 text-px-12 font-medium text-stone-900">
            Checkout
          </div>
          <p className="px-2 pb-1 text-px-11 font-medium text-stone-500">Layers</p>
          <ul className="flex flex-col">
            {frames.map((frame) => {
              const Icon = FRAME_ICON[frame.kind]
              const selected = frame.id === selectedId
              return (
                <li key={frame.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(frame.id)}
                    className={cn(
                      "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-px-12",
                      selected ? "bg-mi-select/10 text-stone-900" : "text-stone-700 hover:bg-stone-50",
                    )}
                  >
                    <Icon className={cn("size-3.5", selected ? "text-mi-select" : "text-stone-400")} />
                    <span className="flex-1 truncate">{frame.name}</span>
                    {frame.kind === "portal" && (
                      <span className="rounded bg-mi-lime/60 px-1 text-px-10 font-semibold text-mi-lime-ink">
                        LIVE
                      </span>
                    )}
                  </button>
                  {selected && frame.kind !== "portal" && (
                    <ul className="flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
                      {CHILD_LAYERS.map((layer) => (
                        <li
                          key={layer}
                          className="flex h-6 items-center gap-2 pl-7 pr-2 text-px-12 text-mi-token"
                        >
                          <Component className="size-3" />
                          {layer}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div key="components" className="flex-1 overflow-hidden px-2 py-2 animate-in fade-in duration-200">
          <div className="mb-2 flex h-7 items-center gap-1.5 rounded-md bg-stone-100 px-2 text-px-12 text-stone-400">
            <Search className="size-3.5" />
            Search components
          </div>
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="font-mono text-px-11 text-stone-500">@/components/ui</span>
            <span className="flex items-center gap-1 text-px-10 text-mi-add">
              <RefreshCw className="size-3" />
              Synced
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-1.5">
            {DESIGN_COMPONENTS.map((name) => (
              <li
                key={name}
                className="flex h-14 flex-col justify-between rounded-lg border border-stone-200 bg-stone-50 p-2"
              >
                <Component className="size-3.5 text-mi-token" />
                <span className="text-px-11 font-medium text-stone-800">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 text-px-11 text-stone-500">
        <span className="size-1.5 rounded-full bg-mi-add" />
        Codebase connected · main ← design/checkout-v2
      </div>
    </aside>
  )
}
