import { cn } from "@/lib/utils"
import { CodeChangesPanel } from "./code-changes-popover"
import { HeroScreen } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

/** A window on the Desktop Area: compact Safari chrome (traffic lights only), rounded, with a shadow. */
const DESKTOP_WINDOW =
  "absolute flex flex-col overflow-hidden rounded-xl border border-black/10 shadow-[0_24px_60px_-20px_rgba(17,17,16,0.35),0_2px_6px_rgba(17,17,16,0.08)]"

/**
 * The homepage hero's showcase: a "Desktop Area" holding two windows.
 * - Main: the canvas (the interactive screen). Frames can be selected and moved, but the Portal
 *   never opens from it (no double-click into the Codebase frame, no "Open Build Mode").
 * - Secondary: the code diff, open as a window of its own, over the Main window's lower right.
 */
export function HeroShowcase({ className }: { className?: string }) {
  return (
    <div
      data-desktop-area
      className={cn(
        "relative flex min-h-0 w-full flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#e4e9d4_0%,#d6d3cd_55%,#c9c5bf_100%)]",
        className,
      )}
    >
      {/* Main window: the canvas */}
      <SafariChrome compact title="ModeInspect Canvas" className={cn(DESKTOP_WINDOW, "left-[3%] top-[4%] h-[88%] w-[70%] flex-none")}>
        <div className="flex min-h-0 flex-1 flex-col bg-mi-canvas">
          <HeroScreen className="h-auto min-h-0 flex-1" start="built" githubSyncOpen portalEnabled={false} />
        </div>
      </SafariChrome>

      {/* Secondary window: the code diff */}
      <SafariChrome compact title="Code Changes" className={cn(DESKTOP_WINDOW, "bottom-[6%] right-[3%] z-10 h-[58%] w-[44%] flex-none")}>
        <CodeChangesPanel className="min-h-0 flex-1" />
      </SafariChrome>
    </div>
  )
}
