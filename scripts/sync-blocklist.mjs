// scripts/sync-blocklist.mjs — bundles src/moderation into the n8n Code node.
//
// Why: the board-name check is only effective server-side, because the name arrives as a query
// parameter on a static payment link. But a second, hand-maintained copy of a 900-line blocklist
// inside a JSON file would drift within a week. So the workflow's copy is GENERATED from the
// TypeScript source and marked with fences; this script rewrites it, and a test fails if the
// workflow is out of date.
//
// Usage: node scripts/sync-blocklist.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

// Bundled with vite's own JS API rather than a new dependency: the constitution keeps the
// devDependency list short on purpose, and vite is already the build tool.

const WORKFLOW = 'n8n/okrich-payments.json';
const BEGIN = '// ===== BEGIN GENERATED MODERATION (scripts/sync-blocklist.mjs) =====';
const END = '// ===== END GENERATED MODERATION =====';

const [output] = await build({
  logLevel: 'silent',
  configFile: false,
  build: {
    write: false,
    lib: {
      entry: 'src/moderation/index.ts',
      formats: ['iife'],
      name: '__moderation',
      fileName: () => 'moderation.js',
    },
    minify: false,
    target: 'es2022',
  },
});
const chunk = output.output.find((o) => o.type === 'chunk');
const bundled = chunk.code.trim();
const block = [
  BEGIN,
  '// Generated from src/moderation/*.ts — do not edit here, edit there and re-run the script.',
  bundled,
  'const isBlockedName = __moderation.isBlockedName;',
  'const looksLikeAd = __moderation.looksLikeAd;',
  END,
].join('\n');

const workflow = JSON.parse(readFileSync(WORKFLOW, 'utf8'));
const node = workflow.nodes.find((n) => n.name === 'Verify, dedupe, count');
if (!node) throw new Error('code node not found');

const code = node.parameters.jsCode;
const hasFences = code.includes(BEGIN) && code.includes(END);
const next = hasFences
  ? code.slice(0, code.indexOf(BEGIN)) + block + code.slice(code.indexOf(END) + END.length)
  : block + '\n\n' + code;

if (process.argv.includes('--check')) {
  if (next !== code) {
    console.error('n8n workflow is out of date. Run: node scripts/sync-blocklist.mjs');
    process.exit(1);
  }
  console.log('workflow moderation block is current');
  process.exit(0);
}

node.parameters.jsCode = next;
writeFileSync(WORKFLOW, JSON.stringify(workflow, null, 2) + '\n');
console.log(`moderation bundled into ${WORKFLOW} (${(block.length / 1024).toFixed(1)} KB)`);
