import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  appendActivity,
  loadPromotions,
  savePromotions,
} from '../../utils/adminStorage'
import { useAdminSync } from '../../hooks/useAdminSync'
import {
  PROMOTION_VISIBILITY_OPTIONS,
  promotionVisibilityLabel,
} from '../../constants/positions'

const TYPES = [
  { value: 'promotion', label: 'Promotion' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'notice', label: 'Notice' },
  { value: 'event', label: 'Event' },
]

const VISIBILITY = PROMOTION_VISIBILITY_OPTIONS

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'draft', label: 'Draft' },
]
const PAGE_SIZE = 5

function computeStatus(row, now = new Date()) {
  if (row.manualStatus) return row.manualStatus
  if (row.published === false) return 'draft'
  const start = row.startDate ? new Date(row.startDate) : null
  const end = row.endDate ? new Date(row.endDate) : null
  if (end && now > end) return 'expired'
  if (start && now < start) return 'scheduled'
  return 'active'
}

function StatusPill({ value }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-800',
    scheduled: 'bg-amber-100 text-amber-800',
    expired: 'bg-rose-100 text-rose-800',
    draft: 'bg-neutral-200 text-neutral-700',
  }
  const cls = map[value] || 'bg-neutral-100 text-neutral-700'
  const label = value.charAt(0).toUpperCase() + value.slice(1)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
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

function visibilityLabel(v) {
  return promotionVisibilityLabel(v)
}

function typeLabel(t) {
  return TYPES.find((o) => o.value === t)?.label || 'Promotion'
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'

export default function PromotionsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(() => loadPromotions())

  const [searchName, setSearchName] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [debouncedFilters, setDebouncedFilters] = useState({
    name: '',
    start: '',
    end: '',
    status: '',
  })
  const [page, setPage] = useState(1)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const selectAllRef = useRef(null)

  const sync = () => setItems(loadPromotions())
  useAdminSync(sync)

  useEffect(() => {
    const t = setTimeout(
      () =>
        setDebouncedFilters({
          name: searchName.trim(),
          start: filterStart,
          end: filterEnd,
          status: filterStatus,
        }),
      350
    )
    return () => clearTimeout(t)
  }, [searchName, filterStart, filterEnd, filterStatus])

  useEffect(() => {
    setPage(1)
  }, [debouncedFilters])

  const decorated = useMemo(
    () =>
      items.map((row) => ({
        ...row,
        status: computeStatus(row),
        type: row.type || 'promotion',
        visibility: row.visibility || 'all',
      })),
    [items]
  )

  const stats = useMemo(() => {
    let active = 0
    let expired = 0
    decorated.forEach((r) => {
      if (r.status === 'active') active += 1
      if (r.status === 'expired') expired += 1
    })
    return { total: decorated.length, active, expired }
  }, [decorated])

  const filtered = useMemo(() => {
    const f = debouncedFilters
    return decorated.filter((row) => {
      if (f.name && !row.title.toLowerCase().includes(f.name.toLowerCase())) return false
      if (f.start && row.startDate && row.startDate < f.start) return false
      if (f.end && row.endDate && row.endDate > f.end) return false
      if (f.status && row.status !== f.status) return false
      return true
    })
  }, [decorated, debouncedFilters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() {
    setSearchName('')
    setFilterStart('')
    setFilterEnd('')
    setFilterStatus('')
  }

  function persist(next) {
    savePromotions(next)
    setItems(next)
  }

  function openCreate() {
    navigate('/admin/promotions/new')
  }

  function openView(row) {
    if (selectMode) return
    navigate(`/admin/promotions/${row.id}`)
  }

  /* ─── Selection helpers ─── */

  const pageIds = useMemo(() => paginated.map((r) => r.id), [paginated])
  const selectedOnPage = useMemo(
    () => pageIds.filter((id) => selectedIds.has(id)).length,
    [pageIds, selectedIds]
  )
  const allSelectedOnPage = pageIds.length > 0 && selectedOnPage === pageIds.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedOnPage > 0 && selectedOnPage < pageIds.length
    }
  }, [selectedOnPage, pageIds.length])

  function toggleSelectMode() {
    setSelectMode((m) => !m)
    setSelectedIds(new Set())
  }

  function toggleRow(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAllPage(checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) pageIds.forEach((id) => next.add(id))
      else pageIds.forEach((id) => next.delete(id))
      return next
    })
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return
    if (
      !window.confirm(
        `Delete ${selectedIds.size} bulletin${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`
      )
    )
      return
    const removed = items.filter((x) => selectedIds.has(x.id))
    persist(items.filter((x) => !selectedIds.has(x.id)))
    removed.forEach((r) =>
      appendActivity({ type: 'promotions', action: 'Removed bulletin', detail: r.title })
    )
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-neutral-900">Promotions</h2>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#D10000] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b30000]"
        >
          <span className="text-base leading-none">+</span> Create Bulletin
        </button>
      </div>

      {/* Bulletins summary table */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">Bulletins Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              <BulletinSummaryRow label="Total Bulletins" value={stats.total} note="All bulletins on file" />
              <BulletinSummaryRow label="Active Promotions" value={stats.active} note="Currently visible to members" />
              <BulletinSummaryRow label="Expired" value={stats.expired} note="Past their end date" last />
            </tbody>
          </table>
        </div>
      </div>


      {/* All Bulletins */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">All Bulletins</h3>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 ? (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/30">
                {selectedIds.size} selected
              </span>
            ) : null}
            <button
              type="button"
              onClick={toggleSelectMode}
              className={`rounded-md px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                selectMode
                  ? 'bg-white text-[#D10000] ring-white hover:bg-rose-50'
                  : 'bg-white/15 text-white ring-white/30 hover:bg-white/25'
              }`}
            >
              {selectMode ? 'Cancel select' : 'Select'}
            </button>
          </div>
        </div>

        <div className="bg-white px-4 py-4 md:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-800">Search &amp; filter bulletins</p>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Reset filters
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Bulletin name">
              <input
                type="search"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search name…"
                className={inputCls}
              />
            </FormField>
            <FormField label="Start Date">
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="End Date">
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {selectMode ? (
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-[#D10000] focus:ring-[#D10000]"
                      checked={allSelectedOnPage}
                      onChange={(e) => toggleSelectAllPage(e.target.checked)}
                      aria-label="Select all on this page"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Visible To</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectMode ? 7 : 6}
                    className="px-4 py-8 text-center text-sm text-neutral-500"
                  >
                    No bulletins yet. Click <span className="font-semibold text-[#D10000]">+ Create Bulletin</span> to get started.
                  </td>
                </tr>
              ) : null}
              {paginated.map((row) => {
                const checked = selectedIds.has(row.id)
                return (
                  <tr
                    key={row.id}
                    onDoubleClick={() => openView(row)}
                    onClick={() => {
                      if (selectMode) toggleRow(row.id, !checked)
                    }}
                    title={
                      selectMode
                        ? 'Click row to toggle selection'
                        : 'Double-click to view bulletin'
                    }
                    className={`cursor-pointer border-b border-neutral-100 ${
                      selectMode && checked ? 'bg-rose-50/60' : 'hover:bg-neutral-50/60'
                    }`}
                  >
                    {selectMode ? (
                      <td
                        className="w-10 px-3 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#D10000] focus:ring-[#D10000]"
                          checked={checked}
                          onChange={(e) => toggleRow(row.id, e.target.checked)}
                          aria-label={`Select ${row.title}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openView(row)
                          }}
                          className="text-left font-semibold text-[#D10000] hover:underline"
                        >
                          {row.title}
                        </button>
                        {row.percentOff > 0 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 ring-1 ring-yellow-300">
                            {row.percentOff}% OFF
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{typeLabel(row.type)}</td>
                    <td className="px-4 py-3 text-neutral-700">{visibilityLabel(row.visibility)}</td>
                    <td className="px-4 py-3 text-neutral-700 tabular-nums">{formatDateMDY(row.startDate)}</td>
                    <td className="px-4 py-3 text-neutral-700 tabular-nums">{formatDateMDY(row.endDate)}</td>
                    <td className="px-4 py-3"><StatusPill value={row.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-white px-4 py-3">
          {/* Bulk actions (only in select mode) */}
          {selectMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={deleteSelected}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-40"
              >
                Delete selected ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span />
          )}

          {/* Pagination */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  )
}

function BulletinSummaryRow({ label, value, note, last }) {
  return (
    <tr className={last ? '' : 'border-b border-neutral-100'}>
      <td className="px-4 py-3 font-medium text-neutral-800">{label}</td>
      <td className="px-4 py-3 font-bold tabular-nums text-neutral-900">{value}</td>
      <td className="px-4 py-3 text-neutral-600">{note || '—'}</td>
    </tr>
  )
}

