import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, openAdminDocument } from '../api/client'

const tabs = [
  { id: 'members', label: 'Members & verification' },
  { id: 'sales', label: 'Sales' },
  { id: 'installments', label: 'Installments' },
]

export default function AdminPortal() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('members')
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [sales, setSales] = useState([])
  const [installments, setInstallments] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role_id: '',
    account_status: 'pending_verification',
    member_category: '',
  })

  const [saleForm, setSaleForm] = useState({
    dealer_id: '',
    amount: '',
    commission_amount: '',
    sale_date: '',
    notes: '',
  })

  const [instForm, setInstForm] = useState({
    dealer_id: '',
    amount: '',
    due_date: '',
    sale_id: '',
  })

  const loadUsers = useCallback(async () => {
    const data = await api(`/admin/users?page=${page}&limit=20`)
    setUsers(data.users || [])
    setTotal(data.total || 0)
  }, [page])

  const loadRoles = useCallback(async () => {
    const data = await api('/admin/roles')
    setRoles(data.roles || [])
    setNewUser((u) => ({
      ...u,
      role_id: u.role_id || String(data.roles?.find((r) => r.name === 'dealer')?.id || ''),
    }))
  }, [])

  const loadSales = useCallback(async () => {
    const data = await api('/admin/sales')
    setSales(data.sales || [])
  }, [])

  const loadInstallments = useCallback(async () => {
    const data = await api('/admin/installments')
    setInstallments(data.installments || [])
  }, [])

  useEffect(() => {
    setErr('')
    loadRoles().catch((e) => setErr(e.message))
  }, [loadRoles])

  useEffect(() => {
    if (tab === 'members') {
      setErr('')
      loadUsers().catch((e) => setErr(e.message))
    }
    if (tab === 'sales') {
      setErr('')
      loadSales().catch((e) => setErr(e.message))
    }
    if (tab === 'installments') {
      setErr('')
      loadInstallments().catch((e) => setErr(e.message))
    }
  }, [tab, loadUsers, loadSales, loadInstallments, page])

  useEffect(() => {
    if (!selected) {
      setDetail(null)
      return
    }
    setErr('')
    api(`/admin/users/${selected}`)
      .then(setDetail)
      .catch((e) => setErr(e.message))
  }, [selected])

  async function createUser(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role_id: Number(newUser.role_id),
          account_status: newUser.account_status,
          member_category: newUser.member_category || null,
        }),
      })
      setNewUser((u) => ({
        ...u,
        email: '',
        password: '',
        full_name: '',
        phone: '',
        member_category: '',
      }))
      await loadUsers()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function updateMember(patch) {
    if (!selected) return
    setBusy(true)
    setErr('')
    try {
      await api(`/admin/users/${selected}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await loadUsers()
      const d = await api(`/admin/users/${selected}`)
      setDetail(d)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function reviewDoc(docId, status) {
    setBusy(true)
    setErr('')
    try {
      await api(`/admin/documents/${docId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      })
      const d = await api(`/admin/users/${selected}`)
      setDetail(d)
      await loadUsers()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitSale(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/admin/sales', {
        method: 'POST',
        body: JSON.stringify({
          dealer_id: saleForm.dealer_id,
          amount: Number(saleForm.amount),
          commission_amount: saleForm.commission_amount
            ? Number(saleForm.commission_amount)
            : null,
          sale_date: saleForm.sale_date || null,
          notes: saleForm.notes || null,
        }),
      })
      setSaleForm((f) => ({ ...f, amount: '', commission_amount: '', notes: '' }))
      await loadSales()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitInst(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/admin/installments', {
        method: 'POST',
        body: JSON.stringify({
          dealer_id: instForm.dealer_id,
          amount: Number(instForm.amount),
          due_date: instForm.due_date,
          sale_id: instForm.sale_id || null,
        }),
      })
      setInstForm((f) => ({ ...f, amount: '', due_date: '', sale_id: '' }))
      await loadInstallments()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function markPaid(id) {
    setBusy(true)
    setErr('')
    try {
      await api(`/admin/installments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_at: new Date().toISOString(), status: 'paid' }),
      })
      await loadInstallments()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Administration</h1>
          <p className="text-sm text-zinc-400">
            {user?.full_name} · Member verification & records
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

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {tab === 'members' ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-medium text-white">Register a user</h2>
            <form
              onSubmit={createUser}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm"
            >
              <input
                required
                placeholder="Full name"
                value={newUser.full_name}
                onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
              <input
                required
                placeholder="Phone"
                value={newUser.phone}
                onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
              <input
                type="password"
                required
                placeholder="Temporary password"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
              <select
                value={newUser.role_id}
                onChange={(e) => setNewUser((u) => ({ ...u, role_id: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                value={newUser.account_status}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, account_status: e.target.value }))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              >
                <option value="pending_verification">pending_verification</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
              <input
                placeholder="Member category (optional)"
                value={newUser.member_category}
                onChange={(e) =>
                  setNewUser((u) => ({ ...u, member_category: e.target.value }))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-violet-600 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Create account
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Page {page} · {total} users
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page * 20 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            <ul className="mt-4 max-h-[480px] space-y-1 overflow-auto rounded-xl border border-zinc-800">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(u.id)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                      selected === u.id ? 'bg-zinc-800' : ''
                    }`}
                  >
                    <span className="font-medium text-white">{u.full_name}</span>
                    <span className="text-xs text-zinc-500">
                      {u.email} · {u.role} · {u.account_status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-medium text-white">Member detail</h2>
            {!detail ? (
              <p className="text-sm text-zinc-500">Select a member from the list.</p>
            ) : (
              <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
                <div>
                  <p className="text-white">{detail.user.full_name}</p>
                  <p className="text-zinc-500">{detail.user.email}</p>
                  <p className="text-zinc-500">{detail.user.phone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={detail.user.role_id}
                    onChange={(e) =>
                      updateMember({ role_id: Number(e.target.value) })
                    }
                    disabled={busy}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={detail.user.account_status}
                    onChange={(e) => updateMember({ account_status: e.target.value })}
                    disabled={busy}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-white"
                  >
                    <option value="pending_verification">pending_verification</option>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </div>
                <label className="block text-zinc-400">
                  Category
                  <input
                    defaultValue={detail.user.member_category || ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (detail.user.member_category || '')) {
                        updateMember({ member_category: v || null })
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-white"
                  />
                </label>
                <div>
                  <h3 className="mb-2 font-medium text-zinc-300">Documents</h3>
                  <ul className="space-y-2">
                    {(detail.documents || []).map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2"
                      >
                        <span className="capitalize text-zinc-300">
                          {d.doc_type.replace('_', ' ')} — {d.verification_status}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openAdminDocument(d.id)}
                            className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300"
                          >
                            View
                          </button>
                          {d.verification_status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => reviewDoc(d.id, 'approved')}
                                disabled={busy}
                                className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewDoc(d.id, 'rejected')}
                                disabled={busy}
                                className="rounded bg-red-900 px-2 py-0.5 text-xs text-white"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'sales' ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={submitSale}
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm"
          >
            <h2 className="text-lg font-medium text-white">Record sale</h2>
            <input
              required
              placeholder="Dealer user ID (UUID)"
              value={saleForm.dealer_id}
              onChange={(e) => setSaleForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="Amount"
              value={saleForm.amount}
              onChange={(e) => setSaleForm((f) => ({ ...f, amount: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Commission (optional)"
              value={saleForm.commission_amount}
              onChange={(e) =>
                setSaleForm((f) => ({ ...f, commission_amount: e.target.value }))
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              type="date"
              value={saleForm.sale_date}
              onChange={(e) => setSaleForm((f) => ({ ...f, sale_date: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <textarea
              placeholder="Notes"
              value={saleForm.notes}
              onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[80px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-600 py-2 font-medium text-white disabled:opacity-50"
            >
              Save sale
            </button>
          </form>
          <div>
            <h2 className="mb-3 text-lg font-medium text-white">Recent sales</h2>
            <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
              {sales.map((s) => (
                <li key={s.id} className="rounded border border-zinc-800 p-3 text-zinc-300">
                  <div className="flex justify-between text-white">
                    <span>{s.dealer_name}</span>
                    <span>{Number(s.amount).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {s.sale_date} · commission:{' '}
                    {s.commission_amount != null
                      ? Number(s.commission_amount).toLocaleString()
                      : '—'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === 'installments' ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={submitInst}
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm"
          >
            <h2 className="text-lg font-medium text-white">New installment</h2>
            <input
              required
              placeholder="Dealer user ID"
              value={instForm.dealer_id}
              onChange={(e) => setInstForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder="Amount"
              value={instForm.amount}
              onChange={(e) => setInstForm((f) => ({ ...f, amount: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              type="date"
              required
              value={instForm.due_date}
              onChange={(e) => setInstForm((f) => ({ ...f, due_date: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <input
              placeholder="Sale ID (optional)"
              value={instForm.sale_id}
              onChange={(e) => setInstForm((f) => ({ ...f, sale_id: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-600 py-2 font-medium text-white disabled:opacity-50"
            >
              Create installment
            </button>
          </form>
          <div>
            <h2 className="mb-3 text-lg font-medium text-white">Installments</h2>
            <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
              {installments.map((i) => (
                <li key={i.id} className="rounded border border-zinc-800 p-3 text-zinc-300">
                  <div className="flex justify-between text-white">
                    <span>{i.dealer_name}</span>
                    <span>{Number(i.amount).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Due {i.due_date} · {i.status}
                    {i.paid_at ? ` · paid ${new Date(i.paid_at).toLocaleDateString()}` : ''}
                  </div>
                  {!i.paid_at && i.status !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => markPaid(i.id)}
                      disabled={busy}
                      className="mt-2 rounded bg-emerald-800 px-2 py-1 text-xs text-white"
                    >
                      Mark paid
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
