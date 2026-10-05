// Combines per-file takeoffs and detects files that belong to different projects.

const list = (value) => (Array.isArray(value) ? value : [])

// "1693 Grand Ave, Oakland" and "1693 GRAND AVENUE" are the same job: street number + first street word.
export function addressKey(address) {
  const text = String(address || '').toLowerCase()
  const match = text.match(/(\d{1,6})\s+(?:[nsew]\.?\s+)?([a-z]+)/)
  if (match) return `${match[1]} ${match[2]}`
  const words = text.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  return words.length ? words.slice(0, 3).join(' ') : null
}

// Files without an address (photos, spec sheets) are shared and stay with whichever project is chosen.
export function groupProjects(analyses) {
  const projects = new Map()
  const shared = []
  analyses.forEach((a) => {
    const key = a.relevant === false ? null : addressKey(a.address)
    if (!key) {
      shared.push(a.file)
      return
    }
    if (!projects.has(key)) projects.set(key, { key, label: a.address, files: [] })
    projects.get(key).files.push(a.file)
  })
  return { projects: [...projects.values()], shared }
}

export function mergeTakeoffs(results, failures = []) {
  const project = {}
  const merged = { project, sheets: [], rooms: [], lines: [], exclusions: [], clarifications: [], assumptions: [], priorTotals: [], workbookRates: [], failures }

  results.forEach(({ file, result }, fileIndex) => {
    // Clarification ids restart at C1 in every file, so namespace them per file.
    const ref = (id) => (id ? `F${fileIndex + 1}-${id}` : '')
    for (const [key, value] of Object.entries(result.project || {})) {
      if (value && !project[key]) project[key] = String(value)
    }
    list(result.sheets).forEach((s) => merged.sheets.push({ file, ...s }))
    list(result.rooms).forEach((r) => merged.rooms.push({ ...r, file }))
    list(result.lines).forEach((l) => merged.lines.push({
      ...l,
      file,
      clarificationId: ref(l.clarificationId),
      source: l.source ? `${file} · ${l.source}` : '',
    }))
    list(result.exclusions).forEach((e) => merged.exclusions.push(e))
    list(result.clarifications).forEach((c) => merged.clarifications.push({ ...c, id: ref(c.id), file }))
    list(result.assumptions).forEach((a) => merged.assumptions.push(String(a)))
    list(result.priorTotals)
      .filter((t) => Number(t?.amount) > 0)
      .forEach((t) => merged.priorTotals.push({ file, label: String(t.label || 'Prior total'), amount: Number(t.amount) }))
    const workbook = result.workbookRates
    if (workbook && typeof workbook === 'object') {
      merged.workbookRates.push({
        file,
        general: Number(workbook.general) || 0,
        electrical: Number(workbook.electrical) || 0,
        specialty: Number(workbook.specialty) || 0,
        opPercent: Number(workbook.opPercent) || 0,
      })
    }
  })

  const uniqueBy = (items, key) => {
    const seen = new Set()
    return items.filter((item) => {
      const k = String(key(item)).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  merged.rooms = uniqueBy(merged.rooms, (r) => r.room)
  merged.exclusions = uniqueBy(merged.exclusions, (e) => e.item)
  merged.clarifications = uniqueBy(merged.clarifications, (c) => c.item)
  merged.assumptions = uniqueBy(merged.assumptions, (a) => a)
  merged.priorTotals = uniqueBy(merged.priorTotals, (t) => Math.round(t.amount))
  return merged
}
