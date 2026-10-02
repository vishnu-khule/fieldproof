import { CONFIDENCE_STATEMENT, OP_PERCENT, RATES, VARIANTS, VARIANT_KEYS, formatMoney } from './config'
import { categoryMath, hoursLabel, rateLabel, scopeBySource } from './rollup'

const money = (n) => formatMoney(n)
const cell = (text) => String(text ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')

export function buildMarkdown(proposal, variantKey) {
  const { takeoff, estimates, narrative, meta } = proposal
  const est = estimates[variantKey]
  const out = []

  out.push(`# Project Quotation — ${narrative.projectTitle}`)
  out.push('')
  out.push(`Prepared for ${meta.customer} · ${meta.date} · Variant: **${est.title}**`)
  out.push('')

  out.push('## 1. Project Summary')
  out.push(narrative.executiveSummary)
  const p = takeoff.project || {}
  const facts = [['Address', p.address], ['Permit', p.permit], ['Project type', p.type], ['Areas', p.areas]].filter(([, v]) => v)
  if (facts.length) {
    out.push('')
    facts.forEach(([k, v]) => out.push(`- **${k}:** ${v}`))
  }
  out.push('')

  out.push('## 2. Drawing Sources Reviewed')
  if (takeoff.sheets.length) {
    out.push('| File | Page / Sheet | Title | Cost Impact | Notes |')
    out.push('|---|---|---|---|---|')
    takeoff.sheets.forEach((s) => out.push(`| ${cell(s.file)} | ${cell([s.page, s.sheet].filter(Boolean).join(' / '))} | ${cell(s.title)} | ${cell(s.costImpact || 'No direct cost impact identified')} | ${cell(s.notes)} |`))
  } else {
    out.push('No drawings were supplied. Scope is based on the customer brief.')
  }
  out.push('')

  out.push('## 3. Scope Extracted by Drawing Sheet')
  out.push(narrative.scopeNarrative)
  out.push('')
  scopeBySource(takeoff.lines).forEach(({ source, items }) => {
    out.push(`**${source}**`)
    items.forEach((l) => out.push(`- ${l.category}: ${l.scope} (${l.qty} ${l.unit}) — ${l.confidence}`))
    out.push('')
  })

  out.push('## 4. Room-by-Room Scope')
  out.push('| Room / Area | Demolition | New Work | MEP | Finishes | Notes |')
  out.push('|---|---|---|---|---|---|')
  takeoff.rooms.forEach((r) => out.push(`| ${cell(r.room)} | ${cell(r.demolition)} | ${cell(r.newWork)} | ${cell(r.mep)} | ${cell(r.finishes)} | ${cell(r.notes)} |`))
  out.push('')

  out.push('## 5. Category Summary — Variant Comparison')
  out.push('| Category | Labor | Basic Materials | Basic Total | Modern Total | Premium Total |')
  out.push('|---|---:|---:|---:|---:|---:|')
  est.categories.forEach((c, i) => {
    const b = estimates.basic.categories[i]
    out.push(`| ${c.name} | ${money(c.labor)} | ${money(b.materials)} | ${money(b.total)} | ${money(estimates.modern.categories[i].total)} | ${money(estimates.premium.categories[i].total)} |`)
  })
  out.push(`| **Total Cost** | **${money(est.labor)}** | **${money(estimates.basic.materials)}** | **${money(estimates.basic.subtotal)}** | **${money(estimates.modern.subtotal)}** | **${money(estimates.premium.subtotal)}** |`)
  out.push(`| Overhead/Profit ${Math.round(OP_PERCENT * 100)}% | | | ${money(estimates.basic.overheadProfit)} | ${money(estimates.modern.overheadProfit)} | ${money(estimates.premium.overheadProfit)} |`)
  out.push(`| **Total Project Cost** | | | **${money(estimates.basic.total)}** | **${money(estimates.modern.total)}** | **${money(estimates.premium.total)}** |`)
  out.push('')

  out.push(`## 6. Category Calculation Details (${est.title})`)
  est.categories.forEach((c) => {
    out.push(`### ${c.name}`)
    if (!c.items.length) {
      out.push(`No ${c.name.toLowerCase()} scope was found in the reviewed sources.`)
    } else {
      out.push('| Source | Scope Item | Qty | Unit | Labor Hrs / Units | Rate | Labor | Materials / Specialty | Total | Confidence |')
      out.push('|---|---|---:|---|---:|---:|---:|---:|---:|---|')
      c.items.forEach((l) => out.push(`| ${cell(l.source)} | ${cell(l.scope)} | ${l.qty} | ${cell(l.unit)} | ${hoursLabel(l)} | ${rateLabel(l)} | ${money(l.labor)} | ${money(l.material)} | ${money(l.total)} | ${l.confidence} |`))
      out.push('')
      out.push('```text')
      categoryMath(c).forEach((line) => out.push(line))
      out.push('```')
    }
    out.push('')
    out.push(`**${c.name} subtotal: Labor=${money(c.labor)}, Materials=${money(c.materials)}, Total=${money(c.total)}**`)
    out.push('')
  })

  out.push('## 7. Allowances')
  const allowances = est.categories.find((c) => c.name === 'Allowances').items
  if (allowances.length) {
    out.push('| Allowance Item | Basis / Source | Basic | Modern | Premium |')
    out.push('|---|---|---:|---:|---:|')
    allowances.forEach((l) => {
      const amt = (k) => money(l.materialAmount * (l.finishGrade ? VARIANTS[k].finishMultiplier : 1))
      out.push(`| ${cell(l.scope)} | ${cell(l.source)} | ${amt('basic')} | ${amt('modern')} | ${amt('premium')} |`)
    })
  } else out.push('No allowances carried.')
  out.push('')

  out.push('## 8. Exclusions')
  takeoff.exclusions.forEach((e) => out.push(`- **${e.item}** — ${e.reason}`))
  out.push('')

  out.push('## 9. Verify-in-Field / Clarifications')
  takeoff.clarifications.forEach((c) => out.push(`- **${c.item}** — ${c.why}${c.source ? ` (source: ${c.source})` : ''}${c.risk ? ` · Cost risk: ${c.risk}` : ''}`))
  out.push('')

  out.push('## 10. Formula Basis')
  out.push(`- General labor: ${money(RATES.General)}/hr · Electrical/skilled: ${money(RATES.Electrical)}/hr · Specialty production: ${money(RATES.Specialty)}/unit`)
  out.push('- Labor = Qty × Labor Hrs/Unit × Rate; Line Total = Labor + Materials/Specialty')
  out.push('- Category totals are sums of their line items; O&P is applied once to the subtotal.')
  out.push(`- Variants share identical scope. Finish-grade materials scale: ${VARIANT_KEYS.map((k) => `${VARIANTS[k].title} ×${VARIANTS[k].finishMultiplier}`).join(', ')}.`)
  out.push('')

  out.push('## 11. Assumptions, Payment & Warranty')
  narrative.assumptions.forEach((a) => out.push(`- ${a}`))
  out.push(`- Payment terms: ${narrative.paymentTerms}`)
  out.push(`- Workmanship warranty (${est.title}): ${est.warrantyMonths} months`)
  out.push('')

  out.push('## 12. Confidence Statement')
  out.push(`> ${CONFIDENCE_STATEMENT}`)
  out.push('')
  return out.join('\n')
}

export function downloadMarkdown(proposal, variantKey) {
  const blob = new Blob([buildMarkdown(proposal, variantKey)], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(proposal.narrative.projectTitle)}-${variantKey}-quotation.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function slug(text) {
  return String(text || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project'
}
