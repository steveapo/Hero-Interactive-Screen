import { HeroScreen } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

/**
 * The homepage hero's single showcase: the canvas in a mock Safari window, with the code changes
 * in the top bar and the GitHub Sync popover open on its "Sync to Github" button. No cursor
 * recording or scripted demo drives it; the screen stays interactive for the visitor.
 */
export function HeroShowcase({ className }: { className?: string }) {
  return (
    <SafariChrome url="app.modeinspect.com/hero-interactive-screen" className={className}>
      <div className="flex min-h-0 flex-1 flex-col bg-mi-canvas">
        {/* Fills the window instead of the full viewport. */}
        <HeroScreen className="h-auto min-h-0 flex-1" start="built" githubSyncOpen />
      </div>
    </SafariChrome>
  )
}
