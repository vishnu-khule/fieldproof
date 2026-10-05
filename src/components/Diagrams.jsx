import { VARIANT_KEYS, formatMoney } from '../lib/estimate/config'

const COLORS = { labor: '#1C4C86', materials: '#D98B1C', op: '#5B6B7C' }
const VARIANT_COLORS = { basic: '#5B6B7C', modern: '#1C4C86', premium: '#D98B1C' }
const short = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`)

function wrapLabel(text, max, maxLines = 3) {
  const out = []
  let rest = String(text || '').trim()
  while (rest && out.length < maxLines) {
    if (rest.length <= max) {
      out.push(rest)
      break
    }
    if (out.length === maxLines - 1) {
      out.push(`${rest.slice(0, max - 1)}…`)
      break
    }
    const cut = rest.lastIndexOf(' ', max)
    const at = cut > 8 ? cut : max
    out.push(rest.slice(0, at))
    rest = rest.slice(at).trim()
  }
  return out.length ? out : ['']
}

function Frame({ title, caption, children }) {
  return (
    <figure className="diagram">
      <figcaption className="diagram-title">{title}</figcaption>
      {children}
      {caption && <div className="diagram-caption">{caption}</div>}
    </figure>
  )
}

export function ScopeMap({ takeoff, estimate, note }) {
  const categories = estimate.categories.filter((c) => c.items.length && c.name !== 'Allowances' && c.name !== 'Permits')
  const roomNames = [...new Set(takeoff.lines.map((l) => l.room).filter(Boolean))]
  const rooms = roomNames.length ? roomNames.slice(0, 8) : ['Whole project']
  const row = 42
  const height = Math.max(rooms.length, categories.length) * row + 20
  const roomY = (i) => (rooms.length === 1 ? height / 2 : 20 + (i * (height - 40)) / (rooms.length - 1))
  const catY = (i) => 20 + i * row
  const links = []
  categories.forEach((c, ci) => {
    const linked = new Set(c.items.map((l) => (roomNames.length ? l.room : 'Whole project')).filter((r) => rooms.includes(r)))
    if (!linked.size) linked.add(rooms[0])
    linked.forEach((r) => links.push({ from: rooms.indexOf(r), to: ci }))
  })

  return (
    <Frame title="Scope map — areas to trades" caption={`${note} Lines show which trades work in each area.`}>
      <svg viewBox={`0 0 600 ${height}`} className="diagram-svg" role="img" aria-label="Scope map">
        {links.map((l, i) => (
          <path
            key={i}
            d={`M 208 ${roomY(l.from)} C 300 ${roomY(l.from)}, 300 ${catY(l.to)}, 390 ${catY(l.to)}`}
            fill="none"
            stroke="#C9D2DC"
            strokeWidth="1.5"
          />
        ))}
        {rooms.map((r, i) => {
          const lines = wrapLabel(r, 28)
          const boxH = 12 + lines.length * 12
          return (
            <g key={r}>
              <rect x="8" y={roomY(i) - boxH / 2} width="200" height={boxH} rx="3" fill="#E7EEF6" stroke="#1C4C86" />
              <text x="16" y={roomY(i) - boxH / 2 + 14} fontSize="10" fill="#10243E">
                <title>{r}</title>
                {lines.map((line, li) => <tspan key={li} x="16" dy={li === 0 ? 0 : 12}>{line}</tspan>)}
              </text>
            </g>
          )
        })}
        {categories.map((c, i) => (
          <g key={c.name}>
            <rect x="390" y={catY(i) - 11} width="200" height="22" rx="3" fill="#FBF0DB" stroke="#D98B1C" />
            <text x="398" y={catY(i) + 4} fontSize="11" fill="#10243E">{c.name}</text>
          </g>
        ))}
      </svg>
    </Frame>
  )
}

export function CategoryBars({ estimate }) {
  const rows = estimate.categories.filter((c) => c.total > 0).sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...rows.map((c) => c.total))
  const row = 24
  const width = 600
  const barX = 200
  const barW = width - barX - 70
  return (
    <Frame title={`Cost by category — ${estimate.title}`} caption="Labor (blue) and materials/specialty/allowances (amber), before O&P.">
      <svg viewBox={`0 0 ${width} ${rows.length * row + 10}`} className="diagram-svg" role="img" aria-label="Cost by category">
        {rows.map((c, i) => {
          const y = 5 + i * row
          const lw = (c.labor / max) * barW
          const mw = (c.materials / max) * barW
          return (
            <g key={c.name}>
              <text x={barX - 8} y={y + 14} fontSize="11" textAnchor="end" fill="#3E4C5E">{c.name}</text>
              <rect x={barX} y={y + 3} width={lw} height="15" fill={COLORS.labor} />
              <rect x={barX + lw} y={y + 3} width={mw} height="15" fill={COLORS.materials} />
              <text x={barX + lw + mw + 6} y={y + 14} fontSize="10.5" fill="#10243E" fontFamily="IBM Plex Mono, monospace">{short(c.total)}</text>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}

export function VariantComparison({ estimates, active }) {
  const max = Math.max(...VARIANT_KEYS.map((k) => estimates[k].total))
  const width = 600
  const chartH = 140
  const top = 28
  const base = top + chartH
  const colW = 110
  return (
    <Frame title="Basic vs Modern vs Premium" caption="Bar colors: labor (blue), finish materials (amber), overhead and profit (slate). Same scope in every plan.">
      <svg viewBox={`0 0 ${width} ${base + 46}`} className="diagram-svg" role="img" aria-label="Variant comparison">
        {VARIANT_KEYS.map((k, i) => {
          const e = estimates[k]
          const x = 70 + i * 170
          const scale = (v) => (v / max) * chartH
          const lh = scale(e.labor)
          const mh = scale(e.materials)
          const oh = scale(e.overheadProfit)
          return (
            <g key={k} opacity={active && active !== k ? 0.45 : 1}>
              <rect x={x} y={base - lh} width={colW} height={lh} fill={COLORS.labor} />
              <rect x={x} y={base - lh - mh} width={colW} height={mh} fill={COLORS.materials} />
              <rect x={x} y={base - lh - mh - oh} width={colW} height={oh} fill={COLORS.op} />
              <text x={x + colW / 2} y={base - lh - mh - oh - 8} fontSize="12" textAnchor="middle" fontWeight="700" fill="#10243E" fontFamily="IBM Plex Mono, monospace">{formatMoney(e.total).replace(/\.\d+$/, '')}</text>
              <text x={x + colW / 2} y={base + 18} fontSize="12" textAnchor="middle" fontWeight="600" fill={VARIANT_COLORS[k]}>{e.title}</text>
              <text x={x + colW / 2} y={base + 34} fontSize="10" textAnchor="middle" fill="#5B6B7C">{e.warrantyMonths}-month warranty</text>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}

export function PhaseTimeline({ schedule }) {
  if (!schedule.length) return null
  const total = schedule.reduce((max, p) => Math.max(max, p.start + p.weeks), 0)
  const width = 600
  const labelW = 160
  const chartW = width - labelW - 20
  const row = 28
  const ticks = Math.ceil(total)
  return (
    <Frame title="Indicative schedule" caption={`About ${total} weeks with a two-person crew (80 labor hours/week). Final dates confirmed after permits and selections.`}>
      <svg viewBox={`0 0 ${width} ${schedule.length * row + 30}`} className="diagram-svg" role="img" aria-label="Schedule">
        {Array.from({ length: ticks + 1 }, (_, w) => (
          <g key={w}>
            <line x1={labelW + (w / total) * chartW} x2={labelW + (w / total) * chartW} y1="0" y2={schedule.length * row + 4} stroke="#E2E8EF" />
            <text x={labelW + (w / total) * chartW} y={schedule.length * row + 20} fontSize="9.5" textAnchor="middle" fill="#5B6B7C">W{w}</text>
          </g>
        ))}
        {schedule.map((p, i) => (
          <g key={p.name}>
            <text x={labelW - 8} y={i * row + 18} fontSize="11" textAnchor="end" fill="#3E4C5E">{p.name}</text>
            <rect x={labelW + (p.start / total) * chartW} y={i * row + 6} width={Math.max(4, (p.weeks / total) * chartW)} height="16" rx="2" fill="#1C4C86" />
            <text x={labelW + ((p.start + p.weeks) / total) * chartW + 5} y={i * row + 18} fontSize="10" fill="#10243E">{p.weeks} wk · {p.hours} h</text>
          </g>
        ))}
      </svg>
    </Frame>
  )
}
