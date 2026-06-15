import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateDisplayName, updateProfile } from '../lib/api'
import { getDisplayName, isAnonUser } from '../lib/authUser'
import { supabase } from '../lib/supabase'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import {
  ProfileAnonBanner,
  ProfileLockedFieldsGroup,
} from '../components/profile/ProfileAnonBanner'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { useSkyPageName } from '../components/sky/useSkyPageName'

const MAX_BIO_LENGTH = 200

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { accessToken, user, loading: authLoading, updateEmail } = useAuth()
  const { refetch: refetchProfile } = usePlayerProfile()
  const { name, setName, onNameBlur } = useSkyPageName()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const isAnon = isAnonUser(user)

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) {
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
  }, [accessToken, authLoading, user])

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      if (isAnon) {
        const trimmed = displayName.trim()
        if (!trimmed) throw new Error('Tên hiển thị không được để trống')
        await updateDisplayName(accessToken, trimmed)
        await supabase.auth.refreshSession()
        await refetchProfile()
        navigate(`/profile/${user?.id ?? ''}`)
        return
      }

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
      await supabase.auth.refreshSession()
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

  if (!authLoading && !accessToken) {
    return (
      <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
        <SkyFormStage backTo="/">
          <div className="panel p-blue">
            <div className="panel-head">
              <div className="panel-icon icon-blue">
                <i className="bi bi-shield-lock-fill" aria-hidden="true" />
              </div>
              <div>
                <div className="panel-title">Cần đăng nhập</div>
                <div className="panel-subtitle">Đăng nhập hoặc chơi ẩn danh để xem profile</div>
              </div>
            </div>
            <div className="panel-body sky-form-stack">
              <Link to="/auth/login" className="game-btn btn-blue">
                <span className="btn-icon">
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                </span>
                <span>ĐĂNG NHẬP</span>
              </Link>
              <Link to="/play" className="game-btn btn-green">
                <span className="btn-icon">
                  <i className="bi bi-controller" aria-hidden="true" />
                </span>
                <span>CHƠI NGAY</span>
              </Link>
            </div>
          </div>
        </SkyFormStage>
      </SkyPageLayout>
    )
  }

  return (
    <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
      <SkyFormStage backTo={cancelHref} backLabel="Quay lại profile">
        {loading ? (
          <p className="sky-loading-text">Đang tải...</p>
        ) : (
          <div className="profile-page-stack">
            {error ? <div className="sky-alert-error">{error}</div> : null}
            {info ? <div className="sky-alert-success">{info}</div> : null}

            {isAnon ? (
              <>
                <ProfileAnonBanner />
                <div className="panel p-yellow">
                  <div className="panel-head">
                    <div className="panel-icon icon-yellow">
                      <i className="bi bi-pencil-square" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="panel-title">Chỉnh sửa profile</div>
                      <div className="panel-subtitle">Cập nhật tên hiển thị trong game</div>
                    </div>
                  </div>
                  <div className="panel-body sky-form-stack">
                    <div className="field-block">
                      <div className="field-label">Tên hiển thị</div>
                      <div className="input-wrap">
                        <span className="input-icon">
                          <i className="bi bi-person-fill" aria-hidden="true" />
                        </span>
                        <input
                          id="profile-name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="game-input"
                          maxLength={50}
                        />
                      </div>
                    </div>

                    <ProfileLockedFieldsGroup />

                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="game-btn btn-green"
                    >
                      <span className="btn-icon">
                        <i className="bi bi-check-circle-fill" aria-hidden="true" />
                      </span>
                      <span>{saving ? 'ĐANG LƯU...' : 'LƯU TÊN'}</span>
                    </button>

                    <Link to={cancelHref} className="game-btn btn-outline">
                      <span className="btn-icon">
                        <i className="bi bi-x-circle" aria-hidden="true" />
                      </span>
                      <span>HỦY</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="profile-hero">
                  <div className="profile-avatar-lg">{displayEmoji}</div>
                </div>

                <div className="panel p-yellow">
                  <div className="panel-head">
                    <div className="panel-icon icon-yellow">
                      <i className="bi bi-pencil-square" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="panel-title">Chỉnh sửa profile</div>
                      <div className="panel-subtitle">Cập nhật thông tin hiển thị công khai</div>
                    </div>
                  </div>
                  <div className="panel-body sky-form-stack">
                    <div className="field-block">
                      <div className="field-label">Tên hiển thị</div>
                      <div className="input-wrap">
                        <span className="input-icon">
                          <i className="bi bi-person-fill" aria-hidden="true" />
                        </span>
                        <input
                          id="profile-name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="game-input"
                          maxLength={50}
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
                          id="profile-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="game-input"
                        />
                      </div>
                      <p className="profile-field-hint">Đổi email cần xác nhận qua hộp thư mới.</p>
                    </div>

                    <div className="field-block">
                      <div className="field-label">SĐT</div>
                      <div className="input-wrap">
                        <span className="input-icon">
                          <i className="bi bi-telephone-fill" aria-hidden="true" />
                        </span>
                        <input
                          id="profile-phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="game-input"
                        />
                      </div>
                    </div>

                    <div className="field-block">
                      <div className="field-label">Bio</div>
                      <textarea
                        id="profile-bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                        rows={4}
                        className="game-input game-textarea"
                      />
                      <div className="profile-char-count">
                        {bio.length}/{MAX_BIO_LENGTH}
                      </div>
                    </div>

                    <div className="field-block">
                      <div className="field-label">Avatar</div>
                      <div className="avatar-picker">
                        {PROFILE_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setAvatarEmoji(emoji)}
                            className={`avatar-pick-btn${avatarEmoji === emoji ? ' selected' : ''}`}
                            aria-label={`Chọn avatar ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="game-btn btn-green"
                    >
                      <span className="btn-icon">
                        <i className="bi bi-check-circle-fill" aria-hidden="true" />
                      </span>
                      <span>{saving ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}</span>
                    </button>

                    <Link to={cancelHref} className="game-btn btn-outline">
                      <span className="btn-icon">
                        <i className="bi bi-x-circle" aria-hidden="true" />
                      </span>
                      <span>HỦY</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SkyFormStage>
    </SkyPageLayout>
  )
}
