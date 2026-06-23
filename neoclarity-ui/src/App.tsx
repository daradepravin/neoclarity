import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import MfaVerify from './pages/MfaVerify'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Goals from './pages/Goals'
import LifeEvents from './pages/LifeEvents'
import Recommendations from './pages/Recommendations'
import Profile from './pages/Profile'
import Resilience from './pages/Resilience'
import Accounts from './pages/Accounts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#9AA3AD', fontSize: 14 }}>Loading NeoClarity…</div>
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/mfa" element={<MfaVerify />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="resilience" element={<Resilience />} />
            <Route path="events" element={<LifeEvents />} />
            <Route path="goals" element={<Goals />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
