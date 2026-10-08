import { AirbnbScreen } from "./airbnb-screen";

/**
 * Copy of the Fairbnb app without the browser window around it: the screen is shown on its
 * own, at the 1440×900 desktop viewport's proportions. The wrapper is a size container because
 * the whole screen is authored in cqw units.
 */
export default function CopyProjectPage() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-white p-6">
      <div className="@container aspect-[1440/900] w-[min(100%,calc((100svh-3rem)*1.6))] overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
        <AirbnbScreen />
      </div>
    </main>
  );
}
