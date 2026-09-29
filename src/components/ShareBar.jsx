import { useState } from 'react'

export default function ShareBar({ onDownloadPdf }) {
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const createLink = () => {
    // In production: POST /proposals/:id/share -> returns a public,
    // read-only URL where the customer can view and Approve / Sign.
    const mockId = Math.random().toString(36).slice(2, 9)
    setLink(`https://app.yourcompany.com/p/${mockId}`)
  }

  const copy = () => {
    if (!link) return
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="share-bar">
      <button className="btn btn-primary" onClick={onDownloadPdf}>⬇ Download PDF</button>
      <button className="btn" onClick={() => alert('Wire this to a DOCX/XLSX export endpoint (see README).')}>⬇ Download Excel</button>
      {!link ? (
        <button className="btn" onClick={createLink}>🔗 Generate share link</button>
      ) : (
        <>
          <div className="share-link-box">{link}</div>
          <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        </>
      )}
    </div>
  )
}
