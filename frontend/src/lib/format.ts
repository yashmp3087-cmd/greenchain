import { BaseError } from 'viem'

export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export function formatDate(sec: bigint | number): string {
  const n = Number(sec)
  if (!n) return '—'
  return new Date(n * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatNumber = (n: bigint | number) => Number(n).toLocaleString()

/** Turn wallet/viem/network errors into one readable sentence. */
export function errorMessage(err: unknown): string {
  if (!err) return ''
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => (e as { name?: string }).name === 'UserRejectedRequestError')
    if (rejected) return 'Request cancelled in your wallet.'
    return err.shortMessage || err.message
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}
