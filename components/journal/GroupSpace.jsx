'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SpaceProvider from '@/components/journal/SpaceProvider'
import { useApp } from '@/components/app/AppProvider'
import { safeDecode } from '@/lib/routes'

// A group space (app/(app)/g/[groupId]/layout.jsx). It waits for the groups list. A group you aren't
// in (left, removed, deleted, or a made-up id) goes back to Personal, but only when the list really came
// from the server: a failed load (no connection) keeps the address and waits for the 15 s re-check.
export default function GroupSpace({ children }) {
  const id = safeDecode(useParams().groupId)
  const router = useRouter()
  const { groups, groupsKnown, shareRev, route } = useApp()
  const group = groups.find(g => g.id === id) || null
  // under the open Groups sheet (you just left this group there) it waits until the sheet closes,
  // so the sheet stays up with its "You left …" message
  const underSheet = !!route.sheet
  useEffect(() => {
    if (group) { try { localStorage.setItem('space', group.id) } catch {} }   // the last space used
    else if (groupsKnown && !underSheet) { try { localStorage.setItem('space', 'personal') } catch {}; router.replace('/') }
  }, [group?.id, groupsKnown, underSheet])
  if (!group) return <div className="space-y-3 pt-6"><div className="skel" /><div className="skel" /><div className="skel" /></div>
  return <SpaceProvider key={group.id + shareRev} group={group}>{children}</SpaceProvider>
}
