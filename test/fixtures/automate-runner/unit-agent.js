#!/usr/bin/env node
'use strict';
// Controlled generation transport with real native Vitest or Jest execution.
// It writes the generated tests a real agent would, runs the evidence command
// the CLI prompt names (failing when the prompt names none), and reports counts
// read from that runner evidence.
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
const manifestPath = JSON.parse(prompt.split('\n').find((line) => /^".*generation\.json"$/.test(line)));
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const red = manifest.mode === 'red';
const javascript = runner === 'jest' || scenario.endsWith('-js');
const extension = javascript ? 'js' : 'ts';
const header =
  runner === 'vitest'
    ? "import { describe, it, test, expect } from 'vitest';\nimport { price } from '../src/price';\n"
    : "const { price } = require('../src/price');\n";
const skip = red ? '.skip' : '';
const body = {
  passing: [`describe('price', () => {`, `  it${skip}('AC-1 doubles the amount', () => {`, '    expect(price(2)).toBe(4);', '  });', '});', `test${skip}('AC-2 handles zero', () => {`, '  expect(price(0)).toBe(0);', '});'],
  failing: [`describe('price', () => {`, `  it('AC-1 doubles the amount', () => {`, '    expect(price(2)).toBe(4);', '  });', '});', `test('AC-2 applies the bulk discount', () => {`, '  expect(price(100)).toBe(180);', '});'],
  // Two registrations share a line, and the body carries a non-registration .skip( call.
  red: [
    `describe('price', () => {`,
    `  it.skip('AC-3 applies the bulk discount', () => {`,
    '    const tag = { skip: (value) => value };',
    '    expect(tag.skip(price(100))).toBe(180);',
    '  });',
    '});',
    `test.skip('AC-4 rejects negative amounts', () => { expect(() => price(-1)).toThrow(); }); test.skip('AC-5 caps the total', () => { expect(price(1e9)).toBe(1e6); });`,
  ],
  'wrong-reason': [`test.skip('AC-3 applies the bulk discount', () => {`, "  throw new TypeError('fixture not wired');", '});'],
  'retry-wrong-reason': [
    'jest.retryTimes(1);',
    'let attempt = 0;',
    `test.skip('AC-3 applies the bulk discount', () => {`,
    "  if (++attempt === 1) throw new TypeError('fixture not wired');",
    '  expect(price(100)).toBe(180);',
    '});',
  ],
  flaky: [
    'let attempt = 0;',
    `test('AC-1 doubles the amount', { retry: 1 }, () => {`,
    "  if (++attempt === 1) throw new TypeError('warming up');",
    '  expect(price(2)).toBe(4);',
    '});',
  ],
  unhandled: [`test('AC-1 doubles the amount', async () => {`, "  Promise.reject(new Error('late failure'));", '  await new Promise((resolve) => setTimeout(resolve, 20));', '  expect(price(2)).toBe(4);', '});'],
};
const kind = red
  ? ({ 'red-wrong-reason': 'wrong-reason', 'red-retry-wrong-reason': 'retry-wrong-reason' }[scenario] ?? 'red')
  : ({ 'expand-failed': 'failing', 'expand-flaky': 'flaky', 'expand-unhandled': 'unhandled' }[scenario] ?? 'passing');
const file = `tests/price.generated.test.${extension}`;
fs.rmSync('tests/api', { recursive: true, force: true });
fs.writeFileSync(file, `${header}${body[kind].join('\n')}\n`);
const generated = [file];
if (scenario === 'expand-unrelated')
  fs.writeFileSync(`tests/existing.test.${extension}`, `${runner === 'vitest' ? "import { test } from 'vitest';\n" : ''}test('existing', () => {});\n`);
// A runner the agent declares during the run cannot make its evidence acceptable.
if (scenario === 'expand-late-runner') fs.writeFileSync('vitest.config.mjs', "export default { test: { include: ['tests/**/*.test.ts'] } };\n");

const evidence = '_bmad-output/test-artifacts/automate';
const report = path.join(evidence, `${runner}-${scenario}.json`);
// The evidence command comes from the prompt, so a prompt that stops naming it fails here.
const command = prompt.match(new RegExp(`node ("[^"]+unit-check\\.js") --mode ${red ? 'red' : 'expand'} --project-root ("[^"]+")`));
if (!command) throw new Error('the prompt names no tea-unit-check command');
const unitCheck = (files) =>
  spawnSync(
    process.execPath,
    [
      JSON.parse(command[1]),
      '--mode',
      red ? 'red' : 'expand',
      '--project-root',
      JSON.parse(command[2]),
      '--report',
      report,
      ...files.flatMap((item) => ['--file', item]),
      ...(scenario === 'expand-late-runner' ? ['--runner', 'vitest'] : []),
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
const bin = (name) => {
  const pkg = JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
  return path.join('node_modules', name, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name]);
};
const raw = (cwd, files, output, locations = true) =>
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
  run = raw(copy, [path.join(copy, file)], path.resolve(report));
  fs.rmSync(copy, { recursive: true, force: true });
} else if (scenario === 'red-in-place') {
  // Activating the saved scaffold in place and restoring it afterwards skips every unit-check binding.
  const saved = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, saved.replaceAll('it.skip(', 'it(').replaceAll('test.skip(', 'test('));
  run = raw('.', generated, path.resolve(report));
  fs.writeFileSync(file, saved);
} else if (['expand-raw', 'expand-no-location'].includes(scenario)) run = raw('.', generated, path.resolve(report), scenario === 'expand-raw');
else run = unitCheck(scenario === 'expand-unrelated' ? [...generated, `tests/existing.test.${extension}`] : generated);
fs.writeFileSync('native-exit.json', JSON.stringify({ status: run.status, stdout: run.stdout, stderr: run.stderr }));

const evidenceReport = JSON.parse(fs.readFileSync(report, 'utf8'));
const count = { executed: 0, passed: 0, failed: 0, skipped: 0, intendedFailures: 0 };
if (evidenceReport.kind === 'tea-unit-check')
  for (const item of evidenceReport.files)
    for (const test of item.tests)
      for (const attempt of test.attempts) {
        if (attempt.status === 'failed') count.failed++;
        else if (attempt.status === 'passed') count.passed++;
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
