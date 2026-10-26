import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'

// A chip that opens a styled menu of choices — replaces the browser's own <select> list, which
// can't be styled and looked out of place. Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
export default function ChipSelect({ icon, value, options, onChange, label, active }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const ref = useRef(null)
  const current = options.find(([v]) => v === value)

  useEffect(() => {
    if (!open) return
    setAt(Math.max(0, options.findIndex(([v]) => v === value)))
    const out = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  function key(e) {
    if (!open) { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true) } return }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt((at + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((at - 1 + options.length) % options.length) }
    else if (e.key === 'Enter') { e.preventDefault(); onChange(options[at][0]); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={key}>
      <button type="button" className={`chip ${active ? 'on' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${label}: ${current?.[1]}`} onClick={() => setOpen(!open)}>
        {icon && <Icon name={icon} size={15} />}{current?.[1]}
        <Icon name="down" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="menu !left-0 !right-auto m-0 !w-60 list-none">
          {options.map(([v, l], i) => (
            <li key={v} role="option" aria-selected={v === value}>
              <button type="button" className="menu-item" onMouseEnter={() => setAt(i)}
                onClick={() => { onChange(v); setOpen(false) }}
                style={{ background: i === at ? 'color-mix(in srgb, var(--ink) 7%, transparent)' : undefined, fontWeight: v === value ? 700 : 500, color: v === value ? 'var(--pri)' : undefined }}>
                {l}{v === value && <Icon name="check" size={16} stroke={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
