// The overlay slot at / : nothing. With [...rest]/page.jsx, a soft navigation away from an intercepted
// overlay (Task 3) always matches an empty slot, so the overlay closes.
export default function ModalNone() {
  return null
}
