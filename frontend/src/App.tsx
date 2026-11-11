import React, { useEffect, useCallback, useSyncExternalStore } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Header } from './components/layout/Header'
import { LendingPool } from './components/views/LendingPool'
import { ReviewerDesk } from './components/views/ReviewerDesk'
import { LandingPage } from './components/views/LandingPage'
import { BorrowerPortal } from './components/views/BorrowerPortal'
import { TransactionToast } from './components/web3/TransactionToast'
import { Web3Provider } from './web3/Web3Provider'
import { useQuery } from '@tanstack/react-query'
import { parseRoute, routeHash } from './utils/navigation'
import { api } from './api/client'
const subscribeRoute = (notify: () => void) => { window.addEventListener('hashchange', notify); return () => window.removeEventListener('hashchange', notify) }
const readRoute = () => window.location.hash

const MainApp: React.FC = () => {
  const { networkMode, walletAddress, isConnected, setRole, role } = useAuth()
  const hash = useSyncExternalStore(subscribeRoute, readRoute, () => '')
  const { page: activeTab, section: borrowerSubTab } = parseRoute(hash)
  const query = useQuery({
    queryKey: ['workspace', networkMode, walletAddress],
    queryFn: async () => {
      const [assessment, loans] = await Promise.all([api.getCurrentAssessment(), networkMode === 'demo' ? api.getLoans() : Promise.resolve([])])
      return { assessment, loans }
    },
    enabled: networkMode === 'demo' || isConnected,
  })
  const loadData = () => { void query.refetch() }
  const handleNavigate = useCallback((target: string) => {
    const nextHash = routeHash(target)
    const next = parseRoute(nextHash)
    if (next.page !== 'overview') setRole(next.page)
    window.location.hash = nextHash
  }, [setRole])
  useEffect(() => {
    if (activeTab !== 'overview' && role !== activeTab) setRole(activeTab)
    document.title = activeTab === 'overview' ? 'Credora | A clearer way forward' : 'Credora | ' + (activeTab === 'borrower' ? 'Borrower' : activeTab === 'lender' ? 'Lending pool' : 'Reviewer')
  }, [activeTab, role, setRole])
  useEffect(() => {
    if (networkMode !== 'demo') return
    const refresh = () => { void query.refetch() }
    window.addEventListener('storage', refresh)
    window.addEventListener('credora-demo-store-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('credora-demo-store-updated', refresh)
    }
  }, [networkMode, query])

  return (
    <div className="app-shell">
      <Header activeTab={activeTab} onSelectTab={handleNavigate} />

      {/* Remount views on mode change so demo and on-chain state never mix. */}
      <main id="main-content" tabIndex={-1} key={networkMode + walletAddress} className="app-main">
        {activeTab === 'overview' && (
          <LandingPage onNavigate={handleNavigate} />
        )}

        {activeTab === 'borrower' && query.isLoading && <p role="status" className="text-muted mb-4">Loading your workspace…</p>}
        {activeTab === 'borrower' && query.isError && <div role="alert" className="inline-notice mb-4"><p>We couldn't load your assessment. Please try again.</p><button className="text-link" onClick={loadData}>Retry</button></div>}
        {activeTab === 'borrower' && !query.isLoading && !query.isError && (
          <BorrowerPortal
            currentAssessment={query.data?.assessment ?? null}
            loans={query.data?.loans ?? []}
            onRefresh={loadData}
            initialSubTab={borrowerSubTab}
            onSubTabChange={(section) => handleNavigate(section === 'overview' ? 'borrower' : section)}
            onAssessmentUpdated={loadData}
            onLoanCreated={loadData}
          />
        )}

        {activeTab === 'lender' && <LendingPool />}

        {activeTab === 'reviewer' && <ReviewerDesk />}
      </main>

      <TransactionToast />

      <footer className="site-footer"><div className="footer-inner">
        <span><strong className="text-foreground">Credora</strong> · Credit with a clearer picture.</span>
        <div className="flex flex-wrap gap-5"><button onClick={() => handleNavigate('overview')}>About Credora</button><button onClick={() => handleNavigate('reviewer')}>Operator access</button></div>
      </div></footer>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Web3Provider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </Web3Provider>
    </ThemeProvider>
  )
}
