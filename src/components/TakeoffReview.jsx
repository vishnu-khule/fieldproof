import { CATEGORIES } from '../lib/estimate/config'

export default function TakeoffReview({ takeoff }) {
  const byCategory = CATEGORIES.map((name) => ({ name, lines: takeoff.lines.filter((l) => l.category === name) })).filter((c) => c.lines.length)
  const verify = takeoff.lines.filter((l) => l.confidence === 'Verify in Field').length

  return (
    <div className="doc">
      <div className="doc-tier-flag tier-modern">Takeoff review</div>
      <div className="doc-inner">
        <h1>{takeoff.project?.title || 'Extracted scope'}</h1>
        <div className="doc-meta">
          {takeoff.lines.length} line items · {byCategory.length} categories · {takeoff.sheets.length} sheets reviewed · {verify} to verify
        </div>
        {takeoff.note && <p className="doc-warning">{takeoff.note}</p>}
        {takeoff.warnings?.length > 0 && (
          <ul className="doc-warning-list">
            {takeoff.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        {byCategory.map((c) => (
          <div className="calc-block" key={c.name}>
            <h5>{c.name}</h5>
            <table className="doc-table compact">
              <thead><tr><th>Source</th><th>Scope item</th><th className="num">Qty</th><th className="num">Hrs/unit</th><th>Rate type</th><th>Confidence</th></tr></thead>
              <tbody>
                {c.lines.map((l) => (
                  <tr key={l.id} className={l.confidence === 'Excluded' ? 'zero-row' : ''}>
                    <td className="src">{l.source}</td>
                    <td>{l.scope}</td>
                    <td className="num">{l.qty} {l.unit}</td>
                    <td className="num">{l.hoursPerUnit}</td>
                    <td>{l.rateType}</td>
                    <td>{l.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {takeoff.clarifications.length > 0 && (
          <div className="doc-section">
            <h4>Clarifications</h4>
            <ul className="assumption-list">
              {takeoff.clarifications.map((c, i) => <li key={i}><strong>{c.item}</strong> — {c.why}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
