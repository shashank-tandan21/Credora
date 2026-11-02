import { describe, expect, it } from 'vitest'
import { formatUsdcExact, fromUsdcUnits, hashText, isUuid, scoreToBps, toUsdcUnits, uuidToBytes32 } from './units'

describe('units', () => {
  it('parses MockUSDC amounts into 6-decimal units without floating point', () => {
    expect(toUsdcUnits('500')).toBe(500_000_000n)
    expect(toUsdcUnits('14.794520')).toBe(14_794_520n)
    expect(toUsdcUnits(' 0.000001 ')).toBe(1n)
  })

  it('rejects malformed, zero, negative, and over-precise amounts', () => {
    for (const value of ['', 'abc', '-1', '0', '0.000000', '1.0000001', '1e3', '1,000']) {
      expect(toUsdcUnits(value)).toBeNull()
    }
  })

  it('formats exact on-chain amounts', () => {
    expect(formatUsdcExact(514_794_520n)).toBe('514.79452 mUSDC')
    expect(formatUsdcExact(undefined)).toBe('—')
    expect(fromUsdcUnits(1_065_000_000n)).toBe(1065)
  })

  it('encodes backend UUIDs exactly like contracts/scripts/lib/protocol.ts', () => {
    expect(uuidToBytes32('7f1c9a52-3d4e-4b6a-9c1d-2e3f4a5b6c7d')).toBe(
      '0x000000000000000000000000000000007f1c9a523d4e4b6a9c1d2e3f4a5b6c7d',
    )
    expect(isUuid('7F1C9A52-3D4E-4B6A-9C1D-2E3F4A5B6C7D')).toBe(true)
    expect(isUuid('ca-01')).toBe(false)
    expect(() => uuidToBytes32('ca-01')).toThrow('Not a UUID')
  })

  it('hashes notes with keccak256', () => {
    expect(hashText('')).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
  })

  it('converts backend scores to basis points', () => {
    expect(scoreToBps(71)).toBe(7100)
    expect(scoreToBps(86.85)).toBe(8685)
    expect(scoreToBps(100)).toBe(10_000)
  })
})
