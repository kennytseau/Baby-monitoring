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
  one-tap quick logging, whether she's asleep or how long she's been awake, and
  today's milk / sleep / nappy totals at a glance.
- **Milestones** — checklists for 0–24 months based on the CDC
  "Learn the Signs. Act Early." checklists (what 75%+ of babies do by each
  age), organised by age band with her current band highlighted. Every
  milestone explains what it looks like **and concrete ways to help her get
  there**. Tap the circle when she does it — the date is recorded and recent
  wins show up on Home.
- **Growth** — log weight, length and head circumference; see them plotted
  over shaded percentile bands (3rd–97th) approximating the WHO Child Growth
  Standards, with an estimated percentile for each entry.
- **Daily log** — the day in one place:
  - **Milk** — nursing with a live per-side timer (start on the left, switch to
    the right, finish; minutes are banked to each breast), or a bottle with what
    was in it (formula / expressed breast milk / both) and how many ml. Solids
    too, when she gets there.
  - **Nappies** — wet, poo or both, with the time.
  - **Sleep** — tap when she goes down, tap again when she wakes; the gaps in
    between are shown as **wake windows**.
  - **Pumping** — millilitres from the left and right breast, and how long the
    session took.
  - Each day gets a 24-hour strip (sleep as bars, feeds / nappies / pumping as
    marks) plus totals: milk in, nursing minutes per side, nappies by type,
    total and longest sleep, and how much was pumped.
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
  ready to be swapped for IndexedDB or a sync backend later. The document is
  migrated on load, so data logged under an older schema keeps working
- A running nursing session is just a log entry with the side and its start
  time on it, so the timer survives a reload (and a flat battery)

```
src/
  lib/        age math, storage + schema migrations, log maths (durations,
              wake windows, day totals), percentiles, formatting
  data/       milestone dataset (CDC-based) + growth curve tables (WHO-based)
  hooks/      app state provider, quick-log actions, ticking clock
  pages/      Onboarding, Home, Milestones, Growth, DailyLog, Memories
  components/ TabBar, GrowthChart, QuickLog, NursingTimer, DayTimeline,
              DayTotalsCard
```

## Data & privacy

All data lives in your browser's `localStorage` on the device you use. Nothing
ever leaves the device. That also means: clearing site data erases it, and a
second device starts empty. **Two phones do not see each other's entries yet** —
if both of you log, you each keep your own copy, so for now pick one device as
the record (or export/import between them). Download a JSON backup from
*Settings & data* before clearing or switching. Shared, synced logging is the
next step below.

## Ideas for later

- Photos on memories (needs IndexedDB — `localStorage` is too small)
- JSON backup **import** to restore/move devices
- Optional sync backend + accounts so both parents log into the same day
- Reminders (tummy time, vitamin D drops), a service worker for full offline
  installs, sleep/feed pattern charts

## A note on the data sources

Milestone content follows the CDC's 2022 "Learn the Signs. Act Early."
checklists; growth curves closely approximate the WHO Child Growth Standards
percentiles (transcribed values for visualization, not the official LMS
tables). **None of this is medical advice.** Every baby develops at her own
pace — your pediatrician is the reference for anything that concerns you,
especially missed milestones, lost skills, or growth worries.
