import { createApp } from './app.js';
import { env } from './config/env.js';
import { deadlineSweep } from './modules/notifications/notifications.service.js';
import { restoreDemoFiles } from './modules/storage/demoFiles.js';

const app = createApp();
const SWEEP_EVERY_MS = 10 * 60 * 1000;

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Not awaited before listening: the API is usable while the copy finishes.
  restoreDemoFiles()
    .then((n) => n > 0 && console.log(`Restored ${n} demo file(s) into storage`))
    .catch((err) => console.error('Could not restore demo files', err));

  // "Deadline within 24 hours" reminders. The free host sleeps when idle, so reminders are
  // also created when a trainee opens their notifications (see notifications.service.ts).
  const sweep = () => deadlineSweep().catch((err) => console.error('Deadline sweep failed', err));
  sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
});
