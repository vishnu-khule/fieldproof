import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  geminiConfigured,
  classifyWithGemini,
  writeProposalWithGemini,
  prepareFileForGemini,
  analyzeWithGemini,
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
          const prepared = await prepareFileForGemini(env, { name, mimeType, buffer })
          // #region agent log
          fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'post-fix',hypothesisId:'H1',location:'vite.config.js:/api/ai-file',message:'File prepared for Gemini',data:{name,mimeType,bytes:buffer.length,kind:prepared.kind,textChars:prepared.text?.length||0,hasUri:Boolean(prepared.uri)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          send(res, 200, prepared)
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'post-fix',hypothesisId:'H1',location:'vite.config.js:/api/ai-file',message:'File preparation failed',data:{name,mimeType,error:String(error.message).slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'attachment-analysis-1',hypothesisId:'H1,H3',location:'vite.config.js:/api/ai',message:'AI server received request',data:{action:body.action,provider,attachmentNames:body.attachmentNames||[],hasFileBytes:Boolean(body.file||body.files||body.fileData||body.contents)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (body.action === 'status') {
            if (provider === 'gemini') {
              send(res, 200, { enabled: true, provider: 'Gemini', model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite' })
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

          if (body.action === 'analyze') {
            if (provider !== 'gemini') {
              send(res, 503, { error: 'File analysis needs GEMINI_API_KEY' })
              return
            }
            const result = await analyzeWithGemini(env, body.message || '', body.files || [])
            // #region agent log
            fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'post-fix',hypothesisId:'H1,H2',location:'vite.config.js:/api/ai analyze',message:'Gemini analysed attachments',data:{filesSent:(body.files||[]).map(f=>({name:f.name,kind:f.kind})),tradeType:result.trade_type,summary:result.summary,notesCount:result.attachment_notes.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            send(res, 200, result)
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
              ? await writeProposalWithGemini(env, body.trade, body.projectData, body.priced)
              : await writeProposalWithClaude(env, body.trade, body.projectData, body.priced)
            send(res, 200, result)
            return
          }

          send(res, 400, { error: 'Unknown action' })
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'analyze-error',hypothesisId:'H5,H6,H7',location:'vite.config.js:/api/ai catch',message:'AI request threw',data:{error:String(error?.message||error).slice(0,500)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          send(res, 502, { error: error.message })
        }
      })
    },
  }
}

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
  }
})
