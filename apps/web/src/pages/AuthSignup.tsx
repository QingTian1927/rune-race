import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { linkAnonSessionIfNeeded } from '../lib/linkAnonSession'
import {
  gameAlertError,
  gameAlertSuccess,
  gameAuthFooter,
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

export default function AuthSignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSignup = async () => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const result = await signUp({
        email,
        password,
        displayName: displayName.trim() || 'Player',
        phone: phone.trim() || undefined,
      })
      if (result.error) throw result.error

      const newSession = result.data.session
      if (newSession?.user && newSession.access_token) {
        await linkAnonSessionIfNeeded(newSession.access_token, newSession.user.id)
        navigate('/')
        return
      }

      setInfo('Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={gamePage}>
      <div className={gameContainerForm}>
        <Link to="/" className={gameNavLink}>
          ← Trang chủ
        </Link>

        <section className={`mt-6 ${gamePanel}`}>
          <h1 className={gameTitle}>Đăng ký</h1>
          <p className={`mt-1 ${gameTagline}`}>Tạo tài khoản để lưu profile và thống kê</p>

          {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}
          {info ? <div className={`mt-4 ${gameAlertSuccess}`}>{info}</div> : null}

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="signup-name" className={gameLabel}>
                Tên hiển thị
              </label>
              <input
                id="signup-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`mt-1.5 ${gameInput}`}
                maxLength={50}
              />
            </div>
            <div>
              <label htmlFor="signup-email" className={gameLabel}>
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1.5 ${gameInput}`}
              />
            </div>
            <div>
              <label htmlFor="signup-phone" className={gameLabel}>
                SĐT (tùy chọn)
              </label>
              <input
                id="signup-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`mt-1.5 ${gameInput}`}
              />
            </div>
            <div>
              <label htmlFor="signup-password" className={gameLabel}>
                Mật khẩu
              </label>
              <input
                id="signup-password"
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
            onClick={handleSignup}
            className={`mt-5 ${gameBtnPrimary}`}
          >
            Tạo tài khoản
          </button>
        </section>

        <p className={`mt-6 text-center ${gameAuthFooter}`}>
          Đã có tài khoản?{' '}
          <Link to="/auth/login" className="font-semibold text-stone-700 hover:text-stone-900">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}
