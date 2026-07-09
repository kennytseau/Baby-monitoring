import { Navigate, Route, Routes } from 'react-router-dom'
import { useAppState } from './hooks/useAppState'
import { TabBar } from './components/TabBar'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { Milestones } from './pages/Milestones'
import { Growth } from './pages/Growth'
import { DailyLog } from './pages/DailyLog'
import { Memories } from './pages/Memories'

export default function App() {
  const { state } = useAppState()

  if (!state.profile) {
    return (
      <div className="app-shell">
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/growth" element={<Growth />} />
        <Route path="/log" element={<DailyLog />} />
        <Route path="/memories" element={<Memories />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  )
}
