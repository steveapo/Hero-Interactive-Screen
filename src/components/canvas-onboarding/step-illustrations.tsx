import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CircleCheck,
  Component,
  FolderGit2,
  GitPullRequest,
  Globe,
  Layers,
  LayoutGrid,
  Link,
  MousePointerClick,
  Palette,
  PanelRight,
  PencilRuler,
  RotateCw,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  SquareDashedMousePointer,
  Type,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Illustrations for the onboarding's step cards: small product scenes (built, not screenshots) that
 * show each step's action. Each one fills a Stage, the panel across the top of a step card:
 * 1500 × 690 px at real size. No text in a scene is smaller than 18px; positions are px of that size.
 */

/** Modeinspect's neon (theme mi-lime / mi-lime-deep): the brand accent, always with dark ink on it.
 *  Selection chrome (outlines, handles, drop lines) stays the product's selection blue. */
const LIME_DEEP = "#b1dc52"
export const STAGE_WIDTH = 1500
export const STAGE_HEIGHT = 690
/** Connector paths are drawn in this space (the stage at 2/3 size); their SVG stretches it over the stage. */
const PATH_SPACE = { w: 1000, h: 460 }

const PANEL_SHADOW = "shadow-[0_36px_72px_-30px_rgba(28,25,23,0.3)]"

/* --------------------------------- Shared --------------------------------- */

/** The illustration panel across the top of a step card: a soft dotted canvas. */
export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full shrink-0 overflow-hidden border-b border-stone-200 bg-mi-canvas" style={{ height: STAGE_HEIGHT }}>
      <div className="absolute left-0 top-0" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
        <div className="absolute inset-0 bg-[radial-gradient(#d6d2cb_1.5px,transparent_1.95px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_40%,rgba(243,242,240,0.9)_100%)]" />
        {children}
      </div>
    </div>
  )
}

/** The pointer, black with a white edge. */
function Cursor({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("absolute size-12 drop-shadow-[0_3px_4.5px_rgba(0,0,0,0.25)]", className)}>
      <path d="M4 2.5 20 11.6l-7.1 1.7L9.4 20Z" fill="#0c0a09" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

/** A dashed connector between two points of a scene (in PATH_SPACE), with an arrowhead at its end. */
function Connector({ d, color = LIME_DEEP }: { d: string; color?: string }) {
  const headId = `connector-head-${color.replace("#", "")}`
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox={`0 0 ${PATH_SPACE.w} ${PATH_SPACE.h}`}
    >
      <defs>
        <marker id={headId} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M1 1 8 5 1 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      <path d={d} fill="none" stroke={color} strokeWidth="2.6" strokeDasharray="6 5" strokeLinecap="round" markerEnd={`url(#${headId})`} />
    </svg>
  )
}

/** A small floating label (a caption pinned into a scene). */
function Tag({
  children,
  className,
  tone = "dark",
}: {
  children: React.ReactNode
  className?: string
  tone?: "dark" | "blue" | "green" | "light" | "lime"
}) {
  return (
    <span
      className={cn(
        "absolute flex items-center gap-2.25 whitespace-nowrap rounded-full px-4.5 py-1.5 text-[18px] font-semibold shadow-sm",
        tone === "dark" && "bg-stone-900 text-white",
        tone === "blue" && "bg-[#2f6bf6] text-white",
        tone === "green" && "bg-[#16a34a] text-white",
        tone === "light" && "border border-stone-200 bg-white text-stone-700",
        tone === "lime" && "border border-mi-lime-deep bg-mi-lime text-mi-lime-ink",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Blue selection chrome around whatever its parent wraps: outline and corner handles. */
function SelectionChrome() {
  return (
    <>
      <div className="absolute -inset-[4.5px] outline outline-[2.25px] outline-[#2f6bf6]" />
      {(["-left-[10.5px] -top-[10.5px]", "-right-[10.5px] -top-[10.5px]", "-left-[10.5px] -bottom-[10.5px]", "-right-[10.5px] -bottom-[10.5px]"] as const).map((corner) => (
        <span key={corner} className={cn("absolute size-[10.5px] border-[2.25px] border-[#2f6bf6] bg-white", corner)} />
      ))}
    </>
  )
}

/** The Codebase frame's icon (as on the canvas: a window with a prompt). */
function CodebaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}

/**
 * The Codebase frame as it sits on the canvas: its "Codebase" label above a thick black, rounded
 * bezel around the live app. `className` places and sizes the bezel (the label sits above it).
 */
function CodebaseFrameMini({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("absolute", className)}>
      <span className="absolute -top-10.5 left-0 flex items-center gap-2.25 text-[20px] text-stone-500">
        <CodebaseIcon className="size-5.25" />
        Codebase
      </span>
      <div className="relative size-full overflow-hidden rounded-[18px] border-[7.5px] border-stone-950 bg-white shadow-[0_24px_48px_-20px_rgba(28,25,23,0.45)]">
        {children}
      </div>
    </div>
  )
}

/** An icon button in Build mode's browser bar. */
function BarIcon({ children }: { children: React.ReactNode }) {
  return <span className="flex size-10.5 items-center justify-center rounded-[9px] text-stone-800">{children}</span>
}

/**
 * Build mode (the Portal) as it looks in the product: "Back to Canvas", then the browser bar (back /
 * forward, the address with reload, the capture buttons, the viewport and side-panel toggles), and
 * the live app below it. `capturing`: area capture is on (its green pill replaces the capture button).
 */
function BuildModeWindow({
  path,
  capturing = false,
  className,
  children,
}: {
  path: string
  capturing?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("absolute flex flex-col overflow-hidden rounded-[18px] border border-stone-300/80 bg-stone-50", PANEL_SHADOW, className)}>
      <div className="shrink-0 px-2.25 pt-2.25">
        <span className="inline-flex h-12 items-center gap-2.25 rounded-[12px] bg-stone-100 px-4.5 text-[18px] font-medium text-stone-900">
          <ArrowLeft className="size-5.25" strokeWidth={1.75} /> Back to Canvas
        </span>
      </div>
      <div className="grid h-16.5 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4.5 border-b border-stone-200 px-3">
        <div className="flex items-center text-stone-800">
          <BarIcon>
            <ArrowLeft className="size-6" strokeWidth={1.5} />
          </BarIcon>
          <BarIcon>
            <ArrowRight className="size-6" strokeWidth={1.5} />
          </BarIcon>
        </div>
        <div className="flex h-10.5 min-w-0 items-center gap-3 rounded-[12px] bg-stone-100 pl-3.75 pr-2.25 text-[18px] text-stone-900">
          <Link className="size-4.5 shrink-0 text-stone-500" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate text-center">{path}</span>
          <RotateCw className="size-5.25 shrink-0 text-stone-700" strokeWidth={1.5} />
        </div>
        <div className="flex items-center">
          {capturing ? (
            <span className="relative flex size-10.5 items-center justify-center rounded-[9px] bg-stone-200/80 text-stone-900">
              <SquareDashedMousePointer className="size-6" strokeWidth={1.25} />
              <span className="absolute bottom-full left-1/2 mb-2.25 -translate-x-1/2 whitespace-nowrap rounded-[12px] bg-stone-200 px-4.5 py-2.25 text-[18px] text-stone-900">
                Capture a selection to the canvas (⌘S)
              </span>
            </span>
          ) : (
            <BarIcon>
              <SquareDashedMousePointer className="size-6" strokeWidth={1.25} />
            </BarIcon>
          )}
          <BarIcon>
            <ScanLine className="size-6" strokeWidth={1.25} />
          </BarIcon>
          <span aria-hidden="true" className="mx-2.25 h-6 w-px bg-stone-300" />
          <span className="flex h-10.5 items-center gap-0.75 px-1.5 text-stone-800">
            <AppWindow className="size-6" strokeWidth={1.25} />
            <ChevronDown className="size-4.5" strokeWidth={1.5} />
          </span>
          <BarIcon>
            <PanelRight className="size-6" strokeWidth={1.25} />
          </BarIcon>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-white">{children}</div>
    </div>
  )
}

/**
 * The demo store's order summary, in miniature. `padY`: its button's vertical padding, as the step
 * names it (8 → 16); drawn 1.5× like the rest of the scene.
 */
function MiniOrder({ padY = 8, selected = false, className }: { padY?: number; selected?: boolean; className?: string }) {
  const rows = [
    { initials: "OC", name: "Organic Cotton Tee", price: "$32" },
    { initials: "SM", name: "Stoneware Mug", price: "$36" },
  ]
  return (
    <div className={cn("w-[375px] border-[3px] border-stone-900 bg-white p-5.25 text-[18px] text-stone-900 shadow-[6px_6px_0_0_#1c1917]", className)}>
      <p className="text-[20px] font-black uppercase leading-tight tracking-tight">Order summary</p>
      <div className="mt-3.75 flex flex-col gap-2.25">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center bg-stone-900 text-[18px] font-semibold leading-none text-white">
              {row.initials[0]}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
            <span className="tabular-nums">{row.price}</span>
          </div>
        ))}
      </div>
      <div className="my-3.75 h-px bg-stone-200" />
      <div className="flex items-baseline justify-between">
        <span className="font-medium">Total</span>
        <span className="text-[30px] font-black tabular-nums">$68.00</span>
      </div>
      <div className="relative mt-4.5">
        <div
          className="flex items-center justify-center border-[3px] border-stone-900 bg-primary text-[18px] font-bold leading-6 text-primary-foreground shadow-[3px_3px_0_0_#1c1917]"
          style={{ paddingTop: padY * 1.5, paddingBottom: padY * 1.5 }}
        >
          Continue to shipping →
        </div>
        {selected && (
          <>
            {/* Padding zones, hatched, inside the selection outline */}
            <div
              className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,rgba(47,107,246,0.35)_0_3px,transparent_3px_7.5px)]"
              style={{ height: padY * 1.5 + 3 }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-[repeating-linear-gradient(135deg,rgba(47,107,246,0.35)_0_3px,transparent_3px_7.5px)]"
              style={{ height: padY * 1.5 + 3 }}
            />
            <SelectionChrome />
            <span className="absolute -top-[39px] left-[-4.5px] rounded-[6px] bg-[#2f6bf6] px-2.25 py-0.75 text-[18px] font-semibold leading-6 text-white">Button</span>
            <span className="absolute -bottom-[40.5px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#2f6bf6] px-2.25 py-0.75 text-[18px] font-semibold leading-6 tabular-nums text-white">
              Fill × {20 + padY * 2}
            </span>
          </>
        )}
      </div>
      {!selected && <p className="mt-3 text-center text-[18px] text-stone-500">No charge yet</p>}
    </div>
  )
}

/** A settings field in the mini settings panel. */
function Field({ icon, value, focused = false }: { icon: React.ReactNode; value: string; focused?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-12 items-center gap-3 rounded-[9px] px-3.75 text-[18px] tabular-nums text-stone-900",
        focused ? "bg-white shadow-[0_0_0_2.25px_#2f6bf6]" : "bg-stone-100",
      )}
    >
      <span className="text-stone-500">{icon}</span>
      <span className="ml-auto">
        {value}
        {focused && <span className="ml-px inline-block h-5.25 w-px translate-y-0.75 animate-pulse bg-[#2f6bf6]" />}
      </span>
    </div>
  )
}

/** A section label inside a mini panel. */
function PanelLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[18px] font-semibold uppercase tracking-wider text-stone-400", className)}>{children}</p>
}

/* ---------------------------------- Scenes ---------------------------------- */

/** 1 · Edit on canvas: the button selected, its padding shown, the panel setting it to 16. */
export function EditScene() {
  return (
    <>
      <MiniOrder selected padY={16} className="absolute left-[255px] top-[144px]" />

      {/* Settings panel */}
      <div className={cn("absolute left-[870px] top-[78px] w-[435px] rounded-[24px] border border-stone-200 bg-white p-6", PANEL_SHADOW)}>
        <div className="flex items-center gap-3 border-b border-stone-100 pb-4.5">
          <Type className="size-6 text-stone-500" />
          <span className="text-[21px] font-semibold text-stone-900">Button</span>
          <span className="ml-auto rounded-[6px] bg-stone-100 px-2.25 py-0.75 text-[18px] font-medium text-stone-500">ui/button</span>
        </div>
        <PanelLabel className="mt-5.25">Size</PanelLabel>
        <div className="mt-2.25 grid grid-cols-2 gap-3">
          <Field icon="W" value="Fill" />
          <Field icon="H" value="Hug · 52" />
        </div>
        <PanelLabel className="mt-5.25">Padding</PanelLabel>
        <div className="relative mt-2.25 grid grid-cols-2 gap-3">
          <Field icon="↔" value="16" />
          <Field icon="↕" value="16" focused />
          <span className="absolute -top-13.5 right-0 whitespace-nowrap rounded-[9px] bg-stone-900 px-3.75 py-1.5 text-[18px] font-medium text-white">
            Vertical padding <span className="text-stone-400">8 →</span> 16
          </span>
        </div>
        <PanelLabel className="mt-5.25">Fill</PanelLabel>
        <div className="mt-2.25 flex h-12 items-center gap-3 rounded-[9px] bg-stone-100 px-3.75 text-[18px] text-stone-900">
          <span className="size-6 rounded-[6px] bg-primary ring-1 ring-black/10" />
          primary
          <span className="ml-auto text-stone-500">100%</span>
        </div>
      </div>
      <Cursor className="left-[1275px] top-[309px]" />

      <Connector d="M 432 318 C 500 318, 520 236, 572 226" />
      <Tag tone="light" className="left-[60px] top-[36px]">
        <span className="size-3 rounded-full bg-mi-lime-deep" /> Real component · real CSS
      </Tag>
    </>
  )
}

/** A frame thumbnail of the order summary (no text inside: a sketch of its layout). */
function FrameSketch({ className }: { className?: string }) {
  return (
    <div className={cn("w-[255px] border-[3px] border-stone-900 bg-white p-4.5 shadow-[4.5px_4.5px_0_0_#1c1917]", className)}>
      <div className="h-3.75 w-30 bg-stone-900" />
      <div className="mt-4.5 flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="size-6 bg-stone-900" />
            <span className="h-3 flex-1 rounded-full bg-stone-200" />
            <span className="h-3 w-9 rounded-full bg-stone-300" />
          </div>
        ))}
      </div>
      <div className="my-4.5 h-px bg-stone-200" />
      <div className="flex justify-between">
        <span className="h-3 w-12 rounded-full bg-stone-200" />
        <span className="h-4.5 w-18 bg-stone-900" />
      </div>
      <div className="mt-4.5 h-12 border-[3px] border-stone-900 bg-primary" />
    </div>
  )
}

/** 2 · Ship to code: the frame dragged onto the Codebase, Enter, and the small diff it makes. */
export function ShipScene() {
  return (
    <>
      {/* The dragged frame */}
      <div className="absolute left-[75px] top-[165px] -rotate-6">
        <span className="mb-2.25 block text-[18px] font-semibold text-[#2f6bf6]">Order summary</span>
        <div className="relative">
          <FrameSketch />
          <SelectionChrome />
        </div>
      </div>
      <Cursor className="left-[285px] top-[375px]" />
      <Connector d="M 236 240 C 280 220, 300 210, 340 210" color="#16a34a" />

      {/* The Codebase frame, taking the drop */}
      <CodebaseFrameMini className="left-[525px] top-[135px] h-[360px] w-[435px]">
        <div className="flex h-full flex-col gap-3.75 p-5.25">
          <div className="h-5.25 w-42 rounded-[6px] bg-stone-200" />
          <div className="grid flex-1 grid-cols-3 gap-3.75">
            <div className="col-span-2 rounded-[9px] bg-stone-100" />
            <div className="rounded-[9px] bg-stone-100" />
          </div>
        </div>
        <div className="absolute inset-3 rounded-[9px] border-[3px] border-dashed border-[#16a34a] bg-[#16a34a]/[0.06]" />
        <Tag tone="green" className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          + Add to Build Chat
        </Tag>
      </CodebaseFrameMini>
      <div className="absolute left-[570px] top-[534px] flex items-center gap-3 text-[21px] font-medium text-stone-600">
        Then press
        <kbd className="rounded-[9px] border border-b-[4.5px] border-stone-300 bg-white px-3 py-0.75 font-mono text-[20px] font-semibold text-stone-900">⏎ Enter</kbd>
      </div>

      {/* The diff (light theme) */}
      <div className="absolute left-[996px] top-[105px] w-[465px] overflow-hidden rounded-[18px] border border-stone-200 bg-white font-mono text-[18px] leading-[1.6] text-stone-500 shadow-[0_36px_72px_-30px_rgba(28,25,23,0.3)]">
        <div className="flex items-center gap-3 border-b border-stone-200 px-5.25 py-3.75 font-sans">
          <span className="text-[20px] font-semibold text-stone-900">order-summary.tsx</span>
          <span className="ml-auto text-[18px] font-semibold text-[#16a34a]">+1</span>
          <span className="text-[18px] font-semibold text-[#dc2626]">−1</span>
        </div>
        <div className="py-3.75">
          <p className="px-5.25">&lt;Button size=&quot;lg&quot;</p>
          <p className="bg-[#fef2f2] px-5.25 text-[#b91c1c]">-  className=&quot;py-2&quot;</p>
          <p className="bg-[#f0fdf4] px-5.25 text-[#15803d]">+  className=&quot;py-4&quot;</p>
          <p className="px-5.25">&gt;</p>
          <p className="px-5.25">  Continue to shipping</p>
          <p className="px-5.25">&lt;/Button&gt;</p>
        </div>
        <div className="flex items-center gap-2.25 border-t border-stone-200 bg-stone-50 px-5.25 py-3.75 font-sans text-[18px] text-stone-600">
          <CircleCheck className="size-5.25 text-[#16a34a]" /> Rebuilt 1:1 with your components
        </div>
      </div>
    </>
  )
}

/** The demo store's checkout page, in miniature (for the live-app scenes). */
function MiniStore({ compact = false, captured = false }: { compact?: boolean; captured?: boolean }) {
  const products = ["Cotton Tee", "Stoneware Mug", "Canvas Tote", "Steel Bottle", "Wool Beanie", "Ribbed Socks"]
  return (
    <div className="flex h-full flex-col text-stone-900">
      <div className="flex items-center border-b border-stone-200 px-6 py-3">
        <span className="text-[20px] font-black uppercase tracking-tight">Modify Store</span>
        <span className="ml-auto text-[18px] text-stone-500">Secure checkout</span>
      </div>
      <div className="flex flex-1 gap-6 p-6">
        <div className="flex min-w-0 flex-1 flex-col">
          {!compact && (
            <div className="flex items-center gap-3 text-[18px] font-semibold text-stone-500">
              <span className="bg-stone-900 px-2.25 text-white">1 Cart</span>— 2 Shipping — 3 Payment
            </div>
          )}
          <p className={cn("text-[27px] font-black tracking-tight", !compact && "mt-3")}>Your order</p>
          <div className={cn("mt-3 grid gap-3", compact ? "grid-cols-1" : "grid-cols-2")}>
            {(compact ? products.slice(0, 4) : products).map((name) => (
              <div key={name} className="flex items-center gap-3 border-[2.25px] border-stone-900 p-2.25">
                <span className="size-7.5 shrink-0 bg-stone-900" />
                <span className="min-w-0 flex-1 truncate text-[18px] font-medium">{name}</span>
                {!compact && <span className="border border-stone-900 px-1.5 text-[18px] font-bold leading-6">+ Add</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="relative shrink-0 self-start">
          <MiniOrder />
          {captured && (
            <>
              <div className="absolute -inset-3.75 rounded-[6px] border-[3px] border-dashed border-stone-900 bg-stone-900/[0.04]" />
              <Tag className="-top-[33px] left-0 bg-stone-200 text-stone-900 shadow-none">
                <SquareDashedMousePointer className="size-5.25" strokeWidth={1.5} /> Order summary
              </Tag>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** 3 · Build mode: the real app, running live in its sandbox. */
export function LiveAppScene() {
  return (
    <>
      <BuildModeWindow path="/checkout" className="left-[165px] top-[36px] h-[630px] w-[1170px]">
        <MiniStore />
      </BuildModeWindow>
      <Tag tone="lime" className="left-[1239px] top-[14px]">
        <span className="size-3 rounded-full bg-mi-lime-ink" /> Live
      </Tag>
      <Tag tone="lime" className="left-[45px] top-[252px] -rotate-6">
        Real code
      </Tag>
      <Tag tone="light" className="left-[60px] top-[330px] rotate-3">
        Real data
      </Tag>
      <Tag tone="lime" className="left-[1320px] top-[510px] rotate-6">
        Real routes
      </Tag>
    </>
  )
}

/** 4 · Capture: a piece of the live app picked, and coming back onto the canvas as a frame. */
export function CaptureScene() {
  return (
    <>
      <BuildModeWindow path="/checkout" capturing className="left-[54px] top-[40px] h-[610px] w-[790px]">
        <MiniStore compact captured />
      </BuildModeWindow>

      <Connector d="M 570 150 C 615 104, 648 112, 690 140" />

      <div className="absolute left-[1050px] top-[144px]">
        <span className="mb-3 block text-[18px] font-semibold text-[#2f6bf6]">Order summary</span>
        <div className="relative">
          <MiniOrder />
          <SelectionChrome />
        </div>
      </div>
      <Tag tone="lime" className="left-[1095px] top-[606px]">
        <Sparkles className="size-5.25" /> Pixel perfect · editable
      </Tag>
    </>
  )
}

/** A tile in the components sidebar: its name over a preview of the real component. */
function LibraryTile({ name, active = false, children }: { name: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 truncate pl-0.75 text-[18px] text-stone-800">{name}</p>
      <div
        className={cn(
          "flex h-[108px] items-center justify-center overflow-hidden rounded-[9px] bg-stone-200/80",
          active && "shadow-[0_0_0_2.25px_#2f6bf6]",
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** The project's Button, as its library preview and drag ghost show it. */
function ButtonPreview({ className }: { className?: string }) {
  return <span className={cn("rounded-full bg-primary px-6 py-2.25 text-[20px] font-medium text-primary-foreground", className)}>Button</span>
}

/** 5 · Design system: the components sidebar's Button dragged onto the card, or @mentioned in Build chat. */
export function ComponentsScene() {
  return (
    <>
      {/* Components sidebar: rail + panel, as in the canvas's left sidebar */}
      <div className={cn("absolute left-[40px] top-[40px] flex w-[400px] overflow-hidden rounded-[18px] border border-stone-200 bg-[#f6f6f4]", PANEL_SHADOW)}>
        <div className="flex w-[60px] shrink-0 flex-col items-center gap-2.25 border-r border-stone-700/10 py-3">
          <span className="flex size-[45px] items-center justify-center rounded-[12px] text-stone-500">
            <Layers className="size-6" strokeWidth={1.5} />
          </span>
          <span className="flex size-[45px] items-center justify-center rounded-[12px] bg-[#bfd8f8] text-stone-900">
            <LayoutGrid className="size-6" strokeWidth={1.5} />
          </span>
        </div>
        <div className="min-w-0 flex-1 p-3.75">
          <p className="text-[18px] font-semibold text-stone-900">Components</p>
          <div className="mt-3 flex h-12 items-center rounded-[9px] border border-stone-300 bg-white px-3 text-[18px] text-stone-500">
            Search components...
          </div>
          <div className="mt-4.5 grid grid-cols-2 gap-x-2.25 gap-y-4.5">
            <LibraryTile name="Badge">
              <span className="rounded-full bg-primary px-3.75 py-0.75 text-[18px] font-medium text-primary-foreground">Badge</span>
            </LibraryTile>
            <LibraryTile name="Button" active>
              <ButtonPreview />
            </LibraryTile>
          </div>
        </div>
      </div>

      {/* Dragged Button */}
      <ButtonPreview className="absolute left-[500px] top-[130px] rotate-[-4deg] opacity-90 shadow-lg" />
      <Cursor className="left-[590px] top-[160px]" />
      <Connector d="M 430 103 C 540 80, 650 95, 718 128" />

      {/* Drop target */}
      <div className="absolute left-[1085px] top-[30px]">
        <MiniOrder />
        <div className="absolute inset-x-6 top-[250.5px] h-[4.5px] rounded-full bg-[#2f6bf6] shadow-[0_0_0_4.5px_rgba(47,107,246,0.2)]" />
      </div>

      {/* Tagging in Build chat, as in the app: the chat box with "@B" typed, the matching components
          listed over its top edge, and the highlighted one's preview card beside the list */}
      <div className="absolute left-[700px] top-[520px] w-[640px] rounded-[30px] border border-stone-300 bg-white px-6 pb-4 pt-5">
        <p className="text-[22px] text-stone-900">
          @B
          <span className="ml-px inline-block h-6.75 w-px translate-y-1 bg-stone-900" />
        </p>
        <div className="mt-6 flex items-center gap-6 text-stone-600">
          <MousePointerClick className="size-7" strokeWidth={1.5} />
          <PencilRuler className="size-7" strokeWidth={1.5} />
          <span className="ml-auto flex size-[54px] items-center justify-center rounded-full bg-[#43a047] text-white">
            <ArrowUp className="size-7" strokeWidth={2.25} />
          </span>
        </div>
      </div>
      <div className="absolute left-[720px] top-[298px] w-[340px] rounded-[15px] border border-stone-200 bg-white p-1.5 text-[21px] shadow-[0_6px_21px_-6px_rgba(17,17,16,0.18)]">
        {["Badge", "Button", "Checkbox", "Label", "Table"].map((name) => (
          <p
            key={name}
            className={cn(
              "flex h-[46px] items-center rounded-[9px] px-4.5",
              name === "Button" ? "bg-[#7c5cff]/[0.07] text-[#7c5cff]" : "text-stone-800",
            )}
          >
            {name}
          </p>
        ))}
      </div>
      {/* The highlighted suggestion's preview: beside its row in the list, top edges aligned */}
      <div className="absolute left-[408px] top-[351px] w-[304px] rounded-[15px] border border-stone-200 bg-white p-3 shadow-[0_6px_21px_-6px_rgba(17,17,16,0.18)]">
        <div className="flex h-[76px] items-center justify-center rounded-[11px] bg-stone-100">
          <ButtonPreview className="px-4.5 py-1.5 text-[18px]" />
        </div>
        <p className="mt-2.25 px-0.75 text-[20px] font-medium leading-[30px] text-stone-900">Button</p>
        <p className="px-0.75 pb-0.75 text-[18px] leading-[27px] text-stone-500">src/components/ui/button.tsx</p>
      </div>
    </>
  )
}

/** 6 · Collaborate: the Share button's Preview URL popover (as in the top bar), and the PR it ends in. */
export function ShareScene() {
  return (
    <>
      {/* The top bar's Share button, with its Preview URL popover open below it */}
      <div className="absolute left-[402px] top-[48px] rounded-[18px] bg-[#f2f2f1] p-[4.5px]">
        <span className="flex h-[42px] items-center rounded-[10.5px] bg-mi-lime px-4.5 text-[20px] font-medium text-stone-900 shadow-[0_1.5px_3px_rgba(22,33,10,0.12)]">
          Share
        </span>
      </div>
      <div className="absolute left-[105px] top-[114px] flex w-[420px] flex-col rounded-[18px] border border-stone-700/10 bg-[#f3f3f1] p-4.5 shadow-[0_6px_21px_-6px_rgba(17,17,16,0.14),0_1.5px_4.5px_rgba(17,17,16,0.08)]">
        <p className="text-[20px] font-medium text-stone-900">Preview URL</p>
        <p className="mt-0.75 text-[18px] text-stone-600">Published about 20 hours ago</p>
        <span className="mt-4.5 flex h-[60px] w-full items-center justify-center rounded-[9px] bg-mi-lime text-[20px] font-medium text-stone-900 shadow-[0_1.5px_3px_rgba(22,33,10,0.12)]">
          Update
        </span>
        <div className="mt-2.25 grid grid-cols-2 gap-2.25">
          <span className="flex h-12 items-center justify-center rounded-[9px] bg-stone-700/5 text-[20px] font-medium text-stone-800">Open</span>
          <span className="flex h-12 items-center justify-center rounded-[9px] bg-stone-700/10 text-[20px] font-medium text-stone-800">Copy</span>
        </div>
      </div>
      <Cursor className="left-[430px] top-[312px]" />
      <Tag tone="dark" className="left-[105px] top-[420px]">
        <CircleCheck className="size-5.25 text-mi-lime" /> Copied Preview Link
      </Tag>

      <Connector d="M 368 170 C 420 160, 480 175, 528 198" />

      {/* Pull request */}
      <div className={cn("absolute left-[810px] top-[186px] w-[630px] rounded-[24px] border border-stone-200 bg-white p-6", PANEL_SHADOW)}>
        <div className="flex items-center gap-3">
          <GitPullRequest className="size-6 shrink-0 text-[#16a34a]" />
          <span className="text-[21px] font-semibold text-stone-900">Update order summary padding</span>
          <span className="text-[21px] text-stone-400">#42</span>
        </div>
        <p className="mt-1.5 font-mono text-[18px] text-stone-500">modeinspect/order-summary → main</p>
        <div className="mt-5.25 flex items-center gap-4.5 text-[18px]">
          <span className="rounded-full bg-[#16a34a] px-3.75 py-0.75 font-semibold text-white">Open</span>
          <span className="flex items-center gap-1.5 text-stone-600">
            <CircleCheck className="size-5.25 text-[#16a34a]" /> 3 checks passed
          </span>
          <span className="ml-auto font-mono font-semibold">
            <span className="text-[#16a34a]">+1</span> <span className="text-[#dc2626]">−1</span>
          </span>
        </div>
        <div className="mt-5.25 flex h-13.5 items-center justify-center rounded-[12px] bg-[#16a34a] text-[20px] font-semibold text-white">Merge pull request</div>
      </div>

      {/* final_v4, retired */}
      <div className="absolute left-[1200px] top-[60px] rotate-[8deg] rounded-[6px] bg-[#fef3c7] px-5.25 py-3.75 text-[21px] font-semibold text-stone-700 shadow-md">
        <span className="line-through decoration-[#dc2626] decoration-2">final_v4.fig</span>
      </div>
    </>
  )
}

/** 7 · Your turn: any kind of project goes in; Modeinspect reads it; nothing ships without review. */
export function ConnectScene() {
  const sources = [
    { icon: Sparkles, title: "Vibe-coded project", sub: "A prototype from an AI builder", centerY: 168 },
    { icon: Globe, title: "Website", sub: "Marketing site or docs", centerY: 310.5 },
    { icon: FolderGit2, title: "Product repo", sub: "Your production codebase", centerY: 453 },
  ]
  const reads = [
    { icon: Component, label: "Components", value: "48" },
    { icon: Palette, label: "Tokens", value: "126" },
    { icon: Route, label: "Routes", value: "12" },
  ]
  return (
    <>
      {/* Each source card is centred on its connector's start (stage y = path y × 1.5). */}
      {sources.map(({ icon: Icon, title, sub, centerY }) => (
        <div
          key={title}
          style={{ top: centerY }}
          className="absolute left-[66px] flex w-[420px] -translate-y-1/2 items-center gap-4.5 rounded-[24px] border border-stone-200 bg-white p-4.5 shadow-sm"
        >
          <span className="flex size-15 shrink-0 items-center justify-center rounded-[18px] bg-stone-100 text-stone-700">
            <Icon className="size-6.75" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[20px] font-semibold text-stone-900">{title}</span>
            <span className="truncate text-[18px] text-stone-500">{sub}</span>
          </span>
        </div>
      ))}

      <Connector d="M 330 112 C 390 112, 400 203, 440 204" />
      <Connector d="M 330 207 L 440 207" />
      <Connector d="M 330 302 C 390 302, 400 211, 440 210" />

      {/* Modeinspect: centred at stage y 310.5 (path y 207) */}
      <div className="absolute left-[672px] top-[213px] flex size-[195px] flex-col items-center justify-center gap-3.75 rounded-[45px] bg-stone-900 text-white shadow-[0_36px_72px_-24px_rgba(28,25,23,0.6)]">
        {/* Modeinspect logo, inverted for the dark tile: the cursor is white, its inner cut-out takes the tile's colour. */}
        <svg viewBox="170 198 502 472" aria-hidden="true" className="h-[72px] w-auto">
          <g stroke="#d4f68b" strokeWidth="42" strokeLinecap="butt" fill="none">
            <line x1="252" y1="219" x2="335" y2="340" />
            <line x1="428" y1="219" x2="335" y2="340" />
            <line x1="185" y1="386" x2="330" y2="345" />
            <line x1="326" y1="501" x2="331" y2="345" />
          </g>
          <circle cx="333" cy="341" r="30" fill="#d4f68b" />
          <path d="M350 327 L662 436 L662 476 L546 512 L636 606 L608 636 L515 548 L477 660 L437 660 L330 350 Z" fill="#fff" />
          <path d="M383 383 L592 457 L500 488 L487 501 L456 590 Z" fill="#1c1917" />
        </svg>
        <span className="text-[20px] font-semibold">Modeinspect</span>
      </div>

      <Connector d="M 586 207 L 676 207" />

      <div className={cn("absolute left-[1029px] top-[310.5px] w-[420px] -translate-y-1/2 rounded-[24px] border border-stone-200 bg-white p-5.25", PANEL_SHADOW)}>
        <PanelLabel>Reads your codebase</PanelLabel>
        <div className="mt-3 flex flex-col gap-0.75">
          {reads.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex h-12 items-center gap-3.75 rounded-[9px] px-2.25 text-[20px] text-stone-800">
              <Icon className="size-6 text-stone-500" /> {label}
              <span className="ml-auto font-semibold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Centred under the Modeinspect tile (its centre x is 672 + 195 / 2) */}
      <div className="absolute left-[769.5px] top-[528px] flex -translate-x-1/2 items-center gap-4.5 whitespace-nowrap rounded-[24px] border border-[#bbf7d0] bg-[#f0fdf4] px-6 py-5.25">
        <ShieldCheck className="size-7.5 shrink-0 text-[#16a34a]" />
        <span className="text-[20px] font-medium leading-snug text-[#14532d]">Nothing ships without a PR your engineers review.</span>
      </div>
    </>
  )
}

/** A sticker by the order summary on the canvas: an arrow up to it, and what to do. 420 × 195. */
export function TryMeSticker() {
  return (
    <div className="relative h-[195px] w-[420px]">
      <svg viewBox="0 0 200 160" aria-hidden="true" className="absolute left-0 top-0 h-[120px] w-[150px] overflow-visible">
        <path d="M 40 150 C 30 90, 90 60, 150 18" fill="none" stroke="#111110" strokeWidth="7" strokeLinecap="round" />
        <path d="M 120 14 L 152 16 L 140 46" fill="none" stroke="#111110" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute bottom-0 left-0 flex -rotate-3 items-center whitespace-nowrap rounded-full border-[3px] border-mi-lime-deep bg-mi-lime px-6 py-3 text-[26px] font-bold text-mi-lime-ink shadow-[0_18px_36px_-15px_rgba(22,33,10,0.45)]">
        Try me: select the button
      </span>
    </div>
  )
}
