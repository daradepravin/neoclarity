import { CSSProperties, ReactNode } from 'react'
export default function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '1.25rem', ...style }}>
      {children}
    </div>
  )
}
