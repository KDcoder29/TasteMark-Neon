import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary'
import DialogHost from './DialogHost'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary><App /><DialogHost /></ErrorBoundary>
  </StrictMode>,
)

// Makes the app installable on the phone home screen
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
