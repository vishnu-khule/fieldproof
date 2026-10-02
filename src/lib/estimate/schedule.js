// Indicative phase schedule derived from labor hours, used for the timeline diagram.

export const PHASES = [
  { name: 'Mobilize & demolition', categories: ['Site Preparation', 'Demolition', 'Foundation'] },
  { name: 'Structure & envelope', categories: ['Framing', 'Exterior Finishes', 'Siding', 'Windows/Doors', 'Roofing'] },
  { name: 'Rough-in', categories: ['Rough Plumbing', 'Rough Electrical', 'Mechanical', 'Insulation'] },
  { name: 'Close-up & finishes', categories: ['Drywall', 'Trim/Casework/Hardware', 'Tiling/Counters/Flooring', 'Paint Interior', 'Paint Exterior'] },
  { name: 'Fit-out & handover', categories: ['Finish Plumbing', 'Finish Electrical', 'Appliances', 'Clean Up'] },
]

const CREW_HOURS_PER_WEEK = 80

export function buildSchedule(lines) {
  const active = lines.filter((line) => line.confidence !== 'Excluded')
  let start = 0
  return PHASES.map((phase) => {
    const hours = active
      .filter((line) => phase.categories.includes(line.category))
      .reduce((sum, line) => sum + line.qty * line.hoursPerUnit, 0)
    if (!hours) return null
    const weeks = Math.max(0.5, Math.round((hours / CREW_HOURS_PER_WEEK) * 2) / 2)
    const item = { name: phase.name, hours: Math.round(hours), start, weeks }
    start += weeks
    return item
  }).filter(Boolean)
}
