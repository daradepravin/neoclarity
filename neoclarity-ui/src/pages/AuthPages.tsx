import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { C, Btn } from '../components/ui';
import type { MfaRequiredResponse } from '../types';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('demo@neoclarity.app');
  const [password, setPassword] = useState('Password123!');
  const [mfaState, setMfaState] = useState<MfaRequiredResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(''); setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      if ('mfaRequired' in result) {
        // MFA challenge — show MFA step
        setMfaState(result as MfaRequiredResponse);
        setMfaCode('123456'); // pre-fill demo hint
      } else {
        login(result.token, result.customer);
        navigate('/');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async () => {
    if (!mfaState) return;
    setError(''); setLoading(true);
    try {
      const result = await authApi.verifyMfa({ mfaToken: mfaState.mfaToken, code: mfaCode });
      login(result.token, result.customer);
      navigate('/');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.white, borderRadius: 16,
        border: `1px solid ${C.gray200}`,
        padding: '2.5rem', width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent} 0%, ${C.teal} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: C.white,
          }}>N</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.gray800 }}>
              Neo<span style={{ color: C.accent }}>Clarity</span>
            </div>
            <div style={{ fontSize: 11, color: C.gray400 }}>Financial Resilience Platform</div>
          </div>
        </div>

        {!mfaState ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, marginBottom: 6 }}>Sign in</h2>
            <p style={{ fontSize: 13, color: C.gray400, marginBottom: 24 }}>
              Demo: demo@neoclarity.app / Password123!
            </p>

            <label style={labelStyle}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} type="email" placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />

            <label style={labelStyle}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} type="password" placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />

            {error && <div style={errorStyle}>{error}</div>}

            <Btn label={loading ? 'Signing in…' : 'Sign in'} onClick={handleLogin} disabled={loading} />

            <p style={{ fontSize: 13, color: C.gray400, marginTop: 20, textAlign: 'center' }}>
              Don't have an account? <Link to="/register" style={{ color: C.accent }}>Create one</Link>
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, marginBottom: 6 }}>
              Two-factor authentication
            </h2>
            <div style={{
              background: C.lightBg, borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: C.accent, marginBottom: 20,
            }}>
              💡 {mfaState.demoHint}
            </div>

            <label style={labelStyle}>Enter 6-digit code</label>
            <input value={mfaCode} onChange={e => setMfaCode(e.target.value)}
              style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
              maxLength={6} placeholder="______"
              onKeyDown={e => e.key === 'Enter' && handleMfa()} />

            {error && <div style={errorStyle}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn label={loading ? 'Verifying…' : 'Verify'} onClick={handleMfa} disabled={loading} />
              <Btn label="Back" variant="ghost" onClick={() => setMfaState(null)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleRegister = async () => {
    setError(''); setLoading(true);
    try {
      const result = await authApi.register(form);
      login(result.token, result.customer);
      navigate('/');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.gray50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.white, borderRadius: 16, border: `1px solid ${C.gray200}`,
        padding: '2.5rem', width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, marginBottom: 24 }}>
          Create your account
        </h2>

        {[
          { label: 'First name', key: 'firstName', type: 'text' },
          { label: 'Last name',  key: 'lastName',  type: 'text' },
          { label: 'Email',      key: 'email',     type: 'email' },
          { label: 'Password',   key: 'password',  type: 'password' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input value={form[key as keyof typeof form]}
              onChange={set(key as keyof typeof form)}
              style={inputStyle} type={type} />
          </div>
        ))}

        {error && <div style={errorStyle}>{error}</div>}

        <Btn label={loading ? 'Creating account…' : 'Create account'} onClick={handleRegister} disabled={loading} />

        <p style={{ fontSize: 13, color: C.gray400, marginTop: 20, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: C.accent }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6, marginTop: 16,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #E5E7EB', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', marginBottom: 4,
};

const errorStyle: React.CSSProperties = {
  background: '#FEF2F2', color: '#991B1B',
  borderRadius: 8, padding: '10px 14px',
  fontSize: 13, marginTop: 12, marginBottom: 8,
};
