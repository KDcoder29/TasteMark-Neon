// Everything BiteMark does, in plain words: the Feature guide (FeatureGuide.jsx) shows this list.
// `action` = what its "Try it" button opens (App.jsx handles each one in ACTIONS).

export const ACTIONS = ['add', 'voice', 'manual', 'search', 'filters', 'craving', 'picker', 'wishlist', 'near', 'groups', 'you', 'dark']

export const FEATURES = [
  { title: 'Add what you ate', items: [
    { icon: 'camera', title: 'Scan a bill', action: 'add', text: 'Tap + and photograph or upload the bill. Dish names and prices fill in; the photo is saved with the place.' },
    { icon: 'mic', title: 'Say it', action: 'voice', text: '“Sankalp, masala dosa, 180 rupees, 5 stars, crispy.” Pause between parts, say “next” for another dish.' },
    { icon: 'pencil', title: 'Add by hand', action: 'manual', text: 'Type the place, its dishes, the price, your stars and a comment.' },
    { icon: 'repeat', title: 'Stars, comment and Order again?', text: 'Every dish gets your stars and a comment, and you can mark whether you’d order it again.' },
  ] },
  { title: 'Find it again', items: [
    { icon: 'search', title: 'Search', action: 'search', text: 'Type a dish, place, area or a word from your comments. Small typos are fine.' },
    { icon: 'sliders', title: 'Filters and sort', action: 'filters', text: 'Narrow by city, category, price and stars, or show only dishes you’d order again.' },
    { icon: 'chat', title: 'Craving?', action: 'craving', text: 'Ask in your own words, like “something cold” or “south indian under ₹150”. It understands food families.' },
    { icon: 'dice', title: 'Where to eat?', action: 'picker', text: 'Pick favourites or new places, set a budget, and let BiteMark choose for you.' },
  ] },
  { title: 'Plan and share', items: [
    { icon: 'bookmark', title: 'Want to try', action: 'wishlist', text: 'Save places to visit. Tap We went to turn one into a journal entry, or Maps for directions.' },
    { icon: 'users', title: 'Groups', action: 'groups', text: 'Create a group or join with an invite code. Everyone adds places, rates dishes, reacts and comments. On the map, filter by Added by.' },
    { icon: 'locate', title: 'Near me', action: 'near', text: 'Your places and Want to try list, nearest first, as a list or on a map. Pick a city, or a distance from 1 to 10 km.' },
    { icon: 'pin', title: 'Exact location', text: 'Places are put on the map by their landmark and city (≈). For the exact spot: Find on Google Maps, Share → Copy link, Paste link.' },
    { icon: 'share', title: 'Share from Google Maps', action: 'near', text: 'On Android with BiteMark installed: Share a place from Google Maps to BiteMark. It saves the exact spot, or adds the place.' },
    { icon: 'locate', title: 'Are you at …?', action: 'near', text: 'When you’re at a place that is only placed by landmark (≈), BiteMark asks, and one tap saves its exact spot.' },
    { icon: 'navigate', title: 'Plan a food route', action: 'near', text: 'On the Near me map, pick 2 to 8 places. BiteMark finds the shortest order and opens the route in Google Maps.' },
    { icon: 'activity', title: 'Food heatmap', action: 'near', text: 'Switch on Heatmap on the Near me map to see where you eat most: your food home.' },
    { icon: 'play', title: 'Replay your food year', action: 'near', text: 'Watch your places appear on the map in the order you added them, month by month.' },
    { icon: 'map', title: 'Directions', text: 'Tap Directions or Maps on any place to open Google Maps, straight to the exact spot when the place has one.' },
    { icon: 'send', title: 'Send to friends', text: 'Open a place and tap Send to share a clean picture of its best dishes on WhatsApp.' },
    { icon: 'receipt', title: 'Bills', text: 'Bill photos you scanned are kept with the place. Open the place and tap Bill to see them.' },
  ] },
  { title: 'Handy extras', items: [
    { icon: 'sparkle', title: 'Your food story', action: 'you', text: 'Your favourite dish, go-to food, order-again share and most visited city, in the You tab.' },
    { icon: 'refresh', title: 'Pull to refresh', text: 'On a phone, pull the list down from the top to fetch the latest.' },
    { icon: 'down', title: 'Swipe to close', text: 'On a phone, swipe any bottom sheet down to close it.' },
    { icon: 'moon', title: 'Dark mode', action: 'dark', text: 'Easier on the eyes at night. Switch it from the top bar or the You tab.' },
    { icon: 'home', title: 'Works on a bad network', text: 'Your journal opens from your phone even without internet, and updates when you’re back online.' },
  ] },
]
