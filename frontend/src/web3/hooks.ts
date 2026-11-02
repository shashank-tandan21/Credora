import { zeroAddress } from 'viem'
import { useConnection, useReadContracts } from 'wagmi'
import { useAuth } from '../contexts/AuthContext'
import { chainSupported, targetChain } from './config'
import { contracts, contractsConfigured, ROLES } from './contracts'

const REFRESH_MS = 12_000
const QUEUE_WINDOW = 25n
const chainId = targetChain.id

/** Where the app stands with respect to on-chain mode, configuration, wallet, and network. */
export function useOnChainStatus() {
  const { networkMode } = useAuth()
  const connection = useConnection()
  const enabled = networkMode === 'onchain'
  const configured = contractsConfigured && chainSupported
  const wrongChain = connection.isConnected && connection.chainId !== targetChain.id
  return {
    enabled,
    configured,
    address: connection.address,
    isConnected: connection.isConnected,
    walletChainId: connection.chainId,
    wrongChain,
    canRead: enabled && configured,
    canTransact: enabled && configured && connection.isConnected && !wrongChain,
  }
}

export function usePoolChainData() {
  const { canRead, address } = useOnChainStatus()
  const account = address ?? zeroAddress
  const query = useReadContracts({
    contracts: [
      { ...contracts.lendingPool, functionName: 'poolSnapshot', chainId },
      { ...contracts.lendingPool, functionName: 'balanceOf', args: [account], chainId },
      { ...contracts.lendingPool, functionName: 'maxWithdraw', args: [account], chainId },
      { ...contracts.mockUsdc, functionName: 'balanceOf', args: [account], chainId },
      { ...contracts.loanManager, functionName: 'nextLoanId', chainId },
    ],
    query: { enabled: canRead, refetchInterval: REFRESH_MS },
  })

  const snapshot = query.data?.[0]?.result
  if (!snapshot) {
    return { loaded: false as const, isLoading: query.isLoading, error: query.error }
  }
  const [assets, idle, borrowed, interestEarned, losses, utilizationBps, totalShares] = snapshot
  const shares = query.data?.[1]?.result ?? 0n
  // Same formula as OpenZeppelin ERC-4626 _convertToAssets with virtual shares.
  const positionValue = (shares * (assets + 1n)) / (totalShares + 1n)
  return {
    loaded: true as const,
    isLoading: query.isLoading,
    error: query.error,
    assets,
    idle,
    borrowed,
    interestEarned,
    losses,
    utilizationBps,
    totalShares,
    shares,
    positionValue,
    maxWithdraw: query.data?.[2]?.result ?? 0n,
    walletBalance: query.data?.[3]?.result ?? 0n,
    loansOriginated: (query.data?.[4]?.result ?? 1n) - 1n,
  }
}

export function useBorrowerChainState() {
  const { canRead, address } = useOnChainStatus()
  const account = address ?? zeroAddress
  const enabled = canRead && address !== undefined

  const base = useReadContracts({
    contracts: [
      { ...contracts.identityRegistry, functionName: 'isRegistered', args: [account], chainId },
      { ...contracts.loanManager, functionName: 'eligibility', args: [account], chainId },
      { ...contracts.loanManager, functionName: 'openLoanOf', args: [account], chainId },
      { ...contracts.mockUsdc, functionName: 'balanceOf', args: [account], chainId },
    ],
    query: { enabled, refetchInterval: REFRESH_MS },
  })
  const loanId = base.data?.[2]?.result ?? 0n

  const loan = useReadContracts({
    contracts: [
      { ...contracts.loanManager, functionName: 'getLoan', args: [loanId], chainId },
      { ...contracts.loanManager, functionName: 'nextPaymentDue', args: [loanId], chainId },
      { ...contracts.loanManager, functionName: 'outstanding', args: [loanId], chainId },
      { ...contracts.loanManager, functionName: 'amountPastDue', args: [loanId], chainId },
      { ...contracts.loanManager, functionName: 'isEligibleForRecovery', args: [loanId], chainId },
      { ...contracts.recoveryManager, functionName: 'openRequestOf', args: [loanId], chainId },
    ],
    query: { enabled: enabled && loanId > 0n, refetchInterval: REFRESH_MS },
  })

  const eligibility = base.data?.[1]?.result
  return {
    loaded: base.data !== undefined,
    isLoading: base.isLoading,
    registered: base.data?.[0]?.result ?? false,
    eligibleLimit: eligibility?.[0] ?? 0n,
    scoreBps: eligibility?.[1] ?? 0,
    assessmentId: eligibility?.[2],
    scoreValid: eligibility?.[3] ?? false,
    walletBalance: base.data?.[3]?.result ?? 0n,
    loanId,
    loan: loanId > 0n ? loan.data?.[0]?.result : undefined,
    nextPayment: loan.data?.[1]?.result,
    outstanding: loan.data?.[2]?.result ?? 0n,
    amountPastDue: loan.data?.[3]?.result ?? 0n,
    recoveryEligible: loan.data?.[4]?.result ?? false,
    openRecoveryRequestId: loan.data?.[5]?.result ?? 0n,
  }
}

export function useOperatorRoles() {
  const { canRead, address } = useOnChainStatus()
  const account = address ?? zeroAddress
  const query = useReadContracts({
    contracts: [
      { ...contracts.creditScoreRegistry, functionName: 'hasRole', args: [ROLES.ATTESTER, account], chainId },
      { ...contracts.loanManager, functionName: 'hasRole', args: [ROLES.FUNDER, account], chainId },
      { ...contracts.disputeManager, functionName: 'hasRole', args: [ROLES.REVIEWER, account], chainId },
      { ...contracts.recoveryManager, functionName: 'hasRole', args: [ROLES.RECOVERY_OFFICER, account], chainId },
    ],
    query: { enabled: canRead && address !== undefined },
  })
  return {
    attester: query.data?.[0]?.result ?? false,
    funder: query.data?.[1]?.result ?? false,
    reviewer: query.data?.[2]?.result ?? false,
    recoveryOfficer: query.data?.[3]?.result ?? false,
  }
}

function recentIds(nextId: bigint | undefined): bigint[] {
  if (!nextId || nextId <= 1n) return []
  const ids: bigint[] = []
  for (let id = nextId - 1n; id >= 1n && id >= nextId - QUEUE_WINDOW; id--) ids.push(id)
  return ids
}

/** The most recent on-chain disputes, newest first. */
export function useDisputeQueue() {
  const { canRead } = useOnChainStatus()
  const counter = useReadContracts({
    contracts: [{ ...contracts.disputeManager, functionName: 'nextDisputeId', chainId }],
    query: { enabled: canRead, refetchInterval: REFRESH_MS },
  })
  const ids = recentIds(counter.data?.[0]?.result)
  const disputes = useReadContracts({
    contracts: ids.map((id) => ({ ...contracts.disputeManager, functionName: 'getDispute' as const, args: [id] as const, chainId })),
    query: { enabled: canRead && ids.length > 0, refetchInterval: REFRESH_MS },
  })
  return ids.flatMap((id, index) => {
    const dispute = disputes.data?.[index]?.result
    return dispute ? [{ id, ...dispute }] : []
  })
}

/** The most recent on-chain recovery requests, newest first. */
export function useRecoveryQueue() {
  const { canRead } = useOnChainStatus()
  const counter = useReadContracts({
    contracts: [{ ...contracts.recoveryManager, functionName: 'nextRequestId', chainId }],
    query: { enabled: canRead, refetchInterval: REFRESH_MS },
  })
  const ids = recentIds(counter.data?.[0]?.result)
  const requests = useReadContracts({
    contracts: ids.map((id) => ({ ...contracts.recoveryManager, functionName: 'getRequest' as const, args: [id] as const, chainId })),
    query: { enabled: canRead && ids.length > 0, refetchInterval: REFRESH_MS },
  })
  return ids.flatMap((id, index) => {
    const request = requests.data?.[index]?.result
    return request ? [{ id, ...request }] : []
  })
}

export function useLoanLookup(loanId: bigint | undefined) {
  const { canRead } = useOnChainStatus()
  const id = loanId ?? 0n
  const query = useReadContracts({
    contracts: [
      { ...contracts.loanManager, functionName: 'getLoan', args: [id], chainId },
      { ...contracts.loanManager, functionName: 'outstanding', args: [id], chainId },
      { ...contracts.loanManager, functionName: 'amountPastDue', args: [id], chainId },
    ],
    query: { enabled: canRead && id > 0n, refetchInterval: REFRESH_MS },
  })
  return {
    loan: query.data?.[0]?.result,
    outstanding: query.data?.[1]?.result ?? 0n,
    amountPastDue: query.data?.[2]?.result ?? 0n,
  }
}
