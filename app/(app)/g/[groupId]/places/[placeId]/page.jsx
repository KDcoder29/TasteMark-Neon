import PlacesView from '@/components/journal/PlacesView'

// A place's address, opened directly (link, refresh): the space's Places view; SpaceProvider draws the sheet
// from the address (an unknown id shows no sheet). Static on demand like the other pages (no data here).
export const dynamic = 'force-static'
// every place address is served by this one prebuilt page (/…/places/_, next.config.mjs rewrites)
export function generateStaticParams() {
  return [{ placeId: '_' }]
}

export default function Page() {
  return <PlacesView />
}
