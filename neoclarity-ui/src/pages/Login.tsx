import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, MfaRequiredResponse } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('demo@neoclarity.app')
  const [password, setPassword] = useState('Password123!')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await authApi.login(email, password)
      const data = res.data
      if ('mfaRequired' in data) {
        const mfa = data as MfaRequiredResponse
        sessionStorage.setItem('mfa_token', mfa.mfaToken)
        sessionStorage.setItem('mfa_hint', mfa.demoHint)
        navigate('/mfa')
      } else {
        login(data.token, data.customer)
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>

      {/* LEFT — brand panel */}
      <div style={{ flex: 1.15, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#13283F 0%,#0B1726 100%)', color: '#fff', display: 'flex', flexDirection: 'column', padding: '46px 52px' }}>
        <img src="/assets/nc-mark-white.png" alt="" style={{ position: 'absolute', right: -90, bottom: -70, width: 520, opacity: 0.10, pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/assets/nc-mark-white.png" alt="" style={{ height: 32, width: 'auto', display: 'block' }} />
            <img src="/assets/wordmark-white.png" alt="NeoClarity" style={{ height: 23, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#5E7184', letterSpacing: '0.16em', marginTop: 11 }}>RESILIENCE PLATFORM</div>
        </div>

        <div style={{ margin: 'auto 0', position: 'relative', maxWidth: 480 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(18,163,155,.14)', border: '1px solid rgba(18,163,155,.34)', padding: '6px 13px', borderRadius: 20, marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1FCab8' }}></div>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: '#7FE0D6' }}>AI FINANCIAL RESILIENCE</span>
          </div>
          <h1 style={{ margin: '0 0 18px', fontSize: 38, lineHeight: 1.16, fontWeight: 700, letterSpacing: '-0.025em' }}>Financial clarity.<br />Trusted action.<br />Stronger resilience.</h1>
          <p style={{ margin: '0 0 34px', fontSize: 16, lineHeight: 1.6, color: '#A9BACB', maxWidth: 430 }}>Your finances, turned into one trusted next move — explained, evidenced, and always yours to approve.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {[
              { icon: '🛡️', text: 'Every recommendation is explainable and evidence-backed' },
              { icon: '🔒', text: 'Human-in-the-loop — you approve before anything changes' },
              { icon: '📊', text: 'Household Digital Twin built from your real financial data' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(18,163,155,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                <span style={{ fontSize: 14.5, color: '#CBD6E2' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, color: '#566B80', fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.2 11.5 3v3.4c0 3.1-2.6 5.4-4.5 6.2-1.9-.8-4.5-3.1-4.5-6.2V3L7 1.2Z" stroke="#566B80" strokeWidth="1.2"/></svg>
          Bank-grade encryption · SOC 2 · consent-based Open Banking
        </div>
      </div>

      {/* RIGHT — sign-in form */}
      <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 372 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 30 }}>
            <img src="/assets/nc-mark-black.png" alt="" style={{ height: 40, width: 'auto' }} />
            <img src="/assets/wordmark.png" alt="NeoClarity" style={{ height: 31, width: 'auto' }} />
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center' }}>Sign in to your household</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6B7682', textAlign: 'center' }}>Welcome back. Let's see your next best move.</p>

          {/* Demo hint */}
          <div style={{ background: '#E4F3F1', border: '1px solid rgba(18,163,155,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#0E7C77' }}>
            <strong>Demo credentials</strong> — email pre-filled, password is Password123!
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#C0392B', marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#C0392B" strokeWidth="1.2"/><path d="M7 4v3.4M7 9.4v.2" stroke="#C0392B" strokeWidth="1.4" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#3D454E', display: 'block', marginBottom: 7 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@email.com" required
              style={{ width: '100%', height: 46, padding: '0 14px', fontSize: 14.5, color: '#14181F', border: '1px solid #DCE0E5', borderRadius: 9, outline: 'none', marginBottom: 18, background: '#fff' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#3D454E' }}>Password</label>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#12867F', cursor: 'pointer' }}>Forgot?</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Enter your password" required
                style={{ width: '100%', height: 46, padding: '0 50px 0 14px', fontSize: 14.5, color: '#14181F', border: '1px solid #DCE0E5', borderRadius: 9, outline: 'none', background: '#fff' }} />
              <button type="button" onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 12, top: 13, fontSize: 11.5, fontWeight: 700, color: '#9AA3AD', letterSpacing: '0.02em' }}>
                {showPw ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', height: 48, background: '#12A39B', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 18px -6px rgba(18,163,155,.6)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in…' : <>Continue <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h9M9 5l3 3-3 3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#8A929C', marginTop: 26 }}>
            New to NeoClarity? <Link to="/register" style={{ color: '#12867F', fontWeight: 700 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
