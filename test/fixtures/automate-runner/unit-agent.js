#!/usr/bin/env node
'use strict';
// Controlled generation transport with real native Vitest or Jest execution.
// It writes the generated tests a real agent would, runs the project's runner or
// the TeA unit red check, and reports counts read from that runner evidence.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const prompt = fs.readFileSync(0, 'utf8');
const read = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  return file === 0 ? prompt : read.call(this, file, ...args);
};
require('./stub-agent');
fs.readFileSync = read;

const [runner, scenario] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, '../../..');
const manifestPath = JSON.parse(prompt.split('\n').find((line) => /^".*generation\.json"$/.test(line)));
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const red = manifest.mode === 'red';
const extension = runner === 'vitest' ? 'ts' : 'js';
const header =
  runner === 'vitest'
    ? "import { describe, it, test, expect } from 'vitest';\nimport { price } from '../src/price';\n"
    : "const { price } = require('../src/price');\n";
const skip = red ? '.skip' : '';
const body = {
  passing: [`describe('price', () => {`, `  it${skip}('AC-1 doubles the amount', () => {`, '    expect(price(2)).toBe(4);', '  });', '});', `test${skip}('AC-2 handles zero', () => {`, '  expect(price(0)).toBe(0);', '});'],
  failing: [`describe('price', () => {`, `  it('AC-1 doubles the amount', () => {`, '    expect(price(2)).toBe(4);', '  });', '});', `test('AC-2 applies the bulk discount', () => {`, '  expect(price(100)).toBe(180);', '});'],
  red: [`describe('price', () => {`, `  it.skip('AC-3 applies the bulk discount', () => {`, '    expect(price(100)).toBe(180);', '  });', '});', `test.skip('AC-4 rejects negative amounts', () => {`, '  expect(() => price(-1)).toThrow();', '});'],
  'wrong-reason': [`test.skip('AC-3 applies the bulk discount', () => {`, "  throw new TypeError('fixture not wired');", '});'],
};
const kind = red ? (scenario === 'red-wrong-reason' ? 'wrong-reason' : 'red') : scenario === 'expand-failed' ? 'failing' : 'passing';
const file = `tests/price.generated.test.${extension}`;
fs.rmSync('tests/api', { recursive: true, force: true });
fs.writeFileSync(file, `${header}${body[kind].join('\n')}\n`);
const generated = [file];
if (scenario === 'expand-unrelated') fs.writeFileSync(`tests/existing.test.${extension}`, `${runner === 'vitest' ? "import { test } from 'vitest';\n" : ''}test('existing', () => {});\n`);

// A runner the agent declares during the run cannot make its evidence acceptable.
if (scenario === 'expand-late-runner') fs.writeFileSync('vitest.config.mjs', "export default { test: { include: ['tests/**/*.test.ts'] } };\n");

const evidence = '_bmad-output/test-artifacts/automate';
const report = path.join(evidence, `${runner}-${scenario}.json`);
const bin = (name) => {
  const pkg = JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
  return path.join('node_modules', name, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]);
};
const native = (cwd, files, output, locations = true) =>
  spawnSync(
    process.execPath,
    runner === 'vitest'
      ? [path.resolve(bin('vitest')), 'run', ...files, '--reporter=json', `--outputFile=${output}`, ...(locations ? ['--includeTaskLocation'] : [])]
      : [path.resolve(bin('jest')), '--json', ...(locations ? ['--testLocationInResults'] : []), `--outputFile=${output}`, '--runTestsByPath', ...files],
    { cwd, encoding: 'utf8', timeout: 60_000, env: { ...process.env, FORCE_COLOR: '0' } },
  );

let run;
if (scenario === 'red-raw-copy') {
  // A raw runner report from a disposable copy names the copy as its project root.
  const copy = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tea-unit-raw-copy-')));
  for (const entry of fs.readdirSync('.'))
    if (!['node_modules', '_bmad-output'].includes(entry)) fs.cpSync(entry, path.join(copy, entry), { recursive: true });
  fs.symlinkSync(path.resolve('node_modules'), path.join(copy, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(copy, file), fs.readFileSync(file, 'utf8').replaceAll('.skip(', '('));
  run = native(copy, [path.join(copy, file)], path.resolve(report));
  fs.rmSync(copy, { recursive: true, force: true });
} else if (red) {
  run = spawnSync(
    process.execPath,
    [path.join(ROOT, 'cli/unit-red-check.js'), '--project-root', '.', '--report', report, ...generated.flatMap((item) => ['--file', item])],
    { encoding: 'utf8', timeout: 120_000 },
  );
} else {
  const selected = scenario === 'expand-unrelated' ? [...generated, `tests/existing.test.${extension}`] : generated;
  run = native('.', selected, path.resolve(report), scenario !== 'expand-no-location');
}
fs.writeFileSync('native-exit.json', JSON.stringify({ status: run.status, stdout: run.stdout, stderr: run.stderr }));

const evidenceReport = JSON.parse(fs.readFileSync(report, 'utf8'));
const count = { executed: 0, passed: 0, failed: 0, skipped: 0, intendedFailures: 0 };
if (evidenceReport.kind === 'tea-unit-red-check')
  for (const item of evidenceReport.files)
    for (const test of item.tests) {
      if (test.status === 'failed') count.failed++;
      else if (test.status === 'passed') count.passed++;
      else count.skipped++;
    }
else {
  count.passed = evidenceReport.numPassedTests;
  count.failed = evidenceReport.numFailedTests;
  count.skipped = evidenceReport.numPendingTests + evidenceReport.numTodoTests;
}
count.executed = count.passed + count.failed;
if (red) count.intendedFailures = count.failed;
if (scenario === 'expand-forged') count.passed = count.executed = count.passed + 1;
const failedRun = count.failed > 0 && !red;
Object.assign(manifest, {
  generatedFiles: generated,
  executionReports: [report],
  counts: { initial: count, final: count },
  executionStatus: red ? 'verified red' : failedRun ? 'failed' : 'passed',
  remainingFailures: failedRun ? ['AC-2 applies the bulk discount: product returns 200 for 100 units'] : [],
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
