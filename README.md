# Qwizia

A daily geography quiz that drives you across the map.

The app lives at **qwizia.com** (Vercel). The multiplayer sister-game lives in
the squabblebox repo and may, in time, generate the daily questions for this
app to consume.

## Stack

- Next.js 16 (App Router) + Turbopack
- React 19
- Tailwind CSS 4
- TypeScript 5
- framer-motion (animations)

No auth, no database, no realtime — this is a single-player, no-login web
app. State lives in `localStorage` for streaks / repeat protection, but
puzzles are deterministic per UTC day so two clients see the same daily.

## Develop

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy

Push to the `main` branch — Vercel picks it up via its GitHub integration.
The custom domain `qwizia.com` is mapped on Vercel.
