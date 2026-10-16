import { Plus } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

/** Same fluid column as the hero: scales with the viewport, capped at 1280px. */
const COLUMN = "mx-auto w-[min(calc(100%-2*clamp(1.25rem,6vw,8rem)),80rem)]"

const FAQS = [
  {
    question: "Is this just another AI app builder?",
    answer:
      "No. App builders generate a new app from scratch. Modeinspect works inside your existing codebase, with your components, tokens and conventions, and ships changes as PRs to your repo.",
  },
  {
    question: "Do I need a dev environment to use Modeinspect?",
    answer:
      "No. Connect your repository and Modeinspect runs your app in the cloud. There is no localhost, no install and no devops setup.",
  },
  {
    question: "Where does Modeinspect fit with Figma?",
    answer:
      "Figma is great for early exploration. Modeinspect picks up where the real product starts: designing on your live UI and turning the result into production code.",
  },
  {
    question: "What do I get out of Modeinspect: prototype or code?",
    answer:
      "Both. What you design is a working prototype built from your real components, and it builds back into your codebase as a clean, reviewable diff.",
  },
  {
    question: "Does Modeinspect work with our existing components and design system?",
    answer:
      "Yes. Modeinspect reads your components and tokens 1:1, and the code it writes reuses them instead of generating one-off UI.",
  },
  {
    question: "What if the screen I need is behind auth, mid-flow, or in a weird state?",
    answer:
      "Capture any element of your live product onto the canvas in whatever state it's in, pixel perfect and fully editable.",
  },
  {
    question: "How does engineering stay involved?",
    answer:
      "Every change lands as a scoped PR on its own branch. Engineers review, comment and merge it like any other PR.",
  },
  {
    question: "Can I use Modeinspect just for design QA and polish?",
    answer:
      "Yes. Fixing spacing, copy or states on the live product with visual controls, then sending the PR, is one of the most common ways teams use it.",
  },
]

/** "Questions Design Engineers ask before they switch." FAQ list. */
export function FaqSection() {
  return (
    <section className="w-full bg-[#cdc9c5] text-mi-ink">
      <div className={cn(COLUMN, "flex flex-col py-[clamp(4rem,8vw,7rem)]")}>
        <h2 className="max-w-[16em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.15] tracking-[-0.03em]">
          <span className="font-medium">Questions </span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-600 [font-synthesis:none]">
            Design Engineers
          </span>
          <span className="font-medium"> ask before they switch.</span>
        </h2>

        <Accordion
          type="single"
          collapsible
          className="mt-[clamp(2rem,4vw,3rem)] rounded-none border-0 border-t border-black/10"
        >
          {FAQS.map((faq) => (
            <AccordionItem
              key={faq.question}
              value={faq.question}
              className="border-b border-black/10 data-open:bg-transparent"
            >
              <AccordionTrigger className="items-center px-0 py-7 text-base font-medium hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden!">
                {faq.question}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-stone-500/60 text-stone-600 transition-transform group-aria-expanded/accordion-trigger:rotate-45">
                  <Plus className="size-3.5" />
                </span>
              </AccordionTrigger>
              <AccordionContent className="-mx-4 max-w-[42em] pb-7 text-base leading-[1.6] text-stone-600">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
