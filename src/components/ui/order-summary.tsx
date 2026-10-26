import * as React from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

type OrderSummaryItem = {
  initials: string
  name: string
  qty: number
  price: string
}

const DEFAULT_ITEMS: OrderSummaryItem[] = [
  { initials: "OC", name: "Organic Cotton Tee", qty: 1, price: "$32.00" },
  { initials: "SM", name: "Stoneware Mug", qty: 2, price: "$36.00" },
]

type OrderSummaryProps = React.ComponentProps<"div"> & {
  title?: string
  items?: OrderSummaryItem[]
  subtotalLabel?: string
  subtotal?: string
  shippingLabel?: string
  shippingMethod?: string
  shipping?: string
  total?: string
  ctaLabel?: string
  note?: string
}

/**
 * The demo store's order summary: line items, subtotal and shipping, the total, and the checkout
 * button. The button is `data-layer="checkout-button"`; its padding reads --layer-padding-x / -y
 * (falling back to 24px / 12px), so a canvas frame can drive it as its padding layer.
 */
function OrderSummary({
  title = "Order summary",
  items = DEFAULT_ITEMS,
  subtotalLabel = "Subtotal · 3 items",
  subtotal = "$68.00",
  shippingLabel = "Shipping",
  shippingMethod = "Standard",
  shipping = "Free",
  total = "$68.00",
  ctaLabel = "Continue to shipping",
  note = "You won't be charged yet",
  className,
  ...props
}: OrderSummaryProps) {
  return (
    <div
      data-slot="order-summary"
      className={cn(
        "flex size-full flex-col border-[3px] border-card-foreground bg-background py-9 text-[21px] text-card-foreground shadow-[12px_12px_0_0_var(--color-card-foreground)]",
        className
      )}
      {...props}
    >
      <div className="px-9 pb-6">
        <h3 className="font-heading text-[33px] font-black uppercase leading-[1.43]">{title}</h3>
      </div>
      <div className="flex flex-col gap-6 px-9">
        <ul className="flex flex-col gap-4.5">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-4.5">
              <div
                aria-hidden="true"
                className="flex size-16.5 shrink-0 items-center justify-center border-[3px] border-card-foreground bg-card-foreground text-[21px] font-semibold tracking-tight text-background"
              >
                {item.initials}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[21px] font-medium">{item.name}</p>
                <p className="text-[18px] text-muted-foreground">Qty {item.qty}</p>
              </div>
              <span className="shrink-0 text-[21px] tabular-nums">{item.price}</span>
            </li>
          ))}
        </ul>
        <div className="my-1.5 h-px bg-border" />
        <dl className="flex flex-col gap-3.75 text-[21px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{subtotalLabel}</dt>
            <dd className="tabular-nums">{subtotal}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {shippingLabel}
              {shippingMethod && <span className="opacity-70"> · {shippingMethod}</span>}
            </dt>
            <dd className="tabular-nums">{shipping}</dd>
          </div>
        </dl>
        <div className="my-1.5 h-px bg-border" />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total</span>
          <span className="text-[60px] font-black leading-[63px] tabular-nums">{total}</span>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-3 px-9 pt-7.5">
        <div
          data-layer="checkout-button"
          className="pointer-events-auto flex w-full shrink-0 select-none items-center justify-center gap-2.25 whitespace-nowrap border-[3px] border-card-foreground bg-primary text-[21px] font-bold leading-[30px] text-primary-foreground shadow-[4.5px_4.5px_0_0_var(--color-card-foreground)]"
          style={{ padding: "var(--layer-padding-y, 12px) var(--layer-padding-x, 24px)" }}
        >
          {ctaLabel}
          <ArrowRight className="size-6" />
        </div>
        {note && <p className="text-center text-[18px] text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}

export { OrderSummary, type OrderSummaryItem, type OrderSummaryProps }
