import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateProfile } from '../lib/api'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { setPlayerName } from '../lib/playerSession'
import {
  gameAlertError,
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

const MAX_BIO_LENGTH = 240

const AVATAR_BTN_BASE =
  'flex h-10 w-10 items-center justify-center rounded-xl border text-xl backdrop-blur-sm transition-all'
const AVATAR_BTN_SELECTED =
  'border-amber-400 bg-amber-50 ring-2 ring-amber-200 shadow-sm'
const AVATAR_BTN_DEFAULT = 'border-stone-200 bg-white/70 hover:bg-white'

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { accessToken, user, loading: authLoading, signInAnonymously } = useAuth()
  const { refetch: refetchProfile } = usePlayerProfile()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anonAttempted, setAnonAttempted] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) {
      if (anonAttempted) {
        setLoading(false)
        return
      }
      setAnonAttempted(true)
      setLoading(true)
      signInAnonymously()
        .then((result) => {
          if (result.error) throw result.error
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Guest login failed'),
        )
        .finally(() => setLoading(false))
      return
    }
    setLoading(true)
    fetchProfile(accessToken)
      .then((profile) => {
        setDisplayName(profile.display_name ?? '')
        setBio(profile.bio ?? '')
        setAvatarEmoji(profile.avatar_emoji ?? PROFILE_EMOJIS[0])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [accessToken, anonAttempted, authLoading, signInAnonymously])

  const handleGuestLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await signInAnonymously()
      if (result.error) throw result.error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest login failed')
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfile(accessToken, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarEmoji,
      })
      if (updated.display_name?.trim()) {
        setPlayerName(updated.display_name.trim())
      }
      await refetchProfile()
      navigate(`/profile/${user?.id ?? ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const cancelHref = user ? `/profile/${user.id}` : '/'
  const displayEmoji = avatarEmoji || PROFILE_EMOJIS[0]

  if (!accessToken && !loading) {
    return (
      <div className={gamePage}>
        <div className={gameContainerForm}>
          <section className={gamePanel}>
            <h1 className={gameTitle}>Cần đăng nhập</h1>
            <p className={`mt-2 ${gameTagline}`}>
              Bạn có thể dùng chế độ khách để chỉnh sửa profile.
            </p>
            {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}
            <div className="mt-4 space-y-2">
              <button type="button" onClick={handleGuestLogin} className={gameBtnPrimary}>
                Tiếp tục với khách
              </button>
              <Link to="/auth/login" className={`block text-center ${gameBtnGhostFull}`}>
                Đến trang đăng nhập
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

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
              <button
                type="button"
                className={`${gameAvatarCircle} transition-transform hover:scale-105`}
                onClick={() => {
                  const idx = PROFILE_EMOJIS.indexOf(displayEmoji as (typeof PROFILE_EMOJIS)[number])
                  const next = PROFILE_EMOJIS[(idx + 1) % PROFILE_EMOJIS.length]
                  setAvatarEmoji(next)
                }}
                aria-label="Đổi avatar"
              >
                {displayEmoji}
              </button>
              <p className={`mt-2 ${gameMeta}`}>Chạm avatar để đổi nhanh</p>
            </div>

            <section className={`mt-6 ${gamePanel}`}>
              <h1 className={gameTitle}>Chỉnh sửa profile</h1>

              {error ? <div className={`mt-4 ${gameAlertError}`}>{error}</div> : null}

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
