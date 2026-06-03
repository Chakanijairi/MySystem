import { useCallback, useMemo, useState } from 'react'
import { loadActivity } from '../../utils/adminStorage'
import { useAdminSync } from '../../hooks/useAdminSync'

const TYPE_LABEL = {
  system: 'System',
  promotions: 'Promotions',
  users: 'Users',
  documents: 'Documents',
  general: 'General',
}

export default function ActivityLog() {
  const [rows, setRows] = useState(() => loadActivity())
  const [filterType, setFilterType] = useState('all')
  const [query, setQuery] = useState('')
  const refresh = useCallback(() => {
    setRows(loadActivity())
  }, [])

  useAdminSync(refresh)

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterType !== 'all' && r.type !== filterType) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const blob = `${r.action} ${r.detail || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [rows, filterType, query])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">Activity log</h2>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-neutral-50/90 px-4 py-3">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {filtered.length} event{filtered.length === 1 ? '' : 's'}
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action or detail…"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#D10000] focus:outline-none focus:ring-1 focus:ring-[#D10000]"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <ul className="max-h-[min(560px,70vh)] divide-y divide-neutral-100 overflow-y-auto">
          {filtered.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-neutral-900">{r.action}</span>
                <time className="text-xs tabular-nums text-neutral-400">
                  {new Date(r.at).toLocaleString()}
                </time>
              </div>
              {r.detail ? (
                <p className="mt-1 text-neutral-600">{r.detail}</p>
              ) : null}
              <span className="mt-1 inline-block rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-600">
                {TYPE_LABEL[r.type] || r.type}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
