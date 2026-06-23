import { CSSProperties } from 'react'
const variants: Record<string, CSSProperties> = {
  primary: { background: '#1A6EBD', color: '#fff', border: 'none' },
  success: { background: '#0F6E56', color: '#fff', border: 'none' },
  secondary: { background: '#fff', color: '#1A6EBD', border: '1.5px solid #1A6EBD' },
  ghost: { background: 'transparent', color: '#475569', border: '1.5px solid #E2E8F0' },
  danger: { background: '#fff', color: '#991B1B', border: '1.5px solid #991B1B' },
}
export default function Btn({ label, variant = 'primary', onClick, small, disabled }: {
  label: string; variant?: string; onClick?: () => void; small?: boolean; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...variants[variant], padding: small ? '5px 12px' : '8px 18px',
      borderRadius: 6, fontSize: small ? 12 : 13, fontWeight: 600,
      opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s',
    }}>{label}</button>
  )
}
