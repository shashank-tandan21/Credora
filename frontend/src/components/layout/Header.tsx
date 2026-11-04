import { Moon, Sun, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { networkLabel } from '../../web3/config'
import { WalletControl } from '../web3/WalletControl'
import { Button } from '../common/Button'
import type { UserRole } from '../../types'

export const Header = ({ activeTab, onSelectTab }: { activeTab: string; onSelectTab: (tab: string) => void }) => {
  const { setRole, networkMode, setNetworkMode } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const isPublic = activeTab === 'overview'
  const navigate = (role: UserRole) => { setRole(role); onSelectTab(role) }
  return <header className="site-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="header-inner">
      <div className="flex items-center gap-4 min-w-0">
        <button className="wordmark" aria-label="Credora home" onClick={() => onSelectTab('overview')}>
          <span className="brand-mark" aria-hidden="true">c.</span> Credora
        </button>
        {!isPublic && <label className="workspace-switch"><span className="sr-only">Workspace</span>
          <select aria-label="Workspace" value={activeTab} onChange={e => navigate(e.target.value as UserRole)}>
            <option value="borrower">Borrower</option><option value="lender">Lender</option><option value="reviewer">Reviewer</option>
          </select>
        </label>}
      </div>
      {isPublic ? <nav className="flex items-center gap-5" aria-label="Public navigation">
        <a href="#how-it-works" className="hidden sm:inline text-sm text-muted hover:text-foreground">How it works</a>
        <Button onClick={() => navigate('borrower')} rightIcon={<ArrowUpRight size={16} />}>Open app</Button>
      </nav> : <div className="header-controls">
        <label className="mode-select"><span className="sr-only">Network mode</span>
          <select aria-label="Network mode" value={networkMode} onChange={e => setNetworkMode(e.target.value as 'demo' | 'onchain')}>
            <option value="demo">Demo mode</option><option value="onchain">{networkLabel} · Testnet</option>
          </select>
        </label>
        <button className="icon-button" onClick={toggleTheme} aria-label={resolvedTheme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {networkMode === 'onchain' && <WalletControl />}
      </div>}
    </div>
  </header>
}
