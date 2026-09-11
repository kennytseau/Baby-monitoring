// Paste-ready copy of worker/src/index.ts with the TypeScript types stripped,
// for people setting the sync server up through Cloudflare's web editor
// instead of the command line (see worker/SETUP-WITHOUT-A-TERMINAL.md).
//
// Generated from src/index.ts — if you change that file, regenerate this one:
//   npx tsc src/index.ts --target es2022 --module esnext --outDir <tmp>

/**
 * Sync backend for the Little One baby tracker.
 *
 * One family = one "household" row plus its records. A device authenticates
 * with the family code (`<householdId>.<secret>`); only the SHA-256 of that
 * pair is stored, so the code cannot be recovered from the database.
 *
 * Sync is a single round trip: the device sends the records it has changed
 * since it last synced and the cursor it last saw, and gets back everything
 * that changed on the server after that cursor. Conflicts resolve last-write-
 * wins on `updatedAt`, which is what you want for two phones logging the same
 * baby — the later edit is the one the parents made most recently.
 */
const COLLECTIONS = ['log', 'growth', 'memories', 'milestones', 'profile'];
const MAX_CHANGES_PER_REQUEST = 500;
const MAX_RECORD_BYTES = 8 * 1024;
const MAX_PULL_ROWS = 1000;
/** Crockford base32 — no I, L, O or U, so a hand-typed code stays unambiguous */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_LENGTH = 10;
const SECRET_LENGTH = 20;
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS')
            return cors(new Response(null, { status: 204 }));
        const url = new URL(request.url);
        try {
            if (url.pathname === '/v1/health')
                return json({ ok: true });
            if (url.pathname === '/v1/households' && request.method === 'POST') {
                return await createHousehold(env);
            }
            if (url.pathname === '/v1/sync' && request.method === 'POST') {
                return await sync(request, env);
            }
            if (url.pathname === '/v1/push/key' && request.method === 'GET') {
                return json({ publicKey: (await vapidKeys(env)).publicKey });
            }
            if (url.pathname === '/v1/push/subscribe' && request.method === 'POST') {
                return await subscribePush(request, env);
            }
            if (url.pathname === '/v1/push/unsubscribe' && request.method === 'POST') {
                return await unsubscribePush(request, env);
            }
            return json({ error: 'not_found' }, 404);
        }
        catch (err) {
            console.error(err);
            return json({ error: 'server_error' }, 500);
        }
    },
    /**
     * Cron tick. iOS will not let a web page keep a counter ticking on the lock
     * screen, so the running sleep or nursing timer is pushed from here instead:
     * once every few minutes the server looks at the shared log, works out how
     * long the timer has been going and updates the one notification in place.
     */
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(pushTimerUpdates(env));
    },
};
/** Mint a new family log and hand back the code that opens it */
async function createHousehold(env) {
    const id = randomCode(ID_LENGTH);
    const secret = randomCode(SECRET_LENGTH);
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO households (id, token_hash, seq, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
        .bind(id, await tokenHash(id, secret), now, now)
        .run();
    return json({ householdId: id, secret, cursor: 0 }, 201);
}
/** Check the family code in the Authorization header and return the household row */
async function authenticate(request, env) {
    const auth = parseAuth(request.headers.get('authorization'));
    if (!auth)
        return null;
    const household = await env.DB.prepare('SELECT id, token_hash, seq FROM households WHERE id = ?')
        .bind(auth.householdId)
        .first();
    if (!household || !timingSafeEqual(household.token_hash, await tokenHash(auth.householdId, auth.secret))) {
        return null;
    }
    return household;
}
async function sync(request, env) {
    const household = await authenticate(request, env);
    if (!household)
        return json({ error: 'unauthorized' }, 401);
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return json({ error: 'bad_json' }, 400);
    }
    const cursor = Number.isFinite(body.cursor) ? Math.max(0, Number(body.cursor)) : 0;
    const incoming = Array.isArray(body.changes) ? body.changes : [];
    if (incoming.length > MAX_CHANGES_PER_REQUEST) {
        return json({ error: 'too_many_changes', limit: MAX_CHANGES_PER_REQUEST }, 413);
    }
    const records = [];
    for (const raw of incoming) {
        const record = validateRecord(raw);
        if (!record)
            return json({ error: 'bad_record' }, 400);
        records.push(record);
    }
    // Every push gets one sequence number, which becomes the cursor the pushing
    // device reports back next time.
    let seq = household.seq;
    if (records.length > 0) {
        const now = new Date().toISOString();
        const bumped = await env.DB.prepare('UPDATE households SET seq = seq + 1, updated_at = ? WHERE id = ? RETURNING seq')
            .bind(now, household.id)
            .first();
        seq = bumped?.seq ?? household.seq + 1;
        // Last write wins: an older edit arriving late must not overwrite a newer one.
        const statement = env.DB.prepare(`INSERT INTO records (household_id, collection, id, updated_at, deleted_at, data, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (household_id, collection, id) DO UPDATE SET
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         data = excluded.data,
         seq = excluded.seq
       WHERE excluded.updated_at > records.updated_at`);
        await env.DB.batch(records.map((r) => statement.bind(household.id, r.collection, r.id, r.updatedAt, r.deletedAt ?? null, r.data === undefined ? null : JSON.stringify(r.data), seq)));
    }
    const { results } = await env.DB.prepare(`SELECT collection, id, updated_at, deleted_at, data, seq FROM records
     WHERE household_id = ? AND seq > ? ORDER BY seq ASC, collection ASC, id ASC LIMIT ?`)
        .bind(household.id, cursor, MAX_PULL_ROWS)
        .all();
    const changes = (results ?? []).map((row) => ({
        collection: row.collection,
        id: row.id,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? undefined,
        data: row.data ? JSON.parse(row.data) : undefined,
    }));
    // A full page means there is more history to walk; the device syncs again
    // from the last row it received rather than skipping the remainder.
    const more = (results?.length ?? 0) >= MAX_PULL_ROWS;
    const nextCursor = more ? results[results.length - 1].seq : Math.max(cursor, seq);
    return json({ cursor: nextCursor, more, changes, serverTime: new Date().toISOString() });
}
function validateRecord(raw) {
    if (typeof raw !== 'object' || raw === null)
        return null;
    const r = raw;
    if (typeof r.collection !== 'string' || !COLLECTIONS.includes(r.collection))
        return null;
    if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 128)
        return null;
    if (typeof r.updatedAt !== 'string' || !isIsoDate(r.updatedAt))
        return null;
    if (r.deletedAt != null && (typeof r.deletedAt !== 'string' || !isIsoDate(r.deletedAt)))
        return null;
    if (r.data !== undefined && r.data !== null) {
        if (JSON.stringify(r.data).length > MAX_RECORD_BYTES)
            return null;
    }
    return {
        collection: r.collection,
        id: r.id,
        updatedAt: r.updatedAt,
        deletedAt: r.deletedAt ?? undefined,
        data: r.data ?? undefined,
    };
}
function isIsoDate(value) {
    return value.length <= 32 && !Number.isNaN(Date.parse(value));
}
function parseAuth(header) {
    if (!header?.startsWith('Bearer '))
        return null;
    const [householdId, secret] = header.slice(7).trim().split('.');
    if (!householdId || !secret)
        return null;
    if (householdId.length > 64 || secret.length > 128)
        return null;
    return { householdId, secret };
}
async function tokenHash(householdId, secret) {
    const bytes = new TextEncoder().encode(`${householdId}:${secret}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Compare two hex digests without leaking where they first differ */
function timingSafeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
function randomCode(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
function json(body, status = 200) {
    return cors(new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    }));
}
/**
 * The app is served from a static host (GitHub Pages), so any origin may call
 * in — the family code, not the origin, is what protects the data.
 */
function cors(response) {
    response.headers.set('access-control-allow-origin', '*');
    response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    response.headers.set('access-control-allow-headers', 'authorization, content-type');
    response.headers.set('access-control-max-age', '86400');
    return response;
}
/* ------------------------------------------------------------------ *
 * Lock-screen timer notifications
 *
 * A web app cannot draw a live counter on an iPhone lock screen — that is a
 * native-only feature — and a service worker is frozen while the phone is
 * locked, so it cannot tick one either. What it can do is show a notification
 * that the server updates. So the running timer is re-sent from here every few
 * minutes under one notification tag, and the phone replaces the old one in
 * place: "Asleep for 45m" becomes "Asleep for 50m" without stacking up.
 * ------------------------------------------------------------------ */
/** VAPID needs a contact URL for the push service; the project page will do */
const VAPID_SUBJECT = 'https://github.com/kennytseau/Baby-monitoring';
/** How long a push service should hold an update if the phone is offline */
const PUSH_TTL_SECONDS = 600;
/** RFC 8188 record size — one record is plenty for a line of text */
const PUSH_RECORD_SIZE = 4096;
/** Notifications step in whole multiples of this, so they do not update every minute */
const TIMER_STEP_MINUTES = 5;
/** A timer left running longer than this was forgotten, not real — stop nagging */
const MAX_NURSING_MINUTES = 4 * 60;
const MAX_SLEEP_MINUTES = 14 * 60;
/** Only recently touched log rows can hold a running timer */
const TIMER_LOOKBACK_HOURS = 18;
const MAX_ENDPOINT_LENGTH = 1024;
/**
 * The server's VAPID identity, generated once and kept in D1 so nobody has to
 * paste key material into the dashboard.
 */
async function vapidKeys(env) {
    const existing = await readVapidKeys(env);
    if (existing)
        return existing;
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify',
    ]));
    const keys = {
        publicKey: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
        jwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    };
    // Two cold requests can race here; whichever row lands first is the identity.
    await env.DB.prepare('INSERT INTO server_keys (name, value, created_at) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING')
        .bind('vapid', JSON.stringify(keys), new Date().toISOString())
        .run();
    return (await readVapidKeys(env)) ?? keys;
}
async function readVapidKeys(env) {
    const row = await env.DB.prepare('SELECT value FROM server_keys WHERE name = ?')
        .bind('vapid')
        .first();
    return row ? JSON.parse(row.value) : null;
}
async function subscribePush(request, env) {
    const household = await authenticate(request, env);
    if (!household)
        return json({ error: 'unauthorized' }, 401);
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return json({ error: 'bad_json' }, 400);
    }
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';
    if (!endpoint.startsWith('https://') || endpoint.length > MAX_ENDPOINT_LENGTH || !p256dh || !auth) {
        return json({ error: 'bad_subscription' }, 400);
    }
    await env.DB.prepare(`INSERT INTO push_subscriptions (household_id, endpoint, p256dh, auth, created_at, last_state)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT (endpoint) DO UPDATE SET
       household_id = excluded.household_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth`)
        .bind(household.id, endpoint, p256dh, auth, new Date().toISOString())
        .run();
    return json({ ok: true });
}
async function unsubscribePush(request, env) {
    const household = await authenticate(request, env);
    if (!household)
        return json({ error: 'unauthorized' }, 401);
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return json({ error: 'bad_json' }, 400);
    }
    if (typeof body.endpoint !== 'string')
        return json({ error: 'bad_subscription' }, 400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND household_id = ?')
        .bind(body.endpoint, household.id)
        .run();
    return json({ ok: true });
}
/** One cron tick: refresh the timer notification on every subscribed phone */
async function pushTimerUpdates(env) {
    const { results } = await env.DB.prepare('SELECT household_id, endpoint, p256dh, auth, last_state FROM push_subscriptions').all();
    if (!results?.length)
        return;
    const byHousehold = new Map();
    for (const row of results) {
        const rows = byHousehold.get(row.household_id);
        if (rows)
            rows.push(row);
        else
            byHousehold.set(row.household_id, [row]);
    }
    const keys = await vapidKeys(env);
    for (const [householdId, rows] of byHousehold) {
        const entries = await recentLogEntries(env, householdId);
        const name = (await babyName(env, householdId)) ?? 'Little one';
        const running = runningTimer(entries);
        for (const row of rows) {
            const message = nextMessage(name, running, row.last_state, entries);
            if (!message)
                continue;
            await deliver(env, keys, row, message);
        }
    }
}
/** Log entries that could still hold a running timer, newest first */
async function recentLogEntries(env, householdId) {
    const since = new Date(Date.now() - TIMER_LOOKBACK_HOURS * 3600_000).toISOString();
    const { results } = await env.DB.prepare(`SELECT data FROM records
     WHERE household_id = ? AND collection = 'log' AND deleted_at IS NULL AND updated_at >= ?`)
        .bind(householdId, since)
        .all();
    const entries = [];
    for (const row of results ?? []) {
        if (!row.data)
            continue;
        try {
            const entry = JSON.parse(row.data);
            if (entry && typeof entry === 'object')
                entries.push(entry);
        }
        catch {
            // A row we cannot read is a row we cannot count a timer from.
        }
    }
    return entries;
}
async function babyName(env, householdId) {
    const row = await env.DB.prepare(`SELECT data FROM records WHERE household_id = ? AND collection = 'profile' AND id = 'profile'`)
        .bind(householdId)
        .first();
    if (!row?.data)
        return null;
    try {
        const name = JSON.parse(row.data).name;
        return typeof name === 'string' && name.trim() ? name.trim() : null;
    }
    catch {
        return null;
    }
}
/** The sleep or nursing timer that is running now — the later one wins if both are */
export function runningTimer(entries, now = Date.now()) {
    let best = null;
    for (const entry of entries) {
        if (typeof entry.id !== 'string')
            continue;
        if (entry.type === 'sleep' && typeof entry.time === 'string' && !entry.endTime) {
            const startedAt = Date.parse(entry.time);
            const minutes = (now - startedAt) / 60_000;
            if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_SLEEP_MINUTES)
                continue;
            if (!best || startedAt > best.startedAt) {
                best = { startedAt, state: { kind: 'sleep', id: entry.id, minutes } };
            }
        }
        if (entry.type === 'feed' && entry.kind === 'nursing' && typeof entry.sideStartedAt === 'string') {
            const startedAt = Date.parse(entry.sideStartedAt);
            const onSide = (now - startedAt) / 60_000;
            const banked = numberOr(entry.leftMinutes) + numberOr(entry.rightMinutes);
            const minutes = banked + onSide;
            if (!Number.isFinite(onSide) || onSide < 0 || minutes > MAX_NURSING_MINUTES)
                continue;
            if (!best || startedAt > best.startedAt) {
                best = {
                    startedAt,
                    state: {
                        kind: 'nursing',
                        id: entry.id,
                        minutes,
                        side: entry.activeSide === 'right' ? 'right' : entry.activeSide === 'left' ? 'left' : undefined,
                    },
                };
            }
        }
    }
    return best?.state ?? null;
}
function numberOr(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
/**
 * What this phone should be showing. `state` is the last thing we sent it, so
 * an unchanged counter sends nothing and a timer that has stopped gets one
 * closing summary rather than a notification frozen mid-count.
 */
export function nextMessage(name, running, lastState, entries) {
    if (running) {
        const step = Math.floor(running.minutes / TIMER_STEP_MINUTES) * TIMER_STEP_MINUTES;
        const state = `${running.kind}:${running.id}:${step}`;
        if (state === lastState)
            return null;
        if (running.kind === 'sleep') {
            return {
                state,
                title: `${name} is asleep`,
                body: step === 0 ? 'Just went down' : `Asleep for ${formatMinutes(step)}`,
            };
        }
        const side = running.side ? ` · on the ${running.side}` : '';
        return {
            state,
            title: `Nursing ${name}`,
            body: step === 0 ? `Just started${side}` : `${formatMinutes(step)} so far${side}`,
        };
    }
    // Nothing running. If the last thing we showed was a live counter, close it off.
    const previous = lastState?.split(':') ?? [];
    if (previous.length !== 3 || previous[2] === 'done')
        return null;
    const [kind, id] = previous;
    const entry = entries.find((e) => e.id === id);
    const state = `${kind}:${id}:done`;
    if (kind === 'sleep') {
        const minutes = entry && entry.endTime ? (Date.parse(entry.endTime) - Date.parse(entry.time)) / 60_000 : null;
        return {
            state,
            title: `${name} woke up`,
            body: minutes != null && minutes > 0 ? `Slept ${formatMinutes(Math.round(minutes))}` : 'Sleep finished',
        };
    }
    const total = entry ? numberOr(entry.leftMinutes) + numberOr(entry.rightMinutes) : 0;
    const sides = entry && numberOr(entry.leftMinutes) > 0 && numberOr(entry.rightMinutes) > 0
        ? ` · L ${formatMinutes(Math.round(numberOr(entry.leftMinutes)))} · R ${formatMinutes(Math.round(numberOr(entry.rightMinutes)))}`
        : '';
    return {
        state,
        title: 'Feed finished',
        body: total > 0 ? `Nursed ${formatMinutes(Math.round(total))}${sides}` : 'Nursing finished',
    };
}
export function formatMinutes(minutes) {
    const whole = Math.max(0, Math.round(minutes));
    if (whole < 60)
        return `${whole}m`;
    const hours = Math.floor(whole / 60);
    const rest = whole % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
/** Send one notification and remember it, dropping subscriptions the phone has revoked */
async function deliver(env, keys, row, message) {
    let response;
    try {
        response = await sendWebPush(keys, row, JSON.stringify({ title: message.title, body: message.body }));
    }
    catch (err) {
        console.error('push failed', err);
        return;
    }
    if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
        return;
    }
    if (!response.ok) {
        console.error('push rejected', response.status, await response.text());
        return;
    }
    await env.DB.prepare('UPDATE push_subscriptions SET last_state = ?, last_sent_at = ? WHERE endpoint = ?')
        .bind(message.state, new Date().toISOString(), row.endpoint)
        .run();
}
async function sendWebPush(keys, subscription, payload) {
    const body = await encryptPushPayload(new TextEncoder().encode(payload), subscription.p256dh, subscription.auth);
    return fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            authorization: await vapidAuthorization(subscription.endpoint, keys),
            'content-encoding': 'aes128gcm',
            'content-type': 'application/octet-stream',
            ttl: String(PUSH_TTL_SECONDS),
            urgency: 'low',
            // One topic means an undelivered older count is replaced, not queued.
            topic: 'littleonetimer',
        },
        body,
    });
}
/** The signed `Authorization: vapid …` header the push service checks */
export async function vapidAuthorization(endpoint, keys) {
    const claims = {
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: VAPID_SUBJECT,
    };
    const signingInput = `${base64urlText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${base64urlText(JSON.stringify(claims))}`;
    const key = await crypto.subtle.importKey('jwk', { ...keys.jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput)));
    return `vapid t=${signingInput}.${base64url(signature)}, k=${keys.publicKey}`;
}
/**
 * Encrypt a push payload per RFC 8291 (aes128gcm). The phone's subscription
 * hands us its public key and an auth secret; we mix them with a throwaway
 * key pair so only that phone can read the message — the push service that
 * carries it cannot.
 *
 * `material` is only for tests, which need a fixed key pair and salt to check
 * the output against the worked example in the RFC.
 */
export async function encryptPushPayload(plaintext, p256dhBase64, authBase64, material) {
    const clientPublicRaw = fromBase64url(p256dhBase64);
    const authSecret = fromBase64url(authBase64);
    const salt = material?.salt ?? crypto.getRandomValues(new Uint8Array(16));
    let serverPrivate;
    let serverPublicRaw;
    if (material) {
        serverPrivate = await crypto.subtle.importKey('jwk', material.privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
        serverPublicRaw = material.publicKey;
    }
    else {
        const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
            'deriveBits',
        ]));
        serverPrivate = pair.privateKey;
        serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    }
    const clientPublic = await crypto.subtle.importKey('raw', clientPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublic }, serverPrivate, 256));
    // RFC 8291 §3.4: the auth secret salts the shared secret, then the record
    // salt expands it into the content key and nonce.
    const authPrk = await hmacSha256(authSecret, shared);
    const keyInfo = concatBytes(utf8('WebPush: info\0'), clientPublicRaw, serverPublicRaw, Uint8Array.of(1));
    const prk = await hmacSha256(salt, await hmacSha256(authPrk, keyInfo));
    const contentKey = (await hmacSha256(prk, utf8('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
    const nonce = (await hmacSha256(prk, utf8('Content-Encoding: nonce\0\x01'))).slice(0, 12);
    const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, 
    // 0x02 is the last-record delimiter; one record carries the whole payload.
    concatBytes(plaintext, Uint8Array.of(2))));
    const header = new Uint8Array(21 + serverPublicRaw.length);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, PUSH_RECORD_SIZE);
    header[20] = serverPublicRaw.length;
    header.set(serverPublicRaw, 21);
    return concatBytes(header, ciphertext);
}
async function hmacSha256(keyBytes, data) {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
    ]);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}
function utf8(value) {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1)
        bytes[i] = value.charCodeAt(i) & 0xff;
    return bytes;
}
function concatBytes(...parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
export function base64url(bytes) {
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlText(value) {
    return base64url(new TextEncoder().encode(value));
}
export function fromBase64url(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
