import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthLoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn, signInWithGoogle, signInAnonymously, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await signIn({ email, password })
      if (result.error) throw result.error
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
      setError(err instanceof Error ? err.message : 'Google login failed')
      setBusy(false)
    }
  }

  const handleGuest = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await signInAnonymously()
      if (result.error) throw result.error
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest login failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading...
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-md px-6 py-12">
          <h1 className="text-2xl font-semibold">Already signed in</h1>
          <p className="mt-2 text-sm text-slate-400">{user.email ?? user.id}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-semibold"
            >
              Go home
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-md px-6 py-12">
        <Link to="/" className="text-xs text-slate-400 hover:text-white">
          ← Trang chu
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-400">Dang nhap de luu tien trinh</p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
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
            disabled={busy || !email || !password}
            onClick={handleLogin}
            className="w-full rounded-lg bg-cyan-600 py-2.5 font-semibold disabled:opacity-50"
          >
            Login
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full rounded-lg border border-slate-600 py-2.5 text-sm"
          >
            Continue with Google
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleGuest}
            className="w-full rounded-lg border border-slate-600 py-2.5 text-sm text-slate-300"
          >
            Continue as guest
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Chua co tai khoan?{' '}
          <Link to="/auth/signup" className="underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
