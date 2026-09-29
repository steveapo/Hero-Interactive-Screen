// Static content for the hero canvas shell (Stage 1).
// Frame contents are placeholders — Stage 2 replaces them with high-fidelity sample content.

export const BOARD_WIDTH = 1440
export const BOARD_HEIGHT = 900

export type FrameId = "portal" | "desktop" | "mobile"
export type FrameKind = "portal" | "desktop" | "mobile"

export type CanvasFrame = {
  id: FrameId
  kind: FrameKind
  name: string
  /** Where the frame's code lives — shown in the inspector and composer context. */
  component: string
  source: string
  x: number
  y: number
  w: number
  h: number
}

export const INITIAL_FRAMES: CanvasFrame[] = [
  {
    id: "portal",
    kind: "portal",
    name: "Live · /checkout",
    component: "CheckoutPage",
    source: "app/checkout/page.tsx",
    x: 284,
    y: 92,
    w: 392,
    h: 254,
  },
  {
    id: "desktop",
    kind: "desktop",
    name: "Checkout — Desktop",
    component: "CheckoutSummary",
    source: "components/checkout/summary.tsx",
    x: 712,
    y: 92,
    w: 420,
    h: 268,
  },
  {
    id: "mobile",
    kind: "mobile",
    name: "Checkout — Mobile",
    component: "CheckoutSummary",
    source: "components/checkout/summary.tsx",
    x: 284,
    y: 404,
    w: 156,
    h: 320,
  },
]

export type Collaborator = { name: string; initial: string; color: string }

export const COLLABORATORS: Collaborator[] = [
  { name: "Tereza", initial: "T", color: "#f97316" },
  { name: "Martin", initial: "M", color: "#8b5cf6" },
  { name: "Quentin", initial: "Q", color: "#0ea5e9" },
]

export const DESIGN_COMPONENTS = [
  "Button",
  "Card",
  "Input",
  "Badge",
  "Select",
  "Avatar",
  "Switch",
  "Table",
]

export type DiffLine = { kind: "context" | "add" | "remove"; text: string }

export const DIFF_FILES: { path: string; added: number; removed: number }[] = [
  { path: "components/checkout/summary.tsx", added: 11, removed: 5 },
  { path: "components/ui/button.tsx", added: 3, removed: 1 },
]

export const DIFF_LINES: DiffLine[] = [
  { kind: "context", text: 'import { Button } from "@/components/ui/button"' },
  { kind: "context", text: 'import { Card } from "@/components/ui/card"' },
  { kind: "context", text: "" },
  { kind: "context", text: "export function CheckoutSummary() {" },
  { kind: "context", text: "  return (" },
  { kind: "remove", text: '    <Card className="p-4 gap-2">' },
  { kind: "add", text: '    <Card className="p-6 gap-4 rounded-lg">' },
  { kind: "remove", text: '      <h3 className="text-sm">Order</h3>' },
  { kind: "add", text: '      <h3 className="text-body-sm font-medium">' },
  { kind: "add", text: "        Order summary" },
  { kind: "add", text: "      </h3>" },
  { kind: "context", text: "      <LineItems items={items} />" },
  { kind: "remove", text: '      <Button variant="ghost">Pay</Button>' },
  { kind: "add", text: '      <Button variant="solid" size="lg">' },
  { kind: "add", text: "        Pay {total}" },
  { kind: "add", text: "      </Button>" },
  { kind: "context", text: "    </Card>" },
  { kind: "context", text: "  )" },
  { kind: "context", text: "}" },
]
