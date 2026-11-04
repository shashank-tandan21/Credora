import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (notify: () => void) => { const query = media(); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify) }
const ThemeContext = createContext<{ theme: Theme; resolvedTheme: ResolvedTheme; setTheme: (theme: Theme) => void; toggleTheme: () => void } | undefined>(undefined)
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('credora-theme'); return saved === 'dark' || saved === 'system' ? saved : 'light' } catch { return 'light' }
  })
  const systemDark = useSyncExternalStore(subscribe, () => media().matches, () => false)
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    try { localStorage.setItem('credora-theme', theme) } catch { /* Theme still works without storage. */ }
  }, [theme, resolvedTheme])
  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

