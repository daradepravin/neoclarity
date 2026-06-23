import { ReactNode } from 'react'

interface Props {
  title: string
  body: ReactNode
  confirmLabel: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}

export default function ConfirmDialog({ title, body, confirmLabel, confirmColor = '#C0392B', onConfirm, onCancel, disabled }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,28,46,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="nc-fade"
        style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: '24px', boxShadow: '0 24px 64px rgba(14,28,46,.3)' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#14181F' }}>{title}</h2>
        <div style={{ fontSize: 14, color: '#5A6470', lineHeight: 1.6, marginBottom: 22 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#5A6470', border: '1.5px solid #E3E6EA', background: '#fff' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={disabled}
            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', background: disabled ? '#CDD2D8' : confirmColor, border: 'none' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
