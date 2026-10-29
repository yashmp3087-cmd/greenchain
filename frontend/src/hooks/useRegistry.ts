import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import type { Address } from 'viem'
import { registryAbi } from '../lib/abi'
import {
  ADMIN_ROLE,
  REGISTRY_ADDRESS,
  VERIFIER_ROLE,
  isRegistryConfigured,
  type Project,
  type ProjectWithId,
} from '../lib/registry'
import { MST_CHAIN_ID } from '../config/chain'
import { errorMessage } from '../lib/format'

const POLL = 15_000
const MAX_LISTED = 50

export function useProjects() {
  const count = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'projectCount',
    chainId: MST_CHAIN_ID,
    query: { enabled: isRegistryConfigured, refetchInterval: POLL },
  })
  const total = Number(count.data ?? 0n)
  const ids = Array.from({ length: Math.min(total, MAX_LISTED) }, (_, i) => total - i) // newest first

  const list = useReadContracts({
    contracts: ids.map((id) => ({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'getProject',
      args: [BigInt(id)],
      chainId: MST_CHAIN_ID,
    })),
    query: { enabled: isRegistryConfigured && ids.length > 0, refetchInterval: POLL },
  })

  const projects: ProjectWithId[] = []
  ids.forEach((id, i) => {
    const r = list.data?.[i]
    if (r && r.status === 'success') projects.push({ ...(r.result as unknown as Project), id: BigInt(id) })
  })

  return {
    projects,
    total,
    isLoading: count.isLoading || (ids.length > 0 && list.isLoading),
    error: count.error ?? list.error,
  }
}

export function useRoles(account?: Address) {
  const res = useReadContracts({
    contracts: [
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: 'hasRole', args: [VERIFIER_ROLE, account as Address], chainId: MST_CHAIN_ID },
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: 'hasRole', args: [ADMIN_ROLE, account as Address], chainId: MST_CHAIN_ID },
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: 'paused', chainId: MST_CHAIN_ID },
      { address: REGISTRY_ADDRESS, abi: registryAbi, functionName: 'creditsPerTree', chainId: MST_CHAIN_ID },
    ],
    query: { enabled: isRegistryConfigured && !!account, refetchInterval: POLL },
  })
  const val = (i: number) => (res.data?.[i]?.status === 'success' ? res.data[i].result : undefined)
  return {
    isVerifier: val(0) === true,
    isAdmin: val(1) === true,
    paused: val(2) === true,
    creditsPerTree: val(3) as bigint | undefined,
  }
}

export function useBalance1155(account: Address | undefined, id: bigint) {
  return useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'balanceOf',
    args: [account as Address, id],
    chainId: MST_CHAIN_ID,
    query: { enabled: isRegistryConfigured && !!account, refetchInterval: POLL },
  })
}

export function useCreditValid(id: bigint) {
  return useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'isCreditValid',
    args: [id],
    chainId: MST_CHAIN_ID,
    query: { enabled: isRegistryConfigured, refetchInterval: POLL },
  })
}

/** One transaction: wallet signature → on-chain confirmation → cache refresh. */
export function useTx() {
  const w = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash: w.data, chainId: MST_CHAIN_ID })
  const qc = useQueryClient()

  useEffect(() => {
    if (receipt.isSuccess) qc.invalidateQueries()
  }, [receipt.isSuccess, qc])

  const reverted = receipt.isSuccess && receipt.data?.status === 'reverted'
  const state: 'idle' | 'signing' | 'confirming' | 'success' | 'error' = w.isPending
    ? 'signing'
    : w.data && receipt.isLoading
      ? 'confirming'
      : reverted || w.isError || receipt.isError
        ? 'error'
        : receipt.isSuccess
          ? 'success'
          : 'idle'

  return {
    write: w.writeContract,
    writeAsync: w.writeContractAsync,
    hash: w.data,
    state,
    busy: state === 'signing' || state === 'confirming',
    error: reverted ? 'The transaction was reverted on-chain.' : errorMessage(w.error ?? receipt.error),
    reset: w.reset,
  }
}
