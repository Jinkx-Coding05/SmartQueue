import { Moon, Sun } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { localize, translate, type Language } from '../i18n/catalog'

type Theme = 'light' | 'dark'
type Preferences = { language: Language; theme: Theme; setLanguage: (value: Language) => void; toggleTheme: () => void; t: (value: string) => string }
const PreferencesContext = createContext<Preferences | null>(null)
const languageKey = 'smartqueue.language'
const themeKey = 'smartqueue.theme'

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem(languageKey) === 'mr' ? 'mr' : 'en')
  const [theme, setThemeState] = useState<Theme>(() => localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light')
  const setLanguage = useCallback((value: Language) => { localStorage.setItem(languageKey, value); setLanguageState(value) }, [])
  const toggleTheme = useCallback(() => setThemeState((current) => { const next = current === 'dark' ? 'light' : 'dark'; localStorage.setItem(themeKey, next); return next }), [])
  const t = useCallback((value: string) => translate(value, language), [language])
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dataset.theme = theme }, [language, theme])
  const value = useMemo(() => ({ language, theme, setLanguage, toggleTheme, t }), [language, theme, setLanguage, toggleTheme, t])
  return <PreferencesContext.Provider value={value}>{children}<TranslationObserver language={language} /><PreferenceControls /></PreferencesContext.Provider>
}

export function useAppPreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('useAppPreferences must be used within AppPreferencesProvider.')
  return value
}

function TranslationObserver({ language }: { language: Language }) {
  useEffect(() => {
    if (language === 'en') return
    const translateTree = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node: Node | null = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode()
      while (node) {
        const parent = node.parentElement
        if (!parent || parent.closest('script,style,textarea,[contenteditable="true"],.user-data')) continue
        const original = node.nodeValue ?? ''
        const trimmed = original.trim()
        const translated = localize(trimmed, language)
        if (translated !== trimmed) node.nodeValue = original.replace(trimmed, translated)
        node = walker.nextNode()
      }
      const elements = root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>('*')] : root instanceof Document ? [root.documentElement, ...root.querySelectorAll<HTMLElement>('*')] : []
      for (const element of elements) {
        for (const attribute of ['aria-label', 'placeholder', 'title']) {
          const value = element.getAttribute(attribute)
          if (value) { const translated = localize(value, language); if (translated !== value) element.setAttribute(attribute, translated) }
        }
      }
    }
    translateTree(document.body)
    let scheduled = false
    const observer = new MutationObserver((mutations) => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => { scheduled = false; for (const mutation of mutations) { if (mutation.type === 'characterData') translateTree(mutation.target); for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateTree(node) } })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [language])
  return null
}

function PreferenceControls() {
  const { language, setLanguage, theme, toggleTheme } = useAppPreferences()
  const location = useLocation()
  if (location.pathname === '/admin/queue-display') return null
  return <div className="app-preference-controls" aria-label="Display preferences">
    <label><span className="sr-only">Language</span><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="mr">मराठी</option></select></label>
    <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
  </div>
}
