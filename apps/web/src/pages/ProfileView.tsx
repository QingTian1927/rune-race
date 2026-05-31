import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProfile, fetchProfileById, type PublicProfile } from '../lib/api'
import { supabase } from '../lib/supabase'
import { formatPlayTime, formatWinRate } from '../lib/formatPlayTime'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { useSkyPageName } from '../components/sky/useSkyPageName'

const FALLBACK_AVATAR = PROFILE_EMOJIS[0]

export default function ProfileViewPage() {
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()
  const { user, accessToken, isRegistered } = useAuth()
  const { name, setName, onNameBlur } = useSkyPageName()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return

    if (user?.id === profileId && !isRegistered) {
      navigate('/', { replace: true })
      return
    }

    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        setProfile(await fetchProfileById(profileId))
        return
      } catch {
        if (accessToken && isRegistered && user?.id === profileId) {
          try {
            setProfile(await fetchProfile(accessToken))
            return
          } catch (ownErr) {
            if (ownErr instanceof Error && ownErr.message === 'SESSION_EXPIRED') {
              await supabase.auth.signOut()
              setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
              return
            }
            setError(ownErr instanceof Error ? ownErr.message : 'Profile not found')
            return
          }
        }
        setError('Profile not found')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, isRegistered, navigate, profileId, user?.id])

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
            {isRegistered && user?.id === profileId ? (
              <Link to="/profile/edit" className="game-btn btn-green">
                <span className="btn-icon">
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                </span>
                <span>TẠO PROFILE</span>
              </Link>
            ) : null}
          </>
        ) : profile ? (
          <>
            <div className="profile-hero">
              <div className="profile-avatar-lg">{profile.avatar_emoji || FALLBACK_AVATAR}</div>
              <h1 className="profile-display-name">{profile.display_name ?? 'Player'}</h1>
            </div>

            <div className="panel p-blue" style={{ position: 'relative' }}>
              {isRegistered && user?.id === profile.id ? (
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
                  <div className="profile-stat-row">
                    <span className="profile-stat-label">Bio</span>
                    <span className="profile-stat-value">
                      {profile.bio?.trim() ? profile.bio : 'Chưa có mô tả.'}
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
          </>
        ) : null}
      </SkyFormStage>
    </SkyPageLayout>
  )
}
