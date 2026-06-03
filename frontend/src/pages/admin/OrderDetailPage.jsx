import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loadOrders } from '../../utils/adminStorage'
import { printElement } from '../../utils/print'

function peso(n) {
  if (n == null || Number.isNaN(Number(n))) return '₱0'
  return (
    '₱' +
    Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  )
}

function formatDateMDY(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}, ${d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`
}

function StatusPill({ status }) {
  const s = (status || '').toLowerCase()
  const map = {
    paid: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    cancelled: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
  }
  const cls = map[s] || 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200'
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {s === 'paid' ? <span aria-hidden>✓</span> : null}
      {label}
    </span>
  )
}

function SectionHeader({ children, icon }) {
  return (
    <div className="flex items-center gap-2 bg-[#D10000] px-4 py-2.5">
      {icon ? <span className="text-white">{icon}</span> : null}
      <h3 className="text-sm font-bold text-white">{children}</h3>
    </div>
  )
}

function ActivityDot({ kind }) {
  if (kind === 'paid') {
    return <span className="mt-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
  }
  if (kind === 'cancelled') {
    return <span className="mt-1.5 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
  }
  return <span className="mt-1.5 inline-block h-2.5 w-2.5 rounded-full bg-neutral-400" />
}

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  const order = useMemo(() => {
    const all = loadOrders()
    return all.find((o) => o.id === orderId) || null
  }, [orderId])

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Sales
        </Link>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Order <span className="font-semibold">#{orderId}</span> was not found.
        </div>
      </div>
    )
  }

  const items = order.items || []
  const computedTotal = items.length
    ? items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0)
    : Number(order.amount || 0)
  const computedQty = items.length
    ? items.reduce((sum, it) => sum + Number(it.qty || 0), 0)
    : Number(order.quantity || 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Sales
        </button>
        <button
          type="button"
          onClick={() => printElement('#print-products')}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          Print list
        </button>
      </div>

      {/* Order header */}
      <div className="rounded-md border border-neutral-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">
              Order #{order.id}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <StatusPill status={order.status} />
              <span>Recorded {formatDateMDY(order.date)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Order Total
            </p>
            <p className="mt-1 text-3xl font-extrabold text-[#D10000] tabular-nums">
              {peso(computedTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Dealer" value={order.dealer || '—'} />
        <StatTile label="Amount" value={peso(computedTotal)} accent />
        <StatTile label="Quantity" value={`${computedQty} unit${computedQty === 1 ? '' : 's'}`} />
        <StatTile label="Payment Status" value={(order.status || '').replace(/^./, (c) => c.toUpperCase()) || '—'} />
        <StatTile label="Role" value={(order.role || '').replace(/^./, (c) => c.toUpperCase()) || '—'} />
      </div>

      {/* Order Notes */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader icon="📝">Order Notes</SectionHeader>
        <div className="px-5 py-4">
          {order.notes ? (
            <div className="rounded-md border-l-4 border-[#D10000] bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
              {order.notes}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No notes recorded for this order.</p>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader icon="⏱">Activity Log</SectionHeader>
        <div className="px-5 py-4">
          {(order.activity || []).length === 0 ? (
            <p className="text-sm text-neutral-500">No activity recorded.</p>
          ) : (
            <ul className="space-y-3">
              {(order.activity || []).map((a, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <ActivityDot kind={a.kind} />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{a.action}</p>
                    <p className="text-xs text-neutral-500">
                      By {a.by || 'System'} · {formatDateTime(a.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* List of Products */}
      <div
        id="print-products"
        className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
      >
        <SectionHeader icon="📦">List of Products</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU / Code</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No line items recorded for this order.
                  </td>
                </tr>
              ) : null}
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-neutral-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-rose-50 text-xs font-bold text-[#D10000]">
                        {it.name?.split(' ').slice(0, 2).map((w) => w[0]).join('') || '🧴'}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{it.name}</p>
                        {it.variant ? (
                          <p className="text-xs text-neutral-500">{it.variant}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{it.sku || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">
                    {peso(it.price)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-800">
                    {it.qty}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">
                    {peso(Number(it.price || 0) * Number(it.qty || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            {items.length ? (
              <tfoot>
                <tr className="bg-neutral-50">
                  <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Order Total
                  </td>
                  <td className="px-4 py-3 text-right text-base font-extrabold text-[#D10000] tabular-nums">
                    {peso(computedTotal)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-bold tabular-nums ${
          accent ? 'text-[#D10000]' : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
