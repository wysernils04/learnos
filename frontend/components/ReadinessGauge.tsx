'use client'

interface Props {
  score: number   // 0–100
  size?: number   // px, default 160
  label?: string
}

function gaugeColor(score: number): string {
  if (score >= 70) return '#0D9488' // teal primary
  if (score >= 40) return '#F97316' // orange
  return '#EF4444'                  // red
}

function gaugeLabel(score: number): string {
  if (score >= 70) return 'Ready'
  if (score >= 40) return 'Partial'
  return 'At risk'
}

export function ReadinessGauge({ score, size = 160, label }: Props) {
  const r = (size / 2) * 0.72
  const cx = size / 2
  const cy = size / 2 + size * 0.05  // shift centre slightly down for semicircle headroom
  const strokeW = size * 0.085

  // Semicircle: start at 180° (left), sweep clockwise to 0° (right) — 180° arc
  const startAngle = Math.PI          // left
  const endAngle = 0                  // right (full = 180°)
  const fillAngle = Math.PI * (1 - score / 100)  // fill from right inward

  function polar(angle: number) {
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
  }

  const trackStart = polar(Math.PI)
  const trackEnd = polar(0)

  const fillEnd = polar(fillAngle)
  const fillLargeArc = fillAngle < Math.PI ? 0 : 1

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`
  const fillPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${fillLargeArc} 1 ${fillEnd.x} ${fillEnd.y}`

  const color = gaugeColor(score)
  const statusLabel = gaugeLabel(score)

  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label={`Readiness: ${score}%`}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - size * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill="#134E4A"
          fontFamily="inherit"
        >
          {score}%
        </text>
        {/* Status label */}
        <text
          x={cx}
          y={cy + size * 0.13}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.1}
          fontWeight="600"
          fill={color}
          fontFamily="inherit"
        >
          {statusLabel}
        </text>
      </svg>
      {label && <p className="text-xs text-muted-foreground text-center">{label}</p>}
    </div>
  )
}
