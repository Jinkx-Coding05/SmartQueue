import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/useAuth'
import { DashboardHeader } from './DashboardHeader'
import { Sidebar } from './Sidebar'

type DashboardLayoutProps = { children: ReactNode }

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user || user.role !== 'citizen') return null

  const authUser = { name: user.fullName, email: user.email, phone: user.phoneNumber, role: user.role }
  return <div className="dashboard-shell"><Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="dashboard-main"><DashboardHeader user={authUser} onMenuOpen={() => setSidebarOpen(true)} /><div className="dashboard-content">{children}</div></div></div>
}
