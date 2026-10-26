import { Heart, MapIcon, SlidersHorizontal, Search, Star, TreePine, Waves } from "lucide-react"
import { LISTINGS } from "@/app/copy-project/airbnb-data"

/*
 * The Fairbnb app's own design-system components, as the Components library shows them (the
 * "fairbnb" library, see HeroScreen's `componentLibrary`). Same shape as COMPONENT_PREVIEWS, but
 * drawn in the live app's look: brand plum, ink #222222, soft #dddddd borders, pill shapes.
 * "Badge" is the insertable one (see INSERTABLE_COMPONENTS): its tile is the Guest favorite pill
 * that lands in the frame.
 */

const PLUM = "#8e4585"
const INK = "#222222"
const MUTED = "#6a6a6a"

export const FAIRBNB_COMPONENT_PREVIEWS: { name: string; preview: React.ReactNode }[] = [
  {
    name: "Badge",
    preview: (
      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap text-[#222222] shadow-[0_1px_6px_rgba(0,0,0,0.18)]">
        Guest favorite
      </span>
    ),
  },
  {
    name: "Button",
    preview: (
      <span
        className="rounded-lg px-4 py-2 text-[12px] font-semibold leading-none text-white"
        style={{ background: `linear-gradient(90deg, ${PLUM}, #b0569f)` }}
      >
        Reserve
      </span>
    ),
  },
  {
    name: "ListingCard",
    preview: (
      <div className="flex w-[104px] flex-col gap-1">
        <div className="relative h-[34px] overflow-hidden rounded-md bg-stone-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LISTINGS[0].photo} alt="" className="size-full object-cover" style={{ objectPosition: LISTINGS[0].focus }} />
          <Heart className="absolute right-1 top-1 size-2.5 fill-black/40 text-white" strokeWidth={2} />
        </div>
        <div className="flex items-center justify-between text-[7px] leading-none font-semibold" style={{ color: INK }}>
          <span className="truncate">{LISTINGS[0].title}</span>
          <span className="flex shrink-0 items-center gap-0.5">
            <Star className="size-[7px] fill-current" /> {LISTINGS[0].rating}
          </span>
        </div>
      </div>
    ),
  },
  {
    name: "SearchBar",
    preview: (
      <div className="flex h-7 w-[118px] items-center rounded-full border border-[#dddddd] bg-white pl-2.5 pr-0.5 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <span className="flex-1 truncate text-[9px] font-semibold" style={{ color: INK }}>
          Anywhere
        </span>
        <span className="flex size-5 items-center justify-center rounded-full text-white" style={{ background: PLUM }}>
          <Search className="size-2.5" strokeWidth={3} />
        </span>
      </div>
    ),
  },
  {
    name: "CategoryTab",
    preview: (
      <div className="flex items-end gap-3">
        <span className="flex flex-col items-center gap-1 text-[9px] font-semibold" style={{ color: INK }}>
          <TreePine className="size-4" strokeWidth={1.5} />
          Cabins
          <span className="h-[2px] w-full rounded-full" style={{ background: INK }} />
        </span>
        <span className="flex flex-col items-center gap-1 pb-[6px] text-[9px] font-medium" style={{ color: MUTED }}>
          <Waves className="size-4" strokeWidth={1.5} />
          Beach
        </span>
      </div>
    ),
  },
  {
    name: "HostAvatar",
    preview: (
      <span className="relative flex size-9 items-center justify-center rounded-full bg-[#222222] text-[12px] font-semibold text-white">
        M
        <span
          className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full border-2 border-white"
          style={{ background: PLUM }}
        >
          <Star className="size-[6px] fill-white text-white" />
        </span>
      </span>
    ),
  },
  {
    name: "Price",
    preview: (
      <span className="text-[12px] leading-none" style={{ color: INK }}>
        <span className="font-semibold">{LISTINGS[0].price}</span> night
      </span>
    ),
  },
  {
    name: "Rating",
    preview: (
      <span className="flex items-center gap-1 text-[12px] font-semibold leading-none" style={{ color: INK }}>
        <Star className="size-3 fill-current" /> 4.92
        <span className="font-normal" style={{ color: MUTED }}>
          · 128 reviews
        </span>
      </span>
    ),
  },
  {
    name: "WishlistHeart",
    preview: <Heart className="size-6 text-white" strokeWidth={2} style={{ fill: PLUM }} />,
  },
  {
    name: "FilterButton",
    preview: (
      <span
        className="flex h-8 items-center gap-1.5 rounded-xl border border-[#dddddd] bg-white px-3 text-[10px] font-semibold"
        style={{ color: INK }}
      >
        <SlidersHorizontal className="size-3" strokeWidth={2} />
        Filters
      </span>
    ),
  },
  {
    name: "MapButton",
    preview: (
      <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#222222] px-3 text-[10px] font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.25)]">
        Show map
        <MapIcon className="size-3" strokeWidth={2} />
      </span>
    ),
  },
]
