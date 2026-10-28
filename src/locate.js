// One fresh, high-accuracy reading from the phone's GPS (the browser's Geolocation API).
// It's only asked for when someone taps "I'm here" or opens Near me, and it is never stored on
// the server: only a place's own position is saved, never the person's.

export const GOOD_ACCURACY = 50          // metres; worse than this, "I'm here" asks you to check the pin

const CODES = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }

export function getPosition({ geo = globalThis.navigator?.geolocation, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!geo) return reject(Object.assign(new Error('No location in this browser'), { code: 'unsupported' }))
    geo.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      e => reject(Object.assign(new Error(e?.message || 'Location failed'), { code: CODES[e?.code] || 'unavailable' })),
      { enableHighAccuracy: true, timeout, maximumAge: 0 })
  })
}
