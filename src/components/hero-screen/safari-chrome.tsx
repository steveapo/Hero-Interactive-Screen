import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight, Copy, Lock, PanelLeft, Plus, RotateCw, Share } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A mock Safari window (macOS, light): traffic lights, sidebar and back / forward buttons, the
 * address field in the middle, share / new tab / tabs on the right, and the page below. Purely
 * decorative chrome; the page (`children`) fills the rest of the window.
 */
export function SafariChrome({
  url,
  children,
  className,
}: {
  /** Shown in the address field (no scheme). */
  url: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white", className)}>
      <div
        aria-hidden="true"
        className="grid h-11 shrink-0 select-none grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 border-b border-stone-200 bg-[#f6f5f4] px-3.5"
      >
        {/* Left: traffic lights, sidebar, back / forward */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full border border-black/10 bg-[#ff5f57]" />
            <span className="size-3 rounded-full border border-black/10 bg-[#febc2e]" />
            <span className="size-3 rounded-full border border-black/10 bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-1 text-stone-500">
            <PanelLeft className="size-4" strokeWidth={1.6} />
            <ChevronLeft className="ml-2 size-[18px]" strokeWidth={1.8} />
            <ChevronRight className="size-[18px] text-stone-300" strokeWidth={1.8} />
          </div>
        </div>

        {/* Address field */}
        <div className="flex h-7 w-[min(440px,40vw)] min-w-0 items-center justify-center gap-1.5 rounded-md bg-stone-200/70 px-2.5 text-px-13 text-stone-700">
          <Lock className="size-3 shrink-0 text-stone-500" strokeWidth={2} />
          <span className="truncate">{url}</span>
          <RotateCw className="ml-auto size-3 shrink-0 text-stone-500" strokeWidth={2} />
        </div>

        {/* Right: share, new tab, tabs */}
        <div className="flex items-center justify-end gap-4 text-stone-500">
          <Share className="size-4" strokeWidth={1.6} />
          <Plus className="size-[18px]" strokeWidth={1.6} />
          <Copy className="size-4" strokeWidth={1.6} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
