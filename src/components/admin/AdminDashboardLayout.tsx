import { BarChart3, Bell, CalendarDays, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Menu, Settings, SlidersHorizontal, Sparkles, Ticket, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../common/BrandLogo'
import { useAuth } from '../../context/useAuth'
import '../../styles/admin.css'

type AdminDashboardLayoutProps = { children: ReactNode }

const navigation = [
  { label: 'Overview', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Queue Management', to: '/admin/queue-management', icon: ClipboardList },
  { label: 'Token Management', to: '/admin/token-management', icon: Ticket },
  { label: 'Appointments', to: '/admin/appointments', icon: CalendarDays },
  { label: 'Counter Management', to: '/admin/counter-management', icon: SlidersHorizontal },
  { label: 'AI Insights', to: '/admin/ai-insights', icon: Sparkles },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]
const adminDateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function AdminDashboardLayout({ children }: AdminDashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const handleLogout = () => { void signOut(); navigate('/login', { replace: true }) }

  if (!user || user.role !== 'admin') return null
  const adminName = user.fullName

  return (
    <div className="admin-shell">
      {sidebarOpen && <button className="admin-overlay" type="button" aria-label="Close admin navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`} aria-label="Admin dashboard navigation">
        <div className="admin-sidebar__top"><BrandLogo /><button className="admin-sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
        <p className="admin-sidebar-label">ADMIN WORKSPACE</p>
        <nav className="admin-sidebar-nav">
          {navigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/admin/dashboard'} className={({ isActive }) => `admin-sidebar-link ${isActive || (to !== '/admin/dashboard' && location.pathname.startsWith(to)) ? 'admin-sidebar-link--active' : ''}`} onClick={() => setSidebarOpen(false)}><Icon size={17} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="admin-sidebar-footer"><button className="admin-sidebar-link admin-logout" type="button" onClick={handleLogout}><LogOut size={17} /><span>Logout</span></button><p>SmartQueue AI<br /><span>Administrator workspace</span></p></div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button className="admin-menu-button" type="button" aria-label="Open admin navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="admin-header-copy"><p>ADMIN WORKSPACE</p><strong>Welcome, {adminName.split(' ')[0]}.</strong><span>SmartQueue AI</span></div>
          <div className="admin-header-actions"><label className="admin-search"><span className="sr-only">Search dashboard</span><input type="search" placeholder="Search patients or tokens" /><SlidersHorizontal size={16} aria-hidden="true" /></label><span className="admin-date">{adminDateLabel}</span><div className="admin-notification-wrap"><button className="admin-notification-button" type="button" aria-label="View admin notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><span /></button>{notificationsOpen && <div className="admin-notification-menu" role="status"><strong>Notifications</strong><p>Notifications will appear here when they are connected.</p></div>}</div><div className="admin-profile-wrap"><button className="admin-profile-button" type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span className="admin-avatar">{adminName.charAt(0).toUpperCase()}</span><span><strong>{adminName}</strong><small>{user.email}</small></span><ChevronDown size={15} /></button>{profileOpen && <div className="admin-profile-menu"><strong>{adminName}</strong><span>{user.email}</span><button type="button" onClick={handleLogout}>Log out</button></div>}</div></div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
