import { describe, expect, it } from 'vitest'
import { decodeBase64url, pushAvailability } from './push'

describe('pushAvailability', () => {
  const env = { serviceWorker: true, pushManager: true, ios: false, standalone: false }

  it('is ready where the browser offers push', () => {
    expect(pushAvailability(env)).toEqual({ state: 'ready' })
  })

  it('asks an iPhone to add the app to the Home Screen first', () => {
    expect(pushAvailability({ ...env, pushManager: false, ios: true })).toEqual({
      state: 'install-first',
    })
  })

  it('does not ask twice once the app is on the Home Screen', () => {
    expect(pushAvailability({ ...env, pushManager: false, ios: true, standalone: true })).toEqual({
      state: 'unsupported',
    })
  })

  it('is unsupported without a service worker', () => {
    expect(pushAvailability({ ...env, serviceWorker: false })).toEqual({ state: 'unsupported' })
  })
})

describe('decodeBase64url', () => {
  it('decodes an unpadded key to its raw bytes', () => {
    expect([...decodeBase64url('BP4z')]).toEqual([4, 254, 51])
    expect(decodeBase64url('A'.repeat(87))).toHaveLength(65)
  })
})
