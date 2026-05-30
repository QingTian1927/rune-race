import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateProfile } from '../lib/api'
import { getDisplayName } from '../lib/authUser'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import {
  gameAlertError,
  gameAlertSuccess,
  gameAvatarCircle,
  gameBtnGhostFull,
  gameBtnPrimary,
  gameContainerForm,
  gameInput,
  gameLabel,
  gameMeta,
  gameNavLink,
  gamePage,
  gamePanel,
  gameTagline,
  gameTitle,
} from '../lib/gameUiStyles'

const MAX_BIO_LENGTH = 200

const AVATAR_BTN_BASE =
  'flex h-10 w-10 items-center justify-center rounded-xl border text-xl backdrop-blur-sm transition-all'
const AVATAR_BTN_SELECTED =
  'border-amber-400 bg-amber-50 ring-2 ring-amber-200 shadow-sm'
const AVATAR_BTN_DEFAULT = 'border-stone-200 bg-white/70 hover:bg-white'

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { accessToken, user, loading: authLoading, isRegistered, updateEmail } = useAuth()
  const { refetch: refetchProfile } = usePlayerProfile()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!isRegistered || !accessToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchProfile(accessToken)
      .then((profile) => {
        setDisplayName(profile.display_name ?? getDisplayName(user))
        setEmail(user?.email ?? '')
        setPhone(profile.phone ?? '')
        setBio(profile.bio ?? '')
        setAvatarEmoji(profile.avatar_emoji ?? PROFILE_EMOJIS[0])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [accessToken, authLoading, isRegistered, user])

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const trimmedEmail = email.trim()
      if (trimmedEmail && user?.email && trimmedEmail !== user.email) {
        const emailResult = await updateEmail(trimmedEmail)
        if (emailResult.error) throw emailResult.error
        setInfo('Email mới cần xác nhận — kiểm tra hộp thư của bạn.')
      }

      await updateProfile(accessToken, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarEmoji,
        phone: phone.trim(),
      })
      await refetchProfile()
      navigate(`/profile/${user?.id ?? ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (!authLoading && !isRegistered) {
    return (
      <div className={gamePage}>
        <div className={gameContainerForm}>
          <section className={gamePanel}>
            <h1 className={gameTitle}>Cần tài khoản</h1>
            <p className={`mt-2 ${gameTagline}`}>
              Profile dành cho tài khoản đăng ký. Khách chỉ đổi tên trên trang chủ.
            </p>
            <div className="mt-4 space-y-2">
              <Link to="/auth/signup" className={`block text-center ${gameBtnPrimary}`}>
                Đăng ký
              </Link>
              <Link to="/auth/login" className={`block text-center ${gameBtnGhostFull}`}>
                Đăng nhập
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (!accessToken && !loading) {
    return (
      <div className={gamePage}>
        <div className={gameContainerForm}>
          <section className={gamePanel}>
            <h1 className={gameTitle}>Cần đăng nhập</h1>
            <Link to="/auth/login" className={`mt-4 block text-center ${gameBtnPrimary}`}>
              Đến trang đăng nhập
            </Link>
          </section>
        </div>
      </div>
    )
  }

  const cancelHref = user ? `/profile/${user.id}` : '/'
  const displayEmoji = avatarEmoji || PROFILE_EMOJIS[0]

  return (
    <div className={gamePage}>
      <div className={gameContainerForm}>
        <Link to={cancelHref} className={gameNavLink}>
          ← Quay lại
        </Link>

        {loading ? (
          <div className={`mt-8 text-center ${gameTagline}`}>Đang tải...</div>
        ) : (
          <>
            <div className="mt-8 flex flex-col items-center">
              <div className={gameAvatarCircle}>{displayEmoji}</div>
            </div>

            <section className={`mt-6 ${gamePanel}`}>
              <h1 className={gameTitle}>Chỉnh sửa profile</h1>

              {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}
              {info ? <div className={`mt-4 ${gameAlertSuccess}`}>{info}</div> : null}

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="profile-name" className={gameLabel}>
                    Tên hiển thị
                  </label>
                  <input
                    id="profile-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={`mt-1.5 ${gameInput}`}
                    maxLength={50}
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className={gameLabel}>
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1.5 ${gameInput}`}
                  />
                  <p className={`mt-1 ${gameMeta}`}>Đổi email cần xác nhận qua hộp thư mới.</p>
                </div>

                <div>
                  <label htmlFor="profile-phone" className={gameLabel}>
                    SĐT
                  </label>
                  <input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`mt-1.5 ${gameInput}`}
                  />
                </div>

                <div>
                  <label htmlFor="profile-bio" className={gameLabel}>
                    Bio
                  </label>
                  <textarea
                    id="profile-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                    rows={4}
                    className={`mt-1.5 ${gameInput}`}
                  />
                  <div className={`mt-1 text-right ${gameMeta}`}>
                    {bio.length}/{MAX_BIO_LENGTH}
                  </div>
                </div>

                <div>
                  <span className={gameLabel}>Avatar</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PROFILE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarEmoji(emoji)}
                        className={`${AVATAR_BTN_BASE} ${
                          avatarEmoji === emoji ? AVATAR_BTN_SELECTED : AVATAR_BTN_DEFAULT
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={gameBtnPrimary}
                >
                  Lưu thay đổi
                </button>
                <Link to={cancelHref} className={`block text-center ${gameBtnGhostFull}`}>
                  Hủy
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
