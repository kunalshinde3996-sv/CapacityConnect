import { createApp } from './app.js';
import { env } from './config/env.js';
import { restoreDemoFiles } from './modules/storage/demoFiles.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Not awaited before listening: the API is usable while the copy finishes.
  restoreDemoFiles()
    .then((n) => n > 0 && console.log(`Restored ${n} demo file(s) into storage`))
    .catch((err) => console.error('Could not restore demo files', err));
});
