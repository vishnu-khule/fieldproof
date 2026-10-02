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
      return parseJson(text)
    }
    const detail = await response.text()
    if (attempt < 2 && RETRYABLE.has(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)))
      continue
    }
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`)
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

// One request per file: a single combined request with several large plan sets times out.
export async function analyzeWithGemini(env, message, files) {
  const readable = files.filter((file) => file.kind === 'text' || file.kind === 'file')
  const notes = []
  const failures = []
  let trade = null
  let summary = ''

  for (const file of readable) {
    try {
      const result = await geminiJson(env, {
        system: `You analyse one reference attachment for a trade job (drawings, plans, estimates, work agreements). Summarise in one or two sentences what it is and the useful reference details (scope, rooms, key line items, materials, dimensions, location). Identify the trade it relates to. Attachments are reference only: do not answer the customer's job questions. Return JSON only: {"trade_type":"plumbing|electrical|furniture|civil|hvac|general","summary":"short job title","notes":""}.`,
        parts: [{ text: JSON.stringify({ user_message: message || '(no message)' }) }, ...fileParts(file)],
        maxTokens: 800,
        timeoutMs: 120000,
      })
      notes.push({ file: file.name, notes: String(result.notes || '').trim() })
      if (!trade && TRADES.includes(result.trade_type)) trade = result.trade_type
      if (!summary && result.summary) summary = String(result.summary)
    } catch (error) {
      failures.push({ name: file.name, error: error.message })
    }
  }

  if (message) {
    const classified = await classifyWithGemini(env, message, readable.map((f) => f.name))
    trade = classified.trade_type !== 'general' || !trade ? classified.trade_type : trade
    summary = classified.summary
  }

  const fileQuestions = notes.length ? await questionsFromNotes(env, message, notes) : []

  return {
    trade_type: trade || 'general',
    summary: String(summary || message || 'Proposed Work').slice(0, 160),
    has_attachments: files.length > 0,
    attachment_notes: notes,
    file_questions: fileQuestions,
    failures,
  }
}

// Questions must quote the files. The customer still has to confirm; notes are not answers.
async function questionsFromNotes(env, message, notes) {
  try {
    const result = await geminiJson(env, {
      system: `You write the follow-up questions for a remodeling estimate. The notes below are what the reference files contain. Return JSON only:
{"questions":[{"field":"area_or_units|site_condition|material_grade|timeline|file_scope|file_total","question":"","known":""}]}
Rules:
- Quote concrete facts from the notes: address, room list, area, remodel vs new, brands, timeline, or a prior dollar total. Never ask a generic question that could apply to any job.
- area_or_units: if the notes name rooms, area, or an address, question must repeat that list and ask if that is the full scope to price. known is that list in one line.
- site_condition: if the notes say remodel, renovation, addition, or new build, ask the user to confirm that. known is "Renovation" or "New".
- material_grade: only if the notes name brands, allowances, or a finish level. known is that phrase. Otherwise omit this field.
- timeline: only if the notes name a duration. Otherwise omit it.
- file_total: if the notes include a previous contract or estimate total, ask whether to re-price the scope from scratch (do not copy that total) or to match it. known is "Re-price from the scope. Do not copy the previous total."
- file_scope: if two files describe different addresses or projects, ask which project to price. Otherwise omit it.
- At most 5 questions. known is the value stored if the user confirms the file. question is one or two sentences.`,
      user: JSON.stringify({ user_message: message || '', notes }),
      maxTokens: 1200,
      timeoutMs: 60000,
    })
    const allowed = new Set(['area_or_units', 'site_condition', 'material_grade', 'timeline', 'file_scope', 'file_total'])
    return (Array.isArray(result.questions) ? result.questions : [])
      .filter((q) => allowed.has(q.field) && String(q.question || '').trim())
      .slice(0, 5)
      .map((q) => ({ field: q.field, question: String(q.question).trim(), known: String(q.known || '').trim() }))
  } catch {
    return []
  }
}

export async function takeoffWithGemini(env, { message, trade, answers, files }) {
  const brief = { text: JSON.stringify({ trade, customer_message: message, customer_answers: answers }) }
  const readable = (files || []).filter((file) => file.kind === 'text' || file.kind === 'file')
  const jobs = readable.length ? readable.map((file) => ({ file, parts: [brief, ...fileParts(file)] })) : [{ file: null, parts: [brief] }]

  const results = []
  const failures = []
  for (const job of jobs) {
    try {
      const result = await geminiJson(env, {
        system: TAKEOFF_SYSTEM,
        parts: job.parts,
        maxTokens: 16000,
        timeoutMs: 240000,
      })
      results.push({ file: job.file?.name || 'Customer brief', result })
    } catch (error) {
      failures.push({ name: job.file?.name || 'Customer brief', error: error.message })
    }
  }
  return mergeTakeoffs(results, failures)
}

function mergeTakeoffs(results, failures) {
  const project = {}
  const merged = { project, sheets: [], rooms: [], lines: [], exclusions: [], clarifications: [], assumptions: [], failures }
  const list = (value) => (Array.isArray(value) ? value : [])

  const perFile = []
  for (const { file, result } of results) {
    perFile.push({ file, address: result.project?.address || '', lines: list(result.lines).length, materials: list(result.lines).reduce((sum, line) => sum + (Number(line.materialAmount) || 0), 0) })
    for (const [key, value] of Object.entries(result.project || {})) {
      if (value && !project[key]) project[key] = String(value)
    }
    list(result.sheets).forEach((s) => merged.sheets.push({ file, ...s }))
    list(result.rooms).forEach((r) => merged.rooms.push(r))
    list(result.lines).forEach((l) => merged.lines.push({ ...l, source: l.source ? `${file} · ${l.source}` : '' }))
    list(result.exclusions).forEach((e) => merged.exclusions.push(e))
    list(result.clarifications).forEach((c) => merged.clarifications.push(c))
    list(result.assumptions).forEach((a) => merged.assumptions.push(String(a)))
  }
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',hypothesisId:'B',location:'gemini.js:mergeTakeoffs',message:'merged takeoff files',data:{files:perFile,keptAddress:project.address||''},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const uniqueBy = (items, key) => {
    const seen = new Set()
    return items.filter((item) => {
      const k = String(key(item)).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  merged.rooms = uniqueBy(merged.rooms, (r) => r.room)
  merged.exclusions = uniqueBy(merged.exclusions, (e) => e.item)
  merged.clarifications = uniqueBy(merged.clarifications, (c) => c.item)
  merged.assumptions = uniqueBy(merged.assumptions, (a) => a)
  return merged
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
