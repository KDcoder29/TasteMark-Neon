import Icon from './Icons'
import { findMapsLink, isMapsLink, mapsUrl } from './mapsLink'

// "Maps" button for any place: opens the saved Google Maps link, or a Maps search for the name,
// area and city. Nothing to search for -> no button.
export function MapsButton({ place, className = '', label = 'Maps' }) {
  const url = mapsUrl(place)
  if (!url) return null
  return (
    <a className={`btn ${className}`} href={url} target="_blank" rel="noopener noreferrer"
      title={isMapsLink(place.maps_url) ? 'Open the saved Google Maps link' : 'Search Google Maps for this place'}>
      <Icon name="map" size={16} /> {label}
    </a>
  )
}

// The address line as a link to Maps (pin + "Alkapuri, Vadodara").
export function MapsWhere({ place, where, size = 14, className = '' }) {
  const url = mapsUrl(place)
  if (!where) return null
  const body = <><Icon name="pin" size={size} /> {where}</>
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={`mapswhere ${className}`} title="Open in Google Maps">{body}</a>
    : <span className={className}>{body}</span>
}

// Optional "Google Maps link" in the forms. Pasting a whole WhatsApp message works: the link is
// picked out of it. Empty is fine: the Maps button then searches the name, area and city.
export default function MapsLinkField({ value, onChange, place }) {
  const v = value || ''
  const bad = v.trim() && !isMapsLink(v.trim())
  const preview = mapsUrl({ ...place, maps_url: v.trim() })
  const mute = { color: 'var(--mute)' }
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium" style={mute} htmlFor="maps-link">Google Maps link <span className="font-normal">(optional, for exact directions)</span></label>
      <div className="flex gap-2">
        <input id="maps-link" inputMode="url" autoComplete="off" value={v} placeholder="Paste from Maps: Share → Copy link"
          onChange={e => onChange(e.target.value)}
          onPaste={e => { const found = findMapsLink(e.clipboardData.getData('text')); if (found) { e.preventDefault(); onChange(found) } }}
          className="input" aria-invalid={!!bad} style={bad ? { borderColor: 'var(--bad)' } : null} />
        {preview && (
          <a href={preview} target="_blank" rel="noopener noreferrer" className="btn shrink-0 !px-3 !text-sm" title="See where this opens in Google Maps">
            <Icon name="map" size={16} /> Check
          </a>
        )}
      </div>
      <p className="m-0 mt-1 text-xs" style={bad ? { color: 'var(--bad)' } : mute}>
        {bad ? 'That isn’t a Google Maps link. In Maps tap Share, then Copy link.'
          : v.trim() ? 'Maps will open this exact spot.' : 'Without a link, Maps searches the name, area and city.'}
      </p>
    </div>
  )
}
