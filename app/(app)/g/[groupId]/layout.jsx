import GroupSpace from '@/components/journal/GroupSpace'

// Group spaces are static: the pages hold no data (the group's data loads in the browser, see GroupSpace
// / SpaceProvider), so each /g/<id>/… page is rendered once on its first visit and cached ('force-static',
// which the docs give as the equivalent of generateStaticParams returning []). The nav Links prefetch
// them in full (prefetch on the Link, see Shell.jsx), so moving between views needs no server, offline too.
export const dynamic = 'force-static'
// …and every /g/<id>/… address is served by the one prebuilt /g/_/… page (next.config.mjs rewrites),
// from the nearby cache; GroupSpace reads the real id from the address
export function generateStaticParams() {
  return [{ groupId: '_' }]
}

export default function GroupLayout({ children }) {
  return <GroupSpace>{children}</GroupSpace>
}
