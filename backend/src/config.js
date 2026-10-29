import 'dotenv/config';
import path from 'node:path';

function origins() {
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 8787),
  allowedOrigins: origins(),
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  trustProxy: process.env.TRUST_PROXY === '1',
  signatureMaxAgeSec: 300,
};
