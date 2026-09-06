# Little One — Baby Tracker 👣

A private, mobile-friendly web app for following your baby's first two years:
what she's likely doing right now, the milestones ahead and how to encourage
them, her growth against reference percentile curves, the daily rhythm of
feeds / sleep / diapers, and a journal of firsts.

It works offline and can be added to your phone's home screen like an app. By
default everything stays **on your device only**; deploy the small sync server
in [`worker/`](worker/README.md) and both parents' phones share one live log,
still with no accounts and nothing sold or tracked.

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
- **Shared log** — one phone creates the shared log and shows a family code;
  the other joins with it, and from then on both see the same day. Entries you
  make with no signal queue up and go across as soon as you have one. See
  *Sharing between two phones* below.
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

## Sharing between two phones

Out of the box the app is device-local. To share a log:

1. Deploy the sync server once — a Cloudflare Worker plus a D1 database, both
   on the free tier. No terminal needed: follow
   [`worker/SETUP-WITHOUT-A-TERMINAL.md`](worker/SETUP-WITHOUT-A-TERMINAL.md)
   to do it by clicking. Or, from a terminal
   ([`worker/README.md`](worker/README.md)):

   ```bash
   cd worker && npm install
   npx wrangler login
   npx wrangler d1 create baby-log     # paste the id into wrangler.toml
   npm run db:init && npm run deploy   # prints your Worker URL
   ```

2. On the first phone: *Settings & data → Share with your partner → Create
   shared log*, paste the Worker URL. The app shows a **family code**.
3. On the second phone: same screen, *Join with a code*, paste the code. Any
   entries already on that phone are merged in.

After that both phones sync when the app is open (every 20 seconds, on
returning to the app, and a second or two after each entry). A banner appears
when something is waiting to go up.

**How conflicts resolve.** Every record carries the time it was last changed;
if you both edit the same entry the later edit wins. Different entries never
conflict, so the normal case — one of you logs a nappy while the other logs a
feed — just merges. Deleting an entry deletes it on both phones rather than
having it reappear.

**The family code is the key to the log.** Anyone who has it can read and add
to it, so treat it like a house key; it is stored only on your phones and is
deliberately left out of the JSON backup. If you both lose it there is no way
back into that log — keep a backup.

**Pre-filling the server URL.** Typing the Worker URL on each phone is a
one-off, but you can bake it into the deployed site instead — either way works:

- Uncomment the `VITE_SYNC_URL=` line in [`.env.production`](.env.production),
  paste your Worker URL, and commit. Nothing to configure on GitHub.
- Or set a repository variable named `VITE_SYNC_URL` (repo *Settings →
  Secrets and variables → Actions → Variables*); the deploy workflow passes it
  through, and it overrides the file.

The URL is not a secret — it ends up in the built JavaScript either way, and
it is the family code that protects the log.

## How it's built

- **Vite + React + TypeScript**, React Router for the tab navigation
- Plain CSS design system in `src/styles/global.css` (mobile-first, automatic
  light/dark mode)
- Hand-rolled SVG growth charts (`src/components/GrowthChart.tsx`) — no chart
  library
- All state in a single versioned `localStorage` document
  (`src/lib/storage.ts`) behind a React context (`src/hooks/useAppState.tsx`).
  The document is migrated on load, so data logged under an older schema keeps
  working
- Local-first sync: the device is always the source of truth for what you can
  see, and `src/lib/sync.ts` merges the server's records into it last-write-wins
  (tombstones for deletes, a pending queue for changes made offline). The
  server (`worker/`) is a dependency-free Cloudflare Worker over D1
- A running nursing session is just a log entry with the side and its start
  time on it, so the timer survives a reload (and a flat battery)

```
src/
  lib/        age math, storage + schema migrations, log maths (durations,
              wake windows, day totals), sync merge + client, percentiles,
              formatting
  data/       milestone dataset (CDC-based) + growth curve tables (WHO-based)
  hooks/      app state provider, quick-log actions, ticking clock
  pages/      Onboarding, Home, Milestones, Growth, DailyLog, Memories
  components/ TabBar, GrowthChart, QuickLog, NursingTimer, DayTimeline,
              DayTotalsCard, SharingPanel, SyncBanner
worker/       sync server: Cloudflare Worker + D1 schema
```

## Data & privacy

Unpaired, all data lives in your browser's `localStorage` and never leaves the
device. Paired, it also lives in the D1 database of the Worker **you** deployed
to **your** Cloudflare account — nobody else's server is involved, and the only
thing that opens it is the family code. Either way there are no accounts, no
third-party analytics and nothing sold.

Clearing site data still erases the copy on that phone (a paired phone pulls it
back from the shared log; an unpaired one does not), so download a JSON backup
from *Settings & data* before clearing or switching devices.

## Ideas for later

- Photos on memories (needs IndexedDB — `localStorage` is too small)
- JSON backup **import** to restore/move devices
- Per-entry attribution ("logged by Mum") now that two devices share a log
- Pruning old tombstones so a long-running log stays small
- Reminders (tummy time, vitamin D drops), a service worker for full offline
  installs, sleep/feed pattern charts

## A note on the data sources

Milestone content follows the CDC's 2022 "Learn the Signs. Act Early."
checklists; growth curves closely approximate the WHO Child Growth Standards
percentiles (transcribed values for visualization, not the official LMS
tables). **None of this is medical advice.** Every baby develops at her own
pace — your pediatrician is the reference for anything that concerns you,
especially missed milestones, lost skills, or growth worries.
