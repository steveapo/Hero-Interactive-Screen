"use client"

import { useState } from "react"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Ellipsis } from "lucide-react"
import { TEXT_FONT_SIZE, TEXT_LINE_HEIGHT } from "./canvas-elements"
import {
  AppearanceSection,
  ColorField,
  Field,
  FillSection,
  Glyph,
  IconButton,
  LayoutSection,
  NO_SIDES,
  PositionSection,
  px,
  Row,
  Section,
  SettingsPanelShell,
  SideButton,
  SizeSection,
} from "./frame-settings-panel"

type TextAlign = "left" | "center" | "right" | "justify"
type VerticalAlign = "top" | "middle" | "bottom"

const TEXT_ALIGNS: { id: TextAlign; label: string; icon: typeof AlignLeft }[] = [
  { id: "left", label: "Align left", icon: AlignLeft },
  { id: "center", label: "Align center", icon: AlignCenter },
  { id: "right", label: "Align right", icon: AlignRight },
  { id: "justify", label: "Justify", icon: AlignJustify },
]

const VERTICAL_ALIGNS: { id: VerticalAlign; label: string; icon: () => React.JSX.Element }[] = [
  { id: "top", label: "Align top", icon: AlignTopIcon },
  { id: "middle", label: "Align middle", icon: AlignMiddleIcon },
  { id: "bottom", label: "Align bottom", icon: AlignBottomIcon },
]

/** Canvas text: Tailwind `text-base` in the app's sans (Inter) on `stone-950`, normal weight. */
const TEXT_FONT = "Inter"
const TEXT_WEIGHT = 400
const TEXT_COLOR = "#0c0a09"

/**
 * Right-side settings for a selected text element. Text sits on the canvas absolutely, pinned
 * left / top at its position, and hugs its content.
 */
export function TextSettingsPanel({
  ref,
  x,
  y,
  width,
  height,
}: {
  ref?: React.Ref<HTMLElement>
  /** Top-left position relative to the Codebase frame's top-left, in canvas units. */
  x: number
  y: number
  /** Measured (hugged) size in canvas units. */
  width: number
  height: number
}) {
  const [align, setAlign] = useState<TextAlign>("left")
  const [verticalAlign, setVerticalAlign] = useState<VerticalAlign>("top")

  return (
    <SettingsPanelShell ref={ref} icon={<TextGlyph />} title="div">
      <PositionSection position="absolute" inset={{ left: x, top: y, right: null, bottom: null }} x={x} y={y} />
      <SizeSection width="Hug" height="Hug" hugged={{ w: width, h: height }} />
      <LayoutSection layout="freeform" padding={NO_SIDES} clip={false} paddingPerSide />
      <AppearanceSection radius={null} />

      <Section title="Typography">
        <Row side={<SideButton label="Font as code" icon={<CodeIcon />} plain />}>
          <Field label="Font" strongLabel name="Font family" value={TEXT_FONT} chevron className="col-span-2" />
        </Row>
        <Row>
          <Field label="Size" strongLabel name="Font size" value={px(TEXT_FONT_SIZE)} className="col-span-2" />
        </Row>
        <Row>
          <Field label="Weight" strongLabel name="Font weight" value={String(TEXT_WEIGHT)} className="col-span-2" />
        </Row>
        <Row>
          <ColorField name="Text" color={TEXT_COLOR} className="col-span-2" />
        </Row>
        <Row>
          <Field label={<LineHeightIcon />} name="Line height" value={px(TEXT_LINE_HEIGHT)} chevron />
          <Field label={<LetterSpacingIcon />} name="Letter spacing" value="normal" chevron />
        </Row>
        <Row side={<SideButton label="More typography options" icon={<Ellipsis className="size-3.5" strokeWidth={1.5} />} plain />}>
          <div role="radiogroup" aria-label="Text align" className="flex h-7 items-stretch rounded-md bg-stone-200/70 text-stone-700">
            {TEXT_ALIGNS.map(({ id, label, icon: Icon }) => (
              <IconButton key={id} label={label} active={align === id} onClick={() => setAlign(id)}>
                <Icon className="size-3.5" strokeWidth={1.25} />
              </IconButton>
            ))}
          </div>
          <div role="radiogroup" aria-label="Vertical align" className="flex h-7 items-stretch rounded-md bg-stone-200/70 text-stone-700">
            {VERTICAL_ALIGNS.map(({ id, label, icon: Icon }) => (
              <IconButton
                key={id}
                label={label}
                align={id === "bottom" ? "end" : "center"}
                active={verticalAlign === id}
                onClick={() => setVerticalAlign(id)}
              >
                <Icon />
              </IconButton>
            ))}
          </div>
        </Row>
      </Section>

      {/* canvas text has no background */}
      <FillSection fill={null} />
    </SettingsPanelShell>
  )
}

/* --------------------------------- Icons ---------------------------------- */

/** Same glyph as the toolbar's Text tool. */
export function TextGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 1v12" />
      <path d="M4.5 13h5" />
      <path d="M1 3.5V2c0-.55.45-1 1-1h10c.55 0 1 .45 1 1v1.5" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <Glyph>
      <path d="M5 3.5 1.5 7 5 10.5M9 3.5l3.5 3.5L9 10.5" />
    </Glyph>
  )
}

function LineHeightIcon() {
  return (
    <Glyph>
      <path d="M2.5 1.5h9" />
      <path d="M4 12.5 7 4.5l3 8M5.1 9.75h3.8" />
    </Glyph>
  )
}

function LetterSpacingIcon() {
  return (
    <Glyph>
      <path d="M1.5 2.5v9M12.5 2.5v9" />
      <path d="M4.5 11 7 4l2.5 7M5.4 8.75h3.2" />
    </Glyph>
  )
}

function AlignTopIcon() {
  return (
    <Glyph>
      <path d="M2 1.5h10M7 12.5V4.5M4.5 7 7 4.5 9.5 7" />
    </Glyph>
  )
}

function AlignMiddleIcon() {
  return (
    <Glyph>
      <path d="M2 7h10M7 1v3.5M5.5 3 7 4.5 8.5 3M7 13V9.5M5.5 11 7 9.5 8.5 11" />
    </Glyph>
  )
}

function AlignBottomIcon() {
  return (
    <Glyph>
      <path d="M2 12.5h10M7 1.5v8M4.5 7 7 9.5 9.5 7" />
    </Glyph>
  )
}
