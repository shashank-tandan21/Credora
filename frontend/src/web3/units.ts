import { formatUnits, type Hex, keccak256, pad, parseUnits, toBytes } from 'viem'

export const USDC_DECIMALS = 6
const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/** Parse a user-entered MockUSDC amount into smallest units. Never goes through floats. */
export function toUsdcUnits(value: string): bigint | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null
  const units = parseUnits(trimmed, USDC_DECIMALS)
  return units > 0n ? units : null
}

/** Display-only conversion; settlement math stays in bigint units. */
export function fromUsdcUnits(value: bigint | undefined): number {
  return value === undefined ? 0 : Number(formatUnits(value, USDC_DECIMALS))
}

export function formatUsdcExact(value: bigint | undefined): string {
  return value === undefined ? '—' : `${formatUnits(value, USDC_DECIMALS)} mUSDC`
}

/** Matches contracts/scripts/lib/protocol.ts uuidToBytes32: the 16 UUID bytes, left-padded. */
export function uuidToBytes32(uuid: string): Hex {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`Not a UUID: ${uuid}`)
  }
  return pad(`0x${uuid.replace(/-/g, '').toLowerCase()}`, { size: 32 })
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

/** keccak256 of UTF-8 text, used for profile, reason, and resolution-note hashes. */
export function hashText(text: string): Hex {
  return keccak256(toBytes(text))
}

/** Backend score (0-100, two decimals) to on-chain basis points. */
export function scoreToBps(score: number): number {
  return Math.round(score * 100)
}

export function formatTimestamp(seconds: bigint | number | undefined): string {
  if (seconds === undefined || seconds === 0n || seconds === 0) return '—'
  return new Date(Number(seconds) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
