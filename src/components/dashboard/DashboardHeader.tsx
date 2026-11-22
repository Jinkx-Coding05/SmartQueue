import { Bell, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../../types/auth'

type DashboardHeaderProps = { user: AuthUser; onMenuOpen: () => void }

export function DashboardHeader({ user, onMenuOpen }: DashboardHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const displayName = user.name?.trim() || 'Citizen'

  return (
    <header className="dashboard-header">
      <button className="dashboard-menu-button" type="button" aria-label="Open navigation" onClick={onMenuOpen}><Menu size={21} /></button>
      <div className="dashboard-header__spacer" />
      <div className="notification-wrap"><button className="notification-button" type="button" aria-label="View notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={19} /><span /></button>{notificationsOpen && <div className="notification-popover" role="status"><strong>Notifications</strong><p>View the notifications linked to your account.</p><Link to="/citizen/dashboard#notifications" onClick={() => setNotificationsOpen(false)}>Open notifications</Link></div>}</div>
      <Link className="dashboard-profile" to="/citizen/profile" aria-label="Open citizen profile"><span className="avatar">{displayName.charAt(0).toUpperCase()}</span><span><strong>{displayName}</strong><small>Citizen</small></span></Link>
    </header>
  )
}
