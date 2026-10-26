// Bill photos kept with a place. Stored in the database as a small JPEG data URL (~150 KB):
// sharp enough to read every line when zoomed, small enough that ~3,000 fit in Neon's free tier.

const LONG_SIDE = 1600
const QUALITY = 0.7

// size to store a w x h photo at: long side 1600 px, never enlarged
export function billImageSize(w, h) {
  const s = Math.min(1, LONG_SIDE / Math.max(w, h))
  return { width: Math.round(w * s), height: Math.round(h * s) }
}

// the person who added it, or the group owner (matches the database rule "bills remove")
export const canDeleteBill = (bill, me, isOwner) => bill.user_id === me || !!isOwner

// photo file -> 'data:image/jpeg;base64,...' (keeps colour; the OCR copy is the gray one)
export async function compressBill(file) {
  const img = await createImageBitmap(file)
  const { width, height } = billImageSize(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'                       // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  img.close?.()
  return canvas.toDataURL('image/jpeg', QUALITY)
}
