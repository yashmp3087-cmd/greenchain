import { config } from './config.js';
import { DatasetStore } from './storage.js';
import { createApp } from './app.js';

const store = new DatasetStore(config.dataDir);
await store.init();

const app = createApp({ config, store });
app.listen(config.port, () => {
  console.log(`CarbonLedger API listening on :${config.port}`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
});
