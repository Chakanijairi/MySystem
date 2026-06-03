import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import MemberPortal from './pages/MemberPortal'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboardHome from './pages/admin/AdminDashboardHome'
import UserManagement from './pages/admin/UserManagement'
import MemberDetailPage from './pages/admin/MemberDetailPage'
import SystemSettings from './pages/admin/SystemSettings'
import ActivityLog from './pages/admin/ActivityLog'
import OrdersPage from './pages/admin/OrdersPage'
import OrderDetailPage from './pages/admin/OrderDetailPage'
import SalesMemberDetailPage from './pages/admin/SalesMemberDetailPage'
import PromotionsPage from './pages/admin/PromotionsPage'
import PromotionCreatePage from './pages/admin/PromotionCreatePage'
import PromotionEditPage from './pages/admin/PromotionEditPage'
import PromotionViewPage from './pages/admin/PromotionViewPage'

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading…
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/member" replace />
  }
  if (!adminOnly && user.role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/member" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/member"
        element={
          <Protected>
            <MemberPortal />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected adminOnly>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminDashboardHome />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="users/:userId" element={<MemberDetailPage />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="sales/members/:rowId" element={<SalesMemberDetailPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="promotions/new" element={<PromotionCreatePage />} />
        <Route path="promotions/:id" element={<PromotionViewPage />} />
        <Route path="promotions/:id/edit" element={<PromotionEditPage />} />
        <Route path="activity" element={<ActivityLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
