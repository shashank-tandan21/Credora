import React from 'react'
import {
  ShieldCheck,
  Sun,
  Moon,
  Landmark,
  UserCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { networkLabel } from '../../web3/config'
import { WalletControl } from '../web3/WalletControl'

export const Header: React.FC<{ activeTab: string; onSelectTab: (tab: string) => void }> = ({
  activeTab,
  onSelectTab,
}) => {
  const { setRole, networkMode, setNetworkMode } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Sparkles, targetRole: 'borrower' },
    { id: 'borrower', label: 'Borrower Portal', icon: UserCheck, targetRole: 'borrower' },
    { id: 'lender', label: 'Lending Pool', icon: Landmark, targetRole: 'lender' },
    { id: 'reviewer', label: 'Reviewer Desk', icon: ShieldCheck, targetRole: 'reviewer' },
  ] as const

  const handleNavClick = (id: string, targetRole: 'borrower' | 'lender' | 'reviewer') => {
    setRole(targetRole)
    onSelectTab(id)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0b0f19]/90 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => handleNavClick('overview', 'borrower')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs group-hover:bg-blue-500 transition-colors">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                    Credora
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 px-1.5 py-0.5 rounded-md">
                    PROTOCOL
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  Academic Micro-Lending
                </p>
              </div>
            </button>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id, item.targetRole)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-100 text-blue-600 dark:bg-slate-800 dark:text-blue-400 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Mode Switcher Pill */}
            <button
              onClick={() => setNetworkMode(networkMode === 'demo' ? 'onchain' : 'demo')}
              title={`Switch between simulated Demo Mode and real ${networkLabel} transactions`}
              aria-label={`Network mode: ${networkMode === 'demo' ? 'Demo Mode' : networkLabel}. Click to switch.`}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                networkMode === 'demo'
                  ? 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60 dark:hover:bg-amber-950/50'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 dark:hover:bg-emerald-950/50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  networkMode === 'demo' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold hidden sm:inline">
                {networkMode === 'demo' ? 'Demo Mode' : networkLabel}
              </span>
              <span className="font-semibold sm:hidden">
                {networkMode === 'demo' ? 'Demo' : 'Live'}
              </span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Web3 Wallet Connect / Disconnect */}
            <WalletControl />
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 dark:border-slate-800/60 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.targetRole)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
