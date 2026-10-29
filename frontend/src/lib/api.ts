const API = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

export interface TreeInput {
  treeId: string
  species: string
  lat: number
  lon: number
  plantedAt: number
}
export interface StoredTree {
  treeId: string
  species: string
  latE6: number
  lonE6: number
  plantedAt: number
}
export interface PrepareResult {
  root: `0x${string}`
  dataHash: `0x${string}`
  treeCount: number
  issuedAt: number
  message: string
}
export interface Dataset {
  root: `0x${string}`
  submitter: `0x${string}`
  dataHash: `0x${string}`
  treeCount: number
  trees: StoredTree[]
}
export interface ProofResult {
  treeId: string
  leaf: `0x${string}`
  proof: `0x${string}`[]
  tree: StoredTree
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json' } })
  } catch {
    throw new Error('Cannot reach the CarbonLedger API. Is the backend running?')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body as T
}

export const api = {
  baseUrl: API,
  prepare: (submitter: string, trees: TreeInput[]) =>
    request<PrepareResult>('/api/datasets/prepare', { method: 'POST', body: JSON.stringify({ submitter, trees }) }),
  upload: (submitter: string, trees: TreeInput[], issuedAt: number, signature: string) =>
    request<{ root: string }>('/api/datasets', {
      method: 'POST',
      body: JSON.stringify({ submitter, trees, issuedAt, signature }),
    }),
  dataset: (root: string) => request<Dataset>(`/api/datasets/${root}`),
  proof: (root: string, treeId: string) => request<ProofResult>(`/api/datasets/${root}/proof/${encodeURIComponent(treeId)}`),
  /** The dataset URL stored on-chain. The app only ever fetches from its own API base, never from on-chain URIs. */
  datasetUrl: (root: string) => `${API}/api/datasets/${root}`,
}
