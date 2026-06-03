import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  appendActivity,
  loadPromotions,
  savePromotions,
} from '../../utils/adminStorage'
import { promotionVisibilityLabel } from '../../constants/positions'

const TYPES = [
  { value: 'promotion', label: 'Promotion' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'notice', label: 'Notice' },
  { value: 'event', label: 'Event' },
]

function formatDateLong(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function visibilityLabel(v) {
  return promotionVisibilityLabel(v)
}

function typeLabel(t) {
  return TYPES.find((o) => o.value === t)?.label || 'Promotion'
}

function computeStatus(row, now = new Date()) {
  if (row.manualStatus) return row.manualStatus
  if (row.published === false) return 'draft'
  const start = row.startDate ? new Date(row.startDate) : null
  const end = row.endDate ? new Date(row.endDate) : null
  if (end && now > end) return 'expired'
  if (start && now < start) return 'scheduled'
  return 'active'
}

function StatusBadge({ value }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    scheduled: 'bg-amber-100 text-amber-800',
    expired: 'bg-rose-100 text-rose-800',
    draft: 'bg-neutral-200 text-neutral-700',
  }
  const cls = map[value] || 'bg-neutral-100 text-neutral-700'
  const label = (value || '').toUpperCase()
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

export default function PromotionViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState(() => loadPromotions())
  const row = useMemo(() => items.find((r) => r.id === id) || null, [items, id])

  // Bump views on first load (per render of a distinct id) so the "Members Reached"
  // metric in the dashboard reflects actual visits.
  useEffect(() => {
    if (!row) return
    const next = items.map((r) =>
      r.id === row.id ? { ...r, views: Number(r.views || 0) + 1 } : r
    )
    savePromotions(next)
    setItems(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!row) {
    return (
      <div className="space-y-4">
        <Link to="/admin/promotions" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
          ← Back
        </Link>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bulletin not found.
        </div>
      </div>
    )
  }

  const status = computeStatus(row)
  const today = new Date()
  let daysRemaining = 0
  if (row.endDate) {
    const end = new Date(row.endDate)
    const diff = Math.ceil((end - today) / (24 * 60 * 60 * 1000))
    daysRemaining = Math.max(0, diff)
  }
  const membersReached = Number(row.views ?? 0)
  const salesLinked = Number(row.salesLinked ?? 0)

  function archive() {
    if (!window.confirm('Archive this bulletin? It will be hidden from members.')) return
    const next = items.map((r) =>
      r.id === id ? { ...r, archived: true, manualStatus: 'draft', published: false } : r
    )
    savePromotions(next)
    setItems(next)
    appendActivity({ type: 'promotions', action: 'Archived bulletin', detail: row.title })
    navigate('/admin/promotions')
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      {/* Main */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/promotions')}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            <Link
              to={`/admin/promotions/${row.id}/edit`}
              className="rounded-md border border-[#D10000] bg-white px-3 py-1.5 text-xs font-semibold text-[#D10000] hover:bg-rose-50"
            >
              Edit Bulletin
            </Link>
            <button
              type="button"
              onClick={archive}
              className="rounded-md bg-[#D10000] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b30000]"
            >
              Archive
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-[#e83333] to-[#b30000] p-6 text-white shadow-sm">
          {row.bannerDataUrl ? (
            <div className="mb-4 overflow-hidden rounded-md ring-1 ring-white/20">
              <img src={row.bannerDataUrl} alt={`${row.title} banner`} className="block max-h-56 w-full object-cover" />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-white/30">
              {typeLabel(row.type)}
            </span>
            <StatusBadge value={status} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold">{row.title}</h1>
          <p className="mt-1 text-xs text-white/85">
            Visible to {visibilityLabel(row.visibility)} ·{' '}
            {formatDateLong(row.startDate)}
            {row.endDate ? ` – ${formatDateLong(row.endDate)}` : ''}
          </p>
          {row.percentOff > 0 ? (
            <div className="absolute right-5 top-5 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-300 text-rose-900 shadow-lg ring-4 ring-white/40">
              <div className="text-center leading-none">
                <p className="text-2xl font-extrabold tabular-nums">{row.percentOff}%</p>
                <p className="text-[10px] font-bold uppercase tracking-wide">Off</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bulletin Content */}
        <Section title="Bulletin Content" icon="📄">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {row.message}
          </p>
        </Section>

        {/* Bulletin Performance */}
        <Section title="Bulletin Performance" icon="📊">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PerfStat value={membersReached} label="Members Reached" tone="red" />
            <PerfStat value={daysRemaining} label="Days Remaining" tone="green" />
            <PerfStat value={salesLinked} label="Sales Linked" tone="amber" />
          </div>
        </Section>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <SidebarSection title="Bulletin Info" icon="ℹ">
          <dl className="space-y-3 text-sm">
            <InfoRow label="Type" value={typeLabel(row.type)} />
            <InfoRow
              label="Status"
              value={
                <span className="inline-flex">
                  <StatusBadge value={status} />
                </span>
              }
            />
            {row.percentOff > 0 ? (
              <InfoRow
                label="Discount"
                value={
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-rose-900 ring-1 ring-yellow-300">
                    {row.percentOff}% OFF
                  </span>
                }
              />
            ) : null}
            <InfoRow label="Visible To" value={visibilityLabel(row.visibility)} bold />
            <InfoRow label="Start Date" value={formatDateLong(row.startDate)} bold />
            <InfoRow label="End Date" value={formatDateLong(row.endDate)} bold />
            <InfoRow label="Published By" value={row.createdBy || '—'} bold />
            <InfoRow label="Date Created" value={formatDateLong(row.createdAt)} bold />
          </dl>
        </SidebarSection>
      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-[#D10000] px-4 py-2.5 text-sm font-bold text-white">
        {icon ? <span aria-hidden>{icon}</span> : null} {title}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

function SidebarSection({ title, icon, children }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 bg-[#D10000] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
        {icon ? <span aria-hidden>{icon}</span> : null} {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, bold }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd
        className={`text-sm text-right ${
          bold ? 'font-semibold text-neutral-900' : 'text-neutral-800'
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  )
}

function PerfStat({ value, label, tone }) {
  const palette = {
    red: 'text-[#D10000]',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
  }[tone || 'red']
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-4 text-center shadow-sm">
      <p className={`text-3xl font-extrabold tabular-nums ${palette}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-600">{label}</p>
    </div>
  )
}
