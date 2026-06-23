import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/dashboard', label: 'Home', icon: <HomeIcon />, sub: 'Your household at a glance' },
  { path: '/resilience', label: 'Resilience', icon: <ResIcon />, sub: 'Your Clarity Score' },
  { path: '/events', label: 'Events', icon: <EventIcon />, sub: 'Life event detection' },
  { path: '/goals', label: 'Goals', icon: <GoalIcon />, sub: 'Financial goal tracking' },
  { path: '/accounts', label: 'Accounts', icon: <AcctIcon />, sub: 'Linked accounts' },
]

function HomeIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6.4 8 2l6 4.4V14a.8.8 0 0 1-.8.8H10v-4H6v4H2.8A.8.8 0 0 1 2 14V6.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function ResIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function EventIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function GoalIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function AcctIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.4"/><path d="M4 10.5h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }

export default function Layout() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()

  const initials = customer ? `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` : 'NC'

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#F4F5F7' }}>

      {/* ── LEFT RAIL ── */}
      <aside style={{ width: 232, flexShrink: 0, background: '#0E1C2E', color: '#C4CDD8', display: 'flex', flexDirection: 'column', borderRight: '1px solid #0A1422' }}>
        <div style={{ padding: '22px 20px 18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/assets/nc-mark-white.png" alt="" style={{ height: 28, width: 'auto', display: 'block', flexShrink: 0 }} />
            <img src="/assets/wordmark-white.png" alt="NeoClarity" style={{ height: 18, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#5E7184', letterSpacing: '0.16em', marginTop: 10, paddingLeft: 2 }}>RESILIENCE PLATFORM</div>
        </div>

        <div style={{ padding: '10px 0 6px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#52657A', padding: '8px 20px 8px 24px' }}>WORKSPACE</div>
          {NAV.map(n => (
            <NavLink key={n.path} to={n.path} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px 10px 24px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: isActive ? '#fff' : '#8FA3B8',
              background: isActive ? 'rgba(18,163,155,0.1)' : 'transparent',
              borderLeft: isActive ? '3px solid #12A39B' : '3px solid transparent',
              transition: 'background .12s',
              textDecoration: 'none',
            })}>
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom security badge */}
        <div style={{ marginTop: 'auto', padding: '16px 18px', borderTop: '1px solid #182A3D' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: '#13263A', border: '1px solid #1E374F', borderRadius: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#12A39B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.2 11.5 3v3.4c0 3.1-2.6 5.4-4.5 6.2-1.9-.8-4.5-3.1-4.5-6.2V3L7 1.2Z" stroke="#fff" strokeWidth="1.3"/><path d="M5 7l1.5 1.5L9.2 5.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E6ECF2' }}>Secured · MFA active</div>
              <div style={{ fontSize: 10.5, color: '#6F8197' }}>Consent &amp; audit on</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN COLUMN ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* TOP BAR */}
        <header style={{ height: 64, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E3E6EA', display: 'flex', alignItems: 'center', padding: '0 26px', gap: 18, zIndex: 20 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#14181F', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Home</div>
            <div style={{ fontSize: 12.5, color: '#6B7682', marginTop: 2 }}>Your household at a glance</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', border: '1px solid #E3E6EA', borderRadius: 7, color: '#6B7682', fontSize: 13, minWidth: 190, background: '#FAFBFC' }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#9AA3AD" strokeWidth="1.4"/><path d="m11 11 3 3" stroke="#9AA3AD" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span>Search accounts, goals…</span>
            </div>

            {/* Household pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 10px 0 6px', border: '1px solid #E3E6EA', borderRadius: 8, background: '#fff' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0E1C2E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 }}>{initials}</div>
              <div style={{ lineHeight: 1.15, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#14181F' }}>{customer?.firstName} {customer?.lastName}</div>
                <div style={{ fontSize: 11, color: '#8A929C' }}>Household</div>
              </div>
            </div>

            {/* Bell */}
            <div style={{ width: 36, height: 36, border: '1px solid #E3E6EA', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', background: '#fff' }}>
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M9 2.5c-2.2 0-3.8 1.7-3.8 3.9 0 3.4-1.2 4.4-1.2 4.4h10s-1.2-1-1.2-4.4c0-2.2-1.6-3.9-3.8-3.9Z" stroke="#5A6470" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7.6 14a1.6 1.6 0 0 0 2.8 0" stroke="#5A6470" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <div style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#C77700', border: '1.5px solid #fff' }}></div>
            </div>

            <button onClick={() => { logout(); navigate('/login') }} style={{ fontSize: 12, color: '#8A929C', padding: '6px 12px', border: '1px solid #E3E6EA', borderRadius: 6, background: '#fff' }}>Sign out</button>
          </div>
        </header>

        {/* SCROLL AREA */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 26 }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
