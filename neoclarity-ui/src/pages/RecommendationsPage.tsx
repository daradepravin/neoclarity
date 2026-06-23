import { useState } from 'react';
import { recommendationApi } from '../api/services';
import { useApi } from '../hooks/useApi';
import { Card, SectionTitle, Badge, Btn, Spinner, Empty, fmt, C, priorityColor, priorityBg } from '../components/ui';
import type { RecommendationResponse } from '../types';

const statusColor = (s: string) => s === 'APPROVED' ? C.teal : s === 'DISMISSED' ? C.gray400 : C.amber;
const statusBg = (s: string) => s === 'APPROVED' ? '#E1F5EE' : s === 'DISMISSED' ? C.gray100 : '#FEF3C7';

export function RecommendationsPage({ onRecsChange }: { onRecsChange: () => void }) {
  const { data: recs, loading, refetch } = useApi(recommendationApi.list);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const pending  = recs?.filter(r => r.response === 'PENDING').length ?? 0;
  const approved = recs?.filter(r => r.response === 'APPROVED').length ?? 0;
  const dismissed = recs?.filter(r => r.response === 'DISMISSED').length ?? 0;

  const respond = async (rec: RecommendationResponse, response: 'APPROVED' | 'DISMISSED' | 'REMIND_LATER') => {
    setActing(rec.recommendationId);
    try {
      await recommendationApi.respond(rec.recommendationId, response);
      refetch();
      onRecsChange();
    } finally {
      setActing(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, margin: 0 }}>Recommendations</h2>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Pending',   count: pending,   color: C.amber },
          { label: 'Approved',  count: approved,  color: C.teal },
          { label: 'Dismissed', count: dismissed, color: C.gray400 },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            background: C.white, border: `1px solid ${C.gray200}`,
            borderRadius: 10, padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{count}</div>
            <div style={{ fontSize: 11, color: C.gray400 }}>{label}</div>
          </div>
        ))}
      </div>

      {(!recs || recs.length === 0) && (
        <Empty icon="💡" message="No recommendations yet. Connect accounts to get started." />
      )}

      {recs?.map(rec => {
        const isExpanded = expanded === rec.recommendationId;
        const isActing = acting === rec.recommendationId;
        return (
          <Card key={rec.recommendationId}
            style={{ border: isExpanded ? `2px solid ${C.accent}` : `1px solid ${C.gray200}` }}>

            {/* Header — always visible */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpanded(isExpanded ? null : rec.recommendationId)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Badge label={rec.priority} color={priorityColor(rec.priority)} bg={priorityBg(rec.priority)} />
                  <Badge label={rec.response} color={statusColor(rec.response)} bg={statusBg(rec.response)} />
                  <span style={{ fontSize: 11, color: C.gray400 }}>{rec.agent}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gray800 }}>{rec.recommendationText}</div>
                <div style={{ fontSize: 12, color: C.gray600, marginTop: 4 }}>{rec.reason}</div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 16, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{rec.expectedImpact}</div>
                <div style={{ fontSize: 11, color: C.gray400 }}>{Math.round(rec.confidence * 100)}% confidence</div>
                <div style={{ fontSize: 18, color: C.gray400, marginTop: 4 }}>{isExpanded ? '▲' : '▼'}</div>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.gray200}`, paddingTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <SectionTitle>Expected Impact</SectionTitle>
                    <div style={{ background: C.tealBg, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.teal }}>
                      ✓ {rec.expectedImpact}
                    </div>
                  </div>
                  <div>
                    <SectionTitle>If I do nothing</SectionTitle>
                    <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red }}>
                      ⚠ Resilience remains below target — financial vulnerability persists.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: C.gray400, alignSelf: 'center' }}>
                    Generated by {rec.agent} · {fmt.date(rec.createdAt)}
                  </span>
                </div>

                {(rec.response === 'PENDING' || rec.response === 'REMIND_LATER') && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <Btn label={isActing ? '…' : '✓ Approve'} variant="success"
                      onClick={() => respond(rec, 'APPROVED')} disabled={!!isActing} />
                    <Btn label="Remind Later" variant="ghost"
                      onClick={() => respond(rec, 'REMIND_LATER')} disabled={!!isActing} />
                    <Btn label="Dismiss" variant="danger"
                      onClick={() => respond(rec, 'DISMISSED')} disabled={!!isActing} />
                  </div>
                )}

                {rec.response === 'APPROVED' && (
                  <div style={{ marginTop: 14, background: C.tealBg, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.teal, fontWeight: 600 }}>
                    ✅ Approved · Digital Twin updated
                  </div>
                )}

                {rec.response === 'DISMISSED' && (
                  <div style={{ marginTop: 14, background: C.gray100, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.gray400 }}>
                    Dismissed
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
