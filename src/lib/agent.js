// Browser-side orchestration. AI calls go through /api/ai (vite.config.js);
// every number is computed locally in ./estimate.

import { detectTrade, CHECKLISTS } from './tradeChecklists'
import { rollupAll } from './estimate/rollup'
import { templateTakeoff } from './estimate/templates'
import { validateLines } from './estimate/validate'
import { groupProjects, mergeTakeoffs } from './estimate/merge'
import { buildSchedule } from './estimate/schedule'
import { VARIANTS, VARIANT_KEYS, rateBasisNote, resolveRateBasis } from './estimate/config'

let lastAiError = null

// Returns null on failure (callers fall back to templates) and keeps the reason for the chat.
async function callAi(body) {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      lastAiError = { status: response.status, message: payload.error || `AI request failed (${response.status})` }
      return null
    }
    return await response.json()
  } catch (error) {
    lastAiError = { status: 0, message: `Could not reach the AI service: ${error.message}` }
    return null
  }
}

// Key and rate-limit problems are worth telling the user once; other failures already fall back quietly.
export function takeAiError() {
  const error = lastAiError
  lastAiError = null
  return error && (error.status === 401 || error.status === 429 || error.status === 0) ? error.message : null
}

export async function aiStatus() {
  return (await callAi({ action: 'status' })) || { enabled: false, provider: null, model: null, error: takeAiError() }
}

export async function classifyIntake(message, names = []) {
  const ai = await callAi({ action: 'classify', message, attachmentNames: names })
  if (ai?.trade_type) return ai
  return { trade_type: detectTrade(message), summary: (message || names.join(', ')).slice(0, 160), has_attachments: names.length > 0 }
}

// Uploads each file once; the prepared references are reused for analysis and takeoff.
export async function prepareFiles(files) {
  return Promise.all(
    files.map(async (file) => {
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
    })
  )
}

const isReadable = (file) => file.kind === 'text' || file.kind === 'file'

export async function analyzeIntake(message, prepared, onProgress = () => {}) {
  const readable = prepared.filter(isReadable)
  const unreadable = prepared.filter((file) => !isReadable(file))
  const analyses = []
  for (const [i, file] of readable.entries()) {
    onProgress(`Reading file ${i + 1} of ${readable.length} — ${file.name}…`)
    const result = await callAi({ action: 'analyze-file', message, file })
    if (result) analyses.push(result)
    else unreadable.push({ name: file.name, error: 'analysis failed' })
  }

  onProgress('Working out what to ask you…')
  const ai = analyses.length ? await callAi({ action: 'intake', message, analyses }) : null
  const intake = ai?.trade_type ? ai : await classifyIntake(message, prepared.map((f) => f.name))
  return {
    ...intake,
    file_questions: ai?.file_questions || [],
    analyses,
    attachment_notes: analyses.filter((a) => a.relevant).map((a) => ({ file: a.file, notes: a.notes })),
    irrelevant: analyses.filter((a) => !a.relevant),
    priorTotals: analyses.filter((a) => a.prior_total > 0).map((a) => ({ file: a.file, label: 'Prior estimate total', amount: a.prior_total })),
    ...groupProjects(analyses),
    unreadable,
  }
}

// Re-asks the file-based questions after the user narrows the job to one project.
export async function intakeQuestions(message, analyses) {
  if (!analyses.length) return []
  const ai = await callAi({ action: 'intake', message, analyses })
  return ai?.file_questions || []
}

const CONFIRM = 'Yes — use what the files show'
const DECLINE = "No — I'll specify"

export function checkGaps(trade, collectedFields, fileQuestions = []) {
  const checklist = CHECKLISTS[trade] || CHECKLISTS.general
  const fromFiles = new Map(fileQuestions.filter((q) => q?.question).map((q) => [q.field, q]))
  const missing = []

  for (const item of checklist) {
    if (collectedFields[item.field]) continue
    const fromFile = fromFiles.get(item.field)
    if (fromFile?.known) {
      missing.push({
        field: item.field,
        question: fromFile.question,
        options: [CONFIRM, DECLINE],
        confirm: { label: CONFIRM, value: fromFile.known },
        decline: { label: DECLINE, question: item.question, options: item.options },
      })
    } else if (fromFile) {
      missing.push({ field: item.field, question: fromFile.question, options: item.options })
    } else {
      missing.push(item)
    }
  }

  for (const q of fileQuestions) {
    if (!q?.question || checklist.some((item) => item.field === q.field) || collectedFields[q.field]) continue
    missing.push(q.known
      ? { field: q.field, question: q.question, options: [CONFIRM, DECLINE], confirm: { label: CONFIRM, value: q.known }, decline: { label: DECLINE, question: q.question } }
      : { field: q.field, question: q.question, options: q.options })
  }

  return { ready_to_generate: missing.length === 0, missing }
}

// The takeoff is the reviewed scope: lines with source, quantity, hours and confidence.
// `prepared` must already be limited to the files of the chosen project.
export async function buildTakeoff({ trade, fields, message, prepared, priorTotals = [], onProgress = () => {} }) {
  const readable = prepared.filter(isReadable)
  const fallback = templateTakeoff(trade, fields)
  const jobs = readable.length ? readable : [null]
  const results = []
  const failures = []
  for (const [i, file] of jobs.entries()) {
    onProgress(file ? `Extracting scope from file ${i + 1} of ${jobs.length} — ${file.name}…` : 'Extracting scope from your brief…')
    const result = await callAi({ action: 'takeoff-file', message, trade, answers: fields, file })
    if (result?.result) results.push(result)
    else if (file) failures.push({ name: file.name })
  }
  onProgress('Checking quantities, sources and confidence tags…')
  const ai = results.length ? mergeTakeoffs(results, failures) : null

  if (!ai?.lines?.length) {
    const rateBasis = resolveRateBasis([])
    return {
      ...fallback,
      warnings: [],
      priorTotals,
      rateBasis,
      assumptions: [...fallback.assumptions, rateBasisNote(rateBasis)],
      failures,
      note: readable.length
        ? 'The AI could not extract a takeoff from the attachments, so this uses the standard template for your answers.'
        : null,
    }
  }

  const allPriors = [...priorTotals, ...ai.priorTotals]
  const { lines, warnings } = validateLines(ai.lines, { priorTotals: allPriors })
  const rateBasis = resolveRateBasis(ai.workbookRates)
  return {
    source: 'ai',
    project: { ...fallback.project, ...ai.project },
    sheets: ai.sheets || [],
    rooms: ai.rooms?.length ? ai.rooms : fallback.rooms,
    lines,
    exclusions: ai.exclusions?.length ? ai.exclusions : fallback.exclusions,
    clarifications: ai.clarifications || [],
    assumptions: [...(ai.assumptions?.length ? ai.assumptions : fallback.assumptions), rateBasisNote(rateBasis)],
    priorTotals: allPriors,
    rateBasis,
    warnings,
    failures,
  }
}

function fallbackNarrative(trade, fields, takeoff, estimates) {
  const title = takeoff.project?.title || fields.summary || 'Proposed Work'
  const active = estimates.basic.categories.filter((c) => c.items.length).map((c) => c.name)
  return {
    projectTitle: title,
    executiveSummary: `This proposal covers ${title.toLowerCase()} for ${fields.customer_name || 'the customer'}. It is built from ${takeoff.sheets.length ? `${takeoff.sheets.length} reviewed drawing sheets` : 'the project brief'} and priced across Basic, Modern and Premium finish levels on the same scope.`,
    scopeNarrative: `Work includes ${active.slice(0, -1).join(', ')}${active.length > 1 ? ' and ' : ''}${active.slice(-1)}. Items marked Verify in Field will be confirmed on site before contract pricing.`,
    paymentTerms: '30% deposit on signing, 30% at rough-in inspection, 30% at finishes, 10% on completion and walkthrough.',
    variantNotes: Object.fromEntries(VARIANT_KEYS.map((k) => [k, VARIANTS[k].finishNote])),
    assumptions: takeoff.assumptions,
  }
}

function writerBrief(trade, fields, takeoff, estimates) {
  return {
    trade,
    customer_answers: fields,
    project: takeoff.project,
    rooms: takeoff.rooms,
    scope_by_category: estimates.basic.categories
      .filter((c) => c.items.length)
      .map((c) => ({ category: c.name, items: c.items.map((l) => `${l.scope} (${l.qty} ${l.unit})`) })),
    clarifications: takeoff.clarifications.map((c) => c.item),
    totals: Object.fromEntries(VARIANT_KEYS.map((k) => [k, { total: estimates[k].total, warrantyMonths: estimates[k].warrantyMonths }])),
  }
}

export async function generateProposal({ trade, fields, takeoff, onProgress = () => {} }) {
  onProgress('Pricing Basic, Modern and Premium from the formula…')
  const rateBasis = takeoff.rateBasis || resolveRateBasis([])
  const estimates = rollupAll(takeoff.lines, { rates: rateBasis.rates, opPercent: rateBasis.opPercent })
  const fallback = fallbackNarrative(trade, fields, takeoff, estimates)
  onProgress('Writing the proposal narrative…')
  const written = await callAi({ action: 'write', brief: writerBrief(trade, fields, takeoff, estimates) })

  const narrative = {
    projectTitle: written?.projectTitle || fallback.projectTitle,
    executiveSummary: written?.executiveSummary || fallback.executiveSummary,
    scopeNarrative: written?.scopeNarrative || fallback.scopeNarrative,
    paymentTerms: written?.paymentTerms || fallback.paymentTerms,
    variantNotes: Object.fromEntries(VARIANT_KEYS.map((k) => [k, written?.variantNotes?.[k] || fallback.variantNotes[k]])),
    assumptions: written?.assumptions?.length ? written.assumptions : fallback.assumptions,
  }

  return {
    takeoff,
    estimates,
    narrative,
    schedule: buildSchedule(takeoff.lines),
    meta: {
      trade,
      customer: fields.customer_name || 'Prospective Customer',
      date: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      aiWritten: Boolean(written),
    },
  }
}
