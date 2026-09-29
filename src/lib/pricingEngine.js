// Deterministic pricing. In production this reads a real rate card table
// (per trade, per region, per material) instead of these seed constants.
// The AI agent only supplies line-item descriptions/quantities; this file
// is the single source of truth for every number that reaches a customer.

const BASE_RATE = {
  plumbing: 850,
  electrical: 700,
  furniture: 1600,
  civil: 550,
  hvac: 1200,
  general: 800,
} // currency units per "unit" (room / sqft / fixture — simplified for demo)

const TIER_MULTIPLIER = {
  basic: { material: 1.0, labour: 1.0, margin: 1.12, warrantyMonths: 6 },
  modern: { material: 1.35, labour: 1.15, margin: 1.18, warrantyMonths: 12 },
  premium: { material: 1.85, labour: 1.3, margin: 1.25, warrantyMonths: 24 },
}

const TIER_LABEL = {
  basic: { title: 'Basic', blurb: 'Essential scope with standard-grade materials and workmanship.' },
  modern: { title: 'Modern', blurb: 'Upgraded materials and finish, with an extended warranty.' },
  premium: { title: 'Premium', blurb: 'Top-grade materials, priority scheduling and the longest warranty.' },
}

function unitCount(projectData) {
  const raw = (projectData.area_or_units || '').match(/\d+(\.\d+)?/)
  return raw ? Math.max(1, parseFloat(raw[0])) : 1
}

export function buildLineItems(trade, tier, units) {
  const catalog = {
    plumbing: ['Pipe & fitting supply', 'Fixture installation', 'Waterproofing', 'Testing & commissioning'],
    electrical: ['Wiring & conduiting', 'Switch/socket points', 'Distribution board', 'Testing & certification'],
    furniture: ['Material & panels', 'Fabrication', 'Hardware & fittings', 'Installation & finishing'],
    civil: ['Material supply', 'Labour — structural work', 'Finishing work', 'Site cleanup'],
    hvac: ['Unit supply', 'Ducting/piping', 'Installation', 'Testing & commissioning'],
    general: ['Material supply', 'Labour', 'Fittings & finishing', 'Final inspection'],
  }
  const items = catalog[trade] || catalog.general
  const base = BASE_RATE[trade] || BASE_RATE.general
  const m = TIER_MULTIPLIER[tier]
  return items.map((desc, i) => {
    const isMaterial = i === 0 || i === 2
    const rate = base * (isMaterial ? m.material : m.labour) * (0.9 + i * 0.05)
    const qty = i === 3 ? 1 : units
    return {
      description: desc,
      qty,
      unit: i === 3 ? 'lot' : 'unit',
      rate: Math.round(rate),
      amount: Math.round(rate * qty),
    }
  })
}

export function priceTier(trade, tier, projectData) {
  const units = unitCount(projectData)
  const items = buildLineItems(trade, tier, units)
  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const m = TIER_MULTIPLIER[tier]
  const marginedSubtotal = Math.round(subtotal * m.margin)
  const tax = Math.round(marginedSubtotal * 0.18) // GST-style placeholder rate
  const total = marginedSubtotal + tax

  return {
    tier,
    ...TIER_LABEL[tier],
    items,
    subtotal,
    marginedSubtotal,
    tax,
    total,
    warrantyMonths: m.warrantyMonths,
    currency: projectData.currency || 'INR',
  }
}

export function priceAllTiers(trade, projectData) {
  return {
    basic: priceTier(trade, 'basic', projectData),
    modern: priceTier(trade, 'modern', projectData),
    premium: priceTier(trade, 'premium', projectData),
  }
}

export function formatCurrency(amount, currency = 'INR') {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  const sym = symbols[currency] || currency + ' '
  return sym + amount.toLocaleString('en-IN')
}
