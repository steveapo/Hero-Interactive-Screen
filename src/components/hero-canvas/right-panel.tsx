"use client"

import { useState } from "react"
import {
  ArrowRight,
  ChevronDown,
  CodeXml,
  Columns3,
  Component,
  FileCode,
  GitPullRequest,
  Hash,
  Rows3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DIFF_FILES, DIFF_LINES, type CanvasFrame } from "./data"
import type { WorkspaceMode } from "./top-bar"

const panelClass =
  "absolute bottom-2 right-2 top-14 z-30 flex w-[272px] flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_8px_24px_-12px_rgba(17,17,16,0.18)]"

export function RightPanel({
  mode,
  frame,
  onModeChange,
  codeTab,
  onCodeTabChange,
}: {
  mode: WorkspaceMode
  frame: CanvasFrame | null
  onModeChange: (mode: WorkspaceMode) => void
  codeTab: CodeTab
  onCodeTabChange: (tab: CodeTab) => void
}) {
  if (mode === "code") {
    return <CodePanel frame={frame} tab={codeTab} onTabChange={onCodeTabChange} onBack={() => onModeChange("design")} />
  }
  return <Inspector frame={frame} onOpenCode={() => onModeChange("code")} />
}

/* ------------------------------- Design mode ------------------------------ */

function Inspector({ frame, onOpenCode }: { frame: CanvasFrame | null; onOpenCode: () => void }) {
  const [direction, setDirection] = useState<"vertical" | "horizontal">("vertical")
  const [showPromo, setShowPromo] = useState(true)

  if (!frame) {
    return (
      <aside className={cn(panelClass, "items-center justify-center text-px-12 text-stone-400")}>
        Select a frame to inspect
      </aside>
    )
  }

  return (
    <aside key={`design-${frame.id}`} className={cn(panelClass, "animate-in fade-in slide-in-from-right-2 duration-300")}>
      {/* Component header */}
      <div className="border-b border-stone-100 px-3 py-3">
        <div className="flex items-center gap-2">
          <Component className="size-4 text-mi-token" />
          <span className="flex-1 truncate text-px-13 font-semibold text-stone-900">{frame.component}</span>
          <span className="rounded bg-mi-token/10 px-1.5 py-0.5 text-px-10 font-medium text-mi-token">Instance</span>
        </div>
        <button
          type="button"
          onClick={onOpenCode}
          className="group mt-2 flex w-full items-center gap-1.5 rounded-md bg-stone-50 px-2 py-1.5 text-left font-mono text-px-11 text-stone-600 hover:bg-stone-100"
        >
          <FileCode className="size-3.5 shrink-0 text-stone-400" />
          <span className="flex-1 truncate">{frame.source}</span>
          <ArrowRight className="size-3 text-stone-400 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <Section title="Frame">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={frame.x} />
          <NumberField label="Y" value={frame.y} />
          <NumberField label="W" value={frame.w} />
          <NumberField label="H" value={frame.h} />
        </div>
      </Section>

      <Section title="Props">
        <PropRow label="variant">
          <SelectField value="solid" />
        </PropRow>
        <PropRow label="size">
          <SelectField value="lg" />
        </PropRow>
        <PropRow label="showPromo">
          <button
            type="button"
            role="switch"
            aria-checked={showPromo}
            onClick={() => setShowPromo((v) => !v)}
            className={cn(
              "relative h-4.5 w-7.5 rounded-full transition-colors",
              showPromo ? "bg-mi-select" : "bg-stone-300",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
                showPromo && "translate-x-3",
              )}
            />
          </button>
        </PropRow>
      </Section>

      <Section title="Auto layout">
        <div className="flex gap-1.5">
          <div className="flex rounded-md bg-stone-100 p-0.5">
            {(
              [
                ["vertical", Rows3],
                ["horizontal", Columns3],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={value}
                aria-pressed={direction === value}
                onClick={() => setDirection(value)}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded-[5px] transition-colors",
                  direction === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <TokenField token="space-4" value="16" />
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <TokenField token="space-6" value="24" label="Pad" />
          <TokenField token="radius-lg" value="10" label="Rad" />
        </div>
      </Section>

      <Section title="Fill">
        <div className="flex h-7 items-center gap-2 rounded-md bg-stone-100 px-2 text-px-11">
          <span className="size-3.5 rounded-sm border border-stone-300 bg-white" />
          <TokenName token="surface/raised" />
          <span className="ml-auto text-stone-400">100%</span>
        </div>
      </Section>

      <Section title="Typography" last>
        <div className="flex h-7 items-center gap-2 rounded-md bg-stone-100 px-2 text-px-11">
          <span className="font-semibold text-stone-700">Aa</span>
          <TokenName token="text/body-sm" />
          <span className="ml-auto text-stone-400">14 / 20</span>
        </div>
      </Section>
    </aside>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("px-3 py-2.5", !last && "border-b border-stone-100")}>
      <p className="mb-2 text-px-11 font-semibold text-stone-800">{title}</p>
      {children}
    </div>
  )
}

function NumberField({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md bg-stone-100 px-2 text-px-11">
      <span className="text-stone-400">{label}</span>
      <span className="tabular-nums text-stone-800">{Math.round(value)}</span>
    </div>
  )
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between text-px-11">
      <span className="font-mono text-stone-500">{label}</span>
      {children}
    </div>
  )
}

function SelectField({ value }: { value: string }) {
  return (
    <span className="flex h-6 w-24 items-center justify-between rounded-md bg-stone-100 px-2 text-stone-800">
      {value}
      <ChevronDown className="size-3 text-stone-400" />
    </span>
  )
}

function TokenName({ token }: { token: string }) {
  return (
    <span className="flex items-center gap-1 rounded-[4px] border border-mi-token/20 bg-white px-1 py-px font-mono text-px-10 text-mi-token">
      <Hash className="size-2.5" />
      {token}
    </span>
  )
}

function TokenField({ token, value, label }: { token: string; value: string; label?: string }) {
  return (
    <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-stone-100 px-2 text-px-11">
      {label && <span className="text-stone-400">{label}</span>}
      <TokenName token={token} />
      <span className="ml-auto tabular-nums text-stone-400">{value}</span>
    </div>
  )
}

/* -------------------------------- Code mode ------------------------------- */

export type CodeTab = "source" | "changes"

function CodePanel({
  frame,
  tab,
  onTabChange,
  onBack,
}: {
  frame: CanvasFrame | null
  tab: CodeTab
  onTabChange: (tab: CodeTab) => void
  onBack: () => void
}) {
  const lines = tab === "source" ? DIFF_LINES.filter((l) => l.kind !== "remove") : DIFF_LINES

  return (
    <aside className={cn(panelClass, "w-[400px] bg-stone-950 border-stone-800 animate-in fade-in slide-in-from-right-3 duration-300")}>
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-2">
        {(["source", "changes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-px-12 font-medium capitalize transition-colors",
              tab === t ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200",
            )}
          >
            {t === "source" ? <CodeXml className="size-3.5" /> : <GitPullRequest className="size-3.5" />}
            {t}
            {t === "changes" && (
              <span className="rounded bg-white/10 px-1 text-px-10 text-stone-300">{DIFF_FILES.length}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={onBack}
          className="ml-auto h-7 rounded-md px-2 text-px-11 text-stone-400 hover:bg-white/5 hover:text-stone-200"
        >
          Back to canvas
        </button>
      </div>

      {tab === "changes" && (
        <ul className="border-b border-white/10 px-2 py-1.5">
          {DIFF_FILES.map((file, i) => (
            <li
              key={file.path}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 font-mono text-px-11",
                i === 0 ? "bg-white/5 text-stone-100" : "text-stone-400",
              )}
            >
              <FileCode className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{file.path}</span>
              <span className="text-green-400">+{file.added}</span>
              <span className="text-red-400">−{file.removed}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="px-3 pt-2 font-mono text-px-10 text-stone-500">{frame?.source ?? DIFF_FILES[0].path}</div>
      <pre key={tab} className="flex-1 overflow-hidden py-2 font-mono text-px-11 leading-5 animate-in fade-in duration-200">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 px-3",
              tab === "changes" && line.kind === "add" && "bg-green-500/10 text-green-300",
              tab === "changes" && line.kind === "remove" && "bg-red-500/10 text-red-300",
              (tab === "source" || line.kind === "context") && "text-stone-300",
            )}
          >
            <span className="w-4 shrink-0 select-none text-right text-stone-600">{i + 1}</span>
            <span className="w-2 shrink-0 select-none text-stone-500">
              {tab === "changes" && line.kind === "add" ? "+" : tab === "changes" && line.kind === "remove" ? "−" : ""}
            </span>
            <code className="whitespace-pre">{line.text}</code>
          </div>
        ))}
      </pre>

      <div className="flex items-center gap-2 border-t border-white/10 p-2">
        <span className="flex-1 pl-1 text-px-10 text-stone-500">Scoped diff · design system enforced</span>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg bg-mi-lime px-3 text-px-12 font-semibold text-mi-lime-ink hover:bg-mi-lime-deep"
        >
          <GitPullRequest className="size-3.5" />
          Open PR
        </button>
      </div>
    </aside>
  )
}
