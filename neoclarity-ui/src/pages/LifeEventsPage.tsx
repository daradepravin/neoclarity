import { useState } from 'react';
import { eventApi } from '../api/services';
import { useApi } from '../hooks/useApi';
import { Card, Badge, Btn, Spinner, Empty, fmt, C } from '../components/ui';

const EVENT_ICONS: Record<string, string> = {
  VACATION: '✈️', HOME_RENO: '🏠', MEDICAL: '🏥',
  EDUCATION: '📚', CELEBRATION: '🎉', CHILD_ACTIVITY: '⚽',
};

export function LifeEventsPage() {
  const { data: events, loading, refetch } = useApi(eventApi.list);
  const [acting, setActing] = useState<string | null>(null);

  const handleConfirm = async (eventId: string) => {
    setActing(eventId);
    try {
      await eventApi.confirm(eventId);
      refetch();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (eventId: string) => {
    setActing(eventId);
    try {
      await eventApi.reject(eventId);
      refetch();
    } finally {
      setActing(null);
    }
  };

  if (loading) return <Spinner />;

  const pending   = events?.filter(e => !e.confirmed) ?? [];
  const confirmed = events?.filter(e => e.confirmed) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, margin: 0 }}>Life Events</h2>

      <div style={{
        background: C.lightBg, borderRadius: 8, padding: '10px 14px',
        fontSize: 13, color: C.accent,
      }}>
        🔍 The Event Intelligence Agent analyses your transactions and detects meaningful
        financial life events. Confirming them helps NeoClarity understand your financial story.
      </div>

      {pending.length === 0 && confirmed.length === 0 && (
        <Empty icon="🔍" message="No life events detected yet. Connect accounts to let the AI analyse your transactions." />
      )}

      {/* Pending confirmation */}
      {pending.map(event => (
        <Card key={event.eventId} style={{ border: `2px solid ${C.amber}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Badge label="Needs Confirmation" color={C.amber} bg={C.amberBg} />
                <Badge label={`${Math.round(event.detectionConfidence * 100)}% confident`}
                  color={C.accent} bg={C.lightBg} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.gray800 }}>
                {EVENT_ICONS[event.eventType] ?? '📌'} {event.label}
              </div>
              {event.dateRangeStart && (
                <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
                  {fmt.date(event.dateRangeStart)} – {fmt.date(event.dateRangeEnd)}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.amber }}>{fmt.currency(event.totalCost)}</div>
              <div style={{ fontSize: 11, color: C.gray400 }}>estimated cost</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ background: C.gray50, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: C.gray600 }}>
              📌 {event.transactionCount} transactions detected
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              label={acting === event.eventId ? '…' : '✓ Yes, this is correct'}
              variant="success"
              onClick={() => handleConfirm(event.eventId)}
              disabled={acting === event.eventId}
            />
            <Btn
              label="No, this is wrong"
              variant="ghost"
              onClick={() => handleReject(event.eventId)}
              disabled={acting === event.eventId}
            />
          </div>
        </Card>
      ))}

      {/* Confirmed events */}
      {confirmed.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.gray600, margin: '8px 0 0' }}>Confirmed Events</h3>
          {confirmed.map(event => (
            <Card key={event.eventId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Badge label="Confirmed" color={C.teal} bg={C.tealBg} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.gray800 }}>
                    {EVENT_ICONS[event.eventType] ?? '📌'} {event.label}
                  </div>
                  {event.dateRangeStart && (
                    <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
                      {fmt.date(event.dateRangeStart)} – {fmt.date(event.dateRangeEnd)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.gray600 }}>{fmt.currency(event.totalCost)}</div>
                  <div style={{ fontSize: 11, color: C.gray400 }}>{event.transactionCount} transactions</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
