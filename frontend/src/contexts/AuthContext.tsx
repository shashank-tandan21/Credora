import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { BorrowerProfile, TransactionStatus, UserRole } from '../types'

interface AuthContextType {
  walletAddress: string
  role: UserRole
  networkMode: 'demo' | 'sepolia'
  isConnected: boolean
  profile: BorrowerProfile | null
  activeTx: TransactionStatus | null
  setRole: (role: UserRole) => void
  setNetworkMode: (mode: 'demo' | 'sepolia') => void
  connectWallet: (customAddress?: string) => Promise<void>
  disconnectWallet: () => void
  refreshProfile: () => Promise<void>
  setTransactionStatus: (status: TransactionStatus | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_DEMO_WALLET = '0x71C83955620935560935593883839281728392A1'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string>(() => {
    return localStorage.getItem('credora-wallet') || DEFAULT_DEMO_WALLET
  })

  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('credora-role') as UserRole) || 'borrower'
  })

  const [networkMode, setNetworkModeState] = useState<'demo' | 'sepolia'>(() => {
    return (localStorage.getItem('credora-network') as 'demo' | 'sepolia') || 'demo'
  })

  const [isConnected, setIsConnected] = useState<boolean>(true)
  const [profile, setProfile] = useState<BorrowerProfile | null>(null)
  const [activeTx, setActiveTx] = useState<TransactionStatus | null>(null)

  useEffect(() => {
    api.setWallet(walletAddress)
    api.setRole(role)
    refreshProfile()
  }, [walletAddress, role])

  const refreshProfile = async () => {
    try {
      const p = await api.getBorrowerProfile()
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    api.setRole(newRole)
    localStorage.setItem('credora-role', newRole)
  }

  const setNetworkMode = (mode: 'demo' | 'sepolia') => {
    setNetworkModeState(mode)
    localStorage.setItem('credora-network', mode)
  }

  const connectWallet = async (customAddress?: string) => {
    const target = customAddress || DEFAULT_DEMO_WALLET
    setWalletAddress(target)
    setIsConnected(true)
    localStorage.setItem('credora-wallet', target)
    api.setWallet(target)
    await refreshProfile()
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    api.setToken(null)
    setProfile(null)
  }

  const setTransactionStatus = (status: TransactionStatus | null) => {
    setActiveTx(status)
  }

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        role,
        networkMode,
        isConnected,
        profile,
        activeTx,
        setRole,
        setNetworkMode,
        connectWallet,
        disconnectWallet,
        refreshProfile,
        setTransactionStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

