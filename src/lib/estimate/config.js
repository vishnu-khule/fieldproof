// Rates, categories and variant profiles from server/knowledge/formula.md and
// knowledge-base.md. Every number that reaches a customer is derived from here.

export const CURRENCY = 'USD'

// Preferred client-learned rates (knowledge-base.md §2.1). Used only when a client
// actual workbook is attached and states a rate structure.
export const CLIENT_RATES = {
  General: 120,
  Electrical: 165,
  Specialty: 200,
}

// Fallback when no client-specific actual workbook exists (knowledge-base.md §2.2).
// The published ranges are $105–$120 and $150–$165; the low end is the applied
// fallback. Specialty and O&P are the same in both tables.
export const FALLBACK_RATES = {
  General: 105,
  Electrical: 150,
  Specialty: 200,
}

export const CLIENT_OP_PERCENT = 0.2
export const FALLBACK_OP_PERCENT = 0.2

export const RATES = FALLBACK_RATES
export const OP_PERCENT = FALLBACK_OP_PERCENT

const inRange = (n, min, max) => n >= min && n <= max

// A client workbook overrides fallback only for rates it actually states, and only
// inside the published bands (knowledge-base.md §2.2–2.3). Missing rates stay on fallback.
export function resolveRateBasis(workbookRates = []) {
  const stated = workbookRates.find((r) => r.general > 0 || r.electrical > 0 || r.specialty > 0 || r.opPercent > 0)
  if (!stated) {
    return { source: 'fallback', rates: { ...FALLBACK_RATES }, opPercent: FALLBACK_OP_PERCENT, file: '' }
  }
  return {
    source: 'client',
    file: stated.file || '',
    rates: {
      General: inRange(stated.general, 105, 120) ? stated.general : (stated.general > 0 ? CLIENT_RATES.General : FALLBACK_RATES.General),
      Electrical: inRange(stated.electrical, 150, 165) ? stated.electrical : (stated.electrical > 0 ? CLIENT_RATES.Electrical : FALLBACK_RATES.Electrical),
      Specialty: stated.specialty > 0 ? stated.specialty : FALLBACK_RATES.Specialty,
    },
    opPercent: stated.opPercent > 0 && stated.opPercent < 1 ? stated.opPercent : FALLBACK_OP_PERCENT,
  }
}

export function rateBasisNote(basis) {
  const rates = basis?.source === 'client' ? basis.rates : FALLBACK_RATES
  const op = basis?.source === 'client' ? basis.opPercent : FALLBACK_OP_PERCENT
  if (basis?.source === 'client') {
    const from = basis.file ? ` from ${basis.file}` : ''
    return `Client workbook rates${from}: General $${rates.General}/hr, Electrical $${rates.Electrical}/hr, Specialty $${rates.Specialty}/unit, O&P ${Math.round(op * 100)}%.`
  }
  return `Fallback rates (no client workbook): General $${rates.General}/hr (range $105–$120), Electrical $${rates.Electrical}/hr (range $150–$165), Specialty $${rates.Specialty}/unit, O&P ${Math.round(op * 100)}%.`
}

export const RATE_TYPES = ['General', 'Electrical', 'Specialty', 'Manual']

export const CATEGORIES = [
  'Site Preparation',
  'Foundation',
  'Demolition',
  'Framing',
  'Exterior Finishes',
  'Siding',
  'Windows/Doors',
  'Roofing',
  'Rough Plumbing',
  'Rough Electrical',
  'Mechanical',
  'Insulation',
  'Drywall',
  'Trim/Casework/Hardware',
  'Tiling/Counters/Flooring',
  'Paint Interior',
  'Paint Exterior',
  'Finish Plumbing',
  'Finish Electrical',
  'Appliances',
  'Clean Up',
  'Allowances',
  'Permits',
]

export const CONFIDENCE = [
  'Drawing-confirmed',
  'Schedule-confirmed',
  'Structural-confirmed',
  'Code-required',
  'Energy-confirmed',
  'User-confirmed',
  'Allowance',
  'Verify in Field',
  'Excluded',
]

// Confirmed tags must cite a drawing, schedule or the customer.
export const CONFIRMED = new Set([
  'Drawing-confirmed',
  'Schedule-confirmed',
  'Structural-confirmed',
  'Code-required',
  'Energy-confirmed',
  'User-confirmed',
])

// Scope and quantities are identical across variants. Only finish-grade
// material (product selections and allowances) scales, plus the warranty.
export const VARIANTS = {
  basic: {
    key: 'basic',
    title: 'Basic',
    finishMultiplier: 1,
    warrantyMonths: 12,
    blurb: 'Standard-grade finishes and products on the full drawing-confirmed scope.',
    finishNote: 'Builder-grade fixtures, tile and hardware at standard allowance levels.',
  },
  modern: {
    key: 'modern',
    title: 'Modern',
    finishMultiplier: 1.6,
    warrantyMonths: 24,
    blurb: 'Same scope with mid-range branded finishes and an extended workmanship warranty.',
    finishNote: 'Mid-range branded fixtures, upgraded tile, lighting and hardware allowances.',
  },
  premium: {
    key: 'premium',
    title: 'Premium',
    finishMultiplier: 2.6,
    warrantyMonths: 36,
    blurb: 'Same scope with premium product selections, priority scheduling and the longest warranty.',
    finishNote: 'Premium fixtures, designer tile, specialty hardware and lighting allowances.',
  },
}

export const VARIANT_KEYS = ['basic', 'modern', 'premium']

// Categories whose material column is mostly owner-selectable product.
export const FINISH_CATEGORIES = new Set([
  'Allowances',
  'Tiling/Counters/Flooring',
  'Trim/Casework/Hardware',
  'Finish Plumbing',
  'Finish Electrical',
  'Appliances',
])

export const CONFIDENCE_STATEMENT =
  'This is a drawing-based estimate generated from the provided permit drawings. Quantities are extracted from the drawing set where visible and inferred only where standard construction is required to complete shown work. Product selections, concealed conditions, field verification items, and owner-selected finishes should be confirmed before contract pricing.'

export const SCHEMATIC_NOTE =
  'Schematic for visual reference only — see attached drawings for actual construction detail. Not to scale and not a construction or permit document.'

// The scope map only appears when rooms came from reviewed drawings, never from a typed brief.
export function hasSchematic(takeoff) {
  return takeoff.source === 'ai' && takeoff.sheets.length > 0 && takeoff.rooms.length > 0
}

// Room → trades, the same data the scope map draws. Used for Markdown and Excel, which cannot hold the SVG.
export function schematicRooms(takeoff) {
  const rooms = new Map()
  takeoff.lines
    .filter((l) => l.confidence !== 'Excluded' && l.category !== 'Allowances' && l.category !== 'Permits')
    .forEach((l) => {
      const room = l.room || 'Whole project'
      if (!rooms.has(room)) rooms.set(room, new Set())
      rooms.get(room).add(l.category)
    })
  return [...rooms.entries()].map(([room, categories]) => ({ room, categories: [...categories] }))
}

export function formatMoney(amount, currency = CURRENCY) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  const sym = symbols[currency] || `${currency} `
  const value = Number(amount || 0)
  return sym + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
