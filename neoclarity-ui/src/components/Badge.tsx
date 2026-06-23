export default function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bg, color, letterSpacing: '0.04em', display: 'inline-block' }}>
      {label}
    </span>
  )
}
