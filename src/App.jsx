import { useEffect, useRef, useState } from 'react'
import InputBar from './components/InputBar'
import MissingInfoCard from './components/MissingInfoCard'
import ProposalDocument from './components/ProposalDocument'
import TakeoffReview from './components/TakeoffReview'
import ShareBar from './components/ShareBar'
import { aiStatus, analyzeIntake, buildTakeoff, checkGaps, classifyIntake, generateProposal, prepareFiles } from './lib/agent'
import { deferredChoice } from './lib/tradeChecklists'
import { CATEGORIES, VARIANTS, VARIANT_KEYS } from './lib/estimate/config'
import { excludeUnverified } from './lib/estimate/validate'
import { downloadMarkdown } from './lib/estimate/exportMarkdown'

const APPROVE = '__approve'
const APPROVE_ALL = 'Approve & price all three variants'
const APPROVE_CONFIRMED = 'Exclude unverified items, then price'

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
  lines.push(intake.file_questions?.length
    ? 'The questions below quote what these files already show. Confirm each one — I will not treat a file as your answer until you do.'
    : "I'll use them as reference for the takeoff — please answer the questions below.")
  return lines.join('\n')
}

function takeoffReport(takeoff, fileCount) {
  const categories = CATEGORIES.filter((name) => takeoff.lines.some((l) => l.category === name)).length
  const verify = takeoff.lines.filter((l) => l.confidence === 'Verify in Field').length
  const lines = [
    takeoff.source === 'ai'
      ? `I reviewed ${fileCount ? `${fileCount} file(s)` : 'your brief'}${takeoff.sheets.length ? ` covering ${takeoff.sheets.length} drawing sheets/pages` : ''}.`
      : 'I built the takeoff from your answers using the standard formula template.',
    `Extracted ${takeoff.lines.length} line items across ${categories} categories. ${verify} need field verification; ${takeoff.clarifications.length} clarifications are open.`,
  ]
  if (takeoff.note) lines.push(takeoff.note)
  if (takeoff.failures?.length) lines.push(`Could not process: ${takeoff.failures.map((f) => f.name).join(', ')}.`)
  lines.push('Check the takeoff on the right, then approve it for pricing.')
  return lines.join('\n')
}

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
      text: "Hi — tell me about the job. Attach drawings, plans, old estimates or photos and I'll extract a line-item takeoff from them, ask what's missing, then price Basic, Modern and Premium variants.",
    },
  ])
  const [stage, setStage] = useState(STAGE.IDLE)
  const [busyLabel, setBusyLabel] = useState('Analysing…')
  const [trade, setTrade] = useState(null)
  const [fields, setFields] = useState({})
  const [missing, setMissing] = useState([])
  const [prepared, setPrepared] = useState([])
  const [brief, setBrief] = useState('')
  const [takeoff, setTakeoff] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [variant, setVariant] = useState('modern')
  const [fileQuestions, setFileQuestions] = useState([])
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
  const work = (label) => {
    setBusyLabel(label)
    setStage(STAGE.WORKING)
  }

  async function runGapCheck(tradeType, currentFields, files = prepared, message = brief, questions = fileQuestions) {
    const gap = checkGaps(tradeType, currentFields, questions)
    if (!gap.ready_to_generate) {
      setMissing(gap.missing)
      setStage(STAGE.CLARIFYING)
      return
    }
    setMissing([])
    work(files.length ? 'Reviewing every drawing sheet and building the takeoff…' : 'Building the takeoff…')
    const result = await buildTakeoff({ trade: tradeType, fields: currentFields, message, prepared: files })
    setTakeoff(result)
    setProposal(null)
    pushAgent(takeoffReport(result, files.filter((f) => f.kind === 'text' || f.kind === 'file').length))
    setMissing([{ field: APPROVE, question: 'Ready to price this takeoff?', options: [APPROVE_ALL, APPROVE_CONFIRMED] }])
    setStage(STAGE.CLARIFYING)
  }

  async function price(choice) {
    const lines = choice === APPROVE_CONFIRMED ? excludeUnverified(takeoff.lines) : takeoff.lines
    const approved = { ...takeoff, lines }
    setTakeoff(approved)
    setMissing([])
    setBusyLabel('Pricing Basic, Modern and Premium & writing the proposal…')
    setStage(STAGE.GENERATING)
    const result = await generateProposal({ trade, fields, takeoff: approved })
    setProposal(result)
    setStage(STAGE.REVIEW)
    pushAgent(
      `Done. ${VARIANT_KEYS.map((k) => `${VARIANTS[k].title} ${formatTotal(result.estimates[k].total)}`).join(' · ')}.\nDownload the PDF, the Excel estimate (formula-driven, all three variants) or the Markdown quotation on the right.`
    )
  }

  async function handleSend(text, files) {
    if (!text && files.length === 0) return
    pushUser(text, files)
    setMissing([])

    let currentTrade = trade
    let currentFields = { ...fields }
    let currentFiles = prepared
    let currentBrief = brief

    if (files.length) {
      work('Uploading and reading attachments…')
      const added = await prepareFiles(files)
      currentFiles = [...prepared, ...added]
      setPrepared(currentFiles)
    } else {
      work('Analysing…')
    }

    if (!currentTrade) {
      const intake = files.length ? await analyzeIntake(text, currentFiles) : await classifyIntake(text)
      currentTrade = intake.trade_type
      setTrade(currentTrade)
      currentBrief = text
      setBrief(text)
      currentFields.summary = (text || intake.summary || files.map((file) => file.name).join(', ')).slice(0, 160)
      const tradeLabel = currentTrade === 'general' ? 'general remodel' : currentTrade
      if (files.length) {
        pushAgent(attachmentReport(intake))
        setFileQuestions(intake.file_questions || [])
      }
      pushAgent(files.length && intake.file_questions?.length
        ? `This looks like a ${tradeLabel} job. Confirm the details I found in your files before I build the takeoff.`
        : `This looks like a ${tradeLabel} job. I need a few details from you before I build the takeoff.`)
      setFields(currentFields)
      await runGapCheck(currentTrade, currentFields, currentFiles, currentBrief, intake.file_questions || [])
      return
    } else if (missing.some((item) => item.field === APPROVE)) {
      if (files.length) pushAgent('Got the extra files — rebuilding the takeoff with them.')
      if (text) currentBrief = `${brief}\n${text}`.trim()
      setBrief(currentBrief)
    } else if (text && missing.length > 0) {
      // Free-text questions have no chips, so the reply arrives through the chat box.
      const target = missing.find((item) => !item.options) || missing[0]
      currentFields[target.field] = text
    } else if (missing.length === 0 && proposal) {
      if (files.length) {
        pushAgent('Got the new files — rebuilding the takeoff with them.')
        if (text) {
          currentBrief = `${brief}\n${text}`.trim()
          setBrief(currentBrief)
        }
      } else {
        pushAgent('The proposal uses the details you gave me. Attach more drawings or tell me what changed (size, scope, finishes) and I will rebuild the takeoff.')
        setStage(STAGE.REVIEW)
        return
      }
    } else if (files.length && text) {
      currentBrief = `${brief}\n${text}`.trim()
      setBrief(currentBrief)
    }

    setFields(currentFields)
    await runGapCheck(currentTrade, currentFields, currentFiles, currentBrief)
  }

  async function handleAnswer(field, value) {
    pushUser(value)
    if (field === APPROVE) {
      await price(value)
      return
    }
    const item = missing.find((entry) => entry.field === field)
    if (item?.confirm && value === item.confirm.label) {
      const currentFields = { ...fields, [field]: item.confirm.value }
      setFields(currentFields)
      setMissing([])
      work('Analysing…')
      await runGapCheck(trade, currentFields)
      return
    }
    if (item?.decline && value === item.decline.label) {
      pushAgent(item.decline.question)
      setMissing(missing.map((entry) => (entry.field === field
        ? { field, question: item.decline.question, options: item.decline.options }
        : entry)))
      setStage(STAGE.CLARIFYING)
      return
    }
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
    setMissing([])
    work('Analysing…')
    await runGapCheck(trade, currentFields)
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
          {ai?.enabled ? `${ai.provider || 'AI'} · ${ai.model}` : 'AI not connected — template takeoff only'}
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
                <div className="attach-chip"><span className="spin" /> {busyLabel}</div>
              </div>
            )}
            {missing.length > 0 && stage === STAGE.CLARIFYING && (
              <MissingInfoCard
                missing={missing}
                onAnswer={handleAnswer}
                title={missing[0].field === APPROVE ? 'Approval before pricing' : undefined}
              />
            )}
          </div>
          <InputBar onSend={handleSend} disabled={busy} />
        </section>

        <section className="result-col">
          {proposal ? (
            <>
              <div className="result-header">
                <h2>Proposal &amp; estimate</h2>
                <div className="result-aside">
                  <div className="result-sub">Same scope · 3 finish variants · {proposal.takeoff.lines.length} line items</div>
                  <ShareBar
                    onDownloadPdf={() => {
                      const previous = document.title
                      document.title = `${proposal.narrative.projectTitle} - ${VARIANTS[variant].title} Proposal`
                      const restore = () => { document.title = previous }
                      window.addEventListener('afterprint', restore, { once: true })
                      window.print()
                    }}
                    onDownloadExcel={() => import('./lib/estimate/exportXlsx').then((m) => m.downloadWorkbook(proposal))}
                    onDownloadMarkdown={() => downloadMarkdown(proposal, variant)}
                  />
                </div>
              </div>
              <div className="tier-tabs">
                {VARIANT_KEYS.map((k) => (
                  <button key={k} className={`tier-tab tier-${k} ${variant === k ? 'active' : ''}`} onClick={() => setVariant(k)}>
                    {VARIANTS[k].title} · {formatTotal(proposal.estimates[k].total)}
                  </button>
                ))}
              </div>
              <ProposalDocument proposal={proposal} variant={variant} />
            </>
          ) : takeoff ? (
            <>
              <div className="result-header">
                <h2>Takeoff review</h2>
                <div className="result-sub">Approve on the left to price all three variants</div>
              </div>
              <TakeoffReview takeoff={takeoff} />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-glyph">▦</div>
              <h3>Your proposal will appear here</h3>
              <p>Describe the job and attach drawings or estimates. I'll extract the scope sheet by sheet, ask what's missing, and generate a detailed proposal with diagrams plus Basic, Modern and Premium estimates.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function formatTotal(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`
}
