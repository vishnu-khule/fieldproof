import { CONFIDENCE_STATEMENT, FALLBACK_OP_PERCENT, FALLBACK_RATES, SCHEMATIC_NOTE, VARIANTS, VARIANT_KEYS, formatMoney, hasSchematic, rateBasisNote } from '../lib/estimate/config'
import { categoryMath, hoursLabel, rateLabel, scopeBySource } from '../lib/estimate/rollup'
import { CategoryBars, PhaseTimeline, ScopeMap, VariantComparison } from './Diagrams'

function Section({ n, title, children }) {
  return (
    <section className="doc-section">
      <h4>{n}. {title}</h4>
      {children}
    </section>
  )
}

function SoftText({ text }) {
  const parts = String(text || '').split(/([_./·\-])/)
  return parts.map((part, i) => (
    /[_./·\-]/.test(part) ? <span key={i}>{part}<wbr /></span> : <span key={i}>{part}</span>
  ))
}

function ConfidenceTag({ value }) {
  const tone = value === 'Excluded' ? 'excluded' : value === 'Verify in Field' ? 'verify' : value === 'Allowance' ? 'allowance' : 'confirmed'
  return <span className={`conf-tag conf-${tone}`}>{value}</span>
}

export default function ProposalDocument({ proposal, variant }) {
  if (!proposal) return null
  const { takeoff, estimates, narrative, schedule, meta } = proposal
  const est = estimates[variant]
  const money = (n) => formatMoney(n)
  const project = takeoff.project || {}
  const facts = [['Address', project.address], ['Permit', project.permit], ['Project type', project.type], ['Areas', project.areas]].filter(([, v]) => v)
  const active = est.categories.filter((c) => c.items.length)
  const empty = est.categories.filter((c) => !c.items.length)
  const allowances = est.categories.find((c) => c.name === 'Allowances').items
  const excluded = takeoff.lines.filter((l) => l.confidence === 'Excluded')

  return (
    <div className={`doc tier-${variant}`} id="proposal-doc">
      <header className="doc-cover">
        <div className="doc-cover-plan">
          <span className="doc-cover-kicker">{est.title} plan</span>
          <span>{est.warrantyMonths}-month workmanship warranty</span>
        </div>
        <h1>{narrative.projectTitle}</h1>
        <div className="doc-meta">
          Prepared for {meta.customer} · {meta.date} · Valid 30 days · {takeoff.source === 'ai' ? 'Drawing-based takeoff' : 'Brief-based takeoff'}
        </div>
        <p className="doc-cover-blurb">{est.blurb}</p>
        <p className="doc-cover-finish">{est.finishNote}</p>
      </header>
      <div className="doc-inner">
        <div className="doc-price-row">
          {VARIANT_KEYS.map((k) => (
            <div key={k} className={`doc-price-card tier-${k} ${k === variant ? 'active' : ''}`}>
              <span>{VARIANTS[k].title}</span>
              <strong>{money(estimates[k].total)}</strong>
              <em>{VARIANTS[k].warrantyMonths}-month warranty · finishes ×{VARIANTS[k].finishMultiplier}</em>
            </div>
          ))}
        </div>

        <Section n={1} title="Project summary">
          <p>{narrative.executiveSummary}</p>
          <p className="doc-variant-note"><strong>{est.title}:</strong> {narrative.variantNotes[variant]}</p>
          {facts.length > 0 && (
            <dl className="doc-facts">
              {facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
        </Section>

        <Section n={2} title="Reference files reviewed">
          {takeoff.sheets.length ? (
            <table className="doc-table compact">
              <thead><tr><th>File</th><th>Page / Sheet</th><th>Title</th><th>Cost impact</th><th>Notes</th></tr></thead>
              <tbody>
                {takeoff.sheets.map((s, i) => (
                  <tr key={i}>
                    <td>{s.file}</td>
                    <td>{[s.page, s.sheet].filter(Boolean).join(' / ')}</td>
                    <td>{s.title}</td>
                    <td>{s.costImpact || 'No direct cost impact identified'}</td>
                    <td>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No drawings were supplied. Scope and quantities come from the project brief and your answers.</p>
          )}
        </Section>

        <Section n={3} title="Scope extracted by drawing sheet">
          <p>{narrative.scopeNarrative}</p>
          <table className="doc-table compact">
            <thead><tr><th>Source</th><th>Scope extracted</th></tr></thead>
            <tbody>
              {scopeBySource(takeoff.lines).map(({ source, items }) => (
                <tr key={source}>
                  <td className="src"><SoftText text={source} /></td>
                  <td>
                    <ul className="doc-scope-list">
                      {items.map((l) => (
                        <li key={l.id}>{l.category}: {l.scope} ({l.qty} {l.unit}) <ConfidenceTag value={l.confidence} /></li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasSchematic(takeoff) && <ScopeMap takeoff={takeoff} estimate={est} note={SCHEMATIC_NOTE} />}
        </Section>

        <Section n={4} title="Room-by-room scope">
          <table className="doc-table compact">
            <thead><tr><th>Room / area</th><th>Demolition</th><th>New work</th><th>MEP</th><th>Finishes</th></tr></thead>
            <tbody>
              {takeoff.rooms.map((r, i) => (
                <tr key={i}><td>{r.room}</td><td>{r.demolition}</td><td>{r.newWork}</td><td>{r.mep}</td><td>{r.finishes}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n={5} title="Estimate variants">
          <VariantComparison estimates={estimates} active={variant} />
        </Section>

        <Section n={6} title={`Category summary — ${est.title}`}>
          <table className="doc-table">
            <thead><tr><th>Category</th><th className="num">Labor</th><th className="num">Materials</th><th className="num">Total</th></tr></thead>
            <tbody>
              {est.categories.map((c) => (
                <tr key={c.name} className={c.total ? '' : 'zero-row'}>
                  <td>{c.name}</td>
                  <td className="num">{money(c.labor)}</td>
                  <td className="num">{money(c.materials)}</td>
                  <td className="num">{money(c.total)}</td>
                </tr>
              ))}
              <tr className="doc-subtotal-row">
                <td>Total cost</td>
                <td className="num">{money(est.labor)}</td>
                <td className="num">{money(est.materials)}</td>
                <td className="num">{money(est.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Overhead / profit {Math.round(est.opPercent * 100)}%</td>
                <td className="num">{money(est.overheadProfit)}</td>
              </tr>
              <tr className="doc-total-row">
                <td colSpan={3}>Total project cost</td>
                <td className="num">{money(est.total)}</td>
              </tr>
            </tbody>
          </table>
          <CategoryBars estimate={est} />
        </Section>

        <Section n={7} title="Category calculation details">
          <p className="doc-muted no-print">Open a category to see its line items and math. The PDF always prints every category in full.</p>
          {active.map((c) => (
            <details className="calc-block" key={c.name}>
              <summary>
                <span className="calc-name">{c.name}</span>
                <span className="calc-count">{c.items.length} line{c.items.length === 1 ? '' : 's'}</span>
                <span className="calc-total">{money(c.total)}</span>
              </summary>
              <table className="doc-table compact calc">
                <colgroup>
                  <col className="col-source" /><col className="col-scope" /><col className="col-qty" />
                  <col className="col-hrs" /><col className="col-rate" /><col className="col-labor" />
                  <col className="col-mat" /><col className="col-total" /><col className="col-conf" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Source</th><th>Scope item</th><th className="num">Qty</th><th className="num">Hrs / units</th>
                    <th className="num">Rate</th><th className="num">Labor</th><th className="num">Materials</th><th className="num">Total</th><th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((l) => (
                    <tr key={l.id}>
                      <td className="src"><SoftText text={l.source} /></td>
                      <td>{l.scope}</td>
                      <td className="num">{l.qty} {l.unit}</td>
                      <td className="num">{hoursLabel(l)}</td>
                      <td className="num">{rateLabel(l)}</td>
                      <td className="num">{money(l.labor)}</td>
                      <td className="num">{money(l.material)}</td>
                      <td className="num">{money(l.total)}</td>
                      <td><ConfidenceTag value={l.confidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <pre className="calc-math">{categoryMath(c).join('\n')}</pre>
              <div className="calc-subtotal">
                {c.name} subtotal: Labor={money(c.labor)}, Materials={money(c.materials)}, Total={money(c.total)}
              </div>
            </details>
          ))}
          {empty.length > 0 && (
            <p className="doc-muted">
              No scope found in the reviewed sources for: {empty.map((c) => c.name).join(', ')}. These categories are carried at $0.00.
            </p>
          )}
        </Section>

        <Section n={8} title="Allowances">
          {allowances.length ? (
            <table className="doc-table compact">
              <thead><tr><th>Allowance item</th>{VARIANT_KEYS.map((k) => <th key={k} className="num">{VARIANTS[k].title}</th>)}</tr></thead>
              <tbody>
                {allowances.map((l) => (
                  <tr key={l.id}>
                    <td>{l.scope}</td>
                    {VARIANT_KEYS.map((k) => (
                      <td key={k} className="num">{money(l.materialAmount * (l.finishGrade ? VARIANTS[k].finishMultiplier : 1))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No allowances carried.</p>}
        </Section>

        <Section n={9} title="Indicative schedule">
          <PhaseTimeline schedule={schedule} />
        </Section>

        <Section n={10} title="Exclusions">
          <ul className="assumption-list">
            {takeoff.exclusions.map((e, i) => <li key={i}><strong>{e.item}</strong> — {e.reason}</li>)}
            {excluded.filter((l) => l.category !== 'Permits').map((l) => <li key={l.id}><strong>{l.scope}</strong> — excluded pending verification ({l.source})</li>)}
          </ul>
        </Section>

        <Section n={11} title="Verify in field / clarifications">
          {takeoff.clarifications.length ? (
            <ul className="assumption-list">
              {takeoff.clarifications.map((c, i) => (
                <li key={i}>
                  <strong>{c.item}</strong> — {c.why}{c.source ? ` (${c.source})` : ''}{c.risk ? ` · Cost risk: ${c.risk}` : ''}
                  {c.answer && <span className="doc-answer"> · Customer: {c.answer}</span>}
                </li>
              ))}
            </ul>
          ) : <p>No open clarifications.</p>}
        </Section>

        <Section n={12} title="Assumptions, payment and warranty">
          <ul className="assumption-list">
            {narrative.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          <p><strong>Payment terms:</strong> {narrative.paymentTerms}</p>
          <p><strong>Workmanship warranty:</strong> {est.warrantyMonths} months ({est.title}).</p>
        </Section>

        <Section n={13} title="Formula basis">
          <p>
            {rateBasisNote(takeoff.rateBasis)} Applied: General labor {money((takeoff.rateBasis?.rates || FALLBACK_RATES).General)}/hr · Electrical/skilled {money((takeoff.rateBasis?.rates || FALLBACK_RATES).Electrical)}/hr · Specialty production {money((takeoff.rateBasis?.rates || FALLBACK_RATES).Specialty)}/unit.
            Labor = Qty × Hrs/unit × Rate. Category totals sum their lines; O&amp;P of {Math.round((takeoff.rateBasis?.opPercent ?? FALLBACK_OP_PERCENT) * 100)}% is applied once to the subtotal.
            Variants share the same scope; finish-grade materials scale ×{VARIANTS.modern.finishMultiplier} (Modern) and ×{VARIANTS.premium.finishMultiplier} (Premium).
          </p>
        </Section>

        <Section n={14} title="Confidence statement">
          <blockquote className="doc-quote">{CONFIDENCE_STATEMENT}</blockquote>
        </Section>
      </div>
    </div>
  )
}
