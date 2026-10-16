"use client";

import { memo, useState, type ComponentType } from "react";
import Image from "next/image";
import {
  BatteryFull,
  Check,
  CircleUser,
  Heart,
  KeyRound,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Search,
  Signal,
  SlidersHorizontal,
  Star,
  Wifi,
} from "lucide-react";

import { cn } from "./utils";
import { LISTINGS, TRIP, type Listing } from "./airbnb-data";
import { CATEGORIES, LogoMark } from "./airbnb-screen";

/**
 * The Fairbnb home page at its smaller breakpoints. Same content, data and brand as the desktop
 * screen (airbnb-screen.tsx), reflowed:
 * - "mobile" (390 × 844): status bar, a stacked search pill, scrolling categories, the trip card
 *   above its check-in banner, one listing per row, and a bottom tab bar.
 * - "tablet" (768 × 1024): a compact header, the trip card and banner side by side, and
 *   listings on a three-column grid.
 * Like the desktop screen it's authored in container-query units (cqw of the screen's width), so
 * it scales with the device it's dropped into. The content scrolls and the controls are live
 * (categories, wishlist hearts, tabs).
 */
export type CompactSize = "mobile" | "tablet";

/**
 * Components built onto the trip card (the feature cards' story): a badge's label and whether the
 * card has its Reserve button. Each breakpoint lays them out its own way: on mobile the badge sits
 * in the card's top-right corner and Reserve spans the card's full width under its content; on
 * tablet both sit in the card's corners, as on desktop.
 */
export type BuiltTrip = { badge?: string; reserve?: boolean };

const PLUM = "#8e4585";

export const AirbnbCompactScreen = memo(function AirbnbCompactScreen({
  size,
  builtTrip,
}: {
  size: CompactSize;
  builtTrip?: BuiltTrip;
}) {
  const [category, setCategory] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const toggleSave = (id: string) =>
    setSaved((list) => (list.includes(id) ? list.filter((s) => s !== id) : [...list, id]));

  return size === "mobile" ? (
    <MobileScreen category={category} onCategory={setCategory} saved={saved} onToggleSave={toggleSave} builtTrip={builtTrip} />
  ) : (
    <TabletScreen category={category} onCategory={setCategory} saved={saved} onToggleSave={toggleSave} builtTrip={builtTrip} />
  );
});

type ScreenProps = {
  category: number;
  onCategory: (index: number) => void;
  saved: string[];
  onToggleSave: (id: string) => void;
  builtTrip?: BuiltTrip;
};

/* --------------------------------- Mobile --------------------------------- */

function MobileScreen({ category, onCategory, saved, onToggleSave, builtTrip }: ScreenProps) {
  const [tab, setTab] = useState(0);
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-[#222222]">
      {/* Status bar */}
      <div className="flex h-[11cqw] shrink-0 items-center justify-between px-[7cqw] text-[3.6cqw] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-[1.4cqw]">
          <Signal className="size-[4cqw]" strokeWidth={2.4} />
          <Wifi className="size-[4cqw]" strokeWidth={2.4} />
          <BatteryFull className="size-[5.4cqw]" strokeWidth={2} />
        </span>
      </div>

      {/* Search */}
      <div className="flex shrink-0 items-center gap-[2.5cqw] px-[5cqw] pb-[3cqw]">
        <div className="flex h-[14cqw] min-w-0 flex-1 items-center gap-[3.5cqw] rounded-full border border-[#dddddd] bg-white px-[5cqw] shadow-[0_0.6cqw_3cqw_rgba(0,0,0,0.1)]">
          <Search className="size-[5cqw] shrink-0" strokeWidth={2.6} />
          <span className="flex min-w-0 flex-col">
            <span className="text-[3.7cqw] leading-[4.6cqw] font-semibold">Where to?</span>
            <span className="truncate text-[3cqw] leading-[4cqw] text-[#6a6a6a]">Anywhere · Any week · Add guests</span>
          </span>
        </div>
        <span className="flex size-[10cqw] shrink-0 items-center justify-center rounded-full border border-[#dddddd]">
          <SlidersHorizontal className="size-[4.2cqw]" strokeWidth={2} />
        </span>
      </div>

      {/* Categories: a row that scrolls sideways */}
      <div className="flex h-[17cqw] shrink-0 gap-[7cqw] overflow-x-auto border-b border-[#ebebeb] px-[5cqw] [scrollbar-width:none]">
        {CATEGORIES.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === category}
            onClick={() => onCategory(index)}
            className={cn(
              "relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-[1.4cqw]",
              index === category ? "text-[#222222]" : "text-[#6a6a6a]",
            )}
          >
            <Icon className="size-[6cqw]" strokeWidth={index === category ? 1.9 : 1.6} />
            <span className={cn("text-[2.9cqw] leading-none whitespace-nowrap", index === category ? "font-semibold" : "font-medium")}>
              {label}
            </span>
            {index === category && <span className="absolute inset-x-0 bottom-0 h-[0.5cqw] rounded-full bg-[#222222]" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="min-h-0 flex-1 overflow-y-auto px-[5cqw] pt-[5cqw] pb-[26cqw] [scrollbar-width:none]">
        <SectionTitle className="text-[5cqw]" action="All trips" actionClass="text-[3.3cqw]">
          Your upcoming trip
        </SectionTitle>
        <div className="mt-[3.5cqw] flex flex-col gap-[3cqw]">
          <div
            data-trip-card
            className="relative flex flex-col gap-[4cqw] rounded-[4cqw] border border-[#ebebeb] bg-white p-[5cqw] shadow-[0_1cqw_4cqw_rgba(0,0,0,0.08)]"
          >
            {builtTrip ? (
              // Built: the badge in the title row; under a hairline, the nights with Reserve
              // filling the rest of the row.
              <>
                <div className="flex items-start justify-between gap-[3cqw]">
                  <TripLines />
                  {builtTrip.badge && <GuestBadge label={builtTrip.badge} className="shrink-0 text-[3cqw]" />}
                </div>
                <div className="flex items-center gap-[5cqw] border-t border-[#ebebeb] pt-[4cqw]">
                  <Nights className="text-[11cqw]" unitClass="text-[2.6cqw]" />
                  {builtTrip.reserve && <ReserveButton className="h-[11cqw] flex-1 rounded-[3cqw] text-[3.8cqw]" />}
                </div>
              </>
            ) : (
              <div className="flex items-end justify-between">
                <TripLines />
                <Nights className="text-[13cqw]" unitClass="text-[2.6cqw]" />
              </div>
            )}
          </div>
          <CheckInBanner className="h-[38cqw] rounded-[4cqw]" pad="p-[4.5cqw]" text="text-[4.4cqw]" small="text-[2.6cqw]" pill="text-[2.8cqw] px-[2.6cqw] py-[1.4cqw]" />
        </div>

        <SectionTitle className="mt-[7cqw] text-[5cqw]" action="Show all" actionClass="text-[3.3cqw]">
          Stays you might love
        </SectionTitle>
        <div className="mt-[3.5cqw] flex flex-col gap-[6cqw]">
          {LISTINGS.map((listing) => (
            <ListingTile
              key={listing.id}
              listing={listing}
              saved={saved.includes(listing.id)}
              onToggleSave={() => onToggleSave(listing.id)}
              photoClass="h-[78cqw] rounded-[4cqw]"
              heartClass="size-[7cqw] top-[3.5cqw] right-[3.5cqw]"
              text="text-[3.6cqw] leading-[5cqw]"
              title="text-[3.9cqw]"
            />
          ))}
        </div>
      </main>

      {/* Map pill, over the tab bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[21cqw] flex justify-center">
        <MapPill className="h-[11cqw] gap-[2cqw] px-[5cqw] text-[3.5cqw]" icon="size-[4cqw]" />
      </div>

      {/* Tab bar */}
      <nav className="absolute inset-x-0 bottom-0 flex h-[17cqw] items-start justify-around border-t border-[#ebebeb] bg-white pt-[2.4cqw]">
        {MOBILE_TABS.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === tab}
            onClick={() => setTab(index)}
            className={cn("flex cursor-pointer flex-col items-center gap-[1cqw]", index === tab ? "text-[#8e4585]" : "text-[#6a6a6a]")}
          >
            <Icon className="size-[6cqw]" strokeWidth={index === tab ? 2.2 : 1.7} />
            <span className="text-[2.6cqw] leading-none font-semibold">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const MOBILE_TABS: { label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { label: "Explore", icon: Search },
  { label: "Wishlists", icon: Heart },
  { label: "Trips", icon: LogoMark },
  { label: "Inbox", icon: MessageSquare },
  { label: "Profile", icon: CircleUser },
];

/* --------------------------------- Tablet --------------------------------- */

/** Categories that fit across the tablet's width (the rest sit off to the right on desktop). */
const TABLET_CATEGORIES = 7;

function TabletScreen({ category, onCategory, saved, onToggleSave, builtTrip }: ScreenProps) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans text-[#222222]">
      {/* Header: logo, a compact search pill, account menu */}
      <header className="flex h-[10cqw] shrink-0 items-center justify-between gap-[3cqw] border-b border-[#ebebeb] px-[4cqw]">
        <span className="flex items-center gap-[0.8cqw] text-[#7d3a75]">
          <LogoMark className="size-[4.4cqw]" />
        </span>
        <div className="flex h-[6.6cqw] items-center rounded-full border border-[#dddddd] pr-[0.8cqw] pl-[1.2cqw] shadow-[0_0.2cqw_1cqw_rgba(0,0,0,0.08)]">
          {["Anywhere", "Any week", "Add guests"].map((label, index) => (
            <span key={label} className="flex items-center">
              {index > 0 && <span className="h-[3cqw] w-px bg-[#dddddd]" />}
              <span
                className={cn(
                  "px-[1.8cqw] text-[1.9cqw] leading-none whitespace-nowrap",
                  index < 2 ? "font-semibold" : "text-[#6a6a6a]",
                )}
              >
                {label}
              </span>
            </span>
          ))}
          <span className="flex size-[4.6cqw] items-center justify-center rounded-full text-white" style={{ background: PLUM }}>
            <Search className="size-[2cqw]" strokeWidth={3} />
          </span>
        </div>
        <span className="flex h-[5.4cqw] items-center gap-[1.4cqw] rounded-full border border-[#dddddd] pr-[0.6cqw] pl-[1.6cqw]">
          <Menu className="size-[2.2cqw]" strokeWidth={2.2} />
          <img src="/avatars/user.webp" alt="Your profile" draggable={false} className="size-[4cqw] rounded-full object-cover" />
        </span>
      </header>

      {/* Categories */}
      <div className="flex h-[11cqw] shrink-0 items-stretch gap-[3cqw] px-[4cqw]">
        <div className="flex flex-1 items-stretch justify-between">
          {CATEGORIES.slice(0, TABLET_CATEGORIES).map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={index === category}
              onClick={() => onCategory(index)}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center gap-[0.9cqw]",
                index === category ? "text-[#222222]" : "text-[#6a6a6a]",
              )}
            >
              <Icon className="size-[3.2cqw]" strokeWidth={index === category ? 1.9 : 1.6} />
              <span className={cn("text-[1.6cqw] leading-none whitespace-nowrap", index === category ? "font-semibold" : "font-medium")}>
                {label}
              </span>
              {index === category && <span className="absolute inset-x-0 bottom-[1cqw] h-[0.3cqw] rounded-full bg-[#222222]" />}
            </button>
          ))}
        </div>
        <span className="flex h-[6cqw] items-center gap-[1cqw] self-center rounded-[1.6cqw] border border-[#dddddd] px-[1.8cqw] text-[1.6cqw] font-semibold">
          <SlidersHorizontal className="size-[2cqw]" strokeWidth={2} />
          Filters
        </span>
      </div>

      {/* Content */}
      <main className="relative min-h-0 flex-1 overflow-y-auto px-[4cqw] pt-[4cqw] pb-[12cqw] [scrollbar-width:none]">
        <SectionTitle className="text-[3cqw]" action="All trips" actionClass="text-[1.9cqw]">
          Your upcoming trip
        </SectionTitle>
        <div className="mt-[2.2cqw] grid h-[26cqw] grid-cols-2 gap-[3cqw]">
          <div
            data-trip-card
            className="relative flex flex-col justify-between rounded-[2cqw] border border-[#ebebeb] bg-white p-[3cqw] shadow-[0_0.6cqw_2.4cqw_rgba(0,0,0,0.08)]"
          >
            <div className="flex flex-col gap-[0.4cqw]">
              <p className="text-[2.8cqw] font-semibold tracking-tight">{TRIP.title}</p>
              {TRIP.lines.map((line) => (
                <p key={line} className="text-[1.9cqw] font-medium tracking-tight text-[#6a6a6a]">
                  {line}
                </p>
              ))}
            </div>
            {/* Built: the badge in the top-right corner; Reserve beside the nights, as on desktop */}
            {builtTrip?.reserve ? (
              <div className="flex items-end justify-between">
                <Nights className="text-[8cqw]" unitClass="text-[1.5cqw]" />
                <ReserveButton className="h-[5cqw] rounded-[1.2cqw] px-[2.6cqw] text-[1.9cqw]" />
              </div>
            ) : (
              <Nights className="text-[8cqw]" unitClass="text-[1.5cqw]" />
            )}
            {builtTrip?.badge && (
              <GuestBadge label={builtTrip.badge} className="absolute top-[3cqw] right-[3cqw] text-[1.6cqw]" />
            )}
          </div>
          <CheckInBanner className="h-full rounded-[2cqw]" pad="p-[3cqw]" text="text-[2.8cqw]" small="text-[1.5cqw]" pill="text-[1.6cqw] px-[1.5cqw] py-[0.8cqw]" />
        </div>

        <SectionTitle className="mt-[4.5cqw] text-[3cqw]" action="Show all" actionClass="text-[1.9cqw]">
          Stays you might love
        </SectionTitle>
        <div className="mt-[2.2cqw] grid grid-cols-3 gap-x-[3cqw] gap-y-[4cqw]">
          {LISTINGS.map((listing) => (
            <ListingTile
              key={listing.id}
              listing={listing}
              saved={saved.includes(listing.id)}
              onToggleSave={() => onToggleSave(listing.id)}
              photoClass="h-[28cqw] rounded-[2cqw]"
              heartClass="size-[3.4cqw] top-[1.6cqw] right-[1.6cqw]"
              text="text-[1.8cqw] leading-[2.6cqw]"
              title="text-[1.9cqw]"
            />
          ))}
        </div>
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-[3cqw] flex justify-center">
        <MapPill className="h-[6cqw] gap-[1.2cqw] px-[2.8cqw] text-[1.9cqw]" icon="size-[2.3cqw]" />
      </div>
    </div>
  );
}

/* --------------------------------- Shared --------------------------------- */

/** The mobile trip card's title, place and dates. */
function TripLines() {
  return (
    <div className="flex min-w-0 flex-col gap-[0.6cqw]">
      <p className="text-[4.6cqw] font-semibold tracking-tight">{TRIP.title}</p>
      {TRIP.lines.map((line) => (
        <p key={line} className="text-[3.4cqw] font-medium tracking-tight text-[#6a6a6a]">
          {line}
        </p>
      ))}
    </div>
  );
}

/** The built Guest favorite badge on the trip card: the app's white pill. */
function GuestBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "flex items-center rounded-full bg-white px-[0.85em] py-[0.55em] leading-none font-semibold whitespace-nowrap text-[#222222] shadow-[0_0.1em_0.5em_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * The built Reserve button on the trip card: the plum gradient call to action. Clicking it
 * reserves the stay ("Reserved", a check popping in; same background); clicking again undoes it.
 */
function ReserveButton({ className }: { className: string }) {
  const [reserved, setReserved] = useState(false);
  return (
    <button
      type="button"
      data-cursor-id="built-reserve"
      aria-label={reserved ? `Cancel reservation at ${TRIP.title}` : `Reserve ${TRIP.title}`}
      aria-pressed={reserved}
      onClick={() => setReserved((r) => !r)}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-[0.5em] bg-[linear-gradient(90deg,#8e4585,#b0569f)] leading-none font-semibold tracking-tight whitespace-nowrap text-white shadow-[0_0.2em_0.6em_rgba(142,69,133,0.35)] transition-transform active:scale-95",
        className,
      )}
    >
      {reserved && (
        <span
          key="check"
          aria-hidden="true"
          className="flex size-[1.4em] shrink-0 items-center justify-center rounded-full bg-[#46a35a] text-white animate-in zoom-in-0 spin-in-[-30deg] delay-100 duration-300 fill-mode-both"
        >
          <Check className="size-[0.9em]" strokeWidth={3.5} />
        </span>
      )}
      <span key={reserved ? "reserved" : "reserve"} className={cn(reserved && "animate-in zoom-in-90 duration-300")}>
        {reserved ? "Reserved" : "Reserve"}
      </span>
    </button>
  );
}

function SectionTitle({
  children,
  action,
  className,
  actionClass,
}: {
  children: string;
  action: string;
  className: string;
  actionClass: string;
}) {
  return (
    <div className={cn("flex items-end justify-between", className)}>
      <h2 className="leading-none font-semibold tracking-tight">{children}</h2>
      <span className={cn("leading-none font-semibold underline underline-offset-[0.3em]", actionClass)}>{action}</span>
    </div>
  );
}

/** The trip's nights as the hero numeral. */
function Nights({ className, unitClass }: { className: string; unitClass: string }) {
  return (
    <div className="flex shrink-0 items-end gap-[0.15em] self-end">
      <span className={cn("block leading-[0.82] font-semibold tracking-[-0.05em]", className)}>{TRIP.nights}</span>
      <span className={cn("pb-[0.3em] font-bold tracking-[0.08em]", unitClass)} style={{ color: PLUM }}>
        NIGHTS
      </span>
    </div>
  );
}

/** The trip's photo with self check-in and the check-in time. */
function CheckInBanner({
  className,
  pad,
  text,
  small,
  pill,
}: {
  className: string;
  pad: string;
  text: string;
  small: string;
  pill: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[#2b2b2b]", className)}>
      <Image src={TRIP.photo} alt={TRIP.title} fill sizes="480px" draggable={false} className="object-cover" style={{ objectPosition: "50% 62%" }} />
      <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/20 to-transparent" />
      <div className={cn("absolute inset-0 flex flex-col items-start justify-between text-white", pad)}>
        <span className={cn("flex items-center gap-[0.4em] rounded-full bg-white/95 leading-none font-semibold text-[#222222]", pill)}>
          <KeyRound className="size-[1.1em]" strokeWidth={2.2} />
          {TRIP.access}
        </span>
        <div>
          <p className={cn("font-semibold tracking-[0.1em] text-white/75 uppercase", small)}>Check-in</p>
          <p className={cn("leading-tight font-semibold tracking-tight", text)}>{TRIP.checkIn}</p>
        </div>
      </div>
    </div>
  );
}

function ListingTile({
  listing,
  saved,
  onToggleSave,
  photoClass,
  heartClass,
  text,
  title,
}: {
  listing: Listing;
  saved: boolean;
  onToggleSave: () => void;
  photoClass: string;
  heartClass: string;
  text: string;
  title: string;
}) {
  return (
    <div className="flex flex-col">
      <div className={cn("relative overflow-hidden bg-[#ececec]", photoClass)}>
        <Image
          src={listing.photo}
          alt={listing.title}
          fill
          sizes="480px"
          draggable={false}
          className="object-cover"
          style={{ objectPosition: listing.focus }}
        />
        {listing.guestFavorite && (
          <span className={cn("absolute top-[0.9em] left-[0.9em] rounded-full bg-white px-[0.75em] py-[0.45em] leading-none font-semibold text-[#222222] shadow-sm", text)}>
            Guest favorite
          </span>
        )}
        <button
          type="button"
          aria-label={saved ? `Remove ${listing.title} from wishlist` : `Save ${listing.title} to wishlist`}
          aria-pressed={saved}
          data-wishlist-heart={listing.id}
          onClick={onToggleSave}
          className={cn("absolute cursor-pointer transition-transform duration-200 active:scale-90", heartClass)}
        >
          <Heart
            className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-colors duration-200"
            fill={saved ? PLUM : "rgba(0,0,0,0.45)"}
            stroke="#ffffff"
            strokeWidth={2}
          />
        </button>
      </div>
      <div className={cn("pt-[0.6em] tracking-tight", text)}>
        <div className="flex items-center justify-between gap-[0.6em]">
          <p className={cn("truncate font-semibold", title)}>{listing.title}</p>
          <span className="flex shrink-0 items-center gap-[0.3em]">
            <Star className="size-[0.85em] fill-current" strokeWidth={0} />
            {listing.rating}
          </span>
        </div>
        {listing.lines.map((line) => (
          <p key={line} className="text-[#6a6a6a]">
            {line}
          </p>
        ))}
        <p>
          <span className="font-semibold">{listing.price}</span> night
        </p>
      </div>
    </div>
  );
}

function MapPill({ className, icon }: { className: string; icon: string }) {
  return (
    <span
      className={cn(
        "pointer-events-auto flex items-center rounded-full bg-[#222222] font-semibold whitespace-nowrap text-white shadow-[0_0.4em_1.2em_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      Map
      <MapIcon className={icon} strokeWidth={2} />
    </span>
  );
}
