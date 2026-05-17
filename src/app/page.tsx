"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import prefetchedRoutes from "@/data/squizzle/uk-daily-routes.json"

// Crop on the basemap (% of the natural width/height of the source raster).
type MapViewport = { left: number; top: number; width: number; height: number }
// (MAP_DEFAULT_VIEWPORT is defined below as a region-aware mutable value.)

// ─── Mock puzzle (replace with daily-puzzle API later) ──────────────────────

type DailyQuestion = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

type DailyCity = {
  name: string
  country: string
  flag: string  // emoji
  lat: number
  lng: number
  /** 3 candidate questions per city — one is picked randomly each game.
   *  Empty array marks a destination-only point (no question). */
  questions: DailyQuestion[]
}

/** Fallback used until /api/daily resolves — and as a permanent safety net
 *  if squabblebox is unreachable. Matches the DailyPayload shape's relevant
 *  fields so the rest of the page renders identically either way. */
const FALLBACK_PUZZLE = {
  puzzleNumber: 124,
  international: false,
  destination: "The British Isles",
  cities: [
    {
      name: "Edinburgh",
      country: "Scotland",
      flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
      lat: 55.9533, lng: -3.1883,
      questions: [
        {
          question: "Greyfriars Bobby, the loyal Skye Terrier whose statue stands in the Old Town, sat by his master's grave for how many years?",
          options: ["3", "7", "14", "21"],
          correctIndex: 2,
          explanation: "Bobby spent 14 years (1858–1872) guarding John Gray's grave in Greyfriars Kirkyard. The story inspired books and a 1961 Disney film.",
        },
        {
          question: "Danny Boyle's 1996 cult film Trainspotting is set largely in which Edinburgh district?",
          options: ["Stockbridge", "Leith", "New Town", "Morningside"],
          correctIndex: 1,
          explanation: "Renton, Sick Boy, Begbie & co. tear through Leith — the rough-edged dockside neighbourhood, captured in Irvine Welsh's novel and Boyle's adaptation.",
        },
        {
          question: "J.K. Rowling drafted early Harry Potter chapters in cafés around Edinburgh. The city's medieval Old Town is widely cited as the inspiration for which Potter location?",
          options: ["Diagon Alley", "Hogwarts", "The Leaky Cauldron", "Privet Drive"],
          correctIndex: 1,
          explanation: "The Elephant House and Spoon café both lay claim to early-Potter manuscripts. Edinburgh's Gothic spires and George Heriot's School are widely seen as Hogwarts visual inspirations.",
        },
      ],
    },
    {
      name: "Newcastle",
      country: "England",
      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      lat: 54.9783, lng: -1.6178,
      questions: [
        {
          question: "Which gritty 1971 British crime film, with Michael Caine playing a London gangster avenging his brother, is set across Newcastle and Gateshead?",
          options: ["Get Carter", "The Long Good Friday", "The Italian Job", "Mona Lisa"],
          correctIndex: 0,
          explanation: "Get Carter, directed by Mike Hodges, made dramatic use of Tyneside locations including the now-demolished Trinity Square multi-storey car park.",
        },
        {
          question: "Newcastle's eastern suburb of Wallsend takes its name from being the eastern terminus of which Roman structure?",
          options: ["Antonine Wall", "Hadrian's Wall", "Offa's Dyke", "Watling Street"],
          correctIndex: 1,
          explanation: "Segedunum fort at Wallsend was the very end of Hadrian's Wall (begun AD 122) — the empire's northern frontier ran 73 miles west to the Solway Firth.",
        },
        {
          question: "Which Newcastle-born singer-songwriter, lead of The Police, took his stage name from a striped jumper?",
          options: ["Bryan Ferry", "Sting", "Mark Knopfler", "Brian Johnson"],
          correctIndex: 1,
          explanation: "Gordon Sumner, born in Wallsend in 1951, was nicknamed 'Sting' as a young jazz bassist for a yellow-and-black striped jumper.",
        },
      ], // hardest first: Get Carter (specific film) > Wallsend > Sting
    },
    {
      name: "Manchester",
      country: "England",
      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      lat: 53.4808, lng: -2.2426,
      questions: [
        {
          question: "The Gallagher brothers' band Oasis emerged in 1991 from which south Manchester suburb?",
          options: ["Burnage", "Salford", "Stretford", "Wythenshawe"],
          correctIndex: 0,
          explanation: "Liam and Noel Gallagher grew up in Burnage, where Oasis was originally formed as 'The Rain' before Liam joined and they renamed.",
        },
        {
          question: "Manchester's Industrial Revolution heritage includes the world's first…",
          options: ["Public library", "Inter-city passenger railway", "Football league", "Department store"],
          correctIndex: 1,
          explanation: "The Liverpool & Manchester Railway opened in 1830 — the first inter-city passenger line. The opening was overshadowed when MP William Huskisson became the railway's first fatality.",
        },
        {
          question: "Joy Division, New Order and Happy Mondays all called which legendary Manchester nightclub home in the 1980s and 90s?",
          options: ["The Hacienda", "The Cavern", "Eric's", "Heaven"],
          correctIndex: 0,
          explanation: "Tony Wilson's Factory Records ran the Haçienda from 1982 to 1997 — the heart of the 'Madchester' scene that gave us the Stone Roses, the Mondays and acid house.",
        },
      ], // hardest first: Burnage suburb > world's first railway > Hacienda
    },
    {
      name: "Birmingham",
      country: "England",
      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      lat: 52.4862, lng: -1.8904,
      questions: [
        {
          question: "J.R.R. Tolkien spent his childhood in Birmingham. Which two real local landmarks are widely cited as the inspiration for the 'Two Towers'?",
          options: [
            "The Bull Ring + Selfridges",
            "Perrott's Folly + Edgbaston Waterworks Tower",
            "The Rotunda + Library of Birmingham",
            "Cadbury chimneys + Aston Hall",
          ],
          correctIndex: 1,
          explanation: "Both towers are visible from where Tolkien lived as a boy in Edgbaston — Perrott's Folly is an 18th-century follies; the waterworks tower is Victorian Gothic.",
        },
        {
          question: "Black Sabbath, often credited with inventing heavy metal, formed in 1968 in which Birmingham suburb?",
          options: ["Aston", "Edgbaston", "Smethwick", "Sparkhill"],
          correctIndex: 0,
          explanation: "Tony Iommi, Geezer Butler, Bill Ward and Ozzy Osbourne all grew up in Aston, north Birmingham. The band's dark sound is often traced back to the area's heavy industry.",
        },
        {
          question: "Birmingham famously has more miles of canals than which other city?",
          options: ["Amsterdam", "Venice", "Bruges", "Stockholm"],
          correctIndex: 1,
          explanation: "Birmingham has roughly 35 miles of canals, more than Venice's ~26 — they were the M-roads of the Industrial Revolution.",
        },
      ], // hardest first: Tolkien Two Towers > Black Sabbath Aston > canals
    },
    {
      name: "Cardiff",
      country: "Wales",
      flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
      lat: 51.4816, lng: -3.1791,
      questions: [
        {
          question: "Cardiff Castle was remodelled in extravagant Victorian Gothic style for the 3rd Marquess of Bute by which architect?",
          options: ["Augustus Pugin", "William Burges", "Edwin Lutyens", "George Gilbert Scott"],
          correctIndex: 1,
          explanation: "William Burges turned Cardiff Castle's Norman shell into a riot of medievalism in the 1860s — gilded ceilings, animal-themed rooms, the lot. Bute was reckoned the world's richest man at the time.",
        },
        {
          question: "The Welsh national anthem, 'Hen Wlad Fy Nhadau', translates to…",
          options: ["Land of My Fathers", "Mountains of Heroes", "Country of Song", "Old and Free"],
          correctIndex: 0,
          explanation: "Composed by James and Evan James in 1856, 'Land of My Fathers' is one of the world's oldest national anthems still in use.",
        },
        {
          question: "Cardiff is the birthplace of children's author Roald Dahl, who wrote which 1964 book about a sweet-toothed boy in a magical factory?",
          options: ["James and the Giant Peach", "Charlie and the Chocolate Factory", "The BFG", "Matilda"],
          correctIndex: 1,
          explanation: "Dahl was born in Cardiff in 1916; the city's Roald Dahl Plass at the Bay honours him. Charlie and the Chocolate Factory was published in 1964 and has been adapted for stage and screen many times.",
        },
      ], // hardest first: William Burges (architect) > anthem translation > Dahl
    },
    {
      name: "Land's End",
      country: "England",
      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      lat: 50.0657, lng: -5.7132,
      questions: [
        {
          question: "Cornish folklore claims a sunken kingdom — drowned in a single night and now lying off the coast at Land's End — by what name?",
          options: ["Lyonesse", "Avalon", "Cantref Gwaelod", "Atlantis"],
          correctIndex: 0,
          explanation: "Lyonesse appears in Arthurian legend as the home of Sir Tristan, supposedly submerged on 11 November 1099. The Seven Stones reef between Land's End and Scilly is sometimes pointed to as its remains.",
        },
        {
          question: "The first Atlantic Ocean islands visible from Land's End on a clear day, about 28 miles offshore, are part of which archipelago?",
          options: ["The Channel Islands", "The Hebrides", "The Isles of Scilly", "Lundy"],
          correctIndex: 2,
          explanation: "On a good day you can see Tresco and the rest of the Isles of Scilly from the cliffs at Land's End — the granite outcrops are a popular destination by helicopter and ferry from Penzance.",
        },
        {
          question: "Land's End is the south-westernmost point of mainland Britain. What's the traditional north-eastern endpoint of the LEJOG long-distance journey?",
          options: ["Cape Wrath", "Dunnet Head", "John o' Groats", "Duncansby Head"],
          correctIndex: 2,
          explanation: "John o' Groats has been the symbolic NE end of Britain since the 19th century, even though Dunnet Head is technically further north. The classic LEJOG cycle / walk is roughly 874 miles by road.",
        },
      ], // hardest first: Lyonesse folklore > Isles of Scilly > LEJOG endpoint
    },
  ] as DailyCity[],
}

const STARTING_LIVES = 3

// ─── Page ───────────────────────────────────────────────────────────────────

type GameStatus = "start" | "playing" | "won" | "lost"

type Attempt = { cityIndex: number; correct: boolean }

export default function DailyPage() {
  const [status, setStatus] = useState<GameStatus>("start")
  const [puzzle, setPuzzle] = useState<typeof FALLBACK_PUZZLE | null>(null)
  // Server-supplied road polylines (one per leg). When present, RouteMap uses
  // them directly and skips the live OSRM lookup — avoids 5 round-trips to a
  // public demo API on every cold pageload.
  const [polylines, setPolylines] = useState<LegPolyline[] | null>(null)
  // Server-supplied country borders for the destination, drawn under the
  // route. Optional — older payloads (and the fallback puzzle) won't have it.
  const [borders, setBorders] = useState<{ rings: [number, number][][] }[] | null>(null)
  useEffect(() => {
    let cancelled = false
    // Optional ?date=YYYY-MM-DD URL param so the proxy can fetch a future-
    // seeded puzzle for QA/demo. Anything else is ignored.
    const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
    const dateParam = search?.get("date")
    const dateQuery = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? `?date=${dateParam}` : ""
    fetch(`/api/daily${dateQuery}`)
      .then(async r => (r.ok ? r.json() : null))
      .then(payload => {
        if (cancelled || !payload || payload.version !== 1) return
        // Map the squabblebox DailyPayload onto the local puzzle shape.
        // The fields we use for rendering (cities, theme accent) line up;
        // puzzleNumber + international are qwizia-specific UX fields we
        // synthesise from the date.
        const dayNumber = payload.date
          ? Math.round(
              (Date.UTC(
                Number(payload.date.slice(0, 4)),
                Number(payload.date.slice(5, 7)) - 1,
                Number(payload.date.slice(8, 10)),
              ) -
                Date.UTC(2026, 0, 1)) /
                86_400_000,
            ) + 1
          : FALLBACK_PUZZLE.puzzleNumber
        // Swap the basemap (raster + projection bounds + default crop) to
        // match the payload's region. Done BEFORE setPuzzle so the next
        // render projects coordinates against the right basemap.
        applyBasemap(payload.region)
        // Hand the prebuilt polylines through to RouteMap. Squabblebox already
        // resolved each leg via OSRM at generation time, so the client doesn't
        // need to.
        if (Array.isArray(payload.polylines)) {
          setPolylines(payload.polylines as LegPolyline[])
        }
        if (Array.isArray(payload.borders)) {
          setBorders(payload.borders as { rings: [number, number][][] }[])
        }
        // Ignore payload.theme.crop — it was computed by squabblebox against
        // the old shared world raster, so its %-coords don't map to the new
        // per-continent basemap coordinate system. Open at the full continent
        // for context, then zoom in to fit the route after a short beat so
        // the user gets the wide-shot reveal before settling on the journey.
        setViewport(MAP_DEFAULT_VIEWPORT)
        setPuzzle({
          puzzleNumber: dayNumber,
          international: payload.region !== "british-isles",
          destination: payload.theme?.name ?? FALLBACK_PUZZLE.destination,
          cities: payload.cities,
        } as typeof FALLBACK_PUZZLE)
        setTimeout(() => {
          if (cancelled) return
          setViewport(routeViewport(payload.cities))
        }, 600)
      })
      .catch(() => { /* fall back silently */ })
    return () => { cancelled = true }
  }, [])
  // Index into puzzle.cities — which city's question is currently being asked.
  const [cityIndex, setCityIndex] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [showShare, setShowShare] = useState(false)
  const [viewport, setViewport] = useState<MapViewport>(MAP_DEFAULT_VIEWPORT)
  // Bus position in the points[] index (0 = start city). Index N means the
  // bus has arrived at points[N], i.e., completed N legs.
  const [arrivedAt, setArrivedAt] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  // One question chosen randomly per city at game start. Destination cities
  // (with no questions) get null. Indexed by city index.
  const [chosenQuestions, setChosenQuestions] = useState<(DailyQuestion | null)[]>([])
  const [showDebug, setShowDebug] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    setShowDebug(new URLSearchParams(window.location.search).has("debug"))
  }, [])

  // The number of questioned cities (cities with at least one question).
  const numQuestions = puzzle?.cities.filter(c => c.questions.length > 0).length ?? 0

  const start = () => {
    if (!puzzle) return
    setStatus("playing")
    setCityIndex(0)
    setLives(STARTING_LIVES)
    setAttempts([])
    setArrivedAt(0)
    setAdvancing(false)
    // For the demo, always pick the first (hardest) question per city —
    // questions arrays are pre-ordered hardest-first. Swap the indexing
    // for randomisation later.
    setChosenQuestions(
      puzzle.cities.map(c =>
        c.questions.length > 0 ? c.questions[0] : null
      )
    )
  }

  const onAnswer = (correct: boolean) => {
    setAttempts(a => [...a, { cityIndex, correct }])
    if (correct) {
      // Drive the bus to the next point on the route — including the silent
      // destination after the final question. Question doesn't advance until Next.
      setAdvancing(true)
    } else {
      const left = lives - 1
      setLives(left)
      if (left <= 0) {
        setStatus("lost")
      }
    }
  }

  /** Bus reaches its destination naturally — just settle into the new arrived state. */
  const onBusArrive = () => {
    if (!advancing) return
    setArrivedAt(a => a + 1)
    setAdvancing(false)
  }

  /** User pressed Next after a correct answer. Snap any in-flight bus to its
   *  destination and move to the next question (or win). */
  const onNext = () => {
    if (advancing) {
      setArrivedAt(a => a + 1)
      setAdvancing(false)
    }
    // After answering the last questioned city correctly the bus has been
    // (or is being) driven to the silent destination — that's the win state.
    if (cityIndex + 1 >= numQuestions) {
      setStatus("won")
    } else {
      setCityIndex(c => c + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-800 via-teal-900 to-teal-900 text-teal-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8 min-h-screen flex flex-col">
        <Header
          puzzleNumber={puzzle?.puzzleNumber ?? null}
          lives={status === "playing" ? lives : null}
        />
        {!puzzle && (
          <main className="flex-1 flex items-center justify-center">
            <p className="text-teal-400 text-sm animate-pulse">Loading today's journey…</p>
          </main>
        )}

        {puzzle && <main className="flex-1 flex items-start justify-center pt-3 pb-8">
          <AnimatePresence mode="wait">
            {status === "start" && (
              <StartScreen
                key="start"
                puzzle={puzzle}
                onStart={start}
                viewport={viewport}
                polylines={polylines ?? undefined}
                borders={borders ?? undefined}
              />
            )}
            {status === "playing" && (
              <QuestionScreen
                key="playing"
                puzzle={puzzle}
                cityIndex={cityIndex}
                totalCities={numQuestions}
                arrivedAt={arrivedAt}
                advancing={advancing}
                question={chosenQuestions[cityIndex] ?? puzzle.cities[cityIndex].questions[0]}
                onAnswer={onAnswer}
                onBusArrive={onBusArrive}
                onNext={onNext}
                polylines={polylines ?? undefined}
                borders={borders ?? undefined}
              />
            )}
            {(status === "won" || status === "lost") && (
              <EndScreen
                key="end"
                puzzle={puzzle}
                won={status === "won"}
                lives={lives}
                attempts={attempts}
                onShare={() => setShowShare(true)}
                viewport={viewport}
                polylines={polylines ?? undefined}
                borders={borders ?? undefined}
              />
            )}
          </AnimatePresence>
        </main>}
      </div>

      <AnimatePresence>
        {showShare && puzzle && (
          <ShareModal
            puzzle={puzzle}
            won={status === "won"}
            lives={lives}
            attempts={attempts}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>

      {showDebug && (
        <MapDebugPanel
          viewport={viewport}
          onChange={setViewport}
          onReset={() => setViewport(MAP_DEFAULT_VIEWPORT)}
        />
      )}
    </div>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ puzzleNumber, lives }: { puzzleNumber: number | null; lives: number | null }) {
  // Render the date only after mount. `new Date().toLocaleDateString(undefined, ...)`
  // resolves the locale differently on server (process default) vs client
  // (user agent), and even the same locale can pick a different day if the
  // SSR and hydration straddle midnight. Either case throws React error #418
  // (text mismatch during hydration). An empty initial value keeps SSR/CSR
  // identical; useEffect fills it post-hydration.
  const [date, setDate] = useState("")
  useEffect(() => {
    setDate(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))
  }, [])
  return (
    <header className="flex items-center justify-between py-2 gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-amber-200">Qwizia Daily</h1>
        <p className="text-xs text-teal-400">{puzzleNumber != null ? `#${puzzleNumber} · ` : ""}{date}</p>
      </div>
      {lives !== null && (
        <div className="flex gap-1.5 shrink-0">
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <Heart key={i} filled={i < lives} />
          ))}
        </div>
      )}
    </header>
  )
}

// ─── Route map ──────────────────────────────────────────────────────────────

type RoutePoint = { name: string; lat: number; lng: number }
/** [lng, lat] pairs from OSRM. */
type LegPolyline = [number, number][]

// Active basemap. These are LET, not const — the page rebinds them once on
// mount when the daily payload's region is known (see DailyPage's setBasemap
// call). The page only ever displays one puzzle at a time, so the module-
// level mutability is safe; this avoids drilling a basemap prop through
// every projection helper and the RouteMap component.
//
// Default = British Isles map asset ("Bristish_islands_blank.svg" by Ikonact
// on Wikimedia Commons, licensed CC BY-SA 3.0; equirectangular).
let MAP_W_PX = 990
let MAP_H_PX = 1569
let MAP_GEO = { top: 61.0, bottom: 49.0, left: -11.0, right: 2.2 }
let MAP_HREF = "/squizzle/uk-map.webp"
let MAP_DEFAULT_VIEWPORT: MapViewport = { left: 4, top: 39, width: 92, height: 55 }
let MAP_ATTRIBUTION: { text: string; href: string } | null = {
  text: "Map © Ikonact / CC BY-SA 3.0",
  href: "https://commons.wikimedia.org/wiki/File:Bristish_islands_blank.svg",
}

// Per-region basemap config. Mirrors REGION_BASEMAPS in src/lib/daily-types
// but compiled into the page so we don't ship that whole module client-side.
type RegionId =
  | "british-isles" | "europe" | "north-america" | "south-america"
  | "africa" | "asia" | "oceania" | "world"
type BasemapConfig = {
  src: string
  widthPx: number
  heightPx: number
  geo: { top: number; bottom: number; left: number; right: number }
  defaultCrop: MapViewport
  attribution: { text: string; href: string } | null
}
const NATURAL_EARTH_ATTR = {
  text: "Map © Natural Earth · public domain",
  href: "https://www.naturalearthdata.com/",
}
// Per-continent rasters sliced from Natural Earth II shaded relief
// (16200×8100, public domain). Each image is bounded close to its continent so
// the pixel density at typical zoom stays sharp — the previous shared
// 4000×2000 world raster produced visible blur once cropped to a country.
const REGION_BASEMAPS: Record<RegionId, BasemapConfig> = {
  "british-isles": {
    src: "/squizzle/uk-map.webp",
    widthPx: 990,
    heightPx: 1569,
    geo: { top: 61, bottom: 49, left: -11, right: 2.2 },
    defaultCrop: { left: 4, top: 39, width: 92, height: 55 },
    attribution: {
      text: "Map © Ikonact / CC BY-SA 3.0",
      href: "https://commons.wikimedia.org/wiki/File:Bristish_islands_blank.svg",
    },
  },
  europe: {
    src: "/maps/europe.webp",
    widthPx: 3375, heightPx: 1710,
    geo: { top: 72, bottom: 34, left: -25, right: 50 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  africa: {
    src: "/maps/africa.webp",
    widthPx: 3375, heightPx: 3375,
    geo: { top: 38, bottom: -37, left: -20, right: 55 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  "north-america": {
    src: "/maps/north-america.webp",
    widthPx: 4000, heightPx: 2333,
    geo: { top: 75, bottom: 5, left: -170, right: -50 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  "south-america": {
    src: "/maps/south-america.webp",
    widthPx: 2160, heightPx: 3150,
    geo: { top: 14, bottom: -56, left: -82, right: -34 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  asia: {
    src: "/maps/asia.webp",
    widthPx: 4500, heightPx: 2613,
    geo: { top: 78, bottom: -12, left: 25, right: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  oceania: {
    src: "/maps/oceania.webp",
    widthPx: 3150, heightPx: 2700,
    geo: { top: 10, bottom: -50, left: 110, right: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
  world: {
    src: "/maps/world.webp",
    widthPx: 8000, heightPx: 4000,
    geo: { top: 90, bottom: -90, left: -180, right: 180 },
    defaultCrop: { left: 0, top: 0, width: 100, height: 100 },
    attribution: NATURAL_EARTH_ATTR,
  },
}

function applyBasemap(region: string | undefined) {
  const id = (region && region in REGION_BASEMAPS ? region : "british-isles") as RegionId
  const cfg = REGION_BASEMAPS[id]
  MAP_W_PX = cfg.widthPx
  MAP_H_PX = cfg.heightPx
  MAP_GEO = cfg.geo
  MAP_HREF = cfg.src
  MAP_DEFAULT_VIEWPORT = cfg.defaultCrop
  MAP_ATTRIBUTION = cfg.attribution
}

/** Equirectangular projection matched to the SVG's lat/lng bounds. */
function projectMapPx(lat: number, lng: number): [number, number] {
  const x = ((lng - MAP_GEO.left) / (MAP_GEO.right - MAP_GEO.left)) * MAP_W_PX
  const y = ((MAP_GEO.top - lat) / (MAP_GEO.top - MAP_GEO.bottom)) * MAP_H_PX
  return [x, y]
}

/** Same projection but returning %-of-map coords (matches MapViewport units). */
function projectLatLngPct(lat: number, lng: number): { left: number; top: number } {
  const left = ((lng - MAP_GEO.left) / (MAP_GEO.right - MAP_GEO.left)) * 100
  const top = ((MAP_GEO.top - lat) / (MAP_GEO.top - MAP_GEO.bottom)) * 100
  return { left, top }
}

function legsToProjectedPoints(
  legs: (LegPolyline | null)[],
  fallbackPoints: RoutePoint[]
): [number, number][] {
  const pts: [number, number][] = []
  const push = (p: [number, number]) => {
    const last = pts[pts.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p)
  }
  legs.forEach((leg, i) => {
    if (leg && leg.length > 0) {
      for (const [lng, lat] of leg) push(projectMapPx(lat, lng))
    } else {
      const a = fallbackPoints[i]
      const b = fallbackPoints[i + 1]
      if (a) push(projectMapPx(a.lat, a.lng))
      if (b) push(projectMapPx(b.lat, b.lng))
    }
  })
  return pts
}

/** Cumulative on-screen arc length (uses aspect to weight x correctly). */
function cumulativeArcLength(pts: [number, number][], aspect: number): number[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][0] - pts[i - 1][0]) * aspect
    const dy = pts[i][1] - pts[i - 1][1]
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }
  return cum
}

/** Sample `n` waypoints evenly spaced by arc length. */
function sampleAlongPolyline(pts: [number, number][], n: number, aspect: number): [number, number][] {
  if (pts.length < 2 || n < 2) return [...pts]
  const cum = cumulativeArcLength(pts, aspect)
  const total = cum[cum.length - 1]
  if (total === 0) return Array(n).fill(pts[0])
  const out: [number, number][] = []
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total
    let i = 0
    while (i < cum.length - 2 && cum[i + 1] < target) i++
    const span = cum[i + 1] - cum[i]
    const t = span > 0 ? (target - cum[i]) / span : 0
    out.push([
      pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
      pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
    ])
  }
  return out
}

/** Catmull-Rom → cubic bezier control points for the segment p1→p2. */
function catmullRomControls(
  p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]
): { c1: [number, number]; c2: [number, number] } {
  return {
    c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
  }
}

/** Sample a smooth Catmull-Rom curve through the waypoints. */
function sampleSmoothPath(waypoints: [number, number][], samplesPerSegment: number): [number, number][] {
  const n = waypoints.length
  if (n < 2) return [...waypoints]
  const out: [number, number][] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)]
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]
    const p3 = waypoints[Math.min(n - 1, i + 2)]
    const { c1, c2 } = catmullRomControls(p0, p1, p2, p3)
    for (let s = 0; s <= samplesPerSegment; s++) {
      if (s === 0 && i > 0) continue // dedupe segment joins
      const t = s / samplesPerSegment
      const u = 1 - t
      const x = u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0]
      const y = u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]
      out.push([x, y])
    }
  }
  return out
}

/** Smooth Catmull-Rom cubic-bezier path D for a single leg, in map-px coords.
 *  Same 6-waypoint smoothing the bus uses, so the road and the bus follow the
 *  exact same curve and the bus never appears to leave the road or "flap". */
function legPathD(leg: LegPolyline | null): string {
  if (!leg || leg.length === 0) return ""
  const raw: [number, number][] = leg.map(([lng, lat]) => projectMapPx(lat, lng))
  if (raw.length < 2) return ""
  const waypoints = raw.length <= 6 ? raw : sampleAlongPolyline(raw, 6, 1)
  if (waypoints.length === 2) {
    return `M ${waypoints[0][0].toFixed(1)} ${waypoints[0][1].toFixed(1)} L ${waypoints[1][0].toFixed(1)} ${waypoints[1][1].toFixed(1)}`
  }
  let d = `M ${waypoints[0][0].toFixed(1)} ${waypoints[0][1].toFixed(1)}`
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)]
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]
    const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)]
    const { c1, c2 } = catmullRomControls(p0, p1, p2, p3)
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

const PREFETCHED_ROUTES = prefetchedRoutes as unknown as Record<string, [number, number][]>
const LS_PREFIX = "squizzle:osrm:"

function legCacheKey(a: RoutePoint, b: RoutePoint): string {
  return `${a.lat},${a.lng}->${b.lat},${b.lng}`
}

/** Resolve a leg's polyline. Order: (1) bundled prefetched JSON, (2) localStorage,
 *  (3) OSRM public demo API (results cached in localStorage for next time). */
async function fetchLegPolyline(a: RoutePoint, b: RoutePoint): Promise<LegPolyline | null> {
  const key = legCacheKey(a, b)

  // (1) Bundled / prefetched.
  const bundled = PREFETCHED_ROUTES[key]
  if (Array.isArray(bundled) && bundled.length >= 2) return bundled

  // (2) localStorage.
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LS_PREFIX + key)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed as LegPolyline
      }
    } catch {
      // Ignore quota / parse errors.
    }
  }

  // (3) Network.
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(coords))
      } catch {
        // Ignore quota errors.
      }
    }
    return coords as LegPolyline
  } catch {
    return null
  }
}

function RouteMap({
  points,
  reachedCount,
  arrivedAt: arrivedAtProp,
  onArrive,
  className,
  viewport = MAP_DEFAULT_VIEWPORT,
  polylines,
  borders,
  interactive,
}: {
  points: RoutePoint[]
  /** Where the bus should end up. If undefined, no bus. */
  reachedCount?: number
  /** Current settled bus position. Defaults to reachedCount (no animation). */
  arrivedAt?: number
  /** Fired when the bus animation finishes a leg. */
  onArrive?: () => void
  className?: string
  viewport?: MapViewport
  /** Server-supplied road polylines (one per leg). When present we skip the
   *  live OSRM lookup entirely. */
  polylines?: LegPolyline[]
  /** Country outlines for the destination, drawn beneath the route. */
  borders?: { rings: [number, number][][] }[]
  /** Enable user pan/zoom (wheel, pinch, drag, +/- buttons). Used on the
   *  end screen so players can explore the route after finishing. */
  interactive?: boolean
}) {
  const targetVp = viewport
  const arrivedAt = arrivedAtProp ?? reachedCount ?? 0
  // Resolve real road geometry per leg. If the caller passed `polylines`
  // (from the daily payload), use those directly — no network. Otherwise
  // fall back to the bundled-prefetched → localStorage → OSRM ladder.
  const legsKey = points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|")
  const expectedLegs = Math.max(0, points.length - 1)
  const usePropPolylines = polylines && polylines.length === expectedLegs
  const [legs, setLegs] = useState<(LegPolyline | null)[]>(() =>
    usePropPolylines ? (polylines as LegPolyline[]) : Array(expectedLegs).fill(null)
  )
  useEffect(() => {
    if (usePropPolylines) {
      setLegs(polylines as LegPolyline[])
      return
    }
    let cancelled = false
    const pairs: [RoutePoint, RoutePoint][] = []
    for (let i = 0; i < points.length - 1; i++) pairs.push([points[i], points[i + 1]])
    Promise.all(pairs.map(([a, b]) => fetchLegPolyline(a, b))).then(results => {
      if (!cancelled) setLegs(results)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legsKey, usePropPolylines])

  // Aspect ratio of the cropped viewport — locked across legs by cityLegViewport.
  const aspect = (targetVp.width * MAP_W_PX) / (targetVp.height * MAP_H_PX)
  const reached = Math.max(0, Math.min(reachedCount ?? 0, points.length - 1))

  // Stable map-px geometry — independent of viewport, so SVG path D strings
  // don't need to be recomputed when the viewport pans/zooms.
  const projectedStops = useMemo(
    () => points.map(p => projectMapPx(p.lat, p.lng)),
    [points]
  )
  const legPathDs = useMemo(() => legs.map(leg => legPathD(leg)), [legs])

  // Border path Ds in map-px coords. Each ring becomes one closed sub-path so
  // multipolygon countries (islands, etc.) render as a single SVG path.
  const borderPathD = useMemo(() => {
    if (!borders || borders.length === 0) return ""
    const parts: string[] = []
    for (const b of borders) {
      for (const ring of b.rings) {
        if (ring.length < 2) continue
        const segs: string[] = []
        for (let i = 0; i < ring.length; i++) {
          const [lng, lat] = ring[i]
          const [x, y] = projectMapPx(lat, lng)
          segs.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
        }
        segs.push("Z")
        parts.push(segs.join(" "))
      }
    }
    return parts.join(" ")
  }, [borders])

  // Smoothed sample path for the bus's currently-driving leg.
  const animatingLegPoints = useMemo(() => {
    if (reached <= arrivedAt) return [] as [number, number][]
    const raw = legsToProjectedPoints(legs.slice(arrivedAt, reached), points.slice(arrivedAt, reached + 1))
    if (raw.length < 2) return raw
    // 6 evenly-spaced waypoints, then a smooth Catmull-Rom curve through them.
    // Aspect = 1 because we're already in image-pixel coords (square units).
    const waypoints = sampleAlongPolyline(raw, 6, 1)
    return sampleSmoothPath(waypoints, 14)
  }, [legs, points, arrivedAt, reached])

  const showStaticBus = reachedCount !== undefined && reached === arrivedAt
  const showAnimatingBus = reachedCount !== undefined && reached > arrivedAt && animatingLegPoints.length >= 2
  const staticBusPos = projectedStops[arrivedAt]

  // ── Imperative viewport tween ─────────────────────────────────────────────
  // Per-frame state lives in refs and DOM attributes — React doesn't re-render
  // RouteMap during the pan, so we avoid 60 fps reconciliation work.
  const svgRef = useRef<SVGSVGElement>(null)
  const stopRefs = useRef<Array<HTMLDivElement | null>>([])
  const staticBusRef = useRef<HTMLDivElement | null>(null)
  const currentVpRef = useRef<MapViewport>(targetVp)
  // Snapshots so the imperative `apply` always reads the latest geometry
  // even though it lives inside a stable closure.
  const stopsRef = useRef(projectedStops); stopsRef.current = projectedStops
  const staticBusPosRef = useRef(staticBusPos); staticBusPosRef.current = staticBusPos

  /** Write the given viewport to the SVG and HTML overlay elements directly. */
  const applyVp = (v: MapViewport) => {
    if (svgRef.current) {
      svgRef.current.setAttribute(
        "viewBox",
        `${(v.left * MAP_W_PX) / 100} ${(v.top * MAP_H_PX) / 100} ` +
        `${(v.width * MAP_W_PX) / 100} ${(v.height * MAP_H_PX) / 100}`
      )
    }
    const stops = stopsRef.current
    for (let i = 0; i < stops.length; i++) {
      const el = stopRefs.current[i]
      if (!el) continue
      const [wx, wy] = stops[i]
      const cx = (((wx / MAP_W_PX) * 100 - v.left) / v.width) * 100
      const cy = (((wy / MAP_H_PX) * 100 - v.top) / v.height) * 100
      el.style.left = `${cx}%`
      el.style.top = `${cy}%`
    }
    const sb = staticBusPosRef.current
    if (staticBusRef.current && sb) {
      const cx = (((sb[0] / MAP_W_PX) * 100 - v.left) / v.width) * 100
      const cy = (((sb[1] / MAP_H_PX) * 100 - v.top) / v.height) * 100
      staticBusRef.current.style.left = `${cx}%`
      staticBusRef.current.style.top = `${cy}%`
    }
  }

  // Sync DOM to the live viewport before every paint — covers first mount and
  // any geometry change (new stops, new static bus position).
  useLayoutEffect(() => {
    applyVp(currentVpRef.current)
    // applyVp is stable in spirit; the deps tracked here are the geometry
    // snapshots that affect what `apply` writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectedStops, staticBusPos, showStaticBus, showAnimatingBus])

  // Cancels the in-flight autotween rAF. User gestures grab this ref so the
  // map doesn't fight pinch/wheel/drag. The autotween useEffect (re)assigns it
  // on each new targetVp.
  const tweenCancelRef = useRef<(() => void) | null>(null)

  // Tween from currentVpRef to the new target whenever the prop changes.
  useEffect(() => {
    const start = { ...currentVpRef.current }
    const target = targetVp
    if (
      start.left === target.left && start.top === target.top &&
      start.width === target.width && start.height === target.height
    ) {
      return
    }
    const startTime = performance.now()
    // Match the bus drive (1.8 s); easeInOutSine — gentle, no perceived shimmy.
    const duration = 1800
    let frameId = 0
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const e = -(Math.cos(Math.PI * t) - 1) / 2
      const v: MapViewport = {
        left: start.left + (target.left - start.left) * e,
        top: start.top + (target.top - start.top) * e,
        width: start.width + (target.width - start.width) * e,
        height: start.height + (target.height - start.height) * e,
      }
      currentVpRef.current = v
      applyVp(v)
      if (t < 1) frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    tweenCancelRef.current = () => cancelAnimationFrame(frameId)
    return () => cancelAnimationFrame(frameId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetVp])

  // ── User pan/zoom (only when `interactive`) ───────────────────────────────
  // Mutates currentVpRef + DOM directly via applyVp, same as the autotween.
  // The autotween only re-fires when targetVp prop changes, so user state is
  // preserved across re-renders of the parent.
  const containerRef = useRef<HTMLDivElement>(null)
  // Stable view of the target — wheel/pinch handlers read it in stable closures
  // without subscribing to props. (initial / reset fallback.)
  const initialVpRef = useRef(targetVp); initialVpRef.current = targetVp
  // Bump to force a re-render of overlay controls (button enable/disable).
  const [, setUserVpTick] = useState(0)

  /** Clamp + commit a viewport to currentVpRef and the DOM. */
  const commitVp = (v: MapViewport) => {
    // Min zoom: 4% wide / tall (very tight). Max: 100% (whole basemap).
    const minSize = 4
    const maxSize = 100
    let w = Math.max(minSize, Math.min(maxSize, v.width))
    let h = Math.max(minSize, Math.min(maxSize, v.height))
    // Pan clamp: keep the viewport inside [0..100] on both axes.
    let l = Math.max(0, Math.min(100 - w, v.left))
    let t = Math.max(0, Math.min(100 - h, v.top))
    const next = { left: l, top: t, width: w, height: h }
    currentVpRef.current = next
    applyVp(next)
  }

  /** Zoom by `factor` (< 1 zooms in) around a focal point given in % of the
   *  container — keeps the world coord under the focal point stationary. */
  const zoomAround = (factor: number, focalXPct = 50, focalYPct = 50) => {
    tweenCancelRef.current?.()
    const v = currentVpRef.current
    // World % under the focal point right now.
    const fx = v.left + (focalXPct / 100) * v.width
    const fy = v.top + (focalYPct / 100) * v.height
    const newW = v.width * factor
    const newH = v.height * factor
    const newL = fx - (focalXPct / 100) * newW
    const newT = fy - (focalYPct / 100) * newH
    commitVp({ left: newL, top: newT, width: newW, height: newH })
    setUserVpTick(n => n + 1)
  }

  /** Pan by dx/dy expressed as % of container size. */
  const panBy = (dxPct: number, dyPct: number) => {
    tweenCancelRef.current?.()
    const v = currentVpRef.current
    commitVp({
      left: v.left - (dxPct / 100) * v.width,
      top: v.top - (dyPct / 100) * v.height,
      width: v.width,
      height: v.height,
    })
  }

  useEffect(() => {
    if (!interactive) return
    const el = containerRef.current
    if (!el) return

    const focalFromEvent = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect()
      return [
        ((e.clientX - rect.left) / rect.width) * 100,
        ((e.clientY - rect.top) / rect.height) * 100,
      ] as [number, number]
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const [fx, fy] = focalFromEvent(e)
      // Trackpad ticks are small; mouse wheels are large. Normalise to ~5% per notch.
      const intensity = Math.min(0.25, Math.abs(e.deltaY) / 500)
      const factor = e.deltaY < 0 ? 1 - intensity : 1 + intensity
      zoomAround(factor, fx, fy)
    }

    // Pointer state for drag + pinch.
    const pointers = new Map<number, { x: number; y: number }>()
    let lastSingle: { x: number; y: number } | null = null
    let lastPinch: { dist: number; midX: number; midY: number } | null = null

    const pinchDist = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const pinchMid = () => {
      const [a, b] = [...pointers.values()]
      return [(a.x + b.x) / 2, (a.y + b.y) / 2] as [number, number]
    }

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      tweenCancelRef.current?.()
      if (pointers.size === 1) {
        lastSingle = { x: e.clientX, y: e.clientY }
        lastPinch = null
      } else if (pointers.size === 2) {
        lastSingle = null
        const [mx, my] = pinchMid()
        lastPinch = { dist: pinchDist(), midX: mx, midY: my }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 1 && lastSingle) {
        const rect = el.getBoundingClientRect()
        const dxPct = ((e.clientX - lastSingle.x) / rect.width) * 100
        const dyPct = ((e.clientY - lastSingle.y) / rect.height) * 100
        lastSingle = { x: e.clientX, y: e.clientY }
        panBy(dxPct, dyPct)
      } else if (pointers.size === 2 && lastPinch) {
        const rect = el.getBoundingClientRect()
        const dist = pinchDist()
        const [mx, my] = pinchMid()
        const factor = lastPinch.dist / Math.max(1, dist)
        const fxPct = ((mx - rect.left) / rect.width) * 100
        const fyPct = ((my - rect.top) / rect.height) * 100
        zoomAround(factor, fxPct, fyPct)
        // Pan by the midpoint shift so the pinch also drags the map naturally.
        const dxPct = ((mx - lastPinch.midX) / rect.width) * 100
        const dyPct = ((my - lastPinch.midY) / rect.height) * 100
        panBy(dxPct, dyPct)
        lastPinch = { dist, midX: mx, midY: my }
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      try { el.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
      if (pointers.size < 2) lastPinch = null
      if (pointers.size === 0) lastSingle = null
      else if (pointers.size === 1) {
        const [p] = [...pointers.values()]
        lastSingle = { x: p.x, y: p.y }
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove)
    el.addEventListener("pointerup", onPointerUp)
    el.addEventListener("pointercancel", onPointerUp)

    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", onPointerUp)
      el.removeEventListener("pointercancel", onPointerUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  const resetView = () => {
    tweenCancelRef.current?.()
    commitVp(initialVpRef.current)
    setUserVpTick(n => n + 1)
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        aspectRatio: aspect,
        touchAction: interactive ? "none" : undefined,
        cursor: interactive ? "grab" : undefined,
      }}
    >
      {/* Vector layer: SVG whose viewBox is updated imperatively by the
          tween rAF — React doesn't reconcile this element during the pan. */}
      <svg
        ref={svgRef}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Route map"
      >
        <image
          href={MAP_HREF}
          x={0}
          y={0}
          width={MAP_W_PX}
          height={MAP_H_PX}
          preserveAspectRatio="none"
        />
        <rect x={0} y={0} width={MAP_W_PX} height={MAP_H_PX} fill="rgba(15,76,76,0.10)" />

        {/* Country border — soft amber outline with a faint tint, sits between
            the basemap and the route. Drawn as a single multi-subpath so even
            archipelago countries render with one stroke. */}
        {borderPathD && (
          <path
            d={borderPathD}
            fill="rgba(251,191,36,0.10)"
            stroke="rgba(251,191,36,0.85)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Roads — wrapped in a fading group so they appear softly once the
            real OSRM polylines have arrived (no straight-line flash). */}
        <g
          style={{
            opacity: legPathDs.some(d => d) ? 1 : 0,
            transition: "opacity 0.5s ease-out",
          }}
        >
          {/* Road shadow */}
          {legPathDs.map((d, i) => d ? (
            <path
              key={`s-${i}`}
              d={d}
              fill="none"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null)}

          {/* Green base road */}
          {legPathDs.map((d, i) => d ? (
            <path
              key={`g-${i}`}
              d={d}
              fill="none"
              stroke="#1e3a26"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null)}

          {/* Red trail */}
          {legPathDs.map((d, i) => {
            if (!d) return null
            const completed = i < arrivedAt
            const driving = i === arrivedAt && reached > arrivedAt
            return (
              <RedTrailPath
                key={`r-${i}`}
                d={d}
                strokeWidth={3}
                completed={completed}
                driving={driving}
                durationSec={1.8}
              />
            )
          })}
        </g>
      </svg>

      {/* HTML overlay layer — left/top are written imperatively each frame
          by the viewport tween (see applyVp in useLayoutEffect / useEffect). */}
      {projectedStops.map((_, i) => {
        const isEdge = i === 0 || i === points.length - 1
        // Choose label side based on the leg's target viewport; doesn't need to
        // re-evaluate every frame so we read targetVp directly.
        const [wx] = projectedStops[i]
        const labelLeft = (((wx / MAP_W_PX) * 100 - targetVp.left) / targetVp.width) * 100 > 55
        return (
          <div
            key={i}
            ref={el => { stopRefs.current[i] = el }}
            className="absolute pointer-events-none"
          >
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                isEdge
                  ? "w-2 h-2 bg-amber-300 border-amber-900"
                  : "w-1.5 h-1.5 bg-amber-200 border-amber-900"
              } shadow`}
            />
            <div
              className="absolute -translate-y-1/2 text-[10px] font-bold tracking-tight whitespace-nowrap"
              style={{
                left: labelLeft ? undefined : 8,
                right: labelLeft ? 8 : undefined,
                color: "#fef3c7",
                textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              {points[i].name}
            </div>
          </div>
        )
      })}

      {showStaticBus && staticBusPos && (
        <div
          ref={staticBusRef}
          className="absolute pointer-events-none"
          style={{
            transform: "translate(-50%, -50%)",
            fontSize: 24,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
          }}
        >
          🚌
        </div>
      )}
      {showAnimatingBus && (
        <BusMarker
          key={`bus-anim-${arrivedAt}-${reached}`}
          points={animatingLegPoints}
          durationSec={1.8}
          onComplete={onArrive}
          currentVpRef={currentVpRef}
        />
      )}

      {/* Basemap attribution (links to source). UK map is CC BY-SA 3.0;
          Natural Earth is public domain. Hidden if the basemap has no
          attribution requirement. */}
      {MAP_ATTRIBUTION && (
        <a
          href={MAP_ATTRIBUTION.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1 right-2 text-[8px] text-teal-100/70 hover:text-teal-100 underline-offset-2 hover:underline pointer-events-auto"
          style={{ textShadow: "0 0 2px rgba(0,0,0,0.85)" }}
        >
          {MAP_ATTRIBUTION.text}
        </a>
      )}

      {interactive && (
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomAround(0.75)}
            className="w-8 h-8 rounded-full bg-teal-900/85 hover:bg-teal-800 text-teal-50 text-xl leading-none font-bold border border-teal-700/60 shadow-md"
          >+</button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomAround(1 / 0.75)}
            className="w-8 h-8 rounded-full bg-teal-900/85 hover:bg-teal-800 text-teal-50 text-xl leading-none font-bold border border-teal-700/60 shadow-md"
          >−</button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={resetView}
            className="w-8 h-8 rounded-full bg-teal-900/85 hover:bg-teal-800 text-teal-50 text-base leading-none border border-teal-700/60 shadow-md"
          >⤾</button>
        </div>
      )}
    </div>
  )
}

/** A single SVG path that draws the red trail for one leg.
 *  - completed → fully visible
 *  - driving   → animates from invisible to fully visible over `durationSec`
 *  - upcoming  → invisible
 *  Uses pathLength=1 + dasharray=1 so dashoffset is a clean 0..1. */
function RedTrailPath({
  d, strokeWidth, completed, driving, durationSec,
}: {
  d: string
  strokeWidth: number
  completed: boolean
  driving: boolean
  durationSec: number
}) {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    if (!ref.current || !driving) return
    const anim = ref.current.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: durationSec * 1000, easing: "linear", fill: "forwards" }
    )
    return () => anim.cancel()
  }, [driving, durationSec, d])
  const initialOffset = completed ? 0 : 1
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke="#dc2626"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={initialOffset}
    />
  )
}

/** Bus that drives a smooth Catmull-Rom polyline. Position interpolation runs
 *  in stable world-px coords (independent of the viewport tween) and is
 *  projected to container-% each frame so the bus stays correctly placed even
 *  if the map happens to pan during the drive. */
function BusMarker({
  points, durationSec, onComplete, currentVpRef,
}: {
  /** Smoothed sample points in world (map-px) coords. */
  points: [number, number][]
  durationSec: number
  onComplete?: () => void
  /** Live viewport ref written every frame by the parent's tween rAF. */
  currentVpRef: React.MutableRefObject<MapViewport>
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rotateRef = useRef<HTMLDivElement>(null)
  const vpRef = currentVpRef

  useEffect(() => {
    const N = points.length
    if (N < 2 || !wrapperRef.current || !rotateRef.current) return

    // Cumulative arc length in world-px units.
    const cum: number[] = [0]
    for (let i = 1; i < N; i++) {
      const dx = points[i][0] - points[i - 1][0]
      const dy = points[i][1] - points[i - 1][1]
      cum.push(cum[i - 1] + Math.hypot(dx, dy))
    }
    const total = cum[N - 1] || 1

    // One horizontal flip for the whole leg, chosen by whether the leg ends
    // east or west of where it started. The bus emoji is asymmetric (wheels
    // bottom, "front" right by default) — rotating past ±90° would render it
    // upside-down. Mirroring with scaleX(-1) keeps it right-side-up for
    // west-bound legs and lets the per-frame rotation stay within [-90, 90].
    const legFlip = points[N - 1][0] < points[0][0] ? -1 : 1

    // Per-sample tangent angles. Wide window (±5 samples) averages out
    // per-sample noise from the smoothed bezier.
    const SPAN = 5
    const rotates: number[] = points.map((_, i) => {
      const prev = points[Math.max(0, i - SPAN)]
      const next = points[Math.min(N - 1, i + SPAN)]
      const raw = (Math.atan2(next[1] - prev[1], next[0] - prev[0]) * 180) / Math.PI
      // East-bound: raw is the visual rotation directly. West-bound: with the
      // scaleX(-1) applied at render, the visible angle = 180 - raw, so we
      // pre-compute that.
      let v = legFlip === 1 ? raw : 180 - raw
      // Normalize to (-180, 180].
      while (v > 180) v -= 360
      while (v <= -180) v += 360
      // Clamp any "wrong-direction" excursion (a brief eastward dip on a
      // west-bound leg, or vice versa) to keep the bus upright. Capping at
      // ±90 reads as a steeper tilt; allowing past that would flip it.
      if (v > 90) v = 90
      else if (v < -90) v = -90
      return v
    })

    let frameId = 0
    const startTime = performance.now()
    const totalMs = durationSec * 1000
    const apply = (wx: number, wy: number, deg: number) => {
      const v = vpRef.current
      const cx = ((wx / MAP_W_PX) * 100 - v.left) / v.width * 100
      const cy = ((wy / MAP_H_PX) * 100 - v.top) / v.height * 100
      if (wrapperRef.current) {
        wrapperRef.current.style.left = `${cx}%`
        wrapperRef.current.style.top = `${cy}%`
      }
      if (rotateRef.current) {
        rotateRef.current.style.transform = `scaleX(${legFlip}) rotate(${deg}deg)`
      }
    }
    apply(points[0][0], points[0][1], rotates[0])

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / totalMs, 1)
      const dist = t * total
      let i = 0
      while (i < N - 2 && cum[i + 1] < dist) i++
      const span = cum[i + 1] - cum[i]
      const u = span > 0 ? (dist - cum[i]) / span : 0
      const wx = points[i][0] + (points[i + 1][0] - points[i][0]) * u
      const wy = points[i][1] + (points[i + 1][1] - points[i][1]) * u
      const r = rotates[i] + (rotates[i + 1] - rotates[i]) * u
      apply(wx, wy, r)
      if (t < 1) {
        frameId = requestAnimationFrame(tick)
      } else if (onComplete) {
        onComplete()
      }
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [points, durationSec, onComplete])

  if (points.length < 2) return null

  return (
    <div
      ref={wrapperRef}
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: 0, height: 0 }}
    >
      <div style={{ position: "absolute", transform: "translate(-50%, -50%)" }}>
        <div
          ref={rotateRef}
          style={{
            display: "inline-block",
            fontSize: 24,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
          }}
        >
          🚌
        </div>
      </div>
    </div>
  )
}

// ─── Start screen ───────────────────────────────────────────────────────────

function StartScreen({
  puzzle, onStart, viewport, polylines, borders,
}: {
  puzzle: typeof FALLBACK_PUZZLE
  onStart: () => void
  viewport: MapViewport
  polylines?: LegPolyline[]
  borders?: { rings: [number, number][][] }[]
}) {
  const numQuestions = puzzle.cities.filter(c => c.questions.length > 0).length
  const start = puzzle.cities[0]
  const end = puzzle.cities[puzzle.cities.length - 1]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md space-y-4"
    >
      {/* Today's journey title — above the map */}
      <div className="rounded-2xl border bg-teal-900/95 border-teal-700/60 px-4 py-2.5 sm:px-5 sm:py-3 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-teal-50">Today's journey · {puzzle.destination}</h2>
        <p className="text-teal-300 text-xs sm:text-sm mt-0.5">{numQuestions} questions · 3 lives</p>
      </div>

      {/* Map */}
      <RouteMap
        points={puzzle.cities.map(c => ({ name: c.name, lat: c.lat, lng: c.lng }))}
        viewport={viewport}
        polylines={polylines}
        borders={borders}
        className="w-full rounded-2xl border border-teal-700/40 bg-teal-950/40"
      />

      {/* Below the map — From→To + Begin journey */}
      <div className="rounded-2xl border bg-teal-900/95 border-teal-700/60 px-4 py-3 sm:px-5 sm:py-4 space-y-3">
        <div className="flex items-center justify-center gap-3 text-xl sm:text-2xl font-bold text-teal-50">
          {puzzle.international && <span>{start.flag}</span>}
          <span>{start.name}</span>
          <span className="text-amber-300">→</span>
          <span>{end.name}</span>
          {puzzle.international && <span>{end.flag}</span>}
        </div>
        <button
          onClick={onStart}
          className="w-full py-3 rounded-xl bg-amber-400 text-amber-950 font-bold text-base sm:text-lg hover:bg-amber-300 transition shadow-lg shadow-amber-500/20"
        >
          Begin journey
        </button>
      </div>

      <p className="text-xs text-teal-500 text-center">
        New puzzle every day at midnight UTC. Same questions for everyone.
      </p>
    </motion.div>
  )
}

// ─── Question screen ────────────────────────────────────────────────────────

function QuestionScreen({
  puzzle, cityIndex, totalCities, arrivedAt, advancing, question, onAnswer, onBusArrive, onNext, polylines, borders,
}: {
  puzzle: typeof FALLBACK_PUZZLE
  cityIndex: number
  totalCities: number
  arrivedAt: number
  advancing: boolean
  question: DailyQuestion
  onAnswer: (correct: boolean) => void
  onBusArrive: () => void
  onNext: () => void
  polylines?: LegPolyline[]
  borders?: { rings: [number, number][][] }[]
}) {
  // Index of the correct pick once the user gets it right (locks the answer).
  const [pickedCorrect, setPickedCorrect] = useState<number | null>(null)
  // All wrong indices the user has tried — they stay visible as crosses and
  // are disabled so the user can't pick them again. Lives decrement each time.
  const [wrongPicks, setWrongPicks] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState(false)

  // Reset state when a new question is shown.
  useEffect(() => {
    setPickedCorrect(null)
    setWrongPicks(new Set())
    setRevealed(false)
  }, [cityIndex])

  // Once the user has picked correctly, briefly show the tick before flipping
  // the info card to the explanation + Next button.
  useEffect(() => {
    if (pickedCorrect === null) return
    const t = setTimeout(() => setRevealed(true), 700)
    return () => clearTimeout(t)
  }, [pickedCorrect])

  const handlePick = (i: number) => {
    if (revealed || pickedCorrect !== null) return
    if (wrongPicks.has(i)) return
    const correct = i === question.correctIndex
    if (correct) {
      setPickedCorrect(i)
    } else {
      setWrongPicks(prev => {
        const next = new Set(prev)
        next.add(i)
        return next
      })
    }
    onAnswer(correct)
  }

  const handleNext = () => {
    if (pickedCorrect === null) return
    onNext()
  }

  // Map zoom: frame the current city plus the next one (so the upcoming drive
  // is visible). On the last city, just frame the current one.
  const points: RoutePoint[] = useMemo(
    () => puzzle.cities.map(c => ({ name: c.name, lat: c.lat, lng: c.lng })),
    [puzzle]
  )
  const targetViewport = useMemo(() => {
    // While the bus is driving, look ahead one stop so the map pans toward the
    // next leg in lockstep with the bus, instead of waiting for Next to be
    // clicked. Once the bus has arrived (advancing flips back to false) the
    // viewport already matches the new arrived position, so no extra pan.
    const baseIdx = advancing ? arrivedAt + 1 : arrivedAt
    const a = points[baseIdx] ?? points[points.length - 1]
    const b = points[baseIdx + 1] ?? points[baseIdx - 1] ?? a
    return cityLegViewport(a, b)
  }, [points, advancing, arrivedAt])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md space-y-5"
    >
      {/* Progress bar at the very top */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalCities }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition ${
              i < cityIndex ? "bg-amber-400" : i === cityIndex ? "bg-amber-300/60" : "bg-teal-800"
            }`}
          />
        ))}
      </div>

      {/* Map (full container width) — acts as the background; question and
          options float on top with a backdrop blur. */}
      <div className="relative">
        <RouteMap
          points={points}
          viewport={targetViewport}
          reachedCount={advancing ? arrivedAt + 1 : arrivedAt}
          arrivedAt={arrivedAt}
          onArrive={onBusArrive}
          polylines={polylines}
          borders={borders}
          className="w-full rounded-2xl border border-teal-700/40 bg-teal-950/40"
        />

        {/* Map overlay — only the question card sits on the map now; the
            answer buttons and info card live below the map. */}
        <div
          className={`absolute inset-x-0 top-0 p-2 sm:p-3 transition-opacity duration-300 ${
            revealed ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div
            className={`rounded-2xl border px-4 py-2.5 sm:px-5 sm:py-3 backdrop-blur-md transition-colors ${
              cityIndex === totalCities - 1
                ? "bg-amber-500/95 border-amber-300 shadow-lg shadow-amber-500/30"
                : "bg-teal-900/95 border-teal-700/60"
            }`}
          >
            {cityIndex === totalCities - 1 && (
              <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-amber-950 text-center mb-1">
                Final question
              </p>
            )}
            <p
              className={`text-lg sm:text-xl leading-relaxed text-center ${
                cityIndex === totalCities - 1 ? "text-amber-950 font-semibold" : "text-teal-50"
              }`}
            >
              {question.question}
            </p>
          </div>
        </div>
      </div>

      {/* Below the map — answer-button grid and the info card share the same
          grid cell so the info card covers the buttons in-place when the user
          gets it right. */}
      <div className="grid">
        <div
          style={{ gridArea: "1 / 1" }}
          className={`grid grid-cols-2 gap-2 transition-opacity duration-300 ${
            revealed ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {question.options.map((opt, i) => {
            const isCorrectPick = pickedCorrect === i
            const isWrongPick = wrongPicks.has(i)
            let cls = "bg-teal-900/80 border-teal-700/60 hover:bg-teal-800/90 hover:border-teal-500 text-teal-50"
            if (isCorrectPick) cls = "bg-emerald-500/90 border-emerald-300 text-emerald-50"
            else if (isWrongPick) cls = "bg-rose-900/70 border-rose-700/80 text-rose-200/70"
            return (
              <button
                key={i}
                onClick={() => handlePick(i)}
                disabled={isWrongPick || pickedCorrect !== null || revealed}
                className={`px-3 py-1.5 min-h-[40px] rounded-xl border text-center text-sm sm:text-base font-medium leading-tight flex items-center justify-center gap-2 transition ${cls}`}
              >
                <span className="leading-snug">{opt}</span>
                {isCorrectPick && <span className="text-base shrink-0">✅</span>}
                {isWrongPick && <span className="text-base shrink-0">❌</span>}
              </button>
            )
          })}
        </div>

        <div
          style={{ gridArea: "1 / 1" }}
          className={`rounded-2xl border bg-teal-900/95 border-teal-700/60 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 transition-opacity duration-300 ${
            revealed ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <p className="text-base sm:text-lg leading-relaxed text-center text-teal-50 flex-1">
            {question.explanation}
          </p>
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={!revealed}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition bg-amber-400 text-amber-950 hover:bg-amber-300"
            >
              {cityIndex === totalCities - 1 ? "Finish 🏁" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/** Viewport framing every city in the route, with comfortable padding.
 *  Used for the opening shot — the page starts at the full-continent default
 *  viewport, then animates to this tighter route-fit so the user sees the
 *  geographic context before zooming in on the journey. */
function routeViewport(cities: { lat: number; lng: number }[]): MapViewport {
  if (cities.length === 0) return MAP_DEFAULT_VIEWPORT
  const projected = cities.map(c => projectLatLngPct(c.lat, c.lng))
  let left = Math.min(...projected.map(p => p.left))
  let right = Math.max(...projected.map(p => p.left))
  let top = Math.min(...projected.map(p => p.top))
  let bottom = Math.max(...projected.map(p => p.top))
  // ~3° real-world padding around the route bbox so labels + the bus marker
  // have room without bumping up against the frame.
  const lngRange = MAP_GEO.right - MAP_GEO.left
  const latRange = MAP_GEO.top - MAP_GEO.bottom
  const padX = (3 / lngRange) * 100
  const padY = (3 / latRange) * 100
  left -= padX; right += padX
  top -= padY; bottom += padY
  let w = right - left
  let h = bottom - top
  // Match the on-screen aspect of MAP_DEFAULT_VIEWPORT so the map container
  // (and its surrounding layout) doesn't reflow during the zoom-in tween.
  const TARGET_ASPECT = (MAP_DEFAULT_VIEWPORT.width * MAP_W_PX) / (MAP_DEFAULT_VIEWPORT.height * MAP_H_PX)
  const currentAspect = (w * MAP_W_PX) / (h * MAP_H_PX)
  if (currentAspect > TARGET_ASPECT) h = (w * MAP_W_PX) / (TARGET_ASPECT * MAP_H_PX)
  else if (currentAspect < TARGET_ASPECT) w = (TARGET_ASPECT * h * MAP_H_PX) / MAP_W_PX
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  let nl = cx - w / 2
  let nt = cy - h / 2
  if (w >= 100) nl = (100 - w) / 2
  else nl = Math.max(0, Math.min(100 - w, nl))
  if (h >= 100) nt = (100 - h) / 2
  else nt = Math.max(0, Math.min(100 - h, nt))
  return { left: nl, top: nt, width: w, height: h }
}

/** Viewport framing two consecutive route points with comfortable padding.
 *  The result is expanded to a fixed on-screen aspect ratio so the rendered
 *  map container is the same size for every leg (no jump between cities). */
function cityLegViewport(a: RoutePoint, b: RoutePoint): MapViewport {
  const pa = projectLatLngPct(a.lat, a.lng)
  const pb = projectLatLngPct(b.lat, b.lng)
  // Padding and minimum size in geographical degrees, then converted to
  // %-of-basemap. This keeps the on-screen frame ~constant in real-world km
  // regardless of basemap scale: ~80km horizontal padding, ~130km vertical,
  // and a ~350×600km minimum frame. The original UK-tuned 8/10/35/45 values
  // emerged from these same degrees against the British Isles SVG (13.2° ×
  // 12°), so this preserves UK behaviour while giving Greece (and any other
  // world-basemap region) a tight zoom instead of a Mediterranean panorama.
  const lngRange = MAP_GEO.right - MAP_GEO.left
  const latRange = MAP_GEO.top - MAP_GEO.bottom
  const padX = (1.0 / lngRange) * 100
  const padY = (1.2 / latRange) * 100
  const left = Math.min(pa.left, pb.left) - padX
  const right = Math.max(pa.left, pb.left) + padX
  const top = Math.min(pa.top, pb.top) - padY
  const bottom = Math.max(pa.top, pb.top) + padY
  const minW = (4.5 / lngRange) * 100
  const minH = (5.5 / latRange) * 100
  let w = Math.max(right - left, minW)
  let h = Math.max(bottom - top, minH)
  // Lock to the same on-screen aspect as the start-screen MAP_DEFAULT_VIEWPORT,
  // so the map container is identical across the start screen and every leg.
  // Aspect is in image-pixel space — use the live MAP_W_PX/MAP_H_PX of the
  // current basemap (continent rasters vary widely: Africa 1:1, Asia 1.72:1,
  // Europe 1.97:1, etc.) instead of hardcoding.
  const TARGET_ASPECT = (MAP_DEFAULT_VIEWPORT.width * MAP_W_PX) / (MAP_DEFAULT_VIEWPORT.height * MAP_H_PX)
  const currentAspect = (w * MAP_W_PX) / (h * MAP_H_PX)
  if (currentAspect > TARGET_ASPECT) {
    // Too wide — expand height.
    h = (w * MAP_W_PX) / (TARGET_ASPECT * MAP_H_PX)
  } else if (currentAspect < TARGET_ASPECT) {
    // Too tall — expand width.
    w = (TARGET_ASPECT * h * MAP_H_PX) / MAP_W_PX
  }
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  let nl = cx - w / 2
  let nt = cy - h / 2
  // Clamp position so the viewport never extends past the map edges (which
  // would expose the container background behind the SVG). If the viewport is
  // larger than the map in either axis we centre it.
  if (w >= 100) nl = (100 - w) / 2
  else nl = Math.max(0, Math.min(100 - w, nl))
  if (h >= 100) nt = (100 - h) / 2
  else nt = Math.max(0, Math.min(100 - h, nt))
  return { left: nl, top: nt, width: w, height: h }
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <span className={`text-xl transition-all ${filled ? "" : "grayscale opacity-30"}`}>
      ❤️
    </span>
  )
}

// ─── End screen ─────────────────────────────────────────────────────────────

function EndScreen({
  puzzle, won, lives, attempts, onShare, viewport, polylines, borders,
}: {
  puzzle: typeof FALLBACK_PUZZLE
  won: boolean
  lives: number
  attempts: Attempt[]
  onShare: () => void
  viewport: MapViewport
  polylines?: LegPolyline[]
  borders?: { rings: [number, number][][] }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-md text-center space-y-6"
    >
      {!won && <div className="text-7xl">🧭</div>}
      <div>
        <h2 className="text-3xl font-bold mb-1">
          {won ? "You made it!" : "Stranded!"}
        </h2>
        <p className="text-teal-300 text-sm">
          {won
            ? `${puzzle.cities[0].name} → ${puzzle.cities[puzzle.cities.length - 1].name} with ${lives}/${STARTING_LIVES} lives`
            : `Game over — ran out of lives`}
        </p>
      </div>

      <RouteMap
        points={puzzle.cities.map(c => ({ name: c.name, lat: c.lat, lng: c.lng }))}
        reachedCount={
          won
            ? puzzle.cities.length - 1
            : Math.max(0, attempts.filter(a => a.correct).length)
        }
        viewport={viewport}
        polylines={polylines}
        borders={borders}
        interactive
        className="w-full max-w-xs mx-auto rounded-2xl border border-teal-700/40 bg-teal-950/40"
      />

      <ShareGrid
        won={won}
        lives={lives}
        attempts={attempts}
        cities={puzzle.cities}
      />

      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl bg-amber-400 text-amber-950 font-bold text-lg hover:bg-amber-300 transition shadow-lg shadow-amber-500/20"
      >
        Share result
      </button>

      <p className="text-xs text-teal-500">Come back tomorrow for a new journey 🗺️</p>
    </motion.div>
  )
}

function ShareGrid({
  won, lives, attempts, cities,
}: {
  won: boolean
  lives: number
  attempts: Attempt[]
  cities: DailyCity[]
}) {
  // Only questioned cities get a row in the share grid (skip destinations).
  const questionedCities = cities
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.questions.length > 0)
  const perCity: ("✅" | "❌")[][] = Array.from({ length: cities.length }, () => [])
  for (const a of attempts) {
    perCity[a.cityIndex]?.push(a.correct ? "✅" : "❌")
  }
  return (
    <div className="bg-teal-900/40 border border-teal-700/40 rounded-2xl p-4 space-y-2 font-mono text-sm text-left max-w-[18rem] mx-auto">
      {questionedCities.map(({ c, i }, row) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-teal-500 w-5 text-xs">#{row + 1}</span>
          <span className="flex-1 truncate text-teal-100">{c.name}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {perCity[i].length === 0
              ? <span>·</span>
              : perCity[i].map((m, idx) => <span key={idx}>{m}</span>)}
          </span>
        </div>
      ))}
      <div className="pt-2 mt-2 border-t border-teal-700/40 text-xs text-teal-400">
        {won ? `${lives}/${STARTING_LIVES} ❤️ remaining` : "Did not finish"}
      </div>
    </div>
  )
}

// ─── Share modal ────────────────────────────────────────────────────────────

function ShareModal({
  puzzle, won, lives, attempts, onClose,
}: {
  puzzle: typeof FALLBACK_PUZZLE
  won: boolean
  lives: number
  attempts: Attempt[]
  onClose: () => void
}) {
  const text = useMemo(() => buildShareText(puzzle, won, lives, attempts), [puzzle, won, lives, attempts])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore — fallback could prompt user to copy manually
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-teal-900 border border-teal-700 rounded-2xl p-6 max-w-sm w-full space-y-4"
      >
        <h3 className="text-lg font-bold text-amber-200">Share your result</h3>
        <pre className="bg-teal-950/60 border border-teal-700/60 rounded-xl p-4 text-sm font-mono whitespace-pre-wrap break-words">
          {text}
        </pre>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 py-3 rounded-xl bg-amber-400 text-amber-950 font-semibold hover:bg-amber-300 transition"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-teal-600 text-teal-200 hover:bg-teal-800 transition"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function buildShareText(
  puzzle: typeof FALLBACK_PUZZLE,
  won: boolean,
  lives: number,
  attempts: Attempt[],
): string {
  const perCity: string[] = Array.from({ length: puzzle.cities.length }, () => "")
  for (const a of attempts) {
    perCity[a.cityIndex] += a.correct ? "✅" : "❌"
  }
  const heart = "❤️".repeat(lives) + "🤍".repeat(STARTING_LIVES - lives)
  const start = puzzle.cities[0]
  const end = puzzle.cities[puzzle.cities.length - 1]
  const questionedCities = puzzle.cities.filter(c => c.questions.length > 0)
  const reached = won ? questionedCities.length : Math.max(...attempts.map(a => a.cityIndex), -1) + 1
  return [
    `Qwizia Daily #${puzzle.puzzleNumber}`,
    puzzle.international
      ? `${start.flag} ${start.name} → ${end.name} ${end.flag}`
      : `${start.name} → ${end.name}`,
    won ? `Made it! ${reached}/${questionedCities.length} ${heart}` : `Stranded at city ${reached}/${questionedCities.length} 🤍🤍🤍`,
    "",
    ...puzzle.cities
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.questions.length > 0)
      .map(({ c, i }) => `${c.name}  ${perCity[i] || "·"}`),
    "",
    "qwizia.com",
  ].join("\n")
}

// ─── Debug panel ────────────────────────────────────────────────────────────

function MapDebugPanel({
  viewport, onChange, onReset,
}: {
  viewport: MapViewport
  onChange: (v: MapViewport) => void
  onReset: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const set = (key: keyof MapViewport, value: number) => {
    onChange({ ...viewport, [key]: value })
  }

  const zoom = (factor: number) => {
    // Scale width/height around the viewport's centre.
    const cx = viewport.left + viewport.width / 2
    const cy = viewport.top + viewport.height / 2
    const w = Math.max(0.2, viewport.width * factor)
    const h = Math.max(0.2, viewport.height * factor)
    onChange({ left: cx - w / 2, top: cy - h / 2, width: w, height: h })
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(viewport, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "uk-viewport.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(viewport, null, 2))
    } catch {}
  }

  const fields: { key: keyof MapViewport; min: number; max: number; step: number }[] = [
    { key: "left",   min: 0,    max: 100, step: 0.05 },
    { key: "top",    min: 0,    max: 100, step: 0.05 },
    { key: "width",  min: 0.5,  max: 50,  step: 0.05 },
    { key: "height", min: 0.5,  max: 50,  step: 0.05 },
  ]

  return (
    <div className="fixed bottom-3 right-3 z-50 w-72 rounded-xl border border-teal-600 bg-teal-950/95 backdrop-blur shadow-2xl text-teal-100 text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-2 border-b border-teal-700/60">
        <span className="font-bold text-amber-200">Map debug</span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-teal-300 hover:text-teal-100"
        >
          {collapsed ? "▴ open" : "▾ hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-teal-300 flex-1">zoom</span>
            <button
              onClick={() => zoom(1.1)}
              className="w-7 h-7 rounded border border-teal-600 hover:bg-teal-800 text-base"
              title="Zoom out"
            >−</button>
            <button
              onClick={() => zoom(1 / 1.1)}
              className="w-7 h-7 rounded border border-teal-600 hover:bg-teal-800 text-base"
              title="Zoom in"
            >+</button>
            <button
              onClick={() => zoom(1.5)}
              className="px-2 h-7 rounded border border-teal-600 hover:bg-teal-800 text-[10px]"
              title="Zoom out more"
            >−−</button>
            <button
              onClick={() => zoom(1 / 1.5)}
              className="px-2 h-7 rounded border border-teal-600 hover:bg-teal-800 text-[10px]"
              title="Zoom in more"
            >++</button>
          </div>
          {fields.map(f => (
            <div key={f.key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <label className="text-teal-300">{f.key}</label>
                <input
                  type="number"
                  step={f.step}
                  value={viewport[f.key]}
                  onChange={e => set(f.key, parseFloat(e.target.value) || 0)}
                  className="w-20 px-1 py-0.5 rounded bg-teal-900 border border-teal-700 text-right"
                />
              </div>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={viewport[f.key]}
                onChange={e => set(f.key, parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          ))}
          <pre className="text-[10px] bg-teal-900/60 border border-teal-700/60 rounded p-2 mt-2 whitespace-pre-wrap">
{JSON.stringify(viewport, null, 2)}
          </pre>
          <div className="flex gap-2 pt-1">
            <button
              onClick={download}
              className="flex-1 px-2 py-1.5 rounded bg-amber-400 text-amber-950 font-semibold hover:bg-amber-300"
            >
              Download JSON
            </button>
            <button
              onClick={copy}
              className="px-2 py-1.5 rounded border border-teal-600 hover:bg-teal-800"
            >
              Copy
            </button>
            <button
              onClick={onReset}
              className="px-2 py-1.5 rounded border border-teal-600 hover:bg-teal-800"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
