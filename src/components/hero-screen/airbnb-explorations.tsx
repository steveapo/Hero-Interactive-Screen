import Image from "next/image"
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Heart,
  LayoutGrid,
  Lock,
  Minus,
  Plus,
  Share,
  Star,
} from "lucide-react"
import {
  BecomeHostLink,
  GlobeButton,
  Logo,
  SearchPill,
  UserMenu,
} from "@/app/copy-project/airbnb-screen"
import { LISTINGS, TRIP } from "@/app/copy-project/airbnb-data"
import { cn } from "@/lib/utils"

/**
 * Screens the designer is exploring further out on the canvas: whole pages of the Fairbnb desktop
 * app beyond the one in the Codebase (listing detail, search with map, checkout, trips,
 * wishlists, inbox and the host's Today). They're static design frames, each a 1440×900 page
 * authored in cqw like the live app and built from the same pieces, palette and photos, so the
 * canvas reads as one product being designed screen by screen.
 */

const MUTED = "#6a6a6a"
const RAUSCH_GRADIENT = "bg-linear-to-r from-[#9c4f93] via-[#8e4585] to-[#73336c]"

const PHOTO = {
  vik: "/airbnb/stay-1.jpg",
  vernazza: "/airbnb/stay-2.jpg",
  ciucas: "/airbnb/stay-3.jpg",
  yosemite: "/airbnb/stay-4.jpg",
  merzouga: "/airbnb/stay-5.jpg",
  stowe: "/airbnb/stay-7.jpg",
}

const HOST = {
  giulia: "/airbnb/host-giulia.webp",
  sigrun: "/airbnb/host-sigrun.webp",
  youssef: "/airbnb/host-youssef.webp",
  andrei: "/airbnb/host-andrei.webp",
}

/* --------------------------------- Pieces --------------------------------- */

/** A cover photo filling its positioned parent. */
function Photo({ src, focus = "50% 50%", sizes = "480px", className }: { src: string; focus?: string; sizes?: string; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      draggable={false}
      className={cn("object-cover", className)}
      style={{ objectPosition: focus }}
    />
  )
}

function Avatar({ src, size }: { src: string; size: number }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="shrink-0 rounded-full object-cover"
      style={{ width: `${size}cqw`, height: `${size}cqw` }}
    />
  )
}

/** The page: white, 100cqw × 62.5cqw (the frame is the 1440×900 viewport). */
function Page({ children }: { children: React.ReactNode }) {
  return <div className="relative flex size-full flex-col overflow-hidden bg-white font-sans text-[#222222]">{children}</div>
}

/** The site header, as on the home page; the search pill can be left out (focused flows). */
function SiteHeader({ search = true }: { search?: boolean }) {
  return (
    <header className="grid h-[6.4cqw] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#ebebeb] px-[4cqw]">
      <Logo />
      {search ? <SearchPill /> : <span />}
      <div className="flex items-center justify-end gap-[0.4cqw]">
        <BecomeHostLink />
        <GlobeButton />
        <span className="ml-[0.3cqw]">
          <UserMenu />
        </span>
      </div>
    </header>
  )
}

function RauschButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block rounded-[0.6cqw] py-[0.9cqw] text-center text-[1cqw] leading-none font-semibold text-white",
        RAUSCH_GRADIENT,
        className,
      )}
    >
      {children}
    </span>
  )
}

function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-[#ebebeb]", className)} />
}

function Stars({ size = 0.7 }: { size?: number }) {
  return (
    <span className="flex gap-[0.1cqw]">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className="fill-current" strokeWidth={0} style={{ width: `${size}cqw`, height: `${size}cqw` }} />
      ))}
    </span>
  )
}

/* ----------------------------- Listing detail ----------------------------- */

export function ListingDetailScreen() {
  const vik = LISTINGS[0]
  return (
    <Page>
      <SiteHeader />
      <div className="px-[11cqw] pt-[2cqw]">
        <div className="flex items-end justify-between">
          <h1 className="text-[1.8cqw] leading-tight font-semibold tracking-tight">Aurora glass cabin under the northern lights</h1>
          <div className="flex gap-[1.4cqw] text-[0.9cqw] font-semibold underline underline-offset-[0.2cqw]">
            <span className="flex items-center gap-[0.4cqw]">
              <Share className="size-[0.95cqw]" strokeWidth={2} />
              Share
            </span>
            <span className="flex items-center gap-[0.4cqw]">
              <Heart className="size-[0.95cqw]" strokeWidth={2} />
              Save
            </span>
          </div>
        </div>

        {/* Photo mosaic */}
        <div className="relative mt-[1.4cqw] grid h-[24cqw] grid-cols-4 grid-rows-2 gap-[0.55cqw] overflow-hidden rounded-[1cqw]">
          <div className="relative col-span-2 row-span-2">
            <Photo src={PHOTO.vik} focus={vik.focus} sizes="720px" />
          </div>
          {[
            { src: PHOTO.yosemite, focus: "40% 45%" },
            { src: PHOTO.ciucas, focus: "66% 60%" },
            { src: PHOTO.merzouga, focus: "45% 55%" },
            { src: PHOTO.stowe, focus: "50% 45%" },
          ].map((p) => (
            <div key={p.src} className="relative">
              <Photo src={p.src} focus={p.focus} sizes="360px" />
            </div>
          ))}
          <span className="absolute right-[1.2cqw] bottom-[1.2cqw] flex items-center gap-[0.5cqw] rounded-[0.6cqw] border border-[#222222] bg-white px-[0.9cqw] py-[0.55cqw] text-[0.85cqw] font-semibold">
            <LayoutGrid className="size-[0.95cqw]" strokeWidth={2} />
            Show all photos
          </span>
        </div>

        <div className="mt-[2cqw] grid grid-cols-[1fr_26cqw] gap-[6cqw]">
          <div>
            <h2 className="text-[1.45cqw] font-semibold tracking-tight">Entire cabin in Vík, Iceland</h2>
            <p className="mt-[0.2cqw] text-[1cqw]">2 guests · 1 bedroom · 1 bed · 1 bath</p>
            <div className="mt-[1.4cqw] flex items-center gap-[1.6cqw] rounded-[0.9cqw] border border-[#dddddd] px-[1.6cqw] py-[1.1cqw]">
              <div className="text-center text-[1.05cqw] leading-tight font-semibold">
                <p>Guest</p>
                <p>favorite</p>
              </div>
              <p className="flex-1 text-[0.95cqw] leading-snug font-semibold">One of the most loved homes on Fairbnb, according to guests</p>
              <div className="flex flex-col items-center gap-[0.2cqw]">
                <p className="text-[1.25cqw] leading-none font-semibold">4.97</p>
                <Stars size={0.6} />
              </div>
              <span className="h-[2.4cqw] w-px bg-[#dddddd]" />
              <div className="text-center">
                <p className="text-[1.25cqw] leading-none font-semibold">128</p>
                <p className="mt-[0.2cqw] text-[0.75cqw] underline">Reviews</p>
              </div>
            </div>
            <div className="mt-[1.4cqw] flex items-center gap-[1cqw] border-t border-[#ebebeb] pt-[1.4cqw]">
              <Avatar src={HOST.sigrun} size={3.2} />
              <div>
                <p className="text-[1cqw] font-semibold">Hosted by Sigrún</p>
                <p className="text-[0.9cqw]" style={{ color: MUTED }}>
                  Superhost · 6 years hosting
                </p>
              </div>
            </div>
          </div>

          {/* Booking card */}
          <div className="self-start rounded-[1cqw] border border-[#dddddd] p-[1.6cqw] shadow-[0_0.4cqw_1.6cqw_rgba(0,0,0,0.12)]">
            <p>
              <span className="text-[1.45cqw] font-semibold">{vik.price}</span> <span className="text-[1cqw]">night</span>
            </p>
            <div className="mt-[1.2cqw] rounded-[0.7cqw] border border-[#b0b0b0]">
              <div className="grid grid-cols-2 border-b border-[#b0b0b0]">
                <div className="border-r border-[#b0b0b0] p-[0.7cqw]">
                  <p className="text-[0.62cqw] font-bold uppercase">Check-in</p>
                  <p className="text-[0.9cqw]">11/3/2025</p>
                </div>
                <div className="p-[0.7cqw]">
                  <p className="text-[0.62cqw] font-bold uppercase">Checkout</p>
                  <p className="text-[0.9cqw]">11/8/2025</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-[0.7cqw]">
                <div>
                  <p className="text-[0.62cqw] font-bold uppercase">Guests</p>
                  <p className="text-[0.9cqw]">2 guests</p>
                </div>
                <ChevronDown className="size-[1.1cqw]" strokeWidth={2} />
              </div>
            </div>
            <RauschButton className="mt-[1.2cqw]">Reserve</RauschButton>
            <p className="mt-[0.8cqw] text-center text-[0.85cqw]" style={{ color: MUTED }}>
              You won&apos;t be charged yet
            </p>
          </div>
        </div>
      </div>
    </Page>
  )
}

/* ----------------------------- Search with map ---------------------------- */

const SEARCH_RESULTS = [
  { title: "Vík, Iceland", line: "Aurora glass cabin", price: "$312", src: PHOTO.vik, focus: "48% 70%" },
  { title: "Ciucaș, Romania", line: "Mountain lodge", price: "$146", src: PHOTO.ciucas, focus: "67% 60%" },
  { title: "Yosemite, California", line: "Snowy A-frame", price: "$274", src: PHOTO.yosemite, focus: "34% 45%" },
  { title: "Merzouga, Morocco", line: "Desert dome", price: "$128", src: PHOTO.merzouga, focus: "42% 55%" },
  { title: "Stowe, Vermont", line: "Creekside cabin", price: "$219", src: PHOTO.stowe, focus: "50% 40%" },
  { title: "Vernazza, Italy", line: "Sea house", price: "$268", src: PHOTO.vernazza, focus: "52% 58%" },
]

const MAP_PINS = [
  { price: "$312", left: "22%", top: "30%", selected: true },
  { price: "$146", left: "58%", top: "22%" },
  { price: "$274", left: "44%", top: "52%" },
  { price: "$128", left: "70%", top: "64%" },
  { price: "$219", left: "30%", top: "74%" },
  { price: "$268", left: "78%", top: "40%" },
]

/** A quiet map: coast, a lake, parks and roads, in Fairbnb's map palette. */
function MapArt() {
  return (
    <svg viewBox="0 0 420 520" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
      <rect width="420" height="520" fill="#ede9e1" />
      <path d="M0 0h170c-18 40-60 52-70 96-12 52 30 80 8 128C88 270 30 280 0 300Z" fill="#b9dcef" />
      <ellipse cx="300" cy="380" rx="58" ry="34" fill="#b9dcef" />
      <path d="M250 60c40-12 90 6 110 40 14 26-10 60-50 58-46-2-92-62-60-98Z" fill="#cfe6c8" />
      <path d="M90 400c30-30 92-24 104 14 10 34-30 62-70 56-40-6-58-46-34-70Z" fill="#cfe6c8" />
      <g fill="none" stroke="#dcd6ca" strokeWidth="9" strokeLinecap="round">
        <path d="M120 520C160 420 190 330 260 270S400 190 420 150" />
        <path d="M0 360c90 10 170 0 250-40" />
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round">
        <path d="M120 520C160 420 190 330 260 270S400 190 420 150" />
        <path d="M0 360c90 10 170 0 250-40" />
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
        <path d="M200 0c10 80 20 150 60 270" />
        <path d="M260 270c40 60 50 140 40 250" />
        <path d="M150 160c80 10 150 30 270 20" />
        <path d="M40 470c80-20 160-30 240-10" />
      </g>
    </svg>
  )
}

export function SearchMapScreen() {
  return (
    <Page>
      <SiteHeader />
      <div className="flex h-[4.6cqw] shrink-0 items-center gap-[0.7cqw] border-b border-[#ebebeb] px-[4cqw]">
        {["Price", "Type of place", "Free cancellation", "Instant Book", "Superhost", "Guest favorite"].map((chip, i) => (
          <span
            key={chip}
            className={cn(
              "rounded-full border px-[1cqw] py-[0.55cqw] text-[0.85cqw] leading-none font-medium whitespace-nowrap",
              i === 4 ? "border-[#222222] bg-[#f7f7f7]" : "border-[#dddddd]",
            )}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[58cqw] shrink-0 px-[4cqw] pt-[1.6cqw]">
          <p className="text-[0.95cqw] font-semibold">Over 1,000 homes for the long weekend</p>
          <div className="mt-[1.2cqw] grid grid-cols-3 gap-x-[1.4cqw] gap-y-[1.6cqw]">
            {SEARCH_RESULTS.map((r) => (
              <div key={r.title}>
                <div className="relative h-[14.6cqw] overflow-hidden rounded-[0.9cqw]">
                  <Photo src={r.src} focus={r.focus} sizes="360px" />
                  <Heart
                    className="absolute top-[0.7cqw] right-[0.7cqw] size-[1.4cqw]"
                    fill="rgba(0,0,0,0.45)"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                </div>
                <p className="mt-[0.6cqw] text-[0.9cqw] leading-[1.3cqw] font-semibold">{r.title}</p>
                <p className="text-[0.85cqw] leading-[1.25cqw]" style={{ color: MUTED }}>
                  {r.line}
                </p>
                <p className="text-[0.85cqw] leading-[1.25cqw]">
                  <span className="font-semibold">{r.price}</span> night
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <MapArt />
          {MAP_PINS.map((pin) => (
            <span
              key={pin.price}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-[0.75cqw] py-[0.45cqw] text-[0.85cqw] leading-none font-bold shadow-[0_0.1cqw_0.5cqw_rgba(0,0,0,0.22)]",
                pin.selected ? "scale-110 bg-[#222222] text-white" : "bg-white text-[#222222]",
              )}
              style={{ left: pin.left, top: pin.top }}
            >
              {pin.price}
            </span>
          ))}
          <span className="absolute top-[1.4cqw] right-[1.4cqw] flex flex-col overflow-hidden rounded-[0.6cqw] bg-white shadow-[0_0.1cqw_0.5cqw_rgba(0,0,0,0.18)]">
            <span className="flex size-[2.4cqw] items-center justify-center border-b border-[#ebebeb]">
              <Plus className="size-[1cqw]" strokeWidth={2.2} />
            </span>
            <span className="flex size-[2.4cqw] items-center justify-center">
              <Minus className="size-[1cqw]" strokeWidth={2.2} />
            </span>
          </span>
        </div>
      </div>
    </Page>
  )
}

/* -------------------------------- Checkout -------------------------------- */

function TripRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[1cqw] font-semibold">{label}</p>
        <p className="text-[1cqw]">{value}</p>
      </div>
      <span className="text-[1cqw] font-semibold underline">Edit</span>
    </div>
  )
}

function Field({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("px-[1cqw] py-[0.95cqw] text-[0.95cqw]", className)} style={{ color: MUTED }}>
      {label}
    </div>
  )
}

export function CheckoutScreen() {
  const rows = [
    { label: "$268 × 3 nights", value: "$804" },
    { label: "Cleaning fee", value: "$60" },
    { label: "Fairbnb service fee", value: "$122" },
  ]
  return (
    <Page>
      <header className="flex h-[6.4cqw] shrink-0 items-center border-b border-[#ebebeb] px-[4cqw]">
        <Logo />
      </header>
      <div className="px-[11cqw] pt-[2.6cqw]">
        <div className="flex items-center gap-[1cqw]">
          <span className="flex size-[2.6cqw] items-center justify-center rounded-full bg-[#f7f7f7]">
            <ChevronLeft className="size-[1.2cqw]" strokeWidth={2.2} />
          </span>
          <h1 className="text-[2.2cqw] font-semibold tracking-tight">Confirm and pay</h1>
        </div>
        <div className="mt-[2cqw] grid grid-cols-[1fr_30cqw] gap-[7cqw]">
          <div>
            <h2 className="text-[1.45cqw] font-semibold tracking-tight">Your trip</h2>
            <div className="mt-[1.2cqw] flex flex-col gap-[1.2cqw]">
              <TripRow label="Dates" value={TRIP.lines[1]} />
              <TripRow label="Guests" value="2 guests" />
            </div>
            <Divider className="my-[1.8cqw]" />
            <div className="flex items-center justify-between">
              <h2 className="text-[1.45cqw] font-semibold tracking-tight">Pay with</h2>
              <span className="flex gap-[0.4cqw]">
                {["#1a1f71", "#eb001b", "#016fd0"].map((color) => (
                  <span key={color} className="h-[1.3cqw] w-[2cqw] rounded-[0.25cqw]" style={{ background: color }} />
                ))}
              </span>
            </div>
            <div className="mt-[1.2cqw] flex items-center justify-between rounded-[0.7cqw] border border-[#b0b0b0] px-[1cqw] py-[0.95cqw]">
              <span className="flex items-center gap-[0.7cqw] text-[0.95cqw]">
                <CreditCard className="size-[1.2cqw]" strokeWidth={1.8} />
                Credit or debit card
              </span>
              <ChevronDown className="size-[1.1cqw]" strokeWidth={2} />
            </div>
            <div className="mt-[1cqw] overflow-hidden rounded-[0.7cqw] border border-[#b0b0b0]">
              <Field label="Card number" className="flex items-center justify-between border-b border-[#b0b0b0]" />
              <div className="grid grid-cols-2">
                <Field label="Expiration" className="border-r border-[#b0b0b0]" />
                <Field label="CVV" />
              </div>
            </div>
            <RauschButton className="mt-[1.8cqw] w-fit px-[2.4cqw]">Confirm and pay</RauschButton>
          </div>

          {/* Summary */}
          <div className="self-start rounded-[1cqw] border border-[#dddddd] p-[1.6cqw]">
            <div className="flex gap-[1cqw]">
              <div className="relative h-[7.6cqw] w-[9cqw] shrink-0 overflow-hidden rounded-[0.7cqw]">
                <Photo src={TRIP.photo} focus="52% 58%" sizes="240px" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[0.98cqw] font-semibold">{TRIP.title}</p>
                <p className="text-[0.85cqw]" style={{ color: MUTED }}>
                  Entire home · {TRIP.lines[0]}
                </p>
                <p className="mt-[0.4cqw] flex items-center gap-[0.3cqw] text-[0.8cqw]">
                  <Star className="size-[0.75cqw] fill-current" strokeWidth={0} />
                  4.96 (212) · Superhost
                </p>
              </div>
            </div>
            <Divider className="my-[1.4cqw]" />
            <h3 className="text-[1.25cqw] font-semibold tracking-tight">Price details</h3>
            <div className="mt-[1cqw] flex flex-col gap-[0.7cqw] text-[0.95cqw]">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
            <Divider className="my-[1.2cqw]" />
            <div className="flex justify-between text-[0.98cqw] font-semibold">
              <span>Total (USD)</span>
              <span>$986</span>
            </div>
            <p className="mt-[1.2cqw] flex items-center gap-[0.5cqw] text-[0.8cqw]" style={{ color: MUTED }}>
              <Lock className="size-[0.85cqw]" strokeWidth={2} />
              Payments are encrypted and secure
            </p>
          </div>
        </div>
      </div>
    </Page>
  )
}

/* ---------------------------------- Trips --------------------------------- */

const PAST_TRIPS = [
  { place: "Vík", host: "Hosted by Sigrún", when: "Nov 2024", src: PHOTO.vik, focus: "48% 70%" },
  { place: "Ciucaș", host: "Hosted by Andrei", when: "Sep 2024", src: PHOTO.ciucas, focus: "67% 60%" },
  { place: "Yosemite", host: "Hosted by Dana", when: "Dec 2023", src: PHOTO.yosemite, focus: "34% 45%" },
  { place: "Merzouga", host: "Hosted by Youssef", when: "Oct 2023", src: PHOTO.merzouga, focus: "42% 55%" },
  { place: "Stowe", host: "Hosted by Clara", when: "Oct 2023", src: PHOTO.stowe, focus: "50% 40%" },
]

export function TripsScreen() {
  return (
    <Page>
      <SiteHeader />
      <div className="px-[4cqw] pt-[2.4cqw]">
        <h1 className="text-[2.4cqw] font-semibold tracking-tight">Trips</h1>
        <div className="mt-[1.6cqw] flex h-[20cqw] overflow-hidden rounded-[1.2cqw] border border-[#ebebeb] shadow-[0_0.3cqw_1.2cqw_rgba(0,0,0,0.08)]">
          <div className="flex w-[36cqw] shrink-0 flex-col justify-between p-[2.2cqw]">
            <div>
              <p className="text-[0.8cqw] font-semibold tracking-[0.1em] text-[#8e4585] uppercase">In 3 days</p>
              <p className="mt-[0.4cqw] text-[2cqw] leading-tight font-semibold tracking-tight">Vernazza</p>
              <p className="text-[1cqw]" style={{ color: MUTED }}>
                {TRIP.title} hosted by Giulia
              </p>
            </div>
            <Divider />
            <div className="grid grid-cols-2 gap-[1.4cqw] text-[0.95cqw]">
              <div>
                <p className="font-semibold">Jun 12 – 15</p>
                <p style={{ color: MUTED }}>2025</p>
              </div>
              <div>
                <p className="font-semibold">Via Roma 14</p>
                <p style={{ color: MUTED }}>Vernazza, Italy</p>
              </div>
            </div>
          </div>
          <div className="relative flex-1">
            <Photo src={TRIP.photo} focus="52% 58%" sizes="960px" />
          </div>
        </div>
        <h2 className="mt-[2.4cqw] text-[1.45cqw] font-semibold tracking-tight">Where you&apos;ve been</h2>
        <div className="mt-[1.2cqw] grid grid-cols-5 gap-[2cqw]">
          {PAST_TRIPS.map((trip) => (
            <div key={trip.place} className="flex items-center gap-[0.9cqw]">
              <div className="relative size-[5.6cqw] shrink-0 overflow-hidden rounded-[0.8cqw]">
                <Photo src={trip.src} focus={trip.focus} sizes="160px" />
              </div>
              <div className="min-w-0 text-[0.85cqw] leading-[1.3cqw]">
                <p className="text-[0.95cqw] font-semibold">{trip.place}</p>
                <p className="truncate" style={{ color: MUTED }}>
                  {trip.host}
                </p>
                <p style={{ color: MUTED }}>{trip.when}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-[3cqw] border-t border-[#ebebeb] pt-[1.6cqw] text-[0.95cqw]">
          Can&apos;t find your reservation here? <span className="font-semibold underline">Visit the Help Center</span>
        </p>
      </div>
    </Page>
  )
}

/* -------------------------------- Wishlists ------------------------------- */

const WISHLISTS = [
  { name: "Northern lights", saved: 4, photos: [PHOTO.vik, PHOTO.yosemite, PHOTO.stowe] },
  { name: "Mountain escapes", saved: 6, photos: [PHOTO.ciucas, PHOTO.yosemite, PHOTO.vik] },
  { name: "Desert nights", saved: 3, photos: [PHOTO.merzouga, PHOTO.ciucas, PHOTO.vernazza] },
  { name: "Fall weekends", saved: 5, photos: [PHOTO.stowe, PHOTO.ciucas, PHOTO.merzouga] },
]

export function WishlistsScreen() {
  return (
    <Page>
      <SiteHeader />
      <div className="px-[4cqw] pt-[2.4cqw]">
        <div className="flex items-end justify-between">
          <h1 className="text-[2.4cqw] leading-none font-semibold tracking-tight">Wishlists</h1>
          <span className="text-[0.98cqw] font-semibold underline">Edit</span>
        </div>
        <div className="mt-[2cqw] grid grid-cols-4 gap-x-[2cqw]">
          {WISHLISTS.map((list) => (
            <div key={list.name}>
              <div className="grid h-[19cqw] grid-cols-2 grid-rows-2 gap-[0.2cqw] overflow-hidden rounded-[1.6cqw]">
                <div className="relative row-span-2">
                  <Photo src={list.photos[0]} sizes="360px" />
                </div>
                <div className="relative">
                  <Photo src={list.photos[1]} sizes="240px" />
                </div>
                <div className="relative">
                  <Photo src={list.photos[2]} sizes="240px" />
                </div>
              </div>
              <p className="mt-[0.8cqw] text-[1.05cqw] font-semibold">{list.name}</p>
              <p className="text-[0.95cqw]" style={{ color: MUTED }}>
                {list.saved} saved
              </p>
            </div>
          ))}
        </div>
        <h2 className="mt-[2.4cqw] text-[1.45cqw] font-semibold tracking-tight">Recently viewed</h2>
        <div className="mt-[1.2cqw] grid grid-cols-6 gap-[1.6cqw]">
          {SEARCH_RESULTS.map((r) => (
            <div key={r.title}>
              <div className="relative h-[9cqw] overflow-hidden rounded-[0.9cqw]">
                <Photo src={r.src} focus={r.focus} sizes="240px" />
              </div>
              <p className="mt-[0.5cqw] truncate text-[0.85cqw] font-semibold">{r.title}</p>
            </div>
          ))}
        </div>
      </div>
    </Page>
  )
}

/* ---------------------------------- Inbox --------------------------------- */

const CONVERSATIONS = [
  { name: "Giulia", avatar: HOST.giulia, when: "10:24", preview: "The lockbox code is 4471. See you Thursday!", trip: "Jun 12 – 15 · Vernazza" },
  { name: "Sigrún", avatar: HOST.sigrun, when: "Mon", preview: "Aurora forecast looks great for your dates", trip: "Nov 3 – 8 · Vík" },
  { name: "Youssef", avatar: HOST.youssef, when: "May 28", preview: "We can arrange the camel trek at sunset", trip: "Oct 6 – 11 · Merzouga" },
  { name: "Andrei", avatar: HOST.andrei, when: "May 14", preview: "Thanks for staying with us, come back soon", trip: "Sep 18 – 23 · Ciucaș" },
]

const THREAD = [
  { mine: false, text: "Ciao! Your room faces the harbour, so leave the shutters open for the sunrise." },
  { mine: true, text: "That sounds perfect. Is there somewhere to leave bags if we arrive early?" },
  { mine: false, text: "Of course, drop them at the café downstairs any time after 10." },
  { mine: false, text: "The lockbox code is 4471. See you Thursday!" },
]

export function InboxScreen() {
  return (
    <Page>
      <SiteHeader search={false} />
      <div className="flex min-h-0 flex-1">
        {/* Conversations */}
        <div className="w-[26cqw] shrink-0 border-r border-[#ebebeb] px-[1.4cqw] pt-[1.6cqw]">
          <h1 className="px-[0.4cqw] text-[1.6cqw] font-semibold tracking-tight">Messages</h1>
          <div className="mt-[1cqw] flex gap-[0.5cqw] px-[0.4cqw]">
            {["All", "Traveling", "Support"].map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  "rounded-full px-[0.9cqw] py-[0.5cqw] text-[0.8cqw] leading-none font-semibold",
                  i === 0 ? "bg-[#222222] text-white" : "bg-[#f2f2f2]",
                )}
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-[1.2cqw] flex flex-col gap-[0.3cqw]">
            {CONVERSATIONS.map((c, i) => (
              <div key={c.name} className={cn("flex gap-[0.9cqw] rounded-[0.8cqw] p-[0.8cqw]", i === 0 && "bg-[#f7f7f7]")}>
                <Avatar src={c.avatar} size={3.4} />
                <div className="min-w-0 flex-1 text-[0.85cqw] leading-[1.3cqw]">
                  <div className="flex justify-between">
                    <p className="text-[0.95cqw] font-semibold">{c.name}</p>
                    <span style={{ color: MUTED }}>{c.when}</span>
                  </div>
                  <p className="truncate">{c.preview}</p>
                  <p style={{ color: MUTED }}>{c.trip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[5cqw] shrink-0 items-center justify-between border-b border-[#ebebeb] px-[2cqw]">
            <div className="flex items-center gap-[0.8cqw]">
              <Avatar src={HOST.giulia} size={2.4} />
              <div>
                <p className="text-[1.05cqw] font-semibold">Giulia</p>
                <p className="text-[0.8cqw]" style={{ color: MUTED }}>
                  Response time: 1 hour
                </p>
              </div>
            </div>
            <span className="rounded-[0.6cqw] border border-[#222222] px-[0.9cqw] py-[0.5cqw] text-[0.85cqw] font-semibold">Details</span>
          </div>
          <div className="flex flex-1 flex-col gap-[1cqw] px-[2cqw] pt-[1.4cqw]">
            <p className="text-center text-[0.8cqw]" style={{ color: MUTED }}>
              Today
            </p>
            {THREAD.map((m) => (
              <div key={m.text} className={cn("flex items-end gap-[0.6cqw]", m.mine && "justify-end")}>
                {!m.mine && <Avatar src={HOST.giulia} size={1.8} />}
                <p
                  className={cn(
                    "max-w-[60%] rounded-[1.1cqw] px-[1.1cqw] py-[0.75cqw] text-[0.92cqw] leading-snug",
                    m.mine ? "bg-[#222222] text-white" : "bg-[#f2f2f2]",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          <div className="px-[2cqw] pb-[1.6cqw]">
            <div className="flex h-[3.6cqw] items-center justify-between rounded-full border border-[#b0b0b0] pr-[0.5cqw] pl-[1.4cqw]">
              <span className="text-[0.92cqw]" style={{ color: MUTED }}>
                Write a message…
              </span>
              <span className="flex size-[2.6cqw] items-center justify-center rounded-full bg-[#222222] text-white">
                <ArrowUp className="size-[1.1cqw]" strokeWidth={2.4} />
              </span>
            </div>
          </div>
        </div>

        {/* Reservation */}
        <div className="w-[24cqw] shrink-0 border-l border-[#ebebeb] px-[1.8cqw] pt-[1.6cqw]">
          <h2 className="text-[1.25cqw] font-semibold tracking-tight">Reservation</h2>
          <div className="relative mt-[1cqw] h-[12cqw] overflow-hidden rounded-[0.9cqw]">
            <Photo src={TRIP.photo} focus="52% 58%" sizes="360px" />
          </div>
          <p className="mt-[1cqw] text-[1.05cqw] font-semibold">{TRIP.title}</p>
          <p className="text-[0.9cqw]" style={{ color: MUTED }}>
            Jun 12 – 15 · 2 guests
          </p>
          <Divider className="my-[1.2cqw]" />
          <div className="flex flex-col gap-[0.9cqw] text-[0.9cqw]">
            <div className="flex justify-between">
              <span style={{ color: MUTED }}>Check-in</span>
              <span className="font-semibold">{TRIP.checkIn}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: MUTED }}>Checkout</span>
              <span className="font-semibold">Sun, 11:00 AM</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: MUTED }}>Confirmation</span>
              <span className="font-semibold">HM4X8QZ2</span>
            </div>
          </div>
          <span className="mt-[1.4cqw] block rounded-[0.6cqw] border border-[#222222] py-[0.75cqw] text-center text-[0.9cqw] font-semibold">
            Show listing
          </span>
        </div>
      </div>
    </Page>
  )
}

/* ------------------------------- Host: Today ------------------------------ */

const RESERVATIONS = [
  { status: "Checking out today", guest: "Sigrún & Ólafur", stay: "Nov 3 – 8 · Vík cabin", avatar: HOST.sigrun },
  { status: "Arriving in 2 days", guest: "Youssef", stay: "Jun 14 – 18 · Sea House", avatar: HOST.youssef },
  { status: "Currently hosting", guest: "Andrei & family", stay: "Jun 8 – 13 · Sea House", avatar: HOST.andrei },
]

const EARNINGS = [38, 46, 41, 55, 62, 58, 70, 66, 74, 80, 72, 92]
const MONTHS = ["J", "J", "A", "S", "O", "N", "D", "J", "F", "M", "A", "M"]

export function HostTodayScreen() {
  return (
    <Page>
      <header className="grid h-[6.4cqw] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#ebebeb] px-[4cqw]">
        <Logo />
        <nav className="flex gap-[2.4cqw] text-[0.98cqw]">
          {["Today", "Calendar", "Listings", "Messages"].map((item, i) => (
            <span key={item} className={cn("relative py-[0.6cqw]", i === 0 ? "font-semibold" : "")} style={i === 0 ? undefined : { color: MUTED }}>
              {item}
              {i === 0 && <span className="absolute inset-x-0 bottom-0 h-[0.15cqw] rounded-full bg-[#222222]" />}
            </span>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-[1.2cqw]">
          <span className="text-[0.98cqw] font-semibold">Switch to traveling</span>
          <Avatar src={HOST.giulia} size={2.6} />
        </div>
      </header>
      <div className="px-[11cqw] pt-[3cqw]">
        <h1 className="text-[2.4cqw] font-semibold tracking-tight">Welcome back, Giulia</h1>
        <div className="mt-[2cqw] flex gap-[0.6cqw]">
          {["Checking out (1)", "Currently hosting (2)", "Arriving soon (3)", "Upcoming (5)", "Pending review (1)"].map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-full px-[1.1cqw] py-[0.65cqw] text-[0.9cqw] leading-none whitespace-nowrap",
                i === 0 ? "border-2 border-[#222222] font-semibold" : "border border-[#dddddd]",
              )}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="mt-[1.6cqw] grid grid-cols-3 gap-[1.6cqw]">
          {RESERVATIONS.map((r, i) => (
            <div key={r.guest} className="flex h-[11cqw] flex-col justify-between rounded-[1cqw] border border-[#dddddd] p-[1.4cqw]">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn("text-[0.85cqw] font-semibold", i === 0 ? "text-[#8e4585]" : "")} style={i === 0 ? undefined : { color: MUTED }}>
                    {r.status}
                  </p>
                  <p className="mt-[0.4cqw] text-[1.25cqw] font-semibold tracking-tight">{r.guest}</p>
                  <p className="text-[0.9cqw]" style={{ color: MUTED }}>
                    {r.stay}
                  </p>
                </div>
                <Avatar src={r.avatar} size={3} />
              </div>
              <span className="w-fit text-[0.85cqw] font-semibold underline">Message guest</span>
            </div>
          ))}
        </div>
        <div className="mt-[2.4cqw] flex items-end justify-between gap-[4cqw]">
          <div>
            <h2 className="text-[1.45cqw] font-semibold tracking-tight">Earnings this month</h2>
            <p className="mt-[0.6cqw] text-[2.6cqw] leading-none font-semibold tracking-tight">$4,280</p>
            <p className="mt-[0.5cqw] text-[0.85cqw] font-semibold text-[#008a05]">+12% vs last May</p>
          </div>
          <div className="flex h-[10cqw] flex-1 items-end gap-[0.8cqw]">
            {EARNINGS.map((value, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-[0.4cqw]">
                <div
                  className={cn("w-full rounded-t-[0.3cqw]", i === EARNINGS.length - 1 ? "bg-[#8e4585]" : "bg-[#ebebeb]")}
                  style={{ height: `${value * 0.085}cqw` }}
                />
                <span className="text-[0.7cqw]" style={{ color: MUTED }}>
                  {MONTHS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}
