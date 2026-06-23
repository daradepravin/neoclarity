import type { ReactNode, CSSProperties } from 'react';

// ── Design tokens (matches UX prototype palette) ────────────────────────────
export const C = {
  navy:     '#0A2342',
  accent:   '#1A6EBD',
  teal:     '#0F6E56',
  amber:    '#854F0B',
  red:      '#991B1B',
  white:    '#FFFFFF',
  gray50:   '#F8FAFC',
  gray100:  '#F1F5F9',
  gray200:  '#E2E8F0',
  gray400:  '#94A3B8',
  gray600:  '#475569',
  gray800:  '#1E293B',
  lightBg:  '#EBF3FB',
  tealBg:   '#E1F5EE',
  amberBg:  '#FEF3C7',
  redBg:    '#FEE2E2',
} as const;

export const scoreColor = (s: number) => s >= 75 ? C.teal : s >= 50 ? C.amber : C.red;
export const priorityColor = (p: string) =>
  p === 'CRITICAL' || p === 'HIGH' ? C.red : p === 'MEDIUM' ? C.amber : C.teal;
export const priorityBg = (p: string) =>
  p === 'CRITICAL' || p === 'HIGH' ? C.redBg : p === 'MEDIUM' ? C.amberBg : C.tealBg;

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 12,
      border: `1px solid ${C.gray200}`,
      padding: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.gray400,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 4, background: bg, color, letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const btnStyles: Record<BtnVariant, CSSProperties> = {
  primary:   { background: C.accent,  color: C.white, border: 'none' },
  secondary: { background: C.white,   color: C.accent, border: `1.5px solid ${C.accent}` },
  ghost:     { background: 'transparent', color: C.gray600, border: `1.5px solid ${C.gray200}` },
  danger:    { background: C.white,   color: C.red,   border: `1.5px solid ${C.red}` },
  success:   { background: C.teal,    color: C.white, border: 'none' },
};

export function Btn({
  label, variant = 'primary', onClick, small, disabled,
}: {
  label: string; variant?: BtnVariant;
  onClick?: () => void; small?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnStyles[variant],
        padding: small ? '5px 12px' : '8px 18px',
        borderRadius: 6,
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
export function Ring({ score, size = 100, stroke = 10 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.gray200} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle"
        fontSize={size * 0.22} fontWeight={700} fill={C.gray800}>{score}</text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle"
        fontSize={size * 0.1} fill={C.gray400}>/ 100</text>
    </svg>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = C.accent }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: C.gray200, borderRadius: 99, height: 7, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, background: color, height: '100%',
        borderRadius: 99, transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
      <div style={{
        width: 32, height: 32, border: `3px solid ${C.gray200}`,
        borderTopColor: C.accent, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 0', color: C.gray400 }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{message}</div>
    </div>
  );
}

// ── fmt helpers ───────────────────────────────────────────────────────────────
export const fmt = {
  currency: (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n),
  percent: (n: number) => `${n}%`,
  date: (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
};
