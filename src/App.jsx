import { useEffect, useRef, useState } from 'react'
import InputBar from './components/InputBar'
import MissingInfoCard from './components/MissingInfoCard'
import ProposalDocument from './components/ProposalDocument'
import ShareBar from './components/ShareBar'
import { classifyIntake, analyzeIntake, checkGaps, generateProposals, aiStatus } from './lib/mockAgent'
import { deferredChoice } from './lib/tradeChecklists'

function attachmentReport(intake) {
  const lines = []
  if (intake.attachment_notes?.length) {
    lines.push('I went through your attachments:')
    for (const note of intake.attachment_notes) lines.push(`• ${note.file}: ${note.notes}`)
  }
  if (intake.unreadable?.length) {
    lines.push(`I couldn't read: ${intake.unreadable.map((file) => `${file.name}${file.error ? ` (${file.error})` : ''}`).join('; ')}.`)
  }
  if (!lines.length) lines.push("I couldn't analyse the attachments, so I'll work from your message.")
  lines.push("I'll use these as reference only — please answer the questions below.")
  return lines.join('\n')
}

// App state machine: idle -> uploading/analysing -> clarifying -> generating -> review
const STAGE = {
  IDLE: 'idle',
  WORKING: 'working',
  CLARIFYING: 'clarifying',
  GENERATING: 'generating',
  REVIEW: 'review',
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: "Hi — tell me about the job. You can describe the work in your own words and attach any old proposals, estimates, or drawings you'd like me to reference.",
    },
  ])
  const [stage, setStage] = useState(STAGE.IDLE)
  const [trade, setTrade] = useState(null)
  const [fields, setFields] = useState({})
  const [missing, setMissing] = useState([])
  const [proposals, setProposals] = useState(null)
  const [activeTier, setActiveTier] = useState('modern')
  const [ai, setAi] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    aiStatus().then(setAi)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, missing])

  const pushAgent = (text) => setMessages((m) => [...m, { role: 'agent', text }])
  const pushUser = (text, files = []) => setMessages((m) => [...m, { role: 'user', text, files }])

  async function runGapCheck(tradeType, currentFields) {
    const gap = await checkGaps(tradeType, currentFields)
    if (gap.ready_to_generate) {
      setMissing([])
      setStage(STAGE.GENERATING)
      pushAgent("Got everything I need. Generating Basic, Modern, and Premium options now…")
      const result = await generateProposals(tradeType, {
        ...currentFields,
        customer_name: currentFields.customer_name,
      })
      setProposals(result)
      setStage(STAGE.REVIEW)
      pushAgent('Done — three proposal options are ready on the right. Review, edit if needed, and share with your customer.')
    } else {
      setMissing(gap.missing)
      setStage(STAGE.CLARIFYING)
    }
  }

  async function handleSend(text, files) {
    if (!text && files.length === 0) return
    // #region agent log
    fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',runId:'attachment-analysis-1',hypothesisId:'H1,H4',location:'App.jsx:handleSend',message:'User submitted message and attachments',data:{textLength:text.length,fileCount:files.length,files:files.map(file=>({name:file.name,type:file.type,size:file.size})),stage,trade},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    pushUser(text, files)
    setStage(STAGE.WORKING)
    setMissing([])

    let currentTrade = trade
    let currentFields = { ...fields }

    if (!currentTrade) {
      const intake = files.length ? await analyzeIntake(text, files) : await classifyIntake(text, files)
      currentTrade = intake.trade_type
      setTrade(currentTrade)
      currentFields.summary = (text || intake.summary || files.map((file) => file.name).join(', ')).slice(0, 160)
      const tradeLabel = currentTrade === 'general' ? 'general trade' : currentTrade
      if (files.length) pushAgent(attachmentReport(intake))
      pushAgent(`This looks like a ${tradeLabel} job. I need a few details from you before I can write the proposal.`)
    } else if (text && missing.length > 0) {
      // Free-text questions have no chips, so the reply arrives through the chat box.
      const target = missing.find((item) => !item.options) || missing[0]
      currentFields[target.field] = text
    } else if (missing.length === 0) {
      if (files.length) {
        pushAgent(attachmentReport(await analyzeIntake(text, files)))
      } else {
        pushAgent('The proposal already uses the details you gave me. Tell me what to change — size, material, or timeline — and I will regenerate it.')
      }
      setStage(proposals ? STAGE.REVIEW : STAGE.IDLE)
      return
    } else {
      currentFields.summary = currentFields.summary || text
    }

    setFields(currentFields)
    await runGapCheck(currentTrade, currentFields)
  }

  async function handleAnswer(field, value) {
    pushUser(value)
    const proposed = deferredChoice(trade, field, value)
    if (proposed) {
      const nextMissing = missing.map((item) => (item.field === field ? { field, ...proposed } : item))
      pushAgent(`${proposed.question}\n${proposed.options.map((opt) => `• ${opt}`).join('\n')}`)
      setMissing(nextMissing)
      setStage(STAGE.CLARIFYING)
      return
    }
    const currentFields = { ...fields, [field]: value }
    setFields(currentFields)
    setStage(STAGE.WORKING)
    setMissing([])
    await runGapCheck(trade, currentFields)
  }

  function handleDownloadPdf() {
    window.print()
  }

  const busy = stage === STAGE.WORKING || stage === STAGE.GENERATING

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">field<span>proof</span></div>
          <div className="brand-tag">AI PROPOSAL &amp; ESTIMATION GENERATOR</div>
        </div>
        <div className="topbar-meta">
          <span className="dot" />
          {ai?.enabled
            ? `${ai.provider || 'AI'} · ${ai.model}`
            : 'AI not connected — using built-in drafts'}
        </div>
      </header>

      <div className="workspace">
        <section className="convo-col">
          <div className="convo-scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div className={`msg msg-${m.role}`} key={i}>
                <span className="msg-label">{m.role === 'agent' ? 'Fieldproof AI' : 'You'}</span>
                {m.text && <div className="msg-body">{m.text}</div>}
                {m.files?.length > 0 && (
                  <div className="attach-row">
                    {m.files.map((f, idx) => (
                      <div className="attach-chip done" key={idx}>📎 {f.name}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="msg msg-agent">
                <span className="msg-label">Fieldproof AI</span>
                <div className="attach-chip"><span className="spin" /> {stage === STAGE.GENERATING ? 'Pricing tiers & drafting proposals…' : 'Analysing…'}</div>
              </div>
            )}
            {missing.length > 0 && stage === STAGE.CLARIFYING && (
              <MissingInfoCard missing={missing} onAnswer={handleAnswer} />
            )}
          </div>
          <InputBar onSend={handleSend} disabled={busy} />
        </section>

        <section className="result-col">
          {!proposals ? (
            <div className="empty-state">
              <div className="empty-glyph">▦</div>
              <h3>Your proposal will appear here</h3>
              <p>Describe the job on the left. Once I have enough detail, I'll generate Basic, Modern, and Premium proposal + estimation documents you can download or share.</p>
            </div>
          ) : (
            <>
              <div className="result-header">
                <h2>Proposal options</h2>
                <div className="result-sub">{Object.keys(proposals).length} tiers generated · ready to share</div>
              </div>
              <div className="tier-tabs">
                {['basic', 'modern', 'premium'].map((t) => (
                  <button
                    key={t}
                    className={`tier-tab tier-${t} ${activeTier === t ? 'active' : ''}`}
                    onClick={() => setActiveTier(t)}
                  >
                    {proposals[t].title}
                  </button>
                ))}
              </div>
              <ProposalDocument proposal={proposals[activeTier]} />
              <ShareBar onDownloadPdf={handleDownloadPdf} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
