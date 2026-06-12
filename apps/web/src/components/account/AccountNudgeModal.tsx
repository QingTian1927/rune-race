import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleSignInUnavailableNotice } from '../auth/GoogleSignInUnavailableNotice'
import { useAuth } from '../../hooks/useAuth'
import { AUTH_FORM_PLACEHOLDERS } from '../../lib/authFormPlaceholders'
import { isInAppBrowser } from '../../lib/inAppBrowser'
import { linkAnonSessionIfNeeded } from '../../lib/linkAnonSession'

type AccountNudgeModalProps = {
  open: boolean
  onClose: () => void
}

export function AccountNudgeModal({ open, onClose }: AccountNudgeModalProps) {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inAppBrowser = useMemo(() => isInAppBrowser(), [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
      onClose()
      navigate('/play')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
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
      setError(err instanceof Error ? err.message : 'Đăng nhập Google thất bại')
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="account-nudge-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="account-nudge-dialog panel p-blue"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-nudge-title"
      >
        <button
          type="button"
          className="account-nudge-close"
          onClick={onClose}
          aria-label="Đóng"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <div className="panel-head">
          <div className="panel-icon icon-blue">
            <i className="bi bi-stars" aria-hidden="true" />
          </div>
          <div>
            <h2 id="account-nudge-title" className="panel-title account-nudge-title">
              Tham gia Rune Race
            </h2>
            <p className="panel-subtitle account-nudge-lead">
              Tạo tài khoản để chọn avatar trái cây, lưu tiến độ và mang thống kê trận đấu theo
              bạn trên mọi thiết bị.
            </p>
          </div>
        </div>

        {error ? <div className="sky-alert-error account-nudge-alert">{error}</div> : null}

        <div className="panel-body sky-form-stack account-nudge-body">
          <Link
            to="/auth/signup?from=nudge"
            className="game-btn btn-green account-nudge-cta-primary"
            onClick={onClose}
          >
            <span className="btn-icon">
              <i className="bi bi-person-plus-fill" aria-hidden="true" />
            </span>
            <span>ĐĂNG KÝ MIỄN PHÍ — BẮT ĐẦU HÀNH TRÌNH</span>
          </Link>

          <div className="account-nudge-divider">
            <span>Đã có tài khoản?</span>
          </div>

          <div className="field-block">
            <div className="field-label">Email</div>
            <div className="input-wrap">
              <span className="input-icon">
                <i className="bi bi-envelope-fill" aria-hidden="true" />
              </span>
              <input
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

          {inAppBrowser ? (
            <GoogleSignInUnavailableNotice compact />
          ) : (
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
          )}
        </div>

        <footer className="account-nudge-footer">
          <button type="button" className="account-nudge-dismiss" onClick={onClose}>
            Không, cảm ơn — tiếp tục chơi ẩn danh
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
