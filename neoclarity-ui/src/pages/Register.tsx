import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await authApi.register(form.email, form.password, form.firstName, form.lastName)
      login(res.data.token, res.data.customer)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A2342', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem', width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0A2342' }}>Create Account</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Neo<span style={{ color: '#0F6E56' }}>Clarity</span></div>
        </div>
        {error && <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(['firstName','lastName','email','password'] as const).map(field => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                {field === 'firstName' ? 'First Name' : field === 'lastName' ? 'Last Name' : field === 'email' ? 'Email' : 'Password'}
              </label>
              <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} required
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ background: '#1A6EBD', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748B' }}>
          Already have an account? <Link to="/login" style={{ color: '#1A6EBD', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
