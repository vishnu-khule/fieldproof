// Fallback takeoff used when there are no drawings or the AI is unavailable.
// Quantities come from the customer's answers; productivity hours follow the
// typical ranges in server/knowledge/knowledge-base.md §7.

export function parseSize(text = '') {
  const t = String(text).toLowerCase()
  const dims = t.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by|\*)\s*(\d+(?:\.\d+)?)/)
  if (dims) {
    const a = parseFloat(dims[1])
    const b = parseFloat(dims[2])
    return { areaSf: a * b, count: 1, linearFt: Math.max(a, b), label: `${a} × ${b}` }
  }
  const area = t.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s*feet)/)
  if (area) return { areaSf: parseFloat(area[1]), count: 1, linearFt: Math.sqrt(parseFloat(area[1])), label: `${area[1]} SF` }
  const sqm = t.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm|m2|square\s*met)/)
  if (sqm) {
    const sf = parseFloat(sqm[1]) * 10.764
    return { areaSf: Math.round(sf), count: 1, linearFt: Math.sqrt(sf), label: `${sqm[1]} m²` }
  }
  const count = t.match(/(\d+)/)
  const n = count ? Math.max(1, parseInt(count[1], 10)) : 1
  return { areaSf: n * 60, count: n, linearFt: n * 10, label: `${n}` }
}

const BRIEF = 'Customer brief'

function line(category, scope, qty, unit, hoursPerUnit, rateType, materialAmount, extra = {}) {
  return {
    category,
    scope,
    qty,
    unit,
    hoursPerUnit,
    rateType,
    materialAmount,
    source: BRIEF,
    confidence: 'User-confirmed',
    ...extra,
  }
}

const allowance = (scope, amount, room) =>
  line('Allowances', scope, 1, 'Allowance', 0, 'General', amount, { confidence: 'Allowance', finishGrade: true, room })

function common(size, room, renovation) {
  const out = [
    line('Site Preparation', 'Mobilization, floor protection and dust barriers', 1, 'LS', Math.max(12, Math.round(size.areaSf / 25)), 'General', 250, { room }),
    line('Clean Up', 'Daily cleanup, final clean and debris load-out', 1, 'LS', Math.max(8, Math.round(size.areaSf / 20)), 'General', 200, { room }),
    line('Permits', 'Permit and inspection fees (owner-paid unless added)', 1, 'LS', 0, 'General', 0, { confidence: 'Excluded', room }),
  ]
  if (renovation) {
    out.push(line('Demolition', 'Selective demolition of existing finishes in work area', size.areaSf, 'SF', 0.05, 'General', 0, { room }))
    out.push(line('Demolition', 'Dumpster, dump fees and haul-off', 1, 'Allowance', 0, 'General', 650, { confidence: 'Allowance', room }))
  }
  return out
}

const TEMPLATES = {
  plumbing(size, room, renovation) {
    const n = size.count
    return [
      ...common({ ...size, areaSf: n * 60 }, room, renovation),
      line('Rough Plumbing', 'Supply, waste and vent rough-in per bathroom (lav, toilet, shower)', n, 'Bath', 16, 'Electrical', 450, { room }),
      line('Rough Electrical', 'GFCI outlets, vanity light and exhaust fan circuit', n, 'Bath', 6, 'Electrical', 180, { room }),
      line('Mechanical', 'Bath exhaust fan duct to exterior', n, 'EA', 3, 'General', 120, { room }),
      line('Drywall', 'Water-resistant drywall hang, tape and finish', n, 'Bath', 12, 'General', 250, { room }),
      line('Tiling/Counters/Flooring', 'Floor and shower wall tile install with waterproofing', n, 'Bath', 30, 'General', 600, { room }),
      line('Paint Interior', 'Prime and paint walls, ceiling and trim', n, 'Bath', 8, 'General', 90, { room }),
      line('Finish Plumbing', 'Set toilet, faucet and shower trim; final test', n, 'Bath', 8, 'Electrical', 150, { room }),
      line('Finish Electrical', 'Install devices, light fixture and fan; test', n, 'Bath', 3, 'Electrical', 60, { room }),
      allowance('Plumbing fixtures (toilet, faucet, shower valve trim)', 1800 * n, room),
      allowance('Tile material', 1200 * n, room),
      allowance('Vanity and mirror', 900 * n, room),
    ]
  },
  electrical(size, room, renovation, fields) {
    const n = size.count
    const heavy = /heavy|commercial/i.test(fields.load_requirement || '')
    const out = [
      ...common({ ...size, areaSf: n * 150 }, room, false),
      line('Rough Electrical', 'Outlet rough-in (4 per room)', n * 4, 'EA', 1.25, 'Electrical', 18, { room }),
      line('Rough Electrical', 'Lighting and switch rough-in (2 per room)', n * 2, 'EA', 1.75, 'Electrical', 30, { room }),
      line('Rough Electrical', 'New branch circuits', Math.max(1, Math.ceil(n / 2)), 'EA', 3, 'Electrical', 60, { room }),
      line('Drywall', 'Patch openings after wiring', n, 'Room', 3, 'General', 40, { room }),
      line('Paint Interior', 'Patch-blend paint at affected walls', n, 'Room', 3, 'General', 35, { room }),
      line('Finish Electrical', 'Install devices, plates and fixtures; test and label', n, 'Room', 3, 'Electrical', 45, { room }),
      allowance('Light fixtures and decorative devices', 250 * n, room),
    ]
    if (heavy) out.push(line('Rough Electrical', 'Panel/subpanel upgrade for appliance load', 1, 'EA', 12, 'Electrical', 900, { confidence: 'Verify in Field', room }))
    if (renovation) out.push(line('Demolition', 'Remove existing devices and fixtures', n, 'Room', 1.5, 'General', 0, { room }))
    return out
  },
  furniture(size, room, renovation) {
    const lf = Math.max(4, Math.round(size.linearFt))
    return [
      ...common({ ...size, areaSf: Math.min(size.areaSf, 300) }, room, renovation),
      line('Trim/Casework/Hardware', 'Fabricate and install cabinetry / built-ins', lf, 'LF', 1.5, 'General', 180, { room, finishGrade: true }),
      line('Trim/Casework/Hardware', 'Install hardware, shelves and adjust doors', lf, 'LF', 0.3, 'General', 0, { room }),
      line('Paint Interior', 'Touch-up and finish at installed casework', 1, 'LS', 6, 'General', 60, { room }),
      allowance('Cabinet hardware and finish upgrades', 25 * lf, room),
    ]
  },
  hvac(size, room, renovation) {
    const n = size.count
    return [
      ...common({ ...size, areaSf: n * 150 }, room, false),
      line('Mechanical', 'Install mini-split head and condenser (production units)', n, 'EA', 8, 'Specialty', 350, { room }),
      line('Mechanical', 'Line set, condensate drain and startup/testing', n, 'EA', 4, 'Specialty', 220, { room }),
      line('Rough Electrical', 'Dedicated HVAC circuit and disconnect', Math.max(1, Math.ceil(n / 2)), 'EA', 3, 'Electrical', 140, { room }),
      line('Exterior Finishes', 'Condenser pad/bracket and wall penetration sealing', 1, 'EA', 4, 'General', 150, { room }),
      line('Paint Exterior', 'Paint line covers and patch at penetrations', 1, 'LS', 3, 'General', 60, { room }),
      allowance('HVAC equipment (heads and condenser)', 1800 * n, room),
      ...(renovation ? [line('Demolition', 'Remove existing units', n, 'EA', 2, 'General', 0, { room })] : []),
    ]
  },
  civil(size, room, renovation) {
    const sf = Math.max(40, size.areaSf)
    return [
      ...common({ ...size, areaSf: sf }, room, renovation),
      line('Framing', 'Frame altered partitions and blocking', Math.max(8, Math.round(sf / 25)), 'LF', 1, 'General', 18, { room, confidence: 'Verify in Field' }),
      line('Drywall', 'Hang, tape and finish drywall', sf, 'SF', 0.04, 'General', 0.6, { room }),
      line('Tiling/Counters/Flooring', 'Install new flooring', sf, 'SF', 0.08, 'General', 0.8, { room }),
      line('Paint Interior', 'Prime and paint walls and ceiling', sf * 3.5, 'SF', 0.012, 'General', 0.15, { room }),
      allowance('Flooring product', sf * 4, room),
    ]
  },
}
TEMPLATES.general = TEMPLATES.civil

export function templateTakeoff(trade, fields = {}) {
  const size = parseSize(fields.area_or_units)
  const renovation = !/new/i.test(fields.site_condition || 'Renovation')
  const room = fields.summary ? String(fields.summary).slice(0, 40) : 'Work area'
  const build = TEMPLATES[trade] || TEMPLATES.general
  const lines = build(size, room, renovation, fields)
  // #region agent log
  fetch('http://127.0.0.1:7905/ingest/bbee93bf-a8af-483b-abb1-e204ce6d7a84',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d157'},body:JSON.stringify({sessionId:'28d157',hypothesisId:'A',location:'templates.js:templateTakeoff',message:'template material amounts',data:{trade,area:fields.area_or_units,samples:lines.filter((l)=>l.qty>1&&l.materialAmount>0).slice(0,6).map((l)=>({category:l.category,qty:l.qty,unit:l.unit,materialAmount:l.materialAmount}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    source: 'template',
    project: { title: fields.summary || 'Proposed Work', description: fields.summary || '' },
    sheets: [],
    rooms: [{ room, demolition: renovation ? 'Selective' : 'None', newWork: fields.summary || '', mep: '', finishes: fields.material_grade || '', notes: `Size: ${size.label}` }],
    lines,
    exclusions: [
      { item: 'Permit and inspection fees', reason: 'Owner-paid unless added' },
      { item: 'Hazardous material abatement', reason: 'Not identified — priced separately if found' },
      { item: 'Concealed condition repairs', reason: 'Not visible before demolition' },
    ],
    clarifications: [
      { item: 'Field measurements', why: 'Quantities are based on the size you gave, not drawings', source: BRIEF, risk: 'Medium' },
    ],
    assumptions: [
      `Size taken from your answer: ${fields.area_or_units || 'not given'}.`,
      fields.timeline ? `Target timeline: ${fields.timeline}.` : 'Standard scheduling assumed.',
      'Site is accessible during normal working hours with water and power available.',
    ],
  }
}
