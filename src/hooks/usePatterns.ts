import { useMemo } from 'react'
import { useAppState } from './useAppState'
import { useNow } from './useNow'
import { dailyMeasures, patternChanges, REGRESSION_DAYS, regressionWatch } from '../lib/changes'
import { adjustedAgeInDays, ageInDays, usesAdjustedAge } from '../lib/age'

/**
 * What has shifted in her pattern lately, and whether it looks like the
 * 4-month sleep regression — read off her own log against her own fortnight
 * before. Shared by the cards that show it and the one whose predictions
 * narrow to it.
 */
export function usePatterns() {
  const { state } = useAppState()
  const profile = state.profile!
  const now = useNow(60_000)
  const measures = useMemo(() => dailyMeasures(state.log, now), [state.log, now])
  const changes = useMemo(() => patternChanges(measures, now), [measures, now])
  const ageWeeks = Math.floor(
    (usesAdjustedAge(profile) ? adjustedAgeInDays(profile, now) : ageInDays(profile.birthDate, now)) / 7,
  )
  const regression = useMemo(
    () => regressionWatch(patternChanges(measures, now, REGRESSION_DAYS), ageWeeks),
    [measures, now, ageWeeks],
  )
  return { measures, changes, regression, ageWeeks }
}
