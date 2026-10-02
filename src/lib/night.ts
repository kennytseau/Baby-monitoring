/**
 * Night mode: a dim, warm screen for the 3am feed — easier on your eyes, and
 * less light in the room while she settles. It belongs to the phone, not the
 * shared log: one parent can have it on while the other does not.
 */
export type NightSetting = 'auto' | 'on' | 'off'

/** "Auto" covers 7pm to 7am */
export const NIGHT_FROM_HOUR = 19
export const NIGHT_UNTIL_HOUR = 7

export function isNight(setting: NightSetting, now = new Date()): boolean {
  if (setting !== 'auto') return setting === 'on'
  const hour = now.getHours()
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_UNTIL_HOUR
}
