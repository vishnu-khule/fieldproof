// ─────────────────────────────────────────────────────────────────────────
// MOCK AI ORCHESTRATOR
//
// This file simulates the agent pipeline described in the architecture doc
// so the UI is fully demoable with zero backend. Every function below is a
// stand-in for a real API call — replace the body with a fetch() to your
// backend, which in turn calls Claude with the matching system prompt.
// The real system prompts are included as comments so you can lift them
// directly into your backend service.
// ─────────────────────────────────────────────────────────────────────────

import { detectTrade, CHECKLISTS } from './tradeChecklists'
import { priceAllTiers } from './pricingEngine'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// STEP 1 — Intake / classifier agent
// PROMPT: "You are an intake assistant for trade professionals. From the
// user message and attachment list, identify trade_type, job_type,
// location, language, currency, customer info. Return JSON."
export async function classifyIntake(message, attachments) {
  const names = (attachments || []).map((file) => file.name)
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'attachment-analysis-1',hypothesisId:'H1,H2',location:'mockAgent.js:classifyIntake',message:'Payload prepared for AI classifier',data:{messageLength:message.length,attachmentNames:names,sendsFileBytes:false},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const ai = await callAi({ action: 'classify', message, attachmentNames: names })
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'attachment-analysis-1',hypothesisId:'H3,H4',location:'mockAgent.js:classifyIntake',message:'AI classifier result',data:{receivedAiResult:Boolean(ai),tradeType:ai?.trade_type||null,usedFallback:!ai?.trade_type},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (ai?.trade_type) return ai
  await wait(500)
  return {
    trade_type: detectTrade(message),
    summary: (message || names.join(', ')).slice(0, 160),
    has_attachments: names.length > 0,
  }
}

// STEP 2 — Document analysis agent
// Attachments are read and summarised as reference. They must not answer
// checklist questions — the user still answers those.
export async function analyzeAttachment(file) {
  try {
    const response = await fetch('/api/ai-file', {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-file-name': encodeURIComponent(file.name),
      },
      body: file,
    })
    return await response.json()
  } catch (error) {
    return { name: file.name, kind: 'failed', error: String(error) }
  }
}

export async function analyzeIntake(message, files) {
  const prepared = await Promise.all(files.map((file) => analyzeAttachment(file)))
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'post-fix',hypothesisId:'H1',location:'mockAgent.js:analyzeIntake',message:'Files prepared in browser',data:{files:prepared.map(p=>({name:p.name,kind:p.kind,error:p.error||null}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const readable = prepared.filter((file) => file.kind === 'text' || file.kind === 'file')
  const unreadable = prepared.filter((file) => !(file.kind === 'text' || file.kind === 'file'))
  const ai = readable.length
    ? await callAi({ action: 'analyze', message, files: readable })
    : null
  const intake = ai?.trade_type ? ai : await classifyIntake(message, files)
  return { ...intake, attachment_notes: ai?.attachment_notes || [], unreadable }
}

// STEP 3 — Requirement-gap agent
// PROMPT: "Given the trade checklist and extracted data, list which
// REQUIRED fields are missing or ambiguous. Rank by impact on price.
// Return { ready_to_generate, missing: [...] }."
export async function checkGaps(trade, collectedFields) {
  await wait(400)
  const checklist = CHECKLISTS[trade] || CHECKLISTS.general
  const missing = checklist.filter((item) => !collectedFields[item.field])
  return {
    ready_to_generate: missing.length === 0,
    missing,
  }
}

// STEP 5 — Estimation agent (plans line items) + pricing engine (computes
// totals in code — see lib/pricingEngine.js). The LLM never does the math.
// STEP 6 — Proposal writer agent, run once per tier.
// PROMPT (per tier): "Write a customer-facing proposal for the {tier}
// option using project_data, priced_items, and company_profile. Sections:
// summary, scope of work, materials, timeline, price summary, payment
// terms, warranty, exclusions, assumptions. Use only numbers provided."
async function callAi(body) {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const errorText = await response.text()
      // #region agent log
      fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'analyze-error',hypothesisId:'H5,H6',location:'mockAgent.js:callAi',message:'AI request returned an error',data:{action:body.action,status:response.status,error:errorText.slice(0,500)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

export async function aiStatus() {
  const status = await callAi({ action: 'status' })
  return status || { enabled: false, provider: null, model: null }
}

export async function generateProposals(trade, projectData) {
  const priced = priceAllTiers(trade, projectData)
  const written = await callAi({ action: 'write', trade, projectData, priced })
  if (!written) await wait(1200)

  const scopeByTrade = {
    plumbing: 'Supply and installation of plumbing fixtures, piping and fittings, with pressure testing and leak-proof waterproofing at all wet-area joints.',
    electrical: 'Complete wiring, switchgear and distribution board installation, tested and certified to local safety standards.',
    furniture: 'Design, fabrication and on-site installation of custom furniture, finished to the agreed specification.',
    civil: 'Structural and finishing work including material supply, execution and site cleanup on completion.',
    hvac: 'Supply, ducting/piping and installation of the cooling system, commissioned and load-tested before handover.',
    general: 'Supply and execution of the described work, inspected and handed over on completion.',
  }

  const tierNotes = {
    basic: 'Standard-grade materials and single-visit workmanship. Best for budget-conscious jobs with straightforward scope.',
    modern: 'Upgraded materials and finish quality, with a longer warranty and a dedicated site supervisor.',
    premium: 'Top-grade materials and fittings, priority scheduling, and the longest warranty with two free post-completion check-ups.',
  }

  const assumptions = [
    projectData.material_grade
      ? `Material preference recorded as: ${projectData.material_grade}.`
      : 'No specific brand was given — mid-market brands assumed per tier.',
    projectData.timeline ? `Target timeline: ${projectData.timeline}.` : 'Standard scheduling assumed.',
    'Site is accessible during normal working hours with water/power available on-site.',
    'Prices exclude any structural work not described in the scope above.',
  ]

  const out = {}
  for (const tier of ['basic', 'modern', 'premium']) {
    out[tier] = {
      ...priced[tier],
      scope: written?.scope || scopeByTrade[trade] || scopeByTrade.general,
      tierNote: written?.tierNotes?.[tier] || tierNotes[tier],
      assumptions: written?.assumptions?.length ? written.assumptions : assumptions,
      paymentTerms: written?.paymentTerms || '40% advance to confirm booking, 40% at midpoint, 20% on handover.',
      customer: projectData.customer_name || 'Prospective Customer',
      projectTitle: written?.projectTitle || projectData.summary || 'Proposed Work',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    }
  }

  // STEP 7 — QA/verifier agent would run here in production:
  // PROMPT: "Verify the proposal against source data — totals match the
  // pricing engine, no invented specs, assumptions listed. Return
  // { passed, issues }." If failed, regenerate the offending tier.

  return out
}
