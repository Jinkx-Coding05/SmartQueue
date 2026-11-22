import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const storedTheme = localStorage.getItem('smartqueue.theme')
document.documentElement.dataset.theme = storedTheme === 'dark' ? 'dark' : 'light'
document.documentElement.lang = localStorage.getItem('smartqueue.language') === 'mr' ? 'mr' : 'en'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
