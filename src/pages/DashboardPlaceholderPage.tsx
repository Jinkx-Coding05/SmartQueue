import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { BrandLogo } from '../components/common/BrandLogo'

export function DashboardPlaceholderPage() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const roleName = isAdmin ? 'Administrator' : 'Citizen'

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand"><BrandLogo /></div>
        <section className="auth-card not-found-card" aria-labelledby="dashboard-placeholder-heading">
          <span className="not-found-icon"><ShieldCheck size={28} /></span>
          <p className="eyebrow">{roleName.toUpperCase()} WORKSPACE</p>
          <h1 id="dashboard-placeholder-heading">Your dashboard is next.</h1>
          <p>Authentication is working. The {roleName.toLowerCase()} dashboard will be implemented in the next milestone.</p>
          <Link className="button button--primary" to="/">Return home <ArrowRight size={17} /></Link>
        </section>
      </div>
    </main>
  )
}
