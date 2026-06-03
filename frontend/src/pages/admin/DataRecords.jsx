import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { appendActivity } from '../../utils/adminStorage'

export default function DataRecords() {
  const [now, setNow] = useState(() => new Date())
  const [tab, setTab] = useState('sales')
  const [sales, setSales] = useState([])
  const [installments, setInstallments] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

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

  const loadSales = useCallback(async () => {
    const data = await api('/admin/sales')
    setSales(data.sales || [])
  }, [])

  const loadInstallments = useCallback(async () => {
    const data = await api('/admin/installments')
    setInstallments(data.installments || [])
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setErr('')
    if (tab === 'sales') loadSales().catch((e) => setErr(e.message))
    if (tab === 'installments') loadInstallments().catch((e) => setErr(e.message))
  }, [tab, loadSales, loadInstallments])

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
      appendActivity({
        type: 'general',
        action: 'Sale recorded',
        detail: `Dealer ${saleForm.dealer_id.slice(0, 8)}… · ${saleForm.amount}`,
      })
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
      appendActivity({
        type: 'general',
        action: 'Installment created',
        detail: `Dealer ${instForm.dealer_id.slice(0, 8)}… · ${instForm.amount}`,
      })
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
      appendActivity({
        type: 'general',
        action: 'Installment marked paid',
        detail: String(id),
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Data & reports</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Sales and installment records for monitoring. Pair with{' '}
            <strong>Members</strong> for dealer IDs and with <strong>Orders</strong> for pipeline
            tracking.
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <p className="font-mono tabular-nums text-neutral-800">{now.toLocaleString()}</p>
          <p>Live clock · refresh lists when you switch tabs</p>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'sales', label: 'Sales' },
          { id: 'installments', label: 'Installments' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'bg-[#D10000] text-white shadow'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={submitSale}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-neutral-900">Record sale</h2>
            <input
              required
              placeholder="Dealer user ID (UUID)"
              value={saleForm.dealer_id}
              onChange={(e) => setSaleForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="Amount"
              value={saleForm.amount}
              onChange={(e) => setSaleForm((f) => ({ ...f, amount: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Commission (optional)"
              value={saleForm.commission_amount}
              onChange={(e) =>
                setSaleForm((f) => ({ ...f, commission_amount: e.target.value }))
              }
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={saleForm.sale_date}
              onChange={(e) => setSaleForm((f) => ({ ...f, sale_date: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Notes"
              value={saleForm.notes}
              onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[80px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#D10000] py-2 text-sm font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
            >
              Save sale
            </button>
          </form>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Recent sales</h2>
            <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
              {sales.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-neutral-700"
                >
                  <div className="flex justify-between font-medium text-neutral-900">
                    <span>{s.dealer_name}</span>
                    <span>{Number(s.amount).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
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
            className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-neutral-900">New installment</h2>
            <input
              required
              placeholder="Dealer user ID"
              value={instForm.dealer_id}
              onChange={(e) => setInstForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder="Amount"
              value={instForm.amount}
              onChange={(e) => setInstForm((f) => ({ ...f, amount: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              required
              value={instForm.due_date}
              onChange={(e) => setInstForm((f) => ({ ...f, due_date: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Sale ID (optional)"
              value={instForm.sale_id}
              onChange={(e) => setInstForm((f) => ({ ...f, sale_id: e.target.value }))}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#D10000] py-2 text-sm font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
            >
              Create installment
            </button>
          </form>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Installments</h2>
            <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
              {installments.map((i) => (
                <li
                  key={i.id}
                  className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-neutral-700"
                >
                  <div className="flex justify-between font-medium text-neutral-900">
                    <span>{i.dealer_name}</span>
                    <span>{Number(i.amount).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    Due {i.due_date} · {i.status}
                    {i.paid_at ? ` · paid ${new Date(i.paid_at).toLocaleDateString()}` : ''}
                  </div>
                  {!i.paid_at && i.status !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => markPaid(i.id)}
                      disabled={busy}
                      className="mt-2 rounded bg-emerald-700 px-2 py-1 text-xs text-white"
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
