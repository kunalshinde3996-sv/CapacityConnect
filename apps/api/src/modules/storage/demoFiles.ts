import { copyFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storage } from './storage.service.js';

// Sample files (certificates, slides, videos) committed in apps/api/demo-files and
// referenced by the seed as "demo/<file name>".
export const DEMO_FILES_DIR = fileURLToPath(new URL('../../../demo-files/', import.meta.url));
export const demoKey = (fileName: string) => `demo/${fileName}`;

// Copies any missing demo file into storage. Runs at API startup because the free
// hosting disk is wiped on every restart (see README "Deployment"): the seeded demo
// library then keeps working. Files that users upload are not restored.
export async function restoreDemoFiles() {
  let names: string[];
  try {
    names = await readdir(DEMO_FILES_DIR);
  } catch {
    return 0; // no demo files shipped (e.g. a trimmed deployment)
  }

  let restored = 0;
  for (const name of names) {
    const key = demoKey(name);
    if (await storage.exists(key)) continue;
    // save() moves its input, so hand it a temporary copy, never the original.
    const temp = path.join(os.tmpdir(), `cc-demo-${process.pid}-${name}`);
    await copyFile(path.join(DEMO_FILES_DIR, name), temp);
    await storage.save(temp, key);
    restored += 1;
  }
  return restored;
}
