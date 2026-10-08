/**
 * Content and layout of the Fairbnb desktop screen. The screen is authored in container-query
 * units (cqw of the screen width), so every size below is in cqw: the screen itself is
 * 100cqw wide and 900/1440 × 100 = 62.5cqw tall (a 1440×900 desktop viewport).
 *
 * The bands and cards have fixed heights so the canvas can take the screen apart into
 * frames of exactly the size they are painted at (see airbnb-elements.tsx).
 */

/** Fairbnb's palette: the brand accent is plum. */
export const RAUSCH = "#8e4585";
/** The logo's own plum: a touch deeper than the accent. */
export const LOGO_RED = "#7d3a75";
export const INK = "#222222";
export const MUTED = "#6a6a6a";
export const HAIRLINE = "#ebebeb";
export const WHITE = "#ffffff";

/** Heights, paddings and gaps, in cqw. */
export const LAYOUT = {
  /** Side padding of every band. */
  padX: 4,
  header: 6.4,
  categories: 6,
  /** Space above the first section of the scrolling content. */
  contentTop: 2.4,
  sectionHead: 2.2,
  sectionHeadGap: 1.2,
  tripRow: 12.6,
  sectionGap: 2.4,
  /** The content sits on a five-column grid. */
  columns: 5,
  columnGap: 2,
  /** A listing's photo, and the text block under it. */
  photo: 15.2,
  listingText: 6.4,
  /** Corner radius of the cards and photos. */
  radius: 1,
} as const;

/** Width of one column of the five-column content grid. */
export const COLUMN = (100 - 2 * LAYOUT.padX - (LAYOUT.columns - 1) * LAYOUT.columnGap) / LAYOUT.columns;
/** The trip card spans two columns; the check-in banner beside it, the other three. */
export const TRIP_CARD_WIDTH = 2 * COLUMN + LAYOUT.columnGap;
export const CHECK_IN_WIDTH = 3 * COLUMN + 2 * LAYOUT.columnGap;
export const LISTING_HEIGHT = LAYOUT.photo + LAYOUT.listingText;

export type Trip = {
  title: string;
  lines: string[];
  nights: number;
  photo: string;
  checkIn: string;
  access: string;
};

/** The upcoming stay, pinned above the recommendations. */
export const TRIP: Trip = {
  title: "Vernazza Sea House",
  lines: ["Cinque Terre, Italy", "Jun 12 – 15"],
  nights: 3,
  photo: "/airbnb/stay-2.jpg",
  checkIn: "Thu, 3:00 PM",
  access: "Self check-in",
};

export type Listing = {
  id: string;
  title: string;
  rating: string;
  /** What the stay is, then when it's free. */
  lines: string[];
  price: string;
  photo: string;
  /** object-position of the photo in its crop. */
  focus: string;
  guestFavorite?: boolean;
};

export const LISTINGS: Listing[] = [
  {
    id: "vik",
    title: "Vík, Iceland",
    rating: "4.97",
    lines: ["Aurora glass cabin", "Nov 3 – 8"],
    price: "$312",
    photo: "/airbnb/stay-1.jpg",
    focus: "48% 70%",
    guestFavorite: true,
  },
  {
    id: "ciucas",
    title: "Ciucaș, Romania",
    rating: "4.92",
    lines: ["Mountain lodge", "Sep 18 – 23"],
    price: "$146",
    photo: "/airbnb/stay-3.jpg",
    focus: "67% 60%",
  },
  {
    id: "yosemite",
    title: "Yosemite, California",
    rating: "4.95",
    lines: ["Snowy A-frame", "Dec 12 – 17"],
    price: "$274",
    photo: "/airbnb/stay-4.jpg",
    focus: "34% 45%",
  },
  {
    id: "merzouga",
    title: "Merzouga, Morocco",
    rating: "4.89",
    lines: ["Desert dome", "Oct 6 – 11"],
    price: "$128",
    photo: "/airbnb/stay-5.jpg",
    focus: "42% 55%",
    guestFavorite: true,
  },
  {
    id: "stowe",
    title: "Stowe, Vermont",
    rating: "4.98",
    lines: ["Creekside cabin", "Oct 20 – 25"],
    price: "$219",
    photo: "/airbnb/stay-7.jpg",
    focus: "50% 40%",
  },
];
