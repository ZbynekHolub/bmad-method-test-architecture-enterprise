#!/usr/bin/env node
/**
 * tea-test-design-runner — the command the test-design behavioral contract names.
 *
 * The test-design eval harness measures what the test-design workflow produces, and
 * the workflow has no CLI of its own. This command is the one the eval-quality
 * command-line adapter spawns on its behalf, and its whole surface is one turn:
 *
 *   prompt on standard input -> the agent runs in the working directory
 *                            -> the test design document is left on disk
 *
 * The workflow writes one Markdown deliverable. The runner emits a JSON
 * projection on stdout for the evaluator when given --design-path. The prompt belongs
 * to the eval corpus, so this command builds none: only the harness knows which
 * fixture set is staged, which epic it names, and where the workflow is. The
 * vendor call is TEA's own (cli/lib/run-agent.js), so vendor argv, the minimal
 * child environment, the model pin and the credential shape are decided in the
 * one place that already decides them for the other three commands. This file
 * adds no vendor knowledge.
 *
 * The adapter reads the deliverable as an artifact and the projection from stdout.
 * The projection carries the original Markdown and descriptions of parsed rows
 * scored above 3. Both the runner and harness import the same parser module.
 * A missing deliverable remains an absent artifact for the harness to classify.
 *
 * It declares `scoped-artifact-writes`: the deliverable is a document inside the
 * working directory, so claude runs with its write tools and no shell, and codex
 * under its workspace-write sandbox. That is what the test-design suite declares
 * in the eval suite manifest.
 *
 * Two nested wall clocks are in play when this runs behind the adapter, and the
 * inner one has to be the shorter of the two: --timeout-ms bounds the vendor call
 * and reports a timeout as exit 5, while the adapter's own maxElapsedMs SIGKILLs
 * this process and reports `budget-exhausted` with no exit code at all. A run that
 * hits the outer bound first loses the classification the inner one would have
 * produced. The probe-targets check sets the outer bound a minute above the
 * harness's own for exactly this reason.
 *
 * Usage:
 *   tea-test-design-runner --agent codex < prompt.txt
 *   tea-test-design-runner --agent custom --agent-cmd ./my-runner < prompt.txt
 *
 * Exit codes: 0 the agent ran to completion, and the classes in
 * cli/lib/runner-exit-codes.js otherwise. They are the exit codes because the
 * caller is a probe: the adapter records an exit code as an observation and never
 * as a fault, so the code is the only channel that survives the boundary intact.
 * The table is shared with the other two runner commands so all three spell one
 * class with one number.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Command } = require('commander');

const { AGENT_ADAPTERS, resolveModel, agentCaptureTelemetry } = require('./lib/agent-adapters');
const { runAgent } = require('./lib/run-agent');
const { EXIT_CODES, classOfAgentError, failureClassForExit, vendorEnvironmentNames } = require('./lib/runner-exit-codes');
const { readDesign, scoredRiskProjection } = require('./lib/test-design-parser');

/** The same default the other three commands declare, so this command changes no run that omits `--agent`. */
const DEFAULT_AGENT = 'claude';

/** Twenty minutes, matching RUN_TIMEOUT_MS in the test-design eval harness, which is the only caller that measures. */
const DEFAULT_TIMEOUT_MS = 20 * 60_000;

/** A test-design run writes its deliverable into the working directory; see the header. */
const RUNNER_CAPABILITIES = ['scoped-artifact-writes'];

/**
 * The request shape this command accepts, as the contract generator needs to
 * declare it.
 *
 * Read by tools/generate-contracts.js rather than transcribed there, which is
 * the rule test/contracts/README.md records for every declaration a command owns.
 * The option surface is tea-trace-runner's, because both commands wrap one
 * `runAgent` call and differ only in how many files the run leaves behind.
 */
const TEST_DESIGN_REQUEST_KEYS = {
  argument: { required: [], permitted: [] },
  option: {
    required: ['agent', 'design-path'],
    permitted: ['agent', 'agent-cmd', 'agent-arg', 'design-path', 'env-pass', 'model', 'timeout-ms'],
  },
  environment: { required: [], permitted: vendorEnvironmentNames() },
  stdin: { required: ['prompt'], permitted: ['prompt'] },
};

function collect(value, previous) {
  return [...previous, value];
}

/** Everything this process prints on stderr is diagnostic; stdout carries only the projection. */
function fail(failureClass, message) {
  process.stderr.write(`tea-test-design-runner: ${message}\n`);
  process.exit(EXIT_CODES[failureClass]);
}

function readPrompt() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (error) {
    fail('usage', `could not read the prompt from standard input: ${error.message}`);
    return '';
  }
}

/** Derive a projection only after the agent has finished its document. */
function designText(cwd, relativeDesignPath) {
  const relative = path.normalize(relativeDesignPath);
  if (path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`) || relative === '..' || !relative.endsWith('.md')) {
    throw new Error(`--design-path must name a markdown file inside the working directory: ${JSON.stringify(relativeDesignPath)}`);
  }
  const designPath = path.join(cwd, relative);
  if (!fs.existsSync(designPath)) return null;
  const realRoot = fs.realpathSync(cwd);
  const realDesign = fs.realpathSync(designPath);
  const fromRoot = path.relative(realRoot, realDesign);
  if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot) || fs.lstatSync(designPath).isSymbolicLink()) {
    throw new Error(`design path escapes the working directory: ${JSON.stringify(relativeDesignPath)}`);
  }
  return fs.readFileSync(designPath, 'utf8');
}
function projectScoredRisks(cwd, relativeDesignPath, { requireDeliverable = false } = {}) {
  const text = designText(cwd, relativeDesignPath);
  if (text === null) return null;
  const read = readDesign({ kind: 'text', value: text });
  if (!read.ok && requireDeliverable) throw Object.assign(new Error(read.reason), { failureClass: read.failureClass });
  return scoredRiskProjection(read.ok ? read.design : { risks: [], text });
}

function main(argv) {
  const program = new Command();
  program
    .name('tea-test-design-runner')
    .description('Run a headless agent through the TEA test-design workflow in the working directory, leaving its document on disk.')
    .option('--agent <name>', `agent adapter (${Object.keys(AGENT_ADAPTERS).join('|')})`, DEFAULT_AGENT)
    .option('--agent-cmd <path>', 'executable override for the selected adapter')
    .option('--agent-arg <arg>', 'extra argument appended to the agent CLI argv (repeatable)', collect, [])
    .option('--env-pass <NAME>', 'environment variable name allowed through to the agent (repeatable)', collect, [])
    .option('--model <name>', 'model to pin for this run; defaults to the adapter default')
    .option('--design-path <path>', 'staged design document path for a deterministic scored-risk projection')
    .option('--capture-path <path>', 'opt-in source receipt and telemetry inside the workspace')
    .option('--capture-test-double', 'label custom telemetry as a deterministic test double')
    .option('--timeout-ms <n>', 'agent wall-clock timeout in milliseconds', String(DEFAULT_TIMEOUT_MS));

  program.exitOverride();
  try {
    program.parse(argv);
  } catch (error) {
    // commander's own --help and --version exits are not usage errors.
    if (error.exitCode === 0) return;
    fail('usage', error.message);
  }

  const options = program.opts();
  if (!Object.hasOwn(AGENT_ADAPTERS, options.agent)) {
    fail('environment-configuration', `unknown agent "${options.agent}"; expected one of ${Object.keys(AGENT_ADAPTERS).join(', ')}`);
  }
  // Tested on the raw string before the parse. Number.parseInt truncates, so
  // `--timeout-ms 20abc` became 20 and every run then timed out at twenty
  // milliseconds, and `--timeout-ms 1e9` became 1.
  if (!/^[0-9]+$/.test(String(options.timeoutMs).trim())) {
    fail('usage', `--timeout-ms must be a positive integer; got ${JSON.stringify(options.timeoutMs)}`);
  }
  const timeout = Number.parseInt(options.timeoutMs, 10);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    fail('usage', `--timeout-ms must be a positive integer; got ${JSON.stringify(options.timeoutMs)}`);
  }

  const prompt = readPrompt();
  if (prompt.trim().length === 0) {
    fail('usage', 'the prompt is empty; this command reads the complete prompt from standard input');
  }

  let stdout = '';
  let source = null;
  let captureFile = null;
  let captureFd = null;
  let captureIdentity = null;
  let captureBytes = null;
  let captureResult = null;
  const reportCapture = () => {
    if (captureResult) process.stdout.write(`${JSON.stringify({ sourceCapture: captureResult })}\n`);
  };
  const saveCapture = () => {
    if (captureFd === null) return;
    let integrityFailure = null;
    try {
      const held = fs.fstatSync(captureFd);
      const named = fs.lstatSync(captureFile);
      if (
        !held.isFile() ||
        held.nlink !== 1 ||
        !named.isFile() ||
        named.nlink !== 1 ||
        held.dev !== captureIdentity.dev ||
        held.ino !== captureIdentity.ino ||
        named.dev !== held.dev ||
        named.ino !== held.ino
      )
        integrityFailure = 'source capture path or link identity changed';
      if (!integrityFailure && captureBytes !== null) {
        if (held.size === captureBytes.length) {
          const current = Buffer.alloc(held.size);
          fs.readSync(captureFd, current, 0, current.length, 0);
          if (!current.equals(captureBytes)) integrityFailure = 'source capture bytes changed';
        } else integrityFailure = 'source capture bytes changed';
      }
    } catch (error) {
      integrityFailure = `source capture identity could not be checked: ${error.message}`;
    }
    if (integrityFailure) {
      const recovery = path.join(process.cwd(), `source-capture-recovery-${randomUUID()}.json`);
      source.captureIntegrityViolation = { reason: integrityFailure, originalPath: captureFile, agentStatus: source.status };
      source.status = 'failed';
      const recoveryFd = fs.openSync(recovery, 'wx', 0o600);
      const recoveryBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`);
      try {
        fs.writeFileSync(recoveryFd, recoveryBytes);
        fs.fsyncSync(recoveryFd);
      } finally {
        fs.closeSync(recoveryFd);
        fs.closeSync(captureFd);
        captureFd = null;
      }
      captureResult = {
        status: 'rejected',
        path: path.basename(recovery),
        sha256: `sha256:${createHash('sha256').update(recoveryBytes).digest('hex')}`,
      };
      reportCapture();
      fail('environment-configuration', `${integrityFailure}; source evidence preserved at ${recovery}`);
    }
    if (options.designPath) {
      try {
        const text = designText(process.cwd(), options.designPath);
        source.artifactSha256 = text === null ? null : `sha256:${createHash('sha256').update(text).digest('hex')}`;
      } catch {
        source.artifactSha256 = null;
      }
    }
    captureBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`);
    fs.ftruncateSync(captureFd, 0);
    fs.writeSync(captureFd, captureBytes, 0, captureBytes.length, 0);
    fs.fsyncSync(captureFd);
    captureResult = {
      status: 'verified',
      path: path.basename(captureFile),
      sha256: `sha256:${createHash('sha256').update(captureBytes).digest('hex')}`,
    };
  };
  const captureDoubleTelemetry = (stderr) => {
    if (!source || !options.captureTestDouble || options.agent !== 'custom') return;
    const line = stderr.split('\n').find((line) => line.startsWith('TEA_EXPERIMENT_TEST_TELEMETRY:'));
    if (line) {
      try {
        const telemetry = JSON.parse(line.slice('TEA_EXPERIMENT_TEST_TELEMETRY:'.length));
        source.observed = telemetry.observed ?? source.observed;
        source.usage = telemetry.usage ?? null;
        source.cost = telemetry.cost ?? null;
      } catch (error) {
        (source.telemetryErrors ??= []).push(`test-double telemetry unavailable: ${error.message}`);
        source.observed = { resolvedModel: null, appliedEffort: null };
        source.usage = null;
        source.cost = null;
      }
    }
  };
  if (options.capturePath) {
    const relative = path.normalize(options.capturePath);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
      fail('usage', '--capture-path must stay inside the workspace');
    captureFile = path.join(process.cwd(), relative);
    if (fs.existsSync(captureFile)) fail('usage', '--capture-path already exists');
    if (fs.realpathSync(path.dirname(captureFile)) !== fs.realpathSync(process.cwd()))
      fail('usage', '--capture-path must be directly inside the workspace');
    try {
      captureFd = fs.openSync(captureFile, 'wx+', 0o600);
      captureIdentity = fs.fstatSync(captureFd);
    } catch (error) {
      fail('environment-configuration', `could not exclusively create source capture: ${error.message}`);
    }
    source = {
      kind: 'test-design-source-capture',
      label: options.captureTestDouble ? 'deterministic-test-double' : 'native',
      workspaceId: randomUUID(),
      workspace: process.cwd(),
      requested: {
        agent: options.agent,
        model: options.captureTestDouble ? (options.model ?? null) : resolveModel(options.agent, options.model, options.agentArg),
      },
      inputSha256: `sha256:${createHash('sha256').update(prompt).digest('hex')}`,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'dispatched',
      observed: { resolvedModel: null, appliedEffort: null },
      usage: null,
      cost: null,
    };
    saveCapture();
  }
  try {
    const answer = runAgent(prompt, {
      agent: options.agent,
      agentCommand: options.agentCmd,
      agentArgs: options.agentArg,
      envPass: options.envPass,
      model: options.captureTestDouble && options.agent === 'custom' ? undefined : options.model,
      timeout,
      cwd: process.cwd(),
      capabilities: RUNNER_CAPABILITIES,
      usageReport: Boolean(source) && options.agent !== 'custom',
      captureTelemetry: Boolean(source) && options.agent !== 'custom',
    });
    stdout = answer.stdout;
    if (source) {
      source.observed = { resolvedModel: answer.telemetry?.resolvedModel ?? null, appliedEffort: answer.telemetry?.appliedEffort ?? null };
      source.providerStdout = answer.sourceStdout ?? answer.stdout;
      source.providerStderr = answer.sourceStderr ?? answer.stderr;
      source.usage = answer.telemetry?.usage ?? null;
      source.telemetryErrors = answer.telemetry?.errors ?? [];
      const usd = source.usage?.costUsd;
      if (usd !== undefined) source.cost = { currency: 'USD', components: { target: Number(usd), tools: null } };
      captureDoubleTelemetry(answer.stderr);
      source.status = 'completed';
      source.processOutcome = { status: 'completed', exitCode: 0 };
      source.endedAt = new Date().toISOString();
      saveCapture();
    }
  } catch (error) {
    if (source) {
      source.providerStdout = error.stdout ?? '';
      source.providerStderr = error.stderr ?? '';
      captureDoubleTelemetry(error.stderr ?? '');
      if (options.agent !== 'custom') {
        const parsed = agentCaptureTelemetry(options.agent, error.stdout ?? '', error.stderr ?? '');
        source.usage = parsed.usage;
        source.observed.resolvedModel = parsed.resolvedModel;
        source.telemetryErrors = parsed.errors;
        source.providerStdout = error.stdout ?? '';
        source.providerStderr = error.stderr ?? '';
        if (parsed.usage?.costUsd !== undefined)
          source.cost = { currency: 'USD', components: { target: Number(parsed.usage.costUsd), tools: null } };
      }
      source.status = /timed out/.test(error.message) ? 'timeout' : /signal SIG(?:INT|TERM)/.test(error.message) ? 'canceled' : 'failed';
      source.processOutcome = { status: source.status, exitCode: null };
      source.endedAt = new Date().toISOString();
      source.error = { code: error.code ?? null, message: error.message };
      source.stdout = error.stdout ?? '';
      source.stderr = error.stderr ?? '';
      saveCapture();
    }
    reportCapture();
    fail(classOfAgentError(error), error.message);
  }
  if (options.designPath) {
    try {
      const projection = projectScoredRisks(process.cwd(), options.designPath, { requireDeliverable: Boolean(source) });
      if (projection)
        process.stdout.write(`${JSON.stringify(captureResult ? { ...projection, sourceCapture: captureResult } : projection)}\n`);
      else if (source)
        throw Object.assign(new Error('the native design deliverable is absent'), { failureClass: 'environment-missing-artifact' });
    } catch (error) {
      if (source) {
        source.agentStatus = source.status;
        source.status = 'failed';
        source.failureClass = error.failureClass ?? 'environment-parser';
        source.error = { code: 'RUNNER_PROJECTION_FAILED', message: error.message };
        saveCapture();
      }
      reportCapture();
      fail('environment-parser', `could not project scored risks: ${error.message}`);
    }
  } else reportCapture();
  if (captureFd !== null) fs.closeSync(captureFd);

  if (stdout.length > 0) process.stderr.write(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
}

// Guarded so tools/generate-contracts.js can read the declarations above without
// running a command, the same way it reads TRACE_REQUEST_KEYS out of
// cli/trace-runner.js.
module.exports = {
  DEFAULT_AGENT,
  DEFAULT_TIMEOUT_MS,
  EXIT_CODES,
  RUNNER_CAPABILITIES,
  TEST_DESIGN_REQUEST_KEYS,
  classOfAgentError,
  failureClassForExit,
  projectScoredRisks,
};

if (require.main === module) {
  main(process.argv);
}
