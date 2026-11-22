import './App.css'
import './styles/dashboard.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './context/AuthContext'
import { AppPreferencesProvider } from './context/AppPreferences'
import './styles/preferences.css'
import { useAuth } from './context/useAuth'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage').then((m) => ({ default: m.VerifyOtpPage })))
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard').then((m) => ({ default: m.CitizenDashboard })))
const CitizenProfilePage = lazy(() => import('./pages/CitizenProfilePage').then((m) => ({ default: m.CitizenProfilePage })))
const BookingPage = lazy(() => import('./pages/BookingPage').then((m) => ({ default: m.BookingPage })))
const QueueTrackingPage = lazy(() => import('./pages/QueueTrackingPage').then((m) => ({ default: m.QueueTrackingPage })))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const PublicStatisticsPage = lazy(() => import('./pages/PublicStatisticsPage').then((m) => ({ default: m.PublicStatisticsPage })))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminWalkInRegistrationPage = lazy(() => import('./pages/AdminWalkInRegistrationPage').then((m) => ({ default: m.AdminWalkInRegistrationPage })))
const AdminQueueManagementPage = lazy(() => import('./pages/AdminQueueManagementPage').then((m) => ({ default: m.AdminQueueManagementPage })))
const AdminCounterManagementPage = lazy(() => import('./pages/AdminCounterManagementPage').then((m) => ({ default: m.AdminCounterManagementPage })))
const AdminAiInsightsPage = lazy(() => import('./pages/AdminAiInsightsPage').then((m) => ({ default: m.AdminAiInsightsPage })))
const AdminTokenManagementPage = lazy(() => import('./pages/AdminTokenManagementPage').then((m) => ({ default: m.AdminTokenManagementPage })))
const AdminAppointmentsPage = lazy(() => import('./pages/AdminAppointmentsPage').then((m) => ({ default: m.AdminAppointmentsPage })))
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })))
const QueueDisplayPage = lazy(() => import('./pages/QueueDisplayPage').then((m) => ({ default: m.QueueDisplayPage })))

function App() {
  return (
    <BrowserRouter>
      <AppPreferencesProvider>
      <AuthProvider><Suspense fallback={<main className="auth-page" role="status">Loading page…</main>}><Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/citizen/dashboard" element={<RequireRole role="citizen"><CitizenDashboard /></RequireRole>} />
        <Route path="/citizen/book-token" element={<RequireRole role="citizen"><BookingPage /></RequireRole>} />
        <Route path="/citizen/appointments" element={<RequireRole role="citizen"><AppointmentsPage /></RequireRole>} />
        <Route path="/citizen/documents" element={<RequireRole role="citizen"><DocumentsPage /></RequireRole>} />
        <Route path="/citizen/profile" element={<RequireRole role="citizen"><CitizenProfilePage /></RequireRole>} />
        <Route path="/citizen/queue/:tokenId" element={<RequireRole role="citizen"><QueueTrackingPage /></RequireRole>} />
        <Route path="/public-statistics" element={<PublicStatisticsPage />} />
        <Route path="/admin/queue-display" element={<QueueDisplayPage />} />
        <Route path="/admin/dashboard" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/walk-in-registration" element={<RequireRole role="admin"><AdminWalkInRegistrationPage /></RequireRole>} />
        <Route path="/admin/queue-management" element={<RequireRole role="admin"><AdminQueueManagementPage /></RequireRole>} />
        <Route path="/admin/token-management" element={<RequireRole role="admin"><AdminTokenManagementPage /></RequireRole>} />
        <Route path="/admin/appointments" element={<RequireRole role="admin"><AdminAppointmentsPage /></RequireRole>} />
        <Route path="/admin/counter-management" element={<RequireRole role="admin"><AdminCounterManagementPage /></RequireRole>} />
        <Route path="/admin/ai-insights" element={<RequireRole role="admin"><AdminAiInsightsPage /></RequireRole>} />
        <Route path="/admin/reports" element={<RequireRole role="admin"><AdminReportsPage /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole role="admin"><AdminSettingsPage /></RequireRole>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></Suspense></AuthProvider>
      </AppPreferencesProvider>
    </BrowserRouter>
  )
}

function RequireRole({ role, children }: { role: 'citizen' | 'admin'; children: ReactNode }) {
  const { user, loading } = useAuth(); const location = useLocation()
  if (loading) return <main className="auth-page" role="status">Restoring your secure session…</main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/citizen/dashboard'} replace />
  return children
}

export default App
