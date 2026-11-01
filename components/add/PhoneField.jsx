import Icon from '@/components/ui/Icons'
import { isPhone, pastedContact } from '@/lib/phone'
import { mapsUrl } from '@/lib/mapsLink'

// Optional "Contact number" in the forms. No free source has it for Indian restaurants, so the
// button opens Google Maps searching this place: long-press its number there, Copy, paste here.
// A paste that also has a Maps link (a copied block from Maps) fills the link too (onLink).
export default function PhoneField({ value, onChange, place, onLink, className = 'mb-3' }) {
  const v = value || ''
  const bad = v.trim() && !isPhone(v.trim())
  const find = mapsUrl({ name: place?.name, area: place?.area, city: place?.city })
  const mute = { color: 'var(--mute)' }
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium" style={mute} htmlFor="place-phone">Contact number <span className="font-normal">(optional)</span></label>
      <div className="flex gap-2">
        <input id="place-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={v}
          placeholder="e.g. 079 2640 5900" onChange={e => onChange(e.target.value)}
          onPaste={e => {
            const { phone, link } = pastedContact(e.clipboardData.getData('text'))
            if (!phone && !link) return                     // something else: paste as it is
            e.preventDefault()
            if (phone) onChange(phone)
            if (link) onLink?.(link)
          }}
          className="input" aria-invalid={!!bad} style={bad ? { borderColor: 'var(--bad)' } : null} />
        {find && (
          <a href={find} target="_blank" rel="noopener noreferrer" className="btn shrink-0 !px-3 !text-sm" title="Find this place's number on Google Maps">
            <Icon name="search" size={16} /> Find
          </a>
        )}
      </div>
      <p className="m-0 mt-1 text-xs" style={bad ? { color: 'var(--bad)' } : mute}>
        {bad ? 'That doesn’t look like a phone number.'
          : find ? 'Tap Find, long-press the number in Google Maps, Copy, and paste it here.' : 'Type the place’s name first to find its number on Google Maps.'}
      </p>
    </div>
  )
}
