# Fieldproof — AI Proposal & Estimation Generator

A single-page React app for tradespeople (plumbers, electricians, furniture
makers, technicians) to generate Basic / Modern / Premium proposal and
estimation documents from a plain-language job description, with optional
reference files.

Gemini writes the trade classification, a short summary of each attachment,
and the customer-facing proposal text. Prices and the required questions
stay in code. If Gemini is unavailable, the app falls back to keyword
detection and built-in draft text.

## Run it

```bash
npm install
cp .env.example .env
```

Put your key in `.env` (this file is gitignored):

```bash
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
```

```bash
npm run dev
```

Open the printed local URL (http://localhost:5173/). The header shows
`Gemini · gemini-3.5-flash-lite` when the key is loaded. Restart the dev
server after changing `.env`.

Describe a job (for example, *"2 bathroom plumbing renovation, need a
proposal for a customer in Pune"*), answer the follow-up questions, and
three proposal tiers render on the right. **Download PDF** uses the browser
print dialog (Save as PDF). **Download Excel** and **Generate share link**
are placeholders.

## What the app does

1. **Classify the job.** Gemini reads the message. With no key, or if the
   call fails, `detectTrade` in `src/lib/tradeChecklists.js` matches
   keywords (plumbing, electrical, furniture, civil, HVAC, or general).
2. **Read attachments as reference.** Spreadsheets (`.xlsx`, `.xls`, `.csv`)
   and text files are converted to text on the dev server. PDFs and images
   are uploaded to the Gemini Files API. Gemini then summarises each file
   in the chat. Those summaries do not answer the checklist. The user still
   answers every required question. If analysis fails, the app says so and
   continues from the message and file names.
3. **Ask what is still required.** `checkGaps` compares answers with the
   trade checklist. Questions with no buttons are answered in the chat box.
   **Propose options** and **Let AI propose tiers** reveal concrete material
   choices instead of closing the question.
4. **Price in code, write in Gemini.** `src/lib/pricingEngine.js` computes
   every quantity, rate, tax, and total. Gemini only writes the title,
   scope, tier notes, assumptions, and payment terms, and it is told to use
   the numbers it is given. If that call fails, built-in draft sentences
   are used.

## Project structure

```
src/
  App.jsx                  conversation and pipeline state
  index.css                design tokens and styling
  components/
    InputBar.jsx           chat input and file attach
    MissingInfoCard.jsx    follow-up questions
    ProposalDocument.jsx   rendered proposal
    ShareBar.jsx           download and share actions
  lib/
    mockAgent.js           calls /api/ai; keyword and draft fallbacks
    pricingEngine.js       deterministic pricing (not the model)
    tradeChecklists.js     per-trade required fields and proposed options
server/
  gemini.js                Gemini classify, file analysis, and proposal text
  claude.js                same steps for Claude, used only if Gemini is unset
vite.config.js             dev-server routes /api/ai and /api/ai-file
```

The API key stays on the dev server. The browser never receives it.

| Route | What it does |
|---|---|
| `POST /api/ai` `{ action: "status" }` | Reports whether Gemini or Claude is configured |
| `POST /api/ai` `{ action: "classify" }` | Trade and short title from the message and file names |
| `POST /api/ai-file` | Prepares one upload (spreadsheet text, or a Gemini file URI for PDF/image) |
| `POST /api/ai` `{ action: "analyze" }` | Trade plus a reference note per file |
| `POST /api/ai` `{ action: "write" }` | Proposal wording from the priced line items |

Gemini is used when `GEMINI_API_KEY` is set. Claude (`ANTHROPIC_API_KEY`,
optional `ANTHROPIC_MODEL`) is the fallback provider and does not analyse
file contents.

## Not built yet

- Real PDF export (today is `window.print()`).
- Excel export (the button only shows an alert).
- A real customer share link (the button invents a URL).
- Saved projects, authentication, or a company rate card. Totals use the
  seed rates in `pricingEngine.js`.
- Persisted file storage. Uploads exist only for that request.
