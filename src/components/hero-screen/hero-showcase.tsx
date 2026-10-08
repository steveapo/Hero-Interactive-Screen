"use client"

import { useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CodeChangesPanel } from "./code-changes-popover"
import { trackDrag } from "./drag"
import { HeroScreen } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

type WindowId = "main" | "secondary"

/** A window on the Desktop Area: rounded, with a shadow; positioned by its `placement` classes. */
const DESKTOP_WINDOW =
  "absolute flex flex-col overflow-hidden rounded-xl border border-black/10 shadow-[0_24px_60px_-20px_rgba(17,17,16,0.35),0_2px_6px_rgba(17,17,16,0.08)]"

/**
 * The homepage hero's showcase: a "Desktop Area" holding two windows.
 * - Main: the canvas (the interactive screen). Frames can be selected and moved, but the Portal
 *   never opens from it (no double-click into the Codebase frame, no "Open Build Mode").
 * - Secondary: the code diff, open as a window of its own.
 * Pressing anywhere in a window focuses it and brings it to the front (the other one goes behind,
 * its traffic lights turning grey); dragging a window's title bar moves it around the desktop.
 */
export function HeroShowcase({ className }: { className?: string }) {
  /** Front to back: the first is the focused window. */
  const [stack, setStack] = useState<WindowId[]>(["secondary", "main"])
  const focus = (id: WindowId) => setStack((s) => (s[0] === id ? s : [id, ...s.filter((w) => w !== id)]))

  return (
    <div
      data-desktop-area
      className={cn(
        "relative flex min-h-0 w-full flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#e4e9d4_0%,#d6d3cd_55%,#c9c5bf_100%)]",
        className,
      )}
    >
      <DesktopWindow
        title="ModeInspect Canvas"
        placement="left-[3%] top-[4%] h-[88%] w-[70%]"
        active={stack[0] === "main"}
        z={stack.length - stack.indexOf("main")}
        onFocus={() => focus("main")}
      >
        <div className="flex min-h-0 flex-1 flex-col bg-mi-canvas">
          <HeroScreen className="h-auto min-h-0 flex-1" start="built" githubSyncOpen portalEnabled={false} toolsEnabled={false} />
        </div>
      </DesktopWindow>

      <DesktopWindow
        title="Code Changes"
        placement="bottom-[6%] right-[3%] h-[58%] w-[44%]"
        active={stack[0] === "secondary"}
        z={stack.length - stack.indexOf("secondary")}
        onFocus={() => focus("secondary")}
      >
        <CodeChangesPanel className="min-h-0 flex-1" />
      </DesktopWindow>
    </div>
  )
}

/**
 * One window: compact Safari chrome with a centred title. Any press inside focuses it (captured,
 * so it works even where the content stops the press); pressing the title bar also drags it, kept
 * entirely within the Desktop Area's borders.
 */
function DesktopWindow({
  title,
  placement,
  active,
  z,
  onFocus,
  children,
}: {
  title: string
  /** Initial position and size within the Desktop Area (Tailwind classes). */
  placement: string
  active: boolean
  /** Stacking order: higher is in front. */
  z: number
  onFocus: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  /** How far the window has been dragged from its placement, in layout px. */
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  function startMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    const desktop = el?.parentElement
    if (e.button !== 0 || !el || !desktop) return
    e.preventDefault()
    const from = offset
    // offsetLeft / offsetTop ignore the transform: the placement before any drag. The whole
    // window stays within the Desktop Area's borders.
    const minX = -el.offsetLeft
    const maxX = desktop.clientWidth - el.offsetLeft - el.offsetWidth
    const minY = -el.offsetTop
    const maxY = desktop.clientHeight - el.offsetTop - el.offsetHeight
    trackDrag(e, (dx, dy) =>
      setOffset({
        x: Math.min(maxX, Math.max(minX, from.x + dx)),
        y: Math.min(maxY, Math.max(minY, from.y + dy)),
      }),
    )
  }

  return (
    <div
      ref={ref}
      data-desktop-window={title}
      onPointerDownCapture={onFocus}
      style={{ zIndex: z, transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className={cn(DESKTOP_WINDOW, placement)}
    >
      <SafariChrome compact title={title} active={active} onBarPointerDown={startMove}>
        {children}
      </SafariChrome>
    </div>
  )
}
