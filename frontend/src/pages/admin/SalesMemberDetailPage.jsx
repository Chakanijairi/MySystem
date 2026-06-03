import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  loadMvd,
  computeRecruiterMvd,
  computeMvdBreakdown,
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
const PAGE_SIZE = 6

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

function initials(name) {
  return (
    (name || '')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
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

export default function SalesMemberDetailPage() {
  const { rowId } = useParams()
  const navigate = useNavigate()

  const allMvd = useMemo(() => loadMvd(), [])
  const row = useMemo(() => allMvd.find((m) => m.id === rowId) || null, [allMvd, rowId])

  const [year, setYear] = useState(() => row?.year || new Date().getFullYear())
  const [month, setMonth] = useState(() => row?.month || new Date().getMonth() + 1)

  const [searchName, setSearchName] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [minSales, setMinSales] = useState('')
  const [minMvd, setMinMvd] = useState('')
  const [date, setDate] = useState('')
  const [debouncedFilters, setDebouncedFilters] = useState({
    name: '',
    role: '',
    minSales: '',
    minMvd: '',
    date: '',
  })
  const [page, setPage] = useState(1)

  /**
   * Same recruiter-override rule used on the Sales overview: every row's
   * `mvd` is replaced with 10% of the sum of that dealer's recruited members'
   * sales for the same month.
   */
  const monthRows = useMemo(() => {
    return allMvd
      .filter((m) => m.month === month && m.year === year)
      .map((m) => ({
        ...m,
        mvd: computeRecruiterMvd(allMvd, m.dealer, month, year),
      }))
  }, [allMvd, month, year])

  const selectedMvd = useMemo(
    () => (row ? computeRecruiterMvd(allMvd, row.dealer, month, year) : 0),
    [allMvd, row, month, year]
  )

  const mvdBreakdown = useMemo(
    () => (row ? computeMvdBreakdown(allMvd, row.dealer, month, year) : []),
    [allMvd, row, month, year]
  )

  const isManager = (row?.role || '').toLowerCase() === 'manager'

  /** Managers see recruited members only (not themselves); members see no team list. */
  const performanceRows = useMemo(() => {
    if (!row) return monthRows
    if (isManager) {
      return monthRows.filter((m) => m.recruiter === row.dealer)
    }
    return monthRows.filter((m) => m.id === row.id)
  }, [monthRows, row, isManager])

  const aggregate = useMemo(() => {
    const active = performanceRows.filter(
      (m) => Number(m.sales || 0) > 0 || Number(m.orders || 0) > 0
    ).length
    return { active }
  }, [performanceRows])

  useEffect(() => {
    const t = setTimeout(
      () =>
        setDebouncedFilters({
          name: searchName.trim(),
          role: roleFilter,
          minSales: minSales.trim(),
          minMvd: minMvd.trim(),
          date,
        }),
      350
    )
    return () => clearTimeout(t)
  }, [searchName, roleFilter, minSales, minMvd, date])

  useEffect(() => {
    setPage(1)
  }, [debouncedFilters])

  const filtered = useMemo(() => {
    const f = debouncedFilters
    return performanceRows
      .filter((m) => {
        if (f.name && !m.dealer.toLowerCase().includes(f.name.toLowerCase())) return false
        if (f.role && String(m.role || '').toLowerCase() !== f.role) return false
        if (f.minSales !== '' && Number(m.sales) < Number(f.minSales))
          return false
        if (f.minMvd !== '' && Number(m.mvd) < Number(f.minMvd)) return false
        if (f.date && m.date !== f.date) return false
        return true
      })
      .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
  }, [performanceRows, debouncedFilters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() {
    setSearchName('')
    setRoleFilter('')
    setMinSales('')
    setMinMvd('')
    setDate('')
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Sales
        </Link>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          MVD record was not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Sales
        </button>
        {isManager ? (
          <button
            type="button"
            onClick={() => printElement('#print-mvd-records')}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Print list
          </button>
        ) : null}
      </div>

      <div>
        <h1 className="text-xl font-extrabold text-neutral-900">Sales &amp; MVD Records</h1>
        <p className="text-sm text-neutral-500">
          {isManager
            ? 'Track team sales performance and MVD points earned per month.'
            : 'Your sales summary for the selected period. Team performance lists are for managers only.'}
        </p>
      </div>

      {/* Period selector */}
      <div className="rounded-md border border-neutral-200 bg-white px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <span aria-hidden>📅</span> Select Period
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← {year - 1}
          </button>
          <span className="text-base font-bold text-neutral-900 tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {year + 1} →
          </button>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1">
            {MONTHS.map((m, idx) => {
              const v = idx + 1
              const active = month === v
              const hasData = allMvd.some(
                (r) => r.month === v && r.year === year && (Number(r.sales) > 0 || Number(r.orders) > 0)
              )
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMonth(v)
                    setPage(1)
                  }}
                  className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#D10000] text-white shadow-sm'
                      : 'bg-white text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {m}
                  {hasData && !active ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#D10000]" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected member card */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
              row.role === 'manager'
                ? 'bg-blue-500'
                : row.role === 'member'
                  ? 'bg-violet-500'
                  : 'bg-emerald-500'
            }`}
          >
            {initials(row.dealer)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-900">{row.dealer}</p>
            <RoleBadge role={row.role} />
          </div>
          <span aria-hidden className="text-amber-400">
            ★
          </span>
        </div>
      </div>

      {/* Sales & MVD summary table */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">
            Sales &amp; MVD Summary — {MONTHS[month - 1]} {year}
          </h3>
        </div>
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
              <SummaryRow
                label="Total Sales"
                value={peso(row.sales)}
                note={`${MONTHS[month - 1]} ${year}`}
              />
              <SummaryRow
                label="Total MVD"
                value={peso(selectedMvd)}
                note={
                  isManager
                    ? `${Math.round(MVD_RATE * 100)}% recruiter override`
                    : 'Members do not earn team MVD'
                }
              />
              {isManager ? (
                <SummaryRow
                  label="Active Members"
                  value={String(aggregate.active)}
                  note={
                    aggregate.active > 0
                      ? `${aggregate.active} recruited this month`
                      : 'No downline activity this month'
                  }
                />
              ) : null}
              <SummaryRow
                label="Total Orders"
                value={String(row.orders || 0)}
                note="Transactions for selected member"
                last
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Recruiter override breakdown — managers only */}
      {isManager && mvdBreakdown.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-900">
              Where {row.dealer}'s MVD came from
            </p>
            <p className="text-xs text-emerald-800">
              {Math.round(MVD_RATE * 100)}% of each recruited member's sales for{' '}
              {MONTHS[month - 1]} {year}
            </p>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {mvdBreakdown.map((b) => (
              <li
                key={b.dealer}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-emerald-100"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {b.dealer}
                  </p>
                  <p className="text-xs text-neutral-500 capitalize">
                    {b.role} · sales {peso(b.sales)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 tabular-nums">
                  +{peso(b.contribution)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-2 text-sm">
            <span className="font-medium text-emerald-900">Total MVD earned</span>
            <span className="font-bold text-emerald-900 tabular-nums">
              {peso(selectedMvd)}
            </span>
          </div>
        </div>
      ) : isManager ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <span className="font-semibold">No recruited members</span> with sales this
          month. {row.dealer}'s MVD override is {peso(0)}.
        </div>
      ) : null}

      {isManager ? (
        <>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Member Performance — {MONTHS[month - 1]} {year}
      </p>

      {/* Detailed records — managers only (team / downline) */}
      <div
        id="print-mvd-records"
        className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">
            Detailed MVD Records — {MONTHS[month - 1]} {year}
          </h3>
          <button
            type="button"
            onClick={() => printElement('#print-mvd-records')}
            className="rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25 print:hidden"
          >
            Print
          </button>
        </div>

          <div className="bg-neutral-50/60 px-4 py-3 print:hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-800">Search &amp; filter team records</p>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Reset filters
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <FilterField label="Member name">
                <input
                  type="search"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Search name…"
                  className={inputCls}
                />
              </FilterField>
              <FilterField label="Role">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={inputCls}
                >
                  {ROLE_FILTER_OPTIONS.map((r) => (
                    <option key={r.value || 'all'} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Total sales (min)">
                <input
                  type="search"
                  value={minSales}
                  onChange={(e) => setMinSales(e.target.value)}
                  placeholder="Min ₱"
                  inputMode="numeric"
                  className={inputCls}
                />
              </FilterField>
              <FilterField label="Total MVD (min)">
                <input
                  type="search"
                  value={minMvd}
                  onChange={(e) => setMinMvd(e.target.value)}
                  placeholder="Min MVD"
                  inputMode="numeric"
                  className={inputCls}
                />
              </FilterField>
              <FilterField label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </FilterField>
            </div>
          </div>

        <div className="overflow-x-auto border-t border-neutral-100">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Total Sales</th>
                <th className="px-4 py-3 text-right">Total MVD</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3">Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No records for this period.
                  </td>
                </tr>
              ) : null}
              {paginated.map((m, idx) => {
                const rank = (page - 1) * PAGE_SIZE + idx + 1
                const isMe = m.id === row.id
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-neutral-100 ${
                      isMe ? 'bg-rose-50/60' : 'hover:bg-neutral-50/60'
                    }`}
                  >
                    <td className="px-4 py-3 text-neutral-500 tabular-nums">{rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                            (m.role || '').toLowerCase() === 'manager'
                              ? 'bg-blue-500'
                              : (m.role || '').toLowerCase() === 'member'
                                ? 'bg-violet-500'
                                : 'bg-emerald-500'
                          }`}
                        >
                          {initials(m.dealer)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{m.dealer}</p>
                          <p className="text-[11px] text-neutral-500">{m.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#D10000]">
                      {peso(m.sales)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                      {peso(m.mvd)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-800">
                      {m.orders || 0}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 tabular-nums">
                      {formatDateMDY(m.date)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-white px-4 py-3 print:hidden">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="rounded-md bg-[#D10000] px-3 py-1 text-xs font-semibold text-white">
            {page}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
        </>
      ) : null}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'
function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  )
}
