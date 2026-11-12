import React, { createContext, useContext, useEffect, useState } from 'react'
import { useConnection, useSignMessage } from 'wagmi'
import { api } from '../api/client'
import { defaultDemoMode, demoModeEnabled } from '../web3/config'
import type { BorrowerProfile, NetworkMode, TransactionStatus, UserRole } from '../types'

interface AuthContextType {
  walletAddress: string
  role: UserRole
  networkMode: NetworkMode
  isConnected: boolean
  profile: BorrowerProfile | null
  activeTx: TransactionStatus | null
  setRole: (role: UserRole) => void
  setNetworkMode: (mode: NetworkMode) => void
  connectWallet: (customAddress?: string) => Promise<void>
  disconnectWallet: () => void
  refreshProfile: () => Promise<void>
  setTransactionStatus: (status: TransactionStatus | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_DEMO_WALLET = '0x71C83955620935560935593883839281728392A1'

function initialNetworkMode(): NetworkMode {
  if (!demoModeEnabled) return 'onchain'
  const saved = localStorage.getItem('credora-network')
  if (saved === 'demo') return 'demo'
  // 'sepolia' is the value stored before local Hardhat support existed.
  if (saved === 'onchain' || saved === 'sepolia') return 'onchain'
  return defaultDemoMode ? 'demo' : 'onchain'
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connection = useConnection()
  const { signMessageAsync } = useSignMessage()

  const [walletAddress, setWalletAddress] = useState<string>(() => {
    return localStorage.getItem('credora-wallet') || DEFAULT_DEMO_WALLET
  })

  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('credora-role') as UserRole) || 'borrower'
  })

  const [networkMode, setNetworkModeState] = useState<NetworkMode>(initialNetworkMode)

  // Keep the API client's mode in sync with the provider (it may hold a stale saved mode).
  useEffect(() => {
    api.setNetworkMode(networkMode)
  }, [networkMode])

  const [isDemoConnected, setIsDemoConnected] = useState<boolean>(true)
  const [profile, setProfile] = useState<BorrowerProfile | null>(null)
  const [activeTx, setActiveTx] = useState<TransactionStatus | null>(null)

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

  const setNetworkMode = (mode: NetworkMode) => {
    api.setNetworkMode(mode)
    setNetworkModeState(mode)
    setActiveTx(null)
    localStorage.setItem('credora-network', mode)
  }

  const connectWallet = async (customAddress?: string) => {
    const target = customAddress || DEFAULT_DEMO_WALLET
    setWalletAddress(target)
    setIsDemoConnected(true)
    localStorage.setItem('credora-wallet', target)
    api.setWallet(target)
    if (networkMode === 'onchain' && connection.isConnected && connection.address) {
      api.resetWalletAuth()
      await api.ensureAuthenticated()
    }
    await refreshProfile()
  }

  // On-chain sign-in: the backend issues a nonce message, the wallet signs it, and the
  // backend recovers the signer. Concurrent requests share one sign-in via the API client.
  useEffect(() => {
    api.setWalletAuthenticator(async (wallet) => {
      const challenge = await api.requestNonce(wallet)
      const signature = await signMessageAsync({ message: challenge.message })
      await api.verifySignature(wallet, challenge.nonce, signature, challenge.message)
    })
    return () => api.setWalletAuthenticator(null)
  }, [signMessageAsync])

  const disconnectWallet = () => {
    setIsDemoConnected(false)
    api.setToken(null)
    setProfile(null)
  }

  useEffect(() => {
    api.setWallet(walletAddress)
    api.setRole(role)
    refreshProfile()
  }, [walletAddress, role])

  // In on-chain mode the backend session must belong to the connected wallet, otherwise
  // receipt verification (which matches the event's wallet) could never succeed.
  useEffect(() => {
    if (networkMode !== 'onchain' || !connection.address) return
    if (connection.address.toLowerCase() !== walletAddress.toLowerCase()) {
      connectWallet(connection.address)
    }
  }, [networkMode, connection.address, walletAddress])

  return (
    <AuthContext.Provider
      value={{
        walletAddress,
        role,
        networkMode,
        isConnected: networkMode === 'onchain' ? connection.isConnected : isDemoConnected,
        profile,
        activeTx,
        setRole,
        setNetworkMode,
        connectWallet,
        disconnectWallet,
        refreshProfile,
        setTransactionStatus: setActiveTx,
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
