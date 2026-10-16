"use client"

import { memo, useEffect, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { AgentStar } from "./planner-frame"

/** After the last agent finishes, the thumb stays this long (showing "done") before it leaves. */
const LINGER_MS = 2600
/** Fade-out before it unmounts. */
const LEAVE_MS = 200

export type AgentThumb = { id: number; working: boolean }

/**
 * Thumb at the bottom centre of the canvas while Build Agents are working: one icon per agent
 * (grey with a spinning star while it works, lime with a check once it's done) and a count.
 * Agents that finish stay in it while others are still working; once all are done it reads
 * "done" for a moment, then slides away and starts fresh next time.
 */
export const AgentsPopover = memo(function AgentsPopover({ agents }: { agents: AgentThumb[] }) {
  /** Agents in the current busy stretch, oldest first. */
  const [shown, setShown] = useState<number[]>([])
  const [leaving, setLeaving] = useState(false)
  const anyWorking = agents.some((a) => a.working)

  // Agents that start working join the thumb.
  const workingIds = agents.filter((a) => a.working).map((a) => a.id)
  const missing = workingIds.filter((id) => !shown.includes(id))
  if (missing.length > 0) {
    setShown([...shown, ...missing])
    if (leaving) setLeaving(false)
  }

  // All done: linger, fade out, then clear.
  useEffect(() => {
    if (anyWorking || shown.length === 0) return
    const leave = setTimeout(() => setLeaving(true), LINGER_MS)
    const clear = setTimeout(() => {
      setShown([])
      setLeaving(false)
    }, LINGER_MS + LEAVE_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(clear)
    }
  }, [anyWorking, shown.length])

  if (shown.length === 0) return null
  const working = shown.filter((id) => agents.find((a) => a.id === id)?.working).length
  const count = working > 0 ? working : shown.length
  const label = `${count} agent${count === 1 ? "" : "s"} ${working > 0 ? "working" : "done"}`

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3.5 shadow-[0_6px_20px_-6px_rgba(17,17,16,0.22),0_1px_3px_rgba(17,17,16,0.08)] duration-200",
        leaving ? "animate-out fade-out slide-out-to-bottom-2 fill-mode-forwards" : "animate-in fade-in slide-in-from-bottom-2",
      )}
    >
      {/* Newest first; each later icon overlaps the one before it */}
      <span className="flex items-center -space-x-1.5">
        {[...shown].reverse().map((id) => {
          const done = !agents.find((a) => a.id === id)?.working
          return (
            <span
              key={`${id}-${done ? "done" : "working"}`}
              className={cn(
                "flex size-[22px] items-center justify-center rounded-full ring-2 ring-white animate-in zoom-in-75 fade-in duration-200",
                done ? "bg-mi-lime text-stone-900" : "bg-stone-200 text-stone-500",
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <AgentStar className="size-[11px] animate-spin [animation-duration:1.6s]" />
              )}
            </span>
          )
        })}
      </span>
      <span className="whitespace-nowrap text-[13px] font-medium tabular-nums text-stone-800">{label}</span>
    </div>
  )
})
