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

- **Home ("Today")** — her exact age in weeks and days (with adjusted age for
  babies born early), one-tap quick logging, whether she's asleep or how long she's been awake, and
  today's milk / sleep / nappy totals at a glance.
- **What's next** — when she's likely to wake, or to be ready for sleep, and
  whether a feed or a change is about due. All four are read off *her own*
  recent log at this time of day, so they follow her as she grows rather than
  telling you what a baby "should" do. See *Reading her rhythm* below.
- **Milestones** — checklists for 0–24 months based on the CDC
  "Learn the Signs. Act Early." checklists (what 75%+ of babies do by each
  age), organised by age band with her current band highlighted. Every
  milestone explains what it looks like **and concrete ways to help her get
  there**. Tap the circle when she does it — the date is recorded and recent
  wins show up on Home.
- **Growth** — log weight, length and head circumference; see them plotted
  over shaded percentile bands (3rd–97th) approximating the WHO Child Growth
  Standards, with an estimated percentile for each entry.
- **Babies around her age** — on the Growth tab, the ranges published guidance
  gives for sleep, naps, wake windows, feeds, formula, wet nappies and weight
  gain at her age, with her own last seven days alongside. Each range names
  its source, and the ones that are popular advice rather than research say
  so. It is there to read and nothing more: no prediction uses it (a test
  makes sure of that).
- **Daily log** — the day in one place:
  - **Milk** — nursing with a live per-side timer (start on the left, switch to
    the right, finish; minutes are banked to each breast), or a bottle with what
    was in it (formula or expressed breast milk) and how many ml. Solids too,
    when she gets there. Before a feed it suggests which side to start on:
    the other one from last time, or the side that got less time if the
    start wasn't recorded.
  - **Nappies** — wet, poo or both, with the time.
  - **Sleep** — tap when she goes down, tap again when she wakes; the gaps in
    between are shown as **wake windows**.
  - **Pumping** — millilitres from the left and right breast, and how long the
    session took.
  - **Medicine** — what, how much, and when it was last given.
  - **Coming up** — anything set for a time later on waits here, with Edit and
    Delete, until that time comes. Until then it counts for nothing: Right now
    stays as it was, totals leave it out, and no prediction learns from it.
  - Each day gets a 24-hour strip (sleep as bars, feeds / nappies / pumping as
    marks) plus totals: milk in, nursing minutes per side, nappies by type,
    total and longest sleep, and how much was pumped.
  - The last week is shown, with earlier days a tap away — drawing two months
    at once took seven seconds on a phone.
- **By day** — today against the week behind it for milk, nursing, sleep,
  naps, nappies and pumping, compared at the same time of day. Below that, the
  last fortnight stacked on one 24-hour line, today at the top: sleep as bars,
  feeds as dots, so a rhythm shows as the bars lining up. Tap a bar or dot to
  read it, or open it as a table.
- **What's changed** — when her nights break up, her naps shorten or her feeds
  bunch, Home says so, for example "She is feeding more often: 11 feeds a day
  lately, usually 9". Nothing shows when nothing has changed. By day has the
  full picture, plus a **4-month sleep regression watch**. See *Noticing
  changes* below.
- **Night mode** — near-black and warm, with no blue light and bigger quick-log
  buttons. *Auto* turns it on from 7pm to 7am; *Always* and *Off* are there
  too, under *Settings & data*. It is set per phone.
- **Memories** — dated journal entries for the firsts (first smile, first
  laugh…), each shown with how old she was at the time.
- **Shared log** — one phone creates the shared log and shows a family code;
  the other joins with it, and from then on both see the same day. Entries you
  make with no signal queue up and go across as soon as you have one. See
  *Sharing between two phones* below.
- **Backup** — download all data as JSON from *Settings & data* on the Home
  screen, and restore it from the same place.

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

## Reading her rhythm

Five things on Home are predicted rather than recorded: when she'll wake, when
she'll be ready for sleep, when the next feed is due and roughly how much it
will be, and when the next change is due.

Three ideas do the work, and each one was kept only because a backtest against
eight weeks of real logs said it earned its place.

**Time of day.** Babies are far more predictable by the hour than on average.
Past stretches are bucketed by the hour they began, the bucket widened until
there are at least five, and the median taken.

**Time already served** (feeds and changes). Once she has gone two hours
without a feed, "how long does she go at 2pm?" is the wrong question — the
right one is "how long do the 2pm stretches that got past two hours last?",
which is a different and longer answer. Only the past stretches that got at
least this far are counted, so the "in about…" keeps up as you wait.

**Fixed times** (wake-up and wind-down). These show a clock time to plan
around, so they are worked out once, when the sleep or wake window begins, and
then left alone. Counting the time already served would make them a little
more accurate, but it also made the time slide forward minute by minute once
she ran past it — no use for planning. Instead the time stays put and the card
says "Any time now — 20 min past her usual wake-up".

**Short naps.** A catnap isn't real rest, so the wake window after one is
shorter. On her log, after a nap under 15 minutes she stayed up about half her
usual, and after 15–25 minutes about seven-tenths; after anything longer, no
different. The app learns that fraction from her own last six weeks of short
naps (it waits until it has five) and shortens the next wind-down by it, saying
so on the card. Scored once per short nap: typical error 32 → 20 min, and within
30 minutes 46% → 66% of the time, improving on both halves of the data. The
exception is when she skips the nap altogether and pushes on for two hours or
more; the earlier time then sits at "any time now" for longer.

**Amounts are counted per feed.** A top-up given within the same feed is part
of it. Counted bottle by bottle, her top-ups after nursing (about 55 ml lately)
and her full bottle feeds (85–100 ml) averaged out to a figure that fitted
neither. Per feed, the time of day matters, so the amount is her median at the
hour the next feed is due. Whichever way she's been fed most often lately
decides the unit.

Scored the way the card is actually read — re-asked every quarter hour of every
wait, against what happened next:

| Prediction | Median error | Within 30 min | Before time-served was counted |
| --- | --- | --- | --- |
| When she'll wake (fixed time) | 25 min | 56% | — |
| Next wind-down (fixed time) | 17 min | 72% | — |
| Next feed | 30 min | 51% | 41 min |
| Next change | 38 min | 41% | 45 min |
| Size of the next feed | 15 ml | 75% (within 30 ml) | 20 ml, when counted per bottle |

Two consequences worth knowing. It only ever learns from the **last two or
three weeks**, so as she grows the estimates move with her — over those eight
weeks her bottles went from 25 ml to 70 ml and her feeds spread out and drew
back in again, and nothing about a ten-week-old is hard-coded. And a feed
logged as a top-up within 45 minutes of the last one counts as the same feed,
so a cluster feed doesn't teach it that she eats every ten minutes.

It stays quiet until there's something to learn from: a handful of logged
stretches for each, and it says so plainly until then. While she's asleep, a
feed or change that's fallen due reads "when she wakes" rather than telling you
to wake her.

### Things that were tried and didn't help

Worth recording so they aren't tried again. None of these beat the model above
on the same backtest:

- **Smooth kernel weighting** by hour and recency instead of hard buckets — no
  better, on any bandwidth or half-life.
- **The size of the last feed** predicting how long she'd go. Raw correlation
  looked promising (r = 0.36) but it vanishes once you condition on the hour,
  and every weighting made the error worse.
- **The wake window before a sleep** predicting how long the sleep lasts
  (r = −0.11 — essentially nothing). The *sleep before a wake window* was
  listed here too, on a similar overall correlation, but that test was
  wrong-shaped: the effect only shows for short naps, and a few hundred long
  sleeps drowned it out. It is now used — see *Short naps* above.
- **A growth trend line** (Theil–Sen) for bottle size instead of the median —
  identical error at every window length.
- **Predicting changes from feeds.** 71% of changes happen within 15 minutes of
  a feed, but she's fed about twice as often as she's changed, so "the next
  feed" is a much worse guess (163 min vs 44) and snapping the gap estimate to
  a predicted feed is worse still (59 min vs 38).
- **A shorter window for amounts** (3–10 days instead of 14), to keep up with
  a growing baby — no better.
- **Learning the nap-length effect for every nap**, not just short ones. After
  a 40–90 minute nap she does stay up about 9% longer, but using it made
  wind-down slightly worse (16.0 → 16.1 min).
- **Time awake before a sleep, or a feed just before it**, predicting how long
  she sleeps. Neither held up: the halves of the data disagreed, and she is
  fed before nearly every sleep, so there is nothing to compare against.
- **Tuning the history window, bucket width and minimum sample count.** The
  differences across ninety-odd combinations were around a minute — noise at
  this sample size — so the defaults stayed put.

## Noticing changes

Every morning her night (7pm to 7am) is measured: the longest stretch, how many
times she woke, and how long she slept. Every evening her day is measured: how
long her naps were and how long she slept, and every midnight how many feeds
she had (top-ups counted in). Each measure is compared with her own fortnight
before. A change is reported only when **3 days in a row** all sit outside the
middle half of that fortnight, the same way, and by enough to matter: a quarter
for times, 1 waking, or 2 feeds. One bad night is a bad night.

A change is measured against the fortnight before *it began*, not the
fortnight before today. Otherwise, a week into a rough patch, the rough nights
would have become her "usual" and the alert would quietly vanish while it was
still going on. A change is shown for up to two weeks. After that it is her new
normal, and the predictions, which learn from her last fortnight, have caught
up with it.

Run back over her log, the rule raised a change about every five days. Each
held for 3 to 14 days, and they matched what happened: feeds jumping from 9 to
12 a day at six weeks, and naps roughly halving in mid-August.

**The 4-month sleep regression.** It is a lasting change in how her sleep
cycles work. It commonly starts between about 12 and 20 weeks and settles
within 2 to 6 weeks. No log can tell in advance *when* it will start, so the
watch looks for its signs instead: more night wakings, a shorter longest
stretch, less night sleep, and naps cut to one cycle (45 minutes or less). One
night sign held for 3 nights makes it *Maybe starting*. Two night signs, or one
with one-cycle naps, make it *Likely started*. It watches from 10 to 24 weeks
and keeps following a regression for up to six weeks. To test it, a regression
was planted into her real log at different dates: night sleep broken every 90
minutes, naps cut to 40 minutes, or a milder version where each long night
sleep is split once.

| | |
|---|---|
| Nights to notice it | 1–3 |
| Days it kept being shown while the regression went on | every day, up to the end of her log (11+) |
| Days to clear once it ended | 3 |
| False alarms on her real log, 10 Aug – 23 Sep | 0 of 45 days |

Neither the changes nor the regression watch feed into a prediction.

## If the published site stops working

If `https://kennytseau.github.io/Baby-monitoring/` shows GitHub's "There isn't a
GitHub Pages site here" page, Pages has been switched off for the repository —
the app itself is fine. Turn it back on:

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

Then go to the **Actions** tab, open the most recent *Deploy to GitHub Pages*
run on the default branch and click **Re-run all jobs**. The site is back a
minute later.

Two things unpublish a site by accident, both on that Settings → Pages screen:
changing *Source* away from **GitHub Actions**, and the **Unpublish site**
button lower down the page.

A failed deploy never takes the site down on its own — the previous
deployment keeps serving until a new one succeeds.

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
- Every prediction shares one estimator (`src/lib/patterns.ts`) — recent
  samples, bucketed by hour of day, median and quartiles — so sleep, feeds and
  nappies cannot drift apart in how they are worked out

```
src/
  lib/        age math, storage + schema migrations, log maths (durations,
              wake windows, day totals), the shared hour-of-day estimator and
              the sleep / feed / nappy predictions built on it, sync merge +
              client, percentiles, formatting
  data/       milestone dataset (CDC-based), growth curve tables (WHO-based),
              typical ranges by age (for reading only)
  hooks/      app state provider, quick-log actions, ticking clock, night mode
  pages/      Onboarding, Home, Milestones, Growth, DailyLog, Trends, Memories
  components/ TabBar, GrowthChart, QuickLog, NursingTimer, DayTimeline,
              DayTotalsCard, RhythmCard, NeedsCard, TrendChart,
              SleepPatternChart, AgeGuidesCard, SharingPanel, SyncBanner
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
- Per-entry attribution ("logged by Mum") now that two devices share a log
- Pruning old tombstones so a long-running log stays small
- Reminders (tummy time, vitamin D drops), and a service worker for full
  offline installs

## A note on the data sources

Her age is shown in weeks and days for as long as that is useful. Switching to
months later is one constant, `AGE_IN_MONTHS_FROM_DAYS` in `src/lib/age.ts`.

The typical ranges on the Growth tab come from the US National Sleep
Foundation and the American Academy of Sleep Medicine (sleep), the American
Academy of Pediatrics and the US CDC (feeds), the NHS (formula and wet
nappies) and the Raising Children Network (wet nappies). Nap counts, wake
windows and weight gain per week are figures commonly quoted rather than
research, and the card says so.

Milestone content follows the CDC's 2022 "Learn the Signs. Act Early."
checklists; growth curves closely approximate the WHO Child Growth Standards
percentiles (transcribed values for visualization, not the official LMS
tables). **None of this is medical advice.** Every baby develops at her own
pace — your pediatrician is the reference for anything that concerns you,
especially missed milestones, lost skills, or growth worries.
