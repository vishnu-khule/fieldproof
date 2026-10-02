function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v8.2M4.6 7.4 8 10.8l3.4-3.4M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ShareBar({ onDownloadPdf, onDownloadExcel, onDownloadMarkdown }) {
  return (
    <div className="share-bar">
      <button type="button" className="btn icon-dl btn-primary" title="PDF" aria-label="Download PDF" onClick={onDownloadPdf}><Arrow /></button>
      <button type="button" className="btn icon-dl" title="Excel" aria-label="Download Excel estimate" onClick={onDownloadExcel}><Arrow /></button>
      <button type="button" className="btn icon-dl" title="Markdown" aria-label="Download Markdown quotation" onClick={onDownloadMarkdown}><Arrow /></button>
    </div>
  )
}
