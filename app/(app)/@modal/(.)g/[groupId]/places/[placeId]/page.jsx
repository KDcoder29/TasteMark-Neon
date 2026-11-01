// Soft navigation to /g/[groupId]/places/[id] (a tap on a card, a Near me pin): intercepted, so the view underneath
// stays mounted. The sheet itself is drawn by SpaceProvider from the address, so this renders nothing.
// Hard loads (link, refresh) skip this and use g/[groupId]/places/[placeId]/page.jsx.
export function generateStaticParams() {
  return []
}

export default function PlaceMarker() {
  return null
}
