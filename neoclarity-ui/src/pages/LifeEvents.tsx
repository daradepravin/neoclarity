import { useEffect, useState } from 'react'
import { lifeEventsApi, LifeEvent } from '../api/client'
import Card from '../components/Card'
import Badge from '../components/Badge'
import Btn from '../components/Btn'
import Spinner from '../components/Spinner'

const EVENT_ICONS: Record<string, string> = { VACATION: '✈️', HOME_RENO: '🏠', MEDICAL: '🏥', EDUCATION: '📚', CHILD_ACTIVITY: '⚽', CELEBRATION: '🎉' }
function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }

export default function LifeEvents() {
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    lifeEventsApi.getAll().then(r => setEvents(r.data)).finally(() => setLoading(false))
  }, [])

  const handleConfirm = async (eventId: string) => {
    setActing(eventId)
    try {
      const res = await lifeEventsApi.confirm(eventId)
      setEvents(es => es.map(e => e.eventId === eventId ? res.data : e))
    } catch {
      setEvents(es => es.map(e => e.eventId === eventId ? { ...e, confirmed: true } : e))
    } finally { setActing(null) }
  }

  const handleReject = async (eventId: string) => {
    setActing(eventId)
    try {
      await lifeEventsApi.reject(eventId)
      setEvents(es => es.filter(e => e.eventId !== eventId))
    } catch {
      setEvents(es => es.filter(e => e.eventId !== eventId))
    } finally { setActing(null) }
  }

  if (loading) return <Spinner />

  const pending = events.filter(e => !e.confirmed)
  const confirmed = events.filter(e => e.confirmed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#14181F' }}>Life Events</div>

      <div style={{ background: '#E8F1FB', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#12A39B' }}>
        🔍 The Event Intelligence Agent analyses your transactions to detect meaningful financial events. Confirming them helps NeoClarity understand your financial life better.
      </div>

      {pending.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Awaiting Confirmation</div>
          {pending.map(e => (
            <Card key={e.eventId} style={{ border: '2px solid #92400E' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Badge label="Needs Confirmation" color="#92400E" bg="#FEF3C7" />
                    <Badge label={`${Math.round(e.detectionConfidence * 100)}% confident`} color="#1A6EBD" bg="#EBF3FB" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#14181F' }}>
                    {EVENT_ICONS[e.eventType] || '📋'} {e.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#9AA3AD', marginTop: 2 }}>
                    {e.dateRangeStart} – {e.dateRangeEnd}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#C77700' }}>{fmt(e.totalCost)}</div>
                  <div style={{ fontSize: 11, color: '#9AA3AD' }}>{e.transactionCount} transactions</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn label={acting === e.eventId ? 'Confirming...' : '✓ Yes, this is correct'} variant="success"
                  onClick={() => handleConfirm(e.eventId)} disabled={acting === e.eventId} />
                <Btn label="No, this is wrong" variant="ghost" onClick={() => handleReject(e.eventId)} disabled={acting === e.eventId} />
              </div>
            </Card>
          ))}
        </>
      )}

      {confirmed.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirmed Events</div>
          {confirmed.map(e => (
            <Card key={e.eventId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <Badge label="Confirmed" color="#0F6E56" bg="#E1F5EE" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#14181F' }}>
                    {EVENT_ICONS[e.eventType] || '📋'} {e.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#9AA3AD', marginTop: 2 }}>
                    {e.dateRangeStart} – {e.dateRangeEnd} · {e.transactionCount} transactions
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#6B7682' }}>{fmt(e.totalCost)}</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {events.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '2rem', color: '#9AA3AD' }}>
          No events detected yet. The Event Intelligence Agent will analyse your transactions as they are imported.
        </Card>
      )}
    </div>
  )
}
