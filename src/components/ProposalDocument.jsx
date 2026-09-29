import { formatCurrency } from '../lib/pricingEngine'

export default function ProposalDocument({ proposal }) {
  if (!proposal) return null
  const c = proposal.currency

  return (
    <div className="doc" id="proposal-doc">
      <div className={`doc-tier-flag tier-${proposal.tier}`}>{proposal.title} option</div>
      <div className="doc-inner">
        <h1>{proposal.projectTitle}</h1>
        <div className="doc-meta">
          Prepared for {proposal.customer} · {proposal.date} · Valid 14 days
        </div>

        <div className="doc-section">
          <h4>Summary</h4>
          <p>{proposal.blurb} {proposal.tierNote}</p>
        </div>

        <div className="doc-section">
          <h4>Scope of work</h4>
          <p>{proposal.scope}</p>
        </div>

        <div className="doc-section">
          <h4>Estimate</h4>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {proposal.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className="num">{item.qty} {item.unit}</td>
                  <td className="num">{formatCurrency(item.rate, c)}</td>
                  <td className="num">{formatCurrency(item.amount, c)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>Subtotal + margin</td>
                <td className="num">{formatCurrency(proposal.marginedSubtotal, c)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Tax (18%)</td>
                <td className="num">{formatCurrency(proposal.tax, c)}</td>
              </tr>
              <tr className="doc-total-row">
                <td colSpan={3}>Total</td>
                <td className="num">{formatCurrency(proposal.total, c)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="doc-section">
          <h4>Timeline &amp; warranty</h4>
          <p>Estimated completion per agreed schedule. Warranty on workmanship: {proposal.warrantyMonths} months.</p>
        </div>

        <div className="doc-section">
          <h4>Payment terms</h4>
          <p>{proposal.paymentTerms}</p>
        </div>

        <div className="doc-section">
          <h4>Assumptions</h4>
          <ul className="assumption-list">
            {proposal.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
