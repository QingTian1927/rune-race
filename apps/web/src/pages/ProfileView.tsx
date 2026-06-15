import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProfile, fetchProfileById, type PublicProfile } from '../lib/api'
import { isAnonUser } from '../lib/authUser'
import { supabase } from '../lib/supabase'
import { formatPlayTime, formatWinRate } from '../lib/formatPlayTime'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'
import { ProfileAnonBanner, ProfileLockedAvatarPicker } from '../components/profile/ProfileAnonBanner'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { useSkyPageName } from '../components/sky/useSkyPageName'

const FALLBACK_AVATAR = PROFILE_EMOJIS[0]

export default function ProfileViewPage() {
  const { profileId } = useParams<{ profileId: string }>()
  const { user, accessToken } = useAuth()
  const { name, setName, onNameBlur } = useSkyPageName()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isOwnProfile = Boolean(user?.id && profileId && user.id === profileId)
  const isAnonOwnProfile = isOwnProfile && isAnonUser(user)

  useEffect(() => {
    if (!profileId) return

    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        if (accessToken && isOwnProfile) {
          setProfile(await fetchProfile(accessToken))
          return
        }
        setProfile(await fetchProfileById(profileId))
      } catch (err) {
        if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
          await supabase.auth.signOut()
          setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
          return
        }
        setError(err instanceof Error ? err.message : 'Profile not found')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, isOwnProfile, profileId])

  if (!profileId) {
    return (
      <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
        <p className="sky-loading-text">Missing profile id</p>
      </SkyPageLayout>
    )
  }

  return (
    <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
      <SkyFormStage backTo="/">
        {loading ? (
          <p className="sky-loading-text">Đang tải profile...</p>
        ) : error ? (
          <>
            <div className="sky-alert-error">{error}</div>
            {isOwnProfile ? (
              <Link to="/profile/edit" className="game-btn btn-green">
                <span className="btn-icon">
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                </span>
                <span>CHỈNH SỬA TÊN</span>
              </Link>
            ) : null}
          </>
        ) : profile ? (
          <div className="profile-page-stack">
            <div className={isAnonOwnProfile ? 'profile-hero profile-hero--anon' : 'profile-hero'}>
              {!isAnonOwnProfile ? (
                <div className="profile-avatar-lg">{profile.avatar_emoji || FALLBACK_AVATAR}</div>
              ) : null}
              <h1 className="profile-display-name">{profile.display_name ?? 'Player'}</h1>
              {isAnonOwnProfile ? (
                <p className="profile-anon-badge">
                  <i className="bi bi-incognito" aria-hidden="true" /> Tài khoản ẩn danh
                </p>
              ) : null}
            </div>

            {isAnonOwnProfile ? <ProfileAnonBanner /> : null}

            <div className="panel p-blue" style={{ position: 'relative' }}>
              {isOwnProfile ? (
                <Link to="/profile/edit" className="profile-edit-link">
                  Chỉnh sửa
                </Link>
              ) : null}

              <div className="panel-head">
                <div className="panel-icon icon-blue">
                  <i className="bi bi-bar-chart-fill" aria-hidden="true" />
                </div>
                <div>
                  <div className="panel-title">Thống kê</div>
                  <div className="panel-subtitle">Thành tích chơi Rune Race</div>
                </div>
              </div>
              <div className="panel-body">
                <div className="profile-stat-list">
                  {!isAnonOwnProfile ? (
                    <div className="profile-stat-row">
                      <span className="profile-stat-label">Bio</span>
                      <span className="profile-stat-value">
                        {profile.bio?.trim() ? profile.bio : 'Chưa có mô tả.'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="profile-stat-row profile-stat-row--locked">
                        <span className="profile-stat-label">
                          Bio
                          <span className="profile-lock-badge profile-lock-badge--sm">
                            <i className="bi bi-lock-fill" aria-hidden="true" />
                            Cần đăng ký
                          </span>
                        </span>
                        <span className="profile-stat-value profile-stat-value--locked">
                          Đăng ký tài khoản để thêm mô tả
                        </span>
                      </div>
                      <div className="profile-stat-row profile-stat-row--locked profile-stat-row--locked-wide">
                        <div className="profile-stat-locked-block">
                          <div className="profile-stat-locked-head">
                            <span className="profile-stat-label">Avatar</span>
                            <span className="profile-lock-badge profile-lock-badge--sm">
                              <i className="bi bi-lock-fill" aria-hidden="true" />
                              Cần đăng ký
                            </span>
                          </div>
                          <ProfileLockedAvatarPicker compact />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Xu</span>
                    <span className="profile-stat-value profile-stat-value--coins">
                      {profile.coins.toLocaleString('vi-VN')} 🪙
                    </span>
                  </div>
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Thời gian chơi</span>
                    <span className="profile-stat-value">
                      {formatPlayTime(profile.total_played_seconds)}
                    </span>
                  </div>
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Số ván</span>
                    <span className="profile-stat-value">{profile.total_games}</span>
                  </div>
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Thắng</span>
                    <span className="profile-stat-value">
                      {profile.total_wins} ({formatWinRate(profile.total_wins, profile.total_games)})
                    </span>
                  </div>
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Thua</span>
                    <span className="profile-stat-value">{profile.total_losses}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SkyFormStage>
    </SkyPageLayout>
  )
}
