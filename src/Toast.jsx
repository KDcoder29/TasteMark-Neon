import { createPortal } from 'react-dom'

// A short message above the bottom bar, with one optional action ("Undo").
// Portalled so a transformed parent can never trap it.
export default function Toast({ text, action, onAction }) {
  return createPortal(
    <div className="toast" role="status" aria-live="polite">
      <span className="min-w-0 truncate">{text}</span>
      {action && <button onClick={onAction} className="toast-act">{action}</button>}
    </div>,
    document.body,
  )
}
