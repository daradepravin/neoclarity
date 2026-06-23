import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { C } from './ui';

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/' },
  { label: 'Goals',           path: '/goals' },
  { label: 'Life Events',     path: '/events' },
  { label: 'Recommendations', path: '/recommendations' },
  { label: 'Profile',         path: '/profile' },
];

export function Nav({ pendingRecs }: { pendingRecs: number }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { customer, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: C.navy,
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      borderBottom: `3px solid ${C.accent}`,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, cursor: 'pointer' }}
           onClick={() => navigate('/')}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${C.accent} 0%, ${C.teal} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: C.white,
        }}>N</div>
        <div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 15, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            Neo<span style={{ color: '#5EE6C5' }}>Clarity</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Financial Resilience Platform
          </div>
        </div>
      </div>

      {/* Nav links */}
      {NAV_ITEMS.map(({ label, path }) => {
        const active = pathname === path;
        return (
          <button key={path} onClick={() => navigate(path)} style={{
            background: 'transparent', border: 'none',
            color: active ? C.white : 'rgba(255,255,255,0.55)',
            fontWeight: active ? 700 : 400,
            fontSize: 13, padding: '14px 14px',
            cursor: 'pointer',
            borderBottom: active ? `3px solid ${C.accent}` : '3px solid transparent',
            marginBottom: -3,
            position: 'relative',
            whiteSpace: 'nowrap',
          }}>
            {label}
            {label === 'Recommendations' && pendingRecs > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: 2,
                background: '#EF4444', color: C.white,
                borderRadius: 99, fontSize: 9, fontWeight: 700,
                padding: '1px 5px',
              }}>{pendingRecs}</span>
            )}
          </button>
        );
      })}

      {/* Spacer + user */}
      <div style={{ flex: 1 }} />
      {customer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {customer.firstName} {customer.lastName}
          </span>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: `1px solid rgba(255,255,255,0.2)`,
            color: 'rgba(255,255,255,0.6)', borderRadius: 6,
            padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }}>Sign out</button>
        </div>
      )}
    </nav>
  );
}
