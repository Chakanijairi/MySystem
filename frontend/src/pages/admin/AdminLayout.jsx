import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSidebar from './AdminSidebar'
import AdminTopBar from './AdminTopBar'

export default function AdminLayout() {
  const { logout } = useAuth()

  return (
    <div className="admin-shell flex min-h-screen bg-[#F5F5F5] text-neutral-800">
      <div className="print:hidden">
        <AdminSidebar onLogout={logout} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <AdminTopBar />
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
