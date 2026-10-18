#!/usr/bin/env node
/**
 * tea-unit-red-check: the Vitest and Jest counterpart of tea-atdd-red-check.
 *
 * It proves a red scaffold fails for its intended reason while the permanent
 * scaffold stays skipped:
 *
 *   the consuming project with generated `test.skip()` / `it.skip()` leaves
 *     -> a disposable copy of the project (node_modules linked, never copied)
 *     -> in the copy only, each generated leaf's `.skip` member is removed at
 *        the location the source inventory derived, so no unrelated skip moves
 *     -> each file runs alone under the project's installed runner and its own
 *        config, so one file's load failure never masks another file's result
 *     -> one JSON report, bound to the permanent scaffold bytes by SHA-256
 *
 * The runner is detected from the project's package.json and config files.
 * `--runner` only chooses between runners the project already declares.
 *
 * Usage:
 *   tea-unit-red-check --project-root <dir> --report <path> --file <path> [--file <path>]
 *     [--runner vitest|jest] [--per-file-timeout-ms 120000] [--work-dir <dir>]
 *
 * Exit codes:
 *   0  every file ran to some conclusion and the report was written
 *   2  a usage error, or the run could not be set up
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Command } = require('commander');
const { filesUnder, snapshotFile } = require('./atdd-red-check');
const { generatedInventory } = require('./lib/automate-inventory');
const { UNIT_RED_KIND, UNIT_RUNNERS, detectRunners, normalizeUnitReport } = require('./lib/unit-runners');

const NAME = 'tea-unit-red-check';
// Directories the copy never carries: dependency trees are linked in place and
// TeA's own output holds evidence, never product or test source.
const COPY_EXCLUDED = new Set(['node_modules', '.git', '_bmad-output']);

function fail(message) {
  process.stderr.write(`${NAME}: ${message}\n`);
  process.exit(2);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function insideProject(root, value, label) {
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    fail(`${label} must name a file inside the project: ${value}`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`${label} does not exist: ${value}`);
  const real = path.relative(root, fs.realpathSync(absolute));
  if (real === '..' || real.startsWith(`..${path.sep}`) || path.isAbsolute(real)) fail(`${label} resolves outside the project: ${value}`);
  return real.split(path.sep).join('/');
}

/** The project's own installed runner, found the way Node resolves a dependency from the project root. */
function runnerEntry(root, runner) {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, 'node_modules', runner, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[runner];
      if (!bin) fail(`${runner} at ${manifest} declares no ${runner} executable`);
      const entry = path.join(path.dirname(manifest), bin);
      if (!fs.existsSync(entry)) fail(`${runner} declares its executable at ${entry}, which does not exist`);
      return { entry, version: pkg.version };
    }
    if (path.dirname(directory) === directory) fail(`the project's ${runner} is not installed; run its package install first`);
  }
}

/** Copy the project without dependency trees, then link each one so the copy resolves the project's own packages. */
function disposableCopy(root, copyRoot) {
  const links = [];
  fs.cpSync(root, copyRoot, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (source) => {
      const name = path.basename(source);
      if (source === root || !COPY_EXCLUDED.has(name)) return true;
      if (name === 'node_modules') links.push(path.relative(root, source));
      return false;
    },
  });
  for (const relative of links) {
    const target = path.join(copyRoot, relative);
    if (fs.existsSync(path.dirname(target))) fs.symlinkSync(path.join(root, relative), target, 'junction');
  }
}

function runnerArguments(runner, entry, file, output) {
  return runner === 'vitest'
    ? [entry, 'run', file, '--reporter=json', `--outputFile=${output}`, '--includeTaskLocation', '--coverage.enabled=false']
    : [
        entry,
        '--json',
        '--testLocationInResults',
        `--outputFile=${output}`,
        '--ci',
        '--coverage=false',
        '--no-watchman',
        '--runTestsByPath',
        file,
      ];
}

function runFile({ runner, entry, copyRoot, file, output, timeoutMs }) {
  const absolute = path.join(copyRoot, file);
  const result = spawnSync(process.execPath, runnerArguments(runner, entry, absolute, output), {
    cwd: copyRoot,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  const loadError = (message) => ({ loadError: message, tests: [] });
  if (!fs.existsSync(output)) {
    const tail = String(result.stderr || result.stdout || '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-6)
      .join(' | ');
    return loadError(
      result.error
        ? `spawn failed: ${result.error.message}`
        : result.signal
          ? `killed by ${result.signal}${result.signal === 'SIGTERM' && result.status === null ? ' (timed out)' : ''}`
          : `no JSON report was written (exit ${result.status}); ${tail || 'nothing on stderr'}`,
    );
  }
  let normalized;
  try {
    normalized = normalizeUnitReport(JSON.parse(fs.readFileSync(output, 'utf8')));
  } catch (error) {
    return loadError(`the runner report could not be read: ${error.message}`);
  }
  const target = fs.realpathSync(absolute);
  const own = normalized.files.find((entry) => fs.existsSync(entry.name) && fs.realpathSync(entry.name) === target);
  if (!own) return loadError(`the runner report has no result for ${file}`);
  if (own.error) return loadError(own.error.split('\n').slice(0, 6).join(' | '));
  return {
    loadError: null,
    tests: own.tests.map((test) => {
      const last = test.attempts.at(-1);
      // Stack frames name the disposable copy; the message itself is the evidence.
      const message = test.message?.replaceAll(/^\s+at .*$\n?/gm, '').trim() || null;
      return { titlePath: test.titlePath, line: test.line, column: test.column, status: last.status, failure: last.failure, message };
    }),
  };
}

function main(argv) {
  const program = new Command();
  program
    .name(NAME)
    .description('Activate generated Vitest or Jest red scaffolds in a disposable copy, execute them, and report what happened.')
    .requiredOption('--project-root <dir>', 'the consuming project whose generated scaffolds stay skipped')
    .requiredOption('--report <path>', 'where to write the JSON report')
    .option('--file <path>', 'generated scaffold file inside the project (repeatable)', (value, previous) => [...previous, value], [])
    .option('--runner <name>', 'vitest or jest; only needed when the project declares both')
    .option('--per-file-timeout-ms <n>', 'wall-clock bound per file', String(120_000))
    .option('--work-dir <dir>', 'parent directory for the disposable copy', os.tmpdir());
  program.exitOverride();
  try {
    program.parse(argv);
  } catch (error) {
    if (error.exitCode === 0) return;
    fail(error.message);
  }
  const options = program.opts();
  if (!fs.existsSync(options.projectRoot) || !fs.statSync(options.projectRoot).isDirectory())
    fail(`--project-root ${options.projectRoot} is not a directory`);
  const root = fs.realpathSync(options.projectRoot);
  const timeoutMs = Number.parseInt(options.perFileTimeoutMs, 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || String(timeoutMs) !== options.perFileTimeoutMs)
    fail('--per-file-timeout-ms must be a positive integer');
  if (options.file.length === 0) fail('name at least one generated scaffold with --file');
  const files = options.file.map((file) => insideProject(root, file, '--file'));
  if (new Set(files).size !== files.length) fail('--file names the same scaffold twice');

  let detected;
  try {
    detected = detectRunners(root).filter(({ runner }) => UNIT_RUNNERS.includes(runner));
  } catch (error) {
    fail(error.message);
  }
  if (options.runner !== undefined && !UNIT_RUNNERS.includes(options.runner)) fail('--runner must be vitest or jest');
  const candidates = options.runner ? detected.filter(({ runner }) => runner === options.runner) : detected;
  if (candidates.length === 0)
    fail(options.runner ? `the project does not declare ${options.runner}` : 'the project declares neither Vitest nor Jest');
  if (candidates.length > 1) fail('the project declares both Vitest and Jest; pass --runner to choose one');
  const [{ runner, configFile }] = candidates;
  const { entry, version } = runnerEntry(root, runner);

  const activations = [];
  let inventory;
  try {
    inventory = generatedInventory(root, files, { runner, activations });
  } catch (error) {
    fail(error.message);
  }
  const active = inventory.tests.filter((leaf) => leaf.activationLine === undefined);
  if (active.length > 0)
    fail(
      `red scaffolds must register every generated leaf with .skip: ${active.map((leaf) => `${leaf.file} ${leaf.titlePath.join(' > ')}`).join('; ')}`,
    );

  const reportPath = path.resolve(options.report);
  const workDir = fs.realpathSync(options.workDir);
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(workDir, `${NAME}-`)));
  const copyRoot = path.join(scratch, 'project');
  const outputs = path.join(scratch, 'reports');
  const before = new Map(files.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))]));
  let results;
  let productionFilesTouched;
  try {
    disposableCopy(root, copyRoot);
    fs.mkdirSync(outputs);
    for (const file of files) {
      const copied = path.join(copyRoot, file);
      let text = fs.readFileSync(copied, 'utf8');
      const edits = activations.filter((edit) => edit.file === file).sort((left, right) => right.start - left.start);
      for (const { start, end } of edits) text = `${text.slice(0, start)}${text.slice(end)}`;
      fs.writeFileSync(copied, text);
    }
    const snapshot = () =>
      new Map(
        filesUnder(copyRoot).map((relative) => {
          try {
            return [relative, snapshotFile(path.join(copyRoot, relative))];
          } catch {
            return [relative, null];
          }
        }),
      );
    const baseline = snapshot();
    results = files.map((file, index) => ({
      file,
      sha256: before.get(file),
      activated: activations.filter((edit) => edit.file === file).length,
      ...runFile({ runner, entry, copyRoot, file, output: path.join(outputs, `${index}.json`), timeoutMs }),
    }));
    const after = snapshot();
    productionFilesTouched = [...new Set([...baseline.keys(), ...after.keys()])]
      .filter((relative) => baseline.get(relative) !== after.get(relative))
      .map((relative) => relative.split(path.sep).join('/'));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  // The permanent scaffolds are never written; a changed one is reported as touched.
  for (const file of files) if (sha256(fs.readFileSync(path.join(root, file))) !== before.get(file)) productionFilesTouched.push(file);
  productionFilesTouched = [...new Set(productionFilesTouched)].sort();

  const report = {
    schemaVersion: 1,
    kind: UNIT_RED_KIND,
    runner,
    runnerVersion: version,
    configFile,
    projectRoot: root,
    productionFilesTouched,
    files: results,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${reportPath}.\n`);
}

if (require.main === module) main(process.argv);

module.exports = { main, runnerArguments };
