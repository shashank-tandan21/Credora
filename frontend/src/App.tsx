import React, { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Header } from './components/layout/Header'
import { LendingPool } from './components/views/LendingPool'
import { ReviewerDesk } from './components/views/ReviewerDesk'
import { LandingPage } from './components/views/LandingPage'
import { BorrowerPortal } from './components/views/BorrowerPortal'
import { TransactionToast } from './components/web3/TransactionToast'
import { Web3Provider } from './web3/Web3Provider'
import { api } from './api/client'
import type { CreditAssessment, LoanRequest } from './types'

const MainApp: React.FC = () => {
  const { role, networkMode } = useAuth()
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [borrowerSubTab, setBorrowerSubTab] = useState<'overview' | 'credit' | 'borrow'>('overview')
  const [currentAssessment, setCurrentAssessment] = useState<CreditAssessment | null>(null)
  const [loans, setLoans] = useState<LoanRequest[]>([])

  const loadData = async () => {
    try {
      const assessment = await api.getCurrentAssessment()
      const loanList = await api.getLoans()
      setCurrentAssessment(assessment)
      setLoans(loanList)
    } catch {
      // fallback handled inside client
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleNavigate = (target: string) => {
    if (target === 'credit') {
      setBorrowerSubTab('credit')
      setActiveTab('borrower')
    } else if (target === 'loans') {
      setBorrowerSubTab('borrow')
      setActiveTab('borrower')
    } else {
      setBorrowerSubTab('overview')
      setActiveTab(target)
    }
  }

  // Sync tab if user changes persona from header
  useEffect(() => {
    if (role === 'lender' && activeTab === 'borrower') {
      setActiveTab('lender')
    } else if (role === 'reviewer' && activeTab === 'borrower') {
      setActiveTab('reviewer')
    }
  }, [role])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors">
      <Header activeTab={activeTab} onSelectTab={handleNavigate} />

      {/* Remount views on mode change so demo and on-chain state never mix. */}
      <main key={networkMode} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <LandingPage onNavigate={handleNavigate} />
        )}

        {activeTab === 'borrower' && (
          <BorrowerPortal
            currentAssessment={currentAssessment}
            loans={loans}
            onRefresh={loadData}
            initialSubTab={borrowerSubTab}
            onAssessmentUpdated={(newAssessment) => {
              setCurrentAssessment(newAssessment)
              loadData()
            }}
            onLoanCreated={(newLoan) => {
              setLoans((prev) => [newLoan, ...prev])
              loadData()
            }}
          />
        )}

        {activeTab === 'lender' && <LendingPool />}

        {activeTab === 'reviewer' && <ReviewerDesk />}
      </main>

      <TransactionToast />

      {/* Institutional Quality Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              C
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Credora Protocol
            </span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span>Academic Micro-Lending Prototype</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-mono">
              academic_model=true
            </span>
            <span className="text-[11px] text-slate-400">
              Frontend & Quality: <span className="font-semibold text-slate-600 dark:text-slate-300">Owner C</span>
            </span>
          </div>
        </div>
      </footer>
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
