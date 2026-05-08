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

export type DailyRegion = "british-isles"

export type DailyPayload = {
  version: 1
  date: string
  region: DailyRegion
  theme: DailyTheme
  cities: DailyCity[]
  polylines: DailyPolyline[]
  generatedAt: number
}
