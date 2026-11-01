import PlacesView from '@/components/journal/PlacesView'

// A place's address, opened directly (link, refresh): the space's Places view; SpaceProvider draws the sheet
// from the address (an unknown id shows no sheet). Static on demand like the other pages (no data here).
export const dynamic = 'force-static'

export default function Page() {
  return <PlacesView />
}
