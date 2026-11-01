import PlacesView from '@/components/journal/PlacesView'

// A direct link or a refresh at /you: Personal Places with the sheet on top (the shell draws the sheet
// from the address). Opened from inside the app, the @modal marker keeps the page underneath instead.
export default function Page() {
  return <PlacesView />
}
