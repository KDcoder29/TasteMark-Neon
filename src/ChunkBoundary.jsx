import { Component, lazy, Suspense } from 'react'

// Loads a screen on demand (React.lazy). If its code can't be fetched (offline, or a new deploy changed the file),
// shows a small inline message with Try again, so the rest of the journal keeps working.
export default class ChunkBoundary extends Component {
  state = { Comp: lazy(this.props.load), failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error(error) }
  retry = () => this.setState({ Comp: lazy(this.props.load), failed: false })   // a fresh lazy, so the rejected import isn't reused
  render() {
    const { load, fallback, ...rest } = this.props
    if (this.state.failed) {
      return (
        <div className="py-16 text-center">
          <p className="m-0 text-base font-bold">The map needs a connection</p>
          <p className="mb-4 mt-1 text-sm" style={{ color: 'var(--mute)' }}>Your journal is safe. Check your network and try again.</p>
          <button className="btn btn-pri" onClick={this.retry}>Try again</button>
        </div>
      )
    }
    const Comp = this.state.Comp
    return <Suspense fallback={fallback}><Comp {...rest} /></Suspense>
  }
}
