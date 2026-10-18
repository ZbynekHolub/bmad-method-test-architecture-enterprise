'use strict';
// Native Vitest and Jest verification for tea-automate: runner detection, report
// parsing, source inventory and reconciliation, tea-unit-check in both modes, and
// the real CLI path with a controlled agent that runs each project's real runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  attemptFailure,
  detectRunners,
  failureKind,
  normalizeUnitReport,
  unitReportRunner,
  workspaceAncestors,
} = require('../cli/lib/unit-runners');
const { generatedInventory, reconcileInventory } = require('../cli/lib/automate-inventory');
const { reportCounts } = require('../cli/lib/automate-result');
const { generationRequest } = require('../cli/lib/automate-prompt');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'cli/automate.js');
const UNIT_CHECK = path.join(ROOT, 'cli/unit-check.js');
const AGENT = path.join(__dirname, 'fixtures/automate-runner/unit-agent.js');
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tea-automate-unit-')));
let checks = 0;
let projects = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`✓ ${message}`);
}

function project(name, files) {
  const root = path.join(scratch, `${name}-${++projects}`);
  fs.mkdirSync(root, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const PROJECTS = {
  vitest: {
    'package.json': JSON.stringify({ name: 'vitest-fixture', type: 'module', devDependencies: { vitest: '*' } }),
    'vitest.config.mjs': "export default { test: { include: ['tests/**/*.test.{ts,js}'] } };\n",
    'src/price.ts': 'export const price = (amount: number) => amount * 2;\n',
    'story.md': '# Story\n\nAC-3: bulk orders get a discount\n',
  },
  jest: {
    'package.json': JSON.stringify({
      name: 'jest-fixture',
      devDependencies: { jest: '*' },
      jest: { testMatch: ['**/tests/**/*.test.js'] },
    }),
    'src/price.js': 'exports.price = (amount) => amount * 2;\n',
    'story.md': '# Story\n\nAC-3: bulk orders get a discount\n',
  },
};
const EXT = { vitest: 'ts', jest: 'js' };
const HEADER = { vitest: "import { describe, it, test, expect } from 'vitest';\n", jest: '' };

function fixture(runner, name) {
  const root = project(`${runner}-${name}`, PROJECTS[runner]);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  return root;
}

function nativeReport(runner, root, files) {
  const output = path.join(root, 'native.json');
  const bin = runner === 'vitest' ? 'node_modules/vitest/vitest.mjs' : 'node_modules/jest/bin/jest.js';
  const args =
    runner === 'vitest'
      ? ['run', ...files, '--reporter=json', `--outputFile=${output}`, '--includeTaskLocation']
      : ['--json', '--testLocationInResults', `--outputFile=${output}`, '--runTestsByPath', ...files];
  spawnSync(process.execPath, [path.join(ROOT, bin), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return JSON.parse(fs.readFileSync(output, 'utf8'));
}

function unitCheck(root, mode, files, extra = []) {
  const reportPath = path.join(root, `unit-check-${mode}.json`);
  fs.rmSync(reportPath, { force: true });
  const run = spawnSync(
    process.execPath,
    [UNIT_CHECK, '--mode', mode, '--project-root', root, '--report', reportPath, ...files.flatMap((file) => ['--file', file]), ...extra],
    { encoding: 'utf8', timeout: 180_000 },
  );
  return { run, report: fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null };
}

function automate(root, runner, scenario, mode) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      '--project-root',
      root,
      '--agent',
      'custom',
      '--agent-cmd',
      process.execPath,
      '--agent-arg',
      AGENT,
      '--agent-arg',
      runner,
      '--agent-arg',
      scenario,
      '--mode',
      mode,
      ...(mode === 'red' ? ['--story', 'story.md'] : ['--target', 'src']),
      'cover the price rules',
    ],
    { encoding: 'utf8', timeout: 240_000 },
  );
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const summary = (test) => `${test.titlePath.join(' > ')}:${test.status}:${test.failure}@${test.line}:${test.column}`;

async function main() {
  // Runner detection reads only package.json and config files.
  const detection = (files) => detectRunners(project('detect', files));
  assert.deepEqual(detection({ 'package.json': '{"devDependencies":{"vitest":"^4"}}' }), [{ runner: 'vitest', configFile: null }]);
  assert.deepEqual(detection({ 'vite.config.ts': '' }), []);
  assert.deepEqual(detection({ 'package.json': '{"devDependencies":{"vitest":"^4"}}', 'vite.config.ts': '' }), [
    { runner: 'vitest', configFile: 'vite.config.ts' },
  ]);
  assert.deepEqual(detection({ 'vitest.config.mts': '', 'vite.config.ts': '' }), [{ runner: 'vitest', configFile: 'vitest.config.mts' }]);
  assert.deepEqual(detection({ 'package.json': '{"jest":{}}' }), [{ runner: 'jest', configFile: 'package.json' }]);
  assert.deepEqual(detection({ 'package.json': '{"jest":{}}', 'jest.config.cjs': '' }), [
    { runner: 'jest', configFile: 'jest.config.cjs' },
  ]);
  assert.deepEqual(detection({ 'package.json': '{"dependencies":{"jest":"*","@playwright/test":"*"}}', 'vitest.config.js': '' }), [
    { runner: 'playwright', configFile: null },
    { runner: 'vitest', configFile: 'vitest.config.js' },
    { runner: 'jest', configFile: null },
  ]);
  assert.throws(() => detection({ 'package.json': '{invalid' }), /package\.json is invalid JSON/);
  const workspace = project('workspace-detect', {
    '.git/HEAD': 'ref: refs/heads/main\n',
    'package.json': '{"workspaces":["packages/*"],"devDependencies":{"vitest":"*"}}',
    'packages/app/package.json': '{"name":"app"}',
  });
  assert.deepEqual(workspaceAncestors(path.join(workspace, 'packages/app')), [path.join(workspace, 'packages'), workspace]);
  assert.deepEqual(detectRunners(path.join(workspace, 'packages/app')), [{ runner: 'vitest', configFile: null }]);
  assert.deepEqual(workspaceAncestors(project('outside', { 'package.json': '{}' })), []);
  check(true, 'runner detection follows the project and its workspace root declarations only');

  // Failure classification decides intended red.
  assert.equal(failureKind('AssertionError: expected 4 to be 5'), 'assertion');
  assert.equal(failureKind('AssertionError [ERR_ASSERTION]: values differ'), 'assertion');
  assert.equal(failureKind('Error: expect(received).toBe(expected)'), 'assertion');
  assert.equal(failureKind('Error: boom', { matcherResult: { pass: false } }), 'assertion');
  assert.equal(failureKind('TypeError: price is not a function'), 'error');
  assert.equal(failureKind('Error: Test timed out in 5000ms.'), 'timeout');
  assert.equal(failureKind('thrown: "Exceeded timeout of 5000 ms for a test.'), 'timeout');
  assert.equal(attemptFailure(['AssertionError: a', 'TypeError: afterEach broke']), 'error');
  assert.equal(attemptFailure(['AssertionError: a', 'AssertionError: b']), 'assertion');
  assert.equal(attemptFailure([]), 'error');
  check(true, 'an attempt is an assertion failure only when every message is one');

  // Real native reports from the repository's own runners.
  const parsing = {};
  for (const runner of ['vitest', 'jest']) {
    const root = fixture(runner, 'parse');
    const extension = EXT[runner];
    const header = HEADER[runner];
    fs.writeFileSync(
      path.join(root, `tests/parse.test.${extension}`),
      `${header}describe('outer', () => {\n  it('passes', () => { expect(1).toBe(1); });\n  test('asserts', () => { expect(1).toBe(2); });\n  test('throws', () => { throw new TypeError('boom'); });\n  it.skip('skipped', () => {});\n});\n`,
    );
    fs.writeFileSync(path.join(root, `tests/broken.test.${extension}`), `${header}import './missing-module';\ntest('never', () => {});\n`);
    const report = nativeReport(runner, root, [`tests/parse.test.${extension}`, `tests/broken.test.${extension}`]);
    parsing[runner] = { root, report, extension };
    check(unitReportRunner(report) === runner, `${runner} JSON is recognized as ${runner}`);
    const counts = reportCounts(report);
    check(
      counts.executed === 3 && counts.passed === 1 && counts.failed === 2 && counts.skipped === 1 && counts.assertionFailures === 1,
      `${runner} counts executed, passed, failed, skipped and assertion failures from real JSON`,
    );
    check(counts.errors === 1, `${runner} counts a file load failure as a runner error`);
    const parsed = normalizeUnitReport(report).files.find((file) => file.name.endsWith(`parse.test.${extension}`));
    const offset = header ? 1 : 0;
    check(
      parsed.tests.map((test) => [test.titlePath.join(' > '), test.line, test.column].join(':')).join(',') ===
        `outer > passes:${2 + offset}:3,outer > asserts:${3 + offset}:3,outer > throws:${4 + offset}:3,outer > skipped:${5 + offset}:6`,
      `${runner} identities retain suite path, line and column`,
    );
  }
  const parsedOf = (report) => report.testResults.find((file) => file.name.includes('parse.test'));
  const malformed = (runner, mutate) => {
    const report = structuredClone(parsing[runner].report);
    mutate(report);
    return () => reportCounts(report);
  };
  assert.throws(
    malformed('vitest', (report) => (parsedOf(report).name = 'tests/relative.test.ts')),
    /absolute test file path/,
  );
  assert.throws(
    malformed('vitest', (report) => (parsedOf(report).assertionResults[0].status = 'flaky')),
    /unsupported attempt status/,
  );
  assert.throws(
    malformed('jest', (report) => delete parsedOf(report).assertionResults),
    /lacks assertion results/,
  );
  assert.throws(
    malformed('jest', (report) => (parsedOf(report).assertionResults[0].ancestorTitles = [1])),
    /malformed test identity/,
  );
  assert.throws(
    malformed('jest', (report) => (parsedOf(report).assertionResults[0].invocations = 0)),
    /malformed invocations/,
  );
  check(true, 'malformed Vitest and Jest results are rejected');

  // Retries: every attempt counts, as on the Playwright path.
  {
    const root = fixture('jest', 'retries');
    fs.writeFileSync(
      path.join(root, 'tests/retry.test.js'),
      "jest.retryTimes(1);\nlet n = 0;\ntest('flaky', () => { if (++n === 1) throw new TypeError('first'); expect(1).toBe(1); });\n",
    );
    const counts = reportCounts(nativeReport('jest', root, ['tests/retry.test.js']));
    check(
      counts.passed === 1 && counts.failed === 1 && counts.executed === 2,
      'a default Jest retry counts its failed attempt from invocations',
    );
  }
  {
    const root = fixture('vitest', 'retries');
    fs.writeFileSync(
      path.join(root, 'tests/retry.test.ts'),
      "import { test, expect } from 'vitest';\nlet n = 0;\ntest('flaky', { retry: 1 }, () => { if (++n === 1) throw new TypeError('first'); expect(1).toBe(1); });\n",
    );
    const counts = reportCounts(nativeReport('vitest', root, ['tests/retry.test.ts']));
    check(counts.passed === 1 && counts.failed === 1 && counts.executed === 2, 'a Vitest retry counts the failure its final pass retains');
    fs.writeFileSync(
      path.join(root, 'tests/exhausted.test.ts'),
      "import { test, expect } from 'vitest';\nlet n = 0;\ntest('exhausted', { retry: 1 }, () => { expect(++n).toBe(0); });\n",
    );
    const exhausted = reportCounts(nativeReport('vitest', root, ['tests/exhausted.test.ts']));
    check(exhausted.failed === 1 && exhausted.executed === 1, 'a failed Vitest test is one attempt whatever its messages');
  }
  const unhandled = {
    success: false,
    numFailedTests: 0,
    testResults: [{ name: '/abs/x.test.ts', message: '', status: 'passed', assertionResults: [] }],
  };
  check(reportCounts(unhandled).errors === 1, 'a failed Vitest run with no failed test is a runner error');
  const interrupted = { ...structuredClone(parsing.jest.report), wasInterrupted: true };
  check(reportCounts(interrupted).errors === 2, 'an interrupted Jest run is a runner error');

  // Inventory grammar for Vitest and Jest sources.
  const inventoryOf = (source, runner = 'vitest', extension = 'ts') => {
    const root = project('inventory', { [`tests/a.test.${extension}`]: source });
    return generatedInventory(root, [`tests/a.test.${extension}`], { runner });
  };
  const leaves = (source, runner) =>
    inventoryOf(source, runner).tests.map((leaf) => `${leaf.titlePath.join(' > ')}@${leaf.line}:${leaf.column}`);
  assert.deepEqual(
    leaves(
      "import { describe, it, test as check } from 'vitest';\nimport * as v from 'vitest';\nvi.mock('../src/price', () => ({ price: () => 1 }));\ndescribe('outer', () => {\n  describe.concurrent('inner', () => { it('a', () => {}); });\n  check('b', () => {});\n});\nv.test('c', () => {});\nv.it.skip('d', () => {});\n",
    ),
    ['outer > inner > a@5:40', 'outer > b@6:3', 'c@8:3', 'd@9:6'],
  );
  assert.deepEqual(
    leaves(
      "const { test, describe } = require('@jest/globals');\nconst g = require('@jest/globals');\ndescribe('s', () => { test('a', () => {}); });\ng.it('b', () => {});\n",
      'jest',
    ),
    ['s > a@3:23', 'b@4:3'],
  );
  assert.deepEqual(leaves("jest.mock('../src/price', () => ({}));\ndescribe('s', () => { it('global', () => {}); });\n", 'jest'), [
    's > global@2:23',
  ]);
  check(true, 'Vitest and Jest registrations resolve through imports, requires, namespaces and globals');
  // Runner utilities and other installed packages register no tests, however they are bound.
  assert.deepEqual(
    leaves(
      "import { vi as mocker, test } from 'vitest';\nimport * as v from 'vitest';\nimport { http, HttpResponse } from 'msw';\nimport { setupServer } from 'msw/node';\nimport express from 'express';\nmocker.mock('../src/price', () => ({}));\nv.vi.mock('../src/cart', () => ({}));\nconst server = setupServer(http.get('/api/price', () => HttpResponse.json({ p: 1 })));\nconst app = express();\napp.get('/health', (request, response) => response.send('ok'));\ntest('priced', () => {});\n",
    ),
    ['priced@11:1'],
  );
  assert.throws(
    () => inventoryOf("import { helpers } from './support';\nhelpers.case('hidden', () => {});\ntest('x', () => {});\n"),
    /unresolved registration binding/,
  );
  assert.throws(() => inventoryOf("import * as v from 'vitest';\nv.bench('hidden', () => {});\n"), /unresolved registration binding/);
  check(true, 'utility aliases and package calls are not registrations; local helpers and test-module calls still are');
  assert.deepEqual(leaves("import { 'test' as check } from 'vitest';\ncheck('literal import', () => {});\n"), ['literal import@2:1']);
  {
    const root = project('playwright-literal', {
      'tests/a.spec.ts': "import { 'test' as check } from '@playwright/test';\ncheck('literal import', () => {});\n",
    });
    check(
      generatedInventory(root, ['tests/a.spec.ts'])
        .tests.map((leaf) => leaf.titlePath.at(-1))
        .join(',') === 'literal import',
      'a string-literal import name binds the test function in both grammars',
    );
  }
  const fixtureTest = inventoryOf(
    "import { test } from 'vitest';\nconst it2 = test.extend({ value: 1 });\nit2.skip('fixture', () => {});\n",
    'vitest',
    'js',
  ).tests[0];
  const jestGlobal = inventoryOf("test.skip('global', () => {});\n", 'jest', 'js').tests[0];
  const jestRequire = inventoryOf("const { test } = require('@jest/globals');\ntest('required', () => {});\n", 'jest', 'js').tests[0];
  check(
    jestGlobal.alternateLine === undefined && jestGlobal.activationAlternateLine === undefined && jestRequire.alternateLine === undefined,
    'Jest globals and required bindings have exactly one accepted location',
  );
  for (const source of [
    "test('retried', { retry: 2 }, () => {});",
    "test('repeated', { repeats: 3 }, () => {});",
    "describe('retried suite', { retry: 1 }, () => { test('a', () => {}); });",
    "const options = { retry: 1 };\ntest('opaque options', options, () => {});",
  ])
    assert.throws(() => inventoryOf(source), /retry, repeat or dynamic test option/, source);
  {
    const root = fixture('vitest', 'retry-option');
    fs.writeFileSync(path.join(root, 'tests/retry.test.ts'), `${HEADER.vitest}test('retried', { retry: 1 }, () => {});\n`);
    const refused = unitCheck(root, 'expand', ['tests/retry.test.ts']);
    check(
      refused.run.status === 2 && /retry, repeat or dynamic test option/.test(refused.run.stderr),
      'the unit check refuses a generated retry option',
    );
  }
  check(
    leaves("test('timed', () => {}, 5000);\ndescribe('concurrent', { concurrent: true }, () => { test('a', () => {}); });\n").length === 2,
    'generated tests cannot declare retries or repeats, while timeouts and plain options stay allowed',
  );
  check(
    fixtureTest.line === 3 &&
      fixtureTest.column === 5 &&
      fixtureTest.activationLine === 3 &&
      fixtureTest.activationColumn === 1 &&
      fixtureTest.activationAlternateLine === 3 &&
      fixtureTest.activationAlternateColumn === 9,
    'Vitest JavaScript skip leaves retain their activated identifier location and call parenthesis',
  );
  for (const [source, error] of [
    ["test.each([1, 2])('case %s', () => {});", /table registration/],
    ["describe.each([1])('suite %s', () => {});", /table registration/],
    ["test.for([1])('case %s', () => {});", /table registration/],
    ["test.skipIf(true)('conditional', () => {});", /table registration/],
    ["test.todo('later');", /table registration/],
    ["test.fails('inverted', () => {});", /table registration/],
    ["for (const title of ['a']) test(title, () => {});", /dynamic test registration/],
    ['test(`template ${1}`, () => {});', /dynamic test registration/],
    ["const name = 'x';\ntest(name, () => {});", /dynamic test registration/],
    ["test['skip']('a', () => {});\nconst m = 'only';\ntest[m]('b', () => {});", /computed registration/],
    ["helper('hidden', () => {});", /unresolved registration binding/],
    ["test('no body');", /unresolved callback registration/],
    ["test.concurrent.only('two modifiers', () => {});", /unsupported registration/],
    ["let check = test;\ncheck = it;\ncheck('a', () => {});", /reassigned test binding/],
    ["if (process.env.X) { test('conditional', () => {}); }", /dynamic test registration/],
  ])
    assert.throws(() => inventoryOf(source), error, source);
  check(true, 'runtime-only Vitest and Jest registrations are rejected from source');

  // Raw Jest JSON reconciles; raw Vitest JSON and raw red evidence cannot.
  {
    const { root } = parsing.jest;
    const file = 'tests/rec.test.js';
    fs.writeFileSync(
      path.join(root, file),
      "describe('rec', () => {\n  it('one', () => { expect(1).toBe(1); });\n});\ntest('two', () => {});\n",
    );
    const report = nativeReport('jest', root, [file]);
    const inventory = generatedInventory(root, [file], { runner: 'jest' });
    const runners = detectRunners(root);
    check(
      reconcileInventory(inventory, [report], { mode: 'expand', runners }).executionScopes.length === 2,
      'raw Jest JSON reconciles every generated leaf',
    );
    const reject = (mutate, error, label, options = {}) => {
      const altered = structuredClone(report);
      mutate(altered);
      assert.throws(() => reconcileInventory(inventory, [altered], { mode: 'expand', runners, ...options }), error, label);
      check(true, `raw Jest JSON ${label}`);
    };
    const tests = (altered) => altered.testResults[0].assertionResults;
    reject((altered) => tests(altered)[0].location.column++, /does not identify one generated test leaf/, 'rejects a moved column');
    reject((altered) => tests(altered)[0].location.line++, /does not identify one generated test leaf/, 'rejects a moved line');
    reject((altered) => (tests(altered)[0].title = 'other'), /does not identify one generated test leaf/, 'rejects a foreign title');
    reject(
      (altered) => (tests(altered)[0].ancestorTitles = []),
      /does not identify one generated test leaf/,
      'rejects a foreign suite path',
    );
    reject((altered) => delete tests(altered)[0].location, /lacks test locations/, 'rejects a report without locations');
    reject((altered) => tests(altered).pop(), /omits generated test\/project scope/, 'rejects an omitted generated leaf');
    reject(
      (altered) => tests(altered).push(structuredClone(tests(altered)[0])),
      /repeat a generated test scope/,
      'rejects a repeated leaf',
    );
    reject(
      (altered) => (altered.testResults[0].name = path.join(path.dirname(root), 'copy', file)),
      /different consuming project root/,
      'rejects a report from another project root',
    );
    reject(() => {}, /does not match a test runner the project declares/, 'rejects a runner the project does not declare', {
      runners: [{ runner: 'vitest', configFile: null }],
    });
    reject(() => {}, /raw Jest JSON cannot establish verified red/, 'cannot establish verified red', { mode: 'red' });
    assert.throws(
      () => reconcileInventory({ ...inventory, runner: 'vitest' }, [report], { mode: 'expand', runners }),
      /inventory was not derived/,
    );
    assert.throws(
      () => reconcileInventory(inventory, [report, { suites: [], config: {} }], { mode: 'expand', runners }),
      /mixes incompatible runner scope identities/,
    );
    check(true, 'raw Jest JSON cannot mix runner families or grammars');
  }
  {
    const { root } = parsing.vitest;
    const file = 'tests/rec.test.ts';
    fs.writeFileSync(path.join(root, file), `${HEADER.vitest}test('one', () => { expect(1).toBe(1); });\n`);
    const report = nativeReport('vitest', root, [file]);
    assert.throws(
      () =>
        reconcileInventory(generatedInventory(root, [file], { runner: 'vitest' }), [report], {
          mode: 'expand',
          runners: detectRunners(root),
        }),
      /raw Vitest JSON cannot establish Vitest execution; run tea-unit-check --mode expand/,
    );
    check(true, 'raw Vitest JSON is rejected because it omits unhandled errors');
  }

  // tea-unit-check expand: the native runner in place, with the process outcome recorded.
  for (const runner of ['vitest', 'jest']) {
    const root = fixture(runner, 'expand-check');
    const files = runner === 'vitest' ? ['tests/rec.test.ts', 'tests/rec-js.test.js'] : ['tests/rec.test.js'];
    for (const file of files)
      fs.writeFileSync(
        path.join(root, file),
        `${HEADER[runner]}describe('rec', () => {\n  it('one', () => { expect(1).toBe(1); });\n});\ntest('two', () => {}); test('three', () => {});\n`,
      );
    const { run, report } = unitCheck(root, 'expand', files);
    check(
      run.status === 0 && report.mode === 'expand' && report.files.every((item) => item.exitCode === 0),
      `${runner} expand check runs in place: ${run.stderr}`,
    );
    const inventory = generatedInventory(root, files, { runner });
    const runners = detectRunners(root);
    // Vitest 5 reports a .js identifier call at its callee end; both ends bind one leaf.
    check(
      reconcileInventory(inventory, [report], { mode: 'expand', runners }).executionScopes.length === 3 * files.length,
      `${runner} expand check reconciles every leaf${runner === 'vitest' ? ' in TypeScript and JavaScript' : ''}`,
    );
    const reject = (mutate, error, label, mode = 'expand') => {
      const altered = structuredClone(report);
      mutate(altered);
      assert.throws(() => reconcileInventory(inventory, [altered], { mode, runners }), error, label);
      check(true, `${runner} expand check ${label}`);
    };
    reject((altered) => altered.files[0].tests[0].column++, /does not identify one generated test leaf/, 'rejects a moved column');
    reject((altered) => (altered.files[0].sha256 = '0'.repeat(64)), /different generated bytes/, 'rejects other generated bytes');
    reject((altered) => (altered.configFile = 'other.config.js'), /different .* configuration/, 'rejects another runner configuration');
    reject((altered) => (altered.projectRoot = path.dirname(root)), /different consuming project root/, 'rejects another project root');
    reject(() => {}, /ran in "expand" mode for a red request/, 'cannot stand in for red evidence', 'red');
    const forged = structuredClone(report);
    forged.files[0].tests[0].attempts = [];
    assert.throws(() => reportCounts(forged), /lacks its attempts/);
    check(true, `${runner} expand check counts require recorded attempts`);
    const contradictory = structuredClone(report);
    contradictory.files[0].tests[0].status = 'failed';
    assert.throws(() => reportCounts(contradictory), /disagrees with its final attempt/);
    const silentExit = structuredClone(report);
    silentExit.files[0].exitCode = 1;
    assert.throws(() => reportCounts(silentExit), /exit code 1 disagrees with its test results/);
    const missingOutcome = structuredClone(report);
    delete missingOutcome.files[0].runError;
    assert.throws(() => reportCounts(missingOutcome), /lacks its outcome fields/);
    check(true, `${runner} expand check evidence must agree with its own exit code and final attempts`);
    if (runner === 'vitest') {
      // The parenthesis column names the same call; any other column names none.
      const paren = structuredClone(report);
      paren.files[0].tests.find((test) => test.titlePath.at(-1) === 'two').column = 5;
      check(
        reconcileInventory(inventory, [paren], { mode: 'expand', runners }).executionScopes.length === 3 * files.length,
        'a Vitest call reported at its parenthesis binds the same leaf',
      );
      paren.files[0].tests.find((test) => test.titlePath.at(-1) === 'two').column = 6;
      assert.throws(() => reconcileInventory(inventory, [paren], { mode: 'expand', runners }), /does not identify one generated test leaf/);
      check(true, 'a Vitest call reported between its callee and parenthesis binds no leaf');
    }
    const unterminated = structuredClone(report);
    unterminated.files[0].exitCode = null;
    assert.throws(() => reportCounts(unterminated), /records no exit code and no error/);
    check(true, `${runner} checked evidence without an exit code needs a recorded error`);
  }
  {
    // babel-jest compiles an @jest/globals import to (0, _globals.it)(...), which Jest reports at the callee end.
    const root = fixture('jest', 'babel');
    fs.writeFileSync(path.join(root, 'babel.config.js'), "module.exports = { plugins: ['@babel/plugin-transform-modules-commonjs'] };\n");
    const imports = "import { describe, it, test, expect } from '@jest/globals';\n";
    fs.writeFileSync(
      path.join(root, 'tests/esm.test.js'),
      `${imports}describe('esm', () => {\n  it('one', () => { expect(1).toBe(1); });\n});\ntest('two', () => { expect(2).toBe(2); });\n`,
    );
    fs.writeFileSync(
      path.join(root, 'tests/esm-red.test.js'),
      `${imports}describe('esm', () => {\n  it.skip('one', () => { expect(1).toBe(2); });\n});\ntest.skip('two', () => { expect(2).toBe(3); });\n`,
    );
    const runners = detectRunners(root);
    const expand = unitCheck(root, 'expand', ['tests/esm.test.js']).report;
    check(
      reconcileInventory(generatedInventory(root, ['tests/esm.test.js'], { runner: 'jest' }), [expand], { mode: 'expand', runners })
        .executionScopes.length === 2,
      'transformed Jest ES imports reconcile in expand mode',
    );
    const red = unitCheck(root, 'red', ['tests/esm-red.test.js']).report;
    check(
      red.files[0].tests.every((test) => test.failure === 'assertion') &&
        reconcileInventory(generatedInventory(root, ['tests/esm-red.test.js'], { runner: 'jest' }), [red], { mode: 'red', runners })
          .executionScopes.length === 2,
      'transformed Jest ES imports reconcile after red activation',
    );
    const shifted = structuredClone(red);
    shifted.files[0].tests[1].column += 4;
    assert.throws(
      () =>
        reconcileInventory(generatedInventory(root, ['tests/esm-red.test.js'], { runner: 'jest' }), [shifted], { mode: 'red', runners }),
      /does not identify one generated test leaf/,
    );
    check(true, 'a transformed Jest location still binds one exact column');
  }
  {
    const root = fixture('vitest', 'unhandled');
    fs.writeFileSync(
      path.join(root, 'tests/late.test.ts'),
      `${HEADER.vitest}test('passes with a late rejection', async () => { Promise.reject(new Error('late')); await new Promise((resolve) => setTimeout(resolve, 20)); expect(1).toBe(1); });\n`,
    );
    const { report } = unitCheck(root, 'expand', ['tests/late.test.ts']);
    check(
      /unhandled errors/.test(report.files[0].runError) &&
        report.files[0].tests[0].status === 'passed' &&
        reportCounts(report).errors === 1,
      'an unhandled rejection Vitest JSON omits becomes a runner error',
    );
    fs.writeFileSync(
      path.join(root, 'tests/soft.test.ts'),
      `${HEADER.vitest}test.skip('soft', () => { expect.soft(1).toBe(2); expect.soft(3).toBe(4); });\n`,
    );
    const soft = unitCheck(root, 'red', ['tests/soft.test.ts']).report;
    check(
      soft.files[0].tests[0].attempts.length === 1 && soft.files[0].tests[0].failure === 'assertion' && reportCounts(soft).executed === 1,
      'two soft assertion failures are one red attempt',
    );
  }
  {
    // A descendant that outlives the runner and holds its output cannot hold the run open, and dies with it.
    const root = fixture('jest', 'linger');
    const lingering = path.join(root, 'lingering.pid');
    fs.writeFileSync(
      path.join(root, 'tests/linger.test.js'),
      `const { spawn } = require('node:child_process');\nconst fs = require('node:fs');\ntest('spawns a lingering child', () => { const child = spawn('sleep', ['300'], { stdio: 'inherit' }); child.unref(); fs.writeFileSync(${JSON.stringify(lingering)}, String(child.pid)); expect(1).toBe(1); });\n`,
    );
    const started = Date.now();
    const linger = unitCheck(root, 'expand', ['tests/linger.test.js'], ['--per-file-timeout-ms', '60000']);
    const descendant = Number(fs.readFileSync(lingering, 'utf8'));
    check(
      linger.run.status === 0 && linger.report.files[0].exitCode === 0 && Date.now() - started < 30_000 && !alive(descendant),
      'a runner descendant that outlives the runner is killed when it exits',
    );
  }
  const hang = (root) =>
    `${HEADER.vitest}import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(path.join(root, 'worker.pid'))}, String(process.pid));\nwhile (Date.now() > 0) {}\ntest.skip('never', () => {});\n`;
  {
    const root = fixture('vitest', 'timeout');
    fs.writeFileSync(path.join(root, 'tests/hang.test.ts'), hang(root));
    fs.writeFileSync(path.join(root, 'tests/fine.test.ts'), `${HEADER.vitest}test('fine', () => { expect(1).toBe(1); });\n`);
    const { run, report } = unitCheck(root, 'expand', ['tests/hang.test.ts', 'tests/fine.test.ts'], ['--per-file-timeout-ms', '4000']);
    const [hung, fine] = report.files;
    check(
      run.status === 0 && /timed out after 4000ms/.test(hung.loadError) && fine.tests[0].status === 'passed',
      'a hung file times out without masking its sibling',
    );
    const worker = Number(fs.readFileSync(path.join(root, 'worker.pid'), 'utf8'));
    check(worker !== run.pid && !alive(worker), 'a timed-out runner leaves no worker behind');
  }
  {
    // An interrupted check kills its runner group and removes the disposable copy.
    const root = fixture('vitest', 'interrupt');
    const workDir = path.join(root, 'work');
    fs.mkdirSync(workDir);
    fs.writeFileSync(path.join(root, 'tests/hang.test.ts'), hang(root));
    const child = require('node:child_process').spawn(
      process.execPath,
      [
        UNIT_CHECK,
        '--mode',
        'red',
        '--project-root',
        root,
        '--report',
        path.join(root, 'r.json'),
        '--file',
        'tests/hang.test.ts',
        '--work-dir',
        workDir,
      ],
      { stdio: 'ignore' },
    );
    const deadline = Date.now() + 60_000;
    while (!fs.existsSync(path.join(root, 'worker.pid')) && Date.now() < deadline) spawnSync('sleep', ['0.2']);
    child.kill('SIGTERM');
    const code = await new Promise((resolve) => child.once('exit', (status, signal) => resolve(status ?? signal)));
    spawnSync('sleep', ['0.5']);
    const worker = Number(fs.readFileSync(path.join(root, 'worker.pid'), 'utf8'));
    check(
      code === 143 && !alive(worker) && fs.readdirSync(workDir).length === 0,
      'an interrupted check kills its runner and removes its copy',
    );
  }

  // tea-unit-check red: disposable activation, per-file isolation, permanent scaffold bytes.
  for (const runner of ['vitest', 'jest']) {
    const root = fixture(runner, 'red-check');
    const extension = EXT[runner];
    const header = HEADER[runner];
    const offset = header ? 1 : 0;
    const scaffold = `tests/red.test.${extension}`;
    // A non-registration .skip( call and two registrations on one line pin location-exact activation.
    const source = `${header}describe('red', () => {\n  it.skip('AC-1 discount', () => { const tag = { skip: (value) => value }; expect(tag.skip(2 * 50)).toBe(90); });\n  // test.skip('commented', () => {}) stays text\n});\ntest.skip('AC-2 wrong reason', () => { throw new TypeError('not wired'); }); test.skip('AC-3 cap', () => { expect(1).toBe(2); });\n`;
    fs.writeFileSync(path.join(root, scaffold), source);
    fs.writeFileSync(
      path.join(root, `tests/load.test.${extension}`),
      `${header}import './missing-module';\ntest.skip('never', () => {});\n`,
    );
    const { run, report } = unitCheck(root, 'red', [scaffold, `tests/load.test.${extension}`]);
    check(run.status === 0, `${runner} red check writes a report: ${run.stderr}`);
    const [scaffoldResult, loadResult] = report.files;
    check(fs.readFileSync(path.join(root, scaffold), 'utf8') === source, `${runner} red check leaves the permanent scaffold bytes skipped`);
    check(
      report.runner === runner &&
        report.mode === 'red' &&
        report.configFile === (runner === 'vitest' ? 'vitest.config.mjs' : 'package.json') &&
        report.projectRoot === root &&
        report.productionFilesTouched.length === 0,
      `${runner} red check records the detected runner, config and consuming root`,
    );
    check(
      scaffoldResult.activated === 3 &&
        scaffoldResult.tests.map(summary).join(',') ===
          `red > AC-1 discount:failed:assertion@${2 + offset}:3,AC-2 wrong reason:failed:error@${5 + offset}:1,AC-3 cap:failed:assertion@${5 + offset}:78`,
      `${runner} red check activates only generated leaves in place and classifies each failure: ${scaffoldResult.tests.map(summary).join(',')}`,
    );
    check(loadResult.loadError && loadResult.tests.length === 0, `${runner} red check isolates a file load failure`);
    check(
      scaffoldResult.tests.every((test) => !/\n\s+at /.test(test.message) && !test.message.includes('tea-unit-check-')),
      `${runner} red check keeps failure messages free of disposable-copy stack frames`,
    );
    const counts = reportCounts(report);
    check(counts.failed === 3 && counts.assertionFailures === 2 && counts.errors === 1, `${runner} red check counts feed the red verdict`);
    const runners = detectRunners(root);
    assert.throws(
      () =>
        reconcileInventory(generatedInventory(root, [scaffold, `tests/load.test.${extension}`], { runner }), [report], {
          mode: 'red',
          runners,
        }),
      /omits generated test\/project scope: tests\/load/,
    );
    check(true, `${runner} red check cannot verify a scaffold that failed to load`);
    const inventory = generatedInventory(root, [scaffold], { runner });
    const scaffoldReport = { ...report, files: [scaffoldResult] };
    check(
      reconcileInventory(inventory, [scaffoldReport], { mode: 'red', runners }).executionScopes.length === 3,
      `${runner} red check reconciles activated leaves to their scaffolds`,
    );
    const reject = (mutate, error, label, mode = 'red') => {
      const altered = structuredClone(scaffoldReport);
      mutate(altered);
      assert.throws(() => reconcileInventory(inventory, [altered], { mode, runners }), error, label);
      check(true, `${runner} red check ${label}`);
    };
    reject((altered) => (altered.files[0].sha256 = '0'.repeat(64)), /different generated bytes/, 'rejects other scaffold bytes');
    reject((altered) => (altered.configFile = 'other.config.js'), /different .* configuration/, 'rejects another runner configuration');
    reject((altered) => (altered.projectRoot = path.dirname(root)), /different consuming project root/, 'rejects another project root');
    reject((altered) => altered.files[0].tests.pop(), /omits generated test\/project scope/, 'rejects an omitted scaffold');
    reject(() => {}, /ran in "red" mode for a expand request/, 'cannot stand in for expand evidence', 'expand');
    const activeFile = `tests/active.test.${extension}`;
    fs.writeFileSync(path.join(root, activeFile), `${header}test('active', () => { expect(1).toBe(2); });\n`);
    const activeInventory = generatedInventory(root, [activeFile], { runner });
    const [leaf] = activeInventory.tests;
    const attempt = { status: 'failed', failure: 'assertion' };
    const forged = {
      ...report,
      files: [
        {
          file: activeFile,
          sha256: activeInventory.files[0].sha256,
          tests: [{ titlePath: leaf.titlePath, line: leaf.line, column: leaf.column, ...attempt, attempts: [attempt] }],
        },
      ],
    };
    assert.throws(() => reconcileInventory(activeInventory, [forged], { mode: 'red', runners }), /not a skipped scaffold/);
    check(true, `${runner} red evidence cannot verify an active generated test`);
    const refused = unitCheck(root, 'red', [activeFile]);
    check(
      refused.run.status === 2 && /must register every generated leaf with \.skip/.test(refused.run.stderr),
      `${runner} red check refuses an active scaffold`,
    );
    const mutating = `tests/mutate.test.${extension}`;
    fs.writeFileSync(
      path.join(root, mutating),
      `${header}${runner === 'vitest' ? "import fs from 'node:fs';\n" : "const fs = require('node:fs');\n"}test.skip('mutates product', () => { fs.writeFileSync('src/price.${extension}', ''); expect(1).toBe(2); });\n`,
    );
    const mutated = unitCheck(root, 'red', [mutating]).report;
    check(
      mutated.productionFilesTouched.includes(`src/price.${extension}`) &&
        reportCounts(mutated).errors === 1 &&
        fs.readFileSync(path.join(root, `src/price.${extension}`), 'utf8') === PROJECTS[runner][`src/price.${extension}`],
      `${runner} red check reports a product change made in the copy and leaves the project unchanged`,
    );
    for (const args of [
      [],
      ['--file', '../outside.test.js'],
      ['--file', scaffold, '--file', scaffold],
      ['--file', scaffold, '--runner', 'mocha'],
      ['--file', scaffold, '--per-file-timeout-ms', '0'],
      ['--file', scaffold, '--work-dir', path.join(root, 'missing-dir')],
    ]) {
      const usage = spawnSync(
        process.execPath,
        [UNIT_CHECK, '--mode', 'red', '--project-root', root, '--report', path.join(root, 'u.json'), ...args],
        { encoding: 'utf8' },
      );
      check(
        usage.status === 2 && !/\n\s+at /.test(usage.stderr),
        `${runner} red check usage error exits 2: ${args.join(' ') || 'no files'}`,
      );
    }
  }
  {
    // A symlink that reaches back into the project is rebased into the copy, and any escape is reported.
    const root = fixture('vitest', 'symlink');
    fs.mkdirSync(path.join(root, 'src-real'));
    fs.writeFileSync(path.join(root, 'src-real/price.ts'), PROJECTS.vitest['src/price.ts']);
    fs.rmSync(path.join(root, 'src'), { recursive: true });
    fs.symlinkSync(path.join(root, 'src-real'), path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'tests/link.test.ts'),
      `${HEADER.vitest}import fs from 'node:fs';\ntest.skip('writes through a link', () => { fs.writeFileSync('src/price.ts', 'broken'); expect(1).toBe(2); });\n`,
    );
    const { report } = unitCheck(root, 'red', ['tests/link.test.ts']);
    check(
      fs.readFileSync(path.join(root, 'src-real/price.ts'), 'utf8') === PROJECTS.vitest['src/price.ts'] &&
        report.productionFilesTouched.includes('src-real/price.ts'),
      'a write through an absolute project symlink lands in the copy and is reported',
    );
    // A test that writes to the permanent project by absolute path is reported, and the change stays visible.
    const target = path.join(root, 'src-real/price.ts');
    fs.writeFileSync(
      path.join(root, 'tests/escape.test.ts'),
      `${HEADER.vitest}import fs from 'node:fs';\ntest.skip('writes the real project', () => { fs.appendFileSync(${JSON.stringify(target)}, '// escaped'); expect(1).toBe(2); });\n`,
    );
    const escaped = unitCheck(root, 'red', ['tests/escape.test.ts']).report;
    check(
      escaped.productionFilesTouched.includes('src-real/price.ts') && fs.readFileSync(target, 'utf8').endsWith('// escaped'),
      'a write that escapes the copy into the permanent project is reported',
    );
    fs.writeFileSync(target, PROJECTS.vitest['src/price.ts']);
  }
  {
    // A noisy run cannot push Vitest's unhandled-error banner past the retained output.
    const root = fixture('vitest', 'noisy');
    fs.writeFileSync(
      path.join(root, 'tests/noisy.test.ts'),
      `${HEADER.vitest}test.skip('noisy', async () => { console.error('x'.repeat(5 * 1024 * 1024)); Promise.reject(new Error('late')); await new Promise((resolve) => setTimeout(resolve, 20)); expect(1).toBe(2); });\n`,
    );
    const { report } = unitCheck(root, 'red', ['tests/noisy.test.ts']);
    check(
      /unhandled errors/.test(report.files[0].runError) && reportCounts(report).errors === 1,
      'an unhandled error after 5 MiB of output is still reported',
    );
  }
  {
    // One file selected by two Vitest projects yields two results, so it cannot verify red.
    const root = fixture('vitest', 'projects');
    fs.writeFileSync(
      path.join(root, 'vitest.config.mjs'),
      "export default { test: { projects: [{ test: { name: 'one', include: ['tests/**/*.test.ts'] } }, { test: { name: 'two', include: ['tests/**/*.test.ts'] } }] } };\n",
    );
    fs.writeFileSync(path.join(root, 'tests/twice.test.ts'), `${HEADER.vitest}test.skip('runs twice', () => { expect(1).toBe(2); });\n`);
    const { report } = unitCheck(root, 'red', ['tests/twice.test.ts']);
    check(
      /ran in 2 runner projects/.test(report.files[0].runError) && reportCounts(report).errors === 1,
      'a file run by two Vitest projects is a runner error',
    );
    assert.throws(
      () =>
        reconcileInventory(generatedInventory(root, ['tests/twice.test.ts'], { runner: 'vitest' }), [report], {
          mode: 'red',
          runners: detectRunners(root),
        }),
      /repeat a generated test scope/,
    );
    check(true, 'a doubled project result cannot reconcile as one scope');
  }
  {
    // A workspace package with hoisted dependencies and a relative tsconfig base runs in its copy.
    const ws = project('workspace', {
      '.git/HEAD': 'ref: refs/heads/main\n',
      'package.json': JSON.stringify({ private: true, workspaces: ['packages/*'], devDependencies: { vitest: '*' } }),
      'tsconfig.base.json': '{"compilerOptions":{"strict":true}}\n',
      'packages/app/package.json': JSON.stringify({ name: 'app', type: 'module' }),
      'packages/app/tsconfig.json': '{"extends":"../../tsconfig.base.json"}\n',
      'packages/app/vitest.config.mjs': "export default { test: { include: ['tests/**/*.test.ts'] } };\n",
      'packages/app/tests/hoisted.test.ts': `${HEADER.vitest}import { minimatch } from 'minimatch';\ntest.skip('uses a hoisted dependency', () => { expect(minimatch('a.ts', '*.js')).toBe(true); });\n`,
    });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(ws, 'node_modules'), 'junction');
    const { run, report } = unitCheck(path.join(ws, 'packages/app'), 'red', ['tests/hoisted.test.ts']);
    check(
      run.status === 0 && report.files[0].loadError === null && report.files[0].tests[0].failure === 'assertion',
      `a workspace package resolves hoisted dependencies in its copy: ${run.stderr}${report?.files[0].loadError ?? ''}`,
    );
    // Sibling sources resolve in the copy, and a write into a sibling through a link stays in the copy and is reported.
    fs.mkdirSync(path.join(ws, 'libs/shared/src'), { recursive: true });
    fs.writeFileSync(path.join(ws, 'libs/shared/src/index.js'), 'export const shared = 2;\n');
    fs.writeFileSync(
      path.join(ws, 'packages/app/vitest.config.mjs'),
      "export default { resolve: { alias: { '@acme/shared': new URL('../../libs/shared/src/index.js', import.meta.url).pathname } }, test: { include: ['tests/**/*.test.ts'] } };\n",
    );
    fs.symlinkSync(path.join(ws, 'libs/shared/src'), path.join(ws, 'packages/app/shared-src'));
    fs.writeFileSync(
      path.join(ws, 'packages/app/tests/sibling.test.ts'),
      `${HEADER.vitest}import fs from 'node:fs';\nimport { shared } from '@acme/shared';\ntest.skip('uses a sibling package', () => { fs.writeFileSync('shared-src/index.js', 'broken'); expect(shared).toBe(3); });\n`,
    );
    const sibling = unitCheck(path.join(ws, 'packages/app'), 'red', ['tests/sibling.test.ts']);
    check(
      sibling.report.files[0].tests[0]?.failure === 'assertion' &&
        fs.readFileSync(path.join(ws, 'libs/shared/src/index.js'), 'utf8') === 'export const shared = 2;\n' &&
        sibling.report.productionFilesTouched.includes('../../libs/shared/src/index.js'),
      `a workspace sibling resolves in the copy and a write into it is reported: ${sibling.report.files[0].loadError ?? ''}`,
    );
  }
  {
    // A project inside a plain repository copies its own tree and its ancestors' own files, never the repository.
    const repo = project('repository', {
      '.git/HEAD': 'ref: refs/heads/main\n',
      'tsconfig.base.json': '{}\n',
      'unrelated/blob.txt': 'not part of the project\n',
      'app/package.json': JSON.stringify({ name: 'app', type: 'module', devDependencies: { vitest: '*' } }),
      'app/vitest.config.mjs': "export default { test: { include: ['tests/**/*.test.ts'] } };\n",
    });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(repo, 'app/node_modules'), 'junction');
    fs.mkdirSync(path.join(repo, 'app/tests'));
    const seen = path.join(scratch, `seen-${projects}.json`);
    fs.writeFileSync(
      path.join(repo, 'app/tests/scope.test.ts'),
      `${HEADER.vitest}import fs from 'node:fs';\ntest.skip('scope', () => { fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify([fs.existsSync('../unrelated/blob.txt'), fs.existsSync('../tsconfig.base.json')])); expect(1).toBe(2); });\n`,
    );
    const scoped = unitCheck(path.join(repo, 'app'), 'red', ['tests/scope.test.ts']);
    check(
      scoped.run.status === 0 && fs.readFileSync(seen, 'utf8') === '[false,true]' && scoped.report.productionFilesTouched.length === 0,
      'a project in a repository subfolder copies only itself and its ancestors own files',
    );
  }
  {
    // Jest's testFailureExitCode cannot make a failing red run look like a clean exit.
    const root = fixture('jest', 'failure-exit');
    const pkg = JSON.parse(PROJECTS.jest['package.json']);
    pkg.jest.testFailureExitCode = 0;
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(root, 'tests/red.test.js'), "test.skip('red', () => { expect(1).toBe(2); });\n");
    const { report } = unitCheck(root, 'red', ['tests/red.test.js']);
    const counts = reportCounts(report);
    check(
      report.files[0].exitCode === 1 && counts.failed === 1 && counts.assertionFailures === 1 && counts.errors === 0,
      'a Jest testFailureExitCode of 0 still yields consistent red evidence',
    );
  }
  {
    const both = project('both', {
      'package.json': '{"devDependencies":{"vitest":"*","jest":"*"}}',
      'tests/a.test.js': "test.skip('a', () => {});\n",
    });
    const ambiguous = unitCheck(both, 'red', ['tests/a.test.js']);
    check(
      ambiguous.run.status === 2 && /declares both Vitest and Jest/.test(ambiguous.run.stderr),
      'the unit check refuses to guess between declared runners',
    );
  }

  // The prompt names the detected runner and its evidence command.
  const prompt = (mode, runners) =>
    generationRequest({
      mode,
      operation: 'create',
      request: 'x',
      targets: [],
      manifestPath: 'm.json',
      requestId: 'r',
      settings: {},
      modeSelection: 'explicit',
      runners,
      projectRoot: '/p',
    }).join('\n');
  const bothPrompt = prompt('expand', [
    { runner: 'vitest', configFile: 'vitest.config.ts' },
    { runner: 'jest', configFile: null },
  ]);
  check(
    bothPrompt.includes('vitest (vitest.config.ts), jest (declared dependency, default config)') &&
      bothPrompt.includes(`node ${JSON.stringify(UNIT_CHECK)} --mode expand --project-root "/p" --runner`) &&
      bothPrompt.includes('--testLocationInResults') &&
      bothPrompt.includes('raw Vitest JSON is not'),
    'expand prompt names detected runners, the unit check and a runner choice when both are declared',
  );
  const redPrompt = prompt('red', [{ runner: 'jest', configFile: 'package.json' }]);
  check(
    redPrompt.includes(`node ${JSON.stringify(UNIT_CHECK)} --mode red --project-root "/p" --report`) && !redPrompt.includes('--runner <'),
    'red prompt directs Vitest and Jest scaffolds to the unit check',
  );
  check(!prompt('expand', []).includes('unit-check.js'), 'prompt adds no unit runner commands when none is detected');
  for (const [runner, mode] of [
    ['vitest', 'expand'],
    ['jest', 'red'],
  ]) {
    const root = fixture(runner, 'dry-run');
    const dry = spawnSync(
      process.execPath,
      [CLI, '--project-root', root, '--agent', 'none', '--mode', mode, ...(mode === 'red' ? ['--story', 'story.md'] : ['--target', 'src'])],
      { encoding: 'utf8' },
    );
    check(
      dry.status === 0 &&
        dry.stdout.includes(`${runner} (${runner === 'vitest' ? 'vitest.config.mjs' : 'package.json'})`) &&
        dry.stdout.includes(`node ${JSON.stringify(UNIT_CHECK)} --mode ${mode} --project-root ${JSON.stringify(root)}`),
      `the ${mode} CLI prompt carries the detected ${runner} runner and the unit check command`,
    );
  }

  // The real CLI path: a controlled agent runs the evidence command the prompt names.
  for (const runner of ['vitest', 'jest']) {
    const accepted = [
      ['expand-passed', 'expand', 0, 'passed'],
      ['expand-failed', 'expand', 1, 'failed'],
      ['red-verified', 'red', 0, 'verified red'],
      ...(runner === 'vitest'
        ? [
            ['expand-passed-js', 'expand', 0, 'passed'],
            ['red-verified-js', 'red', 0, 'verified red'],
          ]
        : [['expand-raw', 'expand', 0, 'passed']]),
    ];
    for (const [scenario, mode, exit, status] of accepted) {
      const root = fixture(runner, scenario);
      const run = automate(root, runner, scenario, mode);
      check(run.status === exit, `${runner} ${scenario} exits ${exit}: ${run.stderr}`);
      const result = JSON.parse(run.stdout);
      check(result.executionStatus === status, `${runner} ${scenario} reports ${status}`);
      if (exit === 0) {
        const scopes = JSON.parse(fs.readFileSync(path.join(result.evidenceDir, 'attempt-1/validated-test-scopes.json'), 'utf8'));
        const count = mode === 'red' ? 3 : 2;
        check(
          scopes.runner === runner &&
            scopes.executionScopes.length === count &&
            scopes.executionScopes.every(({ identity }) => identity[4] === runner),
          `${runner} ${scenario} retains reconciled ${runner} scopes`,
        );
      }
      if (mode === 'red')
        check(
          (fs.readFileSync(path.join(root, result.generatedFiles[0]), 'utf8').match(/\.skip\(/g) ?? []).length === 4,
          `${runner} ${scenario} keeps the saved scaffold skipped`,
        );
    }
    const rejected = [
      ['expand-forged', 'expand', /counts\.final\.(executed|passed) disagrees with runner reports/],
      ['expand-unrelated', 'expand', /different generated bytes|does not identify one generated test leaf/],
      ['red-wrong-reason', 'red', /verified red requires every executed test to fail for its intended criterion/],
      ['red-raw-copy', 'red', /JSON cannot establish verified red/],
      ['red-in-place', 'red', /JSON cannot establish verified red/],
      ...(runner === 'vitest'
        ? [
            ['expand-raw', 'expand', /raw Vitest JSON cannot establish Vitest execution/],
            ['expand-unhandled', 'expand', /runner errors/],
          ]
        : [
            ['expand-no-location', 'expand', /lacks test locations/],
            ['red-retry-wrong-reason', 'red', /verified red requires every executed test to fail for its intended criterion/],
          ]),
    ];
    for (const [scenario, mode, error] of rejected) {
      const run = automate(fixture(runner, scenario), runner, scenario, mode);
      check(run.status === 3 && error.test(run.stderr), `${runner} ${scenario} cannot establish success: ${run.stderr.split('\n')[0]}`);
    }
  }
  const late = automate(fixture('jest', 'late-runner'), 'vitest', 'expand-late-runner', 'expand');
  check(
    late.status === 3 && /Vitest evidence does not match a test runner the project declares/.test(late.stderr),
    'runner detection happens before the agent runs, so a runner the agent adds is not accepted',
  );
  console.log(`\n${checks} AUTOMATE UNIT RUNNER checks passed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(scratch, { recursive: true, force: true }));
