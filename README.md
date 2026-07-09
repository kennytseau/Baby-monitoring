# Little One — Baby Tracker 👣

A private, mobile-friendly web app for following your baby's first two years:
what she's likely doing right now, the milestones ahead and how to encourage
them, her growth against reference percentile curves, the daily rhythm of
feeds / sleep / diapers, and a journal of firsts.

Everything is stored **on your device only** — no accounts, no server, no
tracking. It works offline once loaded and can be added to your phone's home
screen like an app.

## Features

- **Home ("Today")** — her exact age (with adjusted age for babies born early),
  a summary of what she's likely doing in her current developmental window,
  one-tap quick logging, and today's feed/sleep/diaper counts at a glance.
- **Milestones** — checklists for 0–24 months based on the CDC
  "Learn the Signs. Act Early." checklists (what 75%+ of babies do by each
  age), organised by age band with her current band highlighted. Every
  milestone explains what it looks like **and concrete ways to help her get
  there**. Tap the circle when she does it — the date is recorded and recent
  wins show up on Home.
- **Growth** — log weight, length and head circumference; see them plotted
  over shaded percentile bands (3rd–97th) approximating the WHO Child Growth
  Standards, with an estimated percentile for each entry.
- **Daily log** — quick-tap feeds (breast side / bottle + amount / solids),
  sleep sessions (start now, end when she wakes), and diapers, in a timeline
  grouped by day with daily totals.
- **Memories** — dated journal entries for the firsts (first smile, first
  laugh…), each shown with how old she was at the time.
- **Backup** — download all data as JSON from *Settings & data* on the Home
  screen.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build (output in dist/)
npm test           # unit tests (age math, storage, percentiles)
```

Open the printed URL on your phone or desktop. On first launch you'll be asked
for your baby's name, birth date, sex (used to pick the right growth curves)
and, optionally, her due date — if she arrived more than two weeks early, the
app uses her adjusted age for milestone windows.

Deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages…).

## How it's built

- **Vite + React + TypeScript**, React Router for the tab navigation
- Plain CSS design system in `src/styles/global.css` (mobile-first, automatic
  light/dark mode)
- Hand-rolled SVG growth charts (`src/components/GrowthChart.tsx`) — no chart
  library
- All state in a single versioned `localStorage` document
  (`src/lib/storage.ts`) behind a React context (`src/hooks/useAppState.tsx`),
  ready to be swapped for IndexedDB or a sync backend later

```
src/
  lib/        age math, storage, percentile interpolation, formatting
  data/       milestone dataset (CDC-based) + growth curve tables (WHO-based)
  hooks/      app state provider
  pages/      Onboarding, Home, Milestones, Growth, DailyLog, Memories
  components/ TabBar, GrowthChart
```

## Data & privacy

All data lives in your browser's `localStorage` on the device you use. Nothing
ever leaves the device. That also means: clearing site data erases it, and a
second device starts empty — download a JSON backup from *Settings & data*
before clearing or switching. (Cross-device sync is a natural next step —
see below.)

## Ideas for later

- Photos on memories (needs IndexedDB — `localStorage` is too small)
- JSON backup **import** to restore/move devices
- Optional sync backend + accounts for sharing with a partner
- Reminders (tummy time, vitamin D drops), a service worker for full offline
  installs, sleep/feed pattern charts

## A note on the data sources

Milestone content follows the CDC's 2022 "Learn the Signs. Act Early."
checklists; growth curves closely approximate the WHO Child Growth Standards
percentiles (transcribed values for visualization, not the official LMS
tables). **None of this is medical advice.** Every baby develops at her own
pace — your pediatrician is the reference for anything that concerns you,
especially missed milestones, lost skills, or growth worries.
