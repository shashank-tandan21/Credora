import { type Abi, type Address, isAddress, keccak256, toBytes, zeroAddress } from 'viem'
import { chainSupported, isLocalChain } from './config'
import {
  creditScoreRegistryAbi,
  disputeManagerAbi,
  identityRegistryAbi,
  lendingPoolAbi,
  loanManagerAbi,
  mockUsdcAbi,
  recoveryManagerAbi,
} from './generated/abis'
import { localDeployment } from './generated/localDeployment'

export type ContractKey = keyof typeof localDeployment.contracts

const ENV_ADDRESSES: Record<ContractKey, string | undefined> = {
  mockUsdc: import.meta.env.VITE_MOCK_USDC_ADDRESS,
  identityRegistry: import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS,
  creditScoreRegistry: import.meta.env.VITE_CREDIT_SCORE_REGISTRY_ADDRESS,
  lendingPool: import.meta.env.VITE_LENDING_POOL_ADDRESS,
  loanManager: import.meta.env.VITE_LOAN_MANAGER_ADDRESS,
  recoveryManager: import.meta.env.VITE_RECOVERY_MANAGER_ADDRESS,
  disputeManager: import.meta.env.VITE_DISPUTE_MANAGER_ADDRESS,
}

/**
 * Environment variables take precedence. Only on the local Hardhat chain do addresses
 * fall back to the generated deterministic local deployment, so a Sepolia build can
 * never silently use local addresses.
 */
function resolveAddress(key: ContractKey): Address | undefined {
  const fromEnv = ENV_ADDRESSES[key]?.trim()
  if (fromEnv && isAddress(fromEnv)) return fromEnv
  if (isLocalChain) return localDeployment.contracts[key]
  return undefined
}

const resolved = Object.fromEntries(
  (Object.keys(ENV_ADDRESSES) as ContractKey[]).map((key) => [key, resolveAddress(key)]),
) as Record<ContractKey, Address | undefined>

export const missingContracts = (Object.keys(resolved) as ContractKey[]).filter((key) => !resolved[key])
export const contractsConfigured = chainSupported && missingContracts.length === 0

/** Resolved addresses; zeroAddress placeholders are never queried while unconfigured. */
export const addresses = Object.fromEntries(
  (Object.keys(resolved) as ContractKey[]).map((key) => [key, resolved[key] ?? zeroAddress]),
) as Record<ContractKey, Address>

export const contracts = {
  mockUsdc: { address: addresses.mockUsdc, abi: mockUsdcAbi },
  identityRegistry: { address: addresses.identityRegistry, abi: identityRegistryAbi },
  creditScoreRegistry: { address: addresses.creditScoreRegistry, abi: creditScoreRegistryAbi },
  lendingPool: { address: addresses.lendingPool, abi: lendingPoolAbi },
  loanManager: { address: addresses.loanManager, abi: loanManagerAbi },
  recoveryManager: { address: addresses.recoveryManager, abi: recoveryManagerAbi },
  disputeManager: { address: addresses.disputeManager, abi: disputeManagerAbi },
} as const

type AbiErrorItem = Extract<Abi[number], { type: 'error' }>

/** Every custom error in the protocol, so reverts bubbling across contracts still decode. */
export const protocolErrorsAbi: Abi = (() => {
  const seen = new Map<string, AbiErrorItem>()
  for (const { abi } of Object.values(contracts)) {
    for (const item of abi as Abi) {
      if (item.type === 'error') {
        seen.set(`${item.name}(${item.inputs.map((input) => input.type).join(',')})`, item)
      }
    }
  }
  return [...seen.values()]
})()

export function roleId(name: string): `0x${string}` {
  return keccak256(toBytes(name))
}

export const ROLES = {
  ATTESTER: roleId('ATTESTER_ROLE'),
  FUNDER: roleId('FUNDER_ROLE'),
  REVIEWER: roleId('REVIEWER_ROLE'),
  RECOVERY_OFFICER: roleId('RECOVERY_OFFICER_ROLE'),
  REGISTRAR: roleId('REGISTRAR_ROLE'),
} as const

/** Mirrors ILoanManager.LoanStatus. */
export const LOAN_STATUS = [
  'None',
  'Requested',
  'Active',
  'Overdue',
  'Restructured',
  'Repaid',
  'Cancelled',
  'Defaulted',
] as const

/** Mirrors IDisputeManager.DisputeStatus. */
export const DISPUTE_STATUS = ['None', 'Open', 'Upheld', 'Rejected', 'Withdrawn'] as const

/** Mirrors IRecoveryManager.RequestStatus. */
export const RECOVERY_STATUS = ['None', 'Submitted', 'Approved', 'Rejected', 'Cancelled', 'Completed'] as const
