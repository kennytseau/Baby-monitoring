import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppState,
  BabyProfile,
  GrowthEntry,
  LogEntry,
  Memory,
  MilestoneRecord,
} from '../lib/types'
import { clearState, exportStateJson, loadState, saveState } from '../lib/storage'

interface AppStateContextValue {
  state: AppState
  setProfile: (profile: BabyProfile) => void
  setMilestoneAchieved: (milestoneId: string, achievedOn: string | null) => void
  addGrowth: (entry: GrowthEntry) => void
  updateGrowth: (entry: GrowthEntry) => void
  deleteGrowth: (id: string) => void
  addLog: (entry: LogEntry) => void
  updateLog: (entry: LogEntry) => void
  deleteLog: (id: string) => void
  addMemory: (memory: Memory) => void
  updateMemory: (memory: Memory) => void
  deleteMemory: (id: string) => void
  exportData: () => void
  resetAll: () => void
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const setProfile = useCallback((profile: BabyProfile) => {
    setState((s) => ({ ...s, profile }))
  }, [])

  const setMilestoneAchieved = useCallback((milestoneId: string, achievedOn: string | null) => {
    setState((s) => {
      const others = s.milestones.filter((m) => m.milestoneId !== milestoneId)
      const milestones: MilestoneRecord[] = achievedOn
        ? [...others, { milestoneId, achievedOn }]
        : others
      return { ...s, milestones }
    })
  }, [])

  const addGrowth = useCallback((entry: GrowthEntry) => {
    setState((s) => ({ ...s, growth: [...s.growth, entry] }))
  }, [])
  const updateGrowth = useCallback((entry: GrowthEntry) => {
    setState((s) => ({ ...s, growth: s.growth.map((g) => (g.id === entry.id ? entry : g)) }))
  }, [])
  const deleteGrowth = useCallback((id: string) => {
    setState((s) => ({ ...s, growth: s.growth.filter((g) => g.id !== id) }))
  }, [])

  const addLog = useCallback((entry: LogEntry) => {
    setState((s) => ({ ...s, log: [...s.log, entry] }))
  }, [])
  const updateLog = useCallback((entry: LogEntry) => {
    setState((s) => ({ ...s, log: s.log.map((e) => (e.id === entry.id ? entry : e)) }))
  }, [])
  const deleteLog = useCallback((id: string) => {
    setState((s) => ({ ...s, log: s.log.filter((e) => e.id !== id) }))
  }, [])

  const addMemory = useCallback((memory: Memory) => {
    setState((s) => ({ ...s, memories: [...s.memories, memory] }))
  }, [])
  const updateMemory = useCallback((memory: Memory) => {
    setState((s) => ({ ...s, memories: s.memories.map((m) => (m.id === memory.id ? memory : m)) }))
  }, [])
  const deleteMemory = useCallback((id: string) => {
    setState((s) => ({ ...s, memories: s.memories.filter((m) => m.id !== id) }))
  }, [])

  const exportData = useCallback(() => {
    setState((s) => {
      const blob = new Blob([exportStateJson(s)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `baby-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      return s
    })
  }, [])

  const resetAll = useCallback(() => {
    clearState()
    setState(loadState())
  }, [])

  const value = useMemo(
    () => ({
      state,
      setProfile,
      setMilestoneAchieved,
      addGrowth,
      updateGrowth,
      deleteGrowth,
      addLog,
      updateLog,
      deleteLog,
      addMemory,
      updateMemory,
      deleteMemory,
      exportData,
      resetAll,
    }),
    [state, setProfile, setMilestoneAchieved, addGrowth, updateGrowth, deleteGrowth, addLog, updateLog, deleteLog, addMemory, updateMemory, deleteMemory, exportData, resetAll],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
