import React from 'react'
import {
  ShieldCheck,
  Sun,
  Moon,
  Wallet,
  CheckCircle2,
  Landmark,
  UserCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { truncateAddress } from '../../utils/cn'
import type { UserRole } from '../../types'

export const Header: React.FC<{ activeTab: string; onSelectTab: (tab: string) => void }> = ({
  activeTab,
  onSelectTab,
}) => {
  const { walletAddress, role, setRole, networkMode, setNetworkMode, isConnected } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'borrower', label: 'Borrower Portal', icon: UserCheck },
    { id: 'lender', label: 'Lending Pool', icon: Landmark },
    { id: 'reviewer', label: 'Reviewer Desk', icon: ShieldCheck },
  ]

  const roles: { id: UserRole; label: string }[] = [
    { id: 'borrower', label: 'Borrower' },
    { id: 'lender', label: 'Lender' },
    { id: 'reviewer', label: 'Reviewer' },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => onSelectTab('overview')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 dark:bg-blue-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                    Credora
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
                    Protocol
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 hidden sm:block">
                  Academic Micro-Lending
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-100 text-blue-600 dark:bg-slate-800 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Controls & Actions */}
          <div className="flex items-center gap-3">
            {/* Persona / Role Selector Pill */}
            <div className="hidden lg:flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2">
                Persona:
              </span>
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRole(r.id)
                    if (r.id === 'borrower') onSelectTab('borrower')
                    else if (r.id === 'lender') onSelectTab('lender')
                    else if (r.id === 'reviewer') onSelectTab('reviewer')
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                    role === r.id
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Network / Demo Badge */}
            <button
              onClick={() => setNetworkMode(networkMode === 'demo' ? 'sepolia' : 'demo')}
              title="Click to toggle Demo Mode vs Sepolia Testnet"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                networkMode === 'demo'
                  ? 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  networkMode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold">
                {networkMode === 'demo' ? 'Demo Mode' : 'Sepolia'}
              </span>
            </button>

            {/* Light / Dark Theme Switcher */}
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

            {/* Wallet Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono">
              <Wallet className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-slate-700 dark:text-slate-300">
                {truncateAddress(walletAddress)}
              </span>
              {isConnected && (
                <span title="Connected">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </span>
              )}
            </div>
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
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded text-[11px] ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
