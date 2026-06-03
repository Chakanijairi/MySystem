import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadOrders,
  loadMvd,
  computeRecruiterMvd,
  MVD_RATE,
} from '../../utils/adminStorage'
import { printElement } from '../../utils/print'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'executive', label: 'Executive' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
]
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]
const MVD_ROLE_FILTER_OPTIONS = ROLE_FILTER_OPTIONS
const PAGE_SIZE = 4

function peso(n) {
  if (n == null || Number.isNaN(Number(n))) return '₱0'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatDateMDY(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function RoleBadge({ role }) {
  const r = (role || '').toLowerCase()
  const map = {
    manager: 'bg-amber-100 text-amber-800',
    member: 'bg-violet-100 text-violet-800',
    director: 'bg-sky-100 text-sky-800',
    executive: 'bg-rose-100 text-rose-800',
  }
  const cls = map[r] || 'bg-neutral-100 text-neutral-700'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {role || '—'}
    </span>
  )
}

function StatusPill({ status }) {
  const s = (status || '').toLowerCase()
  const map = {
    paid: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-rose-100 text-rose-800',
  }
  const cls = map[s] || 'bg-neutral-100 text-neutral-700'
  const label = (status || '').charAt(0).toUpperCase() + (status || '').slice(1)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label || '—'}
    </span>
  )
}

function SectionHeader({ children, right }) {
  return (
    <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
      <h3 className="text-sm font-bold text-white">{children}</h3>
      {right}
    </div>
  )
}

function PrintButton({ target }) {
  return (
    <button
      type="button"
      onClick={() => printElement(target)}
      className="inline-flex items-center gap-1 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25 print:hidden"
    >
      <span aria-hidden>🖨</span> Print
    </button>
  )
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => loadOrders())
  const [mvd, setMvd] = useState(() => loadMvd())

  // Order Records filters (live debounced — same pattern as Member Directory)
  const [orderId, setOrderId] = useState('')
  const [dealerName, setDealerName] = useState('')
  const [filterAddress, setFilterAddress] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [debouncedOrderFilters, setDebouncedOrderFilters] = useState({
    orderId: '',
    dealer: '',
    address: '',
    role: '',
    min: '',
    max: '',
    orderDate: '',
    dueDate: '',
    status: '',
  })
  const [page, setPage] = useState(1)

  // MVD section filters
  const [mvdMonth, setMvdMonth] = useState(new Date().getMonth() + 1)
  const [mvdYear, setMvdYear] = useState(new Date().getFullYear())
  const [mvdDealer, setMvdDealer] = useState('')
  const [mvdRole, setMvdRole] = useState('')
  const [mvdMinSales, setMvdMinSales] = useState('')
  const [mvdMinMvd, setMvdMinMvd] = useState('')
  const [mvdDate, setMvdDate] = useState('')
  const [debouncedMvdFilters, setDebouncedMvdFilters] = useState({
    dealer: '',
    role: '',
    minSales: '',
    minMvd: '',
    date: '',
  })
  const [mvdPage, setMvdPage] = useState(1)

  useEffect(() => {
    setOrders(loadOrders())
    setMvd(loadMvd())
  }, [])

  useEffect(() => {
    const t = setTimeout(
      () =>
        setDebouncedOrderFilters({
          orderId: orderId.trim().replace(/^#/, ''),
          dealer: dealerName.trim(),
          address: filterAddress.trim(),
          role: filterRole,
          min: minAmount.trim(),
          max: maxAmount.trim(),
          orderDate,
          dueDate,
          status: filterStatus,
        }),
      350
    )
    return () => clearTimeout(t)
  }, [
    orderId,
    dealerName,
    filterAddress,
    filterRole,
    minAmount,
    maxAmount,
    orderDate,
    dueDate,
    filterStatus,
  ])

  useEffect(() => {
    setPage(1)
  }, [debouncedOrderFilters])

  useEffect(() => {
    const t = setTimeout(
      () =>
        setDebouncedMvdFilters({
          dealer: mvdDealer.trim(),
          role: mvdRole,
          minSales: mvdMinSales.trim(),
          minMvd: mvdMinMvd.trim(),
          date: mvdDate,
        }),
      350
    )
    return () => clearTimeout(t)
  }, [mvdDealer, mvdRole, mvdMinSales, mvdMinMvd, mvdDate])

  useEffect(() => {
    setMvdPage(1)
  }, [debouncedMvdFilters])

  const filteredOrders = useMemo(() => {
    const f = debouncedOrderFilters
    return orders.filter((o) => {
      if (f.orderId) {
        const id = String(o.id || '')
          .toLowerCase()
          .replace(/^#/, '')
        if (!id.includes(f.orderId.toLowerCase())) return false
      }
      if (f.dealer && !String(o.dealer || '').toLowerCase().includes(f.dealer.toLowerCase()))
        return false
      if (
        f.address &&
        !String(o.address || '').toLowerCase().includes(f.address.toLowerCase())
      )
        return false
      if (f.role && String(o.role || '').toLowerCase() !== f.role) return false
      if (f.min !== '' && Number(o.amount) < Number(f.min)) return false
      if (f.max !== '' && Number(o.amount) > Number(f.max)) return false
      if (f.orderDate && o.date !== f.orderDate) return false
      if (f.dueDate && o.dueDate !== f.dueDate) return false
      if (f.status && String(o.status || '').toLowerCase() !== f.status) return false
      return true
    })
  }, [orders, debouncedOrderFilters])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const paginated = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => {
    const totalSales = orders
      .filter((o) => o.status === 'paid')
      .reduce((s, o) => s + Number(o.amount || 0), 0)
    const now = new Date()
    const thisMonthSales = orders
      .filter((o) => {
        const d = new Date(o.date)
        return (
          o.status === 'paid' &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        )
      })
      .reduce((s, o) => s + Number(o.amount || 0), 0)
    const orderCount = orders.length
    const avg = orderCount ? totalSales / orderCount : 0
    return { totalSales, thisMonthSales, orderCount, avg }
  }, [orders])

  const monthLabel = MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear()

  function resetOrderFilters() {
    setOrderId('')
    setDealerName('')
    setFilterAddress('')
    setFilterRole('')
    setMinAmount('')
    setMaxAmount('')
    setOrderDate('')
    setDueDate('')
    setFilterStatus('')
  }

  /* ─── MVD section ─── */

  /**
   * Roll-up MVD per row using the recruiter rule (10% of recruited members'
   * sales). Stored `mvd` values are ignored — recruiter override is always
   * derived from current `sales` data so it stays in sync.
   */
  const mvdForMonth = useMemo(() => {
    return mvd
      .filter((m) => m.month === mvdMonth && m.year === mvdYear)
      .map((m) => ({
        ...m,
        mvd: computeRecruiterMvd(mvd, m.dealer, mvdMonth, mvdYear),
      }))
  }, [mvd, mvdMonth, mvdYear])

  const filteredMvd = useMemo(() => {
    const f = debouncedMvdFilters
    return mvdForMonth.filter((m) => {
      if (f.dealer && !m.dealer.toLowerCase().includes(f.dealer.toLowerCase())) return false
      if (f.role && String(m.role || '').toLowerCase() !== f.role) return false
      if (f.minSales !== '' && Number(m.sales) < Number(f.minSales)) return false
      if (f.minMvd !== '' && Number(m.mvd) < Number(f.minMvd)) return false
      if (f.date && m.date !== f.date) return false
      return true
    })
  }, [mvdForMonth, debouncedMvdFilters])

  const mvdTotalPages = Math.max(1, Math.ceil(filteredMvd.length / PAGE_SIZE))
  const mvdPaginated = filteredMvd.slice((mvdPage - 1) * PAGE_SIZE, mvdPage * PAGE_SIZE)

  function resetMvdFilters() {
    setMvdDealer('')
    setMvdRole('')
    setMvdMinSales('')
    setMvdMinMvd('')
    setMvdDate('')
  }

  return (
    <div className="space-y-6">
      <h2 className="text-center text-xl font-bold text-neutral-900">Sales Overview</h2>

      {/* ── Sales summary table ── */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <SectionHeader>Sales Summary</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Total Sales" value={peso(stats.totalSales)} note="All time" />
              <SummaryRow label="This Month" value={peso(stats.thisMonthSales)} note={monthLabel} />
              <SummaryRow label="Orders" value={String(stats.orderCount)} note="Total transactions" />
              <SummaryRow label="Avg. Order" value={peso(stats.avg)} note="Per transaction" last />
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Records ── */}
      <div
        id="print-orders"
        className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
      >
        <SectionHeader right={<PrintButton target="#print-orders" />}>
          Order Records
        </SectionHeader>

        <div className="border-b border-neutral-100 px-4 py-4 print:hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-800">Search &amp; filter orders</p>
            <button
              type="button"
              onClick={resetOrderFilters}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Reset filters
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Order ID">
              <input
                type="search"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. ORD-0038"
                className={inputCls}
              />
            </FormField>
            <FormField label="Member name">
              <input
                type="search"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                placeholder="Search name…"
                className={inputCls}
              />
            </FormField>
            <FormField label="Address">
              <input
                type="search"
                value={filterAddress}
                onChange={(e) => setFilterAddress(e.target.value)}
                placeholder="Street, barangay, city…"
                className={inputCls}
              />
            </FormField>
            <FormField label="Role">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={inputCls}
              >
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <option key={r.value || 'all'} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Min amount">
              <input
                type="search"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Min ₱"
                inputMode="numeric"
                className={inputCls}
              />
            </FormField>
            <FormField label="Max amount">
              <input
                type="search"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="Max ₱"
                inputMode="numeric"
                className={inputCls}
              />
            </FormField>
            <FormField label="Order date">
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={inputCls}
              >
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s.value || 'all'} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-neutral-100">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No orders match the current filters.
                  </td>
                </tr>
              ) : null}
              {paginated.map((o) => (
                <tr
                  key={o.id}
                  onDoubleClick={() => navigate(`/admin/orders/${o.id}`)}
                  title="Double-click to open order details"
                  className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/60"
                >
                  <td className="px-4 py-3 font-semibold text-[#D10000]">#{o.id}</td>
                  <td className="px-4 py-3 text-neutral-800">{o.dealer}</td>
                  <td className="px-4 py-3 text-neutral-700">{o.address}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900 tabular-nums">{peso(o.amount)}</td>
                  <td className="px-4 py-3"><RoleBadge role={o.role} /></td>
                  <td className="px-4 py-3 text-neutral-700 tabular-nums">{formatDateMDY(o.date)}</td>
                  <td className="px-4 py-3 text-neutral-700 tabular-nums">{formatDateMDY(o.dueDate)}</td>
                  <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print:hidden">
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} onJump={setPage} />
        </div>
      </div>

      {/* ── Sales & MVD Records ── */}
      <div
        id="print-mvd"
        className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
      >
        <SectionHeader right={<PrintButton target="#print-mvd" />}>
          Sales &amp; MVD Records
        </SectionHeader>

        <div className="bg-white px-4 py-4 md:px-5 print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            View Month
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {MONTHS.map((m, idx) => {
              const v = idx + 1
              const active = mvdMonth === v
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMvdMonth(v); setMvdPage(1) }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#D10000] text-white shadow-sm'
                      : 'bg-white text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {m}
                </button>
              )
            })}
            <input
              type="number"
              value={mvdYear}
              onChange={(e) => setMvdYear(Number(e.target.value) || new Date().getFullYear())}
              className="ml-2 w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs"
            />
          </div>

          {/* Recruiter override rule explainer */}
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span aria-hidden>★</span>
            <p>
              <span className="font-semibold">Recruiter override:</span> every member's
              recruiter automatically earns <span className="font-semibold">{Math.round(MVD_RATE * 100)}% MVD</span>{' '}
              based on that member's total sales. Each <span className="font-semibold">Total MVD</span>{' '}
              value below is computed live from the member's recruited downline.
            </p>
          </div>

          {/* Filter MVD records */}
          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50/60 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-800">Search &amp; filter MVD</p>
              <button
                type="button"
                onClick={resetMvdFilters}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Reset filters
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <FormField label="Member name">
                <input
                  type="search"
                  value={mvdDealer}
                  onChange={(e) => setMvdDealer(e.target.value)}
                  placeholder="Search name…"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Role">
                <select value={mvdRole} onChange={(e) => setMvdRole(e.target.value)} className={inputCls}>
                  {MVD_ROLE_FILTER_OPTIONS.map((r) => (
                    <option key={r.value || 'all'} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Total sales (min)">
                <input
                  type="search"
                  value={mvdMinSales}
                  onChange={(e) => setMvdMinSales(e.target.value)}
                  placeholder="Min ₱"
                  inputMode="numeric"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Total MVD (min)">
                <input
                  type="search"
                  value={mvdMinMvd}
                  onChange={(e) => setMvdMinMvd(e.target.value)}
                  placeholder="Min MVD"
                  inputMode="numeric"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Date">
                <input type="date" value={mvdDate} onChange={(e) => setMvdDate(e.target.value)} className={inputCls} />
              </FormField>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-neutral-100">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Recruited by</th>
                <th className="px-4 py-3 text-right">Total Sales</th>
                <th className="px-4 py-3 text-right">
                  Total MVD
                  <span
                    className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800"
                    title={`${Math.round(MVD_RATE * 100)}% of recruited members' sales`}
                  >
                    ?
                  </span>
                </th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {mvdPaginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No records for this period.
                  </td>
                </tr>
              ) : null}
              {mvdPaginated.map((m) => (
                <tr
                  key={m.id}
                  onDoubleClick={() => navigate(`/admin/sales/members/${m.id}`)}
                  title="Double-click to open member sales detail"
                  className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/60"
                >
                  <td className="px-4 py-3 text-neutral-800">{m.dealer}</td>
                  <td className="px-4 py-3 text-neutral-700">{m.address}</td>
                  <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3 text-neutral-700">
                    {m.recruiter || <span className="italic text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">{peso(m.sales)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                    {peso(m.mvd)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 tabular-nums">{formatDateMDY(m.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print:hidden">
          <Pagination
            page={mvdPage}
            totalPages={mvdTotalPages}
            onPrev={() => setMvdPage((p) => Math.max(1, p - 1))}
            onNext={() => setMvdPage((p) => Math.min(mvdTotalPages, p + 1))}
            onJump={setMvdPage}
          />
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'
function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  )
}

function SummaryRow({ label, value, note, last }) {
  return (
    <tr className={last ? '' : 'border-b border-neutral-100'}>
      <td className="px-4 py-3 font-medium text-neutral-800">{label}</td>
      <td className="px-4 py-3 font-bold tabular-nums text-neutral-900">{value}</td>
      <td className="px-4 py-3 text-neutral-600">{note || '—'}</td>
    </tr>
  )
}

function Pagination({ page, totalPages, onPrev, onNext, onJump }) {
  const pages = []
  for (let i = 1; i <= totalPages; i++) pages.push(i)
  return (
    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      >
        ← Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onJump(p)}
          className={`rounded-md px-3 py-1 text-xs font-semibold ${
            p === page
              ? 'bg-[#D10000] text-white'
              : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  )
}
