import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  appendActivity,
  loadPromotions,
  savePromotions,
} from '../../utils/adminStorage'
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

const STATUSES = [
  { value: 'active', label: 'Active', tone: 'emerald' },
  { value: 'scheduled', label: 'Scheduled', tone: 'amber' },
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'expired', label: 'Expired', tone: 'rose' },
]

const MAX_BANNER_BYTES = 3 * 1024 * 1024

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'

function formatDateMDY(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function visibilityLabel(v) {
  return promotionVisibilityLabel(v)
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

function clampPercent(v) {
  if (v === '' || v == null) return ''
  const n = Number(v)
  if (Number.isNaN(n)) return ''
  return Math.max(0, Math.min(100, Math.round(n)))
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

export default function PromotionEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState(() => loadPromotions())
  const original = useMemo(() => items.find((r) => r.id === id) || null, [items, id])

  const [form, setForm] = useState(null)
  const [bannerError, setBannerError] = useState('')
  const [saveBanner, setSaveBanner] = useState('')

  useEffect(() => {
    if (!original) return
    setForm({
      title: original.title || '',
      type: original.type || 'promotion',
      message: original.message || '',
      startDate: original.startDate || '',
      endDate: original.endDate || '',
      visibility: original.visibility || 'all',
      bannerDataUrl: original.bannerDataUrl || '',
      percentOff: original.percentOff == null ? '' : Number(original.percentOff),
      manualStatus: original.manualStatus || null,
      published: original.published !== false,
    })
  }, [original])

  if (!original || !form) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/promotions"
          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Promotions
        </Link>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bulletin not found.
        </div>
      </div>
    )
  }

  const status = computeStatus({ ...original, ...form })

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onBannerChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BANNER_BYTES) {
      setBannerError('File too large. Maximum is 3 MB.')
      return
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setBannerError('Use PNG, JPG, or WebP.')
      return
    }
    setBannerError('')
    try {
      const dataUrl = await readImageAsDataUrl(file)
      update('bannerDataUrl', dataUrl)
    } catch {
      setBannerError('Could not read the selected file.')
    }
  }

  function setStatus(value) {
    if (value === 'draft') {
      update('manualStatus', 'draft')
      update('published', false)
    } else {
      update('manualStatus', value === 'active' ? null : value)
      update('published', true)
    }
  }

  function persist(rows) {
    savePromotions(rows)
    setItems(rows)
  }

  function save({ asDraft }) {
    const now = new Date().toISOString()
    const next = items.map((r) => {
      if (r.id !== id) return r
      return {
        ...r,
        title: form.title.trim(),
        type: form.type,
        message: form.message.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        visibility: form.visibility,
        bannerDataUrl: form.bannerDataUrl,
        percentOff: form.percentOff === '' ? null : Number(form.percentOff),
        manualStatus: asDraft ? 'draft' : form.manualStatus,
        published: asDraft ? false : form.published,
        updatedAt: now,
      }
    })
    persist(next)
    appendActivity({
      type: 'promotions',
      action: asDraft ? 'Bulletin moved to draft' : 'Bulletin updated',
      detail: form.title.trim(),
    })
    setSaveBanner(asDraft ? 'Saved as draft.' : 'Changes saved.')
    window.setTimeout(() => setSaveBanner(''), 2500)
  }

  function archive() {
    if (!window.confirm('Archive this bulletin? It will be hidden from members.')) return
    persist(
      items.map((r) =>
        r.id === id ? { ...r, archived: true, manualStatus: 'draft', published: false } : r
      )
    )
    appendActivity({ type: 'promotions', action: 'Archived bulletin', detail: form.title.trim() })
    navigate('/admin/promotions')
  }

  function deletePermanently() {
    if (!window.confirm('Permanently delete this bulletin? This cannot be undone.')) return
    persist(items.filter((r) => r.id !== id))
    appendActivity({ type: 'promotions', action: 'Deleted bulletin', detail: form.title.trim() })
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
            ← Back to Promotions
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/promotions')}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save({ asDraft: true })}
              className="rounded-md border border-[#D10000] bg-white px-3 py-1.5 text-xs font-semibold text-[#D10000] hover:bg-rose-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => save({ asDraft: false })}
              className="rounded-md bg-[#D10000] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b30000]"
            >
              Save Changes
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Edit Bulletin</h1>
          <p className="text-sm text-neutral-500">{form.title || 'Untitled bulletin'}</p>
        </div>

        {saveBanner ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            {saveBanner}
          </div>
        ) : null}

        <CurrentStatusBanner status={status} updatedAt={original.updatedAt} />

        <Section title="Bulletin Details" icon="📝">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Bulletin Title" required>
              <input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Type" required>
              <select
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
                className={inputCls}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Message / Details" required>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  className={`${inputCls} min-h-[120px] resize-y`}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Schedule & Visibility" icon="📅">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Start Date" required>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Visible To">
              <select
                value={form.visibility}
                onChange={(e) => update('visibility', e.target.value)}
                className={inputCls}
              >
                {VISIBILITY.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Percent Off">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.percentOff}
                  onChange={(e) => update('percentOff', clampPercent(e.target.value))}
                  placeholder="e.g. 20"
                  className={`${inputCls} pr-8`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500">
                  %
                </span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                Leave blank for non-discount bulletins.
              </p>
            </Field>
          </div>
        </Section>

        <Section title="Change Status" icon="🔄">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const active = status === s.value
              const palette = {
                emerald: active ? 'bg-emerald-100 text-emerald-800 ring-emerald-300' : 'bg-white text-emerald-700 ring-emerald-200',
                amber: active ? 'bg-amber-100 text-amber-800 ring-amber-300' : 'bg-white text-amber-700 ring-amber-200',
                neutral: active ? 'bg-neutral-200 text-neutral-800 ring-neutral-300' : 'bg-white text-neutral-700 ring-neutral-200',
                rose: active ? 'bg-rose-100 text-rose-800 ring-rose-300' : 'bg-white text-rose-700 ring-rose-200',
              }[s.tone]
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${palette}`}
                >
                  <span aria-hidden>{active ? '✓' : '○'}</span> {s.label}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Banner Image" icon="🖼" badge="Optional">
          {form.bannerDataUrl ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-[#e83333] to-[#b30000]">
                <img
                  src={form.bannerDataUrl}
                  alt="Bulletin banner"
                  className="block h-40 w-full object-cover opacity-90"
                />
                <button
                  type="button"
                  onClick={() => update('bannerDataUrl', '')}
                  className="absolute right-3 top-3 rounded bg-neutral-900/80 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-900"
                >
                  Remove
                </button>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70 mix-blend-overlay">
                  Current banner image
                </div>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-center hover:bg-neutral-100">
                <span className="text-xl text-neutral-400">⬆</span>
                <p className="mt-1 text-xs font-medium text-neutral-700">Click to replace banner image</p>
                <p className="text-[11px] text-neutral-500">PNG, JPG, up to 3MB · Recommended: 1200×400px</p>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onBannerChange} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center hover:bg-neutral-100">
              <span className="text-2xl text-neutral-400">⬆</span>
              <p className="mt-2 text-sm font-medium text-neutral-700">Click to upload banner image</p>
              <p className="mt-1 text-xs text-neutral-500">PNG, JPG, up to 3MB · Recommended: 1200×400px</p>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onBannerChange} className="hidden" />
            </label>
          )}
          {bannerError ? <p className="mt-2 text-xs text-red-700">{bannerError}</p> : null}
        </Section>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <SidebarSection title="Live Preview">
          <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-[#e83333] to-[#b30000] p-4 text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/85">
              {(TYPES.find((t) => t.value === form.type)?.label || 'Promotion').toUpperCase()} ·{' '}
              {status.toUpperCase()}
            </p>
            <h4 className="mt-2 text-lg font-bold">{form.title || 'Your Title Here'}</h4>
            <p className="mt-1 text-xs text-white/85">
              {visibilityLabel(form.visibility)} ·{' '}
              {form.startDate ? formatDateMDY(form.startDate) : 'Date TBD'}
              {form.endDate ? ` – ${formatDateMDY(form.endDate)}` : ''}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/admin/promotions/${id}`)}
              className="mt-3 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/25"
            >
              View
            </button>
            {form.percentOff !== '' && Number(form.percentOff) > 0 ? (
              <span className="absolute right-3 top-3 rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-extrabold text-rose-900 shadow-md ring-2 ring-white/50">
                {Number(form.percentOff)}% OFF
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            This is how the bulletin will appear to members.
          </p>
        </SidebarSection>

        <SidebarSection title="Bulletin Info" icon="ℹ">
          <dl className="space-y-2 text-sm">
            <InfoRow label="Bulletin ID" value={`BUL-${(original.id || '').slice(0, 4).toUpperCase()}`} />
            <InfoRow label="Created" value={formatDateMDY(original.createdAt)} />
            <InfoRow label="Created By" value={original.createdBy || '—'} />
            <InfoRow label="Last Edited" value={formatDateMDY(original.updatedAt || original.createdAt)} />
            <InfoRow label="Views" value={String(original.views ?? 0)} />
          </dl>
        </SidebarSection>

        <SidebarSection title="Danger Zone" tone="rose" icon="⚠">
          <p className="text-xs text-rose-900">
            Archiving hides this bulletin from members. It can be restored later.
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={archive}
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Archive Bulletin
            </button>
            <button
              type="button"
              onClick={deletePermanently}
              className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
            >
              Delete Permanently
            </button>
          </div>
        </SidebarSection>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-neutral-800">
        {label}
        {required ? <span className="ml-0.5 text-[#D10000]">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function Section({ title, icon, badge, children }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          {icon ? <span aria-hidden>{icon}</span> : null} {title}
        </h3>
        {badge ? (
          <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/30">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function SidebarSection({ title, icon, tone, children }) {
  const palette = tone === 'rose' ? 'bg-rose-50 border-rose-200' : 'bg-white border-neutral-200'
  const head = tone === 'rose' ? 'bg-rose-100 text-rose-900' : 'bg-[#D10000] text-white'
  return (
    <div className={`overflow-hidden rounded-md border shadow-sm ${palette}`}>
      <div className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide ${head}`}>
        {icon ? <span aria-hidden>{icon}</span> : null} {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm font-semibold text-neutral-900">{value}</dd>
    </div>
  )
}

function CurrentStatusBanner({ status, updatedAt }) {
  const palette = {
    active: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    scheduled: 'border-amber-300 bg-amber-50 text-amber-900',
    draft: 'border-neutral-300 bg-neutral-50 text-neutral-800',
    expired: 'border-rose-300 bg-rose-50 text-rose-900',
  }[status]
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-2 text-sm ${palette}`}>
      <p>
        <span className="font-semibold">Current Status:</span> {label}
      </p>
      {updatedAt ? (
        <p className="text-xs">Last edited: {formatDateMDY(updatedAt)}</p>
      ) : null}
    </div>
  )
}
