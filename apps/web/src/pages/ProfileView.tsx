import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProfile, fetchProfileById, type PublicProfile } from '../lib/api'
import { supabase } from '../lib/supabase'
import { formatPlayTime, formatWinRate } from '../lib/formatPlayTime'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import {
  gameAlertError,
  gameAvatarCircle,
  gameBtnGhost,
  gameBtnPrimary,
  gameContainerForm,
  gameLabel,
  gameNavLink,
  gamePage,
  gamePanel,
  gameStatRow,
  gameTagline,
} from '../lib/gameUiStyles'
import { useAuth } from '../hooks/useAuth'

const FALLBACK_AVATAR = PROFILE_EMOJIS[0]

export default function ProfileViewPage() {
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()
  const { user, accessToken, isRegistered } = useAuth()
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
      <div className={`${gamePage} p-8`}>
        <p className={gameTagline}>Missing profile id</p>
      </div>
    )
  }

  return (
    <div className={gamePage}>
      <div className={gameContainerForm}>
        <Link to="/" className={gameNavLink}>
          ← Trang chủ
        </Link>

        {loading ? (
          <div className={`mt-8 text-center ${gameTagline}`}>Đang tải profile...</div>
        ) : error ? (
          <div className={`mt-6 space-y-3 ${gameAlertError}`}>
            <p>{error}</p>
            {isRegistered && user?.id === profileId ? (
              <Link to="/profile/edit" className={`inline-block ${gameBtnPrimary}`}>
                Tạo profile
              </Link>
            ) : null}
          </div>
        ) : profile ? (
          <>
            <div className="mt-8 flex flex-col items-center">
              <div className={gameAvatarCircle}>{profile.avatar_emoji || FALLBACK_AVATAR}</div>
              <h1 className="mt-3 text-xl font-black tracking-tight text-stone-800">
                {profile.display_name ?? 'Player'}
              </h1>
            </div>

            <section className={`relative mt-6 ${gamePanel}`}>
              {isRegistered && user?.id === profile.id ? (
                <Link
                  to="/profile/edit"
                  className={`absolute right-4 top-4 ${gameBtnGhost}`}
                >
                  Chỉnh sửa
                </Link>
              ) : null}

              <div className="space-y-1">
                <div className={gameStatRow}>
                  <span className={gameLabel}>Bio</span>
                  <span className="max-w-[60%] text-right text-sm text-stone-700">
                    {profile.bio?.trim() ? profile.bio : 'Chưa có mô tả.'}
                  </span>
                </div>
                <div className={gameStatRow}>
                  <span className={gameLabel}>Thời gian chơi</span>
                  <span className="text-sm font-bold text-stone-800">
                    {formatPlayTime(profile.total_played_seconds)}
                  </span>
                </div>
                <div className={gameStatRow}>
                  <span className={gameLabel}>Số ván</span>
                  <span className="text-sm font-bold text-stone-800">{profile.total_games}</span>
                </div>
                <div className={gameStatRow}>
                  <span className={gameLabel}>Thắng</span>
                  <span className="text-sm font-bold text-stone-800">
                    {profile.total_wins} ({formatWinRate(profile.total_wins, profile.total_games)})
                  </span>
                </div>
                <div className={gameStatRow}>
                  <span className={gameLabel}>Thua</span>
                  <span className="text-sm font-bold text-stone-800">{profile.total_losses}</span>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
