import { z } from 'zod';
import { keccak256, toBytes, isAddress, getAddress } from 'viem';
import merkle from '@openzeppelin/merkle-tree';

const { StandardMerkleTree } = merkle;

/**
 * Leaf layout. The submitter address is part of every leaf, so the Merkle root committed on-chain
 * is bound to the wallet that planted the trees: nobody else can reuse the dataset under their own address.
 */
export const LEAF_TYPES = ['address', 'string', 'string', 'int256', 'int256', 'uint256'];
export const MAX_TREES = 5000; // keep in sync with MAX_TREES_PER_PROJECT in the contract
const MIN_PLANTED_AT = 946684800; // 2000-01-01

export class DatasetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const addressSchema = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), 'Invalid address')
  .transform((v) => getAddress(v.toLowerCase()));

const treeSchema = z
  .object({
    treeId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'treeId may only contain letters, digits, - and _ (max 64)'),
    species: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[\p{L}0-9 .'()-]+$/u, 'species contains unsupported characters'),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    plantedAt: z.number().int().min(MIN_PLANTED_AT),
  })
  .strict();

export const datasetInputSchema = z
  .object({
    submitter: addressSchema,
    trees: z.array(treeSchema).min(1).max(MAX_TREES),
  })
  .strict();

/** Fixed-point micro-degrees (1e-6° ≈ 11 cm) so coordinates hash identically everywhere. */
export function normalizeTrees(trees, nowSec = Math.floor(Date.now() / 1000)) {
  const ids = new Set();
  const positions = new Set();
  return trees.map((t) => {
    if (t.plantedAt > nowSec + 86400) throw new DatasetError(`Tree ${t.treeId}: plantedAt is in the future`);
    const latE6 = Math.round(t.lat * 1e6);
    const lonE6 = Math.round(t.lon * 1e6);
    const posKey = `${latE6},${lonE6}`;
    if (ids.has(t.treeId)) throw new DatasetError(`Duplicate treeId: ${t.treeId}`);
    if (positions.has(posKey)) throw new DatasetError(`Tree ${t.treeId}: another tree already has these coordinates`);
    ids.add(t.treeId);
    positions.add(posKey);
    return { treeId: t.treeId, species: t.species, latE6, lonE6, plantedAt: t.plantedAt };
  });
}

export function toLeafValues(submitter, trees) {
  return trees.map((t) => [submitter, t.treeId, t.species, BigInt(t.latE6), BigInt(t.lonE6), BigInt(t.plantedAt)]);
}

export function buildTree(submitter, trees) {
  return StandardMerkleTree.of(toLeafValues(submitter, trees), LEAF_TYPES);
}

/** Hash of the canonical evidence document. Stored on-chain as `evidenceHash`. */
export function hashDataset(submitter, trees) {
  return keccak256(toBytes(JSON.stringify({ submitter, trees })));
}

/** Parse + validate + normalize + commit. Pure function: no I/O. */
export function processDataset(input, nowSec) {
  const parsed = datasetInputSchema.parse(input);
  const trees = normalizeTrees(parsed.trees, nowSec);
  const tree = buildTree(parsed.submitter, trees);
  return {
    submitter: parsed.submitter,
    trees,
    tree,
    root: tree.root,
    dataHash: hashDataset(parsed.submitter, trees),
  };
}

export function uploadMessage({ submitter, root, dataHash, issuedAt }) {
  return [
    'CarbonLedger dataset upload',
    `Submitter: ${submitter}`,
    `Root: ${root}`,
    `DataHash: ${dataHash}`,
    `IssuedAt: ${issuedAt}`,
  ].join('\n');
}
