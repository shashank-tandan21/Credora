import React from 'react'
import { AlertTriangle, LogOut, PlugZap, Wallet } from 'lucide-react'
import { useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { useAuth } from '../../contexts/AuthContext'
import { truncateAddress } from '../../utils/cn'
import { networkLabel, targetChain } from '../../web3/config'
import { missingContracts } from '../../web3/contracts'
import { useOnChainStatus } from '../../web3/hooks'
import { Button } from '../common/Button'

function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && 'ethereum' in window
}

function useWalletActions() {
  const connectors = useConnectors()
  const connect = useConnect()
  const switchChain = useSwitchChain()
  return {
    connect: () => {
      const connector = connectors[0]
      if (connector) connect.mutate({ connector })
    },
    isConnecting: connect.isPending,
    switchToTarget: () => switchChain.mutate({ chainId: targetChain.id }),
    isSwitching: switchChain.isPending,
  }
}

/** Header wallet control: demo wallet, connect, wrong-network switch, or connected account. */
export const WalletControl: React.FC = () => {
  const { networkMode, walletAddress } = useAuth()
  const status = useOnChainStatus()
  const actions = useWalletActions()
  const disconnect = useDisconnect()

  if (networkMode === 'demo') {
    return (
      <div
        title="Simulated demo wallet. No blockchain connection is used in Demo Mode."
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line dark:border-line bg-surface dark:bg-surface text-xs font-mono"
      >
        <Wallet className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        <span className="hidden sm:inline text-foreground dark:text-foreground">{truncateAddress(walletAddress)}</span>
        <span className="hidden sm:inline text-xs font-sans font-semibold uppercase text-amber-600 dark:text-amber-400">Demo</span>
      </div>
    )
  }

  if (!status.configured) {
    return (
      <div
        title={`Missing contract addresses: ${missingContracts.join(', ') || 'unsupported VITE_CHAIN_ID'}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-medium"
      >
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Not configured</span>
      </div>
    )
  }

  if (!status.isConnected) {
    if (!hasInjectedWallet()) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
          title="No browser wallet detected."
        >
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
          <PlugZap className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Wallet not connected · Install</span>
          <span className="sm:hidden">Wallet</span>
        </a>
      )
    }
    return (
      <button
        type="button"
        onClick={actions.connect}
        disabled={actions.isConnecting}
        aria-label="Connect Wallet"
        title="MetaMask is not connected. Click to connect."
        className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{actions.isConnecting ? 'Connecting…' : 'MetaMask not connected'}</span>
        <span className="sm:hidden">{actions.isConnecting ? 'Wait…' : 'Connect'}</span>
      </button>
    )
  }

  if (status.wrongChain) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={actions.switchToTarget}
        isLoading={actions.isSwitching}
        leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
        title={`Wallet is on chain ${status.walletChainId}; this app uses ${targetChain.name} (${targetChain.id}).`}
        aria-label={`Switch to ${networkLabel}`}
      >
        <span className="hidden sm:inline">Switch to {networkLabel}</span>
        <span className="sm:hidden">Switch</span>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {/* On phones the address collapses into the disconnect button's tooltip. */}
      <div
        title={status.address}
        className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-mono dark:border-emerald-900/60 dark:bg-emerald-950/30"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" aria-hidden="true" />
        <span className="hidden sm:inline font-sans font-semibold text-emerald-700 dark:text-emerald-300">Connected</span>
        <span className="text-foreground dark:text-foreground">{truncateAddress(status.address)}</span>
      </div>
      <button
        type="button"
        onClick={() => disconnect.mutate()}
        aria-label="Disconnect wallet"
        title={`Disconnect ${status.address}`}
        className="relative p-2 rounded-lg text-muted hover:bg-surface hover:text-foreground dark:text-foreground dark:hover:bg-subtle dark:hover:text-muted transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span className="sm:hidden absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Inline notice explaining why an on-chain action is unavailable, with the fix. */
export const OnChainNotice: React.FC<{ action: string }> = ({ action }) => {
  const status = useOnChainStatus()
  const actions = useWalletActions()

  if (!status.enabled) return null

  if (!status.configured) {
    return (
      <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-xl border text-xs bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          On-chain mode is not configured for {networkLabel}
          {missingContracts.length > 0 && <> (missing: {missingContracts.join(', ')})</>}. Set the
          <code className="mx-1 font-mono">VITE_*_ADDRESS</code>variables described in the frontend README, or switch
          back to Demo Mode.
        </span>
      </div>
    )
  }

  if (!status.isConnected) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs bg-brand-soft border-line text-accent dark:bg-brand-soft dark:border-line dark:text-accent">
        <span>Connect a wallet on {networkLabel} to {action}.</span>
        {hasInjectedWallet() ? (
          <Button size="sm" onClick={actions.connect} isLoading={actions.isConnecting}>
            Connect Wallet
          </Button>
        ) : (
          <a className="font-semibold underline" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            Install a browser wallet
          </a>
        )}
      </div>
    )
  }

  if (status.wrongChain) {
    return (
      <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-xs bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200">
        <span>
          Your wallet is on chain {status.walletChainId}. Switch to {targetChain.name} ({targetChain.id}) to {action}.
          Transactions are blocked until then.
        </span>
        <Button size="sm" variant="destructive" onClick={actions.switchToTarget} isLoading={actions.isSwitching}>
          Switch network
        </Button>
      </div>
    )
  }

  return null
}
