'use client'
import App from '../src/App.jsx'
import ErrorBoundary from '../src/ErrorBoundary'
import DialogHost from '../src/DialogHost'

// What src/main.jsx used to mount.
export default function AppShell() {
  return <ErrorBoundary><App /><DialogHost /></ErrorBoundary>
}
