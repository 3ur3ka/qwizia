/**
 * Proxy route: qwizia.com/api/daily → squabblebox.com/api/qwizia/daily
 *
 * The bearer token never reaches the browser — qwizia's page-level fetch
 * hits this same-origin route, and we attach the token server-side. Edge
 * caches the response briefly so a single popular qwizia page-load doesn't
 * generate one round-trip per visitor.
 *
 * Falls back to a 502 with a stale-cache hint if squabblebox is
 * unreachable; the page treats that as "use the local fallback puzzle".
 */

import { NextResponse } from "next/server"
import type { DailyPayload } from "@/lib/daily-types"

// Cache for 1 minute on the edge — the puzzle only changes once a day so
// brief caching is safe and absorbs any accidental traffic spikes.
export const revalidate = 60

export async function GET() {
  const base = process.env.SQUABBLEBOX_API_URL
  const token = process.env.QWIZIA_API_TOKEN
  if (!base || !token) {
    return NextResponse.json(
      { error: "Daily not configured (missing SQUABBLEBOX_API_URL or QWIZIA_API_TOKEN)" },
      { status: 500 },
    )
  }

  try {
    const r = await fetch(`${base}/api/qwizia/daily`, {
      headers: { Authorization: `Bearer ${token}` },
      // Pass through Next's edge cache + ISR — squabblebox sets cache-control
      // headers, but we also want our own short revalidation window.
      next: { revalidate: 60 },
    })
    if (!r.ok) {
      return NextResponse.json(
        { error: `upstream ${r.status}` },
        { status: r.status === 404 ? 404 : 502 },
      )
    }
    const payload = (await r.json()) as DailyPayload
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: `fetch failed: ${(err as Error).message}` },
      { status: 502 },
    )
  }
}
