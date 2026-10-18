'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { stripVTControlCharacters } = require('node:util');

// Runner identity comes from the project's own declarations, read before the
// agent runs. A report can claim any shape; it is accepted only for a runner
// the project declares.
const CONFIG_FILES = {
  playwright: [
    'playwright.config.ts',
    'playwright.config.mts',
    'playwright.config.cts',
    'playwright.config.js',
    'playwright.config.mjs',
    'playwright.config.cjs',
  ],
  vitest: [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.cts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ],
  jest: [
    'jest.config.ts',
    'jest.config.mts',
    'jest.config.cts',
    'jest.config.js',
    'jest.config.mjs',
    'jest.config.cjs',
    'jest.config.json',
  ],
};
const PACKAGES = { playwright: '@playwright/test', vitest: 'vitest', jest: 'jest' };
const UNIT_RUNNERS = ['vitest', 'jest'];
const UNIT_RED_KIND = 'tea-unit-red-check';
const UNIT_STATUSES = { passed: 'passed', failed: 'failed', skipped: 'skipped', pending: 'skipped', todo: 'skipped', disabled: 'skipped' };

function detectRunners(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  let pkg = {};
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (error) {
      throw new Error(`package.json is invalid JSON: ${error.message}`);
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must contain an object');
  }
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const runners = [];
  for (const runner of Object.keys(PACKAGES)) {
    // Vite's own config names Vitest only when the project declares Vitest.
    const candidates = CONFIG_FILES[runner].filter(
      (file) => !(runner === 'vitest' && file.startsWith('vite.') && !Object.hasOwn(declared, 'vitest')),
    );
    let configFile = candidates.find((file) => fs.existsSync(path.join(root, file))) ?? null;
    if (!configFile && runner === 'jest' && Object.hasOwn(pkg, 'jest')) configFile = 'package.json';
    if (configFile || Object.hasOwn(declared, PACKAGES[runner])) runners.push({ runner, configFile });
  }
  return runners;
}

function unitReportRunner(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report) || !Array.isArray(report.testResults)) return null;
  // Jest's aggregated result always carries these; Vitest's JSON reporter never does.
  return Object.hasOwn(report, 'numRuntimeErrorTestSuites') || Object.hasOwn(report, 'wasInterrupted') ? 'jest' : 'vitest';
}

const plain = (value) => stripVTControlCharacters(String(value ?? ''));

// One failed attempt: an assertion is the intended red reason; a timeout is a
// runner error like Playwright's timedOut; anything else is a wrong-reason failure.
function failureKind(message, detail) {
  const text = plain(message);
  if (/\bTest timed out in \d+ ?ms\b|\bExceeded timeout of \d+ ?ms\b/.test(text)) return 'timeout';
  if (detail?.matcherResult || /^(?:\w*AssertionError)\b/.test(text) || /(?:^|\n)(?:Error: )?expect\(/.test(text)) return 'assertion';
  return 'error';
}

function normalizeUnitReport(report) {
  const runner = unitReportRunner(report);
  if (!runner) throw new Error('execution report is not a Vitest or Jest JSON report');
  const label = runner === 'jest' ? 'Jest' : 'Vitest';
  const files = [];
  let errors = 0;
  let failedTests = 0;
  for (const result of report.testResults) {
    if (!result || typeof result !== 'object' || typeof result.name !== 'string' || !path.isAbsolute(result.name))
      throw new Error(`native ${label} result lacks an absolute test file path`);
    if (!Array.isArray(result.assertionResults)) throw new Error(`native ${label} result lacks assertion results: ${result.name}`);
    const message = plain(result.message).trim();
    // Vitest leaves message empty unless the file itself failed (load, hook or
    // collection error). Jest concatenates test failures there, so a Jest file
    // error is a failed file with no test results or its suite-failure banner.
    const fileError =
      runner === 'vitest'
        ? message || null
        : (result.status === 'failed' && result.assertionResults.length === 0) || /● Test suite failed to run/.test(message)
          ? message || 'test suite failed to run'
          : null;
    if (fileError) errors++;
    const tests = [];
    for (const assertion of result.assertionResults) {
      if (
        !assertion ||
        typeof assertion.title !== 'string' ||
        !Array.isArray(assertion.ancestorTitles) ||
        assertion.ancestorTitles.some((title) => typeof title !== 'string')
      )
        throw new Error(`native ${label} result has a malformed test identity: ${result.name}`);
      const status = UNIT_STATUSES[assertion.status];
      if (!status) throw new Error(`execution report has unsupported attempt status: ${assertion.status}`);
      const messages = Array.isArray(assertion.failureMessages) ? assertion.failureMessages.map(plain) : [];
      const details = Array.isArray(assertion.failureDetails) ? assertion.failureDetails : [];
      const attempts = [];
      if (runner === 'jest') {
        if (assertion.retryReasons !== undefined && !Array.isArray(assertion.retryReasons))
          throw new Error(`native Jest result has malformed retry reasons: ${result.name}`);
        for (const reason of assertion.retryReasons ?? []) attempts.push({ status: 'failed', failure: failureKind(reason) });
      }
      attempts.push({ status, failure: status === 'failed' ? failureKind(messages[0], details[0]) : null });
      if (status === 'failed') failedTests++;
      tests.push({
        titlePath: [...assertion.ancestorTitles, assertion.title],
        line: assertion.location?.line,
        column: assertion.location?.column,
        message: messages.join('\n') || null,
        attempts,
      });
    }
    files.push({ name: result.name, error: fileError, tests });
  }
  if (runner === 'jest') {
    const runtime = Number.isSafeInteger(report.numRuntimeErrorTestSuites) ? report.numRuntimeErrorTestSuites : 0;
    errors = Math.max(errors, runtime);
    if (report.wasInterrupted === true) errors++;
  }
  // A failed run with no failed test or file names an error outside every
  // test: an unhandled rejection, a coverage threshold, a global setup failure.
  if (report.success === false && failedTests === 0 && errors === 0) errors++;
  return { runner, files, errors };
}

module.exports = { CONFIG_FILES, UNIT_RUNNERS, UNIT_RED_KIND, detectRunners, unitReportRunner, normalizeUnitReport, failureKind };
