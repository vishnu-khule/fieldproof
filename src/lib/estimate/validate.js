import { CATEGORIES, CONFIDENCE, CONFIRMED, FINISH_CATEGORIES, RATE_TYPES } from './config'

const CATEGORY_LOOKUP = new Map(CATEGORIES.map((name) => [normalise(name), name]))
const CATEGORY_ALIASES = {
  sitepreparation: 'Site Preparation',
  siteprep: 'Site Preparation',
  demo: 'Demolition',
  windowsdoors: 'Windows/Doors',
  doorswindows: 'Windows/Doors',
  plumbingrough: 'Rough Plumbing',
  electricalrough: 'Rough Electrical',
  hvac: 'Mechanical',
  drywallplaster: 'Drywall',
  trimcasework: 'Trim/Casework/Hardware',
  casework: 'Trim/Casework/Hardware',
  tile: 'Tiling/Counters/Flooring',
  tiling: 'Tiling/Counters/Flooring',
  flooring: 'Tiling/Counters/Flooring',
  paint: 'Paint Interior',
  interiorpaint: 'Paint Interior',
  exteriorpaint: 'Paint Exterior',
  cleanup: 'Clean Up',
  allowance: 'Allowances',
  permit: 'Permits',
}

function normalise(text) {
  return String(text || '').toLowerCase().replace(/[^a-z]/g, '')
}

function toCategory(raw) {
  const key = normalise(raw)
  return CATEGORY_LOOKUP.get(key) || CATEGORY_ALIASES[key] || null
}

function toNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

// Enforces the no-guess and allowance rules from server/knowledge/estimator-prompt.md §5, §12 and §15.
export function validateLines(rawLines = []) {
  const warnings = []
  const seen = new Set()
  const lines = []

  rawLines.forEach((raw, index) => {
    const category = toCategory(raw.category)
    if (!category) {
      warnings.push(`Dropped "${raw.scope || 'line ' + (index + 1)}": unknown category "${raw.category}".`)
      return
    }

    const scope = String(raw.scope || raw.description || '').trim()
    if (!scope) return
    const dedupeKey = `${category}|${normalise(scope)}`
    if (seen.has(dedupeKey)) {
      warnings.push(`Removed duplicate line "${scope}" in ${category}.`)
      return
    }
    seen.add(dedupeKey)

    const source = String(raw.source || '').trim()
    let confidence = CONFIDENCE.includes(raw.confidence) ? raw.confidence : 'Verify in Field'
    if (CONFIRMED.has(confidence) && !source) {
      confidence = 'Verify in Field'
      warnings.push(`"${scope}" was marked confirmed without a source, so it is now Verify in Field.`)
    }

    let rateType = RATE_TYPES.includes(raw.rateType) ? raw.rateType : 'General'
    const manualRate = rateType === 'Manual' ? Math.max(0, toNumber(raw.manualRate)) : 0
    if (rateType === 'Manual' && !manualRate) rateType = 'General'

    let hoursPerUnit = Math.max(0, toNumber(raw.hoursPerUnit))
    // Allowances carry product purchases only; install labor lives in the trade category.
    if (category === 'Allowances') hoursPerUnit = 0

    const qty = Math.max(0, toNumber(raw.qty, 1)) || 1
    if (qty * hoursPerUnit > 400) {
      warnings.push(`"${scope}" carries ${Math.round(qty * hoursPerUnit)} labor hours — check the quantity.`)
    } else if (rateType === 'Specialty' && qty * hoursPerUnit > 60) {
      warnings.push(`"${scope}" carries ${Math.round(qty * hoursPerUnit)} specialty units at $200 each — check the quantity.`)
    }

    if (category === 'Foundation' && !/^(Structural|Drawing)-confirmed$/.test(confidence)) {
      warnings.push(`Foundation line "${scope}" is not backed by drawings — excluded per the no-guess rule.`)
      confidence = 'Excluded'
    }

    if (isApplianceScope(category, scope) && !CONFIRMED.has(confidence) && confidence !== 'Excluded') {
      warnings.push(`Appliance line "${scope}" is not shown on the drawings or confirmed by you — excluded until confirmed.`)
      confidence = 'Excluded'
    }

    lines.push({
      id: `L${lines.length + 1}`,
      category,
      source: source || 'Not shown on drawings',
      scope,
      room: String(raw.room || '').trim(),
      qty,
      unit: String(raw.unit || 'LS').trim() || 'LS',
      hoursPerUnit,
      rateType,
      manualRate,
      materialAmount: Math.max(0, toNumber(raw.materialAmount)),
      finishGrade: typeof raw.finishGrade === 'boolean' ? raw.finishGrade : FINISH_CATEGORIES.has(category),
      confidence,
      notes: String(raw.notes || '').trim(),
    })
  })

  warnings.push(...doubleCountWarnings(lines))
  // #region agent log
  const big = lines.filter((l) => l.materialAmount >= 10000).slice(0, 8).map((l) => ({ category: l.category, materialAmount: l.materialAmount, source: l.source.slice(0, 80) }))
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',hypothesisId:'C',location:'validate.js:validateLines',message:'large material amounts',data:{lineCount:lines.length,big},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { lines, warnings }
}

const APPLIANCE_WORDS = /\b(appliances?|range|oven|cooktop|dishwasher|refrigerator|fridge|microwave|washer|dryer)\b/i

function isApplianceScope(category, scope) {
  return category === 'Appliances' || (category === 'Allowances' && APPLIANCE_WORDS.test(scope))
}

const PRODUCT_WORDS = [
  'window', 'door', 'skylight', 'toilet', 'vanity', 'sink', 'faucet', 'tub', 'valve', 'glass', 'tile',
  'counter', 'cabinet', 'mirror', 'light', 'fan', 'heater', 'appliance', 'flooring',
]
const PURCHASE_WORDS = /\b(supply|supplied|furnish|purchase|product)\b/i

function productWords(scope) {
  const text = scope.toLowerCase()
  return PRODUCT_WORDS.filter((word) => text.includes(word))
}

// Product purchases belong in Allowances; trade lines carry install and setting materials only (§10.22, §12).
function doubleCountWarnings(lines) {
  const warnings = []
  const active = lines.filter((line) => line.confidence !== 'Excluded')
  active
    .filter((line) => line.category === 'Allowances' && line.materialAmount > 0)
    .forEach((allowance) => {
      const words = productWords(allowance.scope)
      if (!words.length) return
      active
        .filter((line) => line.category !== 'Allowances' && line.materialAmount > 0)
        .forEach((line) => {
          const shared = productWords(line.scope).filter((word) => words.includes(word))
          if (!shared.length) return
          if (line.materialAmount >= allowance.materialAmount * 0.5 || PURCHASE_WORDS.test(line.scope)) {
            warnings.push(`Possible double count: "${line.scope}" (${line.category}) and allowance "${allowance.scope}" both carry ${shared.join('/')} product cost.`)
          }
        })
    })
  return warnings
}

export function excludeUnverified(lines) {
  return lines.map((line) => (line.confidence === 'Verify in Field' ? { ...line, confidence: 'Excluded' } : line))
}
