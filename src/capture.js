// "Take photo" opens the phone's own camera app (better focus, flash and HDR than an in-app
// camera). Only offered on touch devices: a laptop webcam is no use for photographing a bill,
// and there the button would just open the same file picker as "Upload".
export function canTakePhoto(win) {
  try {
    return !!win?.matchMedia?.('(pointer: coarse)').matches
  } catch {
    return false
  }
}
