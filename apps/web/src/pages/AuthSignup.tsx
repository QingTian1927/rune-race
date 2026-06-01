import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { linkAnonSessionIfNeeded } from '../lib/linkAnonSession'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { AUTH_FORM_PLACEHOLDERS } from '../lib/authFormPlaceholders'
import { useSkyPageName } from '../components/sky/useSkyPageName'

export default function AuthSignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { name, setName, onNameBlur } = useSkyPageName()
  const [fullName, setFullName] = useState('')
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
      const trimmedFullName = fullName.trim()
      const trimmedDisplay = displayName.trim() || trimmedFullName || 'Player'
      const result = await signUp({
        email,
        password,
        fullName: trimmedFullName,
        displayName: trimmedDisplay,
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
    <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
      <SkyFormStage backTo="/" className="sky-auth-form">
        {error ? <div className="sky-alert-error">{error}</div> : null}
        {info ? <div className="sky-alert-success">{info}</div> : null}

        <div className="panel p-green">
          <div className="panel-head">
            <div className="panel-icon icon-green">
              <i className="bi bi-person-plus-fill" aria-hidden="true" />
            </div>
            <div>
              <div className="panel-title">Đăng ký</div>
              <div className="panel-subtitle">Tạo tài khoản để lưu profile và thống kê</div>
            </div>
          </div>
          <div className="panel-body sky-form-stack">
            <div className="field-block">
              <div className="field-label">Họ và tên</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-person-vcard-fill" aria-hidden="true" />
                </span>
                <input
                  id="signup-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="game-input"
                  maxLength={100}
                  autoComplete="name"
                  placeholder={AUTH_FORM_PLACEHOLDERS.fullName}
                  required
                />
              </div>
            </div>
            <div className="field-block">
              <div className="field-label">Tên hiển thị</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-person-fill" aria-hidden="true" />
                </span>
                <input
                  id="signup-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="game-input"
                  maxLength={50}
                  placeholder={AUTH_FORM_PLACEHOLDERS.displayName}
                />
              </div>
            </div>
            <div className="field-block">
              <div className="field-label">Email</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-envelope-fill" aria-hidden="true" />
                </span>
                <input
                  id="signup-email"
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
              <div className="field-label">SĐT (tùy chọn)</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-telephone-fill" aria-hidden="true" />
                </span>
                <input
                  id="signup-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="game-input"
                  autoComplete="tel"
                  placeholder={AUTH_FORM_PLACEHOLDERS.phone}
                />
              </div>
            </div>
            <div className="field-block">
              <div className="field-label">Mật khẩu</div>
              <div className="input-wrap">
                <span className="input-icon">
                  <i className="bi bi-key-fill" aria-hidden="true" />
                </span>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="game-input"
                  autoComplete="new-password"
                  placeholder={AUTH_FORM_PLACEHOLDERS.passwordSignup}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !fullName.trim() || !email || !password}
              onClick={() => void handleSignup()}
              className="game-btn btn-green"
            >
              <span className="btn-icon">
                <i className="bi bi-stars" aria-hidden="true" />
              </span>
              <span>TẠO TÀI KHOẢN</span>
            </button>
          </div>
        </div>

        <p className="sky-auth-footer">
          Đã có tài khoản? <Link to="/auth/login">Đăng nhập</Link>
        </p>
      </SkyFormStage>
    </SkyPageLayout>
  )
}
