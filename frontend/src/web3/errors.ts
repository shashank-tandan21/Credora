import {
  BaseError,
  ContractFunctionRevertedError,
  type Hex,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import type { TransactionFailureKind } from '../types'

export class TransactionFlowError extends Error {
  readonly kind: TransactionFailureKind
  readonly hash?: Hex

  constructor(kind: TransactionFailureKind, message: string, hash?: Hex) {
    super(message)
    this.name = 'TransactionFlowError'
    this.kind = kind
    this.hash = hash
  }
}

const REVERT_MESSAGES: Record<string, string> = {
  AccessControlUnauthorizedAccount: 'Your wallet does not hold the role required for this action.',
  AlreadyRegistered: 'This wallet is already registered in the IdentityRegistry.',
  AttestationExists: 'An attestation with this assessment id already exists.',
  AttestationNotActive: 'That score attestation is not active.',
  DefaultNotReached: 'The default waiting period has not elapsed yet.',
  DisputeAlreadyOpen: 'A dispute is already open for this assessment.',
  DisputeNotOpen: 'That dispute is no longer open.',
  ERC20InsufficientAllowance: 'The mUSDC allowance is too low.',
  ERC20InsufficientBalance: 'Your mUSDC balance is too low.',
  EnforcedPause: 'This contract is paused by an administrator.',
  ExceedsEligibleLimit: 'The amount exceeds your on-chain eligible limit.',
  FaucetCooldownActive: 'The test-token faucet can be used once every 24 hours.',
  FaucetDisabled: 'The test-token faucet is disabled.',
  IdentityIsRevoked: 'This identity was revoked by a registrar.',
  IdentityNotRegistered: 'Register your identity in the IdentityRegistry first.',
  InsufficientLiquidity: 'The pool does not have enough idle liquidity for this action.',
  InvalidDuration: 'Loan duration must be between 30 and 365 days.',
  InvalidExpiry: 'The expiry must be in the future and at most 365 days away.',
  InvalidLoanStatus: 'The loan is not in a state that allows this action.',
  InvalidMilestones: 'The milestone schedule is invalid.',
  LoanNotEligible: 'Only overdue loans can request restructuring.',
  LoanNotOverdue: 'The loan is not overdue.',
  MilestoneNotFunded: 'Repayments do not cover this milestone yet.',
  NoValidCreditScore: 'No valid on-chain score attestation. A reviewer must publish your score first.',
  NotAttestationOwner: 'You can only dispute your own score attestation.',
  OfficerConflict: 'An officer cannot decide on their own recovery request.',
  OpenLoanExists: 'You already have an open loan. Repay or cancel it first.',
  PrincipalOutOfRange: 'The principal is outside the allowed range.',
  ProposalUnderpays: 'The proposal must cover the full outstanding balance.',
  RepaymentExceedsOutstanding: 'The repayment is larger than the outstanding balance.',
  RequestAlreadyOpen: 'A recovery request is already open for this loan.',
  RequestExpired: 'The loan request has expired.',
  ReviewerConflict: 'A reviewer cannot resolve a dispute on their own score.',
  ScoreOutOfRange: 'The score must be between 0 and 100.',
  SelfAttestation: 'An attester cannot attest their own wallet.',
}

export interface DescribedError {
  kind: TransactionFailureKind
  message: string
  hash?: Hex
}

/** Map wallet, RPC, and contract errors to a stable failure kind and readable message. */
export function describeTransactionError(error: unknown): DescribedError {
  if (error instanceof TransactionFlowError) {
    return { kind: error.kind, message: error.message, hash: error.hash }
  }
  if (error instanceof Error && error.name === 'ConnectorChainMismatchError') {
    return { kind: 'wrong_chain', message: 'Your wallet is connected to a different network.' }
  }
  if (error instanceof BaseError) {
    if (error.walk((cause) => cause instanceof UserRejectedRequestError)) {
      return { kind: 'rejected', message: 'You rejected the request in your wallet. Nothing was submitted.' }
    }
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      const message = name ? (REVERT_MESSAGES[name] ?? `The contract rejected the call (${name}).`) : reverted.shortMessage
      return { kind: 'reverted', message }
    }
    if (error.walk((cause) => cause instanceof WaitForTransactionReceiptTimeoutError)) {
      return { kind: 'timeout', message: 'No receipt arrived in time. The transaction may still confirm later.' }
    }
    return { kind: 'error', message: error.shortMessage }
  }
  if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 4001) {
    return { kind: 'rejected', message: 'You rejected the request in your wallet. Nothing was submitted.' }
  }
  return { kind: 'error', message: error instanceof Error ? error.message : 'Unexpected error.' }
}
