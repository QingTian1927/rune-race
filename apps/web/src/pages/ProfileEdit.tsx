import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProfile, updateProfile } from '../lib/api'
import { PROFILE_EMOJIS } from '../lib/profileEmojis'
import { useAuth } from '../hooks/useAuth'

const MAX_BIO_LENGTH = 240

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { accessToken, user, loading: authLoading, signInAnonymously } = useAuth()
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
        setAvatarEmoji(profile.avatar_emoji ?? '')
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
      await updateProfile(accessToken, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarEmoji,
      })
      navigate(`/profile/${user?.id ?? ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (!accessToken && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-2xl font-bold">Can dang nhap</h1>
          <p className="mt-2 text-sm text-slate-400">
            Ban co the dung che do khach de chinh sua profile.
          </p>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleGuestLogin}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold"
            >
              Tiep tuc voi guest
            </button>
            <Link to="/auth/login" className="rounded-lg border border-slate-600 px-4 py-2 text-sm">
              Den trang login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-xl px-6 py-10">
        <Link to={user ? `/profile/${user.id}` : '/'} className="text-sm text-slate-400">
          ← Quay lai
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Chinh sua profile</h1>

        {loading ? (
          <div className="mt-6 text-slate-300">Loading...</div>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            {error ? (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <label className="text-sm text-slate-300">Username</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />

            <label className="mt-4 block text-sm text-slate-300">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            <div className="mt-1 text-right text-xs text-slate-500">
              {bio.length}/{MAX_BIO_LENGTH}
            </div>

            <label className="mt-4 block text-sm text-slate-300">Avatar</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROFILE_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl ${
                    avatarEmoji === emoji
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Luu thay doi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
