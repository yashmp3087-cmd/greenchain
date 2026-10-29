import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT_PATTERN = /^0x[0-9a-f]{64}$/;

export class DatasetStore {
  constructor(dir) {
    this.dir = path.join(dir, 'datasets');
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  #file(root) {
    if (!ROOT_PATTERN.test(root)) throw new Error('invalid root'); // also blocks path traversal
    return path.join(this.dir, `${root}.json`);
  }

  async get(root) {
    try {
      return JSON.parse(await fs.readFile(this.#file(root), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  /** Atomic create-if-absent. Returns false when the root already exists. */
  async create(root, record) {
    const target = this.#file(root);
    const tmp = `${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record), { mode: 0o600 });
    try {
      await fs.link(tmp, target); // fails with EEXIST instead of overwriting
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') return false;
      throw e;
    } finally {
      await fs.rm(tmp, { force: true });
    }
  }
}
