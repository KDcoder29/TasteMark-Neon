// "Removed · Undo": the item disappears at once, but is only really deleted after a few seconds.
// One item waits at a time; removing another (or leaving the screen) deletes the waiting one now.
export function createUndo({ commit, delay = 5000, onChange = () => {} }) {
  let item = null
  let timer = null
  const set = v => { item = v; onChange(v) }

  function flush() {
    if (!item) return
    clearTimeout(timer)
    const done = item
    set(null)
    commit(done)
  }

  return {
    remove(next) {
      flush()
      set(next)
      timer = setTimeout(flush, delay)
    },
    undo() {
      clearTimeout(timer)
      const back = item
      if (back) set(null)
      return back
    },
    flush,
    pending: () => item,
  }
}
