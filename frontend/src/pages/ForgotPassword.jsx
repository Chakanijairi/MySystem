import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import './ForgotPassword.css'

const STEPS = [
  { key: 'identity', label: 'Identity' },
  { key: 'otp', label: 'Verify OTP' },
  { key: 'reset', label: 'Reset' },
]

const RESEND_SECONDS = 30

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function EyeIcon({ off }) {
  return off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="m2 2 20 20" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function InfoCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
    </svg>
  )
}

function Stepper({ activeIndex }) {
  return (
    <ol className="fp-stepper" role="list">
      {STEPS.map((s, i) => {
        const state =
          i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo'
        return (
          <li key={s.key} className={`fp-step fp-step-${state}`}>
            <div className="fp-step-circle" aria-hidden>
              {state === 'done' ? <CheckIcon /> : i + 1}
            </div>
            <div className="fp-step-label">{s.label}</div>
            {i < STEPS.length - 1 ? (
              <div
                className={`fp-step-bar ${
                  i < activeIndex ? 'fp-step-bar-filled' : ''
                }`}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function passwordChecks(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  }
}

function strengthScore(pw) {
  if (!pw) return 0
  const c = passwordChecks(pw)
  let score = 0
  if (c.length) score++
  if (c.upper) score++
  if (c.number) score++
  if (c.special) score++
  if (pw.length >= 12) score = Math.min(4, score + 1)
  return Math.min(4, score)
}

function strengthLabel(score) {
  return ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score] || ''
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [identifier, setIdentifier] = useState('')
  const [destination, setDestination] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [done, setDone] = useState(false)
  const otpRefs = useRef([])

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  useEffect(() => {
    if (step === 1) {
      otpRefs.current[0]?.focus()
    }
  }, [step])

  const checks = useMemo(() => passwordChecks(password), [password])
  const score = useMemo(() => strengthScore(password), [password])
  const otpValue = otpDigits.join('')
  const otpComplete = otpValue.length === 6

  async function startReset(e) {
    e?.preventDefault()
    if (busy) return
    setError('')
    const email = identifier.trim()
    if (!email) {
      setError('Enter your email address')
      return
    }
    if (!emailRe.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setBusy(true)
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: email }),
      })
      setDestination(data.destination || email)
      setOtpDigits(['', '', '', '', '', ''])
      setResendIn(RESEND_SECONDS)
      setStep(1)
    } catch (err) {
      setError(err.message || 'Could not start password reset')
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    if (resendIn > 0 || busy) return
    await startReset()
  }

  function handleOtpChange(idx, raw) {
    const value = raw.replace(/\D/g, '')
    if (!value) {
      const next = [...otpDigits]
      next[idx] = ''
      setOtpDigits(next)
      return
    }
    const next = [...otpDigits]
    // Support paste of a longer string into a single field.
    if (value.length > 1) {
      const chars = value.slice(0, 6 - idx).split('')
      for (let i = 0; i < chars.length; i++) next[idx + i] = chars[i]
      setOtpDigits(next)
      const focusIdx = Math.min(5, idx + chars.length)
      otpRefs.current[focusIdx]?.focus()
      return
    }
    next[idx] = value
    setOtpDigits(next)
    if (idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault()
      otpRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault()
      otpRefs.current[idx + 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!txt) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < txt.length; i++) next[i] = txt[i]
    setOtpDigits(next)
    otpRefs.current[Math.min(5, txt.length)]?.focus()
  }

  async function verifyOtp(e) {
    e?.preventDefault()
    if (busy || !otpComplete) return
    setError('')
    setBusy(true)
    try {
      const data = await api('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: otpValue,
        }),
      })
      setResetToken(data.reset_token)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Could not verify code')
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(e) {
    e?.preventDefault()
    if (busy) return
    setError('')
    if (!checks.length || !checks.upper || !checks.number) {
      setError('Password must meet all required rules')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, password }),
      })
      setDone(true)
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { passwordReset: true },
        })
      }, 1500)
    } catch (err) {
      setError(err.message || 'Could not reset password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fp-page">
      <div className="fp-card">
        <header className="fp-header">
          <div className="fp-header-script">Personal Collection</div>
          <div className="fp-header-sub">Account Recovery</div>
        </header>

        <div className="fp-body">
          <Stepper activeIndex={step} />

          {error ? <div className="fp-alert fp-alert-error">{error}</div> : null}

          {step === 0 ? (
            <form onSubmit={startReset} noValidate>
              <h2 className="fp-title">Find Your Account</h2>
              <p className="fp-subtitle">
                Enter your registered email address and we&rsquo;ll send you a
                verification code.
              </p>

              <div className="fp-info">
                <span className="fp-info-icon" aria-hidden>
                  <InfoCircle />
                </span>
                <span>
                  Make sure you have access to your registered email inbox before
                  proceeding.
                </span>
              </div>

              <label className="fp-label" htmlFor="fp-identifier">
                Email Address
              </label>
              <div className="fp-input-wrap">
                <span className="fp-input-icon" aria-hidden>
                  <MailIcon />
                </span>
                <input
                  id="fp-identifier"
                  type="email"
                  className="fp-input fp-input-with-icon"
                  placeholder="e.g. yourname@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                />
              </div>

              <button type="submit" className="fp-btn-primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send Verification Code'}
              </button>

              <div className="fp-back">
                <Link to="/login" className="fp-back-link">
                  ← Back to Login
                </Link>
              </div>
            </form>
          ) : null}

          {step === 1 ? (
            <form onSubmit={verifyOtp} noValidate>
              <h2 className="fp-title">Verify Your Identity</h2>
              <p className="fp-subtitle">
                We sent a 6-digit code to{' '}
                <strong className="fp-destination">{destination}</strong>.
                Check your inbox (and spam folder).
              </p>

              <label className="fp-label">Enter OTP Code</label>
              <div className="fp-otp-row" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className="fp-otp-input"
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <div className="fp-resend">
                Didn&rsquo;t receive code?{' '}
                <button
                  type="button"
                  className="fp-resend-btn"
                  onClick={resendCode}
                  disabled={resendIn > 0 || busy}
                >
                  {resendIn > 0 ? `Resend OTP (${resendIn}s)` : 'Resend OTP'}
                </button>
              </div>

              <button
                type="submit"
                className="fp-btn-primary"
                disabled={busy || !otpComplete}
              >
                {busy ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div className="fp-back">
                <button
                  type="button"
                  className="fp-back-link fp-back-btn"
                  onClick={() => {
                    setStep(0)
                    setError('')
                  }}
                >
                  ← Back
                </button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={submitReset} noValidate>
              <h2 className="fp-title">Set New Password</h2>
              <p className="fp-subtitle">
                Choose a strong password for your account. You&rsquo;ll use this to
                log in from now on.
              </p>

              {done ? (
                <div className="fp-alert fp-alert-success">
                  Password reset successful. Redirecting to login…
                </div>
              ) : null}

              <label className="fp-label" htmlFor="fp-password">
                New Password <span className="fp-required">*</span>
              </label>
              <div className="fp-input-wrap">
                <input
                  id="fp-password"
                  type={showPw ? 'text' : 'password'}
                  className="fp-input fp-input-with-eye"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="fp-eye-btn"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon off={showPw} />
                </button>
              </div>

              <div className="fp-strength" aria-hidden={!password}>
                <div className="fp-strength-bars">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`fp-strength-bar ${
                        score > i ? `fp-strength-bar-${score}` : ''
                      }`}
                    />
                  ))}
                </div>
                {password ? (
                  <div className={`fp-strength-text fp-strength-text-${score}`}>
                    {strengthLabel(score)}
                  </div>
                ) : null}
              </div>

              <label className="fp-label" htmlFor="fp-confirm">
                Confirm New Password <span className="fp-required">*</span>
              </label>
              <div className="fp-input-wrap">
                <input
                  id="fp-confirm"
                  type={showConfirmPw ? 'text' : 'password'}
                  className="fp-input fp-input-with-eye"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="fp-eye-btn"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPw((v) => !v)}
                  aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon off={showConfirmPw} />
                </button>
              </div>

              <div className="fp-rules">
                <div className="fp-rules-title">PASSWORD REQUIREMENTS</div>
                <ul className="fp-rules-list">
                  <li className={checks.length ? 'fp-rule-ok' : 'fp-rule-pending'}>
                    <span className="fp-rule-mark" aria-hidden>
                      {checks.length ? <CheckIcon /> : '○'}
                    </span>
                    At least 8 characters
                  </li>
                  <li className={checks.upper ? 'fp-rule-ok' : 'fp-rule-pending'}>
                    <span className="fp-rule-mark" aria-hidden>
                      {checks.upper ? <CheckIcon /> : '○'}
                    </span>
                    Contains uppercase letter
                  </li>
                  <li className={checks.number ? 'fp-rule-ok' : 'fp-rule-pending'}>
                    <span className="fp-rule-mark" aria-hidden>
                      {checks.number ? <CheckIcon /> : '○'}
                    </span>
                    Contains a number
                  </li>
                  <li className={checks.special ? 'fp-rule-ok' : 'fp-rule-pending'}>
                    <span className="fp-rule-mark" aria-hidden>
                      {checks.special ? <CheckIcon /> : '○'}
                    </span>
                    Contains special character (@, #, !)
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                className="fp-btn-primary"
                disabled={busy || done}
              >
                {busy ? 'Saving…' : done ? 'Done' : 'Reset Password'}
              </button>

              <div className="fp-back">
                <button
                  type="button"
                  className="fp-back-link fp-back-btn"
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                >
                  ← Back
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
