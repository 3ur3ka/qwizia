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
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    // Europe roughly: lng -25..45, lat 34..72.
    // In a 360°×170° equirectangular raster: x% = (lng+180)/360, y% = (85-lat)/170
    defaultCrop: { left: 43, top: 7.6, width: 19.5, height: 22.4 },
  },
  "north-america": {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 2.8, top: 7, width: 33, height: 39 },
  },
  "south-america": {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 27, top: 42, width: 14, height: 41 },
  },
  africa: {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 45, top: 27.6, width: 19.5, height: 43 },
  },
  asia: {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 56.9, top: 4.1, width: 43.1, height: 53 },
  },
  oceania: {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
    defaultCrop: { left: 80.6, top: 47, width: 19.4, height: 35 },
  },
  world: {
    src: "/maps/world.webp",
    aspect: 4000 / 2000,
    geo: { latTop: 85, latBottom: -85, lngLeft: -180, lngRight: 180 },
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
