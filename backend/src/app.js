import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { verifyMessage } from 'viem';
import { z } from 'zod';
import {
  DatasetError,
  addressSchema,
  buildTree,
  processDataset,
  toLeafValues,
  uploadMessage,
} from './dataset.js';
import { ROOT_PATTERN } from './storage.js';

const hex = (len) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${len}}$`));
const uploadSchema = z.object({ issuedAt: z.number().int(), signature: hex(130) }).passthrough();

// Express 4 does not forward rejected promises to the error handler on its own.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ config, store, now = () => Math.floor(Date.now() / 1000) }) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Non-browser clients (curl, server-to-server) send no Origin header.
        if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new DatasetError('Origin not allowed', 403));
      },
      methods: ['GET', 'POST'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  const general = rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
  const writes = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  app.use(general);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Step 1: validate the trees, compute the commitment and tell the client exactly what to sign.
  app.post('/api/datasets/prepare', writes, (req, res) => {
    const d = processDataset(req.body, now());
    const issuedAt = now();
    res.json({
      root: d.root,
      dataHash: d.dataHash,
      treeCount: d.trees.length,
      issuedAt,
      message: uploadMessage({ submitter: d.submitter, root: d.root, dataHash: d.dataHash, issuedAt }),
    });
  });

  // Step 2: store the dataset once the submitter proves control of their wallet.
  app.post('/api/datasets', writes, wrap(async (req, res) => {
    const { issuedAt, signature } = uploadSchema.parse(req.body);
    const d = processDataset({ submitter: req.body.submitter, trees: req.body.trees }, now());

    if (Math.abs(now() - issuedAt) > config.signatureMaxAgeSec) {
      throw new DatasetError('Signature expired. Please sign again.', 401);
    }
    const message = uploadMessage({ submitter: d.submitter, root: d.root, dataHash: d.dataHash, issuedAt });
    let valid = false;
    try {
      valid = await verifyMessage({ address: d.submitter, message, signature });
    } catch {
      valid = false;
    }
    if (!valid) throw new DatasetError('Signature does not match the submitter address', 401);

    const created = await store.create(d.root, {
      version: 1,
      root: d.root,
      submitter: d.submitter,
      dataHash: d.dataHash,
      issuedAt,
      createdAt: now(),
      signature,
      trees: d.trees,
    });
    // The root commits to the submitter, so an existing record with this root is identical.
    res.status(created ? 201 : 200).json({ root: d.root, dataHash: d.dataHash, treeCount: d.trees.length });
  }));

  function parseRoot(raw) {
    const root = String(raw).toLowerCase();
    if (!ROOT_PATTERN.test(root)) throw new DatasetError('Invalid root', 400);
    return root;
  }

  app.get('/api/datasets/:root', wrap(async (req, res) => {
    const record = await store.get(parseRoot(req.params.root));
    if (!record) throw new DatasetError('Dataset not found', 404);
    res.json({
      root: record.root,
      submitter: record.submitter,
      dataHash: record.dataHash,
      createdAt: record.createdAt,
      treeCount: record.trees.length,
      trees: record.trees,
    });
  }));

  // Merkle proof for one tree, ready to pass to CarbonCreditRegistry.verifyTreeRecord.
  app.get('/api/datasets/:root/proof/:treeId', wrap(async (req, res) => {
    const record = await store.get(parseRoot(req.params.root));
    if (!record) throw new DatasetError('Dataset not found', 404);
    const index = record.trees.findIndex((t) => t.treeId === req.params.treeId);
    if (index === -1) throw new DatasetError('Tree not found in this dataset', 404);

    const submitter = addressSchema.parse(record.submitter);
    const tree = buildTree(submitter, record.trees);
    const values = toLeafValues(submitter, record.trees);
    res.json({
      treeId: req.params.treeId,
      index,
      leaf: tree.leafHash(values[index]),
      proof: tree.getProof(index),
      tree: record.trees[index],
    });
  }));

  app.use((_req, _res, next) => next(new DatasetError('Not found', 404)));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return res.status(400).json({ error: `${where}${issue.message}` });
    }
    if (err instanceof DatasetError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err); // never leak internals to the client
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
