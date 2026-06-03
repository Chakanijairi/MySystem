import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { loadActivity, loadSettings } from '../../utils/adminStorage'
import { useAdminSync } from '../../hooks/useAdminSync'

const PROMOTION_THRESHOLD = 5

/**
 * Thin top bar: light gray background, centered script brand title.
 * A notification bell is rendered on the right when the
 * "Show Notification Bell" setting in System Settings → Notifications is on.
 */
export default function AdminTopBar() {
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [promotionCandidates, setPromotionCandidates] = useState([])
  const popRef = useRef(null)

  useAdminSync(() => setTick((t) => t + 1))

  const settings = useMemo(() => loadSettings(), [tick])
  const activity = useMemo(() => loadActivity().slice(0, 6), [tick])
  const showBell = settings.showNotificationBell !== false
  const activityCount = Math.min(99, activity.length)
  const mailCount = Math.min(99, promotionCandidates.length)

  useEffect(() => {
    let cancelled = false
    async function loadPromotionNotifications() {
      try {
        const data = await api(
          `/admin/promotion-candidates?threshold=${PROMOTION_THRESHOLD}`
        )
        if (!cancelled) setPromotionCandidates(data?.candidates || [])
      } catch {
        if (!cancelled) setPromotionCandidates([])
      }
    }

    loadPromotionNotifications()
    const id = window.setInterval(loadPromotionNotifications, 45_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (!open && !mailOpen) return undefined
    function onDocClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false)
        setMailOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, mailOpen])

  return (
    <header className="admin-topbar relative flex h-14 shrink-0 items-center justify-center border-b border-neutral-300/80 bg-[#E0E0E0] px-4">
      <h1 className="admin-brand-script m-0 text-center text-3xl leading-none text-[#D10000] sm:text-4xl">
        Personal Collection
      </h1>

      {showBell ? (
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2" ref={popRef}>
          <button
            type="button"
            onClick={() => {
              setMailOpen((o) => !o)
              setOpen(false)
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700 shadow-sm hover:bg-amber-50"
            aria-label="Promotion recommendation mail"
          >
            <MailIcon />
            {mailCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D10000] px-1 text-[10px] font-bold text-white">
                {mailCount > 9 ? '9+' : mailCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o)
              setMailOpen(false)
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"
            aria-label="Notifications"
          >
            <span aria-hidden className="text-base">
              🔔
            </span>
            {activityCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D10000] px-1 text-[10px] font-bold text-white">
                {activityCount > 9 ? '9+' : activityCount}
              </span>
            ) : null}
          </button>

          {mailOpen ? (
            <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-md border border-amber-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-500 px-3 py-2 text-xs font-semibold text-white">
                <span>Promotion mail</span>
                <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-medium ring-1 ring-white/30">
                  {mailCount} alert{mailCount === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="max-h-80 divide-y divide-amber-100 overflow-y-auto">
                {promotionCandidates.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-neutral-500">
                    No promotion recommendations yet.
                  </li>
                ) : null}

                {promotionCandidates.map((member) => (
                  <li key={`mail-promotion-${member.id}`} className="bg-amber-50 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-amber-200"
                        aria-hidden
                      >
                        <MailIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-950">
                          Promotion recommendation
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-900">
                          {member.full_name || member.email} has {member.team_count}{' '}
                          team member{member.team_count === 1 ? '' : 's'}. Review if this member
                          should be promoted or recommended.
                        </p>
                        <Link
                          to={`/admin/users/${member.id}`}
                          onClick={() => setMailOpen(false)}
                          className="mt-1 inline-flex rounded bg-[#D10000] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#b30000]"
                        >
                          Review member
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {open ? (
            <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-neutral-100 bg-[#D10000] px-3 py-2 text-xs font-semibold text-white">
                <span>Recent activity</span>
                <Link
                  to="/admin/activity"
                  onClick={() => setOpen(false)}
                  className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-medium ring-1 ring-white/30 hover:bg-white/25"
                >
                  View all
                </Link>
              </div>
              <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
                {activity.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-neutral-500">
                    No notifications yet.
                  </li>
                ) : null}

                {activity.map((r) => (
                  <li key={r.id} className="px-3 py-2">
                    <p className="text-xs font-semibold text-neutral-900">{r.action}</p>
                    {r.detail ? (
                      <p className="mt-0.5 text-[11px] text-neutral-600">{r.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {new Date(r.at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7" />
    </svg>
  )
}
