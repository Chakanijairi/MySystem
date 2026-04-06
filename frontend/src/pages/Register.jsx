import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    member_category: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone,
          member_category: form.member_category || undefined,
        }),
      })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white">
        Create account
      </h1>
      <p className="mb-8 text-sm text-zinc-400">
        Register as a dealer. You will upload ID and utility bill after signing in.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        {error ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Full name</span>
          <input
            required
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Email</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Phone</span>
          <input
            required
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Category (optional)</span>
          <input
            value={form.member_category}
            onChange={(e) => set('member_category', e.target.value)}
            placeholder="e.g. region or tier"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Password (min 8 characters)</span>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Register'}
        </button>
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-400 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
