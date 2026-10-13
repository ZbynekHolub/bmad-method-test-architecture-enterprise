/** A live Evaluate run remains inspectable while a target call is blocked. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'evaluate', 'mutation');
const CLI = path.join(ROOT, 'cli', 'evaluate.js');
const RUN_MODULE = path.join(ROOT, 'cli', 'lib', 'evaluate', 'run.js');
const { statusOf } = require('../cli/lib/evaluate/status');
const DEADLINE_MS = 30_000;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: ROOT, encoding: 'utf8', timeout: DEADLINE_MS, ...options });
  if (result.error) throw result.error;
  return result;
}

function git(repository, args) {
  const result = command(
    'git',
    ['-C', repository, '-c', 'user.name=TeA test', '-c', 'user.email=tea-test@example.test', '-c', 'core.hooksPath=/dev/null', ...args],
    {
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    },
  );
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
}

function cli(args, env) {
  return command(process.execPath, [CLI, ...args], { env });
}

async function until(read, description, child, timeoutMs = DEADLINE_MS) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (child?.exitCode !== null || child?.signalCode !== null) throw new Error(`${description}: run exited before the condition appeared`);
    if (Date.now() >= deadline) throw new Error(`${description}: timed out`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function closed(child, timeoutMs = DEADLINE_MS) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve({ code: child.exitCode, signal: child.signalCode });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('child did not exit before the deadline'));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function project(temp) {
  const repository = path.join(temp, 'repository');
  fs.cpSync(FIXTURE, repository, { recursive: true, filter: (from) => path.basename(from) !== 'runs' });
  const folder = path.join(repository, 'evals', 'verdict');
  const manifestFile = path.join(folder, 'evaluation.json');
  const manifest = readJson(manifestFile);
  manifest.confinement = false;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  // The copied target tells the test which private workspace is paused, so the
  // test can release it after a separate CLI process has read live status.
  const targetFile = path.join(repository, 'bin', 'verdict.js');
  const target = fs.readFileSync(targetFile, 'utf8');
  const hold = "if (act === 'hold-gate') holdGate();";
  assert.equal(target.split(hold).length, 2, 'target fixture has one hold-gate seam');
  fs.writeFileSync(
    targetFile,
    target.replace(hold, "if (act === 'hold-gate') { fs.writeFileSync(process.env.VERDICT_TOUCH, process.cwd()); holdGate(); }"),
  );

  const digested = cli(['digest', '--evaluation', folder], process.env);
  assert.equal(digested.status, 0, `digest: ${digested.stdout}${digested.stderr}`);
  git(repository, ['init', '--quiet', '--initial-branch', 'main']);
  git(repository, ['add', '--all']);
  git(repository, ['commit', '--quiet', '--message', 'the progress test fixture']);
  return folder;
}

function runDirectory(folder) {
  const runs = path.join(folder, 'runs');
  if (!fs.existsSync(runs)) return null;
  const names = fs.readdirSync(runs).filter((name) => /^[A-Za-z0-9_-]+$/.test(name));
  return names.length === 1 ? path.join(runs, names[0]) : null;
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-evaluate-progress-'));
  let running;
  let following;
  try {
    const folder = project(temp);
    const runtimeTemp = path.join(temp, 'runtime-temp');
    fs.mkdirSync(runtimeTemp);
    const readyFile = path.join(temp, 'paused-workspace');
    const env = {
      ...process.env,
      TMPDIR: runtimeTemp,
      TMP: runtimeTemp,
      TEMP: runtimeTemp,
      VERDICT_WHEN: 'trial-clean-1,trial-clean-2',
      VERDICT_DO: 'hold-gate',
      VERDICT_TOUCH: readyFile,
    };
    const runCode = [
      'const { runRunCommand } = require(process.argv[1]);',
      'runRunCommand(process.argv[2], { env: process.env, progressIntervalMs: 100, log: (line) => process.stderr.write(`${line}\\n`) })',
      '  .then((result) => { process.stderr.write(`outcome ${result.exitCode}\\n`); process.exitCode = result.exitCode; },',
      '    (error) => { process.stderr.write(`${error.stack ?? error}\\n`); process.exitCode = 99; });',
    ].join('\n');
    running = spawn(process.execPath, ['-e', runCode, RUN_MODULE, folder], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let runOutput = '';
    running.stdout.on('data', (chunk) => (runOutput += chunk));
    running.stderr.on('data', (chunk) => (runOutput += chunk));

    const workspace = await until(() => (fs.existsSync(readyFile) ? fs.readFileSync(readyFile, 'utf8') : null), 'paused target', running);
    const directory = await until(() => runDirectory(folder), 'run directory', running);
    const runId = path.basename(directory);
    const liveRecord = readJson(path.join(directory, 'run.json'));
    assert.equal(liveRecord.progress.phase, 'trials');
    assert.equal(liveRecord.progress.completedTrials, 0);
    assert.equal(liveRecord.progress.totalTrials, 6);

    const live = cli(['status', '--evaluation', folder, '--run', runId], env);
    assert.equal(live.status, 0, `live status: ${live.stdout}${live.stderr}`);
    assert.match(live.stdout, /live.*trials 0\/6.*elapsed/);
    assert.match(live.stdout, /trial cost unknown/);
    assert.match(live.stdout, /last update .* ago/);

    const firstHeartbeat = Date.parse(liveRecord.progress.updatedAt);
    const heartbeat = await until(
      () => {
        const record = readJson(path.join(directory, 'run.json'));
        return Date.parse(record.progress.updatedAt) > firstHeartbeat ? record : null;
      },
      'heartbeat while target is paused',
      running,
      3000,
    );
    assert.equal(heartbeat.progress.completedTrials, 0);
    await until(() => /progress: trials; 0\/6 trials/.test(runOutput), 'running command heartbeat', running);

    following = spawn(process.execPath, [CLI, 'status', '--evaluation', folder, '--run', runId, '--follow'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let followOutput = '';
    following.stdout.on('data', (chunk) => (followOutput += chunk));
    following.stderr.on('data', (chunk) => (followOutput += chunk));
    await until(() => followOutput.includes('live') && followOutput.includes('trials 0/6'), 'follow live status', following);

    fs.writeFileSync(path.join(workspace, 'gate-release'), 'released\n');
    const secondWorkspace = await until(
      () => {
        if (!fs.existsSync(readyFile)) return null;
        const current = fs.readFileSync(readyFile, 'utf8');
        return current === workspace ? null : current;
      },
      'paused second trial',
      running,
    );
    const partial = readJson(path.join(directory, 'run.json'));
    assert.equal(partial.progress.completedTrials, 1);
    assert.equal(partial.progress.totalTrials, 6);
    const midway = cli(['status', '--evaluation', folder, '--run', runId], env);
    assert.equal(midway.status, 0, `midway status: ${midway.stdout}${midway.stderr}`);
    assert.match(midway.stdout, /live.*trials 1\/6.*elapsed/);
    await until(() => followOutput.includes('trials 1/6'), 'follow intermediate trial progress', following);

    fs.writeFileSync(path.join(secondWorkspace, 'gate-release'), 'released\n');
    const runExit = await closed(running);
    assert.equal(runExit.code, 0, `run: ${runOutput}`);
    const followExit = await closed(following);
    assert.equal(followExit.code, 0, `follow: ${followOutput}`);
    assert.match(followOutput, /complete/);

    const finished = readJson(path.join(directory, 'run.json'));
    assert.equal(finished.completed, true);
    assert.equal(finished.progress.phase, 'complete');
    assert.equal(finished.progress.completedTrials, 6);
    assert.ok(finished.durationMs >= 0);
    assert.ok(finished.progress.phaseDurationsMs.qualification > 0);
    assert.ok(finished.progress.phaseDurationsMs.preflight > 0);
    assert.ok(finished.progress.phaseDurationsMs.trials > 0);
    assert.equal(finished.progress.usage.scope, 'trials-only');
    assert.equal(finished.progress.usage.trialCostUsd, null);
    assert.equal(finished.progress.usage.reportedTrialCostUsd, '0');
    assert.ok(finished.progress.usage.missingReports > 0);

    const terminal = cli(['status', '--evaluation', folder, '--run', runId], env);
    assert.equal(terminal.status, 0, `terminal status: ${terminal.stdout}${terminal.stderr}`);
    assert.match(terminal.stdout, /complete/);
    assert.match(terminal.stdout, /phase times /);
    assert.match(terminal.stdout, /trial cost unknown/);

    for (const invalid of ['../..', 'missing-run']) {
      const refused = cli(['status', '--evaluation', folder, '--run', invalid], env);
      assert.equal(refused.status, 64, `${invalid}: ${refused.stdout}${refused.stderr}`);
    }
    fs.symlinkSync(directory, path.join(folder, 'runs', 'linked-run'));
    const linked = cli(['status', '--evaluation', folder, '--run', 'linked-run'], env);
    assert.equal(linked.status, 64, `linked run: ${linked.stdout}${linked.stderr}`);

    const stale = statusOf(runId, {
      command: 'run',
      completed: false,
      outcome: null,
      progress: {
        ...finished.progress,
        phase: 'trials',
        updatedAt: new Date(Date.now() - 120_000).toISOString(),
      },
    });
    assert.equal(stale.state, 'stale');
    assert.match(stale.line, /last update .* ago/);
    const staleLater = statusOf(
      runId,
      { command: 'run', completed: false, outcome: null, progress: stale.progress },
      Date.now() + 3_600_000,
    );
    assert.equal(staleLater.line.match(/elapsed [^|]+/)?.[0], stale.line.match(/elapsed [^|]+/)?.[0]);
    fs.writeFileSync(
      path.join(directory, 'run.json'),
      `${JSON.stringify({ ...finished, completed: false, outcome: null, progress: stale.progress })}\n`,
    );
    const staleCli = cli(['status', '--evaluation', folder, '--run', runId, '--follow'], env);
    assert.equal(staleCli.status, 0, `stale follow: ${staleCli.stdout}${staleCli.stderr}`);
    assert.match(staleCli.stdout, /run .*: stale .*last update .* ago/);

    const zero = statusOf(runId, {
      ...finished,
      progress: {
        ...finished.progress,
        usage: { scope: 'trials-only', trialCostUsd: '0', reportedTrialCostUsd: '0', missingReports: 0 },
      },
    });
    assert.match(zero.line, /trial cost \$0 \(trials only\)/);
    assert.doesNotMatch(zero.line, /trial cost unknown/);

    const interrupted = statusOf(runId, {
      ...finished,
      completed: false,
      outcome: { stage: 'signal', signal: 'SIGINT', exitCode: null, message: 'stopped by SIGINT before it finished' },
    });
    assert.equal(interrupted.state, 'stopped');
    assert.equal(interrupted.terminal, true);
    assert.match(interrupted.line, /signal SIGINT/);
    const interruptedLater = statusOf(
      runId,
      { ...finished, completed: false, outcome: { stage: 'signal', signal: 'SIGINT', exitCode: null } },
      Date.now() + 3_600_000,
    );
    assert.equal(interruptedLater.line.match(/elapsed [^|]+/)?.[0], interrupted.line.match(/elapsed [^|]+/)?.[0]);
    console.log('ok Evaluate status, heartbeat, timing, and unknown trial cost');
  } finally {
    if (running?.exitCode === null && running?.signalCode === null) running.kill('SIGKILL');
    if (following?.exitCode === null && following?.signalCode === null) following.kill('SIGKILL');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
