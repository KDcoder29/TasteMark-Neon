'use client'
import Activity from '@/components/journal/Activity'
import { useSpace } from '@/components/journal/SpaceProvider'

// A group's Activity (the /g/[groupId]/activity page).
export default function ActivityView() {
  const { me, group, names } = useSpace()
  return group && <Activity me={me} group={group} names={names} />
}
