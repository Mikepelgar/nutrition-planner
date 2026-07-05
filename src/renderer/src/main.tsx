import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './assets/main.css'

// Surface otherwise-silent async failures (visible in DevTools / captured by
// electron-log's console transport).
window.addEventListener('error', (e) => console.error('[window error]', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => console.error('[unhandled rejection]', e.reason))

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
