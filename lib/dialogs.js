// The app's own "Are you sure?" and message boxes, replacing the browser's confirm() / alert().
// await askConfirm({ title, message, confirmLabel, danger }) -> true / false
// await showAlert({ title, message })                         -> when closed
// DialogHost.jsx draws whichever one is first in line; several at once wait their turn.

const defaults = { title: '', message: '', confirmLabel: 'OK', cancelLabel: 'Cancel', danger: false, tone: 'info' }

export function createDialogs() {
  const queue = []
  const listeners = new Set()
  let n = 0
  const emit = () => { const top = queue[0] || null; listeners.forEach(f => f(top)) }

  const ask = (kind, opts) => new Promise(resolve => {
    const o = typeof opts === 'string' ? { message: opts } : opts || {}
    queue.push({ ...defaults, ...o, id: ++n, kind, resolve })
    if (queue.length === 1) emit()
  })

  return {
    confirm: opts => ask('confirm', opts),
    alert: opts => ask('alert', opts),
    answer(value) {
      const d = queue.shift()
      if (!d) return
      d.resolve(d.kind === 'confirm' ? !!value : undefined)
      emit()
    },
    current: () => queue[0] || null,
    subscribe(f) { listeners.add(f); return () => listeners.delete(f) },
  }
}

export const dialogs = createDialogs()
export const askConfirm = opts => dialogs.confirm(opts)
export const showAlert = opts => dialogs.alert(typeof opts === 'string' ? { message: opts } : { tone: 'error', ...opts })
