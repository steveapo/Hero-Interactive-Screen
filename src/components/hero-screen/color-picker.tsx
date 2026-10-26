"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Pipette, Search } from "lucide-react"
import { screenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"

/* --------------------------------- Colour --------------------------------- */

/** Hue (0–360), saturation and value (0–1), alpha (0–1). */
type Hsva = { h: number; s: number; v: number; a: number }

const HEX6 = /^#?([0-9a-f]{6})$/i
const HEX8 = /^#?([0-9a-f]{6})([0-9a-f]{2})$/i

/** "#rrggbb" or "#rrggbbaa" → HSVA. Anything else reads as white. */
function hexToHsva(hex: string): Hsva {
  const m8 = HEX8.exec(hex)
  const m6 = m8 ? null : HEX6.exec(hex)
  const rgb = m8?.[1] ?? m6?.[1] ?? "ffffff"
  const a = m8 ? parseInt(m8[2], 16) / 255 : 1
  const n = parseInt(rgb, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max, a }
}

/** The colour without its alpha, "#rrggbb". */
function rgbHex({ h, s, v }: Hsva) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`
}

/** "#rrggbb" when opaque, else "#rrggbbaa". */
function toHex(color: Hsva) {
  const rgb = rgbHex(color)
  return color.a >= 1 ? rgb : `${rgb}${Math.round(color.a * 255).toString(16).padStart(2, "0")}`
}

/** A colour's opacity in whole percent ("#rrggbbaa" → its alpha; "#rrggbb" → 100). */
export function opacityOf(hex: string | null) {
  if (!hex) return 0
  const m = HEX8.exec(hex)
  return m ? Math.round((parseInt(m[2], 16) / 255) * 100) : 100
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/* ------------------------------ Design tokens ----------------------------- */

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]

/** The project's colour tokens (Tailwind's palette), shade by shade. */
const PALETTE: Record<string, string[]> = {
  red: ["#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#450a0a"],
  sky: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"],
  lime: ["#f7fee7", "#ecfccb", "#d9f99d", "#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f", "#3f6212", "#365314", "#1a2e05"],
  amber: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"],
  green: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#052e16"],
  blue: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"],
  violet: ["#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065"],
  pink: ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724"],
  orange: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#431407"],
  stone: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"],
}

const TOKENS = Object.entries(PALETTE).flatMap(([family, hexes]) =>
  hexes.map((hex, i) => ({ name: `${family}/${SHADES[i]}`, hex })),
)

/* --------------------------------- Pieces --------------------------------- */

/** Follow a press on a track: `onMove` gets the pointer's position across it (0–1 each way), until release. */
function useTrack(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  function at(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return
    onMove(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height))
  }
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      at(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e)
    },
  }
}

/** The round handle on a slider / the colour area. */
function Handle({ style, className }: { style: React.CSSProperties; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.3)]",
        className,
      )}
      style={style}
    />
  )
}

const CHECKERBOARD = "repeating-conic-gradient(#d6d3d1 0 25%, #ffffff 0 50%) 0 0 / 8px 8px"

/* --------------------------------- Picker --------------------------------- */

const POPOVER_WIDTH = 280
const POPOVER_GAP = 4

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

/**
 * Colour picker popover, opened from a colour field (`anchor`): "Design Tokens" (the palette, with
 * search) or "Custom" (colour area, eyedropper, hue and opacity sliders, hex and opacity fields).
 * Every change applies live (`onChange`: "#rrggbb", or "#rrggbbaa" below 100 % opacity).
 *
 * Rendered into the screen's root (outside the settings panel, which scrolls and would clip it),
 * just under the anchor, following it while it's open. Outside presses and Escape close it.
 */
export function ColorPickerPopover({
  anchor,
  color,
  onChange,
  onClose,
}: {
  anchor: React.RefObject<HTMLElement | null>
  color: string | null
  onChange: (hex: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<"tokens" | "custom">("custom")
  const [query, setQuery] = useState("")
  const [hsva, setHsva] = useState<Hsva>(() => hexToHsva(color ?? "#ffffff"))
  /** The hex this picker last sent: a different `color` came from elsewhere (e.g. the hex field). */
  const sent = useRef<string | null>(color)
  useEffect(() => {
    if (color && color.toLowerCase() !== sent.current?.toLowerCase()) {
      sent.current = color
      setHsva(hexToHsva(color))
    }
  }, [color])

  function apply(next: Hsva) {
    setHsva(next)
    const hex = toHex(next)
    sent.current = hex
    onChange(hex)
  }

  // Placed in the screen root's layout px, under the anchor; re-measured every frame while open
  // (the panel can scroll, the screen can resize).
  const popoverRef = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const root = anchor.current?.closest("[data-hero-root]") ?? null
    setHost(root)
    let frame = 0
    const measure = () => {
      const el = anchor.current
      if (el && root) {
        const r = el.getBoundingClientRect()
        const base = root.getBoundingClientRect()
        const k = screenScale(root)
        const left = Math.min((r.left - base.left) / k, base.width / k - POPOVER_WIDTH - 8)
        // Below the anchor; flipped above it when that would run past the screen's bottom (short screens).
        const below = (r.bottom - base.top) / k + POPOVER_GAP
        const popoverHeight = popoverRef.current?.offsetHeight ?? 0
        const top =
          below + popoverHeight > base.height / k - 8
            ? Math.max(8, (r.top - base.top) / k - POPOVER_GAP - popoverHeight)
            : below
        setPlace((p) => (p && p.left === left && p.top === top ? p : { left, top }))
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [anchor])

  // Outside presses (not on the anchor, which toggles it) and Escape close it.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || anchor.current?.contains(target)) return
      onCloseRef.current()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [anchor])

  const tokens = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? TOKENS.filter((t) => t.name.includes(q) || t.hex.includes(q)) : TOKENS
  }, [query])
  const currentRgb = rgbHex(hsva)

  if (!host || !place) return null
  return createPortal(
    <div
      ref={popoverRef}
      data-cursor-id="fill-picker"
      role="dialog"
      aria-label="Colour picker"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-40 flex flex-col gap-2 rounded-xl border border-stone-700/10 bg-[#f5f5f4] p-1.5 shadow-[0_12px_32px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ left: place.left, top: place.top, width: POPOVER_WIDTH }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 text-[13px]">
        {(["tokens", "custom"] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex h-7 items-center rounded-md px-2.5 transition-colors",
              tab === id ? "bg-stone-200 text-stone-900" : "text-stone-500 hover:text-stone-800",
            )}
          >
            {id === "tokens" ? "Design Tokens" : "Custom"}
          </button>
        ))}
      </div>

      {tab === "tokens" ? (
        <>
          <label className="flex h-7 items-center gap-2 rounded-md bg-stone-200/80 px-2 text-[13px] text-stone-500">
            <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search design tokens"
              className="min-w-0 flex-1 select-text bg-transparent text-stone-900 outline-none placeholder:text-stone-500"
            />
          </label>
          <ul className="-mx-0.5 flex max-h-[300px] flex-col overflow-y-auto px-0.5">
            {tokens.map((token) => {
              const selected = token.hex === currentRgb.toLowerCase() && hsva.a >= 1
              return (
                <li key={token.name}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => apply(hexToHsva(token.hex))}
                    className={cn(
                      "flex h-[30px] w-full items-center gap-3 rounded-md px-1.5 text-left text-[13px] font-medium text-stone-900 transition-colors",
                      selected ? "bg-[#2f6bf6]/10" : "hover:bg-stone-200/70",
                    )}
                  >
                    <span className="size-4 shrink-0 rounded-[4px] border border-stone-700/10" style={{ background: token.hex }} />
                    {token.name}
                  </button>
                </li>
              )
            })}
            {tokens.length === 0 && <li className="px-1.5 py-2 text-[13px] text-stone-500">No tokens match.</li>}
          </ul>
        </>
      ) : (
        <CustomPicker hsva={hsva} onChange={apply} />
      )}
    </div>,
    host,
  )
}

/** "Custom": colour area, eyedropper, hue and opacity sliders, then the hex and opacity fields. */
function CustomPicker({ hsva, onChange }: { hsva: Hsva; onChange: (next: Hsva) => void }) {
  const area = useTrack((x, y) => onChange({ ...hsva, s: x, v: 1 - y }))
  const hue = useTrack((x) => onChange({ ...hsva, h: Math.min(359.9, x * 360) }))
  const alpha = useTrack((x) => onChange({ ...hsva, a: Math.round(x * 100) / 100 }))
  const pure = rgbHex({ h: hsva.h, s: 1, v: 1, a: 1 })
  const rgb = rgbHex(hsva)
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null)
  const EyeDropper = typeof window !== "undefined" ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined

  return (
    <div className="flex flex-col gap-3 px-1 pb-1">
      {/* Saturation (left → right) and brightness (top → bottom) of the current hue */}
      <div
        {...area}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={rgb}
        aria-valuenow={Math.round(hsva.s * 100)}
        tabIndex={0}
        className="relative h-[200px] cursor-crosshair touch-none rounded-md"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }}
      >
        <Handle className="size-3.5 rounded-full" style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%`, background: rgb }} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Pick a colour from the screen"
          disabled={!EyeDropper}
          onClick={async () => {
            if (!EyeDropper) return
            try {
              const { sRGBHex } = await new EyeDropper().open()
              onChange({ ...hexToHsva(sRGBHex), a: hsva.a })
            } catch {
              // Cancelled.
            }
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-700 hover:bg-stone-200 disabled:opacity-40"
        >
          <Pipette className="size-4" strokeWidth={1.5} />
        </button>
        <div className="flex flex-1 flex-col gap-2.5">
          {/* Hue */}
          <div
            {...hue}
            role="slider"
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsva.h)}
            tabIndex={0}
            className="relative h-3 cursor-pointer touch-none rounded-[3px]"
            style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
          >
            <Handle className="top-1/2 h-4 w-2 rounded-[3px]" style={{ left: `${(hsva.h / 360) * 100}%`, background: pure }} />
          </div>
          {/* Opacity */}
          <div
            {...alpha}
            role="slider"
            aria-label="Opacity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsva.a * 100)}
            tabIndex={0}
            className="relative h-3 cursor-pointer touch-none rounded-[3px]"
            style={{ background: `linear-gradient(to right, transparent, ${rgb}), ${CHECKERBOARD}` }}
          >
            <Handle className="top-1/2 h-4 w-2 rounded-[3px]" style={{ left: `${hsva.a * 100}%`, background: rgb }} />
          </div>
        </div>
      </div>

      {/* Hex + opacity */}
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex shrink-0 items-center gap-1.5 pl-1 pr-1 text-stone-700">
          HEX
          <ChevronDown className="size-3 text-stone-400" strokeWidth={1.5} />
        </span>
        <input
          aria-label="Hex"
          spellCheck={false}
          maxLength={7}
          value={hexDraft ?? rgb}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const next = e.target.value
            setHexDraft(next)
            if (HEX6.test(next)) onChange({ ...hexToHsva(next.startsWith("#") ? next : `#${next}`), a: hsva.a })
          }}
          onBlur={() => setHexDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          className="h-8 min-w-0 flex-1 select-text rounded-md border border-stone-300 bg-white px-2 font-mono text-[13px] text-stone-900 outline-none selection:bg-mi-lime/70 focus:border-[#2f6bf6] focus:shadow-[0_0_0_1px_#2f6bf6]"
        />
        <label className="flex h-8 w-[60px] shrink-0 items-center gap-1 rounded-md bg-stone-200/80 pl-2 pr-2 tabular-nums">
          <input
            aria-label="Opacity percent"
            inputMode="numeric"
            value={opacityDraft ?? String(Math.round(hsva.a * 100))}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9]/g, "").slice(0, 3)
              setOpacityDraft(next)
              if (next !== "") onChange({ ...hsva, a: Math.min(100, Number(next)) / 100 })
            }}
            onBlur={() => setOpacityDraft(null)}
            className="w-full min-w-0 select-text bg-transparent text-right text-stone-900 outline-none"
          />
          <span className="text-stone-500">%</span>
        </label>
      </div>
    </div>
  )
}
