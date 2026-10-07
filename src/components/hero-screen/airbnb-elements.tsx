import { Heart } from "lucide-react"
import {
  BecomeHostLink,
  CATEGORIES,
  CategoryBar,
  CategoryItem,
  CheckInTile,
  DirectionsButton,
  FiltersButton,
  GlobeButton,
  GuestFavoritePill,
  ListingCard,
  ListingPhoto,
  Logo,
  LogoMark,
  MapButton,
  NightsNumeral,
  PhotoDots,
  Price,
  Rating,
  SearchButton,
  SearchHeader,
  SearchPill,
  SectionHead,
  SelfCheckInPill,
  TripCard,
  UserMenu,
} from "@/app/copy-project/airbnb-screen"
import {
  CHECK_IN_WIDTH,
  COLUMN,
  HAIRLINE,
  INK,
  LAYOUT,
  LISTING_HEIGHT,
  LISTINGS,
  LOGO_RED,
  MUTED,
  RAUSCH,
  TRIP,
  TRIP_CARD_WIDTH,
  WHITE,
  type Listing,
} from "@/app/copy-project/airbnb-data"
import { CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"
import {
  CheckoutScreen,
  HostTodayScreen,
  InboxScreen,
  ListingDetailScreen,
  SearchMapScreen,
  TripsScreen,
  WishlistsScreen,
} from "./airbnb-explorations"
import type { CanvasRect } from "./drag"
import type { CssPosition, Insets, LayoutMode, Sides } from "./frame-settings-panel"

/**
 * The Fairbnb desktop app taken apart: one static design frame per element of the live app in the
 * Codebase frame. Each frame renders the app's own component at the size it's painted at (cqw of
 * the 1440-wide desktop screen), so the frames and the live app can't drift apart, and the
 * settings panel reads the real values.
 */

/** 1cqw of the desktop screen, in canvas units. */
const CQW = CODEBASE_WIDTH / 100
const BORDER_GREY = "#dddddd"
const PHOTO_DARK = "#2b2b2b"

export type AppElement = {
  id: string
  name: string
  /** Position (centre, canvas units, relative to the Codebase frame's centre) and natural size. */
  rect: CanvasRect
  /** Fill colour; null = no fill. */
  fill: string | null
  /** Corner radius in canvas units; null = none. */
  radius: number | null
  /** 1px border colour; null = none. */
  border: string | null
  /** The artwork paints its own shape (a card with its own shadow): the frame itself stays transparent. */
  bare?: boolean
  /** Only show the frame's name on the canvas while it is selected. */
  labelOnSelect?: boolean
  /**
   * The card's title in the live app, for cards that library components can be dropped onto:
   * built components land on the card carrying this title.
   */
  cardTitle?: string
  /**
   * A whole screen the designer is exploring, further out on the canvas (see
   * airbnb-explorations). Generated variants are placed below the app's own elements, not
   * below these.
   */
  exploration?: boolean
  /* What the settings panel reads — the element's CSS in the live app. */
  /** Tag of the element in the app (default "div"). */
  tag?: string
  /** CSS position (default static). */
  position?: CssPosition
  /** Insets of an absolutely positioned element. */
  inset?: Insets
  /** Flex row / column etc. (default freeform). */
  layout?: LayoutMode
  /** Padding in canvas px (default 0). */
  padding?: Sides
  /** overflow: hidden (default false). */
  clip?: boolean
  /** Every colour used inside the element (default its fill and border). */
  colors?: string[]
  /** Static artwork, authored in cqw of the desktop screen, at the frame's natural size. */
  content: React.ReactNode
}

/** Distinct colours, nulls dropped. */
function palette(...colors: (string | null)[]): string[] {
  return [...new Set(colors.filter((c): c is string => c !== null))]
}

/** Padding in canvas px from cqw sides. */
const cqwSides = (top: number, right: number, bottom: number, left: number): Sides => ({
  top: top * CQW,
  right: right * CQW,
  bottom: bottom * CQW,
  left: left * CQW,
})

/**
 * Every element's centre is pushed away from the Codebase frame's centre by this factor (sizes stay
 * the same), which widens the gaps to the Codebase and between the elements themselves.
 */
const LAYOUT_SPREAD = 1.25

/** A frame placed by its top-left corner (canvas units), which is how the layout below reads. */
function placed(left: number, top: number, w: number, h: number): CanvasRect {
  return { x: (left + w / 2) * LAYOUT_SPREAD, y: (top + h / 2) * LAYOUT_SPREAD, w, h }
}

/* --------------------------------- Layout --------------------------------- */
// Top-left corners in canvas units; the Codebase frame spans x −720…720, y −450…450.
// The header and categories above the Codebase, the trip card and check-in banner to its left,
// the small parts to its right, and the listings in a row below it. Smaller pieces of the header
// and categories gather top-left, pieces of the cards top-right and right. Just past them, a ring
// of whole screens (EXPLORATIONS_AT, centres) the designer is exploring.

const AT = {
  header: { left: -720, top: -800 },
  categories: { left: -720, top: -640 },
  trip: { left: -1250, top: -250 },
  tile: { left: -1520, top: 40 },
  searchButton: { left: 680, top: -300 },
  mapButton: { left: 900, top: -300 },
  logo: { left: 680, top: -100 },
  userMenu: { left: 900, top: -100 },
  heart: { left: 680, top: 100 },
  // header and category pieces
  searchPill: { left: -1560, top: -700 },
  becomeHost: { left: -1200, top: -700 },
  globe: { left: -1030, top: -700 },
  filters: { left: -920, top: -520 },
  belo: { left: -1500, top: 330 },
  // card pieces
  sectionTrip: { left: 760, top: -760 },
  sectionStays: { left: 760, top: -640 },
  numeral: { left: 1180, top: -780 },
  price: { left: 1180, top: -640 },
  guestFavorite: { left: 1100, top: -120 },
  rating: { left: 1300, top: -120 },
  dots: { left: 900, top: 100 },
  selfCheckIn: { left: 1100, top: 100 },
  directions: { left: 1300, top: 100 },
  listingPhoto: { left: 900, top: 260 },
}

/** Four of the categories as their own frames, in a row (top-left corners). */
const CATEGORY_PARTS: { label: string; at: { left: number; top: number }; selected?: boolean }[] = [
  { label: "Amazing views", at: { left: -1560, top: -520 }, selected: true },
  { label: "Arctic", at: { left: -1400, top: -520 } },
  { label: "Desert", at: { left: -1240, top: -520 } },
  { label: "Boats", at: { left: -1080, top: -520 } },
]

/**
 * Centres of the explored screens, each about 80 units clear of the nearest app element so
 * they hug the working cluster: three in a row above, two stacked down either side.
 * The lane straight below the app stays empty — generated variant rows land there.
 */
const EXPLORATIONS_AT = {
  listingDetail: { x: -1520, y: -1530 },
  searchMap: { x: 0, y: -1530 },
  checkout: { x: 1520, y: -1530 },
  inbox: { x: -2675, y: -150 },
  hostToday: { x: 2570, y: -150 },
  trips: { x: -2675, y: 830 },
  wishlists: { x: 2570, y: 830 },
}

/** Centres the listings 400 units apart (after the spread), alternately a little lower. */
const LISTINGS_AT: Record<string, { left: number; top: number }> = {
  vik: { left: -761, top: 480 },
  ciucas: { left: -441, top: 530 },
  yosemite: { left: -121, top: 480 },
  merzouga: { left: 199, top: 530 },
  stowe: { left: 519, top: 480 },
}

/* ---------------------------------- Bands ---------------------------------- */

function band(
  id: string,
  name: string,
  at: { left: number; top: number },
  heightCqw: number,
  content: React.ReactNode,
  style: Partial<AppElement> = {},
): AppElement {
  return {
    id,
    name,
    rect: placed(at.left, at.top, CODEBASE_WIDTH, heightCqw * CQW),
    fill: WHITE,
    radius: null,
    border: null,
    layout: "row",
    ...style,
    content,
  }
}

/* ---------------------------------- Cards ---------------------------------- */

function listingElement(listing: Listing): AppElement {
  const at = LISTINGS_AT[listing.id]
  return {
    id: `card-listing-${listing.id}`,
    name: `Listing — ${listing.title}`,
    cardTitle: listing.title,
    rect: placed(at.left, at.top, COLUMN * CQW, LISTING_HEIGHT * CQW),
    fill: null,
    radius: LAYOUT.radius * CQW,
    border: null,
    bare: true,
    // the listings sit close together, so their (long) names only show on selection
    labelOnSelect: true,
    position: "relative",
    layout: "column",
    colors: palette(INK, MUTED, WHITE, RAUSCH),
    content: <ListingCard listing={listing} />,
  }
}

/* ---------------------------------- Parts ---------------------------------- */

/** Centres a part in its frame, which hugs it. */
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center">{children}</div>
}

/** A single small part, placed by its top-left corner; sizes in cqw. */
function part(
  id: string,
  name: string,
  at: { left: number; top: number },
  wCqw: number,
  hCqw: number,
  content: React.ReactNode,
  style: Partial<Pick<AppElement, "fill" | "radius" | "tag" | "layout" | "colors">> = {},
): AppElement {
  return {
    id,
    name,
    rect: placed(at.left, at.top, wCqw * CQW, hCqw * CQW),
    ...style,
    fill: style.fill ?? null,
    radius: style.radius ?? null,
    border: null,
    content: <Centered>{content}</Centered>,
  }
}

/* -------------------------------- Screens --------------------------------- */

/** A whole explored screen, at the desktop viewport's size, placed by its centre. */
function exploration(id: string, name: string, at: { x: number; y: number }, content: React.ReactNode): AppElement {
  return {
    id,
    name: `Screen — ${name}`,
    rect: { x: at.x, y: at.y, w: CODEBASE_WIDTH, h: CODEBASE_HEIGHT },
    fill: WHITE,
    radius: 8,
    border: HAIRLINE,
    exploration: true,
    layout: "column",
    clip: true,
    colors: palette(WHITE, RAUSCH, INK, MUTED, HAIRLINE),
    content,
  }
}

/* -------------------------------- The set --------------------------------- */

export const AIRBNB_ELEMENTS: AppElement[] = [
  band("search-header", "Header", AT.header, LAYOUT.header, <SearchHeader />, {
    tag: "header",
    layout: "grid",
    padding: cqwSides(0, 4, 0, 4),
    colors: palette(WHITE, RAUSCH, INK, MUTED, BORDER_GREY, HAIRLINE),
  }),
  band("categories", "Categories", AT.categories, LAYOUT.categories, <CategoryBar />, {
    padding: cqwSides(0, 4, 0, 4),
    colors: palette(WHITE, INK, MUTED, BORDER_GREY),
  }),
  {
    id: "card-upcoming-trip",
    name: `Trip — ${TRIP.title}`,
    cardTitle: TRIP.title,
    rect: placed(AT.trip.left, AT.trip.top, TRIP_CARD_WIDTH * CQW, LAYOUT.tripRow * CQW),
    fill: WHITE,
    radius: LAYOUT.radius * CQW,
    border: HAIRLINE,
    // the card paints its own fill, border and shadow
    bare: true,
    layout: "column",
    padding: cqwSides(1.6, 1.6, 1.6, 1.6),
    colors: palette(WHITE, HAIRLINE, INK, MUTED, RAUSCH),
    content: <TripCard />,
  },
  {
    id: "check-in-tile",
    name: "Check-in Banner",
    rect: placed(AT.tile.left, AT.tile.top, CHECK_IN_WIDTH * CQW, LAYOUT.tripRow * CQW),
    fill: null,
    radius: LAYOUT.radius * CQW,
    border: null,
    position: "relative",
    clip: true,
    colors: palette(PHOTO_DARK, WHITE, INK),
    content: <CheckInTile />,
  },
  ...LISTINGS.map(listingElement),
  part("search-button", "Search Button", AT.searchButton, 2.8, 2.8, <SearchButton />, {
    fill: RAUSCH,
    radius: 1.4 * CQW,
    layout: "row",
    colors: palette(RAUSCH, WHITE),
  }),
  part("map-button", "Show Map Button", AT.mapButton, 10, 3, <MapButton />, {
    tag: "button",
    fill: INK,
    radius: 1.5 * CQW,
    layout: "row",
    colors: palette(INK, WHITE),
  }),
  part("logo", "Logo", AT.logo, 9.5, 2.4, <Logo />, { tag: "a", layout: "row", colors: palette(LOGO_RED) }),
  part("user-menu", "User Menu", AT.userMenu, 6.6, 3.2, <UserMenu />, {
    tag: "button",
    layout: "row",
    colors: palette(WHITE, INK, BORDER_GREY),
  }),
  part(
    "wishlist-heart",
    "Wishlist Heart",
    AT.heart,
    1.7,
    1.7,
    <Heart className="size-[1.7cqw]" fill="rgba(0,0,0,0.45)" stroke="#ffffff" strokeWidth={2} />,
    { tag: "button", colors: palette(WHITE, "#000000") },
  ),

  /* Header and category pieces */
  part("search-pill", "Search Pill", AT.searchPill, 25, 4, <SearchPill />, {
    fill: WHITE,
    radius: 2 * CQW,
    layout: "row",
    colors: palette(WHITE, BORDER_GREY, INK, MUTED, RAUSCH),
  }),
  part("become-host", "Become a Host", AT.becomeHost, 9, 2.4, <BecomeHostLink />, { tag: "a", colors: palette(INK) }),
  part("globe-button", "Globe Button", AT.globe, 2.8, 2.8, <GlobeButton />, {
    tag: "button",
    radius: 1.4 * CQW,
    colors: palette(INK),
  }),
  ...CATEGORY_PARTS.map(({ label, at, selected }) => {
    const category = CATEGORIES.find((c) => c.label === label) ?? CATEGORIES[0]
    const el = part(
      `category-${label.toLowerCase().replace(/\s+/g, "-")}`,
      `Category — ${label}`,
      at,
      7,
      4.4,
      <CategoryItem label={category.label} icon={category.icon} selected={selected} />,
      { tag: "button", layout: "column", colors: palette(selected ? INK : MUTED) },
    )
    // the categories sit close together, so their names only show on selection
    return { ...el, labelOnSelect: true }
  }),
  part("filters-button", "Filters Button", AT.filters, 7.6, 3.4, <FiltersButton />, {
    tag: "button",
    radius: 0.9 * CQW,
    layout: "row",
    colors: palette(INK, BORDER_GREY),
  }),
  part("belo", "Logo mark", AT.belo, 2.3, 2.3, <LogoMark className="size-[2.3cqw] text-[#7d3a75]" />, {
    tag: "svg",
    colors: palette(LOGO_RED),
  }),

  /* Card pieces */
  {
    ...part("section-trip", "Section — Your upcoming trip", AT.sectionTrip, 30, LAYOUT.sectionHead, null, {
      layout: "row",
      colors: palette(INK),
    }),
    // a section head spans its width (title left, action right), so it isn't centred
    content: <SectionHead title="Your upcoming trip" action="All trips" />,
  },
  {
    ...part("section-stays", "Section — Stays you might love", AT.sectionStays, 30, LAYOUT.sectionHead, null, {
      layout: "row",
      colors: palette(INK),
    }),
    content: <SectionHead title="Stays you might love" action="Show all" />,
  },
  part("nights-numeral", "Nights Numeral", AT.numeral, 8, 4, <NightsNumeral nights={TRIP.nights} />, {
    layout: "row",
    colors: palette(INK, RAUSCH),
  }),
  part("price", "Price", AT.price, 6, 1.6, <Price amount={LISTINGS[0].price} />, { tag: "p", colors: palette(INK) }),
  part("guest-favorite", "Guest Favorite Pill", AT.guestFavorite, 7.6, 1.8, <GuestFavoritePill />, {
    radius: 0.9 * CQW,
    colors: palette(WHITE, INK),
  }),
  part("rating", "Rating", AT.rating, 4, 1.4, <Rating value={LISTINGS[0].rating} />, {
    layout: "row",
    colors: palette(INK),
  }),
  part("photo-dots", "Photo Dots", AT.dots, 3.6, 1.2, <PhotoDots />, {
    // the dots are white over a photo: the frame shows them on the photo's dark
    fill: PHOTO_DARK,
    radius: 0.6 * CQW,
    layout: "row",
    colors: palette(WHITE),
  }),
  part("self-check-in", "Self Check-in Pill", AT.selfCheckIn, 8.6, 1.9, <SelfCheckInPill />, {
    radius: 0.95 * CQW,
    layout: "row",
    colors: palette(WHITE, INK),
  }),
  part("get-directions", "Get Directions Button", AT.directions, 8.8, 2.2, <DirectionsButton />, {
    tag: "button",
    fill: WHITE,
    radius: 0.6 * CQW,
    colors: palette(WHITE, INK),
  }),
  {
    id: "listing-photo",
    name: "Listing Photo",
    rect: placed(AT.listingPhoto.left, AT.listingPhoto.top, COLUMN * CQW, LAYOUT.photo * CQW),
    fill: null,
    radius: LAYOUT.radius * CQW,
    border: null,
    position: "relative",
    clip: true,
    colors: palette(WHITE, INK, RAUSCH),
    content: <ListingPhoto listing={LISTINGS[1]} />,
  },

  /* Screens being explored, further out */
  exploration("screen-listing-detail", "Listing detail", EXPLORATIONS_AT.listingDetail, <ListingDetailScreen />),
  exploration("screen-search-map", "Search with map", EXPLORATIONS_AT.searchMap, <SearchMapScreen />),
  exploration("screen-checkout", "Confirm and pay", EXPLORATIONS_AT.checkout, <CheckoutScreen />),
  exploration("screen-inbox", "Inbox", EXPLORATIONS_AT.inbox, <InboxScreen />),
  exploration("screen-host-today", "Host — Today", EXPLORATIONS_AT.hostToday, <HostTodayScreen />),
  exploration("screen-trips", "Trips", EXPLORATIONS_AT.trips, <TripsScreen />),
  exploration("screen-wishlists", "Wishlists", EXPLORATIONS_AT.wishlists, <WishlistsScreen />),
]
