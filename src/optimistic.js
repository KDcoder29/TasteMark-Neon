// Deletes (and similar) feel instant: change the screen first, then tell the server. If the server
// refuses or can't be reached, put the screen back and say why. Returns true when it stuck.
//   apply() - change the screen now          run()  - the server call ({ error } or throws)
//   undo()  - put the screen back            fail(err) - tell the person
export async function optimistic({ apply, run, undo, fail }) {
  apply()
  try {
    const r = await run()
    if (r?.error) throw r.error
    return true
  } catch (err) {
    undo()
    fail(err)
    return false
  }
}
