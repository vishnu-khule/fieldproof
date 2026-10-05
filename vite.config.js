import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  geminiConfigured,
  classifyWithGemini,
  writeProposalWithGemini,
  prepareFileForGemini,
  analyzeFileWithGemini,
  intakeWithGemini,
  takeoffFileWithGemini,
  verifyGeminiKey,
} from './server/gemini.js'
import { claudeConfigured, classifyWithClaude, writeProposalWithClaude } from './server/claude.js'

function aiApiPlugin(env) {
  return {
    name: 'ai-api',
    configureServer(server) {
      // Registered before /api/ai because connect prefix-matches that route too.
      server.middlewares.use('/api/ai-file', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const name = decodeURIComponent(req.headers['x-file-name'] || 'attachment')
        const mimeType = req.headers['content-type'] || ''
        try {
          if (!geminiConfigured(env)) {
            send(res, 503, { name, kind: 'unsupported', error: 'GEMINI_API_KEY is not set' })
            return
          }
          const buffer = await readRaw(req)
          send(res, 200, await prepareFileForGemini(env, { name, mimeType, buffer }))
        } catch (error) {
          send(res, 200, { name, kind: 'failed', error: error.message })
        }
      })

      server.middlewares.use('/api/ai', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }

        const provider = geminiConfigured(env) ? 'gemini' : claudeConfigured(env) ? 'claude' : null

        try {
          const body = await readBody(req)
          if (body.action === 'status') {
            if (provider === 'gemini') {
              const check = await verifyGeminiKey(env)
              send(res, 200, { enabled: check.ok, provider: 'Gemini', model: check.model, error: check.error || null })
            } else if (provider === 'claude') {
              send(res, 200, { enabled: true, provider: 'Claude', model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5' })
            } else {
              send(res, 200, { enabled: false, provider: null, model: null })
            }
            return
          }

          if (!provider) {
            send(res, 503, { error: 'No AI key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)' })
            return
          }

          const DOCUMENT_ACTIONS = { 'analyze-file': analyzeFile, intake, 'takeoff-file': takeoffFileWithGemini }
          if (DOCUMENT_ACTIONS[body.action]) {
            if (provider !== 'gemini') {
              send(res, 503, { error: 'Document analysis needs GEMINI_API_KEY' })
              return
            }
            send(res, 200, await DOCUMENT_ACTIONS[body.action](env, body))
            return
          }

          if (body.action === 'classify') {
            const result = provider === 'gemini'
              ? await classifyWithGemini(env, body.message || '', body.attachmentNames || [])
              : await classifyWithClaude(env, body.message || '', body.attachmentNames || [])
            send(res, 200, result)
            return
          }

          if (body.action === 'write') {
            const result = provider === 'gemini'
              ? await writeProposalWithGemini(env, body.brief)
              : await writeProposalWithClaude(env, body.brief)
            send(res, 200, result)
            return
          }

          send(res, 400, { error: 'Unknown action' })
        } catch (error) {
          if (error.keyRejected) send(res, 401, { error: 'The AI provider rejected the API key. Check the key in .env and restart the dev server.' })
          else if (error.status === 429) send(res, 429, { error: 'The AI provider is rate-limiting requests. Wait a minute and try again.' })
          else send(res, 502, { error: error.message })
        }
      })
    },
  }
}

const analyzeFile = (env, body) => analyzeFileWithGemini(env, body.message || '', body.file)
const intake = (env, body) => intakeWithGemini(env, body.message || '', body.analyses || [])

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), aiApiPlugin(env)],
    server: { port: 5173 },
    // ExcelJS is loaded on demand when the user exports, so its chunk size doesn't affect page load.
    build: { chunkSizeWarningLimit: 1000 },
  }
})
