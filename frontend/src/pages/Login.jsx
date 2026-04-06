import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

const maroon = {
  btn: '#7c2d2d',
  btnHover: '#6b2626',
  link: '#7c2d2d',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('shaw')
  const [password, setPassword] = useState('123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(username.trim(), password)
      if (u.role === 'admin') navigate('/admin', { replace: true })
      else navigate('/dealer', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row md:min-h-[28rem]">
        {/* Left: informational */}
        <div className="login-info-pane flex flex-col justify-center px-8 py-12 text-white md:w-1/2 md:px-10 md:py-14">
          <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Member access
          </h2>
          <p className="mt-3 text-lg font-semibold text-white/95">Personal Collection</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-white/85">
            Dealer monitoring
          </p>
          <p className="mt-8 max-w-xs text-sm leading-relaxed text-white/80">
            Sign in to manage verification, members, and records in one place.
          </p>
        </div>

        {/* Right: form — no logo, title only */}
        <div className="flex w-full flex-col justify-center bg-white px-8 py-10 md:w-1/2 md:px-10 md:py-12">
          <h1 className="mb-10 text-center text-xl font-bold text-neutral-900 md:text-2xl">
            Personal Collection
          </h1>

          <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-8">
            {error ? (
              <div
                className="rounded-md px-3 py-2 text-center text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
              >
                {error}
              </div>
            ) : null}

            <div className="login-input-row flex items-end gap-3 border-b border-neutral-300 pb-2 transition-colors">
              <span className="login-input-icon mb-0.5 text-neutral-400" aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                name="username"
                required
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="relative">
              <div className="login-input-row flex items-end gap-3 border-b border-neutral-300 pb-2 transition-colors">
                <span className="login-input-icon mb-0.5 text-neutral-400" aria-hidden>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent py-1 pr-10 text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                />
              </div>
              <button
                type="button"
                tabIndex={-1}
                className="absolute bottom-2 right-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m2 2 20 20" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md py-3 text-sm font-bold uppercase tracking-widest text-white transition disabled:opacity-60"
              style={{ backgroundColor: maroon.btn }}
              onMouseEnter={(e) => {
                if (!busy) e.currentTarget.style.backgroundColor = maroon.btnHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = maroon.btn
              }}
            >
              {busy ? 'Please wait…' : 'LOG IN'}
            </button>

            <div className="text-center">
              <Link
                to="/register"
                className="text-xs font-bold uppercase tracking-wide hover:underline"
                style={{ color: maroon.link }}
              >
                Forgot account
              </Link>
            </div>

            <p className="text-center text-xs text-neutral-500">
              New member?{' '}
              <Link
                to="/register"
                className="font-medium hover:underline"
                style={{ color: maroon.link }}
              >
                Register
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
