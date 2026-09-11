-- One row per family log. `token_hash` is sha256("<id>:<secret>"), so the
-- family code itself is never stored; `seq` is the household's change counter
-- that devices use as their sync cursor.
CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Every synced record: a log entry, growth entry, memory, milestone or the
-- baby's profile. Deletes are tombstones (deleted_at set) so they propagate.
CREATE TABLE IF NOT EXISTS records (
  household_id TEXT NOT NULL,
  collection   TEXT NOT NULL,
  id           TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  data         TEXT,
  seq          INTEGER NOT NULL,
  PRIMARY KEY (household_id, collection, id)
);

CREATE INDEX IF NOT EXISTS records_by_seq ON records (household_id, seq);

-- Phones that have asked for lock-screen updates of the running sleep or
-- nursing timer. `last_state` is the counter we last showed, so an unchanged
-- count sends nothing.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  household_id TEXT NOT NULL,
  endpoint     TEXT PRIMARY KEY,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_state   TEXT,
  last_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS push_by_household ON push_subscriptions (household_id);

-- Server-side key material, generated on first use and never sent anywhere:
-- today just the VAPID pair that signs push messages.
CREATE TABLE IF NOT EXISTS server_keys (
  name       TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL
);
