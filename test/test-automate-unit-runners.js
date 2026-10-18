'use strict';
// Native Vitest and Jest verification for tea-automate: runner detection, report
// parsing, source inventory and reconciliation, the unit red check, and the real
// CLI path with a controlled agent that runs each project's real runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { detectRunners, normalizeUnitReport, failureKind, unitReportRunner } = require('../cli/lib/unit-runners');
const { generatedInventory, reconcileInventory } = require('../cli/lib/automate-inventory');
const { reportCounts } = require('../cli/lib/automate-result');
const { generationRequest } = require('../cli/lib/automate-prompt');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'cli/automate.js');
const RED_CHECK = path.join(ROOT, 'cli/unit-red-check.js');
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
    'vitest.config.mjs': "export default { test: { include: ['tests/**/*.test.ts'] } };\n",
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

function fixture(runner, name) {
  const root = project(`${runner}-${name}`, PROJECTS[runner]);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  fs.mkdirSync(path.join(root, 'tests'));
  return root;
}

function nativeReport(runner, root, files, extra = []) {
  const output = path.join(root, 'native.json');
  const bin = runner === 'vitest' ? 'node_modules/vitest/vitest.mjs' : 'node_modules/jest/bin/jest.js';
  const args =
    runner === 'vitest'
      ? ['run', ...files, '--reporter=json', `--outputFile=${output}`, '--includeTaskLocation', ...extra]
      : ['--json', '--testLocationInResults', `--outputFile=${output}`, ...extra, '--runTestsByPath', ...files];
  spawnSync(process.execPath, [path.join(ROOT, bin), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return JSON.parse(fs.readFileSync(output, 'utf8'));
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
    { encoding: 'utf8', timeout: 180_000 },
  );
}

try {
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
  check(true, 'runner detection follows package.json declarations and config files only');

  // Failure classification decides intended red.
  assert.equal(failureKind('AssertionError: expected 4 to be 5'), 'assertion');
  assert.equal(failureKind('AssertionError [ERR_ASSERTION]: values differ'), 'assertion');
  assert.equal(failureKind('Error: expect(received).toBe(expected)'), 'assertion');
  assert.equal(failureKind('Error: boom', { matcherResult: { pass: false } }), 'assertion');
  assert.equal(failureKind('TypeError: price is not a function'), 'error');
  assert.equal(failureKind('Error: Test timed out in 5000ms.'), 'timeout');
  assert.equal(failureKind('thrown: "Exceeded timeout of 5000 ms for a test.'), 'timeout');
  check(true, 'unit failures separate assertions, timeouts and wrong-reason errors');

  // Real native reports from the repository's own runners.
  const parsing = {};
  for (const runner of ['vitest', 'jest']) {
    const root = fixture(runner, 'parse');
    const extension = runner === 'vitest' ? 'ts' : 'js';
    const header = runner === 'vitest' ? "import { describe, it, test, expect } from 'vitest';\n" : '';
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
    const normalized = normalizeUnitReport(report);
    const parsed = normalized.files.find((file) => file.name.endsWith(`parse.test.${extension}`));
    check(
      parsed.tests.map((test) => [test.titlePath.join(' > '), test.line, test.column].join(':')).join(',') ===
        [2, 3, 4, 5]
          .map(
            (line, index) =>
              `outer > ${['passes', 'asserts', 'throws', 'skipped'][index]}:${line + (header ? 1 : 0)}:${index === 3 ? 6 : 3}`,
          )
          .join(','),
      `${runner} identities retain suite path, line and column`,
    );
  }
  const parsed = (report) => report.testResults.find((file) => file.name.includes('parse.test'));
  const malformed = (runner, mutate) => {
    const report = structuredClone(parsing[runner].report);
    mutate(report);
    return () => reportCounts(report);
  };
  assert.throws(
    malformed('vitest', (report) => (parsed(report).name = 'tests/relative.test.ts')),
    /absolute test file path/,
  );
  assert.throws(
    malformed('vitest', (report) => (parsed(report).assertionResults[0].status = 'flaky')),
    /unsupported attempt status/,
  );
  assert.throws(
    malformed('jest', (report) => delete parsed(report).assertionResults),
    /lacks assertion results/,
  );
  assert.throws(
    malformed('jest', (report) => (parsed(report).assertionResults[0].ancestorTitles = [1])),
    /malformed test identity/,
  );
  check(true, 'malformed Vitest and Jest results are rejected');
  const retried = structuredClone(parsing.jest.report);
  const passing = retried.testResults.flatMap((file) => file.assertionResults).find((test) => test.status === 'passed');
  passing.retryReasons = ['Error: expect(received).toBe(expected)'];
  passing.invocations = 2;
  check(reportCounts(retried).executed === 4 && reportCounts(retried).failed === 3, 'Jest retries count every failed attempt');
  const unhandled = {
    success: false,
    numFailedTests: 0,
    testResults: [{ name: '/abs/x.test.ts', message: '', status: 'passed', assertionResults: [] }],
  };
  check(reportCounts(unhandled).errors === 1, 'a failed Vitest run with no failed test is a runner error');
  const interrupted = { ...structuredClone(parsing.jest.report), wasInterrupted: true };
  check(reportCounts(interrupted).errors === 2, 'an interrupted Jest run is a runner error');

  // Inventory grammar for Vitest and Jest sources.
  const inventoryOf = (source, runner = 'vitest', name = 'grammar') => {
    const root = project(`inventory-${name}`, { 'tests/a.test.ts': source });
    return generatedInventory(root, ['tests/a.test.ts'], { runner });
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
  const fixtureTest = inventoryOf(
    "import { test } from 'vitest';\nconst it2 = test.extend({ value: 1 });\nit2.skip('fixture', () => {});\n",
  ).tests[0];
  check(
    fixtureTest.line === 3 && fixtureTest.column === 5 && fixtureTest.activationLine === 3 && fixtureTest.activationColumn === 1,
    'skip leaves retain their activated identifier location',
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

  // Reconciliation binds every native result to one generated leaf in the consuming project.
  for (const runner of ['vitest', 'jest']) {
    const { root, extension } = parsing[runner];
    const file = `tests/rec.test.${extension}`;
    const header = runner === 'vitest' ? "import { describe, it, test, expect } from 'vitest';\n" : '';
    fs.writeFileSync(
      path.join(root, file),
      `${header}describe('rec', () => {\n  it('one', () => { expect(1).toBe(1); });\n});\ntest('two', () => {});\n`,
    );
    const report = nativeReport(runner, root, [file]);
    const inventory = generatedInventory(root, [file], { runner });
    const runners = detectRunners(root);
    const verified = reconcileInventory(inventory, [report], { mode: 'expand', runners });
    check(verified.executionScopes.length === 2, `${runner} native JSON reconciles every generated leaf`);
    const reject = (mutate, error, label, options = {}) => {
      const altered = structuredClone(report);
      mutate(altered);
      assert.throws(() => reconcileInventory(inventory, [altered], { mode: 'expand', runners, ...options }), error, label);
      check(true, `${runner} ${label}`);
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
      runners: [{ runner: runner === 'vitest' ? 'jest' : 'vitest', configFile: null }],
    });
    assert.throws(
      () => reconcileInventory({ ...inventory, runner: runner === 'vitest' ? 'jest' : 'vitest' }, [report], { mode: 'expand', runners }),
      /inventory was not derived/,
    );
    assert.throws(
      () => reconcileInventory(inventory, [report, { suites: [], config: {} }], { mode: 'expand', runners }),
      /mixes incompatible runner scope identities/,
    );
    check(true, `${runner} evidence cannot mix runner families or grammars`);
  }

  // The unit red check: disposable activation, per-file isolation, permanent scaffold bytes.
  for (const runner of ['vitest', 'jest']) {
    const root = fixture(runner, 'red-check');
    const extension = runner === 'vitest' ? 'ts' : 'js';
    const header = runner === 'vitest' ? "import { describe, it, test, expect } from 'vitest';\n" : '';
    const scaffold = `tests/red.test.${extension}`;
    const source = `${header}describe('red', () => {\n  it.skip('AC-1 discount', () => { expect(2 * 50).toBe(90); });\n  // test.skip('commented', () => {}) stays text\n});\ntest.skip('AC-2 wrong reason', () => { throw new TypeError('not wired'); });\n`;
    fs.writeFileSync(path.join(root, scaffold), source);
    fs.writeFileSync(
      path.join(root, `tests/load.test.${extension}`),
      `${header}import './missing-module';\ntest.skip('never', () => {});\n`,
    );
    const reportPath = path.join(root, 'red.json');
    const run = spawnSync(
      process.execPath,
      [RED_CHECK, '--project-root', root, '--report', reportPath, '--file', scaffold, '--file', `tests/load.test.${extension}`],
      { encoding: 'utf8', timeout: 120_000 },
    );
    check(run.status === 0, `${runner} red check writes a report: ${run.stderr}`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const [scaffoldResult, loadResult] = report.files;
    check(fs.readFileSync(path.join(root, scaffold), 'utf8') === source, `${runner} red check leaves the permanent scaffold bytes skipped`);
    check(
      report.runner === runner &&
        report.configFile === (runner === 'vitest' ? 'vitest.config.mjs' : 'package.json') &&
        report.projectRoot === root &&
        report.productionFilesTouched.length === 0,
      `${runner} red check records the detected runner, config and consuming root`,
    );
    check(
      scaffoldResult.activated === 2 &&
        scaffoldResult.tests
          .map((test) => `${test.titlePath.at(-1)}:${test.status}:${test.failure}@${test.line}:${test.column}`)
          .join(',') ===
          `AC-1 discount:failed:assertion@${runner === 'vitest' ? 3 : 2}:3,AC-2 wrong reason:failed:error@${runner === 'vitest' ? 6 : 5}:1`,
      `${runner} red check activates only generated leaves and classifies each failure`,
    );
    check(loadResult.loadError && loadResult.tests.length === 0, `${runner} red check isolates a file load failure`);
    check(
      scaffoldResult.tests.every((test) => !/\n\s+at /.test(test.message) && !test.message.includes('tea-unit-red-check-')),
      `${runner} red check keeps failure messages free of disposable-copy stack frames`,
    );
    const counts = reportCounts(report);
    check(counts.failed === 2 && counts.assertionFailures === 1 && counts.errors === 1, `${runner} red check counts feed the red verdict`);
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
    const verified = reconcileInventory(inventory, [scaffoldReport], { mode: 'red', runners });
    check(verified.executionScopes.length === 2, `${runner} red check reconciles activated leaves to their scaffolds`);
    const reject = (mutate, error, label) => {
      const altered = structuredClone(scaffoldReport);
      mutate(altered);
      assert.throws(() => reconcileInventory(inventory, [altered], { mode: 'red', runners }), error, label);
      check(true, `${runner} red check ${label}`);
    };
    reject((altered) => (altered.files[0].sha256 = '0'.repeat(64)), /different scaffold bytes/, 'rejects other scaffold bytes');
    reject((altered) => (altered.configFile = 'other.config.js'), /different .* configuration/, 'rejects another runner configuration');
    reject((altered) => (altered.projectRoot = path.dirname(root)), /different consuming project root/, 'rejects another project root');
    reject((altered) => altered.files[0].tests.pop(), /omits generated test\/project scope/, 'rejects an omitted scaffold');
    const activeFile = `tests/active.test.${extension}`;
    fs.writeFileSync(path.join(root, activeFile), `${header}test('active', () => { expect(1).toBe(2); });\n`);
    const activeInventory = generatedInventory(root, [activeFile], { runner });
    const [leaf] = activeInventory.tests;
    const forged = {
      ...report,
      files: [
        {
          file: activeFile,
          sha256: activeInventory.files[0].sha256,
          tests: [{ titlePath: leaf.titlePath, line: leaf.line, column: leaf.column, status: 'failed', failure: 'assertion' }],
        },
      ],
    };
    assert.throws(() => reconcileInventory(activeInventory, [forged], { mode: 'red', runners }), /not a skipped scaffold/);
    check(true, `${runner} red evidence cannot verify an active generated test`);
    const mutating = `tests/mutate.test.${extension}`;
    fs.writeFileSync(
      path.join(root, mutating),
      `${header}${runner === 'vitest' ? "import fs from 'node:fs';\n" : "const fs = require('node:fs');\n"}test.skip('mutates product', () => { fs.writeFileSync('src/price.${extension}', ''); expect(1).toBe(2); });\n`,
    );
    spawnSync(process.execPath, [RED_CHECK, '--project-root', root, '--report', reportPath, '--file', mutating], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    const mutated = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    check(
      mutated.productionFilesTouched.includes(`src/price.${extension}`) &&
        reportCounts(mutated).errors === 1 &&
        fs.readFileSync(path.join(root, `src/price.${extension}`), 'utf8') === PROJECTS[runner][`src/price.${extension}`],
      `${runner} red check reports a product change made in the copy and leaves the project unchanged`,
    );
    const active = spawnSync(process.execPath, [RED_CHECK, '--project-root', root, '--report', reportPath, '--file', activeFile], {
      encoding: 'utf8',
    });
    check(
      active.status === 2 && /must register every generated leaf with \.skip/.test(active.stderr),
      `${runner} red check refuses an active scaffold`,
    );
    for (const args of [
      [],
      ['--file', '../outside.test.js'],
      ['--file', scaffold, '--file', scaffold],
      ['--file', scaffold, '--runner', 'mocha'],
    ])
      check(
        spawnSync(process.execPath, [RED_CHECK, '--project-root', root, '--report', reportPath, ...args], { encoding: 'utf8' }).status ===
          2,
        `${runner} red check usage error exits 2: ${args.join(' ') || 'no files'}`,
      );
  }
  const both = project('red-both', {
    'package.json': '{"devDependencies":{"vitest":"*","jest":"*"}}',
    'tests/a.test.js': "test.skip('a', () => {});\n",
  });
  const ambiguous = spawnSync(
    process.execPath,
    [RED_CHECK, '--project-root', both, '--report', path.join(both, 'r.json'), '--file', 'tests/a.test.js'],
    {
      encoding: 'utf8',
    },
  );
  check(
    ambiguous.status === 2 && /declares both Vitest and Jest/.test(ambiguous.stderr),
    'red check refuses to guess between declared runners',
  );

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
  const expandPrompt = prompt('expand', [
    { runner: 'vitest', configFile: 'vitest.config.ts' },
    { runner: 'jest', configFile: null },
  ]);
  check(
    expandPrompt.includes('vitest (vitest.config.ts), jest (declared dependency, default config)') &&
      expandPrompt.includes('--includeTaskLocation') &&
      expandPrompt.includes('--testLocationInResults') &&
      expandPrompt.includes('Vitest JSON, Jest JSON'),
    'expand prompt names detected runners and their native JSON commands',
  );
  const redPrompt = prompt('red', [{ runner: 'jest', configFile: 'package.json' }]);
  check(
    redPrompt.includes(JSON.stringify(RED_CHECK)) &&
      redPrompt.includes('--project-root "/p"') &&
      !redPrompt.includes('--includeTaskLocation'),
    'red prompt directs Vitest and Jest scaffolds to the unit red check',
  );
  check(!prompt('expand', []).includes('For Vitest expand'), 'prompt adds no unit runner commands when none is detected');

  // The real CLI path: a controlled agent runs each project's real runner.
  for (const runner of ['vitest', 'jest']) {
    const outcomes = [
      ['expand-passed', 'expand', 0, 'passed'],
      ['expand-failed', 'expand', 1, 'failed'],
      ['red-verified', 'red', 0, 'verified red'],
    ];
    for (const [scenario, mode, exit, status] of outcomes) {
      const root = fixture(runner, scenario);
      const run = automate(root, runner, scenario, mode);
      check(run.status === exit, `${runner} ${scenario} exits ${exit}: ${run.stderr}`);
      const result = JSON.parse(run.stdout);
      check(result.executionStatus === status, `${runner} ${scenario} reports ${status}`);
      if (exit === 0) {
        const scopes = JSON.parse(fs.readFileSync(path.join(result.evidenceDir, 'attempt-1/validated-test-scopes.json'), 'utf8'));
        check(
          scopes.runner === runner &&
            scopes.executionScopes.length === 2 &&
            scopes.executionScopes.every(({ identity }) => identity[4] === runner),
          `${runner} ${scenario} retains reconciled ${runner} scopes`,
        );
      }
      if (mode === 'red')
        check(
          /it\.skip\(/.test(fs.readFileSync(path.join(root, result.generatedFiles[0]), 'utf8')),
          `${runner} ${scenario} keeps the saved scaffold skipped`,
        );
    }
    for (const [scenario, mode, error] of [
      ['expand-forged', 'expand', /counts\.final\.(executed|passed) disagrees with runner reports/],
      ['expand-unrelated', 'expand', /does not identify one generated test leaf/],
      ['expand-no-location', 'expand', /lacks test locations/],
      ['red-wrong-reason', 'red', /verified red requires every executed test to fail for its intended criterion/],
      ['red-raw-copy', 'red', /different consuming project root/],
    ]) {
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
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
