import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../components/common/BrandLogo'

export function NotFoundPage() {
  return (
    <main className="auth-page not-found-page">
      <div className="auth-shell">
        <div className="auth-brand"><BrandLogo /></div>
        <section className="auth-card not-found-card" aria-labelledby="not-found-heading">
          <span className="not-found-icon"><Compass size={28} /></span>
          <p className="eyebrow">404 ERROR</p>
          <h1 id="not-found-heading">This page went off queue.</h1>
          <p>We could not find the page you were looking for. Let’s get you back to SmartQueue AI.</p>
          <Link className="button button--primary" to="/"><ArrowLeft size={17} /> Return home</Link>
        </section>
      </div>
    </main>
  )
}
