import { AirbnbCompactScreen } from "./airbnb-compact-screen";
import { AirbnbScreen } from "./airbnb-screen";

/**
 * Copy of the Fairbnb app without the browser window around it. The layout follows the screen
 * it's viewed on, as the real app would:
 * - below md: the mobile layout, filling the screen;
 * - md to lg: the tablet layout, filling the screen;
 * - lg and up: the desktop screen on its own, at the 1440×900 viewport's proportions.
 * Each wrapper is a size container because the screens are authored in cqw units.
 */
export default function CopyProjectPage() {
  return (
    <main className="flex min-h-svh w-full flex-col bg-white lg:items-center lg:justify-center lg:p-6">
      <div className="@container flex h-svh w-full flex-col md:hidden">
        <AirbnbCompactScreen size="mobile" />
      </div>
      <div className="@container hidden h-svh w-full flex-col md:flex lg:hidden">
        <AirbnbCompactScreen size="tablet" />
      </div>
      <div className="@container hidden aspect-[1440/900] w-[min(100%,calc((100svh-3rem)*1.6))] overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08)] lg:block">
        <AirbnbScreen />
      </div>
    </main>
  );
}
