import { CATEGORIES, OP_PERCENT, RATES, VARIANTS, VARIANT_KEYS } from './config'

const round2 = (n) => Math.round(n * 100) / 100

export function appliedRate(line, rates = RATES) {
  if (line.manualRate > 0) return line.manualRate
  return rates[line.rateType] || 0
}

// Labor = Qty × Labor Hrs/Unit × Rate; Line = Labor + Material/Specialty.
export function priceLine(line, variant, rates = RATES) {
  const rate = appliedRate(line, rates)
  const labor = round2(line.qty * line.hoursPerUnit * rate)
  const multiplier = line.finishGrade ? VARIANTS[variant].finishMultiplier : 1
  const material = round2((line.materialAmount || 0) * multiplier)
  // #region agent log
  if (line.qty > 1 && line.materialAmount > 0 && line.materialAmount < 20) fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',hypothesisId:'A',location:'rollup.js:priceLine',message:'small material on large qty',data:{variant,category:line.category,qty:line.qty,unit:line.unit,materialAmount:line.materialAmount,material,labor},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { ...line, rate, labor, material, total: round2(labor + material) }
}

export function rollupVariant(lines, variant, { rates = RATES, opPercent = OP_PERCENT } = {}) {
  const priced = lines.filter((line) => line.confidence !== 'Excluded').map((line) => priceLine(line, variant, rates))

  const categories = CATEGORIES.map((name) => {
    const items = priced.filter((line) => line.category === name)
    const labor = round2(items.reduce((sum, line) => sum + line.labor, 0))
    const materials = round2(items.reduce((sum, line) => sum + line.material, 0))
    return { name, items, labor, materials, total: round2(labor + materials) }
  })

  const labor = round2(categories.reduce((sum, c) => sum + c.labor, 0))
  const materials = round2(categories.reduce((sum, c) => sum + c.materials, 0))
  const subtotal = round2(labor + materials)
  const overheadProfit = round2(subtotal * opPercent)

  return {
    variant,
    ...VARIANTS[variant],
    categories,
    labor,
    materials,
    subtotal,
    opPercent,
    overheadProfit,
    total: round2(subtotal + overheadProfit),
  }
}

export function rollupAll(lines, options) {
  return Object.fromEntries(VARIANT_KEYS.map((key) => [key, rollupVariant(lines, key, options)]))
}

const usd = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// "$120/hr", "$200/unit", or "-" for product-only lines (allowances).
export function rateLabel(line) {
  if (!line.hoursPerUnit || !line.rate) return '-'
  return `${usd(line.rate)}/${line.rateType === 'Specialty' ? 'unit' : 'hr'}`
}

export function hoursLabel(line) {
  if (!line.hoursPerUnit) return '-'
  return `${line.hoursPerUnit} ${line.rateType === 'Specialty' ? 'units' : 'hrs'}`
}

// Visible subtotal math per estimator-prompt.md §18.2.
export function categoryMath(category) {
  const join = (key) => category.items.map((l) => usd(l[key])).join(' + ') || usd(0)
  return [
    `Category Labor = ${join('labor')} = ${usd(category.labor)}`,
    `Category Materials = ${join('material')} = ${usd(category.materials)}`,
    `Category Total = ${usd(category.labor)} + ${usd(category.materials)} = ${usd(category.total)}`,
  ]
}

// Scope grouped by drawing sheet / source per estimator-prompt.md §7 step 3.
export function scopeBySource(lines) {
  const groups = new Map()
  lines.forEach((line) => {
    const key = line.source || 'Not shown on drawings'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(line)
  })
  return [...groups.entries()].map(([source, items]) => ({ source, items }))
}
