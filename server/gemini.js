// Server-side Gemini calls. The API key never reaches the browser.
// Gemini reads documents and extracts the takeoff; all money is computed in src/lib/estimate.

import { TAKEOFF_SYSTEM, WRITER_SYSTEM } from './prompts.js'

const TRADES = ['plumbing', 'electrical', 'furniture', 'civil', 'hvac', 'general']
const API_BASE = 'https://generativelanguage.googleapis.com'
const MAX_TEXT_CHARS = 60000
const RETRYABLE = new Set([429, 500, 503])

export function geminiConfigured(env) {
  return Boolean(env.GEMINI_API_KEY)
}

function geminiHeaders(env, extra = {}) {
  const headers = { 'x-goog-api-key': env.GEMINI_API_KEY, ...extra }
  if (env.GEMINI_PROJECT_NUMBER) headers['x-goog-user-project'] = env.GEMINI_PROJECT_NUMBER
  return headers
}

export async function geminiJson(env, { system, user, parts, maxTokens = 1200, timeoutMs = 90000 }) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const url = `${API_BASE}/v1beta/models/${model}:generateContent`
  const body = JSON.stringify({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: 'user', parts: parts || [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
  })

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: geminiHeaders(env, { 'content-type': 'application/json' }),
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.ok) {
      const payload = await response.json()
      const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || ''
      try {
        return parseJson(text)
      } catch (error) {
        // Long takeoffs occasionally come back truncated or malformed; one fresh attempt usually fixes it.
        if (attempt < 1) continue
        throw error
      }
    }
    const detail = await response.text()
    if (attempt < 2 && RETRYABLE.has(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
      continue
    }
    throw geminiError(response.status, detail)
  }
}

function geminiError(status, detail) {
  const error = new Error(`Gemini ${status}: ${detail.slice(0, 300)}`)
  error.status = status
  error.keyRejected = status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail)
  return error
}

// The status check makes one cheap call so a wrong key shows up before the user uploads anything.
export async function verifyGeminiKey(env) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  try {
    const response = await fetch(`${API_BASE}/v1beta/models/${model}`, { headers: geminiHeaders(env), signal: AbortSignal.timeout(10000) })
    if (response.ok) return { ok: true, model }
    const error = geminiError(response.status, await response.text())
    return { ok: false, model, error: error.keyRejected ? 'Gemini rejected the API key' : `Gemini returned ${response.status}` }
  } catch {
    return { ok: false, model, error: 'Gemini could not be reached' }
  }
}

export async function classifyWithGemini(env, message, attachmentNames) {
  const result = await geminiJson(env, {
    system: `You are an intake assistant for trade professionals. From the user message and attachment file names, identify the trade. Attachments are reference only — do not invent job facts from file names. Return JSON only: {"trade_type":"plumbing|electrical|furniture|civil|hvac|general","summary":"short job title from the user's words"}.`,
    user: JSON.stringify({ message, attachment_names: attachmentNames }),
    maxTokens: 300,
  })
  const trade = TRADES.includes(result.trade_type) ? result.trade_type : 'general'
  const summary = String(result.summary || message || 'Proposed Work').slice(0, 160)
  return { trade_type: trade, summary, has_attachments: attachmentNames.length > 0 }
}

// Spreadsheets become text because Gemini cannot read .xlsx directly.
// PDFs and images go through the Gemini Files API so large plans fit.
export async function prepareFileForGemini(env, { name, mimeType, buffer }) {
  const lower = name.toLowerCase()
  if (/\.(xlsx|xls|csv)$/.test(lower)) {
    const mod = await import('xlsx')
    const XLSX = mod.default || mod
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const text = workbook.SheetNames
      .map((sheet) => `# Sheet: ${sheet}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])}`)
      .join('\n\n')
    return { name, kind: 'text', text: text.slice(0, MAX_TEXT_CHARS) }
  }
  if (/\.(txt|md)$/.test(lower) || mimeType.startsWith('text/')) {
    return { name, kind: 'text', text: buffer.toString('utf8').slice(0, MAX_TEXT_CHARS) }
  }
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf') || mimeType.startsWith('image/')) {
    const type = mimeType || 'application/pdf'
    const uploaded = await uploadToGemini(env, name, type, buffer)
    return { name, kind: 'file', uri: uploaded.uri, mimeType: uploaded.mimeType || type }
  }
  return { name, kind: 'unsupported', error: 'Unsupported file type' }
}

async function uploadToGemini(env, name, mimeType, buffer) {
  const start = await fetch(`${API_BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      ...geminiHeaders(env),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name } }),
  })
  if (!start.ok) throw new Error(`Gemini upload start ${start.status}: ${(await start.text()).slice(0, 200)}`)
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Gemini did not return an upload URL')

  const done = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: buffer,
  })
  if (!done.ok) throw new Error(`Gemini upload ${done.status}: ${(await done.text()).slice(0, 200)}`)

  let { file } = await done.json()
  // Gemini processes large PDFs asynchronously; they cannot be referenced until ACTIVE.
  for (let i = 0; file?.state === 'PROCESSING' && i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const poll = await fetch(`${API_BASE}/v1beta/${file.name}`, { headers: geminiHeaders(env) })
    file = await poll.json()
  }
  if (!file || file.state === 'FAILED') throw new Error('Gemini could not process this file')
  if (file.state === 'PROCESSING') throw new Error('Gemini is still processing this file')
  return file
}

function fileParts(file) {
  if (file.kind === 'text') return [{ text: `Attachment "${file.name}":\n${file.text}` }]
  return [{ text: `Attachment "${file.name}":` }, { fileData: { mimeType: file.mimeType, fileUri: file.uri } }]
}

const DOCUMENT_TYPES = ['drawings', 'estimate', 'agreement', 'photo', 'spreadsheet', 'other']

// One request per file (the browser loops) so large plan sets don't time out and progress is visible.
export async function analyzeFileWithGemini(env, message, file) {
  const result = await geminiJson(env, {
    system: `You analyse one reference attachment for a remodeling or trade job. Return JSON only:
{"trade_type":"plumbing|electrical|furniture|civil|hvac|general","summary":"short job title","notes":"","document_type":"${DOCUMENT_TYPES.join('|')}","relevant":true,"assessment":"","address":"","prior_total":0}
- notes: one or two sentences on what the file is and the useful reference details (scope, rooms, key line items, materials, dimensions, location).
- document_type: drawings for plans/permit sets, estimate for a prior estimate/quote/bid, agreement for a contract, photo for site photos.
- relevant: false when the file is not about a construction or trade job (e.g. a resume, invoice for something else, unrelated document). assessment: one sentence saying what the file actually is.
- address: the project street address exactly as written in the file, or "".
- prior_total: the grand total in USD if this is a prior estimate, quote or contract, else 0.
Attachments are reference only: do not answer the customer's job questions.`,
    parts: [{ text: JSON.stringify({ user_message: message || '(no message)' }) }, ...fileParts(file)],
    maxTokens: 900,
    timeoutMs: 120000,
  })
  return {
    file: file.name,
    notes: String(result.notes || '').trim(),
    trade_type: TRADES.includes(result.trade_type) ? result.trade_type : null,
    summary: String(result.summary || '').trim(),
    document_type: DOCUMENT_TYPES.includes(result.document_type) ? result.document_type : 'other',
    relevant: result.relevant !== false,
    assessment: String(result.assessment || '').trim(),
    address: String(result.address || '').trim(),
    prior_total: Math.max(0, Number(result.prior_total) || 0),
  }
}

export async function intakeWithGemini(env, message, analyses) {
  const relevant = analyses.filter((a) => a.relevant)
  let trade = relevant.find((a) => a.trade_type)?.trade_type || null
  let summary = relevant.find((a) => a.summary)?.summary || ''
  if (message) {
    const classified = await classifyWithGemini(env, message, analyses.map((a) => a.file))
    trade = classified.trade_type !== 'general' || !trade ? classified.trade_type : trade
    summary = classified.summary
  }
  const notes = relevant.map((a) => ({ file: a.file, notes: a.notes }))
  return {
    trade_type: trade || 'general',
    summary: String(summary || message || 'Proposed Work').slice(0, 160),
    file_questions: notes.length ? await questionsFromNotes(env, message, notes) : [],
  }
}

// Questions must quote the files. The customer still has to confirm; notes are not answers.
async function questionsFromNotes(env, message, notes) {
  try {
    const result = await geminiJson(env, {
      system: `You write the follow-up questions for a remodeling estimate. The notes below are what the reference files contain. Return JSON only:
{"questions":[{"field":"area_or_units|site_condition|material_grade|timeline|file_total","question":"","known":""}]}
Rules:
- Quote concrete facts from the notes: address, room list, area, remodel vs new, brands, timeline, or a prior dollar total. Never ask a generic question that could apply to any job.
- area_or_units: if the notes name rooms, area, or an address, question must repeat that list and ask if that is the full scope to price. known is that list in one line.
- site_condition: if the notes say remodel, renovation, addition, or new build, ask the user to confirm that. known is "Renovation" or "New".
- material_grade: only if the notes name brands, allowances, or a finish level. known is that phrase. Otherwise omit this field.
- timeline: only if the notes name a duration. Otherwise omit it.
- file_total: if the notes include a previous contract or estimate total, ask whether to re-price the scope from scratch (do not copy that total) or to match it. known is "Re-price from the scope. Do not copy the previous total."
- Do not ask which project or address to price; the application asks that itself.
- At most 5 questions. known is the value stored if the user confirms the file. question is one or two sentences.`,
      user: JSON.stringify({ user_message: message || '', notes }),
      maxTokens: 1200,
      timeoutMs: 60000,
    })
    const allowed = new Set(['area_or_units', 'site_condition', 'material_grade', 'timeline', 'file_total'])
    return (Array.isArray(result.questions) ? result.questions : [])
      .filter((q) => allowed.has(q.field) && String(q.question || '').trim())
      .slice(0, 5)
      .map((q) => ({ field: q.field, question: String(q.question).trim(), known: String(q.known || '').trim() }))
  } catch {
    return []
  }
}

// One file per request; the browser merges files (src/lib/estimate/merge.js) and reports progress.
export async function takeoffFileWithGemini(env, { message, trade, answers, file }) {
  const brief = { text: JSON.stringify({ trade, customer_message: message, customer_answers: answers }) }
  const parts = file ? [brief, ...fileParts(file)] : [brief]
  const result = await geminiJson(env, { system: TAKEOFF_SYSTEM, parts, maxTokens: 16000, timeoutMs: 240000 })
  return { file: file?.name || 'Customer brief', result }
}

export async function writeProposalWithGemini(env, brief) {
  const result = await geminiJson(env, { system: WRITER_SYSTEM, user: JSON.stringify(brief), maxTokens: 2500 })
  return normaliseNarrative(result, brief)
}

export function normaliseNarrative(result, brief) {
  const text = (value) => String(value || '').trim()
  return {
    projectTitle: text(result.projectTitle || brief.project?.title).slice(0, 160),
    executiveSummary: text(result.executiveSummary),
    scopeNarrative: text(result.scopeNarrative),
    paymentTerms: text(result.paymentTerms),
    variantNotes: {
      basic: text(result.variantNotes?.basic),
      modern: text(result.variantNotes?.modern),
      premium: text(result.variantNotes?.premium),
    },
    assumptions: Array.isArray(result.assumptions) ? result.assumptions.map(text).filter(Boolean).slice(0, 8) : [],
  }
}

function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Gemini did not return JSON')
  return JSON.parse(raw.slice(start, end + 1))
}
