"use client";

import { memo, useRef, useState } from "react";
import Image from "next/image";
import {
  Building2,
  Castle,
  Globe,
  Heart,
  KeyRound,
  Map as MapIcon,
  Menu,
  Mountain,
  Sailboat,
  Search,
  SlidersHorizontal,
  Snowflake,
  Star,
  Sun,
  Tent,
  TreePalm,
  TreePine,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { cn } from "./utils";
import { useAirbnbIntro } from "./use-airbnb-intro";
import {
  CHECK_IN_WIDTH,
  LAYOUT,
  LISTING_HEIGHT,
  LISTINGS,
  TRIP,
  TRIP_CARD_WIDTH,
  type Listing,
  type Trip,
} from "./airbnb-data";

/**
 * The Fairbnb desktop app (a 1440×900 viewport): the home page, with the upcoming trip pinned
 * above the recommendations. Everything is authored in container-query units (cqw), so the
 * whole UI scales with the window it's dropped into. The pieces are exported so the canvas can
 * show each one as its own frame, painted exactly like the live screen.
 */

const cqw = (value: number) => `${value}cqw`;

/* --------------------------------- Brand ---------------------------------- */

/** The logo mark: a fairground Ferris wheel whose A-frame stand doubles as a roof over an arched door. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* The wheel, its three spokes and the hub. */}
      <circle cx="12" cy="9.5" r="7" />
      <path d="M12 2.5v14M5.94 6l12.12 7M18.06 6 5.94 13" />
      <circle cx="12" cy="9.5" r="1" fill="currentColor" />
      {/* The A-frame stand, which reads as a roof, with an arched door beneath and the ground line. */}
      <path d="M12 9.5 6 21.2M12 9.5l6 11.7" />
      <path d="M10.2 21.2v-2a1.8 1.8 0 0 1 3.6 0v2" />
      <path d="M4 21.2h16" />
    </svg>
  );
}

/** Logo mark and wordmark, as in the site's header. */
export function Logo() {
  return (
    <span data-anim="logo" className="flex items-center gap-[0.45cqw] text-[#7d3a75]">
      <LogoMark className="size-[2.3cqw]" />
      <span className="text-[1.75cqw] leading-none font-bold tracking-[-0.045em]">fairbnb</span>
    </span>
  );
}

/* --------------------------------- Header --------------------------------- */

const SEARCH_FIELDS = [
  { label: "Anywhere", strong: true },
  { label: "Any week", strong: true },
  { label: "Add guests", strong: false },
];

/** The Rausch disc at the end of the search pill. */
export function SearchButton() {
  return (
    <span
      data-anim="search-button"
      className="flex size-[2.8cqw] shrink-0 items-center justify-center rounded-full bg-[#8e4585] text-white"
    >
      <Search className="size-[1.1cqw]" strokeWidth={3} />
    </span>
  );
}

export function SearchPill() {
  return (
    <div
      data-anim="search-pill"
      className="flex h-[4cqw] items-center rounded-full border border-[#dddddd] bg-white pr-[0.6cqw] pl-[0.5cqw] shadow-[0_0.1cqw_0.6cqw_rgba(0,0,0,0.08)]"
    >
      {SEARCH_FIELDS.map((field, index) => (
        <div key={field.label} className="flex items-center">
          {index > 0 && <span className="h-[1.7cqw] w-px bg-[#dddddd]" />}
          <span
            data-anim="search-field"
            className={cn(
              "px-[1.1cqw] text-[0.98cqw] leading-none whitespace-nowrap",
              field.strong ? "font-semibold text-[#222222]" : "text-[#6a6a6a]",
            )}
          >
            {field.label}
          </span>
        </div>
      ))}
      <SearchButton />
    </div>
  );
}

/** Menu + avatar: the account menu on the right of the header. */
export function UserMenu() {
  return (
    <span
      data-anim="avatar"
      className="flex h-[3cqw] items-center gap-[0.8cqw] rounded-full border border-[#dddddd] pr-[0.35cqw] pl-[0.9cqw] text-[#222222]"
    >
      <Menu className="size-[1.1cqw]" strokeWidth={2.2} />
      <img
        src="/avatars/user.webp"
        alt="Your profile"
        draggable={false}
        className="size-[2.3cqw] rounded-full object-cover"
      />
    </span>
  );
}

export function SearchHeader() {
  return (
    <header
      className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#ebebeb] bg-white px-[4cqw]"
      style={{ height: cqw(LAYOUT.header) }}
    >
      <Logo />
      <SearchPill />
      <div className="flex items-center justify-end gap-[0.4cqw] text-[#222222]">
        <BecomeHostLink />
        <GlobeButton />
        <span data-anim="nav-item" className="ml-[0.3cqw]">
          <UserMenu />
        </span>
      </div>
    </header>
  );
}

export function BecomeHostLink() {
  return (
    <span
      data-anim="nav-item"
      className="rounded-full px-[0.9cqw] py-[0.7cqw] text-[0.98cqw] leading-none font-semibold whitespace-nowrap text-[#222222]"
    >
      Become a host
    </span>
  );
}

export function GlobeButton() {
  return (
    <span data-anim="nav-item" className="flex size-[2.8cqw] items-center justify-center rounded-full text-[#222222]">
      <Globe className="size-[1.15cqw]" strokeWidth={2} />
    </span>
  );
}

/* ------------------------------- Categories ------------------------------- */

export const CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: "Amazing views", icon: Mountain },
  { label: "Beachfront", icon: TreePalm },
  { label: "Cabins", icon: TreePine },
  { label: "Arctic", icon: Snowflake },
  { label: "Desert", icon: Sun },
  { label: "Camping", icon: Tent },
  { label: "Castles", icon: Castle },
  { label: "Boats", icon: Sailboat },
  { label: "Countryside", icon: Wheat },
  { label: "Iconic cities", icon: Building2 },
];

/** One category: icon over label; the selected one is ink with an underline. */
export function CategoryItem({
  label,
  icon: Icon,
  selected = false,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      data-anim="category"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex h-full cursor-pointer flex-col items-center justify-center gap-[0.5cqw] transition-colors duration-200",
        selected ? "text-[#222222]" : "text-[#6a6a6a] hover:text-[#222222]",
      )}
    >
      <Icon className="size-[1.7cqw]" strokeWidth={selected ? 1.9 : 1.6} />
      <span className={cn("text-[0.85cqw] leading-[1.1cqw] whitespace-nowrap", selected ? "font-semibold" : "font-medium")}>
        {label}
      </span>
      {selected && (
        <span
          data-anim="category-underline"
          className="absolute inset-x-0 bottom-[0.6cqw] h-[0.15cqw] origin-left rounded-full bg-[#222222]"
        />
      )}
    </button>
  );
}

export function FiltersButton() {
  return (
    <span
      data-anim="category"
      className="flex h-[3.4cqw] items-center gap-[0.6cqw] self-center rounded-[0.9cqw] border border-[#dddddd] px-[1.1cqw] text-[0.85cqw] leading-none font-semibold whitespace-nowrap text-[#222222]"
    >
      <SlidersHorizontal className="size-[1.1cqw]" strokeWidth={2} />
      Filters
    </span>
  );
}

export function CategoryBar({
  active = 0,
  onSelect,
}: {
  active?: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-stretch gap-[4cqw] bg-white px-[4cqw]"
      style={{ height: cqw(LAYOUT.categories) }}
    >
      <div className="flex flex-1 items-stretch justify-between">
        {CATEGORIES.map(({ label, icon }, index) => (
          <CategoryItem
            key={label}
            label={label}
            icon={icon}
            selected={index === active}
            onSelect={() => onSelect?.(index)}
          />
        ))}
      </div>
      <FiltersButton />
    </div>
  );
}

/* --------------------------------- Content -------------------------------- */

export function SectionHead({ title, action }: { title: string; action: string }) {
  return (
    <div
      data-anim="section-head"
      className="flex items-end justify-between"
      style={{ height: cqw(LAYOUT.sectionHead) }}
    >
      <h2 className="text-[1.55cqw] leading-none font-semibold tracking-tight text-[#222222]">{title}</h2>
      <span className="text-[0.98cqw] leading-none font-semibold text-[#222222] underline underline-offset-[0.25cqw]">
        {action}
      </span>
    </div>
  );
}

/**
 * The upcoming stay: a white card with the home's name, where and when, and the nights
 * as the hero numeral. It fills its (positioned) host.
 */
export function TripCard({ trip = TRIP, order = 0 }: { trip?: Trip; order?: number }) {
  return (
    <div
      data-anim="block"
      data-order={order}
      className="flex size-full flex-col justify-between rounded-[1cqw] border border-[#ebebeb] bg-white p-[1.6cqw] shadow-[0_0.3cqw_1.2cqw_rgba(0,0,0,0.08)]"
    >
      {/* Both blocks hug their content (self-start), so the card's right side is the card
          itself: pointing there selects the whole card, not a line of its text. */}
      <div className="self-start leading-[1.35]">
        <div data-anim="title">
          <p className="text-[1.6cqw] font-semibold tracking-tight text-[#222222]">{trip.title}</p>
        </div>
        {trip.lines.map((line) => (
          <p key={line} data-anim="line" className="text-[1.05cqw] font-medium tracking-tight text-[#6a6a6a]">
            {line}
          </p>
        ))}
      </div>
      <NightsNumeral nights={trip.nights} />
    </div>
  );
}

/** The trip's hero numeral: the nights, rolling up out of a mask in the intro. */
export function NightsNumeral({ nights }: { nights: number }) {
  return (
    <div className="flex items-end gap-[0.5cqw] self-start text-[#222222]">
      <span className="overflow-hidden">
        <span data-anim="numeral" className="block text-[4.6cqw] leading-[0.82] font-semibold tracking-[-0.05em]">
          {nights}
        </span>
      </span>
      <span data-anim="unit" className="pb-[0.25cqw] text-[0.8cqw] font-bold tracking-[0.08em] text-[#8e4585]">
        NIGHTS
      </span>
    </div>
  );
}

export function SelfCheckInPill({ label = TRIP.access }: { label?: string }) {
  return (
    <span
      data-anim="tile-text"
      className="flex items-center gap-[0.45cqw] rounded-full bg-white/95 px-[0.8cqw] py-[0.45cqw] text-[0.8cqw] leading-none font-semibold whitespace-nowrap text-[#222222]"
    >
      <KeyRound className="size-[0.95cqw]" strokeWidth={2.2} />
      {label}
    </span>
  );
}

export function DirectionsButton() {
  return (
    <span
      data-anim="tile-text"
      className="block rounded-[0.6cqw] bg-white px-[1cqw] py-[0.65cqw] text-[0.85cqw] leading-none font-semibold whitespace-nowrap text-[#222222]"
    >
      Get directions
    </span>
  );
}

/** The stay's photo as a wide banner, with how and when to get in. */
export function CheckInTile({ trip = TRIP }: { trip?: Trip }) {
  return (
    <div data-anim="tile" className="relative size-full overflow-hidden rounded-[1cqw] bg-[#2b2b2b]">
      <Image
        data-anim="tile-photo"
        src={trip.photo}
        alt={trip.title}
        fill
        sizes="960px"
        loading="eager"
        draggable={false}
        className="object-cover"
        style={{ objectPosition: "50% 62%" }}
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/20 to-transparent" />
      <span className="absolute top-[1.4cqw] left-[1.6cqw]">
        <SelfCheckInPill label={trip.access} />
      </span>
      <div className="absolute bottom-[1.5cqw] left-[1.6cqw] text-white">
        <p data-anim="tile-text" className="text-[0.75cqw] font-semibold tracking-[0.1em] text-white/75 uppercase">
          Check-in
        </p>
        <p data-anim="tile-text" className="mt-[0.2cqw] text-[1.5cqw] leading-tight font-semibold tracking-tight">
          {trip.checkIn}
        </p>
      </div>
      <span className="absolute right-[1.6cqw] bottom-[1.5cqw]">
        <DirectionsButton />
      </span>
    </div>
  );
}

export function GuestFavoritePill() {
  return (
    <span
      data-anim="pill"
      className="block rounded-full bg-white px-[0.75cqw] py-[0.45cqw] text-[0.8cqw] leading-none font-semibold whitespace-nowrap text-[#222222] shadow-[0_0.1cqw_0.5cqw_rgba(0,0,0,0.18)]"
    >
      Guest favorite
    </span>
  );
}

/** The carousel position under a listing photo (first of five). */
export function PhotoDots() {
  return (
    <span data-anim="dots" className="flex justify-center gap-[0.35cqw]">
      {[0, 1, 2, 3, 4].map((dot) => (
        <span key={dot} className={cn("size-[0.45cqw] rounded-full", dot === 0 ? "bg-white" : "bg-white/60")} />
      ))}
    </span>
  );
}

export function Rating({ value }: { value: string }) {
  return (
    <span className="flex shrink-0 items-center gap-[0.3cqw] text-[0.98cqw] text-[#222222]">
      <Star className="size-[0.85cqw] fill-current" strokeWidth={0} />
      {value}
    </span>
  );
}

export function Price({ amount }: { amount: string }) {
  return (
    <p className="text-[0.98cqw] whitespace-nowrap text-[#222222]">
      <span className="font-semibold">{amount}</span> night
    </p>
  );
}

/** A listing's photo with its overlays: Guest favorite, the wishlist heart and the dots. */
export function ListingPhoto({
  listing,
  saved = false,
  onToggleSave,
}: {
  listing: Listing;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <div data-anim="photo" className="relative size-full overflow-hidden rounded-[1cqw] bg-[#ececec]">
      <Image
        data-anim="photo-img"
        src={listing.photo}
        alt={listing.title}
        fill
        sizes="480px"
        loading="eager"
        draggable={false}
        className="object-cover"
        style={{ objectPosition: listing.focus }}
      />
      {listing.guestFavorite && (
        <span className="absolute top-[0.9cqw] left-[0.9cqw]">
          <GuestFavoritePill />
        </span>
      )}
      <button
        type="button"
        data-anim="heart"
        aria-label={saved ? `Remove ${listing.title} from wishlist` : `Save ${listing.title} to wishlist`}
        aria-pressed={saved}
        onClick={onToggleSave}
        className="absolute top-[0.8cqw] right-[0.8cqw] cursor-pointer transition-transform duration-200 active:scale-90"
      >
        <Heart
          className="size-[1.7cqw] drop-shadow-[0_0.05cqw_0.2cqw_rgba(0,0,0,0.25)] transition-colors duration-200"
          fill={saved ? "#8e4585" : "rgba(0,0,0,0.45)"}
          stroke="#ffffff"
          strokeWidth={2}
        />
      </button>
      <span className="absolute inset-x-0 bottom-[0.9cqw]">
        <PhotoDots />
      </span>
    </div>
  );
}

/** A recommended stay: photo, then where, what, when and the nightly price. */
export function ListingCard({
  listing,
  order = 0,
  saved = false,
  onToggleSave,
}: {
  listing: Listing;
  order?: number;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <div data-anim="block" data-order={order} className="flex size-full flex-col">
      <div className="shrink-0" style={{ height: cqw(LAYOUT.photo) }}>
        <ListingPhoto listing={listing} saved={saved} onToggleSave={onToggleSave} />
      </div>
      <div data-anim="listing-text" className="pt-[0.8cqw] text-[0.98cqw] leading-[1.38cqw] tracking-tight">
        <div className="flex items-center justify-between gap-[0.6cqw]">
          <div data-anim="title" className="min-w-0">
            <p className="truncate text-[1.05cqw] leading-[1.45cqw] font-semibold text-[#222222]">{listing.title}</p>
          </div>
          <Rating value={listing.rating} />
        </div>
        {listing.lines.map((line) => (
          <p key={line} className="text-[#6a6a6a]">
            {line}
          </p>
        ))}
        <Price amount={listing.price} />
      </div>
    </div>
  );
}

/** The one floating control: switch the results to the map. */
export function MapButton() {
  return (
    <span
      data-anim="map-pill"
      className="pointer-events-auto flex h-[3cqw] items-center gap-[0.6cqw] rounded-full bg-[#222222] px-[1.4cqw] text-[0.98cqw] font-semibold whitespace-nowrap text-white shadow-[0_0.4cqw_1.2cqw_rgba(0,0,0,0.25)]"
    >
      Show map
      <MapIcon className="size-[1.2cqw]" strokeWidth={2} />
    </span>
  );
}

/* --------------------------------- Screen --------------------------------- */

// Memoized: the canvas and the Portal re-render on every camera / resize frame, but the app only
// changes with its own state (and `introSpeed`), so those renders skip it.
export const AirbnbScreen = memo(function AirbnbScreen({
  introSpeed = 1,
}: {
  /** Playback rate of the opening animation: 0.5 = half speed. */
  introSpeed?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);

  useAirbnbIntro(root, introSpeed);

  const toggleSave = (id: string) =>
    setSaved((list) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]));

  return (
    <div
      ref={root}
      className="flex h-full w-full flex-col overflow-hidden bg-white font-sans text-[#222222] opacity-0"
    >
      <SearchHeader />
      <CategoryBar active={category} onSelect={setCategory} />

      <main className="relative min-h-0 flex-1 overflow-hidden px-[4cqw]" style={{ paddingTop: cqw(LAYOUT.contentTop) }}>
        <SectionHead title="Your upcoming trip" action="All trips" />
        <div
          className="flex"
          style={{ gap: cqw(LAYOUT.columnGap), marginTop: cqw(LAYOUT.sectionHeadGap), height: cqw(LAYOUT.tripRow) }}
        >
          {/* Each card sits in its own positioned host: the Portal builds components onto it there. */}
          <div data-anim="trip" className="relative h-full shrink-0" style={{ width: cqw(TRIP_CARD_WIDTH) }}>
            <TripCard />
          </div>
          <div className="relative h-full shrink-0" style={{ width: cqw(CHECK_IN_WIDTH) }}>
            <CheckInTile />
          </div>
        </div>

        <div style={{ marginTop: cqw(LAYOUT.sectionGap) }}>
          <SectionHead title="Stays you might love" action="Show all" />
        </div>
        <div
          className="grid grid-cols-5"
          style={{ columnGap: cqw(LAYOUT.columnGap), marginTop: cqw(LAYOUT.sectionHeadGap) }}
        >
          {LISTINGS.map((listing, index) => (
            <div key={listing.id} className="relative" style={{ height: cqw(LISTING_HEIGHT) }}>
              <ListingCard
                listing={listing}
                order={index}
                saved={saved.includes(listing.id)}
                onToggleSave={() => toggleSave(listing.id)}
              />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[1cqw] flex justify-center">
          <MapButton />
        </div>
      </main>
    </div>
  );
});
