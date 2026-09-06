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
4. In another browser tab open
   [`worker/schema.sql`](schema.sql) in this repository, click the
   **copy raw file** button, and paste the whole thing into the console.
5. Click **Run** (or **Execute**). It should report success. You have just
   created two empty tables — nothing else happens yet.

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

---

## Optional: skip typing the address on each phone

Tell Claude your Worker address, or edit
[`.env.production`](../.env.production) in this repository yourself: uncomment
the `VITE_SYNC_URL=` line and put your address after the `=`. Once that is
saved, the published app fills the *Sync server* box in for you.

## If you would rather use the command line

See [README.md](README.md) — four commands and it does all of the above,
including creating the database and deploying.
