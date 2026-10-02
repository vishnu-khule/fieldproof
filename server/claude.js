// Server-side Claude calls. The API key never reaches the browser.
// Pricing stays in src/lib/estimate — this module only classifies and writes text.

import { WRITER_SYSTEM } from './prompts.js'
import { normaliseNarrative } from './gemini.js'

const TRADES = ['plumbing', 'electrical', 'furniture', 'civil', 'hvac', 'general']

export function claudeConfigured(env) {
  return Boolean(env.ANTHROPIC_API_KEY)
}

export async function claudeJson(env, { system, user, maxTokens = 800 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Claude ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  const text = (payload.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  return parseJson(text)
}

export async function classifyWithClaude(env, message, attachmentNames) {
  const result = await claudeJson(env, {
    system: `You are an intake assistant for trade professionals. From the user message and attachment file names, identify the trade. Attachments are reference only — do not invent job facts from file names. Return JSON only: {"trade_type":"plumbing|electrical|furniture|civil|hvac|general","summary":"short job title from the user's words"}.`,
    user: JSON.stringify({ message, attachment_names: attachmentNames }),
    maxTokens: 300,
  })
  const trade = TRADES.includes(result.trade_type) ? result.trade_type : 'general'
  const summary = String(result.summary || message || 'Proposed Work').slice(0, 160)
  return { trade_type: trade, summary, has_attachments: attachmentNames.length > 0 }
}

export async function writeProposalWithClaude(env, brief) {
  const result = await claudeJson(env, { system: WRITER_SYSTEM, user: JSON.stringify(brief), maxTokens: 2500 })
  return normaliseNarrative(result, brief)
}

function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Claude did not return JSON')
  return JSON.parse(raw.slice(start, end + 1))
}
