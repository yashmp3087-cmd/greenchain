import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/app.js';
import { DatasetStore } from '../src/storage.js';
import { uploadMessage } from '../src/dataset.js';

const NOW = 1_800_000_000;
const account = privateKeyToAccount('0x' + '11'.repeat(32));
let server, base, dir;

const trees = [
  { treeId: 'T-1', species: 'Teak', lat: 18.52, lon: 73.85, plantedAt: 1_700_000_000 },
  { treeId: 'T-2', species: 'Neem', lat: 18.5201, lon: 73.8501, plantedAt: 1_700_000_100 },
];

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-'));
  const store = new DatasetStore(dir);
  await store.init();
  const config = { allowedOrigins: ['http://localhost:5173'], signatureMaxAgeSec: 300, trustProxy: false };
  const app = createApp({ config, store, now: () => NOW });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(dir, { recursive: true, force: true });
});

const post = (url, body) =>
  fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function prepare(submitter = account.address, t = trees) {
  const res = await post('/api/datasets/prepare', { submitter, trees: t });
  return { res, body: await res.json() };
}

test('prepare returns a deterministic root bound to the submitter', async () => {
  const a = await prepare();
  const b = await prepare();
  assert.equal(a.res.status, 200);
  assert.equal(a.body.root, b.body.root);
  assert.equal(a.body.treeCount, 2);
  const other = await prepare('0x' + '22'.repeat(20));
  assert.notEqual(other.body.root, a.body.root);
});

test('rejects duplicate ids, duplicate coordinates and bad input', async () => {
  const dupId = await prepare(account.address, [trees[0], { ...trees[1], treeId: 'T-1' }]);
  assert.equal(dupId.res.status, 400);
  const dupPos = await prepare(account.address, [trees[0], { ...trees[1], lat: trees[0].lat, lon: trees[0].lon }]);
  assert.equal(dupPos.res.status, 400);
  const bad = await prepare(account.address, [{ ...trees[0], lat: 120 }]);
  assert.equal(bad.res.status, 400);
  const future = await prepare(account.address, [{ ...trees[0], plantedAt: NOW + 10 * 86400 }]);
  assert.equal(future.res.status, 400);
  const extra = await prepare(account.address, [{ ...trees[0], admin: true }]);
  assert.equal(extra.res.status, 400);
  const empty = await prepare(account.address, []);
  assert.equal(empty.res.status, 400);
});

test('stores a dataset only with a valid signature from the submitter', async () => {
  const { body } = await prepare();
  const signature = await account.signMessage({ message: body.message });

  const forged = await post('/api/datasets', {
    submitter: account.address,
    trees,
    issuedAt: body.issuedAt,
    signature: await privateKeyToAccount('0x' + '22'.repeat(32)).signMessage({ message: body.message }),
  });
  assert.equal(forged.status, 401);

  const stale = await post('/api/datasets', {
    submitter: account.address,
    trees,
    issuedAt: NOW - 1000,
    signature: await account.signMessage({
      message: uploadMessage({ submitter: account.address, root: body.root, dataHash: body.dataHash, issuedAt: NOW - 1000 }),
    }),
  });
  assert.equal(stale.status, 401);

  const ok = await post('/api/datasets', { submitter: account.address, trees, issuedAt: body.issuedAt, signature });
  assert.equal(ok.status, 201);
  const again = await post('/api/datasets', { submitter: account.address, trees, issuedAt: body.issuedAt, signature });
  assert.equal(again.status, 200);
});

test('serves the dataset and a Merkle proof', async () => {
  const { body } = await prepare();
  const ds = await (await fetch(`${base}/api/datasets/${body.root}`)).json();
  assert.equal(ds.treeCount, 2);
  assert.equal(ds.dataHash, body.dataHash);
  assert.equal(ds.submitter, account.address);

  const proof = await (await fetch(`${base}/api/datasets/${body.root}/proof/T-2`)).json();
  assert.match(proof.leaf, /^0x[0-9a-f]{64}$/);
  assert.equal(proof.proof.length, 1);

  assert.equal((await fetch(`${base}/api/datasets/${body.root}/proof/NOPE`)).status, 404);
});

test('rejects malformed roots (path traversal) and unknown roots', async () => {
  assert.equal((await fetch(`${base}/api/datasets/..%2F..%2Fetc%2Fpasswd`)).status, 400);
  assert.equal((await fetch(`${base}/api/datasets/0x${'ab'.repeat(32)}`)).status, 404);
});
