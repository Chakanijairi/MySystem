import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, apiUrl, getToken } from '../api/client'

const statusLabels = {
  pending_verification: 'Pending verification',
  active: 'Active',
  suspended: 'Suspended',
}

export default function DealerPortal() {
  const { user, logout, refresh } = useAuth()
  const [profile, setProfile] = useState(null)
  const [sales, setSales] = useState([])
  const [installments, setInstallments] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    const [me, s, i] = await Promise.all([
      api('/me'),
      api('/me/sales'),
      api('/me/installments'),
    ])
    setProfile(me)
    setSales(s.sales || [])
    setInstallments(i.installments || [])
  }, [])

  useEffect(() => {
    load().catch((e) => setErr(e.message))
  }, [load])

  async function onUpload(e) {
    e.preventDefault()
    setMsg('')
    setErr('')
    const fd = new FormData(e.target)
    const idFile = fd.get('national_id')
    const utilFile = fd.get('utility_bill')
    if (!idFile?.size || !utilFile?.size) {
      setErr('Select both a valid ID and a utility bill.')
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('national_id', idFile)
      body.append('utility_bill', utilFile)
      await fetch(apiUrl('/me/documents'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Upload failed')
      })
      setMsg('Documents uploaded. An administrator will review them.')
      e.target.reset()
      await refresh()
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Member portal</h1>
          <p className="text-sm text-zinc-400">
            {user?.full_name} · {user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Sign out
        </button>
      </header>

      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-1 text-lg font-medium text-white">Account status</h2>
        <p className="text-sm text-zinc-400">
          Status:{' '}
          <span className="font-medium text-violet-300">
            {statusLabels[user?.account_status] || user?.account_status}
          </span>
        </p>
        {profile?.user?.member_category ? (
          <p className="mt-1 text-sm text-zinc-500">
            Category: {profile.user.member_category}
          </p>
        ) : null}
      </section>

      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-medium text-white">Verification documents</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Upload a clear photo or scan of your valid ID and a recent utility bill (JPEG, PNG, WebP, or PDF).
        </p>
        {err ? (
          <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}
        {msg ? (
          <div className="mb-4 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            {msg}
          </div>
        ) : null}
        <form onSubmit={onUpload} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-400">Valid ID</span>
            <input
              name="national_id"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-sm text-zinc-300 file:mr-1 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-400">Utility bill</span>
            <input
              name="utility_bill"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-sm text-zinc-300 file:mr-1 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1"
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
        {profile?.documents?.length ? (
          <ul className="mt-6 space-y-2 text-sm text-zinc-400">
            {profile.documents.map((d) => (
              <li key={d.id} className="flex justify-between gap-4 border-t border-zinc-800 pt-3">
                <span className="capitalize">
                  {d.doc_type.replace('_', ' ')} — {d.original_filename}
                </span>
                <span className="text-zinc-500">{d.verification_status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium text-white">Your sales</h2>
          <ul className="space-y-2 text-sm">
            {sales.length === 0 ? (
              <li className="text-zinc-500">No sales recorded yet.</li>
            ) : (
              sales.map((s) => (
                <li key={s.id} className="border-b border-zinc-800 pb-2 text-zinc-300">
                  <div className="flex justify-between">
                    <span>{s.sale_date}</span>
                    <span className="font-semibold text-white">
                      {Number(s.amount).toLocaleString()}
                    </span>
                  </div>
                  {s.commission_amount != null ? (
                    <div className="text-xs text-zinc-500">
                      Commission: {Number(s.commission_amount).toLocaleString()}
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium text-white">Installments</h2>
          <ul className="space-y-2 text-sm">
            {installments.length === 0 ? (
              <li className="text-zinc-500">No installments yet.</li>
            ) : (
              installments.map((i) => (
                <li key={i.id} className="border-b border-zinc-800 pb-2 text-zinc-300">
                  <div className="flex justify-between">
                    <span>{i.due_date}</span>
                    <span>{Number(i.amount).toLocaleString()}</span>
                  </div>
                  <div className="text-xs capitalize text-zinc-500">{i.status}</div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
