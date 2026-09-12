import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
// fonts are bundled (not a CDN) so they're precached and render offline
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import './index.css'
import App from './App'

// ask the browser not to evict workout data under storage pressure
navigator.storage?.persist?.()

// ponytail: HashRouter so deep links work on any static host without rewrite rules
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </HashRouter>
  </StrictMode>,
)
