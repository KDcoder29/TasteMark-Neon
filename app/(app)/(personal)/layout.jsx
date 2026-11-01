'use client'
import { useEffect } from 'react'
import SpaceProvider from '@/components/journal/SpaceProvider'
import { useApp } from '@/components/app/AppProvider'

// The Personal space (/, /want-to-try, /near): its data loads at once and is shared by its views.
export default function PersonalLayout({ children }) {
  const { shareRev } = useApp()
  useEffect(() => { try { localStorage.setItem('space', 'personal') } catch {} }, [])   // the last space used
  return <SpaceProvider key={'personal' + shareRev} group={null}>{children}</SpaceProvider>
}
