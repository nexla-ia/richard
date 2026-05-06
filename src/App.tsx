import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import DashboardLayout from '@/pages/dashboard/DashboardLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import GestoesPage from '@/pages/dashboard/GestoesPage'
import CobrancasPage from '@/pages/dashboard/CobrancasPage'
import ConfiguracoesPage from '@/pages/dashboard/ConfiguracoesPage'
import ProfilePage from '@/pages/ProfilePage'
import AdminPage from '@/pages/admin/AdminPage'
import SharePage from '@/pages/SharePage'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }}
      />
    </div>
  )
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AdminRoute() {
  const { user, role, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

function LoginGuard() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/s/:token" element={<SharePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/gestoes" element={<GestoesPage />} />
              <Route path="/dashboard/cobrancas" element={<CobrancasPage />} />
              <Route path="/dashboard/configuracoes" element={<ConfiguracoesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route element={<AdminRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
