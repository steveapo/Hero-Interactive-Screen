"use client"

import {
  Asterisk,
  Check,
  ChevronDown,
  Copy,
  Crosshair,
  Frame,
  GitBranch,
  GitPullRequest,
  Globe,
  MessageCircle,
  MousePointer2,
  Play,
  Type,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { COLLABORATORS, DIFF_FILES } from "./data"

export type WorkspaceMode = "design" | "code"

const TOOLS = [
  { label: "Move", icon: MousePointer2 },
  { label: "Frame", icon: Frame },
  { label: "Text", icon: Type },
  { label: "Comment", icon: MessageCircle },
  { label: "Capture from live app", icon: Crosshair },
]

const totalAdded = DIFF_FILES.reduce((sum, f) => sum + f.added, 0)
const totalRemoved = DIFF_FILES.reduce((sum, f) => sum + f.removed, 0)

export function TopBar({
  mode,
  onModeChange,
  onOpenChanges,
  shareOpen,
  onShareToggle,
}: {
  mode: WorkspaceMode
  onModeChange: (mode: WorkspaceMode) => void
  onOpenChanges: () => void
  shareOpen: boolean
  onShareToggle: () => void
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-stone-200 bg-white px-3">
      {/* Project */}
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-mi-lime text-mi-lime-ink shadow-[inset_0_0_0_1px_rgba(22,33,10,0.12)]">
          <Asterisk className="size-4" strokeWidth={2.75} />
        </span>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-px-13 font-medium text-stone-900 hover:bg-stone-100"
        >
          Acme Store
          <ChevronDown className="size-3 text-stone-400" />
        </button>
        <span className="flex h-6 items-center gap-1 rounded-md bg-stone-100 px-2 font-mono text-px-11 text-stone-600">
          <GitBranch className="size-3" />
          design/checkout-v2
        </span>
      </div>

      {/* Tools + canvas⇄code switch */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg p-0.5">
          {TOOLS.map(({ label, icon: Icon }, i) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                i === 0 ? "bg-mi-select text-white" : "text-stone-700 hover:bg-stone-100",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </button>
          ))}
        </div>
        <span className="h-5 w-px bg-stone-200" />
        <div role="tablist" aria-label="Workspace mode" className="relative flex rounded-lg bg-stone-100 p-0.5">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-[0_1px_2px_rgba(17,17,16,0.12),0_0_0_0.5px_rgba(17,17,16,0.08)] transition-transform duration-300 ease-out",
              mode === "code" && "translate-x-full",
            )}
          />
          {(["design", "code"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={cn(
                "relative z-10 flex h-7 w-16 items-center justify-center text-px-12 font-medium capitalize transition-colors",
                mode === m ? "text-stone-900" : "text-stone-500 hover:text-stone-800",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Presence, changes, share */}
      <div className="relative flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {COLLABORATORS.map((c) => (
            <span
              key={c.name}
              title={c.name}
              className="flex size-6 items-center justify-center rounded-full text-px-10 font-semibold text-white ring-2 ring-white"
              style={{ background: c.color }}
            >
              {c.initial}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenChanges}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-px-12 font-medium text-stone-700 hover:bg-stone-100"
        >
          <GitPullRequest className="size-3.5" />
          Changes
          <span className="font-mono text-px-11 text-mi-add">+{totalAdded}</span>
          <span className="-ml-1 font-mono text-px-11 text-mi-remove">−{totalRemoved}</span>
        </button>
        <button
          type="button"
          aria-label="Preview"
          className="flex size-8 items-center justify-center rounded-md text-stone-700 hover:bg-stone-100"
        >
          <Play className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onShareToggle}
          aria-expanded={shareOpen}
          className="flex h-8 items-center rounded-lg bg-mi-lime px-3.5 text-px-12 font-semibold text-mi-lime-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_0_1px_rgba(22,33,10,0.12)] hover:bg-mi-lime-deep"
        >
          Share
        </button>

        {shareOpen && <SharePopover />}
      </div>
    </div>
  )
}

function SharePopover() {
  return (
    <div className="absolute right-0 top-11 w-80 rounded-xl border border-stone-200 bg-white p-3 shadow-[0_16px_40px_-12px_rgba(17,17,16,0.25),0_2px_6px_rgba(17,17,16,0.06)] animate-in fade-in slide-in-from-top-1 duration-200">
      <p className="text-px-13 font-semibold text-stone-900">Share live preview</p>
      <p className="mt-0.5 text-px-11 text-stone-500">
        The real app running this branch. No localhost, anyone with the link can comment.
      </p>
      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-1 pl-2">
        <Globe className="size-3.5 shrink-0 text-stone-400" />
        <span className="min-w-0 flex-1 truncate font-mono text-px-11 text-stone-700">
          acme-checkout-v2.modeinspect.app
        </span>
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded-md bg-white px-2 text-px-11 font-medium text-stone-800 shadow-[0_0_0_1px_rgba(17,17,16,0.1)]"
        >
          <Copy className="size-3" />
          Copy
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {COLLABORATORS.map((c, i) => (
          <li key={c.name} className="flex items-center gap-2 text-px-12">
            <span
              className="flex size-6 items-center justify-center rounded-full text-px-10 font-semibold text-white"
              style={{ background: c.color }}
            >
              {c.initial}
            </span>
            <span className="flex-1 text-stone-800">{c.name}</span>
            <span className="text-px-11 text-stone-500">{i === 0 ? "Can edit" : "Can comment"}</span>
          </li>
        ))}
      </ul>
      <div className="-mx-3 mt-3 border-t border-stone-100" />
      <button
        type="button"
        className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-stone-900 text-px-12 font-medium text-white hover:bg-stone-800"
      >
        <GitPullRequest className="size-3.5" />
        Open pull request
      </button>
      <p className="mt-2 flex items-center justify-center gap-1 text-px-10 text-stone-500">
        <Check className="size-3 text-mi-add" />
        typecheck · lint · design tokens passing
      </p>
    </div>
  )
}
