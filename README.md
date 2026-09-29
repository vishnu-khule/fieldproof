# Fieldproof — AI Proposal & Estimation Generator

A single-page React app for tradespeople (plumbers, electricians, furniture
makers, technicians) to generate Basic / Modern / Premium proposal and
estimation documents from a plain-language description of a job, optionally
backed by attached reference files.

This repo is a **frontend prototype**: the conversation flow, gap-checking,
and three-tier document generation all work end-to-end using a mocked AI
pipeline (`src/lib/mockAgent.js`) and a real, deterministic pricing engine
(`src/lib/pricingEngine.js`). Swap the mock functions for real API calls to
go to production — the system prompts for each step are included as
comments in that file.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Describe a job (e.g. *"2 bathroom plumbing
renovation, need a proposal for a customer in Pune"*), answer the follow-up
questions, and three proposal tiers render on the right. "Download PDF" uses
the browser print dialog (Save as PDF) for now.

## Project structure

```
src/
  App.jsx                 orchestrates the conversation + pipeline state machine
  index.css                design tokens + all styling
  components/
    InputBar.jsx           chat input + file attach
    MissingInfoCard.jsx    quick-reply follow-up questions
    ProposalDocument.jsx   the rendered proposal/estimate document
    ShareBar.jsx           download + share-link actions
  lib/
    mockAgent.js            mock pipeline — REPLACE with real backend calls
    pricingEngine.js        deterministic pricing (keep this in code, not the LLM)
    tradeChecklists.js      per-trade required-field checklists
```

## Wiring in the real AI backend

Each function in `src/lib/mockAgent.js` maps 1:1 to a backend endpoint and
an agent step from the architecture. Replace the mock body with a `fetch`
call, keeping the same input/output shape:

| Function | Real backend step | Notes |
|---|---|---|
| `classifyIntake` | Intake/classifier agent | trade_type, language, currency |
| `analyzeAttachment` | Document analysis agent | one call per uploaded file (OCR/vision + extraction) |
| `checkGaps` | Requirement-gap agent | decides which questions to ask next |
| `generateProposals` | Estimation agent → pricing engine (code) → proposal writer agent (×3 tiers) → QA/verifier agent | keep all math in code; LLM only writes descriptions |

Suggested backend: a Node/FastAPI service that:
1. Accepts the chat message + uploaded files.
2. Stores files in S3/R2, parses/OCRs them, embeds them into pgvector for
   later reference.
3. Calls Claude with the prompts documented in `mockAgent.js`, validating
   every response against a JSON schema (never trust free-form numbers).
4. Calls the pricing engine (port `pricingEngine.js` to your backend
   language, or call this same JS module via a Node service) for totals.
5. Renders the final proposal via an HTML template → Puppeteer/Playwright
   for PDF, and `docx`/`exceljs` for Word/Excel exports.
6. Creates a public, read-only share link with an approve/e-sign flow and
   an audit trail (timestamp, IP, status).

## Next steps

- Replace `window.print()` with a real PDF export (server-rendered via the
  same `ProposalDocument` markup, or a library like `@react-pdf/renderer`).
- Add authentication and persistence (Postgres: users, projects, files,
  proposals, share events).
- Add a company-profile settings panel (logo, terms, default rate card)
  that feeds into the proposal writer prompt.
- Add DOCX/XLSX export using the `docx` and `exceljs` npm packages.
