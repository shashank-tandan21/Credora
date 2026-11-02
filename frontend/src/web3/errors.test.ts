import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { describe, expect, it } from 'vitest'
import { describeTransactionError, TransactionFlowError } from './errors'
import { lendingPoolAbi, loanManagerAbi } from './generated/abis'

const HASH = `0x${'ab'.repeat(32)}` as const
const WALLET = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'

describe('describeTransactionError', () => {
  it('classifies a wallet rejection, even when wrapped', () => {
    const rejection = new UserRejectedRequestError(new Error('User denied transaction signature.'))
    expect(describeTransactionError(rejection).kind).toBe('rejected')
    expect(describeTransactionError(new BaseError('Request failed', { cause: rejection })).kind).toBe('rejected')
  })

  it('treats a raw EIP-1193 4001 error as a rejection', () => {
    expect(describeTransactionError({ code: 4001, message: 'User rejected' }).kind).toBe('rejected')
  })

  it('decodes protocol custom errors into readable messages', () => {
    const data = encodeErrorResult({ abi: loanManagerAbi, errorName: 'NoValidCreditScore', args: [WALLET] })
    const reverted = new ContractFunctionRevertedError({ abi: loanManagerAbi, data, functionName: 'requestLoan' })
    const described = describeTransactionError(new BaseError('Execution reverted', { cause: reverted }))
    expect(described.kind).toBe('reverted')
    expect(described.message).toContain('No valid on-chain score attestation')
  })

  it('names unknown custom errors instead of hiding them', () => {
    const data = encodeErrorResult({ abi: lendingPoolAbi, errorName: 'RecoveryExceedsSurplus', args: [2n, 1n] })
    const reverted = new ContractFunctionRevertedError({ abi: lendingPoolAbi, data, functionName: 'recoverTokens' })
    expect(describeTransactionError(reverted).message).toContain('RecoveryExceedsSurplus')
  })

  it('classifies receipt timeouts', () => {
    expect(describeTransactionError(new WaitForTransactionReceiptTimeoutError({ hash: HASH })).kind).toBe('timeout')
  })

  it('preserves the kind and hash of lifecycle errors', () => {
    const error = new TransactionFlowError('replaced', 'The transaction was cancelled in the wallet.', HASH)
    expect(describeTransactionError(error)).toEqual({
      kind: 'replaced',
      message: 'The transaction was cancelled in the wallet.',
      hash: HASH,
    })
  })

  it('detects a connector chain mismatch', () => {
    const mismatch = new Error('Chain mismatch')
    mismatch.name = 'ConnectorChainMismatchError'
    expect(describeTransactionError(mismatch).kind).toBe('wrong_chain')
  })

  it('falls back to a generic failure', () => {
    expect(describeTransactionError(new Error('boom'))).toEqual({ kind: 'error', message: 'boom' })
    expect(describeTransactionError('weird').kind).toBe('error')
  })
})
