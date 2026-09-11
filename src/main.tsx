import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import '../tokens.css'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Set after the render call rather than before it. Setting it first disarmed
// index.html's "App did not load" net outright — the flag was already true
// whatever happened next, so a failed boot showed an empty purple page instead
// of the diagnostic it was meant to trigger. React 18 renders concurrently, so
// this still isn't proof the tree mounted; the ErrorBoundary above is what
// actually catches a crash.
(window as { __appMounted?: boolean }).__appMounted = true;
