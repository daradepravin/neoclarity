import { useEffect, useState } from 'react'
import { openBankingApi, Institution, AccountTemplate, LinkResult } from '../api/client'

type Step = 'browse' | 'consent' | 'linking' | 'success'

interface Props {
  onClose: () => void
  onLinked: (result: LinkResult) => void
}

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }

const ACCT_ICON: Record<string, string> = { CHECKING: '🏦', SAVINGS: '💰', CREDIT: '💳', LOAN: '🏠' }

export default function ConnectAccount({ onClose, onLinked }: Props) {
  const [step, setStep] = useState<Step>('browse')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selected, setSelected] = useState<Institution | null>(null)
  const [checkedMasks, setCheckedMasks] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<LinkResult | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    openBankingApi.getInstitutions().then(r => setInstitutions(r.data)).catch(() => setError('Could not load institutions'))
  }, [])

  const pickInstitution = (inst: Institution) => {
    setSelected(inst)
    setCheckedMasks(new Set(inst.accounts.map(a => a.mask))) // all checked by default
    setStep('consent')
  }

  const toggleAccount = (mask: string) => {
    setCheckedMasks(prev => {
      const next = new Set(prev)
      next.has(mask) ? next.delete(mask) : next.add(mask)
      return next
    })
  }

  const grantConsent = async () => {
    if (!selected || checkedMasks.size === 0) return
    setStep('linking')
    try {
      // Simulate the consent handshake delay
      await new Promise(r => setTimeout(r, 1400))
      const res = await openBankingApi.link(selected.id, Array.from(checkedMasks))
      setResult(res.data)
      setStep('success')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Linking failed')
      setStep('consent')
    }
  }

  const filtered = institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="nc-fade"
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(14,28,46,.3)' }}>

        {/* ── BROWSE STEP ── */}
        {step === 'browse' && (
          <>
            <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #EEF0F3' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#14181F' }}>Connect an account</h2>
                <button onClick={onClose} style={{ fontSize: 22, color: '#9AA3AD', lineHeight: 1 }}>×</button>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7682' }}>Securely link your bank via Open Banking. Choose your institution to begin.</p>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid #DCE0E5', borderRadius: 9, background: '#FAFBFC' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#9AA3AD" strokeWidth="1.4"/><path d="m11 11 3 3" stroke="#9AA3AD" strokeWidth="1.4" strokeLinecap="round"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for your bank…"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#14181F', background: 'transparent' }} />
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px' }}>
              {filtered.map(inst => (
                <div key={inst.id} onClick={() => pickInstitution(inst)}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F5F7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{inst.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#14181F' }}>{inst.name}</div>
                    <div style={{ fontSize: 12.5, color: '#8A929C' }}>{inst.description}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m6 4 4 4-4 4" stroke="#C4CDD8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              ))}
              {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#9AA3AD', fontSize: 13 }}>No institutions match "{search}"</div>}
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid #EEF0F3', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#8A929C' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.2 11.5 3v3.4c0 3.1-2.6 5.4-4.5 6.2-1.9-.8-4.5-3.1-4.5-6.2V3L7 1.2Z" stroke="#9AA3AD" strokeWidth="1.2"/></svg>
              Bank-grade encryption · You control what's shared · Revoke anytime
            </div>
          </>
        )}

        {/* ── CONSENT STEP ── */}
        {step === 'consent' && selected && (
          <>
            <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #EEF0F3' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button onClick={() => setStep('browse')} style={{ fontSize: 13, fontWeight: 600, color: '#6B7682' }}>← Back</button>
                <button onClick={onClose} style={{ fontSize: 22, color: '#9AA3AD', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 11, background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{selected.logo}</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#14181F' }}>{selected.name}</h2>
                  <div style={{ fontSize: 12.5, color: '#8A929C' }}>Choose accounts to share with NeoClarity</div>
                </div>
              </div>
            </div>

            {error && <div style={{ margin: '12px 24px 0', padding: '8px 12px', background: '#FBE9E7', color: '#C0392B', borderRadius: 8, fontSize: 12.5 }}>{error}</div>}

            <div style={{ overflowY: 'auto', padding: '14px 24px', flex: 1 }}>
              {selected.accounts.map((acct: AccountTemplate) => {
                const checked = checkedMasks.has(acct.mask)
                return (
                  <div key={acct.mask} onClick={() => toggleAccount(acct.mask)}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 11, cursor: 'pointer', border: `1.5px solid ${checked ? '#12A39B' : '#E3E6EA'}`, background: checked ? '#E4F3F1' : '#fff', marginBottom: 10, transition: 'all .12s' }}>
                    <div style={{ fontSize: 22 }}>{ACCT_ICON[acct.accountType]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#14181F' }}>{acct.displayName}</div>
                      <div style={{ fontSize: 12, color: '#8A929C' }}>•••• {acct.mask} · {acct.accountType}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: acct.balance < 0 ? '#C0392B' : '#14181F' }}>{fmt(acct.balance)}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${checked ? '#12A39B' : '#CDD2D8'}`, background: checked ? '#12A39B' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="m3 7 2.5 2.5L11 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                )
              })}

              {/* Consent disclosure */}
              <div style={{ marginTop: 8, padding: '12px 14px', background: '#F4F5F7', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3D454E', marginBottom: 6 }}>NeoClarity will be able to:</div>
                {['View account balances and details', 'Read transaction history (last 90 days)', 'Analyse spending to detect life events'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5A6470', padding: '2px 0' }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#E4F3F1"/><path d="m4.5 7 2 2 3-3.5" stroke="#0E7C77" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {t}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5A6470', padding: '2px 0', marginTop: 2 }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FBE9E7"/><path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  <span><strong>Never</strong> move money or make payments</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #EEF0F3' }}>
              <button onClick={grantConsent} disabled={checkedMasks.size === 0}
                style={{ width: '100%', height: 46, background: checkedMasks.size === 0 ? '#CDD2D8' : '#12A39B', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 9, boxShadow: checkedMasks.size === 0 ? 'none' : '0 6px 18px -6px rgba(18,163,155,.6)' }}>
                Allow & connect {checkedMasks.size > 0 ? `${checkedMasks.size} account${checkedMasks.size > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </>
        )}

        {/* ── LINKING STEP ── */}
        {step === 'linking' && selected && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%', border: '4px solid #E4F3F1', borderTopColor: '#12A39B', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#14181F', marginBottom: 6 }}>Connecting to {selected.name}…</div>
            <div style={{ fontSize: 13, color: '#8A929C' }}>Establishing secure connection and importing transactions</div>
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && result && (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 18px', borderRadius: '50%', background: '#E4F3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><path d="m10 17 4.5 4.5L24 12" stroke="#0E7C77" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#14181F' }}>{result.institution} connected</h2>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#6B7682' }}>Your Household Digital Twin is updating.</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
              <div style={{ flex: 1, background: '#F4F5F7', borderRadius: 10, padding: '14px 10px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#12867F' }}>{result.accountsLinked}</div>
                <div style={{ fontSize: 11.5, color: '#8A929C' }}>account{result.accountsLinked > 1 ? 's' : ''} linked</div>
              </div>
              <div style={{ flex: 1, background: '#F4F5F7', borderRadius: 10, padding: '14px 10px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#12867F' }}>{result.transactionsImported}</div>
                <div style={{ fontSize: 11.5, color: '#8A929C' }}>transactions imported</div>
              </div>
            </div>

            {result.eventDetected && (
              <div style={{ background: 'linear-gradient(135deg,#13283F,#0E1C2E)', borderRadius: 11, padding: '14px 16px', marginBottom: 22, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24 }}>✈️</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Life event detected!</div>
                  <div style={{ fontSize: 12, color: '#9DB0C4' }}>The Event Intelligence Agent found a possible vacation. Review it under Events.</div>
                </div>
              </div>
            )}

            <button onClick={() => onLinked(result)}
              style={{ width: '100%', height: 46, background: '#12A39B', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 9, boxShadow: '0 6px 18px -6px rgba(18,163,155,.6)' }}>
              View my accounts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
