import { ResilienceScore } from '../api/client'

interface Props {
  currentScore: ResilienceScore | null
  previousScore: ResilienceScore | null
  syncResult?: { narrative: string; storyArc: string; batchNumber: number } | null
}

export default function ConsequenceIndicator({ currentScore, previousScore, syncResult }: Props) {
  if (!currentScore || !syncResult) return null

  const emergencyFundMonths = (currentScore.components.emergencyFund / 100 * 6).toFixed(1)
  const prevEmergencyFundMonths = previousScore
    ? (previousScore.components.emergencyFund / 100 * 6).toFixed(1)
    : null

  const runwayShrunk = previousScore &&
    currentScore.components.emergencyFund < previousScore.components.emergencyFund

  const incomeDropped = previousScore &&
    currentScore.components.incomeStability < previousScore.components.incomeStability - 10

  const scoreDelta = previousScore ? currentScore.overall - previousScore.overall : 0

  // Choose consequence based on which batch just ran
  const consequence = syncResult.batchNumber === 1 ? null :
    syncResult.batchNumber === 2 ? {
      icon: '⚠️',
      title: 'Emergency fund runway shrinking',
      detail: `Coverage dropped from ${prevEmergencyFundMonths} → ${emergencyFundMonths} months. Target: 6 months.`,
      color: '#C77700',
      bg: '#FEF3C7',
      border: '#F0C060',
    } : {
      icon: '🚨',
      title: 'Income gap detected',
      detail: 'Salary deposit missing this cycle. Income stability score collapsed. Immediate action recommended.',
      color: '#C0392B',
      bg: '#FEE2E2',
      border: '#F0A0A0',
    }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'ncFade 0.4s ease' }}>
      {/* Sync narrative banner */}
      <div style={{ background: '#E4F3F1', border: '1px solid rgba(18,163,155,.3)', borderRadius: 10, padding: '11px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E7C77', marginBottom: 3 }}>
          Batch {syncResult.batchNumber} of 3 synced
        </div>
        <div style={{ fontSize: 13, color: '#14181F', fontWeight: 500 }}>{syncResult.narrative}</div>
        <div style={{ fontSize: 12, color: '#5A6470', marginTop: 4, fontStyle: 'italic' }}>{syncResult.storyArc}</div>
      </div>

      {/* Consequence card — only shows on batches 2 and 3 */}
      {consequence && (
        <div style={{ background: consequence.bg, border: `1px solid ${consequence.border}`, borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{consequence.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: consequence.color }}>{consequence.title}</div>
            <div style={{ fontSize: 12.5, color: '#3D454E', marginTop: 3, lineHeight: 1.5 }}>{consequence.detail}</div>
          </div>
        </div>
      )}

      {/* Score delta callout */}
      {scoreDelta !== 0 && (
        <div style={{
          background: scoreDelta > 0 ? '#E7F3EC' : '#FBE9E7',
          border: `1px solid ${scoreDelta > 0 ? '#BFE3D0' : '#F0C0C0'}`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: scoreDelta > 0 ? '#1F8A5A' : '#C0392B' }}>
            {scoreDelta > 0 ? '+' : ''}{scoreDelta}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: scoreDelta > 0 ? '#1F8A5A' : '#C0392B' }}>
              Clarity Score {scoreDelta > 0 ? 'improved' : 'declined'}
            </div>
            <div style={{ fontSize: 12, color: '#6B7682' }}>
              {scoreDelta > 0 ? 'Financial resilience strengthening' : 'Household absorbing financial stress'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
