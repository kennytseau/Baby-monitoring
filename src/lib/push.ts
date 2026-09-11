import type { SyncCredentials } from './syncClient'

/**
 * Lock-screen updates for the running sleep or nursing timer.
 *
 * A web page cannot draw a live counter on an iPhone lock screen and cannot
 * keep one ticking in the background, so the sync server sends the count
 * instead. This module is the phone's half of that: register the service
 * worker, take out a push subscription, and tell the server where to send.
 */

export type PushAvailability =
  | { state: 'ready' }
  | { state: 'install-first' }
  | { state: 'unsupported' }

export interface PushEnvironment {
  serviceWorker: boolean
  pushManager: boolean
  ios: boolean
  standalone: boolean
}

export function readPushEnvironment(): PushEnvironment {
  const ios =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window && 'Notification' in window,
    ios,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true,
  }
}

/**
 * iOS only exposes push to a web app that has been added to the Home Screen,
 * so a missing PushManager there is an instruction, not a dead end.
 */
export function pushAvailability(env: PushEnvironment): PushAvailability {
  if (!env.serviceWorker) return { state: 'unsupported' }
  if (env.pushManager) return { state: 'ready' }
  if (env.ios && !env.standalone) return { state: 'install-first' }
  return { state: 'unsupported' }
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Nothing here is load-bearing for the app itself; a failure just means
      // no lock-screen updates on this device.
    })
  })
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** The server's public signing key, which the phone needs before it can subscribe */
export async function fetchApplicationServerKey(serverUrl: string): Promise<string> {
  const response = await fetch(`${serverUrl.trim().replace(/\/+$/, '')}/v1/push/key`)
  if (!response.ok) throw new Error('The sync server did not hand out a notification key.')
  const { publicKey } = (await response.json()) as { publicKey?: string }
  if (!publicKey) throw new Error('The sync server did not hand out a notification key.')
  return publicKey
}

/**
 * Ask for permission and subscribe. Safari wants the permission prompt to come
 * straight off the tap, so the caller fetches the server key in advance and
 * passes it in rather than making this await a round trip first.
 */
export async function enablePush(
  credentials: SyncCredentials,
  applicationServerKey: string,
): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications are switched off for this app in your phone settings.')
  }
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64url(applicationServerKey),
      })
    } catch {
      throw new Error(
        'Your phone would not sign up for notifications. Check that Little One is allowed to notify you in Settings, then try again.',
      )
    }
  }
  await send(credentials, '/v1/push/subscribe', subscription.toJSON())
}

export async function disablePush(credentials: SyncCredentials): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await send(credentials, '/v1/push/unsubscribe', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

async function send(credentials: SyncCredentials, path: string, body: unknown): Promise<void> {
  const response = await fetch(`${credentials.serverUrl.trim().replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${credentials.householdId}.${credentials.secret}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error("Couldn't reach the sync server — try again when you have signal.")
}

/** Push keys travel as base64url text but `subscribe` wants the raw bytes */
export function decodeBase64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
