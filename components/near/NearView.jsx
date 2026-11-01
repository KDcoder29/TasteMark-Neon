'use client'
import ChunkBoundary from '@/components/app/ChunkBoundary'
import { needsLocation } from '@/lib/locationValue'
import { useSpace } from '@/components/journal/SpaceProvider'

// the map screen (and Leaflet) loads only when Near me is opened, to keep the main bundle small;
// without a connection ChunkBoundary shows "The map needs a connection" with Try again
const loadNearMe = () => import('@/components/near/NearMe')

// Near me (the /near pages).
export default function NearView() {
  const { places, wishlist, names, me, group, canEditPlace, canEditWish, openPlace, reload: load, setFixing } = useSpace()
  return (
        <ChunkBoundary load={loadNearMe} fallback={<p className="text-center text-sm py-16" style={{ color: 'var(--mute)' }}>Loading the map…</p>}
          places={places} wishlist={wishlist} names={names} uid={me} group={group} toFix={needsLocation(places, wishlist, canEditPlace, canEditWish).length}
          onOpenPlace={id => openPlace(id)} canEdit={x => (x.kind === 'place' ? canEditPlace(x) : canEditWish(x))} onSaved={load} onFix={() => setFixing(needsLocation(places, wishlist, canEditPlace, canEditWish))} />
  )
}
