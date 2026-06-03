import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { loadActivity, loadPromotions, loadSettings } from '../../utils/adminStorage'
import { useAdminSync } from '../../hooks/useAdminSync'

const PROMOTION_THRESHOLD = 5

export default function AdminDashboardHome() {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedTick, setFeedTick] = useState(0)
  const [candidates, setCandidates] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(true)

  const loadStats = useCallback(() => {
    setLoading(true)
    api('/admin/stats')
      .then(setStats)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const loadCandidates = useCallback(() => {
    setCandidatesLoading(true)
    api(`/admin/promotion-candidates?threshold=${PROMOTION_THRESHOLD}`)
      .then((d) => setCandidates(d?.candidates || []))
      .catch(() => {/* non-fatal; banner just hides */})
      .finally(() => setCandidatesLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadCandidates() }, [loadCandidates])

  useEffect(() => {
    const id = window.setInterval(() => {
      loadStats()
      loadCandidates()
    }, 45_000)
    return () => window.clearInterval(id)
  }, [loadStats, loadCandidates])

  const refreshFeed = useCallback(() => setFeedTick((t) => t + 1), [])
  useAdminSync(refreshFeed)

  const recentActivity = useMemo(() => loadActivity().slice(0, 6), [feedTick])
  const recentPromos = useMemo(() => {
    return loadPromotions()
      .filter((p) => p.published)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 4)
  }, [feedTick])
  const settings = useMemo(() => loadSettings(), [feedTick])
  const showActivityFeed = settings.showRecentActivityFeed !== false

  const overviewRows = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, note: 'All registered accounts' },
    { label: 'Total Sales', value: stats?.totalSales ?? 0, note: 'All time' },
    { label: 'Active Accounts', value: stats?.activeAccounts ?? 0, note: 'Currently active' },
    {
      label: 'Inactive Accounts',
      value: stats?.suspendedAccounts ?? 0,
      note: 'Suspended or inactive',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-neutral-900">Account Overview</h2>
        <button
          type="button"
          onClick={() => { loadStats(); loadCandidates() }}
          disabled={loading}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh stats'}
        </button>
      </div>

      {/* Promotion eligibility notification */}
      {!candidatesLoading && candidates.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12 2 4 5v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V5l-8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {candidates.length} member{candidates.length === 1 ? '' : 's'} eligible for promotion
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                The following recruiters have more than {PROMOTION_THRESHOLD} members in their team.
              </p>
              <ul className="mt-3 space-y-2">
                {candidates.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-amber-200"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {c.full_name || c.email}
                      </p>
                      <p className="text-xs text-neutral-600">
                        <span className="capitalize">{c.role}</span> · {c.team_count} team member
                        {c.team_count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Link
                      to={`/admin/users/${c.id}`}
                      className="rounded-md bg-[#D10000] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b30000]"
                    >
                      Review &amp; promote
                    </Link>
                  </li>
                ))}
              </ul>
              {candidates.length > 5 ? (
                <p className="mt-2 text-xs text-amber-800">
                  + {candidates.length - 5} more eligible member
                  {candidates.length - 5 === 1 ? '' : 's'} — open the Members page to see all.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Account summary table */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-[#D10000] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">Account Summary</h3>
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
              {overviewRows.map((row, idx) => (
                <OverviewRow
                  key={row.label}
                  label={row.label}
                  value={loading ? '…' : row.value}
                  note={row.note}
                  last={idx === overviewRows.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent activity (controlled by System Settings → Notifications) */}
      {showActivityFeed ? (
        <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Recent activity</h3>
            <Link
              to="/admin/activity"
              className="text-xs font-medium text-[#D10000] hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-neutral-100">
            {recentActivity.length === 0 ? (
              <li className="py-3 text-sm text-neutral-500">No activity yet.</li>
            ) : null}
            {recentActivity.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <p className="font-medium text-neutral-800">{r.action}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {new Date(r.at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white px-5 py-4 text-xs text-neutral-500">
          Recent activity feed is hidden — re-enable it under{' '}
          <Link to="/admin/settings" className="font-medium text-[#D10000] hover:underline">
            System Settings → Notifications
          </Link>
          .
        </div>
      )}

      {/* Latest member notices */}
      <div className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Latest member notices</h3>
          <Link
            to="/admin/promotions"
            className="text-xs font-medium text-[#D10000] hover:underline"
          >
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-neutral-100">
          {recentPromos.length === 0 ? (
            <li className="py-6 text-center text-sm text-neutral-500">
              No published bulletins yet. Go to promotions to create one.
            </li>
          ) : null}
          {recentPromos.map((p) => (
            <li key={p.id} className="py-3">
              <p className="text-sm font-medium text-neutral-800">{p.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{p.message}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function OverviewRow({ label, value, note, last }) {
  return (
    <tr className={last ? '' : 'border-b border-neutral-100'}>
      <td className="px-4 py-3 font-medium text-neutral-800">{label}</td>
      <td className="px-4 py-3 font-bold tabular-nums text-neutral-900">{value}</td>
      <td className="px-4 py-3 text-neutral-600">{note || '—'}</td>
    </tr>
  )
}
