import type { SyncRecord, SyncResponse } from './sync'

export interface SyncCredentials {
  serverUrl: string
  householdId: string
  secret: string
}

/** The default sync server, baked in at build time; the app can override it */
export const DEFAULT_SYNC_URL: string = import.meta.env.VITE_SYNC_URL ?? ''

const REQUEST_TIMEOUT_MS = 15_000
/** Kept under the Worker's own per-request limit */
export const MAX_CHANGES_PER_PUSH = 400

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

function normalizeUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '')
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    throw new SyncError(
      err instanceof DOMException && err.name === 'AbortError'
        ? 'The sync server took too long to answer.'
        : "Couldn't reach the sync server — changes are saved here and will go up later.",
    )
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 401) throw new SyncError('That family code was not accepted.', 401)
  if (!response.ok) throw new SyncError(`Sync server error (${response.status}).`, response.status)
  return (await response.json()) as T
}

/** Create a brand new family log and return the credentials that open it */
export function createHousehold(serverUrl: string): Promise<{
  householdId: string
  secret: string
  cursor: number
}> {
  return request(`${normalizeUrl(serverUrl)}/v1/households`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
}

/** Push this device's changes and pull everything new in one round trip */
export function pushPull(
  credentials: SyncCredentials,
  cursor: number,
  changes: SyncRecord[],
): Promise<SyncResponse> {
  return request(`${normalizeUrl(credentials.serverUrl)}/v1/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${credentials.householdId}.${credentials.secret}`,
    },
    body: JSON.stringify({ cursor, changes }),
  })
}
