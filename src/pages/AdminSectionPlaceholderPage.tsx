import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'

export function AdminSectionPlaceholderPage() {
  const { pathname } = useLocation()
  const label = pathname.split('/').pop()?.replaceAll('-', ' ') ?? 'section'
  return <AdminDashboardLayout><section className="admin-placeholder"><span className="admin-placeholder-icon"><ShieldCheck size={25} /></span><p className="admin-kicker">ADMIN WORKSPACE</p><h1>{label.replace(/\b\w/g, (letter) => letter.toUpperCase())}</h1><p>This admin area is reserved for a future milestone. The dashboard shell and role protection are active.</p><Link className="admin-action-button admin-action-button--secondary" to="/admin/dashboard"><ArrowLeft size={16} /> Back to overview</Link></section></AdminDashboardLayout>
}
