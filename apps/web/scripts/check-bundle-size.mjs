// Fails when the JS loaded on first visit (entry + modulepreloads) exceeds the budget.
// SA mobile data is expensive; see CLAUDE.md. Lazy-loaded chunks don't count.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 150;
const dist = join(import.meta.dirname, '../dist/client');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const files = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((m) => m[1]);

let total = 0;
for (const file of new Set(files)) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}

const totalKb = total / 1024;
console.log(
  `${totalKb.toFixed(1).padStart(7)} KB  total initial JS (gzip), budget ${BUDGET_KB} KB`,
);
if (totalKb > BUDGET_KB) {
  console.error(`Initial JS is over budget by ${(totalKb - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
