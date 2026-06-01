import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { linkAnonSessionIfNeeded } from '../lib/linkAnonSession'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { AUTH_FORM_PLACEHOLDERS } from '../lib/authFormPlaceholders'
import { useSkyPageName } from '../components/sky/useSkyPageName'

export default function AuthLoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn, signInWithGoogle, signOut, isRegistered } = useAuth()
  const { name, setName, onNameBlur } = useSkyPageName()
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
      <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
        <p className="sky-loading-text">Đang tải...</p>
      </SkyPageLayout>
    )
  }

  if (user && isRegistered) {
    return (
      <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
        <SkyFormStage backTo="/" className="sky-auth-form">
          <div className="panel p-blue">
            <div className="panel-head">
              <div className="panel-icon icon-blue">
                <i className="bi bi-person-check-fill" aria-hidden="true" />
              </div>
              <div>
                <div className="panel-title">Đã đăng nhập</div>
                <div className="panel-subtitle">{user.email ?? user.id}</div>
              </div>
            </div>
            <div className="panel-body sky-form-stack">
              <button type="button" onClick={() => navigate('/')} className="game-btn btn-blue">
                <span className="btn-icon">
                  <i className="bi bi-house-door-fill" aria-hidden="true" />
                </span>
                <span>VỀ TRANG CHỦ</span>
              </button>
              <button type="button" onClick={() => void signOut()} className="btn-leave">
                <i className="bi bi-box-arrow-right inline-icon" aria-hidden="true" /> Đăng xuất
              </button>
            </div>
          </div>
        </SkyFormStage>
      </SkyPageLayout>
    )
  }

  return (
    <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
      <SkyFormStage backTo="/" className="sky-auth-form">
        {error ? <div className="sky-alert-error">{error}</div> : null}

        <div className="panel p-blue">
          <div className="panel-head">
            <div className="panel-icon icon-blue">
              <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            </div>
            <div>
              <div className="panel-title">Đăng nhập</div>
              <div className="panel-subtitle">Lưu profile và thống kê trên tài khoản của bạn</div>
            </div>
          </div>
          <div className="panel-body sky-form-stack">
            <div className="field-block">
              <div className="field-label">Email</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-envelope-fill" aria-hidden="true" />
                </span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="game-input"
                  autoComplete="email"
                  placeholder={AUTH_FORM_PLACEHOLDERS.email}
                />
              </div>
            </div>
            <div className="field-block">
              <div className="field-label">Mật khẩu</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-lock-fill" aria-hidden="true" />
                </span>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="game-input"
                  autoComplete="current-password"
                  placeholder={AUTH_FORM_PLACEHOLDERS.passwordLogin}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !email || !password}
              onClick={() => void handleLogin()}
              className="game-btn btn-blue"
            >
              <span className="btn-icon">
                <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
              </span>
              <span>ĐĂNG NHẬP</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogle()}
              className="game-btn btn-outline"
            >
              <span className="btn-icon">
                <i className="bi bi-google" aria-hidden="true" />
              </span>
              <span>TIẾP TỤC VỚI GOOGLE</span>
            </button>
          </div>
        </div>

        <p className="sky-auth-footer">
          Chưa có tài khoản? <Link to="/auth/signup">Đăng ký</Link>
        </p>
      </SkyFormStage>
    </SkyPageLayout>
  )
}
