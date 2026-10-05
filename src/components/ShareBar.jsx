function IconPdf() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2h5.2L12.5 4.8V13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.5 2v3.5H13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.5 8h5M5.5 10.2h3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconExcel() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="2.5" width="10" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 6h10M3 9h10M7 6v7.5M10.5 6v7.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconMarkdown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 4.5 5.8 8l-2.3 3.5h1.5l1.4-2.2 1.4 2.2h1.5L7.8 8l2.3-3.5H8.6L7.2 6.3 5.8 4.5H3.5Z" fill="currentColor" />
      <path d="M10.2 4.5h1.3v7H10.2V4.5Z" fill="currentColor" />
      <path d="M12.8 8.2c0-1.5 1-2.4 2.2-2.4v1.2c-.7 0-1.1.4-1.1 1 0 .6.4 1 1.1 1v1.2c-1.2 0-2.2-.9-2.2-2.4Z" fill="currentColor" />
    </svg>
  )
}

const FORMATS = [
  { id: 'pdf', label: 'Download PDF', short: 'PDF', Icon: IconPdf, primary: true, prop: 'onDownloadPdf' },
  { id: 'excel', label: 'Download Excel estimate', short: 'Excel', Icon: IconExcel, prop: 'onDownloadExcel' },
  { id: 'markdown', label: 'Download Markdown quotation', short: 'Markdown', Icon: IconMarkdown, prop: 'onDownloadMarkdown' },
]

export default function ShareBar({ layout = 'icons', onDownloadPdf, onDownloadExcel, onDownloadMarkdown }) {
  const handlers = { onDownloadPdf, onDownloadExcel, onDownloadMarkdown }
  const rootClass = layout === 'labeled' ? 'share-bar share-bar-labeled' : 'share-bar'

  return (
    <div className={rootClass}>
      {FORMATS.map(({ id, label, short, Icon, primary, prop }) => {
        const onClick = handlers[prop]
        const className = layout === 'labeled'
          ? `btn btn-dl-labeled${primary ? ' btn-primary' : ''}`
          : `btn icon-dl${primary ? ' btn-primary' : ''}`
        return (
          <button
            key={id}
            type="button"
            className={className}
            title={short}
            aria-label={label}
            onClick={onClick}
          >
            <Icon />
            {layout === 'labeled' && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
