// Server-side Gemini calls. The API key never reaches the browser.
// Pricing stays in pricingEngine.js — this module only writes text and classifies.

const TRADES = ['plumbing', 'electrical', 'furniture', 'civil', 'hvac', 'general']

export function geminiConfigured(env) {
  return Boolean(env.GEMINI_API_KEY)
}

const API_BASE = 'https://generativelanguage.googleapis.com'
const MAX_TEXT_CHARS = 60000

export async function geminiJson(env, { system, user, parts, maxTokens = 1200 }) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const url = `${API_BASE}/v1beta/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: 'user', parts: parts || [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const candidate = payload.candidates?.[0]
  const text = candidate?.content?.parts?.map((p) => p.text).join('\n') || ''
  return parseJson(text)
}

export async function classifyWithGemini(env, message, attachmentNames) {
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'attachment-analysis-1',hypothesisId:'H2,H3',location:'server/gemini.js:classifyWithGemini',message:'Calling Gemini classifier',data:{model:env.GEMINI_MODEL||'gemini-3.5-flash-lite',attachmentNames,attachmentPolicy:'reference-only filenames; no file contents'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  return { name, kind: 'unsupported' }
}

async function uploadToGemini(env, name, mimeType, buffer) {
  const start = await fetch(`${API_BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': env.GEMINI_API_KEY,
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
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
  })
  if (!done.ok) throw new Error(`Gemini upload ${done.status}: ${(await done.text()).slice(0, 200)}`)

  let { file } = await done.json()
  // Gemini processes large PDFs asynchronously; they cannot be referenced until ACTIVE.
  for (let i = 0; file?.state === 'PROCESSING' && i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const poll = await fetch(`${API_BASE}/v1beta/${file.name}`, {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
    })
    file = await poll.json()
  }
  if (!file || file.state === 'FAILED') throw new Error('Gemini could not process this file')
  if (file.state === 'PROCESSING') throw new Error('Gemini is still processing this file')
  return file
}

export async function analyzeWithGemini(env, message, files) {
  const readable = files.filter((file) => file.kind === 'text' || file.kind === 'file')
  const parts = [{ text: JSON.stringify({ user_message: message || '(no message — only attachments were sent)' }) }]
  for (const file of readable) {
    if (file.kind === 'text') {
      parts.push({ text: `Attachment "${file.name}":\n${file.text}` })
    } else {
      parts.push({ text: `Attachment "${file.name}":` })
      parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } })
    }
  }

  const result = await geminiJson(env, {
    system: `You analyse a tradesperson's job request together with their reference attachments (old proposals, estimates, work agreements, drawings, plans). Identify the trade from the user's message first; if the message is empty or vague, infer it from the attachments. For each attachment, summarise in one or two sentences what it is and the useful reference details (scope, key line items, materials, rates, dimensions, location). Attachments are reference only: do not decide the answers to the job questions. Return JSON only: {"trade_type":"plumbing|electrical|furniture|civil|hvac|general","summary":"short job title","attachment_notes":[{"file":"","notes":""}]}.`,
    parts,
    maxTokens: 2000,
  })

  const trade = TRADES.includes(result.trade_type) ? result.trade_type : 'general'
  return {
    trade_type: trade,
    summary: String(result.summary || message || 'Proposed Work').slice(0, 160),
    has_attachments: files.length > 0,
    attachment_notes: Array.isArray(result.attachment_notes)
      ? result.attachment_notes.map((note) => ({ file: String(note.file || ''), notes: String(note.notes || '') }))
      : [],
  }
}

export async function writeProposalWithGemini(env, trade, projectData, priced) {
  const pricedBrief = Object.fromEntries(
    ['basic', 'modern', 'premium'].map((tier) => [
      tier,
      {
        title: priced[tier].title,
        total: priced[tier].total,
        currency: priced[tier].currency,
        warrantyMonths: priced[tier].warrantyMonths,
        items: priced[tier].items.map((item) => ({
          description: item.description,
          qty: item.qty,
          unit: item.unit,
          amount: item.amount,
        })),
      },
    ])
  )

  const result = await geminiJson(env, {
    system: `You write customer-facing trade proposals. Use only the project answers and the priced line items given to you. Do not invent prices, quantities, brands, or dimensions. Attachments were reference only and are not a source of facts. Return JSON only with this shape: {"projectTitle":"","scope":"","paymentTerms":"","tierNotes":{"basic":"","modern":"","premium":""},"assumptions":["",""]}.`,
    user: JSON.stringify({ trade, project: projectData, priced: pricedBrief }),
    maxTokens: 1500,
  })

  return {
    projectTitle: String(result.projectTitle || projectData.summary || 'Proposed Work').slice(0, 160),
    scope: String(result.scope || '').trim(),
    paymentTerms: String(result.paymentTerms || '').trim(),
    tierNotes: {
      basic: String(result.tierNotes?.basic || '').trim(),
      modern: String(result.tierNotes?.modern || '').trim(),
      premium: String(result.tierNotes?.premium || '').trim(),
    },
    assumptions: Array.isArray(result.assumptions)
      ? result.assumptions.map((item) => String(item)).filter(Boolean).slice(0, 6)
      : [],
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
