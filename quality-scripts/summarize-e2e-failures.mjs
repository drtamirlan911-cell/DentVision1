#!/usr/bin/env node
/**
 * Produce a bounded, deduplicated Playwright failure digest.
 *
 * Reads only gate logs passed as argv; never opens screenshots, videos, HTML
 * reports, or traces. Retries of the same test are collapsed into one item.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const files = [...new Set(args)]
  .filter((file) => file && fs.existsSync(file) && fs.statSync(file).isFile())
  .filter((file) => !/trace\.zip|\.png$|\.webm$|\.html$/i.test(file));

const MAX_FAILURES = 24;
const MAX_CONTEXT_LINES = 5;
const MAX_OUTPUT_CHARS = 18000;

function clean(line) {
  return String(line ?? '')
    .replace(/^\d{4}-\d\d-\d\dT[^ ]+Z\s+/, '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trimEnd();
}

function categoryFor(text) {
  const value = text.toLowerCase();
  if (/403|forbidden|not authorized|permission|tenant|organization scope|branch scope/.test(value)) return 'AUTH/SCOPE';
  if (/timeout|timed out|waitfor|not visible|tobevisible|element\(s\) not found|locator/.test(value)) return 'UI/WAIT';
  if (/p2002|unique constraint|duplicate key|foreign key|deadlock|database|prisma/.test(value)) return 'TEST DATA/DB';
  if (/expected:|received:|toequal|tobe\(|tocontain|tohave/.test(value)) return 'ASSERTION';
  if (/econnrefused|econnreset|socket hang up|502|503|service unavailable|failed to fetch/.test(value)) return 'INFRA/NETWORK';
  if (/console error|pageerror|uncaught|unhandled/.test(value)) return 'BROWSER RUNTIME';
  return 'OTHER';
}

function normalizeKey(value) {
  return value
    .replace(/\b\d{10,}\b/g, '<id>')
    .replace(/\b\d{2,5}ms\b/g, '<duration>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

const failures = new Map();
const summaries = [];
let totalLines = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).map(clean);
  totalLines += lines.length;
  let currentTest = '';
  let currentGate = file.replace(/^e2e-gate-logs\//, '').replace(/\.log$/, '');
  let currentError = '';
  let context = [];

  const flush = () => {
    if (!currentError) return;
    const key = [currentGate, normalizeKey(currentTest), normalizeKey(currentError)].join('|');
    const existing = failures.get(key);
    const evidence = context.filter(Boolean).slice(0, MAX_CONTEXT_LINES);
    if (existing) {
      existing.occurrences += 1;
      if (existing.context.length < 2) existing.context.push(...evidence);
    } else {
      failures.set(key, {
        gate: currentGate,
        test: currentTest || '(test name not found in log)',
        error: currentError,
        category: categoryFor(currentError + ' ' + evidence.join(' ')),
        occurrences: 1,
        context: evidence,
      });
    }
    currentError = '';
    context = [];
  };

  for (const line of lines) {
    const gateMarker = line.match(/^E2E_GATE_RESULT name=([^ ]+)/);
    if (gateMarker) currentGate = gateMarker[1];

    const testMarker = line.match(/^\s*\d+\)\s+\[([^\]]+)\]\s+›\s+(.+)$/);
    if (testMarker) {
      flush();
      currentTest = '[' + testMarker[1] + '] ' + testMarker[2].trim();
      continue;
    }

    const summaryMarker = line.match(/^\s*(\d+)\s+(failed|passed|skipped|flaky)(?:\s|$)/i);
    if (summaryMarker) summaries.push({ file, result: line.trim() });

    const errorMarker = line.match(/^\s*(?:(?:Error|TimeoutError|TypeError|AssertionError|APIRequestContext\.\w+Error|page\.goto):)\s*(.*)$/);
    const playwrightError = line.match(/^\s*(?:Error|TimeoutError|TypeError|AssertionError):\s*(.*)$/);
    if (playwrightError || errorMarker) {
      flush();
      currentError = (playwrightError || errorMarker)[1] || line.trim();
      context = [];
      continue;
    }

    if (currentError && context.length < MAX_CONTEXT_LINES && line.trim()) {
      if (/^(?:Locator:|Expected:|Received:|Timeout:|Error:|Call log:|at .*\.(?:ts|tsx|js):\d+|>\s*\d+\s*\|)/.test(line.trim())) {
        context.push(line.trim().slice(0, 280));
      }
    }
    if (/^\s*Retry #\d+/.test(line)) flush();
  }
  flush();
}

const ordered = [...failures.values()].sort((a, b) =>
  b.occurrences - a.occurrences || a.gate.localeCompare(b.gate) || a.test.localeCompare(b.test)
);

const output = [];
output.push('# Compact E2E failure digest');
output.push('');
output.push(`Input logs: ${files.length}; input lines scanned: ${totalLines}; unique failure signatures: ${failures.size}.`);
output.push('Retries with the same gate/test/error signature are grouped. No traces, videos, screenshots, DOM dumps, or HTML reports were read.');
output.push('');
if (summaries.length) {
  output.push('## Playwright result lines');
  for (const item of summaries.slice(-16)) output.push(`- ${item.file}: ${item.result}`);
  output.push('');
}
if (!ordered.length) {
  output.push('No Playwright failure blocks were recognized in the supplied logs. Check the gate timing/log pointers; do not interpret this as a passing E2E run.');
} else {
  output.push(`## Unique failures (showing at most ${Math.min(MAX_FAILURES, ordered.length)})`);
  output.push('');
  for (const [index, item] of ordered.slice(0, MAX_FAILURES).entries()) {
    output.push(`${index + 1}. **[${item.category}] ${item.gate}** — ${item.test}`);
    output.push(`   - Occurrences (including retries): ${item.occurrences}`);
    output.push(`   - Root error: ${item.error.slice(0, 400)}`);
    for (const line of item.context.slice(0, MAX_CONTEXT_LINES)) output.push(`   - ${line}`);
    output.push('');
  }
  if (ordered.length > MAX_FAILURES) output.push(`Omitted ${ordered.length - MAX_FAILURES} additional unique failures; full gate logs remain available as failure-only artifacts.`);
}
let result = output.join('\n');
if (result.length > MAX_OUTPUT_CHARS) {
  result = result.slice(0, MAX_OUTPUT_CHARS - 100) + '\n\n[Digest truncated at the configured output bound.]\n';
}
process.stdout.write(result + '\n');
