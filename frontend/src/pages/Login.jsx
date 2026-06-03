import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function HeartIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21s-7.5-4.6-9.7-9.2C.9 8.7 2.6 5 6 5c2 0 3.4 1.1 4.3 2.4C11.2 6.1 12.6 5 14.6 5 18 5 19.7 8.7 18 11.8 16.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function BrandLogo({ size = 'lg' }) {
  // Original "PC" inside a stylized heart, never an external/copyrighted asset.
  const isLg = size === 'lg'
  return (
    <div className="flex flex-col items-center select-none">
      <svg
        width={isLg ? 150 : 96}
        height={isLg ? 150 : 96}
        viewBox="0 0 200 200"
        aria-hidden
      >
        <defs>
          <linearGradient id="heart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="100%" stopColor="#d10000" />
          </linearGradient>
        </defs>
        <path
          d="M100 175s-65-40-65-92c0-22 18-38 38-38 13 0 22 7 27 16 5-9 14-16 27-16 20 0 38 16 38 38 0 52-65 92-65 92z"
          fill="url(#heart-grad)"
        />
        <text
          x="100"
          y="115"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="800"
          fontSize="64"
          fill="#ffffff"
          letterSpacing="-2"
        >
          PC
        </text>
      </svg>
      <p
        className={`mt-1 font-extrabold tracking-[0.2em] text-[#d10000] ${
          isLg ? 'text-base' : 'text-[11px]'
        }`}
      >
        PERSONAL
      </p>
      <p
        className={`font-extrabold tracking-[0.2em] text-[#d10000] ${
          isLg ? 'text-base' : 'text-[11px]'
        }`}
      >
        COLLECTION
      </p>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('chawkanijairi8@gmail.com')
  const [password, setPassword] = useState('shaw')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(
    location.state?.passwordReset
      ? 'Password reset successful. Sign in with your new password.'
      : ''
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (location.state?.passwordReset) {
      window.history.replaceState({}, '')
    }
  }, [location.state])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const u = await login(username.trim(), password)
      if (u.role === 'admin') navigate('/admin', { replace: true })
      else navigate('/member', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row md:min-h-[28rem]">
        {/* Left hero: red panel with brand */}
        <div className="login-hero relative flex items-center justify-center px-8 py-10 text-white md:w-1/2">
          <HeartIcon className="login-heart-float h1" />
          <HeartIcon className="login-heart-float h2" />
          <HeartIcon className="login-heart-float h3" />
          <HeartIcon className="login-heart-float h4" />

          <div className="relative z-10 flex items-center justify-center rounded-2xl bg-white/95 px-8 py-8 shadow-lg">
            <BrandLogo size="lg" />
          </div>
        </div>

        {/* Right: form */}
        <div className="flex w-full flex-col justify-center bg-white px-8 py-10 md:w-1/2 md:px-12 md:py-12">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="sm" />
          </div>

          <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-5">
            {info ? (
              <div
                className="rounded-md px-3 py-2 text-center text-sm"
                style={{ backgroundColor: '#F0FDF4', color: '#166534' }}
              >
                {info}
              </div>
            ) : null}
            {error ? (
              <div
                className="rounded-md px-3 py-2 text-center text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
              >
                {error}
              </div>
            ) : null}

            <input
              type="text"
              name="username"
              required
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-field"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-field pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m2 2 20 20" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" disabled={busy} className="login-submit">
              {busy ? 'Please wait…' : 'LOG IN'}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="login-link">
                FORGOT PASSWORD
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
