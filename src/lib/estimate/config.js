// Rates, categories and variant profiles from server/knowledge/formula.md and
// knowledge-base.md. Every number that reaches a customer is derived from here.

export const CURRENCY = 'USD'

export const RATES = {
  General: 120,
  Electrical: 165,
  Specialty: 200,
}

export const OP_PERCENT = 0.2

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

export function formatMoney(amount, currency = CURRENCY) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  const sym = symbols[currency] || `${currency} `
  const value = Number(amount || 0)
  return sym + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
