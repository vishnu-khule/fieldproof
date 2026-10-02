# Fieldproof — AI Proposal & Estimation Generator

A single-page React app for remodelers and tradespeople. Attach drawings,
schedules or a prior estimate, describe the job, and the app produces a
detailed proposal with diagrams plus Basic, Modern and Premium estimates,
exportable as PDF, a formula-driven Excel workbook, and a Markdown quotation.

Gemini reads the reference files and drafts a **takeoff** (scope lines with
source, quantity, hours and confidence) and the customer-facing wording.
**Every dollar is computed in code**, never by the model. If Gemini is
unavailable, the app falls back to a per-trade template takeoff and built-in
draft text.

## Run it

```bash
npm install
cp .env.example .env
```

Put your key in `.env` (this file is gitignored):

```bash
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_PROJECT_NAME=projects/000000000000
GEMINI_PROJECT_NUMBER=000000000000
```

```bash
npm run dev
```

Open http://localhost:5173/. The header shows `Gemini · gemini-3.5-flash-lite`
when the key is loaded. Restart the dev server after changing `.env`.

## How to use it

1. **Describe the job and attach references** — e.g. *"Primary bath remodel,
   plans attached"* with PDF drawings, images, `.xlsx`/`.csv` estimates or
   `.txt`/`.md` notes. The chat summarises what each file contains.
2. **Answer the required questions.** Attachments are reference only; the
   trade checklist is always asked. **Propose options** shows material chips.
3. **Review the takeoff.** The right panel lists every scope line by
   category with its drawing source and confidence tag, plus warnings
   (duplicates, unsourced "confirmed" lines, outlier hours).
4. **Approve.** Choose *Approve & price all three variants*, or *Exclude
   unverified items, then price* to drop every Verify-in-Field line.
5. **Switch variants and export.** Tabs show Basic / Modern / Premium totals.
   **PDF** prints the current variant, **Excel estimate** downloads one
   workbook with all three variants, **Markdown quotation** downloads the
   current variant. Send new files at any time to rebuild the takeoff.

## Estimating model

Defined in `src/lib/estimate/config.js`, following `server/knowledge/formula.md`:

- 23 fixed categories, always shown (zero rows included).
- Rates: General $120/hr, Electrical $165/hr, Specialty $200/production unit,
  or a Manual rate per line.
- `Labor = Qty × Hrs/unit × Rate`, `Line total = Labor + Material`.
  Allowances carry product cost only (0 labor).
- O&P 20% applied once to the subtotal. Currency USD.
- **Variants share the same scope.** Only lines flagged `finishGrade`
  (fixtures, tile, lighting, cabinets…) change: material × 1.0 / 1.6 / 2.6,
  and warranty 12 / 24 / 36 months.
- Validation (`validate.js`): category aliases, duplicate removal, confirmed
  lines without a source downgraded to *Verify in Field*, Foundation and
  appliance lines without drawing/user confirmation excluded, possible
  double-counted allowances flagged, outlier hours and specialty units flagged.
- Indicative schedule: 5 phases at 80 crew-hours per week.

The Excel workbook (ExcelJS, loaded on demand) keeps live formulas: change a
rate or multiplier on the **Rates** sheet, or any yellow input cell, and every
line, category and variant total recalculates. Headers are frozen and styled,
Category / Rate Type / Confidence / Finish Grade use dropdowns, and 25 spare
formula rows are ready for added scope.
Sheets: Instructions, Rates, Line Items, Category Summary, Allowances,
Exclusions, Verify In Field, Sources Reviewed, Room Scope.

## Project structure

```
src/
  App.jsx                    conversation, approval gate, variant tabs
  index.css                  design tokens, document, diagram and print styles
  components/
    InputBar.jsx             chat input and file attach
    MissingInfoCard.jsx      follow-up questions
    TakeoffReview.jsx        pre-approval takeoff by category
    ProposalDocument.jsx     14-section proposal for the selected variant
    Diagrams.jsx             SVG scope map, category bars, variant comparison, timeline
    ShareBar.jsx             PDF / Excel / Markdown exports
  lib/
    agent.js                 calls /api/ai; takeoff + pricing pipeline and fallbacks
    tradeChecklists.js       per-trade required fields and proposed options
    estimate/
      config.js              rates, categories, confidence tags, variants
      validate.js            takeoff guardrails
      rollup.js              line, category and variant math
      templates.js           template takeoffs when no AI / no extractable scope
      schedule.js            phase timeline
      exportXlsx.js          formatted, formula-driven workbook (ExcelJS)
      exportMarkdown.js      Markdown quotation
server/
  knowledge/                 estimator prompt, formula model, knowledge base
  prompts.js                 takeoff and writer system prompts
  gemini.js                  file prep, analysis, per-file takeoff, wording
  claude.js                  classify and wording only, if Gemini is unset
vite.config.js               dev-server routes /api/ai and /api/ai-file
```

The API key stays on the dev server (sent as the `x-goog-api-key` header).
The browser never receives it.

| Route | What it does |
|---|---|
| `POST /api/ai` `{ action: "status" }` | Reports whether Gemini or Claude is configured |
| `POST /api/ai-file` | Prepares one upload (text for spreadsheets/text, Gemini file URI for PDF/image) |
| `POST /api/ai` `{ action: "classify" }` | Trade and short title from the message and file names |
| `POST /api/ai` `{ action: "analyze" }` | Trade plus a reference note per file |
| `POST /api/ai` `{ action: "takeoff" }` | Scope lines, rooms, sheets, exclusions and clarifications — one Gemini call per file, merged |
| `POST /api/ai` `{ action: "write" }` | Proposal wording from the computed totals |

Takeoff and file analysis need Gemini. Claude (`ANTHROPIC_API_KEY`,
optional `ANTHROPIC_MODEL`) only classifies and writes wording; the takeoff
then uses templates.

## Not built yet

- Server-side PDF rendering (PDF uses the browser print dialog).
- Customer share links, saved projects, authentication, company rate cards.
- Persisted file storage. Uploads exist only for that session.
