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
            return json({ error: 'not_found' }, 404);
        }
        catch (err) {
            console.error(err);
            return json({ error: 'server_error' }, 500);
        }
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
async function sync(request, env) {
    const auth = parseAuth(request.headers.get('authorization'));
    if (!auth)
        return json({ error: 'unauthorized' }, 401);
    const household = await env.DB.prepare('SELECT id, token_hash, seq FROM households WHERE id = ?')
        .bind(auth.householdId)
        .first();
    if (!household || !timingSafeEqual(household.token_hash, await tokenHash(auth.householdId, auth.secret))) {
        return json({ error: 'unauthorized' }, 401);
    }
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
            .bind(now, auth.householdId)
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
        await env.DB.batch(records.map((r) => statement.bind(auth.householdId, r.collection, r.id, r.updatedAt, r.deletedAt ?? null, r.data === undefined ? null : JSON.stringify(r.data), seq)));
    }
    const { results } = await env.DB.prepare(`SELECT collection, id, updated_at, deleted_at, data, seq FROM records
     WHERE household_id = ? AND seq > ? ORDER BY seq ASC, collection ASC, id ASC LIMIT ?`)
        .bind(auth.householdId, cursor, MAX_PULL_ROWS)
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
