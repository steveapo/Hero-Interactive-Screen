import { BUILT_FILE_PATH, type EventCardStyle } from "./agent-script"
import type { VariantState } from "./build-agents"
import type { ChangedFile, DiffRow } from "./code-changes-popover"

/** Line the event card styles start at in BUILT_FILE_PATH (for the diff's line numbers). */
const FIRST_LINE = 41

const STYLE_KEYS: (keyof EventCardStyle)[] = ["card", "header", "title", "lines", "duration", "number", "unit", "unitText"]

/**
 * The code change behind a built variant: its source card's style object, before → after, as a
 * split diff. Unchanged keys stay as context lines.
 */
export function builtVariantChange(variant: VariantState): ChangedFile {
  const { source, spec } = variant
  const constName = `${source.title.toUpperCase().replace(/\s+/g, "_")}_CARD`
  const rows: DiffRow[] = []
  let left = FIRST_LINE
  let right = FIRST_LINE
  const context = (text: string) => rows.push([{ n: left++, text, kind: "context" }, { n: right++, text, kind: "context" }])

  context(`export const ${constName}: EventCardStyle = {`)
  let added = 0
  let removed = 0
  for (const key of STYLE_KEYS) {
    const before = source.base[key]
    const after = spec.style[key] ?? before
    if (before === undefined && after === undefined) continue
    const line = (value: string | undefined) => `  ${key}: "${value ?? ""}",`
    if (before === after) {
      context(line(before))
    } else if (before === undefined) {
      rows.push([null, { n: right++, text: line(after), kind: "add" }])
      added++
    } else {
      rows.push([
        { n: left++, text: line(before), kind: "del" },
        { n: right++, text: line(after), kind: "add" },
      ])
      added++
      removed++
    }
  }
  context("}")

  return { path: BUILT_FILE_PATH, added, removed, diff: rows }
}
