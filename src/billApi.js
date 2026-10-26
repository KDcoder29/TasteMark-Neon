import { supabase } from './supabase'
import { compressBill } from './billPhoto'

// Saves the bill photos scanned in the place form. Who may add / see / delete is decided by the
// database rules on bill_photos (same as places: personal = you, group = its members).
export async function saveBills(placeId, files) {
  if (!placeId || !files?.length) return
  const rows = []
  for (const f of files) rows.push({ place_id: placeId, image: await compressBill(f) })
  const { error } = await supabase.from('bill_photos').insert(rows)
  if (error) throw error
}

// the images themselves are only fetched when someone opens them (the journal loads just the ids)
export async function loadBills(placeId) {
  const { data, error } = await supabase.from('bill_photos')
    .select('id, user_id, image, created_at').eq('place_id', placeId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function deleteBill(id) {
  const { error } = await supabase.from('bill_photos').delete().eq('id', id)
  if (error) throw error
}
