// Map tiles: CARTO's basemaps (Voyager by day, Dark Matter at night) are switched off (CARTO_FREE = false, they
// now need an API key). The app uses OpenStreetMap tiles, inverted by CSS in dark mode.
const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
const CARTO = '<a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'

export const OSM_FALLBACK = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, subdomains: 'abc' }

export function tileSource(dark) {
  return {
    url: `https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`,
    attribution: `${OSM}, © ${CARTO}`,
    subdomains: 'abcd',
  }
}

// Checked 2026-10-31: CARTO's basemaps now answer every tile with an "API KEY REQUIRED" watermark (HTTP 200, so
// no tileerror to fall back on). While that's true the app stays on OSM. Flip to true if CARTO is keyless again.
export const CARTO_FREE = false
