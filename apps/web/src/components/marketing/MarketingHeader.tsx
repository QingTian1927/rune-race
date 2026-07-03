import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMarketingTheme } from '../../hooks/useMarketingTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/guide', label: 'Hướng dẫn' },
  { to: '/leaderboard', label: 'Bảng xếp hạng' },
  { to: '/about', label: 'Về chúng tôi' },
] as const

export function MarketingHeader() {
  const location = useLocation()
  const { isNight, toggleTheme } = useMarketingTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" to="/" aria-label="Rune Race — Trang chủ" onClick={() => setMenuOpen(false)}>
          <img src="/marketing/images/rune-race-mark.svg" alt="" width={42} height={42} />
          <span className="brand-name">Rune Race</span>
        </Link>

        <nav
          className={`nav-links${menuOpen ? ' open' : ''}`}
          aria-label="Điều hướng chính"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item.to, 'end' in item ? item.end : undefined) ? 'active' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="icon-btn"
            type="button"
            onClick={toggleTheme}
            aria-label={isNight ? 'Chuyển sang giao diện ban ngày' : 'Chuyển sang giao diện ban đêm'}
          >
            <i className={`bi ${isNight ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} aria-hidden="true" />
          </button>
          <Link className="btn btn-primary btn-sm" to="/play">
            <i className="bi bi-controller" aria-hidden="true" /> Chơi ngay
          </Link>
          <button
            className="icon-btn menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
