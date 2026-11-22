import { BarChart3, CalendarDays, FileText, LayoutDashboard, LogOut, Ticket, UserCircle, X } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../common/BrandLogo'
import { useAuth } from '../../context/useAuth'

type SidebarProps = { open: boolean; onClose: () => void }

const navigation = [
  { label: 'Overview', to: '/citizen/dashboard', icon: LayoutDashboard },
  { label: 'Book a Token', to: '/citizen/book-token', icon: Ticket },
  { label: 'My Appointments', to: '/citizen/appointments', icon: CalendarDays },
  { label: 'Documents', to: '/citizen/documents', icon: FileText },
  { label: 'Public Statistics', to: '/public-statistics', icon: BarChart3 },
  { label: 'Profile', to: '/citizen/profile', icon: UserCircle },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleLogout = () => {
    void signOut().finally(() => navigate('/login'))
  }

  return (
    <>
      {open && <button className="dashboard-overlay" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`dashboard-sidebar ${open ? 'dashboard-sidebar--open' : ''}`} aria-label="Citizen dashboard navigation">
        <div className="dashboard-sidebar__top"><BrandLogo /><button className="sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}><X size={20} /></button></div>
        <p className="sidebar-label">MY SMARTQUEUE</p>
        <nav className="sidebar-nav">
          {navigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/citizen/dashboard'} className={({ isActive }) => `sidebar-link ${isActive || (to !== '/citizen/dashboard' && location.pathname.startsWith(to)) ? 'sidebar-link--active' : ''}`} onClick={onClose}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="sidebar-footer"><button className="sidebar-link sidebar-logout" type="button" onClick={handleLogout}><LogOut size={18} /><span>Logout</span></button><p>SmartQueue AI<br /><span>Signed-in workspace</span></p></div>
      </aside>
    </>
  )
}
