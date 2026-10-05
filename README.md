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
   `.txt`/`.md` notes. Each file is read separately with progress shown
   ("Reading file 2 of 3…"). The chat summarises each file, flags files that
   are not construction documents (left out of the takeoff) and any prior
   estimate totals (reference only, never copied).
2. **Pick the project if the files disagree.** When files show different
   street addresses, the app asks which project to price (or to price them
   together) before running the takeoff.
3. **Answer the required questions.** Attachments are reference only; the
   questions quote what the files show and you confirm or correct them.
   **Propose options** shows material chips.
4. **Answer the drawing questions.** The takeoff raises drawing-specific
   questions (e.g. "Sheet S-3 shows the service stair removed — …"). *Yes*
   confirms the linked lines, *No* excludes them, *Not sure* keeps them as
   Verify in Field.
5. **Review the takeoff.** The right panel lists every scope line by
   category with its drawing source and confidence tag, plus warnings
   (duplicates, unsourced "confirmed" lines, outlier hours, amounts that
   match a prior estimate total).
6. **Approve.** Choose *Approve & price all three variants*, or *Exclude
   unverified items, then price* to drop every Verify-in-Field line.
7. **Switch variants and export.** Tabs show Basic / Modern / Premium totals.
   **PDF** prints the current variant, **Excel estimate** downloads one
   workbook with all three variants, **Markdown quotation** downloads the
   current variant. Category calculation details are collapsible on screen
   and always print in full. Send new files at any time to rebuild the takeoff.

If the API key is rejected or rate-limited, the top bar and the chat say so
and the app continues with the template takeoff.

## Estimating model

Defined in `src/lib/estimate/config.js`, following `server/knowledge/formula.md`:

- 23 fixed categories, always shown (zero rows included).
- Rates when no client workbook is attached (knowledge-base fallback): General
  $105/hr (published range $105–$120), Electrical $150/hr (range $150–$165),
  Specialty $200/unit, O&P 20%. A client estimate workbook that states rates
  overrides those, inside the same bands. Manual rate per line is still allowed.
- `Labor = Qty × Hrs/unit × Rate`, `Line total = Labor + Material`.
  Allowances carry product cost only (0 labor).
- O&P 20% applied once to the subtotal. Currency USD.
- **Variants share the same scope.** Only lines flagged `finishGrade`
  (fixtures, tile, lighting, cabinets…) change: material × 1.0 / 1.6 / 2.6,
  and warranty 12 / 24 / 36 months.
- Validation (`validate.js`): category aliases, duplicate removal, confirmed
  lines without a source downgraded to *Verify in Field*, Foundation and
  appliance lines without drawing/user confirmation excluded, possible
  double-counted allowances flagged, outlier hours and specialty units flagged,
  lines equal to a prior estimate total excluded (over half of one: Verify in Field).
- Template takeoffs (no drawings) use per-unit material costs × quantity.
- The scope map is a schematic only (rooms → trades, no dimensions or scale),
  shown only for drawing-based takeoffs, with a permanent disclaimer in the
  proposal, PDF, Markdown and the Excel Instructions sheet.
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
      merge.js               merges per-file takeoffs; groups files by address
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
| `POST /api/ai` `{ action: "status" }` | Reports the provider and verifies the Gemini key |
| `POST /api/ai-file` | Prepares one upload (text for spreadsheets/text, Gemini file URI for PDF/image) |
| `POST /api/ai` `{ action: "classify" }` | Trade and short title from the message and file names |
| `POST /api/ai` `{ action: "analyze-file" }` | One file: note, document type, relevance, address, prior total |
| `POST /api/ai` `{ action: "intake" }` | Trade, title and file-quoting questions from the file notes |
| `POST /api/ai` `{ action: "takeoff-file" }` | One file's scope lines, rooms, sheets, exclusions, clarifications (with questions) and prior totals; the browser merges files |
| `POST /api/ai` `{ action: "write" }` | Proposal wording from the computed totals |

Takeoff and file analysis need Gemini. Claude (`ANTHROPIC_API_KEY`,
optional `ANTHROPIC_MODEL`) only classifies and writes wording; the takeoff
then uses templates.

## Not built yet

- Server-side PDF rendering (PDF uses the browser print dialog).
- Customer share links, saved projects, authentication, company rate cards.
- Persisted file storage. Uploads exist only for that session.
