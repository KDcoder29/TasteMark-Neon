import { Component } from 'react'

// If any screen crashes, show a way out instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) { console.error(error, info?.componentStack) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-xs">
          <p className="m-0 text-lg font-bold">Something went wrong</p>
          <p className="mb-5 mt-1 text-sm" style={{ color: 'var(--mute)' }}>Your journal is safe. Reload to carry on.</p>
          <button className="btn btn-pri" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
