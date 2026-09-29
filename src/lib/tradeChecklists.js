// Each trade defines the fields the estimation agent needs before it can
// confidently generate a proposal. `question` is what gets shown to the
// user; `options` (if present) render as quick-reply chips.

export const TRADE_KEYWORDS = {
  plumbing: ['plumb', 'pipe', 'bathroom', 'tap', 'drain', 'leak', 'sanitary'],
  electrical: ['electric', 'wiring', 'switch', 'mcb', 'panel', 'light point'],
  furniture: ['furniture', 'wardrobe', 'carpentry', 'modular kitchen', 'sofa', 'wood work', 'cabinet'],
  civil: ['construction', 'civil', 'masonry', 'renovation', 'tiling', 'flooring', 'wall'],
  hvac: ['hvac', 'ac ', 'air condition', 'duct', 'ventilation'],
}

export function detectTrade(text) {
  const t = text.toLowerCase()
  for (const [trade, words] of Object.entries(TRADE_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) return trade
  }
  return 'general'
}

// Shown when the user asks the assistant to propose options instead of naming one.
export const DEFERRED_OPTIONS = {
  plumbing: {
    material_grade: {
      question: 'Here are the pipe and fitting options I would propose. Which should I use?',
      options: ['CPVC — basic', 'UPVC — modern', 'Copper with premium fittings'],
    },
  },
  electrical: {
    material_grade: {
      question: 'Here are the wiring and switch options I would propose. Which should I use?',
      options: ['Standard copper wiring', 'Branded wiring (Finolex/Polycab)', 'Premium switchgear'],
    },
  },
  furniture: {
    material_grade: {
      question: 'Here are the material options I would propose. Which should I use?',
      options: ['Plywood + laminate', 'MDF', 'Solid wood'],
    },
  },
  civil: {
    material_grade: {
      question: 'Here are the material grades I would propose. Which should I use?',
      options: ['Standard grade', 'Mid-grade', 'Premium grade'],
    },
  },
  general: {
    material_grade: {
      question: 'Here are the material options I would propose. Which should I use?',
      options: ['Standard grade', 'Mid-range brands', 'Premium brands'],
    },
  },
}

const DEFERRAL_ANSWERS = new Set(['Propose options', 'Let AI propose tiers'])

export function deferredChoice(trade, field, value) {
  if (!DEFERRAL_ANSWERS.has(value)) return null
  return DEFERRED_OPTIONS[trade]?.[field] || null
}

export const CHECKLISTS = {
  plumbing: [
    { field: 'area_or_units', question: 'How many fixtures or rooms is this for? (e.g. "2 bathrooms")' },
    { field: 'site_condition', question: 'Is this new construction or a renovation of an existing site?', options: ['New construction', 'Renovation'] },
    { field: 'material_grade', question: 'Any preferred pipe/fitting brand, or should I propose options across tiers?', options: ['I have a preferred brand', 'Propose options'] },
    { field: 'timeline', question: 'What is the target completion timeline?', options: ['1 week', '2-3 weeks', '1 month+'] },
  ],
  electrical: [
    { field: 'area_or_units', question: 'How many rooms or light/socket points are involved?' },
    { field: 'load_requirement', question: 'Any specific load requirement (e.g. AC points, heavy appliances)?', options: ['Standard household load', 'Heavy appliances / commercial load'] },
    { field: 'material_grade', question: 'Preferred wiring/switch brand, or should I propose tiered options?', options: ['I have a preferred brand', 'Propose options'] },
    { field: 'timeline', question: 'Target completion timeline?', options: ['1 week', '2-3 weeks', '1 month+'] },
  ],
  furniture: [
    { field: 'area_or_units', question: 'What is being built, and roughly what size/dimensions?' },
    { field: 'material_grade', question: 'Preferred material?', options: ['Plywood + laminate', 'MDF', 'Solid wood', 'Let AI propose tiers'] },
    { field: 'finish', question: 'Any finish preference?', options: ['Matte', 'Glossy', 'Veneer', 'Not sure'] },
    { field: 'timeline', question: 'Target completion timeline?', options: ['2 weeks', '3-4 weeks', '1-2 months'] },
  ],
  civil: [
    { field: 'area_or_units', question: 'What is the approximate area (sqft/sqm)?' },
    { field: 'site_condition', question: 'New build or renovation?', options: ['New construction', 'Renovation'] },
    { field: 'material_grade', question: 'Any preferred material grade or brand?', options: ['Standard', 'Premium', 'Let AI propose tiers'] },
    { field: 'timeline', question: 'Target completion timeline?', options: ['2-4 weeks', '1-2 months', '2+ months'] },
  ],
  hvac: [
    { field: 'area_or_units', question: 'How many rooms or what area needs to be covered?' },
    { field: 'unit_type', question: 'What type of system?', options: ['Split AC', 'Central/ducted', 'VRV/VRF', 'Not sure'] },
    { field: 'timeline', question: 'Target completion timeline?', options: ['1 week', '2-3 weeks', '1 month+'] },
  ],
  general: [
    { field: 'area_or_units', question: 'Roughly how big is this job (area, rooms, or unit count)?' },
    { field: 'site_condition', question: 'New work or renovation of an existing setup?', options: ['New', 'Renovation'] },
    { field: 'material_grade', question: 'Any material/brand preference, or should I propose tiered options?', options: ['I have a preference', 'Propose options'] },
    { field: 'timeline', question: 'Target completion timeline?', options: ['1-2 weeks', '3-4 weeks', '1 month+'] },
  ],
}
