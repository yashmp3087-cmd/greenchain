import { isAddress, keccak256, toBytes, zeroAddress, zeroHash, type Address, type ContractFunctionReturnType } from 'viem'
import deployment from '../generated/deployment.json'
import { registryAbi } from './abi'

const fromEnv = import.meta.env.VITE_REGISTRY_ADDRESS?.trim()
const candidate = fromEnv || deployment.address

export const REGISTRY_ADDRESS = candidate as Address
export const isRegistryConfigured = isAddress(candidate) && candidate.toLowerCase() !== zeroAddress

export const VERIFIER_ROLE = keccak256(toBytes('VERIFIER_ROLE'))
export const ADMIN_ROLE = zeroHash // DEFAULT_ADMIN_ROLE

export type Project = ContractFunctionReturnType<typeof registryAbi, 'view', 'getProject'>
export type ProjectWithId = Project & { id: bigint }

export const STATUS = { None: 0, Pending: 1, Verified: 2, Rejected: 3, Revoked: 4 } as const
export const STATUS_LABEL = ['Unknown', 'Pending review', 'Verified', 'Rejected', 'Revoked']
