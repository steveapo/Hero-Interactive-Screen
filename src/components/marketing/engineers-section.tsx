"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/** Same fluid column as the hero: scales with the viewport, capped at 1280px. */
const COLUMN = "mx-auto w-[min(calc(100%-2*clamp(1.25rem,6vw,8rem)),80rem)]"

/** Words tinted lime when they open a code line. */
const KEYWORDS = new Set(["type", "import", "export", "const"])

const TABS = [
  {
    label: "Type-safe changes",
    title: "Type-safe changes.",
    body: "Props, state, events, and data shape are checked against the product instead of guessed from a mockup.",
    file: "components/ui/button.types.ts",
    code: ['type ButtonProps = {', '  variant: "solid" | "ghost"', "  onClick: (e: MouseEvent) => void", "}"],
  },
  {
    label: "No generated UI debt",
    title: "No generated UI debt.",
    body: "Changes reuse your components and tokens instead of inlining one-off markup and styles, so there is nothing to clean up later.",
    file: "components/checkout/order-summary.tsx",
    code: [
      'import { Card } from "@/components/ui/card"',
      "",
      '<Card variant="outlined" className="gap-4">',
      '  <Button variant="solid">Continue</Button>',
      "</Card>",
    ],
  },
  {
    label: "Reviewed like any PR",
    title: "Reviewed like any PR.",
    body: "Every change lands as a scoped diff on its own branch, ready for your engineers to review, comment on, and merge.",
    file: "components/checkout/order-summary.tsx",
    code: ['- <Button variant="ghost">Continue</Button>', '+ <Button variant="solid">Continue</Button>'],
  },
]

/**
 * Dark "Code your engineers want to merge." section: intro copy, a list of tabs on the left and
 * the selected tab's explanation with a code sample on the right.
 */
export function EngineersSection() {
  const [active, setActive] = useState(0)
  const tab = TABS[active]

  return (
    <section className="w-full bg-mi-ink text-white">
      <div className={cn(COLUMN, "flex max-w-5xl flex-col py-[clamp(4rem,8vw,7rem)]")}>
        <h2 className="flex flex-col gap-[0.05em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.1] tracking-[-0.03em]">
          <span className="max-w-[8em] font-medium">Code your engineers</span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-400 [font-synthesis:none]">
            want to merge.
          </span>
        </h2>
        <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[22em] text-[clamp(1rem,0.95rem+0.2vw,1.125rem)] leading-[1.6] text-stone-400">
          Modeinspect reads your file layout, components, tokens, conventions, and existing logic, then writes within
          them. PRs land type-safe and ready for engineering review.
        </p>
        <a
          href="#"
          className="mt-6 self-start font-mono text-[10px] tracking-[0.15em] text-mi-lime uppercase hover:underline"
        >
          See the developer experience →
        </a>

        <div className="mt-[clamp(2.5rem,5vw,3.5rem)] grid items-start gap-8 md:grid-cols-2 md:gap-12">
          <div role="tablist" aria-label="Developer experience" className="flex flex-col border-t border-white/10">
            {TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                id={`engineers-tab-${i}`}
                aria-selected={i === active}
                aria-controls="engineers-panel"
                onClick={() => setActive(i)}
                className={cn(
                  "border-b border-white/10 py-6 text-left text-[clamp(1.375rem,1.1rem+0.8vw,1.75rem)] tracking-[-0.02em] transition-colors",
                  i === active ? "text-white" : "text-stone-500 hover:text-stone-300",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id="engineers-panel"
            aria-labelledby={`engineers-tab-${active}`}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,2.5vw,1.75rem)]"
          >
            <h3 className="text-[clamp(1.375rem,1.1rem+0.8vw,1.75rem)] tracking-[-0.02em]">{tab.title}</h3>
            <p className="max-w-[28em] text-sm leading-[1.6] text-stone-400">{tab.body}</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-white/5 bg-black/40 font-mono text-xs">
              <p className="border-b border-white/5 px-3 py-2 text-[10px] tracking-[0.15em] text-stone-500 uppercase">
                {tab.file}
              </p>
              <pre className="overflow-x-auto px-3 py-3 leading-[1.6] text-stone-300">
                {tab.code.map((line, i) => {
                  const [first, ...rest] = line.split(" ")
                  return (
                    <div key={i} className="flex gap-4">
                      <span className="w-4 shrink-0 text-stone-600 select-none">{String(i + 1).padStart(2, "0")}</span>
                      <code>
                        {KEYWORDS.has(first) ? (
                          <>
                            <span className="text-mi-lime">{first}</span> {rest.join(" ")}
                          </>
                        ) : (
                          line
                        )}
                      </code>
                    </div>
                  )
                })}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
