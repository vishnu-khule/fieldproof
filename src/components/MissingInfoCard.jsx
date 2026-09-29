export default function MissingInfoCard({ missing, onAnswer }) {
  return (
    <div className="gap-card">
      <div className="gap-card-title">A few details before I generate the proposal</div>
      {missing.map((item) => (
        <div className="gap-item" key={item.field}>
          <div className="gap-question">{item.question}</div>
          {item.options && (
            <div className="gap-options">
              {item.options.map((opt) => (
                <button key={opt} className="chip-btn" onClick={() => onAnswer(item.field, opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
