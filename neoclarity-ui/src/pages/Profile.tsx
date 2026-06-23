import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountsApi, authApi, consentApi, Account } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Card from '../components/Card'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import Spinner from '../components/Spinner'

const CONTEXT_OPTIONS = [
  { label: 'Parent', icon: '👨‍👩‍👧' }, { label: 'Homeowner', icon: '🏠' },
  { label: 'Married', icon: '💍' }, { label: 'Self-Employed', icon: '💼' },
  { label: 'Caregiver', icon: '❤️' }
]

export default function Profile() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [consent, setConsent] = useState(customer?.consentActive || false)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    accountsApi.getAll().then(r => setAccounts(r.data)).finally(() => setLoading(false))
  }, [])

  const toggleConsent = async () => {
    const newVal = !consent
    setConsent(newVal)
    try { await authApi.updateConsent(newVal) } catch { setConsent(!newVal) }
  }

  const handleDeleteData = async () => {
    setDeleting(true)
    try {
      await consentApi.deleteMyData()
      // Data wiped — send the user back to a clean dashboard
      navigate('/dashboard')
    } catch {
      setDeleting(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Account</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#1A6EBD,#0F6E56)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>
              {customer?.firstName?.[0]}{customer?.lastName?.[0]}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#14181F' }}>{customer?.firstName} {customer?.lastName}</div>
              <div style={{ fontSize: 13, color: '#6B7682' }}>{customer?.email}</div>
            </div>
          </div>
          <Btn label="Sign Out" variant="ghost" small onClick={logout} />
        </Card>

        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>My Context</div>
          <div style={{ fontSize: 12, color: '#6B7682', marginBottom: 12 }}>Confirmed context improves coaching relevance.</div>
          {CONTEXT_OPTIONS.map(({ label, icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{icon}</span>
                <span style={{ fontSize: 13, color: '#14181F' }}>{label}</span>
              </div>
              <Badge label="Add" color="#1A6EBD" bg="#EBF3FB" />
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Connected Accounts</div>
          {accounts.map(a => (
            <div key={a.accountId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 20 }}>{a.accountType === 'CHECKING' ? '🏦' : a.accountType === 'SAVINGS' ? '💰' : '💳'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#14181F' }}>{a.institution} {a.accountType}</div>
                <div style={{ fontSize: 11, color: '#9AA3AD' }}>Last updated {new Date(a.lastRefreshedAt).toLocaleDateString()}</div>
              </div>
              <Badge label={a.active ? 'Connected' : 'Inactive'} color={a.active ? '#1F8A5A' : '#9AA3AD'} bg={a.active ? '#E7F3EC' : '#EEF0F3'} />
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Btn label="+ Link another account" variant="secondary" small />
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Consent Management</div>
          <div style={{ fontSize: 13, color: '#6B7682', marginBottom: 16, lineHeight: 1.6 }}>
            You have {consent ? 'granted' : 'revoked'} consent for NeoClarity to access your linked accounts for financial coaching purposes.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 13, color: '#14181F' }}>Data processing</span>
            <Badge label={consent ? 'Active' : 'Revoked'} color={consent ? '#1F8A5A' : '#C0392B'} bg={consent ? '#E7F3EC' : '#FEE2E2'} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn label={consent ? 'Revoke Consent' : 'Grant Consent'} variant={consent ? 'danger' : 'success'} small onClick={toggleConsent} />
          </div>
        </Card>

        {/* Danger zone — Delete My Data (FR-2.4) */}
        <Card style={{ border: '1px solid #F0D5D0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Danger Zone</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#14181F', marginBottom: 4 }}>Delete my data</div>
          <div style={{ fontSize: 13, color: '#6B7682', marginBottom: 16, lineHeight: 1.6 }}>
            Permanently removes all your accounts, transactions, goals, scores, events, and recommendations. This cannot be undone. Your login is kept so you can start fresh.
          </div>
          {!showDelete ? (
            <Btn label="Delete my data" variant="danger" small onClick={() => setShowDelete(true)} />
          ) : (
            <div style={{ background: '#FBF4F2', border: '1px solid #F0D5D0', borderRadius: 9, padding: '14px' }}>
              <div style={{ fontSize: 13, color: '#5A6470', marginBottom: 10 }}>
                Type <strong style={{ color: '#C0392B' }}>DELETE</strong> to confirm.
              </div>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                style={{ width: '100%', height: 40, padding: '0 12px', fontSize: 14, border: '1px solid #DCE0E5', borderRadius: 8, outline: 'none', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDeleteData} disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 700, color: '#fff', background: deleteConfirm === 'DELETE' && !deleting ? '#C0392B' : '#CDD2D8', border: 'none' }}>
                  {deleting ? 'Deleting…' : 'Permanently delete'}
                </button>
                <button onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                  style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: '#5A6470', background: '#fff', border: '1px solid #E3E6EA' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
