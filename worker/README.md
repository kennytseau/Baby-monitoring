# Sync server

A single Cloudflare Worker plus a D1 (SQLite) database that lets both parents'
phones share one baby log. It stores only what the app sends — no accounts, no
email addresses, no analytics — and it runs comfortably inside Cloudflare's
free tier.

You deploy this once. After that the app talks to it directly.

**Not comfortable with a terminal?** Follow
[SETUP-WITHOUT-A-TERMINAL.md](SETUP-WITHOUT-A-TERMINAL.md) instead — the same
setup done entirely by clicking in Cloudflare's website, with no installs.

## Deploy it

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and
Node 18+.

```bash
cd worker
npm install
npx wrangler login          # opens a browser to authorise this machine

# 1. Create the database. This prints a database_id — copy it.
npx wrangler d1 create baby-log

# 2. Paste that id into wrangler.toml, replacing REPLACE_WITH_YOUR_D1_DATABASE_ID

# 3. Create the tables, then deploy
npm run db:init
npm run deploy
```

The last command prints your Worker's URL, something like:

```
https://baby-log-sync.yourname.workers.dev
```

That URL is what you paste into the app: **Home → Settings & data → Share with
your partner → Create shared log**. (To avoid typing it on each phone, put it
in `.env.production` at the repo root and commit — see the main README.) The app hands you a family code; type that
code into the same screen on the other phone ("Join with a code"), and the two
phones stay in step from then on.

Check it is alive at any time:

```bash
curl https://baby-log-sync.yourname.workers.dev/v1/health   # {"ok":true}
```

## Running it locally

```bash
npm run db:init:local
npm run dev        # http://127.0.0.1:8787
```

Then put `http://127.0.0.1:8787` in the app's *Sync server* field.

## How sync works

Every record — a log entry, growth measurement, memory, milestone, or the
baby's profile — carries an `updatedAt` stamp. A device sends the records it
has changed since its last sync along with the cursor it last saw, and gets
back everything that changed on the server after that cursor:

```
POST /v1/sync              Authorization: Bearer <householdId>.<secret>
  { "cursor": 12, "changes": [ { collection, id, updatedAt, deletedAt?, data } ] }
→ { "cursor": 13, "more": false, "changes": [ … ], "serverTime": "…" }
```

Conflicts resolve **last write wins** on `updatedAt`: if you both edit the same
feed, the edit made later is the one that survives. Different entries never
conflict, so the usual case — two parents logging different things — simply
merges. Deletes travel as tombstones (`deletedAt`), so removing an entry on one
phone removes it on the other rather than having it reappear at the next sync.

Changes made with no signal are queued on the phone and pushed the moment it
can reach the server again, so the 3am feed you logged in a dead spot is not
lost.

`POST /v1/households` mints a new log and returns the two halves of the family
code. Only `sha256("<householdId>:<secret>")` is stored, so the code cannot be
read back out of the database — if you both lose it, the log's data is
unreachable and you start a new one (keep a JSON backup from the app).

## Who can read the log

Anyone holding the family code. There are no other credentials, which is the
point — it works at 3am with no sign-in — but it means the code should be
treated like a house key. It never leaves your phones except in the
`Authorization` header to your own Worker, and it is deliberately left out of
the app's JSON backup file.

If a code is ever exposed, create a new shared log and re-pair both phones; the
old one can be dropped with `npx wrangler d1 execute baby-log --remote --command
"DELETE FROM households WHERE id='…'; DELETE FROM records WHERE household_id='…'"`.

## Costs

Cloudflare's free tier covers 100,000 Worker requests and 5 GB of D1 storage a
day. Two phones syncing every 20 seconds while the app is open use a few
thousand requests a day at most, and a year of logging is a few megabytes.
