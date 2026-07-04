import { useState } from 'react'
import { syncApi, SyncResult } from '../api/client'

interface Props {
  onSyncComplete: (result: SyncResult) => void
  currentBatch: number
  totalBatches: number
}

export default function SyncButton({ onSyncComplete, currentBatch, totalBatches }: Props) {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await syncApi.sync()
      onSyncComplete(res.data)
    } catch (e) {
      console.error('Sync failed', e)
    } finally {
      setSyncing(false)
    }
  }

  const batchLabel = currentBatch >= totalBatches ? 'All batches synced' : `Batch ${currentBatch + 1} of ${totalBatches} ready`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#8A929C' }}>{batchLabel}</div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 3 }}>
          {Array.from({ length: totalBatches }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < currentBatch ? '#12A39B' : '#E3E6EA' }} />
          ))}
        </div>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing || currentBatch >= totalBatches}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: syncing || currentBatch >= totalBatches ? '#CDD2D8' : '#0E1C2E',
          color: '#fff', fontSize: 13, fontWeight: 700,
          padding: '9px 16px', borderRadius: 8, border: 'none',
          cursor: syncing || currentBatch >= totalBatches ? 'not-allowed' : 'pointer',
          transition: 'background .15s',
        }}
      >
        {syncing ? (
          <>
            <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }} />
            Syncing...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 1 1 7 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M7 2l2.5-.5L10 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sync Accounts
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
