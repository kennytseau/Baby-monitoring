# Setting up the sync server by clicking (no terminal)

This gets both phones onto one shared log. It takes about ten minutes and
costs nothing. You will not need to install anything or type any commands —
just copy and paste two files into Cloudflare's website.

Cloudflare redesigns its dashboard from time to time, so a menu may sit
somewhere slightly different from what is written here. The words in **bold**
are what to look for; if a menu has moved, the dashboard's search box at the
top finds it.

---

## Step 1 — Make a free Cloudflare account

Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up),
sign up, and confirm the email they send you. No card is needed.

## Step 2 — Create the database

This is where the log is stored.

1. In the left sidebar find **Storage & Databases → D1 SQL Database**
   (in older layouts: **Workers & Pages → D1**).
2. Click **Create database**. Name it exactly:

   ```
   baby-log
   ```

   Click **Create**.
3. Open the database you just made and choose the **Console** tab.
4. Copy the block below, paste it into the console box, and click **Run**
   (or **Execute**). Then do the same for the second and third blocks, one at a
   time — **run each one on its own**, clearing the box in between.

   ```sql
   CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
   ```

   ```sql
   CREATE TABLE IF NOT EXISTS records (household_id TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, data TEXT, seq INTEGER NOT NULL, PRIMARY KEY (household_id, collection, id));
   ```

   ```sql
   CREATE INDEX IF NOT EXISTS records_by_seq ON records (household_id, seq);
   ```

   ```sql
   CREATE TABLE IF NOT EXISTS push_subscriptions (household_id TEXT NOT NULL, endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL, last_state TEXT, last_sent_at TEXT);
   ```

   ```sql
   CREATE INDEX IF NOT EXISTS push_by_household ON push_subscriptions (household_id);
   ```

   ```sql
   CREATE TABLE IF NOT EXISTS server_keys (name TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL);
   ```

   Each should report success. You have just created four empty tables and two
   indexes — nothing else happens yet. (The last three are for the lock-screen
   timer in Step 8; making them now saves coming back.)

   > **"The request is malformed: Requests without any query are not
   > supported."** means the console got nothing to run: the box was empty, the
   > paste did not take, or what was pasted was only the comment lines. Click
   > into the box, make sure you can see the `CREATE ...` text, and press Run
   > again. This is also why the statements are split up above — pasting the
   > whole file at once, comments and all, is what usually trips this.

## Step 3 — Create the Worker (this is where your URL comes from)

1. In the sidebar go to **Compute (Workers) → Workers & Pages**
   (older layouts: just **Workers & Pages**).
2. Click **Create** → **Create Worker**. Cloudflare offers a "Hello World"
   starter — that is fine, you will replace the code in a moment.
3. Name it:

   ```
   baby-log-sync
   ```

4. Click **Deploy**.

**The page now shows your Worker's address**, and it looks like this:

```
https://baby-log-sync.something.workers.dev
```

The `something` in the middle is your own Cloudflare subdomain — you pick it
the first time you use Workers, and it is often your account or email name.
**Copy that whole address. That is the sync server URL the app asks for.**

You can always come back to it later: **dash.cloudflare.com → Workers & Pages →
click `baby-log-sync`** and the address is shown at the top of the page.

## Step 4 — Put the real code in

1. Still on the Worker's page, click **Edit code** (sometimes a `< >` icon, or
   **Quick edit**).
2. Click inside the editor, select everything (Ctrl+A, or Cmd+A on a Mac) and
   delete it.
3. In another tab open
   [`worker/dashboard-worker.js`](dashboard-worker.js) in this repository, copy
   the whole file, and paste it into the empty editor.
4. Click **Deploy** (or **Save and deploy**).

## Step 5 — Connect the database to the Worker

The code needs to know which database to use.

1. On the Worker's page go to **Settings → Bindings**
   (older layouts: **Settings → Variables → D1 Database Bindings**).
2. **Add binding** → choose **D1 database**.
3. Variable name — type exactly this, in capitals:

   ```
   DB
   ```

4. Database: choose **baby-log**.
5. Click **Deploy** / **Save**.

## Step 6 — Check it is working

In your browser, visit your Worker's address with `/v1/health` on the end:

```
https://baby-log-sync.something.workers.dev/v1/health
```

You should see exactly this:

```json
{"ok":true}
```

If you see that, the server is running. (If you get an error mentioning `DB`,
Step 5 did not save — check the variable name is `DB` in capitals.)

## If something goes wrong

**"The request is malformed: Requests without any query are not supported."**
The database console was asked to run an empty query — see the note in Step 2.
Run the three `CREATE` statements one at a time.

**The health check shows an error mentioning `DB`.** The database is not
connected to the Worker. Redo Step 5 and check the variable name is `DB`, in
capitals, and that you clicked Deploy/Save afterwards.

**The health check shows a Cloudflare error page instead of `{"ok":true}`.**
The code did not save. Redo Step 4, making sure the editor was completely empty
before pasting, and click Deploy.

**The app says "That family code was not accepted."** The code was mistyped or
belongs to a different Worker. Copy it again from the first phone — dashes and
capitals do not matter, but every character does.

**The app says it cannot reach the sync server.** Check the address in the app
matches your Worker exactly (it must start with `https://` and have no slash on
the end), and that the health check above works in a browser.

## Step 7 — Pair the two phones

1. Open the app and go to **Settings & data → Share with your partner**.
2. Tap **Create shared log**, paste your Worker address into *Sync server*,
   and tap **Create shared log** again.
3. The app shows a **family code**. On the other phone, open the same screen,
   tap **Join with a code**, paste the same Worker address and the family code.

That is it — both phones now keep the same day. Entries made without signal go
up as soon as there is some.

Keep the family code somewhere safe (a password manager, or written down).
Anyone who has it can read and add to the log, and if you both lose it there is
no way back into that log.

## Step 8 — Optional: the timer on the lock screen

This is what lets your phone show "Asleep for 45m" while it is locked. Skip it
if you do not want notifications.

1. On the Worker's page go to **Settings → Triggers** (older layouts:
   **Triggers** as its own tab).
2. Under **Cron Triggers** click **Add Cron Trigger**.
3. Choose **Cron expression** and type exactly:

   ```
   * * * * *
   ```

   That means "every minute" — it is how often the Worker checks whether a
   timer is running. It only sends a notification when the count has actually
   moved on, so nothing is sent while nobody is nursing or sleeping.
4. Click **Add** / **Save**.

Then on each phone:

1. Open the app in **Safari** and tap the Share button → **Add to Home
   Screen**. iOS only offers notifications to a web app that lives on the Home
   Screen, so this step is not optional on an iPhone.
2. Open Little One from the new Home Screen icon (not from Safari).
3. Go to **Settings & data → Timer on the lock screen** and tap **Turn on
   lock-screen updates**. Say **Allow** when iOS asks about notifications.

Start a sleep or a nursing timer and lock the phone. Within a few minutes a
notification appears, and it updates itself in place rather than stacking up.
When the timer stops you get one last line — "Slept 1h 20m" — and then silence.

Turn it on separately on each phone: the setting belongs to the phone, not to
the shared log.

---

## Optional: skip typing the address on each phone

Tell Claude your Worker address, or edit
[`.env.production`](../.env.production) in this repository yourself: uncomment
the `VITE_SYNC_URL=` line and put your address after the `=`. Once that is
saved, the published app fills the *Sync server* box in for you.

## If you would rather use the command line

See [README.md](README.md) — four commands and it does all of the above,
including creating the database and deploying.
