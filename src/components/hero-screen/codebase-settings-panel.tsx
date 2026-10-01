"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Laptop, Link, Monitor, Scaling, Smartphone, Tablet, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"

const PREVIEW_PATH = "/"

/** Right-side settings for the selected Codebase frame. */
export function CodebaseSettingsPanel() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timeout)
  }, [copied])

  function copyPreviewLink() {
    navigator.clipboard?.writeText(PREVIEW_PATH).then(() => setCopied(true), () => {})
  }

  return (
    <aside className="absolute right-1.5 top-[46px] z-30 flex w-[326px] flex-col rounded-xl border border-stone-700/10 bg-[#f2f2f1] p-2.5 pb-3 shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)] animate-in fade-in slide-in-from-right-1 duration-150">
      <h2 className="flex items-center gap-2 pt-1 text-[13px] font-semibold leading-4 text-stone-900">
        <CodebaseIcon />
        Codebase
      </h2>

      <button
        type="button"
        className="mt-2.5 flex h-8 w-full items-center justify-center rounded-md border border-[#c6dfc9] bg-[#e5efe6] text-[13px] font-medium text-[#1e7b36] transition-colors hover:bg-[#dbe9dc]"
      >
        Open Build Mode
      </button>

      <Field label="Codebase">
        <div className="flex h-7 items-center gap-1.5 rounded-md bg-stone-200/70 px-2 text-[13px] text-stone-900">
          <CodebaseIcon />
          Draft
        </div>
      </Field>

      <Field label="Preview link">
        <div className="flex h-7 items-center gap-1.5 rounded-md bg-stone-200/70 pl-2 pr-1 text-[13px] text-stone-900">
          <Link className="size-3 shrink-0 text-stone-600" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate">{PREVIEW_PATH}</span>
          <button
            type="button"
            onClick={copyPreviewLink}
            className="h-5 rounded px-1.5 text-[11px] text-stone-700 hover:bg-stone-700/5"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Field>

      <Field label="Preview Resolution" className="mt-3.5">
        <ResolutionSelect />
      </Field>
    </aside>
  )
}

/* --------------------------- Preview resolution --------------------------- */

type Resolution = { id: string; name: string; width: number; height: number; icon: LucideIcon }

const RESOLUTIONS: Resolution[] = [
  { id: "mobile", name: "Mobile", width: 390, height: 844, icon: Smartphone },
  { id: "tablet", name: "Tablet", width: 768, height: 1024, icon: Tablet },
  { id: "ipad-pro", name: "iPad Pro 12.9″", width: CODEBASE_WIDTH, height: CODEBASE_HEIGHT, icon: Tablet },
  { id: "laptop", name: "Laptop", width: 1280, height: 800, icon: Laptop },
  { id: "desktop", name: "Desktop", width: 1440, height: 900, icon: Monitor },
]

function ResolutionSelect() {
  const [open, setOpen] = useState(false)
  // The Codebase frame previews the iPad Calendar at iPad Pro resolution; null = "Custom".
  const [selectedId, setSelectedId] = useState<string | null>("ipad-pro")
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = RESOLUTIONS.find((r) => r.id === selectedId)
  const TriggerIcon = selected?.icon ?? Scaling

  // Close on outside click and Escape.
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center gap-2 rounded-md bg-stone-200/70 pl-3 pr-2 text-left text-[13px] text-stone-900 hover:bg-stone-200"
      >
        <TriggerIcon className="size-3.5 shrink-0 text-stone-700" strokeWidth={1.5} />
        <span className="flex-1">{selected?.name ?? "Custom"}</span>
        <ChevronDown
          className={cn("size-3.5 text-stone-600 transition-transform duration-200", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      <ul
        role="listbox"
        aria-label="Preview resolution"
        className={cn(
          "absolute inset-x-0 top-full z-50 mt-1 origin-top rounded-lg border border-stone-700/10 bg-white p-1 shadow-[0_12px_32px_-12px_rgba(17,17,16,0.25),0_2px_6px_rgba(17,17,16,0.06)] transition-[opacity,transform] duration-150 ease-out",
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0",
        )}
      >
        {RESOLUTIONS.map(({ id, name, width, height, icon: Icon }) => (
          <li key={id} role="option" aria-selected={id === selectedId}>
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                setSelectedId(id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-1 text-left transition-colors hover:bg-stone-100",
                id === selectedId && "bg-stone-100",
              )}
            >
              <Icon className="size-3.5 shrink-0 text-stone-800" strokeWidth={1.5} />
              <span className="flex flex-col">
                <span className="text-[13px] font-medium leading-4 text-stone-900">{name}</span>
                <span className="text-[11px] leading-4 tabular-nums text-stone-500">
                  {width} × {height}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label,
  className = "mt-2.5",
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-medium leading-4 text-stone-700">{label}</p>
      {children}
    </div>
  )
}

function CodebaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}
