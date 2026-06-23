import { useEffect, useState } from 'react'
import { accountsApi, Account, LinkResult } from '../api/client'
import Spinner from '../components/Spinner'
import ConnectAccount from '../components/ConnectAccount'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }) }
const ICONS: Record<string, string> = { CHECKING: '🏦', SAVINGS: '💰', CREDIT: '💳', LOAN: '🏠' }

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [netWorth, setNetWorth] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [disconnectTarget, setDisconnectTarget] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([accountsApi.getAll(), accountsApi.getNetWorth()])
      .then(([a, n]) => { setAccounts(a.data); setNetWorth(n.data.netWorth) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleLinked = (result: LinkResult) => {
    setShowConnect(false)
    setBanner(`${result.institution} connected — ${result.accountsLinked} account${result.accountsLinked > 1 ? 's' : ''}, ${result.transactionsImported} transactions imported.`)
    load()
    setTimeout(() => setBanner(null), 6000)
  }

  const doDisconnect = async () => {
    if (!disconnectTarget) return
    setBusy(true)
    try {
      await accountsApi.disconnect(disconnectTarget.accountId)
      setBanner(`${disconnectTarget.institution} ${disconnectTarget.accountType} disconnected. History retained for audit.`)
      setDisconnectTarget(null)
      load()
      setTimeout(() => setBanner(null), 6000)
    } catch {} finally { setBusy(false) }
  }

  const doReconnect = async (a: Account) => {
    setBusy(true)
    try {
      await accountsApi.reconnect(a.accountId)
      setBanner(`${a.institution} ${a.accountType} reconnected.`)
      load()
      setTimeout(() => setBanner(null), 5000)
    } catch {} finally { setBusy(false) }
  }

  if (loading) return <Spinner />

  const active = accounts.filter(a => a.active)
  const inactive = accounts.filter(a => !a.active)

  const renderAccount = (a: Account) => (
    <div key={a.accountId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #EEF0F3', opacity: a.active ? 1 : 0.6 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, filter: a.active ? 'none' : 'grayscale(1)' }}>{ICONS[a.accountType]}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#14181F' }}>{a.institution} {a.accountType}</span>
          {!a.active && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A929C', background: '#EEF0F3', padding: '2px 7px', borderRadius: 5, letterSpacing: '0.03em' }}>DISCONNECTED</span>}
        </div>
        <div style={{ fontSize: 12, color: '#8A929C', marginTop: 2 }}>Last updated {new Date(a.lastRefreshedAt).toLocaleDateString()}</div>
      </div>
      <div style={{ textAlign: 'right', marginRight: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: a.balance < 0 ? '#C0392B' : a.active ? '#14181F' : '#9AA3AD' }}>{fmt(a.balance)}</div>
        <div style={{ fontSize: 11, color: '#8A929C', marginTop: 2 }}>{a.currency}</div>
      </div>
      {a.active ? (
        <button onClick={() => setDisconnectTarget(a)} disabled={busy}
          style={{ fontSize: 12.5, fontWeight: 600, color: '#C0392B', border: '1px solid #F0D5D0', background: '#fff', padding: '6px 12px', borderRadius: 7 }}>
          Disconnect
        </button>
      ) : (
        <button onClick={() => doReconnect(a)} disabled={busy}
          style={{ fontSize: 12.5, fontWeight: 600, color: '#0E7C77', border: '1px solid #BFE3DF', background: '#fff', padding: '6px 12px', borderRadius: 7 }}>
          Reconnect
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#14181F', margin: '0 0 4px' }}>Accounts</h1>
          <p style={{ fontSize: 13.5, color: '#6B7682', margin: 0 }}>{active.length} active{inactive.length > 0 ? ` · ${inactive.length} disconnected` : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {netWorth !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#8A929C' }}>Net Worth</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: netWorth >= 0 ? '#1F8A5A' : '#C0392B' }}>{fmt(netWorth)}</div>
            </div>
          )}
          <button onClick={() => setShowConnect(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#12A39B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '10px 18px', borderRadius: 9, boxShadow: '0 6px 18px -6px rgba(18,163,155,.6)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Connect Account
          </button>
        </div>
      </div>

      {banner && (
        <div className="nc-fade" style={{ background: '#E4F3F1', border: '1px solid rgba(18,163,155,.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, color: '#0E7C77', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="rgba(18,163,155,.18)"/><path d="m5 8 2 2 4-4.5" stroke="#0E7C77" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {banner}
        </div>
      )}

      {accounts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#14181F', marginBottom: 4 }}>No accounts connected yet</div>
          <div style={{ fontSize: 13.5, color: '#8A929C', marginBottom: 20 }}>Connect your first account to build your Household Digital Twin.</div>
          <button onClick={() => setShowConnect(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#12A39B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '11px 22px', borderRadius: 9 }}>
            Connect your first account
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EEF0F3', fontSize: 12, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Active Accounts</div>
              {active.map(renderAccount)}
            </div>
          )}
          {inactive.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EEF0F3', fontSize: 12, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Disconnected</div>
              {inactive.map(renderAccount)}
            </div>
          )}
        </>
      )}

      <div style={{ background: '#F4F5F7', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, color: '#8A929C', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.2 11.5 3v3.4c0 3.1-2.6 5.4-4.5 6.2-1.9-.8-4.5-3.1-4.5-6.2V3L7 1.2Z" stroke="#9AA3AD" strokeWidth="1.2"/></svg>
        Disconnecting stops processing and excludes the account from your score — your transaction history is retained for audit. To remove everything, use Delete My Data in Profile.
      </div>

      {showConnect && <ConnectAccount onClose={() => setShowConnect(false)} onLinked={handleLinked} />}

      {disconnectTarget && (
        <ConfirmDialog
          title={`Disconnect ${disconnectTarget.institution} ${disconnectTarget.accountType}?`}
          body={<>This stops NeoClarity from processing this account and removes it from your Clarity Score and net worth. Your past transactions stay on file for audit, and you can reconnect anytime. <strong>No money is moved.</strong></>}
          confirmLabel={busy ? 'Disconnecting…' : 'Disconnect'}
          confirmColor="#C0392B"
          onConfirm={doDisconnect}
          onCancel={() => setDisconnectTarget(null)}
          disabled={busy}
        />
      )}
    </div>
  )
}
