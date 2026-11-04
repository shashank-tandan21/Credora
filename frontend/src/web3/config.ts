import type { Chain, Hex } from 'viem'
import { hardhat, sepolia } from 'viem/chains'
import { createConfig, http, injected } from 'wagmi'

const SUPPORTED_CHAINS: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [hardhat.id]: hardhat,
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const configuredChainId = readPositiveNumber(import.meta.env.VITE_CHAIN_ID, hardhat.id)

/** The single chain this build talks to. Every other chain is treated as a mismatch. */
export const targetChain: Chain = SUPPORTED_CHAINS[configuredChainId] ?? sepolia
export const chainSupported = configuredChainId in SUPPORTED_CHAINS
export const isLocalChain = targetChain.id === hardhat.id
export const networkLabel = isLocalChain ? 'Hardhat Local' : 'Sepolia'

/**
 * Confirmation depth before a transaction is shown as confirmed. Sepolia defaults to 2
 * blocks to absorb shallow reorganizations; a local Hardhat node never reorgs.
 */
export const requiredConfirmations = readPositiveNumber(
  import.meta.env.VITE_CONFIRMATIONS,
  isLocalChain ? 1 : 2,
)

/** Maximum wait for a receipt before the transaction is reported as timed out. */
export const receiptTimeoutMs = readPositiveNumber(import.meta.env.VITE_TX_TIMEOUT_MS, 180_000)

/** On-chain Hardhat Local mode is the default; Demo Mode can be enabled explicitly. */
export const defaultDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  transports: {
    [targetChain.id]: http(import.meta.env.VITE_RPC_URL || undefined),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}

export function explorerTxUrl(hash: string | undefined): string | undefined {
  const explorer = targetChain.blockExplorers?.default.url
  return hash && explorer ? `${explorer}/tx/${hash as Hex}` : undefined
}
