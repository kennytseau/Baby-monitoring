import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/milestones', icon: '🌟', label: 'Milestones' },
  { to: '/growth', icon: '📈', label: 'Growth' },
  { to: '/log', icon: '🍼', label: 'Log' },
  { to: '/trends', icon: '📊', label: 'By day' },
  { to: '/memories', icon: '💛', label: 'Memories' },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          <span className="tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
