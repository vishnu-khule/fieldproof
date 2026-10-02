import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFileSync(join(here, 'knowledge', name), 'utf8')

const ESTIMATOR = read('estimator-prompt.md')
const FORMULA = read('formula.md')
const KNOWLEDGE = read('knowledge-base.md')

export const CATEGORY_LIST = [
  'Site Preparation', 'Foundation', 'Demolition', 'Framing', 'Exterior Finishes', 'Siding', 'Windows/Doors',
  'Roofing', 'Rough Plumbing', 'Rough Electrical', 'Mechanical', 'Insulation', 'Drywall', 'Trim/Casework/Hardware',
  'Tiling/Counters/Flooring', 'Paint Interior', 'Paint Exterior', 'Finish Plumbing', 'Finish Electrical',
  'Appliances', 'Clean Up', 'Allowances', 'Permits',
]

const TAKEOFF_CONTRACT = `
OUTPUT CONTRACT — this overrides any output format described in the reference documents below.

You are producing the TAKEOFF ONLY. The application computes every dollar total, category rollup, O&P,
the Basic/Modern/Premium variants, the Excel workbook and the markdown quotation in code.
Do NOT return category totals, subtotals, O&P or final prices. Do NOT write markdown.

Rules:
- The drawings control scope. The customer's answers confirm intent. Never invent scope.
- Review every page, including cover, permit, administrative, energy and CALGreen pages, and list each one in "sheets".
- Each line must cite a "source" (sheet id, PDF page, schedule or note). Without a source, use confidence "Verify in Field" or "Allowance".
- "category" must be exactly one of: ${CATEGORY_LIST.join(', ')}.
- "rateType": "General" ($120/hr carpenter/general), "Electrical" ($165/hr electrical or skilled trade), "Specialty" ($200 per production unit).
- "hoursPerUnit" is labor hours (or specialty units) per 1 qty. Use the productivity ranges in the knowledge base.
- One Specialty unit is about one crew-hour of subcontract production, so qty × hoursPerUnit for a Specialty line is the unit count (a typical bathroom tile line is 20–40 units, not 90+). Use General for tile setting priced by the hour.
- "materialAmount" is the TOTAL standard/builder-grade USD material, specialty or subcontract cost for the whole line (not per unit).
- Product purchases with unknown selections go in the "Allowances" category with hoursPerUnit 0; keep install labor in the trade category. Never double count.
- "finishGrade" true when the material is an owner-selectable finish or product (fixtures, tile, counters, lighting, hardware, cabinets, appliances, windows/doors product). The app scales these for Modern and Premium.
- "confidence" is one of: Drawing-confirmed, Schedule-confirmed, Structural-confirmed, Code-required, Energy-confirmed, User-confirmed, Allowance, Verify in Field, Excluded.
- Foundation lines only when the drawings show foundation work.
- Put uncertain, concealed or conflicting items in "clarifications".

Return JSON only, exactly this shape:
{
  "project": {"title":"","address":"","permit":"","type":"","description":"","areas":""},
  "sheets": [{"page":"","sheet":"","title":"","costImpact":"","notes":""}],
  "rooms": [{"room":"","demolition":"","newWork":"","mep":"","finishes":"","notes":""}],
  "lines": [{"category":"","source":"","room":"","scope":"","qty":1,"unit":"EA|SF|LF|LS|Room|Opening|Fixture","hoursPerUnit":0,"rateType":"General","materialAmount":0,"finishGrade":false,"confidence":"","notes":""}],
  "exclusions": [{"item":"","reason":""}],
  "clarifications": [{"item":"","why":"","source":"","risk":"Low|Medium|High"}],
  "assumptions": [""]
}
`

export const TAKEOFF_SYSTEM = `${TAKEOFF_CONTRACT}

==================== REFERENCE: ESTIMATOR ROLE & RULES ====================
${ESTIMATOR}

==================== REFERENCE: FORMULA MODEL ====================
${FORMULA}

==================== REFERENCE: KNOWLEDGE BASE ====================
${KNOWLEDGE}

==================== REMINDER ====================
${TAKEOFF_CONTRACT}`

export const WRITER_SYSTEM = `You write customer-facing remodeling and trade proposals.
Use only the project facts, takeoff summary and computed totals given to you. Do not invent prices, quantities, brands, dimensions or scope.
Totals were computed by the application — quote them exactly as given if you mention them.
The three variants share identical scope; they differ only in finish/product grade and warranty.
Return JSON only:
{"projectTitle":"","executiveSummary":"3-4 sentences","scopeNarrative":"one paragraph describing the work by area and trade","variantNotes":{"basic":"","modern":"","premium":""},"paymentTerms":"","assumptions":["",""]}`
