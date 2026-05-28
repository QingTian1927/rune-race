import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { linkAnonProfile } from '../lib/api'

export default function AuthSignupPage() {
  const navigate = useNavigate()
  const { signUp, anonUserId } = useAuth()
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
      const result = await signUp({
        email,
        password,
        displayName: displayName.trim() || 'Player',
        phone: phone.trim() || undefined,
      })
      if (result.error) throw result.error

      const newSession = result.data.session
      if (newSession?.user && anonUserId && anonUserId !== newSession.user.id) {
        try {
          await linkAnonProfile(newSession.access_token, anonUserId)
        } catch {
          // ignore merge failures on signup
        }
      }

      if (newSession) {
        navigate('/')
        return
      }

      setInfo('Please check your email to confirm and then log in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-md px-6 py-12">
        <Link to="/" className="text-xs text-slate-400 hover:text-white">
          ← Trang chu
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Sign up</h1>
        <p className="mt-1 text-sm text-slate-400">Tao tai khoan de luu tien trinh</p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200">
            {info}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !email || !password || !displayName.trim()}
            onClick={handleSignup}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold disabled:opacity-50"
          >
            Create account
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Da co tai khoan?{' '}
          <Link to="/auth/login" className="underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
