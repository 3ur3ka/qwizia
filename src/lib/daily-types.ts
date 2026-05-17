/**
 * Wire types for the daily puzzle returned by the squabblebox API.
 *
 * Mirrors src/lib/games/qwizia-daily/types.ts in the squabblebox repo.
 * If you bump the schema there, mirror the change here. Cross-repo,
 * versioned via the `version` field — qwizia rejects payloads it
 * doesn't recognise rather than rendering garbage.
 */

export type DailyQuestion = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type DailyCity = {
  name: string
  country: string
  flag: string
  lat: number
  lng: number
  questions: DailyQuestion[]
}

export type DailyTheme = {
  id: string
  name: string
  description: string
  /** hex colour, used to tint the city pins + Final Question pill. */
  accent: string
}

export type DailyPolyline = [number, number][]

/** Country outline: list of [lng,lat] rings, one per disconnected landmass.
 *  Drawn under the route to give players a hint of where they are. */
export type DailyBorder = {
  country: string
  rings: [number, number][][]
}

export type DailyRegion =
  | "british-isles"
  | "europe"
  | "north-america"
  | "south-america"
  | "africa"
  | "asia"
  | "oceania"
  | "world"

/** Per-region basemap config. Drives the qwizia page's <Image> source and
 *  the lat/lng → SVG-% projection. Adding a new region: drop a webp into
 *  qwizia/public/maps/, add an entry here, and the validator on the
 *  squabblebox side accepts payloads tagged with that region. */
export type RegionBasemap = {
  /** URL of the equirectangular raster. */
  src: string
  /** Aspect ratio (width / height) for the image's intrinsic size — we use
   *  this to drive the page's responsive sizing. */
  aspect: number
  /** Equirectangular bounds the raster covers. lat/lng → pixel maps via
   *  `(lng - lngMin) / (lngMax - lngMin)` × image width, similar for lat. */
  geo: { latTop: number; latBottom: number; lngLeft: number; lngRight: number }
  /** Default SVG viewport crop on the raster (% of natural width/height) so
   *  the daily page doesn't load the whole world to look at one continent. */
  defaultCrop: { left: number; top: number; width: number; height: number }
}

export const REGION_BASEMAPS: Record<DailyRegion, RegionBasemap> = {
  "british-isles": {
    src: "/squizzle/uk-map.webp",
    aspect: 1500 / 2377,
    geo: { latTop: 61, latBottom: 49, lngLeft: -11, lngRight: 2.2 },
    defaultCrop: { left: 4, top: 39, width: 92, height: 55 },
  },
  europe: {
    src: "/maps/europe.webp",
    aspect: 3375 / 1710,
    geo: { latTop: 72, latBottom: 34, lngLeft: -25, lngRight: 50 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  "north-america": {
    src: "/maps/north-america.webp",
    aspect: 4000 / 2333,
    geo: { latTop: 75, latBottom: 5, lngLeft: -170, lngRight: -50 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  "south-america": {
    src: "/maps/south-america.webp",
    aspect: 2160 / 3150,
    geo: { latTop: 14, latBottom: -56, lngLeft: -82, lngRight: -34 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  africa: {
    src: "/maps/africa.webp",
    aspect: 3375 / 3375,
    geo: { latTop: 38, latBottom: -37, lngLeft: -20, lngRight: 55 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  asia: {
    src: "/maps/asia.webp",
    aspect: 4500 / 2613,
    geo: { latTop: 78, latBottom: -12, lngLeft: 25, lngRight: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  oceania: {
    src: "/maps/oceania.webp",
    aspect: 3150 / 2700,
    geo: { latTop: 10, latBottom: -50, lngLeft: 110, lngRight: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
  world: {
    src: "/maps/world.webp",
    aspect: 8000 / 4000,
    geo: { latTop: 90, latBottom: -90, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
  },
}

export type DailyPayload = {
  version: 1
  date: string
  region: DailyRegion
  theme: DailyTheme
  cities: DailyCity[]
  polylines: DailyPolyline[]
  borders?: DailyBorder[]
  generatedAt: number
}

/** Resolve a region (defaulting to british-isles for any unknown value)
 *  to its basemap config. Used by the page to swap raster + projection. */
export function basemapFor(region: DailyRegion | string | undefined): RegionBasemap {
  if (region && region in REGION_BASEMAPS) {
    return REGION_BASEMAPS[region as DailyRegion]
  }
  return REGION_BASEMAPS["british-isles"]
}
