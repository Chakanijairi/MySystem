import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import DealerPortal from './pages/DealerPortal'
import AdminPortal from './pages/AdminPortal'

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
    return <Navigate to="/dealer" replace />
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
  return <Navigate to="/dealer" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dealer"
        element={
          <Protected>
            <DealerPortal />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected adminOnly>
            <AdminPortal />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
