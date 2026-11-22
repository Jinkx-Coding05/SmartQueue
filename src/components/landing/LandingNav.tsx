import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../common/BrandLogo'

const navItems: Array<{ label: string; href?: string; to?: string }> = [
  { label: 'Home', href: '#top' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Public Statistics', to: '/public-statistics' },
]

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header" id="top">
      <div className="container nav-inner">
        <BrandLogo />

        <nav className={`desktop-nav ${menuOpen ? 'desktop-nav--open' : ''}`} aria-label="Main navigation">
          {navItems.map((item) => item.to ? <Link key={item.label} to={item.to} onClick={closeMenu}>{item.label}</Link> : <a key={item.label} href={item.href} onClick={closeMenu}>{item.label}</a>)}
        </nav>

        <div className="nav-actions">
          <Link className="login-link" to="/login" onClick={closeMenu}>
            Login
          </Link>
          <Link className="button button--small button--primary" to="/register" onClick={closeMenu}>
            Get Started
          </Link>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <nav
        id="mobile-navigation"
        className={`mobile-nav ${menuOpen ? 'mobile-nav--open' : ''}`}
        aria-label="Mobile navigation"
      >
        <div className="container mobile-nav__links">
          {navItems.map((item) => item.to ? <Link key={item.label} to={item.to} onClick={closeMenu}>{item.label}</Link> : <a key={item.label} href={item.href} onClick={closeMenu}>{item.label}</a>)}
        </div>
      </nav>
    </header>
  )
}
