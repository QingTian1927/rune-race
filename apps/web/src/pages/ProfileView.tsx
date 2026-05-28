import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProfileById, type Profile } from '../lib/api'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'

const FALLBACK_AVATAR = PROFILE_EMOJIS[0]

export default function ProfileViewPage() {
  const { profileId } = useParams<{ profileId: string }>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return
    setLoading(true)
    setError(null)
    fetchProfileById(profileId)
      .then((data) => setProfile(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Profile not found'))
      .finally(() => setLoading(false))
  }, [profileId])

  if (!profileId) {
    return <div className="p-8 text-white">Missing profile id</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-xl px-6 py-10">
        <Link to="/" className="text-sm text-slate-400 hover:text-white">
          ← Trang chu
        </Link>

        {loading ? (
          <div className="mt-8 text-slate-300">Loading profile...</div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : profile ? (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-3xl">
                {profile.avatar_emoji || FALLBACK_AVATAR}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {profile.display_name ?? 'Player'}
                  </h1>
                  {profile.is_anon ? (
                    <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-xs text-amber-200">
                      Guest
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">ID: {profile.id}</p>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-300">Bio</h2>
              <p className="mt-2 text-sm text-slate-200">
                {profile.bio?.trim() ? profile.bio : 'Chua co mo ta.'}
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <StatCard label="Gio choi" value={`${profile.total_played_hours}h`} />
              <StatCard label="So van" value={`${profile.total_games}`} />
              <StatCard label="Thang" value={`${profile.total_wins}`} />
              <StatCard label="Thua" value={`${profile.total_losses}`} />
            </div>

            {user?.id === profile.id ? (
              <div className="mt-6">
                <Link
                  to="/profile/edit"
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold"
                >
                  Chinh sua profile
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
