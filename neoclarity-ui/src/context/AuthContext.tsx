import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, CustomerSummary } from '../api/client'

interface AuthState {
  customer: CustomerSummary | null
  token: string | null
  loading: boolean
  login: (token: string, customer: CustomerSummary) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('nc_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authApi.me()
        .then(r => setCustomer(r.data))
        .catch(() => { localStorage.removeItem('nc_token'); setToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = (tok: string, cust: CustomerSummary) => {
    localStorage.setItem('nc_token', tok)
    setToken(tok)
    setCustomer(cust)
  }

  const logout = () => {
    localStorage.removeItem('nc_token')
    setToken(null)
    setCustomer(null)
  }

  return (
    <AuthContext.Provider value={{ customer, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
