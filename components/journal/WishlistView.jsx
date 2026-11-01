'use client'
import Wishlist from '@/components/journal/Wishlist'
import { useSpace } from '@/components/journal/SpaceProvider'

// Want to try (the /want-to-try pages).
export default function WishlistView() {
  const { wishPrefill, setWishPrefill, me, group, wishlist, names, isOwner, reload: load, setCreating } = useSpace()
  return (
        <Wishlist prefill={wishPrefill} onPrefillUsed={() => setWishPrefill(null)} me={me} group={group} items={wishlist} names={names} isOwner={isOwner} onChanged={load}
          onWent={w => setCreating({ prefill: { name: w.name, city: w.city, area: w.area, categories: w.categories || [], maps_url: w.maps_url || '', lat: w.lat, lng: w.lng, loc_source: w.loc_source }, wishId: w.id })} />
  )
}
