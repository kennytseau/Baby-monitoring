import { useEffect, useSyncExternalStore } from 'react'
import { isNight, type NightSetting } from '../lib/night'
import { useNow } from './useNow'

const KEY = 'little-one:night-mode'
/** The status bar colour in night mode, matching its background */
const NIGHT_BAR = '#0b0705'
const listeners = new Set<() => void>()

function read(): NightSetting {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'on' || value === 'off' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setNightSetting(setting: NightSetting): void {
  try {
    localStorage.setItem(KEY, setting)
  } catch {
    // Private browsing can refuse storage; the choice then lasts the session.
  }
  listeners.forEach((listener) => listener())
}

export function useNightSetting(): NightSetting {
  return useSyncExternalStore(subscribe, read, () => 'auto')
}

/** Put the whole app into night mode when it should be, and back out of it */
export function useNightMode(): void {
  const setting = useNightSetting()
  const now = useNow(60_000)
  const night = isNight(setting, now)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.night = night ? 'on' : 'off'
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.dataset.day ??= meta.content
      meta.content = night ? NIGHT_BAR : meta.dataset.day
    }
  }, [night])
}
