import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { dashboardApi, recommendationApi, accountApi, syncApi } from '../api/services';
import { useApi } from '../hooks/useApi';
import type { SyncBatchResult } from '../types';
import { Card, SectionTitle, Badge, Btn, ProgressBar, Spinner, fmt, C, scoreColor, priorityBg, priorityColor } from '../components/ui';
import AnimatedScore from '../components/AnimatedScore';

const consequenceBg: Record<string, string> = {
  STEADY:                  C.tealBg,
  EMERGENCY_FUND_WARNING:  C.amberBg,
  INCOME_DISRUPTION:       C.redBg,
};
const consequenceColor: Record<string, string> = {
  STEADY:                  C.teal,
  EMERGENCY_FUND_WARNING:  C.amber,
  INCOME_DISRUPTION:       C.red,
};

export function DashboardPage({ onRecsChange }: { onRecsChange: () => void }) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncBatchResult | null>(null);

  const { data: score, loading: scoreLoading, refetch: refetchScore } = useApi(dashboardApi.resilienceScore);
  const { data: scoreHistory } = useApi(dashboardApi.resilienceHistory);
  const { data: nba, loading: nbaLoading, refetch: refetchNba } = useApi(recommendationApi.nextBestAction);
  const { data: accounts, loading: accsLoading, refetch: refetchAccounts } = useApi(accountApi.list);
  const { data: netWorth, refetch: refetchNetWorth } = useApi(accountApi.netWorth);

  const handleNbaAction = async (response: 'APPROVED' | 'DISMISSED' | 'REMIND_LATER') => {
    if (!nba) return;
    setActionLoading(true);
    try {
      await recommendationApi.respond(nba.recommendationId, response);
      refetchNba();
      refetchScore();
      onRecsChange();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncApi.triggerSync();
      setSyncResult(result);
      refetchScore();
      refetchNba();
      refetchAccounts();
      refetchNetWorth();
      onRecsChange();
    } catch (e) {
      console.error('sync failed', e);
    } finally {
      setSyncing(false);
    }
  };

  const radarData = score ? [
    { label: 'Emergency Fund', value: score.components.emergencyFund },
    { label: 'Cash Flow',      value: score.components.cashFlow },
    { label: 'Debt Burden',    value: score.components.debtBurden },
    { label: 'Income',         value: score.components.incomeStability },
    { label: 'Goal Readiness', value: score.components.goalReadiness },
  ] : [];

  const trend = scoreHistory && scoreHistory.length >= 2
    ? (scoreHistory[0]?.overall ?? 0) - (scoreHistory[1]?.overall ?? 0)
    : null;

  const acctIcons: Record<string, string> = {
    CHECKING: '🏦', SAVINGS: '💰', CREDIT: '💳', LOAN: '📋',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

      {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* SYNC CONTROL */}
        <Card style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gray800, marginBottom: 2 }}>
                Demo: Sync Accounts
              </div>
              <div style={{ fontSize: 11, color: C.gray400 }}>
                Applies the next scripted transaction batch and re-runs all four agents. Seeded data — intelligence is real.
              </div>
            </div>
            <Btn
              label={syncing ? 'Analysing…' : '⟳ Sync Accounts'}
              variant="secondary"
              onClick={handleSync}
              disabled={syncing}
            />
          </div>

          {/* Sync result card */}
          {syncing && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, border: `2px solid ${C.gray200}`,
                borderTopColor: C.accent, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: 12, color: C.gray600 }}>
                Syncing transactions → Neo4j → running agent analysis…
              </span>
            </div>
          )}

          {syncResult && !syncing && (
            <div style={{ marginTop: 14 }}>
              {/* Consequence banner */}
              <div style={{
                background: consequenceBg[syncResult.consequenceType] ?? C.lightBg,
                border: `1.5px solid ${consequenceColor[syncResult.consequenceType] ?? C.accent}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{syncResult.consequenceIcon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: consequenceColor[syncResult.consequenceType] ?? C.accent }}>
                      Batch {syncResult.batchNumber}: {syncResult.batchLabel}
                    </div>
                    <div style={{ fontSize: 12, color: C.gray600, marginTop: 2 }}>{syncResult.narrative}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800,
                      color: syncResult.scoreDelta >= 0 ? C.teal : C.red,
                    }}>
                      {syncResult.scoreDelta >= 0 ? '+' : ''}{syncResult.scoreDelta}
                    </div>
                    <div style={{ fontSize: 10, color: C.gray400 }}>pts</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: consequenceColor[syncResult.consequenceType] ?? C.accent }}>
                  {syncResult.consequenceLabel}
                </div>
              </div>

              {/* Score transition */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.gray600 }}>
                <span style={{ fontWeight: 700, color: scoreColor(syncResult.previousScore) }}>{syncResult.previousScore}</span>
                <span style={{ color: C.gray400 }}>→</span>
                <span style={{ fontWeight: 700, color: scoreColor(syncResult.newScore) }}>{syncResult.newScore}</span>
                <span style={{ color: C.gray400 }}>•</span>
                <span>{syncResult.transactionsAdded} txns applied</span>
                {!syncResult.analysisComplete && (
                  <span style={{ color: C.amber, fontSize: 11 }}>(agent timed out — showing previous score)</span>
                )}
              </div>

              {/* Next batch preview */}
              {syncResult.batchesRemaining > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.gray400, fontStyle: 'italic' }}>
                  Preview: {syncResult.nextBatchPreview}
                </div>
              )}
              {syncResult.batchesRemaining === 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.gray400, fontStyle: 'italic' }}>
                  {syncResult.nextBatchPreview}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* NEXT BEST ACTION — hero card */}
        {nbaLoading ? <Card><Spinner /></Card> : nba && nba.response === 'PENDING' ? (
          <Card style={{ border: `2px solid ${C.accent}`, background: `linear-gradient(135deg, ${C.lightBg} 0%, ${C.white} 100%)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Next Best Action
                  </span>
                  <Badge label={nba.priority} color={priorityColor(nba.priority)} bg={priorityBg(nba.priority)} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.gray800, marginBottom: 8 }}>
                  {nba.recommendationText}
                </div>
                <div style={{ fontSize: 13, color: C.gray600, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Why: </span>{nba.reason}
                </div>
                <div style={{ fontSize: 13, color: C.gray600, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>Impact: </span>{nba.expectedImpact}
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: C.tealBg, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.teal }}>{Math.round(nba.confidence * 100)}%</div>
                    <div style={{ fontSize: 10, color: C.gray600 }}>Confidence</div>
                  </div>
                  <div style={{ background: C.lightBg, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, whiteSpace: 'nowrap' }}>{nba.agent.replace('Agent', '')}</div>
                    <div style={{ fontSize: 10, color: C.gray600 }}>Agent</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn label={actionLoading ? '…' : '✓ Approve'} variant="success"
                    onClick={() => handleNbaAction('APPROVED')} disabled={actionLoading} />
                  <Btn label="Remind Later" variant="ghost"
                    onClick={() => handleNbaAction('REMIND_LATER')} disabled={actionLoading} />
                  <Btn label="Dismiss" variant="ghost"
                    onClick={() => handleNbaAction('DISMISSED')} disabled={actionLoading} />
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card style={{ border: `2px solid ${C.teal}`, background: C.tealBg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.teal }}>All recommendations actioned</div>
                <div style={{ fontSize: 13, color: C.gray600 }}>
                  <span style={{ cursor: 'pointer', color: C.accent, textDecoration: 'underline' }}
                    onClick={() => navigate('/recommendations')}>View all recommendations</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* KEY INDICATORS */}
        {scoreLoading ? <Card><Spinner /></Card> : score && (
          <Card>
            <SectionTitle>Key Indicators</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Emergency Fund', value: `${score.components.emergencyFund}/100`, icon: score.components.emergencyFund < 30 ? '🚨' : score.components.emergencyFund < 50 ? '⚠️' : '✅', color: scoreColor(score.components.emergencyFund), bg: score.components.emergencyFund < 30 ? C.redBg : score.components.emergencyFund < 50 ? C.amberBg : C.tealBg },
                { label: 'Cash Flow',      value: `${score.components.cashFlow}/100`,      icon: '📊', color: scoreColor(score.components.cashFlow), bg: C.lightBg },
                { label: 'Debt Burden',    value: `${score.components.debtBurden}/100`,    icon: score.components.debtBurden < 50 ? '⚠️' : '✅', color: scoreColor(score.components.debtBurden), bg: score.components.debtBurden < 50 ? C.amberBg : C.tealBg },
                { label: 'Income Stability', value: `${score.components.incomeStability}/100`, icon: score.components.incomeStability < 30 ? '🚨' : '💼', color: scoreColor(score.components.incomeStability), bg: score.components.incomeStability < 30 ? C.redBg : C.lightBg },
              ].map(({ label, value, icon, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: C.gray400, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color }}>{icon} {value}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* RADAR CHART */}
        {score && radarData.length > 0 && (
          <Card>
            <SectionTitle>Resilience Breakdown</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={C.gray200} />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: C.gray600 }} />
                <Radar name="Score" dataKey="value" stroke={C.accent} fill={C.accent} fillOpacity={0.15} />
                <Tooltip formatter={(v: number) => [`${v}/100`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* CLARITY SCORE */}
        {scoreLoading ? <Card><Spinner /></Card> : score && (
          <Card style={{ textAlign: 'center' }}>
            <SectionTitle>Clarity Score</SectionTitle>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <AnimatedScore
                score={score.overall}
                previousScore={syncResult?.previousScore}
                size={120}
              />
            </div>
            {trend !== null && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: trend >= 0 ? C.tealBg : C.amberBg,
                borderRadius: 99, padding: '3px 10px',
              }}>
                <span style={{ fontSize: 12, color: trend >= 0 ? C.teal : C.amber, fontWeight: 700 }}>
                  {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} this month
                </span>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries({
                'Emergency Fund':    score.components.emergencyFund,
                'Cash Flow':         score.components.cashFlow,
                'Debt Burden':       score.components.debtBurden,
                'Income Stability':  score.components.incomeStability,
                'Goal Readiness':    score.components.goalReadiness,
              }).map(([label, s]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.gray600 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(s) }}>{s}</span>
                  </div>
                  <ProgressBar value={s} max={100} color={scoreColor(s)} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* LINKED ACCOUNTS */}
        {accsLoading ? <Card><Spinner /></Card> : accounts && (
          <Card>
            <SectionTitle>Linked Accounts</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {accounts.map(a => (
                <div key={a.accountId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: `1px solid ${C.gray100}`,
                }}>
                  <span style={{ fontSize: 20 }}>{acctIcons[a.accountType] ?? '🏦'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.gray800 }}>{a.institution}</div>
                    <div style={{ fontSize: 11, color: C.gray400 }}>{a.accountType}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.balance < 0 ? C.red : C.teal }}>
                    {fmt.currency(a.balance)}
                  </div>
                </div>
              ))}
            </div>
            {netWorth && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.gray400, textAlign: 'center' }}>
                Net worth: <span style={{ fontWeight: 700, color: C.gray800 }}>{fmt.currency(netWorth.netWorth)}</span>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
