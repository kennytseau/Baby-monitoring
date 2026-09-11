import { describe, expect, it } from 'vitest'
import {
  base64url,
  encryptPushPayload,
  formatMinutes,
  fromBase64url,
  nextMessage,
  runningTimer,
  vapidAuthorization,
} from './index'

/** What a phone does with a push body: unwrap the header and decrypt (RFC 8291) */
async function decryptAsPhone(
  body: Uint8Array,
  clientPrivate: CryptoKey,
  clientPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16)
  const serverPublicRaw = body.slice(21, 21 + body[20])
  const ciphertext = body.slice(21 + body[20])

  const serverPublic = await crypto.subtle.importKey(
    'raw',
    serverPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublic }, clientPrivate, 256),
  )
  const hmac = async (key: Uint8Array, data: Uint8Array) =>
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
        data,
      ),
    )
  const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)
  const keyInfo = new Uint8Array([
    ...bytes('WebPush: info\0'),
    ...clientPublicRaw,
    ...serverPublicRaw,
    1,
  ])
  const prk = await hmac(salt, await hmac(await hmac(authSecret, shared), keyInfo))
  const contentKey = (await hmac(prk, bytes('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16)
  const nonce = (await hmac(prk, bytes('Content-Encoding: nonce\0\x01'))).slice(0, 12)

  const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['decrypt'])
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext),
  )
  // Strip the trailing 0x02 last-record delimiter.
  return new TextDecoder().decode(plain.slice(0, -1))
}

describe('push payload encryption', () => {
  it('reproduces the worked example in RFC 8291', async () => {
    const serverPublic = fromBase64url(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    )
    const body = await encryptPushPayload(
      new TextEncoder().encode('When I grow up, I want to be a watermelon'),
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      'BTBZMqHH6r4Tts7J_aSIgg',
      {
        salt: fromBase64url('DGv6ra1nlYgDCS1FRnbzlw'),
        publicKey: serverPublic,
        privateJwk: {
          kty: 'EC',
          crv: 'P-256',
          d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
          x: base64url(serverPublic.slice(1, 33)),
          y: base64url(serverPublic.slice(33, 65)),
          key_ops: ['deriveBits'],
        },
      },
    )
    expect(base64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6' +
        'TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })

  it('encrypts to something only the subscribed phone can read', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const authSecret = crypto.getRandomValues(new Uint8Array(16))

    const body = await encryptPushPayload(
      new TextEncoder().encode('{"title":"Madison is asleep","body":"Asleep for 45m"}'),
      base64url(publicRaw),
      base64url(authSecret),
    )
    await expect(decryptAsPhone(body, pair.privateKey, publicRaw, authSecret)).resolves.toBe(
      '{"title":"Madison is asleep","body":"Asleep for 45m"}',
    )
  })
})

describe('VAPID authorization', () => {
  it('signs a token the push service can verify, scoped to that service', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const keys = {
      publicKey: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
      jwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    }

    const header = await vapidAuthorization('https://web.push.apple.com/abc123', keys)
    const [, token, sentKey] = header.match(/^vapid t=([\w.-]+), k=([\w-]+)$/) ?? []
    expect(sentKey).toBe(keys.publicKey)

    const [encodedHeader, encodedClaims, signature] = token.split('.')
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(encodedClaims)))
    expect(claims.aud).toBe('https://web.push.apple.com')
    expect(claims.sub).toMatch(/^https:\/\//)
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)

    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      fromBase64url(signature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    )
    expect(verified).toBe(true)
  })
})

const NOW = Date.parse('2026-09-11T10:00:00.000Z')
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

describe('which timer is running', () => {
  it('finds an open sleep', () => {
    const timer = runningTimer([{ id: 's1', type: 'sleep', time: ago(45) }], NOW)
    expect(timer).toMatchObject({ kind: 'sleep', id: 's1' })
    expect(timer!.minutes).toBeCloseTo(45)
  })

  it('ignores a sleep that has ended', () => {
    expect(runningTimer([{ id: 's1', type: 'sleep', time: ago(45), endTime: ago(5) }], NOW)).toBeNull()
  })

  it('adds banked minutes to the side being timed', () => {
    const timer = runningTimer(
      [{ id: 'f1', type: 'feed', kind: 'nursing', leftMinutes: 8, activeSide: 'right', sideStartedAt: ago(4) }],
      NOW,
    )
    expect(timer).toMatchObject({ kind: 'nursing', id: 'f1', side: 'right' })
    expect(timer!.minutes).toBeCloseTo(12)
  })

  it('treats a paused feed as not running', () => {
    expect(
      runningTimer([{ id: 'f1', type: 'feed', kind: 'nursing', leftMinutes: 8, activeSide: 'left' }], NOW),
    ).toBeNull()
  })

  it('prefers whichever timer started last', () => {
    const timer = runningTimer(
      [
        { id: 's1', type: 'sleep', time: ago(45) },
        { id: 'f1', type: 'feed', kind: 'nursing', activeSide: 'left', sideStartedAt: ago(3) },
      ],
      NOW,
    )
    expect(timer).toMatchObject({ id: 'f1' })
  })

  it('drops a timer left running overnight rather than nagging about it', () => {
    expect(runningTimer([{ id: 's1', type: 'sleep', time: ago(20 * 60) }], NOW)).toBeNull()
  })
})

describe('what the notification says', () => {
  const sleeping = { kind: 'sleep' as const, id: 's1', minutes: 47 }

  it('rounds the counter to five-minute steps', () => {
    expect(nextMessage('Madison', sleeping, null, [])).toMatchObject({
      state: 'sleep:s1:45',
      title: 'Madison is asleep',
      body: 'Asleep for 45m',
    })
  })

  it('says nothing when the step has not moved', () => {
    expect(nextMessage('Madison', sleeping, 'sleep:s1:45', [])).toBeNull()
  })

  it('names the side being nursed', () => {
    expect(
      nextMessage('Madison', { kind: 'nursing', id: 'f1', minutes: 12, side: 'right' }, null, []),
    ).toMatchObject({ body: '10m so far · on the right' })
  })

  it('closes off a sleep that has ended', () => {
    const entries = [{ id: 's1', type: 'sleep', time: ago(80), endTime: ago(5) }]
    expect(nextMessage('Madison', null, 'sleep:s1:70', entries)).toMatchObject({
      state: 'sleep:s1:done',
      title: 'Madison woke up',
      body: 'Slept 1h 15m',
    })
  })

  it('closes off a finished feed with the split between sides', () => {
    const entries = [{ id: 'f1', type: 'feed', kind: 'nursing', leftMinutes: 8, rightMinutes: 10 }]
    expect(nextMessage('Madison', null, 'nursing:f1:15', entries)).toMatchObject({
      state: 'nursing:f1:done',
      body: 'Nursed 18m · L 8m · R 10m',
    })
  })

  it('stays quiet once the closing summary has gone out', () => {
    expect(nextMessage('Madison', null, 'sleep:s1:done', [])).toBeNull()
    expect(nextMessage('Madison', null, null, [])).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('reads the way a parent would say it', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(95)).toBe('1h 35m')
  })
})
