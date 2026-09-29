import { PlannerScreen } from "./planner-screen";

/**
 * Copy of the planner without the iPad mockup around it: the screen is shown on
 * its own, at the display's own 2048×2732 proportions. The wrapper is a size
 * container because the whole screen is authored in cqw units.
 */
export default function CopyProjectPage() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-white p-6">
      <div className="@container aspect-[2048/2732] h-[92svh] overflow-hidden">
        <PlannerScreen />
      </div>
    </main>
  );
}
