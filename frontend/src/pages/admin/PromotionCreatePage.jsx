import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  appendActivity,
  loadPromotions,
  savePromotions,
} from '../../utils/adminStorage'
import { useAuth } from '../../context/AuthContext'
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

const MAX_BANNER_BYTES = 3 * 1024 * 1024 // 3MB

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]'

function emptyForm() {
  return {
    title: '',
    type: '',
    message: '',
    startDate: '',
    endDate: '',
    visibility: 'all',
    bannerDataUrl: '',
    percentOff: '',
  }
}

function clampPercent(v) {
  if (v === '' || v == null) return ''
  const n = Number(v)
  if (Number.isNaN(n)) return ''
  return Math.max(0, Math.min(100, Math.round(n)))
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

export default function PromotionCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm())
  const [bannerError, setBannerError] = useState('')

  const checklist = useMemo(() => {
    return {
      title: form.title.trim().length > 0,
      type: Boolean(form.type),
      message: form.message.trim().length > 0,
      startDate: Boolean(form.startDate),
      banner: Boolean(form.bannerDataUrl),
    }
  }, [form])

  const canPublish = checklist.title && checklist.type && checklist.message && checklist.startDate

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

  function save({ asDraft }) {
    if (!asDraft && !canPublish) return
    const now = new Date().toISOString()
    const row = {
      id: globalThis.crypto?.randomUUID?.() ?? `p_${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      message: form.message.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      visibility: form.visibility,
      bannerDataUrl: form.bannerDataUrl,
      percentOff: form.percentOff === '' ? null : Number(form.percentOff),
      published: !asDraft,
      manualStatus: asDraft ? 'draft' : null,
      views: 0,
      salesLinked: 0,
      createdBy: user?.full_name || 'Admin',
      createdAt: now,
      updatedAt: now,
    }
    const next = [row, ...loadPromotions()]
    savePromotions(next)
    appendActivity({
      type: 'promotions',
      action: asDraft ? 'Bulletin draft saved' : 'Published bulletin',
      detail: row.title,
    })
    navigate(`/admin/promotions/${row.id}`)
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      {/* Main column */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900">Create Bulletin</h1>
          <button
            type="button"
            onClick={() => navigate('/admin/promotions')}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← Back
          </button>
        </div>

        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
          <div className="bg-[#D10000] px-4 py-2.5 text-sm font-bold text-white">
            Bulletin Details
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Bulletin Title" required>
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. May 2026 Promotion"
                  className={inputCls}
                />
              </Field>
              <Field label="Type" required>
                <select
                  value={form.type}
                  onChange={(e) => update('type', e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Select Type --</option>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Message / Details" required>
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                placeholder="Write your bulletin content here…"
                className={`${inputCls} min-h-[120px] resize-y`}
              />
            </Field>
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
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  Optional. Leave blank for non-discount bulletins.
                </p>
              </Field>
            </div>

            <BannerUploader
              dataUrl={form.bannerDataUrl}
              onChange={onBannerChange}
              onClear={() => update('bannerDataUrl', '')}
              error={bannerError}
            />

            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              <button
                type="button"
                disabled={!canPublish}
                onClick={() => save({ asDraft: false })}
                className="rounded-md bg-[#D10000] px-5 py-2 text-sm font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
              >
                Publish Bulletin
              </button>
              <button
                type="button"
                onClick={() => save({ asDraft: true })}
                disabled={!checklist.title}
                className="rounded-md border border-[#D10000] bg-white px-5 py-2 text-sm font-semibold text-[#D10000] hover:bg-rose-50 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/promotions')}
                className="rounded-md border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <SidebarSection title="Live Preview">
          <div className="relative overflow-hidden rounded-md bg-gradient-to-br from-[#e83333] to-[#b30000] p-4 text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/85">
              {(TYPES.find((t) => t.value === form.type)?.label || 'Promotion').toUpperCase()}
            </p>
            <h4 className="mt-2 text-lg font-bold">{form.title || 'Your Title Here'}</h4>
            <p className="mt-1 text-xs text-white/85">
              {visibilityLabel(form.visibility)} ·{' '}
              {form.startDate || 'Date TBD'}
              {form.endDate ? ` – ${form.endDate}` : ''}
            </p>
            {form.percentOff !== '' && Number(form.percentOff) > 0 ? (
              <span className="absolute right-3 top-3 rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-extrabold text-rose-900 shadow-md ring-2 ring-white/50">
                {Number(form.percentOff)}% OFF
              </span>
            ) : null}
          </div>
        </SidebarSection>

        <SidebarSection title="Publishing Checklist">
          <ul className="space-y-2 text-sm">
            <ChecklistRow done={checklist.title} label="Title added" />
            <ChecklistRow done={checklist.type} label="Type selected" />
            <ChecklistRow done={checklist.message} label="Message written" />
            <ChecklistRow done={checklist.startDate} label="Start date set" />
            <ChecklistRow done={checklist.banner} label="Banner image (optional)" optional />
          </ul>
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

function SidebarSection({ title, children }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="bg-[#D10000] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function ChecklistRow({ done, label, optional }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? 'bg-emerald-500 text-white'
            : 'bg-neutral-200 text-neutral-500'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <span className={`text-sm ${done ? 'text-neutral-800' : 'text-neutral-500'}`}>
        {label}
        {optional ? <span className="ml-1 text-xs text-neutral-400">(optional)</span> : null}
      </span>
    </li>
  )
}

function BannerUploader({ dataUrl, onChange, onClear, error }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-neutral-800">
        Attach Banner Image <span className="font-normal italic text-neutral-500">(Optional)</span>
      </span>
      {dataUrl ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <img src={dataUrl} alt="Bulletin banner" className="block max-h-56 w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Replace
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} className="hidden" />
            </label>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center hover:bg-neutral-100">
          <span className="text-2xl text-neutral-400">⬆</span>
          <p className="mt-2 text-sm font-medium text-neutral-700">Click to upload banner image</p>
          <p className="mt-1 text-xs text-neutral-500">
            PNG, JPG, up to 3MB · Recommended: 1200×400px
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onChange}
            className="hidden"
          />
        </label>
      )}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  )
}
