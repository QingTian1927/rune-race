import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">RR</span>
          <div>
            <p className="admin-brand-title">Rune Race</p>
            <p className="admin-brand-sub">Business Console</p>
          </div>
        </div>
        <nav className="admin-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Tổng quan
          </NavLink>
          <NavLink to="/status" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Trạng thái hệ thống
          </NavLink>
        </nav>
        <div className="admin-sidebar-foot">
          <p className="admin-user-email">{user?.email ?? user?.id}</p>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
