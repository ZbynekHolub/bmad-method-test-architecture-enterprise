#!/usr/bin/env node
/**
 * tea-unit-check: runs generated Vitest or Jest tests under the project's own
 * runner and writes the execution evidence tea-automate verifies.
 *
 * Expand mode runs each generated file in the project. Red mode proves a red
 * scaffold fails for its intended reason while the permanent scaffold stays
 * skipped:
 *
 *   the consuming project with generated `test.skip()` / `it.skip()` leaves
 *     -> a disposable copy of the project, or of the whole workspace for a
 *        workspace package (node_modules linked, never copied)
 *     -> in the copy only, each generated leaf's `.skip` is blanked to spaces at
 *        the location the source inventory derived, so no unrelated skip moves
 *        and no other registration changes column
 *     -> one JSON report, bound to the permanent scaffold bytes by SHA-256
 *
 * Each file runs alone, so one file's load failure never masks another file's
 * result. The runner writes its native JSON report; this command adds what that
 * report cannot carry: Vitest's JSON reporter omits unhandled errors, so the
 * process exit code and Vitest's unhandled-error banner are recorded beside it.
 *
 * The runner is detected from the project's package.json and config files.
 * `--runner` only chooses between runners the project already declares.
 *
 * Usage:
 *   tea-unit-check --mode expand|red --project-root <dir> --report <path> --file <path> [--file <path>]
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
const { spawn, spawnSync } = require('node:child_process');
const { Command } = require('commander');
const { generatedInventory } = require('./lib/automate-inventory');
const {
  UNIT_CHECK_KIND,
  UNIT_RUNNERS,
  detectRunners,
  isWorkspaceRoot,
  normalizeUnitReport,
  workspaceAncestors,
} = require('./lib/unit-runners');

const NAME = 'tea-unit-check';
// Directories the copy never carries: dependency trees are linked in place and
// TeA's own output holds evidence, never product or test source.
const COPY_EXCLUDED = new Set(['node_modules', '.git', '_bmad-output']);
// Directories the integrity digest skips: dependencies, VCS state, evidence and
// runner output that a test run writes by design.
const DIGEST_EXCLUDED = new Set(['node_modules', '.git', '_bmad-output', 'test-results', '.cache', 'coverage', '__snapshots__']);
// Records each Vitest test's actual retry and repeat counts, which its JSON omits.
const ATTEMPTS_REPORTER = path.join(__dirname, 'lib', 'vitest-attempts-reporter.mjs');
// Vitest's default reporter prints this banner when it caught unhandled errors; its JSON report omits them.
const VITEST_UNHANDLED = /Vitest caught \d+ unhandled errors? during the test run/;

class SetupError extends Error {}

// The running runner and the disposable copy, so an interrupted check removes both.
const active = { child: null, scratch: null };

// The whole process group, even after its leader exited: a descendant that
// still holds the output pipes would otherwise keep the run open.
function killGroup(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode === null && child.signalCode === null)
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // the group is already gone
  }
}

function cleanUpOnSignals() {
  for (const [signal, number] of Object.entries({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }))
    process.on(signal, () => {
      killGroup(active.child);
      if (active.scratch) fs.rmSync(active.scratch, { recursive: true, force: true });
      process.exit(128 + number);
    });
}

function fail(message) {
  process.stderr.write(`${NAME}: ${message}\n`);
  process.exit(2);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const real = (value) => fs.realpathSync.native(value);
const inside = (base, absolute) => {
  const relative = path.relative(base, absolute);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

function projectFile(root, value) {
  const absolute = path.resolve(root, value);
  if (absolute === root || !inside(root, absolute)) throw new SetupError(`--file must name a file inside the project: ${value}`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new SetupError(`--file does not exist: ${value}`);
  const resolved = real(absolute);
  if (!inside(root, resolved)) throw new SetupError(`--file resolves outside the project: ${value}`);
  return slash(path.relative(root, resolved));
}

/** The project's own installed runner, found where Node resolves it from the project or its workspace. */
function runnerEntry(root, runner) {
  for (const directory of [root, ...workspaceAncestors(root)]) {
    const manifest = path.join(directory, 'node_modules', runner, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[runner];
    if (!bin) throw new SetupError(`${runner} at ${manifest} declares no ${runner} executable`);
    const entry = path.join(path.dirname(manifest), bin);
    if (!fs.existsSync(entry)) throw new SetupError(`${runner} declares its executable at ${entry}, which does not exist`);
    return { entry, version: pkg.version };
  }
  throw new SetupError(`the project's ${runner} is not installed; run its package install first`);
}

/** Content, permission and link-target digest of every file under `root`, so any write, chmod or relink shows. */
function digestTree(root, skip = new Set()) {
  const digest = new Map();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = slash(path.relative(root, absolute));
      if (skip.has(absolute)) continue;
      if (entry.isDirectory()) {
        if (!DIGEST_EXCLUDED.has(entry.name)) walk(absolute);
      } else if (entry.isSymbolicLink()) digest.set(relative, `link:${fs.readlinkSync(absolute)}`);
      else if (entry.isFile())
        digest.set(relative, `${(fs.statSync(absolute).mode & 0o777).toString(8)}:${sha256(fs.readFileSync(absolute))}`);
    }
  };
  walk(root);
  return digest;
}

const changed = (before, after) => [...new Set([...before.keys(), ...after.keys()])].filter((key) => before.get(key) !== after.get(key));

/**
 * What the red copy carries. `base` is the outermost ancestor kept for relative
 * paths: the workspace or repository root. `top` is the tree copied whole: the
 * workspace for a workspace package, otherwise the project alone, so a project
 * in a repository subfolder never copies or digests the rest of the repository.
 * `linked` lists what the project's own symlinks reach elsewhere under `base`:
 * those targets are copied and digested too, so no write through a link can
 * reach the permanent repository unseen.
 */
function copyScope(root) {
  const ancestors = workspaceAncestors(root);
  const base = ancestors.at(-1) ?? root;
  const top = base !== root && isWorkspaceRoot(base) ? base : root;
  const linked = new Set();
  const scan = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (COPY_EXCLUDED.has(entry.name)) continue;
      if (entry.isSymbolicLink()) {
        let pointed;
        try {
          pointed = real(absolute);
        } catch {
          continue;
        }
        if (inside(base, pointed) && !inside(top, pointed) && ![...linked].some((item) => inside(item, pointed))) {
          linked.add(pointed);
          if (fs.statSync(pointed).isDirectory()) scan(pointed);
        }
      } else if (entry.isDirectory()) scan(absolute);
    }
  };
  scan(top);
  return { ancestors, base, top, linked: [...linked] };
}

/** Digest every root of the scope, keyed by path relative to the project root. */
function digestScope(root, roots, locate = (item) => item, skip = new Set()) {
  const digest = new Map();
  for (const item of roots) {
    const located = locate(item);
    if (!fs.existsSync(located)) continue;
    if (fs.statSync(located).isDirectory()) {
      for (const [relative, value] of digestTree(located, skip)) digest.set(slash(path.relative(root, path.join(item, relative))), value);
    } else
      digest.set(
        slash(path.relative(root, item)),
        `${(fs.statSync(located).mode & 0o777).toString(8)}:${sha256(fs.readFileSync(located))}`,
      );
  }
  return digest;
}

/**
 * Copy the project without dependency trees and link each one so the copy
 * resolves the project's own packages. A workspace package is copied with its
 * whole workspace, so hoisted dependencies, sibling packages and relative
 * `extends` resolve as they do in place, and a test writing into a sibling
 * package writes into the copy. A project inside a plain repository keeps its
 * ancestors' own files and dependency links above it, and the targets of its
 * symlinks into the rest of the repository.
 */
function disposableCopy(root, scratch, { ancestors, base, top, linked }) {
  const mirror = path.join(scratch, 'workspace');
  const mirrorOf = (absolute) => path.join(mirror, path.relative(base, absolute));
  for (const ancestor of ancestors.filter((directory) => !inside(top, directory))) {
    fs.mkdirSync(mirrorOf(ancestor), { recursive: true });
    for (const entry of fs.readdirSync(ancestor, { withFileTypes: true })) {
      const source = path.join(ancestor, entry.name);
      if (entry.name === 'node_modules') fs.symlinkSync(real(source), mirrorOf(source), 'junction');
      else if (entry.isFile()) fs.copyFileSync(source, mirrorOf(source));
    }
  }
  const links = [];
  const copyFile = (from, to) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    fs.chmodSync(to, fs.statSync(from).mode & 0o7777);
  };
  // A hand-rolled walk: fs.cpSync refuses any copy whose destination lies inside
  // its source, which a work directory inside the project makes true.
  const copy = (source, target) => {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const from = path.join(source, entry.name);
      const to = path.join(target, entry.name);
      if (from === scratch || inside(scratch, from)) continue;
      if (COPY_EXCLUDED.has(entry.name)) {
        if (entry.name === 'node_modules') links.push(from);
      } else if (entry.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
      else if (entry.isDirectory()) copy(from, to);
      else if (entry.isFile()) copyFile(from, to);
    }
  };
  const roots = [top, ...linked];
  for (const item of roots) {
    if (fs.statSync(item).isDirectory()) copy(item, mirrorOf(item));
    else copyFile(item, mirrorOf(item));
  }
  // A link that reaches back into the copied scope must reach the copy instead,
  // or a test writing through it would change the permanent project.
  const rebase = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) rebase(absolute);
      else if (entry.isSymbolicLink()) {
        const original = path.join(base, path.relative(mirror, absolute));
        let pointed;
        try {
          pointed = real(original);
        } catch {
          pointed = path.resolve(path.dirname(original), fs.readlinkSync(absolute));
        }
        if (roots.some((item) => item === pointed || inside(item, pointed))) {
          fs.unlinkSync(absolute);
          fs.symlinkSync(mirrorOf(pointed), absolute);
        }
      }
    }
  };
  for (const item of roots) if (fs.statSync(item).isDirectory()) rebase(mirrorOf(item));
  for (const from of links) {
    const target = mirrorOf(from);
    if (fs.existsSync(path.dirname(target))) fs.symlinkSync(real(from), target, 'junction');
  }
  return { copyRoot: mirrorOf(root), mirrorOf, roots };
}

function runnerArguments(runner, entry, file, output) {
  const attempts = `--reporter=${ATTEMPTS_REPORTER}`;
  return runner === 'vitest'
    ? // The default reporter prints the unhandled-error banner the JSON reporter omits.
      [
        entry,
        'run',
        file,
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${output}`,
        attempts,
        '--includeTaskLocation',
        '--coverage.enabled=false',
        // One attempt per test, so every failure message belongs to that attempt.
        '--retry=0',
      ]
    : [
        entry,
        '--json',
        '--testLocationInResults',
        `--outputFile=${output}`,
        '--ci',
        // The exit code then means what the evidence check expects, whatever the project configures.
        '--testFailureExitCode=1',
        '--coverage=false',
        '--no-watchman',
        '--runTestsByPath',
        file,
      ];
}

/**
 * Run the runner as the leader of its own process group, so a timeout kills
 * its worker processes too: a hung test file must not leave a busy worker behind.
 */
function execute(args, { cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const streams = { stdout: '', stderr: '' };
    // Retained output is capped, so the unhandled-error banner is matched as it
    // streams, across chunk boundaries, and can never fall past the cap.
    let unhandled = false;
    const carry = { stdout: '', stderr: '' };
    for (const name of ['stdout', 'stderr']) {
      child[name].setEncoding('utf8');
      child[name].on('data', (chunk) => {
        const window = carry[name] + chunk;
        if (VITEST_UNHANDLED.test(window)) unhandled = true;
        carry[name] = window.slice(-256);
        if (streams[name].length < 4 * 1024 * 1024) streams[name] += chunk;
      });
    }
    let timedOut = false;
    active.child = child;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child);
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ status: null, signal: null, error, timedOut, unhandled, ...streams });
    });
    // Leftover group members after the runner exits are this run's own processes.
    child.once('exit', () => killGroup(child));
    child.once('close', (status, signal) => {
      clearTimeout(timer);
      active.child = null;
      resolve({ status, signal, error: null, timedOut, unhandled, ...streams });
    });
  });
}

async function runFile({ runner, entry, cwd, file, output, timeoutMs }) {
  const absolute = path.join(cwd, file);
  const attemptsFile = `${output}.attempts.json`;
  const result = await execute(runnerArguments(runner, entry, absolute, output), {
    cwd,
    timeoutMs,
    env: { TEA_UNIT_CHECK_ATTEMPTS: attemptsFile },
  });
  const exitCode = result.status;
  const outcome = (loadError, runError = null, tests = []) => ({ exitCode, loadError, runError, tests });
  const tail = String(result.stderr || result.stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-6)
    .join(' | ');
  if (result.timedOut) return outcome(`timed out after ${timeoutMs}ms; the runner and its workers were killed`);
  if (result.signal) return outcome(`the runner was killed by ${result.signal}`);
  if (result.error) return outcome(`spawn failed: ${result.error.message}`);
  if (!fs.existsSync(output)) return outcome(`no JSON report was written (exit ${exitCode}); ${tail || 'nothing on stderr'}`);
  let normalized;
  try {
    normalized = normalizeUnitReport(JSON.parse(fs.readFileSync(output, 'utf8')));
  } catch (error) {
    return outcome(`the runner report could not be read: ${error.message}`);
  }
  const target = real(absolute);
  const own = normalized.files.filter((item) => fs.existsSync(item.name) && real(item.name) === target);
  if (own.length === 0) return outcome(`the runner report has no result for ${file} (exit ${exitCode}); ${tail || 'nothing on stderr'}`);
  const fileErrors = own.filter((item) => item.error);
  if (fileErrors.length > 0)
    return outcome(
      fileErrors
        .map((item) => item.error)
        .join('\n')
        .split('\n')
        .slice(0, 6)
        .join(' | '),
    );
  // Stack frames name the disposable copy; the message itself is the evidence.
  const tests = own.flatMap((item) =>
    item.tests.map((test) => {
      const last = test.attempts.at(-1);
      const message = test.message?.replaceAll(/^\s+at .*$\n?/gm, '').trim() || null;
      return {
        titlePath: test.titlePath,
        line: test.line,
        column: test.column,
        status: last.status,
        failure: last.failure,
        attempts: test.attempts,
        message,
      };
    }),
  );
  const failed = tests.some((test) => test.status === 'failed');
  const unhandled = runner === 'vitest' && result.unhandled;
  // Vitest's JSON keeps one result per test; a retry or repeat, from any config, must not hide behind it.
  let repeated = null;
  if (runner === 'vitest') {
    let diagnostics = null;
    try {
      diagnostics = JSON.parse(fs.readFileSync(attemptsFile, 'utf8'));
    } catch {
      repeated = 'Vitest wrote no attempt diagnostics, so its retries and repeats cannot be ruled out';
    }
    const extra = (diagnostics ?? []).filter(
      (item) =>
        item.moduleId &&
        fs.existsSync(item.moduleId) &&
        real(item.moduleId) === target &&
        (item.retryCount !== 0 || item.repeatCount !== 0),
    );
    if (extra.length > 0)
      repeated = `Vitest retried or repeated ${extra.map((item) => item.fullName).join(', ')}; one attempt per generated test is required`;
  }
  const runError =
    repeated ??
    (own.length > 1
      ? `${file} ran in ${own.length} runner projects; one result per generated test is required`
      : unhandled
        ? 'Vitest caught unhandled errors during the run; its JSON report omits them'
        : normalized.errors > 0
          ? `the runner reported ${normalized.errors} run-level error(s)`
          : exitCode !== 0 && !failed
            ? `the runner exited ${exitCode} with no failed test`
            : null);
  return outcome(null, runError, tests);
}

async function main(argv) {
  const program = new Command();
  program
    .name(NAME)
    .description('Run generated Vitest or Jest tests, red scaffolds in a disposable activated copy, and report what happened.')
    .requiredOption('--mode <mode>', 'expand runs the files in place; red activates skipped scaffolds in a disposable copy')
    .requiredOption('--project-root <dir>', 'the consuming project')
    .requiredOption('--report <path>', 'where to write the JSON report')
    .option('--file <path>', 'generated test file inside the project (repeatable)', (value, previous) => [...previous, value], [])
    .option('--runner <name>', 'vitest or jest; only needed when the project declares both')
    .option('--per-file-timeout-ms <n>', 'wall-clock bound per file', String(120_000))
    .option('--work-dir <dir>', 'parent directory for the disposable red copy', os.tmpdir());
  program.exitOverride();
  try {
    program.parse(argv);
  } catch (error) {
    if (error.exitCode === 0) return;
    fail(error.message);
  }
  const options = program.opts();
  let scratch;
  try {
    if (!['expand', 'red'].includes(options.mode)) throw new SetupError('--mode must be expand or red');
    const red = options.mode === 'red';
    if (!fs.existsSync(options.projectRoot) || !fs.statSync(options.projectRoot).isDirectory())
      throw new SetupError(`--project-root ${options.projectRoot} is not a directory`);
    const root = real(options.projectRoot);
    const timeoutMs = Number.parseInt(options.perFileTimeoutMs, 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || String(timeoutMs) !== options.perFileTimeoutMs)
      throw new SetupError('--per-file-timeout-ms must be a positive integer');
    if (options.file.length === 0) throw new SetupError('name at least one generated test file with --file');
    const files = options.file.map((file) => projectFile(root, file));
    if (new Set(files).size !== files.length) throw new SetupError('--file names the same file twice');

    const detected = detectRunners(root).filter(({ runner }) => UNIT_RUNNERS.includes(runner));
    if (options.runner !== undefined && !UNIT_RUNNERS.includes(options.runner)) throw new SetupError('--runner must be vitest or jest');
    const candidates = options.runner ? detected.filter(({ runner }) => runner === options.runner) : detected;
    if (candidates.length === 0)
      throw new SetupError(
        options.runner ? `the project does not declare ${options.runner}` : 'the project declares neither Vitest nor Jest',
      );
    if (candidates.length > 1) throw new SetupError('the project declares both Vitest and Jest; pass --runner to choose one');
    const [{ runner, configFile }] = candidates;
    const { entry, version } = runnerEntry(root, runner);

    const activations = [];
    const inventory = generatedInventory(root, files, { runner, activations });
    if (red) {
      const active = inventory.tests.filter((leaf) => leaf.activationLine === undefined);
      if (active.length > 0)
        throw new SetupError(
          `red scaffolds must register every generated leaf with .skip: ${active.map((leaf) => `${leaf.file} ${leaf.titlePath.join(' > ')}`).join('; ')}`,
        );
    }

    const reportPath = path.resolve(options.report);
    if (!fs.existsSync(options.workDir) || !fs.statSync(options.workDir).isDirectory())
      throw new SetupError(`--work-dir ${options.workDir} is not a directory`);
    scratch = real(fs.mkdtempSync(path.join(real(options.workDir), `${NAME}-`)));
    active.scratch = scratch;
    const outputs = path.join(scratch, 'reports');
    fs.mkdirSync(outputs);
    const before = new Map(files.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))]));
    // Red integrity covers the whole tree the copy carries: the project, or its workspace.
    const scope = copyScope(root);
    const roots = [scope.top, ...scope.linked];
    // The report and the work directory change during the run by design.
    const skip = new Set([reportPath, scratch]);
    const projectBefore = red ? digestScope(root, roots, undefined, skip) : null;
    let cwd = root;
    let copy;
    let copyBefore;
    if (red) {
      copy = disposableCopy(root, scratch, scope);
      cwd = copy.copyRoot;
      for (const file of files) {
        const copied = path.join(cwd, file);
        let text = fs.readFileSync(copied, 'utf8');
        // Blank `.skip` to spaces (newlines kept), so every later registration keeps its line and column.
        for (const { start, end } of activations.filter((edit) => edit.file === file))
          text = `${text.slice(0, start)}${text.slice(start, end).replaceAll(/[^\n\r]/g, ' ')}${text.slice(end)}`;
        fs.writeFileSync(copied, text);
      }
      copyBefore = digestScope(root, roots, copy.mirrorOf);
    }
    const results = [];
    for (const [index, file] of files.entries())
      results.push({
        file,
        sha256: before.get(file),
        ...(red ? { activated: activations.filter((edit) => edit.file === file).length } : {}),
        ...(await runFile({ runner, entry, cwd, file, output: path.join(outputs, `${index}.json`), timeoutMs })),
      });
    const report = {
      schemaVersion: 1,
      kind: UNIT_CHECK_KIND,
      mode: options.mode,
      runner,
      runnerVersion: version,
      configFile,
      projectRoot: root,
      files: results,
    };
    if (red) {
      // Writes in the copy and writes that escaped into the permanent project both count.
      const touched = new Set(changed(copyBefore, digestScope(root, roots, copy.mirrorOf)));
      for (const file of changed(projectBefore, digestScope(root, roots, undefined, skip))) touched.add(file);
      for (const file of files) if (sha256(fs.readFileSync(path.join(root, file))) !== before.get(file)) touched.add(file);
      report.productionFilesTouched = [...touched].sort();
    }
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`Wrote ${reportPath}.\n`);
  } catch (error) {
    // Exit through exitCode so the finally block still removes the disposable copy.
    process.stderr.write(`${NAME}: ${error instanceof SetupError ? error.message : `the run could not be set up: ${error.message}`}\n`);
    process.exitCode = 2;
  } finally {
    if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) {
  cleanUpOnSignals();
  main(process.argv).catch((error) => fail(error?.message ?? String(error)));
}

module.exports = { main, runnerArguments };
