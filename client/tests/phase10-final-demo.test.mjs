import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const suites = ['phase6-signal.test.mjs', 'phase7-websocket-signal.test.mjs', 'phase8-receipts.test.mjs', 'phase10-security.test.mjs'];
const results = [];

for (const suite of suites) {
  const output = execFileSync(process.execPath, [path.join(directory, suite)], { encoding: 'utf8' });
  const passed = output.includes('"passed": true');
  results.push({ suite, passed });
}

const allPassed = results.every(({ passed }) => passed);
console.log(JSON.stringify({ phase: 10, demo: 'Alice/Bob encrypted messaging, receipts, ordering, replay, and offline delivery', results, passed: allPassed }, null, 2));
if (!allPassed) process.exitCode = 1;
