import { useState, useRef, FormEvent, KeyboardEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function MfaVerify() {
  const mfaToken = sessionStorage.getItem('mfa_token') || ''
  const demoHint = sessionStorage.getItem('mfa_hint') || ''
  const [digits, setDigits] = useState(['1','2','3','4','5','6'])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))
  const { login } = useAuth()
  const navigate = useNavigate()

  if (!mfaToken) { navigate('/login'); return null }

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(-1)
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next)
    if (val && i < 5) refs[i + 1].current?.focus()
  }

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    const code = digits.join('')
    try {
      const res = await authApi.verifyMfa(mfaToken, code)
      sessionStorage.removeItem('mfa_token'); sessionStorage.removeItem('mfa_hint')
      login(res.data.token, res.data.customer)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code — please try again')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: '#E4F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="6" y="11" width="14" height="10.5" rx="2.5" stroke="#0E7C77" strokeWidth="1.7"/><path d="M9 11V8.2a4 4 0 0 1 8 0V11" stroke="#0E7C77" strokeWidth="1.7"/><circle cx="13" cy="16" r="1.5" fill="#0E7C77"/></svg>
          </div>
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center' }}>Two-factor verification</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6B7682', textAlign: 'center', lineHeight: 1.5 }}>Enter the 6-digit code from your authenticator app</p>

        {demoHint && (
          <div style={{ background: '#E4F3F1', border: '1px solid rgba(18,163,155,.3)', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: 12.5, color: '#0E7C77', textAlign: 'center' }}>
            🔑 {demoHint}
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, color: '#C0392B', marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#C0392B" strokeWidth="1.2"/><path d="M7 4v3.4M7 9.4v.2" stroke="#C0392B" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginBottom: 24 }}>
            {digits.map((d, i) => (
              <input key={i} ref={refs[i]} value={d} onChange={e => handleChange(i, e)} onKeyDown={e => handleKey(i, e)}
                inputMode="numeric" maxLength={1}
                style={{ width: 46, height: 56, textAlign: 'center', fontSize: 24, fontWeight: 700, color: '#14181F', border: '1.5px solid #DCE0E5', borderRadius: 10, outline: 'none', background: '#fff' }} />
            ))}
          </div>

          <button type="submit" disabled={loading || digits.join('').length < 6}
            style={{ width: '100%', height: 48, background: '#12A39B', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px rgba(18,163,155,.6)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Verifying…' : 'Verify & sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 20 }}>
          <button onClick={() => navigate('/login')} style={{ fontSize: 13, fontWeight: 600, color: '#6B7682' }}>← Back</button>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#CDD2D8', display: 'block' }}></span>
          <button style={{ fontSize: 13, fontWeight: 600, color: '#12867F' }}>Resend code</button>
        </div>
      </div>
    </div>
  )
}
