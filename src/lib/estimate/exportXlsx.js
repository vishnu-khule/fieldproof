import ExcelJS from 'exceljs'
import { CATEGORIES, CONFIDENCE, CONFIDENCE_STATEMENT, OP_PERCENT, RATES, RATE_TYPES, VARIANTS } from './config'
import { priceLine } from './rollup'
import { slug } from './exportMarkdown'

const USD = '"$"#,##0.00'
const PCT = '0%'
const SPARE_ROWS = 25

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }
const INPUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D6' } }
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } }
const THIN = { style: 'thin', color: { argb: 'FFD5DCE4' } }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

const fx = (formula, result) => ({ formula, result: Number(result) || 0 })

function addSheet(wb, name, columns, { freeze = true } = {}) {
  const ws = wb.addWorksheet(name, freeze ? { views: [{ state: 'frozen', ySplit: 1 }] } : {})
  ws.columns = columns.map(([header, width, numFmt, wrap]) => ({
    header,
    width,
    style: {
      ...(numFmt ? { numFmt } : {}),
      alignment: { vertical: 'top', wrapText: Boolean(wrap) },
    },
  }))
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.alignment = { vertical: 'middle', wrapText: true }
  head.height = 30
  head.eachCell((cell) => { cell.fill = HEADER_FILL; cell.border = BORDER })
  return ws
}

function borderRows(ws, from, to, cols) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= cols; c++) ws.getCell(r, c).border = BORDER
  }
}

function markInputs(ws, rows, letters) {
  rows.forEach((r) => letters.forEach((col) => { ws.getCell(`${col}${r}`).fill = INPUT_FILL }))
}

function listValidation(range) {
  return { type: 'list', allowBlank: true, showErrorMessage: true, formulae: [range] }
}

// Formula-driven, formatted workbook per server/knowledge/estimator-prompt.md §19.
export function buildWorkbook(proposal) {
  const { takeoff, estimates, narrative, meta } = proposal
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Fieldproof'
  wb.created = new Date()

  const info = addSheet(wb, 'Instructions', [['Item', 24, null, false], ['Details', 110, null, true]])
  ;[
    ['Project', narrative.projectTitle],
    ['Customer', meta.customer],
    ['Address', takeoff.project?.address || ''],
    ['Date generated', meta.date],
    ['Rate basis', 'Client-learned rates from formula.md — edit them on the Rates sheet.'],
    ['O&P basis', `${Math.round(OP_PERCENT * 100)}% applied once to the subtotal (Rates!B5).`],
    ['Editable cells', 'Yellow cells: Rates!B2:B8 and Line Items columns A–G, I, L, N, O, P, Q. Spare rows at the bottom of Line Items already carry formulas — fill them in to add scope.'],
    ['Do not overwrite', 'Line Items columns H, J, K, M and every cell on Category Summary.'],
    ['Variants', 'Basic, Modern and Premium share the same scope. Finish-grade (N = "Y") materials are multiplied by Rates!B6:B8.'],
    ['Confidence tags', 'Excluded rows are not totalled. Verify in Field rows are priced but must be confirmed before contract.'],
    ['Statement', CONFIDENCE_STATEMENT],
  ].forEach((row) => info.addRow(row))
  info.getColumn(1).font = { bold: true }
  info.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  borderRows(info, 2, info.rowCount, 2)

  const lists = wb.addWorksheet('Lists', { state: 'hidden' })
  CATEGORIES.forEach((name, i) => { lists.getCell(i + 1, 1).value = name })
  RATE_TYPES.forEach((name, i) => { lists.getCell(i + 1, 2).value = name })
  CONFIDENCE.forEach((name, i) => { lists.getCell(i + 1, 3).value = name })
  ;['Y', 'N'].forEach((name, i) => { lists.getCell(i + 1, 4).value = name })
  const LIST = {
    category: `Lists!$A$1:$A$${CATEGORIES.length}`,
    rateType: `Lists!$B$1:$B$${RATE_TYPES.length}`,
    confidence: `Lists!$C$1:$C$${CONFIDENCE.length}`,
    yesNo: 'Lists!$D$1:$D$2',
  }

  const rates = addSheet(wb, 'Rates', [['Input', 34], ['Value', 14]])
  ;[
    ['General Labor Rate', RATES.General, USD],
    ['Electrical / Skilled Labor Rate', RATES.Electrical, USD],
    ['Specialty Production Unit Rate', RATES.Specialty, USD],
    ['Overhead & Profit %', OP_PERCENT, PCT],
    ['Basic finish multiplier', VARIANTS.basic.finishMultiplier, '0.00'],
    ['Modern finish multiplier', VARIANTS.modern.finishMultiplier, '0.00'],
    ['Premium finish multiplier', VARIANTS.premium.finishMultiplier, '0.00'],
  ].forEach(([label, value, numFmt]) => {
    const row = rates.addRow([label, value])
    row.getCell(2).numFmt = numFmt
  })
  markInputs(rates, [2, 3, 4, 5, 6, 7, 8], ['B'])
  borderRows(rates, 2, 8, 2)

  const items = addSheet(wb, 'Line Items', [
    ['Category', 24], ['Source', 22, null, true], ['Scope Item', 50, null, true], ['Qty', 8, '#,##0.##'], ['Unit', 10],
    ['Labor Hrs / Unit', 11, '#,##0.##'], ['Labor Rate Type', 13], ['Auto Rate', 11, USD], ['Manual Rate Override', 12, USD],
    ['Applied Rate', 11, USD], ['Labor Total', 13, USD], ['Material / Specialty (Basic)', 15, USD], ['Line Total (Basic)', 15, USD],
    ['Finish Grade (Y/N)', 10], ['Confidence', 19], ['Room', 18, null, true], ['Notes', 40, null, true],
  ])
  const formulasFor = (r) => ({
    H: `IF(G${r}="General",Rates!$B$2,IF(G${r}="Electrical",Rates!$B$3,IF(G${r}="Specialty",Rates!$B$4,0)))`,
    J: `IF(I${r}>0,I${r},H${r})`,
    K: `D${r}*F${r}*J${r}`,
    M: `K${r}+L${r}`,
  })
  takeoff.lines.forEach((line, i) => {
    const r = i + 2
    const p = priceLine(line, 'basic')
    const f = formulasFor(r)
    items.addRow([
      line.category, line.source, line.scope, line.qty, line.unit, line.hoursPerUnit, line.rateType,
      fx(f.H, RATES[line.rateType] || 0), line.manualRate || 0, fx(f.J, p.rate), fx(f.K, p.labor),
      line.materialAmount, fx(f.M, p.labor + line.materialAmount),
      line.finishGrade ? 'Y' : 'N', line.confidence, line.room, line.notes,
    ])
  })
  const firstSpare = takeoff.lines.length + 2
  const lastItemRow = firstSpare + SPARE_ROWS - 1
  for (let r = firstSpare; r <= lastItemRow; r++) {
    const f = formulasFor(r)
    items.addRow(['', '', '', null, '', null, '', fx(f.H, 0), null, fx(f.J, 0), fx(f.K, 0), null, fx(f.M, 0), '', ''])
  }
  const itemRows = Array.from({ length: lastItemRow - 1 }, (_, i) => i + 2)
  markInputs(items, itemRows, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'L', 'N', 'O', 'P', 'Q'])
  itemRows.forEach((r) => {
    items.getCell(`A${r}`).dataValidation = listValidation(LIST.category)
    items.getCell(`G${r}`).dataValidation = listValidation(LIST.rateType)
    items.getCell(`N${r}`).dataValidation = listValidation(LIST.yesNo)
    items.getCell(`O${r}`).dataValidation = listValidation(LIST.confidence)
  })
  borderRows(items, 2, lastItemRow, 17)
  items.autoFilter = 'A1:Q1'

  const LI = "'Line Items'!"
  const sumifs = (col, row, extra = '') => `SUMIFS(${LI}$${col}:$${col},${LI}$A:$A,$A${row},${LI}$O:$O,"<>Excluded"${extra})`
  const materialsFx = (row, multRow) =>
    `${sumifs('L', row, `,${LI}$N:$N,"N"`)}+${sumifs('L', row, `,${LI}$N:$N,"Y"`)}*Rates!$B$${multRow}`

  const summary = addSheet(wb, 'Category Summary', [
    ['Category Totals', 26], ['Labor', 14, USD], ['Basic Materials', 15, USD], ['Basic Total', 15, USD],
    ['Modern Materials', 16, USD], ['Modern Total', 15, USD], ['Premium Materials', 17, USD], ['Premium Total', 15, USD],
  ])
  CATEGORIES.forEach((name, i) => {
    const r = i + 2
    const [b, m, pr] = ['basic', 'modern', 'premium'].map((k) => estimates[k].categories[i])
    summary.addRow([
      name,
      fx(sumifs('K', r), b.labor),
      fx(materialsFx(r, 6), b.materials), fx(`B${r}+C${r}`, b.total),
      fx(materialsFx(r, 7), m.materials), fx(`B${r}+E${r}`, m.total),
      fx(materialsFx(r, 8), pr.materials), fx(`B${r}+G${r}`, pr.total),
    ])
  })
  const last = CATEGORIES.length + 1
  const tot = last + 1
  const sumCol = (c, v) => fx(`SUM(${c}2:${c}${last})`, v)
  const [eb, em, ep] = [estimates.basic, estimates.modern, estimates.premium]
  summary.addRow(['Total Cost', sumCol('B', eb.labor), sumCol('C', eb.materials), sumCol('D', eb.subtotal), sumCol('E', em.materials), sumCol('F', em.subtotal), sumCol('G', ep.materials), sumCol('H', ep.subtotal)])
  summary.addRow(['Overhead/Profit', null, null, fx(`D${tot}*Rates!$B$5`, eb.overheadProfit), null, fx(`F${tot}*Rates!$B$5`, em.overheadProfit), null, fx(`H${tot}*Rates!$B$5`, ep.overheadProfit)])
  summary.addRow(['Total Project Cost', null, null, fx(`D${tot}+D${tot + 1}`, eb.total), null, fx(`F${tot}+F${tot + 1}`, em.total), null, fx(`H${tot}+H${tot + 1}`, ep.total)])
  borderRows(summary, 2, tot + 2, 8)
  for (let r = tot; r <= tot + 2; r++) {
    const row = summary.getRow(r)
    row.font = { bold: true }
    row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = TOTAL_FILL })
  }

  const allowances = addSheet(wb, 'Allowances', [
    ['Allowance Item', 40, null, true], ['Category', 24], ['Basis / Source', 24, null, true], ['Amount (Basic)', 14, USD],
    ['Included in Line Items?', 24], ['Notes', 40, null, true],
  ])
  takeoff.lines.forEach((line, i) => {
    if (line.category !== 'Allowances' && line.confidence !== 'Allowance') return
    const row = i + 2
    allowances.addRow([line.scope, line.category, line.source, fx(`${LI}L${row}`, line.materialAmount), `Yes — Line Items row ${row}`, line.notes])
  })
  borderRows(allowances, 2, allowances.rowCount, 6)

  const textTab = (name, columns, rows) => {
    const ws = addSheet(wb, name, columns.map(([header, width]) => [header, width, null, true]))
    rows.forEach((row) => ws.addRow(row))
    borderRows(ws, 2, ws.rowCount, columns.length)
  }
  textTab('Exclusions', [['Exclusion', 40], ['Reason', 50], ['Add Alternate?', 14], ['Notes', 30]],
    takeoff.exclusions.map((e) => [e.item, e.reason, 'On request', '']))
  textTab('Verify In Field', [['Item', 36], ['Why Verification Is Needed', 60], ['Drawing Source', 26], ['Cost Risk', 12]],
    takeoff.clarifications.map((c) => [c.item, c.why, c.source, c.risk]))
  textTab('Sources Reviewed', [['File', 30], ['PDF Page', 10], ['Sheet', 12], ['Title', 36], ['Reviewed', 10], ['Cost Impact', 46], ['Notes', 36]],
    takeoff.sheets.map((s) => [s.file, s.page, s.sheet, s.title, 'Yes', s.costImpact || 'No direct cost impact identified', s.notes || '']))
  textTab('Room Scope', [['Room / Area', 24], ['Demolition', 30], ['New Work', 40], ['MEP', 30], ['Finishes', 30], ['Notes', 30]],
    takeoff.rooms.map((r) => [r.room, r.demolition, r.newWork, r.mep, r.finishes, r.notes]))

  return wb
}

export async function downloadWorkbook(proposal) {
  const buffer = await buildWorkbook(proposal).xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug(proposal.narrative.projectTitle)}-estimate.xlsx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
