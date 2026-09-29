import { useRef, useState } from 'react'

export default function InputBar({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const fileInput = useRef(null)

  const handleSend = () => {
    if (!text.trim() && files.length === 0) return
    onSend(text.trim(), files)
    setText('')
    setFiles([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const addFiles = (fileList) => {
    setFiles((prev) => [...prev, ...Array.from(fileList)])
  }

  return (
    <div className="input-bar">
      {files.length > 0 && (
        <div className="file-strip">
          {files.map((f, i) => (
            <div className="file-pill" key={i}>
              📎 {f.name}
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="input-row">
        <button className="icon-btn" title="Attach reference files" onClick={() => fileInput.current?.click()}>
          📎
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <textarea
          rows={1}
          placeholder="Describe the job — e.g. '2 bathroom plumbing renovation, need proposal for a customer in Pune'"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button className="icon-btn send-btn" onClick={handleSend} disabled={disabled} title="Send">
          ➤
        </button>
      </div>
    </div>
  )
}
