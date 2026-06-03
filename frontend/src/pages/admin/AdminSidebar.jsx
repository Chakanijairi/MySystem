import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const nav = [
  { to: '/admin', end: true, label: 'Home' },
  { to: '/admin/users', label: 'Members' },
  { to: '/admin/orders', label: 'Sales' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/settings', label: 'System Settings' },
]

function UserAvatarIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function LogoutIcon() {
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
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function AdminSidebar({ onLogout }) {
  const { user } = useAuth()
  const name = user?.full_name?.trim() || 'Admin user'

  return (
    <aside
      className="admin-sidebar flex min-h-screen w-[220px] shrink-0 flex-col bg-[#D10000] text-white"
      aria-label="Admin navigation"
    >
      {/* Profile header */}
      <div className="flex flex-col items-center gap-2 px-3 pt-6 pb-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#D10000] shadow-sm">
          <UserAvatarIcon />
        </div>
        <div className="text-center">
          <p className="truncate text-sm font-bold leading-tight text-white">{name}</p>
          <p className="mt-0.5 text-xs font-normal text-white/90">Admin</p>
        </div>
      </div>

      {/* Log out button (replaces hamburger) */}
      <div className="mb-3 flex justify-center">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/20"
        >
          <LogoutIcon />
          Log out
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/95 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
