import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Test-token display only; settlement uses exact bigint units. */
export function formatTokenAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' mUSDC'
}
export const formatINR = formatTokenAmount
export const formatUSD = formatTokenAmount
export const formatCurrency = formatTokenAmount

export function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '0.0%'
  return `${(rate * 100).toFixed(1)}%`
}

export function formatBasisPoints(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

export function truncateAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return ''
  if (address.length <= chars * 2 + 2) return address
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const d = new Date(dateString)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
