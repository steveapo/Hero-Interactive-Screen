import { cn } from "@/lib/utils"

/** Side padding of the footer: it runs nearly edge to edge rather than in the page column. */
const GUTTER = "px-[clamp(1.25rem,2.7vw,2.5rem)]"

const LINK_GROUPS = [
  {
    title: "Product",
    links: ["Design to code", "AI Prototyping", "Design QA", "Developer Experience", "Cursor for designers"],
  },
  { title: "Company", links: ["About", "Manifesto", "Customer story", "Blog"] },
  { title: "Start", links: ["Enterprise", "Pricing", "Book a demo", "Design engineer guide", "Gallery"] },
  { title: "Social", links: ["Community", "LinkedIn", "X / Twitter"] },
]

const LEGAL_LINKS = ["Privacy Policy", "Terms of Service", "Security"]

/** Mono, uppercase micro-label used for column titles and the legal row. */
const MICRO = "font-mono text-[10px] tracking-[0.15em]"

/**
 * Closing "SHIP TODAY" call to action, then the footer: brand blurb, link columns, an
 * illustration box (empty for now) and the legal row.
 */
export function SiteFooter() {
  return (
    <footer className="w-full bg-mi-ink text-white">
      {/* Call to action */}
      <div className="flex flex-col items-center px-6 py-[clamp(5rem,10vw,8rem)] text-center">
        <h2 className="text-[clamp(4rem,2rem+8vw,8.5rem)] leading-[0.9] font-medium tracking-[-0.04em] text-[#f1efe4] uppercase">
          Ship
          <br />
          today
        </h2>
        <div className="mt-[clamp(2.5rem,5vw,3.5rem)] flex flex-wrap justify-center gap-1.5">
          <a
            href="#"
            className="rounded-lg border border-mi-lime-deep/60 bg-[#dcf39a] px-4 py-2.5 text-lg font-medium text-mi-lime-ink shadow-[0_8px_30px_-8px_rgba(194,236,102,0.45)] transition-colors hover:bg-[#d3ef84]"
          >
            Get started
          </a>
          <a
            href="#"
            className="rounded-lg border border-white/15 px-4 py-2.5 text-lg font-medium transition-colors hover:bg-white/5"
          >
            Book a demo
          </a>
        </div>
        <p className="mt-4 text-xs text-stone-400">Free on Hobby. No credit card required.</p>
      </div>

      {/* Footer */}
      <div className={GUTTER}>
        <div className="grid gap-10 border-t border-white/10 py-[clamp(2rem,3vw,2.5rem)] lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-[clamp(2rem,3vw,2.5rem)]">
            <div className="flex flex-col gap-4">
              <a href="/" className="self-start text-sm font-medium">
                modeinspect
              </a>
              <p className="max-w-[24em] text-sm leading-[1.6] text-stone-400">
                The design platform for production-grade output. Real components, tokens, and data, designed in
                canvas, shipped as merge-ready code.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {LINK_GROUPS.map((group) => (
                <div key={group.title} className="flex flex-col gap-4">
                  <p className={cn(MICRO, "text-stone-500 uppercase")}>{group.title}</p>
                  <ul className="flex flex-col gap-2.5">
                    {group.links.map((link) => (
                      <li key={link}>
                        <a href="#" className="text-sm text-stone-400 transition-colors hover:text-white">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* Illustration placeholder */}
          <div aria-hidden="true" className="min-h-48 bg-white/10" />
        </div>

        <div className={cn(MICRO, "flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-white/10 py-5 text-stone-400")}>
          <p>© 2026 Acreom inc</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link}>
                <a href="#" className="transition-colors hover:text-white">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
