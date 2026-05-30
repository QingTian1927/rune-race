import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { linkAnonSessionIfNeeded } from '../lib/linkAnonSession'
import {
  gameAlertError,
  gameAuthFooter,
  gameBtnGhostFull,
  gameBtnPrimary,
  gameContainerForm,
  gameInput,
  gameLabel,
  gameNavLink,
  gamePage,
  gamePanel,
  gameTagline,
  gameTitle,
} from '../lib/gameUiStyles'

export default function AuthLoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn, signInWithGoogle, signOut, isRegistered } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await signIn({ email, password })
      if (result.error) throw result.error
      const session = result.data.session
      if (session?.access_token && session.user) {
        await linkAnonSessionIfNeeded(session.access_token, session.user.id)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={`${gamePage} flex items-center justify-center`}>
        <p className={gameTagline}>Đang tải...</p>
      </div>
    )
  }

  if (user && isRegistered) {
    return (
      <div className={gamePage}>
        <div className={gameContainerForm}>
          <section className={gamePanel}>
            <h1 className={gameTitle}>Đã đăng nhập</h1>
            <p className={`mt-2 ${gameTagline}`}>{user.email ?? user.id}</p>
            <div className="mt-6 space-y-2">
              <button type="button" onClick={() => navigate('/')} className={gameBtnPrimary}>
                Về trang chủ
              </button>
              <button type="button" onClick={signOut} className={gameBtnGhostFull}>
                Đăng xuất
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className={gamePage}>
      <div className={gameContainerForm}>
        <Link to="/" className={gameNavLink}>
          ← Trang chủ
        </Link>

        <section className={`mt-6 ${gamePanel}`}>
          <h1 className={gameTitle}>Đăng nhập</h1>
          <p className={`mt-1 ${gameTagline}`}>Đăng nhập để lưu profile và thống kê</p>

          {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className={gameLabel}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1.5 ${gameInput}`}
              />
            </div>
            <div>
              <label htmlFor="login-password" className={gameLabel}>
                Mật khẩu
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1.5 ${gameInput}`}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !email || !password}
            onClick={handleLogin}
            className={`mt-5 ${gameBtnPrimary}`}
          >
            Đăng nhập
          </button>

          <div className="mt-4">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className={gameBtnGhostFull}
            >
              Tiếp tục với Google
            </button>
          </div>
        </section>

        <p className={`mt-6 text-center ${gameAuthFooter}`}>
          Chưa có tài khoản?{' '}
          <Link to="/auth/signup" className="font-semibold text-stone-700 hover:text-stone-900">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  )
}
