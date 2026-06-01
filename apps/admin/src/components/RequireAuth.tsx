import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RequireAuth() {
  const { accessToken, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-screen">
        <p className="muted">Đang tải phiên đăng nhập...</p>
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
