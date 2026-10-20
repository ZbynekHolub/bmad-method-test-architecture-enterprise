'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const experiments = require('../cli/lib/evaluate/experiments');
const result = spawnSync(process.execPath, ['cli/evaluate.js', 'experiment', '--help'], { cwd: root, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const ordinary = spawnSync(
  process.execPath,
  [
    '-e',
    `const Module=require('node:module');const load=Module._load;Module._load=function(request,...args){if(/experiments|configuration-experiment|test-design-replay/.test(request))throw new Error('ordinary evaluation loaded an experiment stage');return load.call(this,request,...args);};require('./cli/evaluate').main(['node','tea-evaluate','check','--evaluation','test/fixtures/evaluate-tutorial/evaluation']).then(code=>{process.exitCode=code;});`,
  ],
  { cwd: root, encoding: 'utf8' },
);
assert.equal(ordinary.status, 0, ordinary.stderr);
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const reader = require('../cli/lib/evaluate/configuration-experiment');
const staging = require('../cli/lib/test-design-staging');
const scoring = require('../cli/lib/evaluate/test-design-replay');
const legacyHarness = require('./eval-test-design');
const nativeParser = require('../cli/lib/test-design-parser');
assert.equal(legacyHarness.bandFor, nativeParser.bandFor);
assert.equal(legacyHarness.RISK_ID_PATTERN, nativeParser.RISK_ID_PATTERN);
const { retainSkillArtifacts, finishSkillAttempt } = require('../cli/lib/evaluate/retain-skill-artifacts');
const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function editAfterCheckedRead(target, read) {
  const originalRead = fs.readFileSync;
  const originalOpen = fs.openSync;
  const descriptors = new Map();
  let edited = false;
  fs.openSync = (file, ...args) => {
    const fd = originalOpen(file, ...args);
    if (typeof file === 'string') descriptors.set(fd, path.resolve(file));
    return fd;
  };
  fs.readFileSync = (file, ...args) => {
    const bytes = originalRead(file, ...args);
    const named = typeof file === 'number' ? descriptors.get(file) : path.resolve(file);
    if (!edited && named === path.resolve(target)) {
      edited = true;
      const forged = JSON.parse(bytes);
      forged.cost = { currency: 'USD', components: { target: 0, tools: 0 } };
      fs.writeFileSync(target, JSON.stringify(forged));
    }
    return bytes;
  };
  try {
    const result = read();
    assert.equal(edited, true);
    return result;
  } finally {
    fs.readFileSync = originalRead;
    fs.openSync = originalOpen;
  }
}
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-opt-in-experiments-'));
const skill = fs.readFileSync(path.join(root, 'skills/bmad-tea-evaluate/SKILL.md'), 'utf8');
assert.ok(skill.indexOf('Execution Authority') < skill.indexOf('Step 1: Resolve'), 'intent authority precedes hooks');
assert.match(skill, /prepend, append and completion hooks/);
assert.match(skill, /ordinary evaluation.*unchanged/is);
assert.match(skill, /native compare\/accept \(including comparing saved runs\)/);
assert.match(skill, /Saved-result consistency or explicitly requested offline experiment analysis/);
assert.match(skill, /“Is it repeatable\?” without a saved\/fresh choice: clarify/);
assert.equal(experiments.feasibility().independentCases, scoring.loadGroundTruth().fixtureSets.length);
assert.equal(experiments.feasibility().confirmationFeasible, false);
const nativeGroundTruth = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/test-design-eval/ground-truth.json'), 'utf8'));
assert.deepEqual(scoring.loadGroundTruth(), nativeGroundTruth, 'shipped and checkout native ground truth stay synchronized');
for (const set of nativeGroundTruth.fixtureSets) {
  const source = path.join(root, 'test/fixtures/test-design-eval', set.root, 'docs/epics');
  const shipped = path.join(root, 'cli/lib/evaluate/test-design-corpus', set.root, 'docs/epics');
  assert.deepEqual(fs.readdirSync(shipped).sort(), fs.readdirSync(source).sort());
  for (const name of fs.readdirSync(source))
    assert.deepEqual(
      fs.readFileSync(path.join(shipped, name)),
      fs.readFileSync(path.join(source, name)),
      `staged epic ${name} stays byte-identical`,
    );
}

const nativeIdentity = json(path.join(root, 'cli/lib/evaluate/test-design-corpus/native-identity.json'));
assert.equal(experiments.nativeIdentity().suiteDigest, nativeIdentity.suiteDigest);
assert.equal(experiments.nativeIdentity().promptDigest, nativeIdentity.promptDigest);
function declaration() {
  const value = json(path.join(__dirname, 'fixtures/configuration-experiment/example-baseline-experiment.json'));
  value.experimentId = 'deterministic-double-orchestration';
  value.design.repeats = 1;
  value.design.maxAttempts = 1;
  value.identity.fixed = experiments.nativeIdentity();
  value.identity.arms = {
    A: { model: { requested: 'double-model', resolved: 'double-model' }, effort: { requested: 'high', applied: 'high' } },
  };
  value.resources.overhead = [];
  value.frozen = { digest: reader.declarationDigest(value) };
  return value;
}
function double(command) {
  return { command, executableSha256: sha(fs.readFileSync(command)), args: [], boundUsd: 0.01, overheadUsd: 0 };
}
function freeze(name, { decl = declaration(), testDouble = null, maxUsd = 1 } = {}) {
  const directory = path.join(scratch, name);
  const proposal = experiments.makeProposal({ declaration: decl, testDouble, maxUsd, timeoutMs: 5000 });
  const plan = experiments.freezeProposal(proposal, directory);
  return { directory, plan };
}
function approve({ directory, plan }) {
  experiments.approvePlan(directory, {
    approved: true,
    approvedBy: 'deterministic test, no provider calls',
    planDigest: reader.digestOf(plan),
    maxUsd: plan.maxUsd,
  });
}
async function main() {
  const blocked = freeze('native');
  assert.ok(blocked.plan.blockers.some((value) => value.includes('applied reasoning effort')));
  assert.ok(blocked.plan.blockers.some((value) => value.includes('verified money')));
  assert.throws(() => approve(blocked), /blocked/);
  await assert.rejects(experiments.executePlan(blocked.directory), /approval/);
  assert.equal(experiments.readJournal(blocked.directory).filter((e) => e.kind === 'dispatch').length, 0);
  const unapprovedOffline = experiments.analyzeSaved({ saved: [blocked.directory] });
  assert.equal(unapprovedOffline.report.controller.status, 'proposal-without-evidence');
  assert.equal(unapprovedOffline.report.cost.attempts, 0);
  assert.deepEqual(unapprovedOffline.report.offlineAnalysis, { freshAttempts: 0, modelCalls: 0, judgeCalls: 0 });
  const command = path.join(scratch, 'double.js');
  const validDesigns = Object.fromEntries(
    [
      ['7', 'seeded-correct-run'],
      ['9', 'clean-correct-run'],
    ].map(([epic, fixture]) => [epic, fs.readFileSync(path.join(root, 'test/replay/test-design', fixture, 'design.md'), 'utf8')]),
  );
  const designProjection = nativeParser.scoredRiskProjection(nativeParser.readDesign({ kind: 'text', value: validDesigns['7'] }).design);
  assert.equal(
    legacyHarness.readObservedDesign(
      { kind: 'text', value: validDesigns['7'] },
      { kind: 'json', value: { ...designProjection, sourceCapture: {} } },
    ).ok,
    false,
    'ordinary projection comparison remains strict',
  );
  fs.writeFileSync(
    command,
    String.raw`#!/usr/bin/env node
const fs=require('node:fs');const path=require('node:path');
if(process.argv.includes('--version')){console.log('deterministic-double 1.0.0');process.exit(0);}
const prompt=fs.readFileSync(0,'utf8');
const effort=process.argv.includes('--force-high')?'high':process.argv.includes('--effort')?process.argv[process.argv.indexOf('--effort')+1]:'high';
const missing=process.argv.includes('--missing-effort');
const project=/project in \x60([^\x60]+)\//.exec(prompt)[1];
const epic=/epic_num\x60: \x60([^\x60]+)\x60/.exec(prompt)[1];
const destination=path.join(project,'test-artifacts/test-design','test-design-epic-'+epic+'.md');
fs.mkdirSync(path.dirname(destination),{recursive:true});
const designs=${JSON.stringify(validDesigns)};
if(!process.argv.includes('--absent-output'))fs.writeFileSync(destination,process.argv.includes('--invalid-output')?'# Unparseable native design\n':designs[epic]);
if(process.argv.includes('--mutate-input')){const dir=path.join(project,'docs/epics');fs.appendFileSync(path.join(dir,fs.readdirSync(dir)[0]),'modified input bytes');}
if(process.argv.includes('--forge-capture')){const source=JSON.parse(fs.readFileSync('source-capture.json','utf8'));fs.unlinkSync('source-capture.json');source.status='completed';source.endedAt=new Date().toISOString();source.observed={resolvedModel:'double-model',appliedEffort:'high'};source.cost={currency:'USD',components:{target:0,tools:0}};fs.writeFileSync('source-capture.json',JSON.stringify(source));}
const value=flag=>process.argv.includes(flag)?Number(process.argv[process.argv.indexOf(flag)+1]):undefined;
process.stderr.write('TEA_EXPERIMENT_TEST_TELEMETRY:'+(process.argv.includes('--malformed-telemetry')?'{bad-json':JSON.stringify({observed:{resolvedModel:'double-model',appliedEffort:missing?null:effort},usage:{inputTokens:1,outputTokens:1},cost:{currency:'USD',components:{target:value('--target-cost')??0.01,tools:value('--tool-cost')??0}}}))+'\n');
if(process.argv.includes('--fail'))process.exit(1);
if(process.argv.includes('--fail-first')){const state=process.argv[process.argv.indexOf('--fail-first')+1];if(!fs.existsSync(state)){fs.writeFileSync(state,'failed');process.exit(1);}}
`,
    { mode: 0o755 },
  );
  const td = double(command);
  const runnerKeys = require('../cli/test-design-runner').TEST_DESIGN_REQUEST_KEYS;
  const generatedRequest = json(path.join(root, 'test/contracts/test-design.contract.json')).permittedInterfaces[0].operations[0]
    .requestShape.option;
  for (const key of ['capture-path', 'capture-test-double']) {
    assert.ok(runnerKeys.option.permitted.includes(key));
    assert.ok(generatedRequest.permittedKeys.includes(key));
  }
  assert.equal(generatedRequest.types['capture-test-double'], 'boolean');
  for (const [name, options, exit] of [
    ['missing-parent', ['--capture-path', 'missing/source.json'], 2],
    ['invalid-model', ['--capture-path', 'source-capture.json', '--model', 'bad model'], 3],
  ]) {
    const dir = path.join(scratch, `setup-${name}`);
    fs.mkdirSync(dir);
    const failedSetup = spawnSync(
      process.execPath,
      [path.join(root, 'cli/test-design-runner.js'), '--agent', 'custom', '--agent-cmd', process.execPath, ...options],
      { cwd: dir, input: 'deterministic setup boundary', encoding: 'utf8' },
    );
    assert.equal(failedSetup.status, exit, failedSetup.stderr);
    assert.doesNotMatch(failedSetup.stderr, /\n\s+at /);
    assert.equal(fs.existsSync(path.join(dir, 'source-capture.json')), false);
  }
  const leaked = freeze('ground-truth-leak', { testDouble: td });
  approve(leaked);
  const originalStage = staging.stageWorkspace;
  const originalLeakCheck = staging.assertGroundTruthAbsent;
  let leakedDirectory;
  staging.stageWorkspace = async (...args) => {
    const workspace = await originalStage(...args);
    leakedDirectory = workspace.dir;
    return workspace;
  };
  staging.assertGroundTruthAbsent = async () => ['synthetic ground-truth leak'];
  try {
    await assert.rejects(experiments.executePlan(leaked.directory, { testDouble: td }), /synthetic ground-truth leak/);
  } finally {
    staging.stageWorkspace = originalStage;
    staging.assertGroundTruthAbsent = originalLeakCheck;
  }
  assert.equal(fs.existsSync(leakedDirectory), false);
  assert.equal(experiments.readJournal(leaked.directory).filter((entry) => ['reserved', 'dispatch'].includes(entry.kind)).length, 0);
  const forgedDouble = { ...td, args: ['--forge-capture'] };
  const forged = freeze('forged-capture', { testDouble: forgedDouble });
  approve(forged);
  const forgedResult = await experiments.executePlan(forged.directory, { testDouble: forgedDouble });
  assert.equal(forgedResult.status, 'recovery-required');
  const forgedJournal = experiments.readJournal(forged.directory);
  assert.equal(forgedJournal.filter((entry) => entry.kind === 'dispatch').length, 1);
  assert.equal(forgedJournal.filter((entry) => entry.kind === 'settled').length, 0);
  assert.ok(fs.existsSync(forgedResult.unresolvedReservations[0].originalWorkspace));
  const trustedRecovery = json(path.join(forgedResult.stopped.partialArchive, 'runner-source-result.json'));
  assert.equal(trustedRecovery.status, 'rejected');
  assert.equal(trustedRecovery.source.cost.components.target, 0.01);
  const forgedAnalysis = experiments.analyzeSaved({ saved: [forged.directory] });
  assert.equal(forgedAnalysis.report.cost.attempts, 1);
  assert.equal(forgedAnalysis.report.cost.experimentTotal.total, null);
  assert.throws(() => experiments.analyzeSaved({ saved: [forgedResult.stopped.partialArchive] }), /Rejected source capture/);
  const forgedHarnessArtifacts = path.join(scratch, 'forged-native-harness');
  const forgedHarness = spawnSync(
    process.execPath,
    [
      'test/eval-test-design.js',
      '--agent',
      'custom',
      '--agent-cmd',
      command,
      '--agent-arg',
      '--forge-capture',
      '--runs',
      '1',
      '--set',
      scoring.loadGroundTruth().fixtureSets[0].id,
      '--experiment-capture',
      '--artifacts-dir',
      forgedHarnessArtifacts,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(forgedHarness.status, 0);
  assert.match(forgedHarness.stderr, /Source capture integrity rejected/);
  assert.equal(fs.readdirSync(forgedHarnessArtifacts).length, 1);
  const harnessPartial = path.join(forgedHarnessArtifacts, fs.readdirSync(forgedHarnessArtifacts)[0]);
  assert.equal(fs.existsSync(path.join(harnessPartial, 'manifest.json')), false);
  const harnessOriginal = json(path.join(harnessPartial, 'provenance.json')).originalWorkspace;
  assert.ok(fs.existsSync(harnessOriginal));
  const fakeClaude = path.join(scratch, 'fake-claude.cjs');
  const fakeReport = {
    result: 'recorded answer',
    usage: { input_tokens: 7, output_tokens: 3 },
    modelUsage: { 'claude-observed': { outputTokens: 3 } },
  };
  fs.writeFileSync(
    fakeClaude,
    `#!/usr/bin/env node\nconst fs=require('node:fs');fs.readFileSync(0,'utf8');fs.writeFileSync('design.md',${JSON.stringify(validDesigns['7'])});process.stdout.write(${JSON.stringify(JSON.stringify(fakeReport))});process.stderr.write('raw provider stderr');`,
    { mode: 0o755 },
  );
  const claudeWorkspace = path.join(scratch, 'claude-missing-cost');
  fs.mkdirSync(claudeWorkspace);
  const claudeCapture = spawnSync(
    process.execPath,
    [
      path.join(root, 'cli/test-design-runner.js'),
      '--agent',
      'claude',
      '--agent-cmd',
      fakeClaude,
      '--capture-path',
      'source-capture.json',
      '--design-path',
      'design.md',
    ],
    { cwd: claudeWorkspace, input: 'offline adapter double', encoding: 'utf8' },
  );
  assert.equal(claudeCapture.status, 0, claudeCapture.stderr);
  const partialTelemetry = json(path.join(claudeWorkspace, 'source-capture.json'));
  assert.equal(partialTelemetry.providerStdout, JSON.stringify(fakeReport));
  assert.equal(partialTelemetry.providerStderr, 'raw provider stderr');
  assert.equal(partialTelemetry.observed.resolvedModel, 'claude-observed');
  assert.deepEqual(partialTelemetry.usage, { inputTokens: 7, outputTokens: 3 });
  assert.equal(partialTelemetry.cost, null);
  assert.match(partialTelemetry.telemetryErrors[0], /incomplete token or cost/);
  const adapter = require('../cli/lib/agent-adapters');
  const codexTokens = JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 4 } });
  assert.equal(adapter.agentReplyAndUsage('codex', codexTokens, '').usage, null);
  const codexCapture = adapter.agentCaptureTelemetry('codex', codexTokens, '');
  assert.deepEqual(codexCapture.usage, { inputTokens: 12, outputTokens: 4 });
  assert.match(codexCapture.errors.join(';'), /money.*unavailable/);
  const fakeCodex = path.join(scratch, 'fake-codex.cjs');
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node\nconst fs=require('node:fs');fs.readFileSync(0,'utf8');fs.writeFileSync('design.md',${JSON.stringify(validDesigns['7'])});process.stdout.write(${JSON.stringify(codexTokens)});`,
    { mode: 0o755 },
  );
  const codexWorkspace = path.join(scratch, 'codex-missing-money');
  fs.mkdirSync(codexWorkspace);
  const codexRun = spawnSync(
    process.execPath,
    [
      path.join(root, 'cli/test-design-runner.js'),
      '--agent',
      'codex',
      '--agent-cmd',
      fakeCodex,
      '--capture-path',
      'source-capture.json',
      '--design-path',
      'design.md',
    ],
    { cwd: codexWorkspace, input: 'offline codex adapter double', encoding: 'utf8' },
  );
  assert.equal(codexRun.status, 0, codexRun.stderr);
  const codexSource = json(path.join(codexWorkspace, 'source-capture.json'));
  assert.deepEqual(codexSource.usage, { inputTokens: 12, outputTokens: 4 });
  assert.equal(codexSource.cost, null);
  assert.match(codexSource.telemetryErrors.join(';'), /money.*unavailable/);
  assert.equal(codexSource.providerStdout, codexTokens);
  for (const [name, args, failureClass] of [
    ['absent', ['--absent-output'], 'environment-missing-artifact'],
    ['invalid', ['--invalid-output'], 'environment-parser'],
  ]) {
    const ordinarySet = scoring.loadGroundTruth().fixtureSets[0];
    const ordinaryWorkspace = await staging.stageWorkspace(ordinarySet);
    try {
      const ordinaryDeliverable = spawnSync(
        process.execPath,
        [
          path.join(root, 'cli/test-design-runner.js'),
          '--agent',
          'custom',
          '--agent-cmd',
          command,
          '--agent-arg',
          args[0],
          '--design-path',
          staging.designArtifactPaths(ordinarySet).design,
        ],
        { cwd: ordinaryWorkspace.dir, input: staging.buildPrompt(ordinarySet), encoding: 'utf8' },
      );
      assert.equal(ordinaryDeliverable.status, 0, ordinaryDeliverable.stderr);
      if (name === 'absent') assert.equal(ordinaryDeliverable.stdout, '');
      else assert.match(JSON.parse(ordinaryDeliverable.stdout).design, /Unparseable native design/);
      assert.equal(fs.existsSync(path.join(ordinaryWorkspace.dir, 'source-capture.json')), false);
    } finally {
      fs.rmSync(ordinaryWorkspace.dir, { recursive: true, force: true });
    }
    const decl = declaration();
    decl.design.maxAttempts = 2;
    decl.frozen = { digest: reader.declarationDigest(decl) };
    const badDouble = { ...td, args };
    const bad = freeze(`deliverable-${name}`, { decl, testDouble: badDouble });
    approve(bad);
    const failed = await experiments.executePlan(bad.directory, { testDouble: badDouble });
    assert.equal(failed.report.cost.attempts, 4);
    for (const entry of experiments.readJournal(bad.directory).filter((entry) => entry.kind === 'sealed')) {
      const dir = path.join(bad.directory, entry.directory);
      const diagnostic = json(path.join(dir, 'diagnostic.json'));
      assert.equal(diagnostic.completionState, 'failed');
      assert.equal(diagnostic.failureClass, failureClass);
      assert.equal(diagnostic.qualification, 'failed');
      const captured = json(path.join(dir, 'workspace/source-capture.json'));
      assert.deepEqual(captured.processOutcome, { status: 'completed', exitCode: 0 });
      assert.equal(captured.status, 'failed');
    }
  }
  const malformedWorkspace = await staging.stageWorkspace(scoring.loadGroundTruth().fixtureSets[0]);
  try {
    const malformed = spawnSync(
      process.execPath,
      [
        path.join(root, 'cli/test-design-runner.js'),
        '--agent',
        'custom',
        '--agent-cmd',
        command,
        '--agent-arg',
        '--malformed-telemetry',
        '--agent-arg',
        '--fail',
        '--capture-test-double',
        '--capture-path',
        'source-capture.json',
      ],
      { cwd: malformedWorkspace.dir, input: staging.buildPrompt(scoring.loadGroundTruth().fixtureSets[0]), encoding: 'utf8' },
    );
    assert.equal(malformed.status, 4, malformed.stderr);
    const malformedSource = json(path.join(malformedWorkspace.dir, 'source-capture.json'));
    assert.equal(malformedSource.status, 'failed');
    assert.ok(malformedSource.endedAt);
    assert.equal(malformedSource.cost, null);
    assert.match(malformedSource.providerStderr, /bad-json/);
    assert.match(malformedSource.telemetryErrors.join(';'), /telemetry unavailable/);
    assert.equal(JSON.parse(malformed.stdout).sourceCapture.status, 'verified');
  } finally {
    fs.rmSync(malformedWorkspace.dir, { recursive: true, force: true });
  }
  const defaultAttemptsDecl = declaration();
  delete defaultAttemptsDecl.design.maxAttempts;
  defaultAttemptsDecl.frozen = { digest: reader.declarationDigest(defaultAttemptsDecl) };
  const defaultAttempts = freeze('default-max-attempts', { decl: defaultAttemptsDecl, testDouble: td });
  assert.equal(defaultAttempts.plan.declaration.design.maxAttempts, 1);
  assert.equal(defaultAttempts.plan.maxAttempts, 2);
  approve(defaultAttempts);
  assert.equal((await experiments.executePlan(defaultAttempts.directory, { testDouble: td })).report.cost.attempts, 2);
  const captureTamper = path.join(scratch, 'capture-tamper.cjs');
  fs.writeFileSync(
    captureTamper,
    `const fs=require('node:fs');fs.readFileSync(0,'utf8');const [mode,outside]=process.argv.slice(2);
if(mode==='extra-hardlink')fs.linkSync('source-capture.json',outside);
else if(mode==='in-place')fs.writeFileSync('source-capture.json','changed receipt bytes');
else {fs.unlinkSync('source-capture.json');if(mode==='symlink')fs.symlinkSync(outside,'source-capture.json');else fs.linkSync(outside,'source-capture.json');}
fs.writeFileSync('design.md','# Deterministic document\\n');`,
  );
  const captureFault = path.join(scratch, 'capture-io-fault.cjs');
  fs.writeFileSync(
    captureFault,
    String.raw`
const fs=require('node:fs');const mode=process.env.TEA_CAPTURE_FAULT_MODE;const audit=process.env.TEA_CAPTURE_AUDIT;
const open=fs.openSync,close=fs.closeSync,writeFile=fs.writeFileSync,write=fs.writeSync,stat=fs.fstatSync;let captureFd=null,recoveryFd=null;const closed=new Set();
fs.openSync=function(file,flags,...args){if(typeof file==='string'&&file.includes('source-capture-recovery-')&&mode==='recovery-open')throw new Error('injected recovery open failure');const fd=open(file,flags,...args);if(typeof file==='string'&&file.endsWith('source-capture.json')&&flags==='wx+')captureFd=fd;if(typeof file==='string'&&file.includes('source-capture-recovery-'))recoveryFd=fd;return fd;};
fs.closeSync=function(fd){const value=close(fd);closed.add(fd);return value;};
fs.fstatSync=function(fd,...args){if(fd===captureFd&&mode==='initial-stat')throw new Error('injected capture stat failure');return stat(fd,...args);};
fs.writeSync=function(fd,...args){if(fd===captureFd&&mode==='initial-write')throw new Error('injected capture write failure');return write(fd,...args);};
fs.writeFileSync=function(file,...args){if(file===recoveryFd&&mode==='recovery-write')throw new Error('injected recovery write failure');return writeFile(file,...args);};
process.on('exit',()=>writeFile(audit,JSON.stringify({captureClosed:closed.has(captureFd),recoveryClosed:recoveryFd===null||closed.has(recoveryFd)})));
`,
  );
  for (const mode of ['initial-stat', 'initial-write', 'recovery-open', 'recovery-write']) {
    const dir = path.join(scratch, `capture-io-${mode}`);
    fs.mkdirSync(dir);
    const audit = path.join(scratch, `capture-io-${mode}.json`);
    const fault = spawnSync(
      process.execPath,
      [
        '--require',
        captureFault,
        path.join(root, 'cli/test-design-runner.js'),
        '--agent',
        'custom',
        '--agent-cmd',
        process.execPath,
        '--agent-arg',
        captureTamper,
        '--agent-arg',
        'in-place',
        '--agent-arg',
        path.join(scratch, 'unused-outside'),
        '--capture-path',
        'source-capture.json',
      ],
      {
        cwd: dir,
        input: 'deterministic capture I/O fault',
        encoding: 'utf8',
        env: { ...process.env, TEA_CAPTURE_FAULT_MODE: mode, TEA_CAPTURE_AUDIT: audit },
      },
    );
    assert.equal(fault.status, 3, fault.stderr);
    assert.doesNotMatch(fault.stderr, /\n\s+at /);
    assert.deepEqual(json(audit), { captureClosed: true, recoveryClosed: true });
    if (mode.startsWith('recovery')) {
      assert.match(fault.stderr, /source capture bytes changed.*recovery receipt could not be preserved.*injected recovery/);
      assert.equal(JSON.parse(fault.stdout).sourceCapture.status, 'unverified');
    } else {
      assert.match(fault.stderr, /could not initialize source capture.*injected capture/);
      assert.equal(fs.existsSync(path.join(dir, 'design.md')), false);
    }
  }
  for (const mode of ['symlink', 'replacement-hardlink', 'extra-hardlink', 'in-place']) {
    const workspace = path.join(scratch, `capture-${mode}`);
    fs.mkdirSync(workspace);
    const outside = path.join(scratch, `outside-${mode}.txt`);
    if (mode !== 'extra-hardlink') fs.writeFileSync(outside, 'outside sentinel bytes');
    const tampered = spawnSync(
      process.execPath,
      [
        path.join(root, 'cli/test-design-runner.js'),
        '--agent',
        'custom',
        '--agent-cmd',
        process.execPath,
        '--agent-arg',
        captureTamper,
        '--agent-arg',
        mode,
        '--agent-arg',
        outside,
        '--capture-path',
        'source-capture.json',
        '--design-path',
        'design.md',
      ],
      { cwd: workspace, input: 'deterministic source capture integrity check', encoding: 'utf8' },
    );
    assert.equal(tampered.status, 3, `${mode}: ${tampered.stderr}`);
    assert.match(tampered.stderr, /source capture .*changed; source evidence preserved/);
    if (mode === 'extra-hardlink') assert.equal(json(outside).status, 'dispatched');
    else assert.equal(fs.readFileSync(outside, 'utf8'), 'outside sentinel bytes');
    const recoveryFiles = fs.readdirSync(workspace).filter((name) => name.startsWith('source-capture-recovery-'));
    assert.equal(recoveryFiles.length, 1);
    const recovered = json(path.join(workspace, recoveryFiles[0]));
    assert.equal(recovered.status, 'failed');
    assert.equal(recovered.captureIntegrityViolation.agentStatus, 'completed');
    assert.equal(recovered.inputSha256, sha('deterministic source capture integrity check'));
    assert.ok(fs.existsSync(path.join(workspace, 'design.md')));
  }
  const harnessArtifacts = path.join(scratch, 'checkout-native-double');
  const harness = spawnSync(
    process.execPath,
    [
      'test/eval-test-design.js',
      '--agent',
      'custom',
      '--agent-cmd',
      command,
      '--runs',
      '2',
      '--experiment-capture',
      '--artifacts-dir',
      harnessArtifacts,
      '--json',
      path.join(scratch, 'checkout-native-double-result.json'),
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(harness.status, 0, harness.stderr + harness.stdout);
  const harnessAttempts = fs.readdirSync(harnessArtifacts).map((name) => path.join(harnessArtifacts, name));
  assert.equal(harnessAttempts.length, 4);
  assert.equal(new Set(harnessAttempts.map((dir) => json(path.join(dir, 'provenance.json')).evaluationId)).size, 1);
  for (const directory of harnessAttempts) {
    assert.ok(fs.existsSync(path.join(directory, 'diagnostic.json')));
    assert.ok(fs.existsSync(path.join(directory, 'manifest.json')));
    const provenance = json(path.join(directory, 'provenance.json'));
    assert.ok(provenance.receipt.workspaceId);
    assert.equal(provenance.observed.arm.effort.applied, null);
  }

  const successful = freeze('successful', { testDouble: td });
  assert.throws(
    () => experiments.approvePlan(successful.directory, { approved: true, approvedBy: 'test', planDigest: 'wrong', maxUsd: 1 }),
    /exact frozen plan/,
  );
  await assert.rejects(experiments.executePlan(successful.directory, { testDouble: td }), /approval/);
  approve(successful);
  const result = await experiments.executePlan(successful.directory, { testDouble: td });
  assert.equal(result.report.controller.attempts, 2);
  assert.equal(result.report.controller.recovery.status, 'settled');
  const journal = experiments.readJournal(successful.directory);
  const sourceDirs = journal.filter((e) => e.kind === 'sealed').map((e) => path.join(successful.directory, e.directory));
  const receipts = sourceDirs.map((dir) => json(path.join(dir, 'provenance.json')).receipt);
  for (const dir of sourceDirs) {
    const diagnostic = json(path.join(dir, 'diagnostic.json'));
    assert.equal(diagnostic.qualification, 'passed');
    assert.equal(diagnostic.failureClass, 'none');
  }
  assert.equal(new Set(receipts.map((r) => r.workspaceId)).size, 2);
  assert.ok(receipts.every((r) => r.artifactSha256));
  assert.equal(
    journal.filter((e) => e.kind === 'settled').reduce((a, e) => a + e.chargeUsd, 0),
    0.02,
  );
  assert.equal(result.report.cost.attempts, 2);
  assert.ok(result.evidenceIndex.rows.every((row) => row.nativeSource === 'manifest-checked'));
  assert.equal(journal[0].kind, 'frozen');
  assert.equal(journal[1].kind, 'approved');
  const legacyRace = path.join(scratch, 'legacy-byte-race');
  fs.cpSync(path.join(root, 'test/fixtures/configuration-experiment/paired-example/incumbent-run'), legacyRace, { recursive: true });
  const legacyProvenance = path.join(legacyRace, 'cases/seeded-offline-order-capture-run-1/provenance.json');
  const expectedLegacyCost = json(legacyProvenance).cost;
  const raceLoaded = editAfterCheckedRead(legacyProvenance, () => reader.loadRecordedTestDesignRun({ dir: legacyRace }));
  assert.deepEqual(raceLoaded.rows[0].cost, expectedLegacyCost);
  assert.deepEqual(raceLoaded.integrity.problems, []);
  const sealedRace = path.join(scratch, 'sealed-byte-race');
  fs.cpSync(sourceDirs[0], sealedRace, { recursive: true });
  const sealedProvenance = path.join(sealedRace, 'provenance.json');
  const expectedSealedCost = json(sealedProvenance).cost;
  assert.deepEqual(
    editAfterCheckedRead(sealedProvenance, () => reader.loadSealedTestDesignAttempt({ dir: sealedRace })).rows[0].cost,
    expectedSealedCost,
  );
  const journalManifestRace = path.join(scratch, 'journal-manifest-race');
  fs.cpSync(successful.directory, journalManifestRace, { recursive: true });
  const boundManifest = path.join(journalManifestRace, journal.find((entry) => entry.kind === 'sealed').directory, 'manifest.json');
  const checkedManifestRead = fs.readFileSync;
  let replacedManifest = false;
  fs.readFileSync = (file, ...args) => {
    const bytes = checkedManifestRead(file, ...args);
    if (!replacedManifest && typeof file === 'string' && path.resolve(file) === boundManifest) {
      replacedManifest = true;
      fs.writeFileSync(boundManifest, JSON.stringify({ ...JSON.parse(bytes), replacedAfterJournalCheck: true }));
    }
    return bytes;
  };
  try {
    assert.throws(() => experiments.analyzeSaved({ saved: [journalManifestRace] }), /Sealed manifest differs from controller journal/);
    assert.equal(replacedManifest, true);
  } finally {
    fs.readFileSync = checkedManifestRead;
  }
  for (const mode of ['symlink', 'hardlink', 'in-place']) {
    const swapped = freeze(`post-run-${mode}`, { testDouble: td });
    approve(swapped);
    const outsideReceipt = path.join(scratch, `${mode}-receipt-copy.json`);
    const swappedResult = await experiments.executePlan(swapped.directory, {
      testDouble: td,
      afterDispatch: ({ workspace }) => {
        const receipt = path.join(workspace.dir, 'source-capture.json');
        if (mode === 'in-place') {
          const changed = json(receipt);
          changed.cost.components.target = 0;
          fs.writeFileSync(receipt, JSON.stringify(changed));
          return;
        }
        fs.copyFileSync(receipt, outsideReceipt);
        fs.unlinkSync(receipt);
        if (mode === 'symlink') fs.symlinkSync(outsideReceipt, receipt);
        else fs.linkSync(outsideReceipt, receipt);
      },
    });
    assert.equal(swappedResult.status, 'recovery-required');
    assert.equal(experiments.readJournal(swapped.directory).filter((entry) => entry.kind === 'settled').length, 0);
    assert.equal(experiments.readJournal(swapped.directory).filter((entry) => entry.kind === 'dispatch').length, 1);
    assert.ok(fs.existsSync(swappedResult.unresolvedReservations[0].originalWorkspace));
  }
  for (const mode of ['integrity-violation', 'completion-mismatch']) {
    const invalidSource = path.join(scratch, `invalid-sealed-${mode}`);
    fs.cpSync(sourceDirs[0], invalidSource, { recursive: true });
    const sourceFile = path.join(invalidSource, 'workspace/source-capture.json');
    const source = json(sourceFile);
    if (mode === 'integrity-violation') source.captureIntegrityViolation = { reason: 'rejected earlier' };
    else source.status = 'failed';
    fs.writeFileSync(sourceFile, JSON.stringify(source));
    const observationFile = path.join(invalidSource, 'observation.json');
    const observation = json(observationFile);
    observation.stdout.value.sourceCapture.sha256 = sha(fs.readFileSync(sourceFile));
    fs.writeFileSync(observationFile, JSON.stringify(observation));
    fs.unlinkSync(path.join(invalidSource, 'manifest.json'));
    experiments.sealAttemptArchive(invalidSource);
    assert.throws(() => experiments.analyzeSaved({ saved: [invalidSource] }), /Rejected or unverified source capture/);
  }
  const relocated = path.join(scratch, 'relocated-experiment');
  fs.cpSync(successful.directory, relocated, { recursive: true });
  const temporarilyHidden = `${successful.directory}-hidden`;
  fs.renameSync(successful.directory, temporarilyHidden);
  try {
    assert.equal(experiments.analyzeSaved({ saved: [relocated] }).report.cost.attempts, 2);
  } finally {
    fs.renameSync(temporarilyHidden, successful.directory);
  }
  const relocatedArchive = path.join(relocated, journal.find((entry) => entry.kind === 'sealed').directory);
  const relocatedManifest = json(path.join(relocatedArchive, 'manifest.json'));
  fs.appendFileSync(path.join(relocatedArchive, relocatedManifest.files[0].path), 'corrupted relocated bytes');
  assert.throws(() => experiments.analyzeSaved({ saved: [relocated] }), /integrity failure/);
  const rechain = (entries) => {
    let previous = null;
    return (
      entries
        .map((entry, index) => {
          const rest = { ...entry };
          delete rest.hash;
          const payload = { ...rest, sequence: index + 1, previous };
          previous = reader.digestOf(payload);
          return JSON.stringify({ ...payload, hash: previous });
        })
        .join('\n') + '\n'
    );
  };
  for (const [name, mutate, message] of [
    ['duplicate-freeze', (entries) => entries.splice(1, 0, entries[0]), /one frozen first/],
    ['late-approval', (entries) => entries.push(entries.splice(1, 1)[0]), /prior approval/],
    [
      'dispatch-before-reserve',
      (entries) => {
        const reserved = entries.findIndex((entry) => entry.kind === 'reserved');
        [entries[reserved], entries[reserved + 1]] = [entries[reserved + 1], entries[reserved]];
      },
      /ordering failure/,
    ],
  ]) {
    const target = path.join(scratch, name);
    fs.cpSync(successful.directory, target, { recursive: true });
    const entries = structuredClone(journal);
    mutate(entries);
    fs.writeFileSync(path.join(target, 'journal.jsonl'), rechain(entries));
    assert.throws(() => experiments.analyzeSaved({ saved: [target] }), message);
  }
  await assert.rejects(experiments.executePlan(successful.directory, { testDouble: td }), /executes once/);
  const pairedDecl = json(path.join(__dirname, 'fixtures/configuration-experiment/paired-example/experiment.json'));
  pairedDecl.identity.fixed = experiments.nativeIdentity();
  pairedDecl.design.repeats = 1;
  pairedDecl.design.analysis.B = 1000;
  pairedDecl.identity.arms.A.model = { requested: 'double-model', resolved: 'double-model' };
  pairedDecl.identity.arms.B.model = { requested: 'double-model', resolved: 'double-model' };
  pairedDecl.frozen = { digest: reader.declarationDigest(pairedDecl) };
  const pairedDouble = { ...td, args: ['--effort', '{effort}'] };
  const paired = freeze('paired', { decl: pairedDecl, testDouble: pairedDouble });
  approve(paired);
  const pairedResult = await experiments.executePlan(paired.directory, { testDouble: pairedDouble });
  assert.equal(pairedResult.report.controller.attempts, 4);
  assert.ok(!JSON.stringify(pairedResult.report.contrast).includes('is not recorded in the ledger'));
  assert.deepEqual(
    experiments
      .readJournal(paired.directory)
      .filter((e) => e.kind === 'exposure')
      .map((e) => e.entry.kind),
    ['selection-exposure', 'selection-exposure'],
  );
  assert.ok(pairedResult.evidenceIndex.rows.every((row) => row.nativeSource === 'manifest-checked'));
  const pairedRecords = experiments
    .readJournal(paired.directory)
    .filter((e) => e.kind === 'sealed')
    .map((e) => json(path.join(paired.directory, e.directory, 'provenance.json')));
  assert.deepEqual(
    pairedRecords.map((p) => p.observed.arm.effort.applied),
    ['high', 'medium', 'high', 'medium'],
  );
  assert.ok(pairedResult.report.contrast.decision.outcome !== 'recommend');
  assert.deepEqual(pairedResult.report.contrast.nativeRed, []);
  const mutationDouble = { ...td, args: ['--mutate-input'] };
  const mutation = freeze('mutated-input', { testDouble: mutationDouble });
  approve(mutation);
  const mutationReport = await experiments.executePlan(mutation.directory, { testDouble: mutationDouble });
  const mutationRecords = experiments
    .readJournal(mutation.directory)
    .filter((e) => e.kind === 'sealed')
    .map((e) => json(path.join(mutation.directory, e.directory, 'diagnostic.json')));
  assert.ok(
    mutationRecords.every(
      (record) =>
        record.qualification === 'failed' &&
        record.failureClass === 'environment-configuration' &&
        record.metricContributions.fixtureMutations > 0,
    ),
  );
  assert.equal(mutationReport.report.cost.attempts, 2);
  for (const entry of experiments.readJournal(mutation.directory).filter((entry) => entry.kind === 'sealed')) {
    assert.notEqual(
      json(path.join(mutation.directory, entry.directory, 'provenance.json')).observed.fixed.inputTreeDigest,
      mutation.plan.declaration.identity.fixed.inputTreeDigest,
    );
  }
  const missingDouble = { ...td, args: ['--effort', '{effort}', '--missing-effort'] };
  const missing = freeze('missing-identity', { decl: pairedDecl, testDouble: missingDouble });
  approve(missing);
  const missingResult = await experiments.executePlan(missing.directory, { testDouble: missingDouble });
  assert.equal(missingResult.status, 'recovery-required');
  assert.equal(experiments.readJournal(missing.directory).filter((e) => e.kind === 'dispatch').length, 1);
  const unappliedDouble = { ...td, args: ['--effort', '{effort}', '--force-high'] };
  const unapplied = freeze('unapplied-factor', { decl: pairedDecl, testDouble: unappliedDouble });
  approve(unapplied);
  const unappliedResult = await experiments.executePlan(unapplied.directory, { testDouble: unappliedDouble });
  assert.ok(['blocked', 'new-baseline-required', 'revised-design-required'].includes(unappliedResult.report.contrast.decision.outcome));
  assert.equal(unappliedResult.report.cost.attempts, 4);
  const unsupported = freeze('factor-not-applied', { decl: pairedDecl, testDouble: td });
  assert.throws(() => approve(unsupported), /changed value/);
  assert.equal(experiments.readJournal(unsupported.directory).filter((e) => e.kind === 'dispatch').length, 0);
  const retryDecl = declaration();
  retryDecl.design.maxAttempts = 2;
  retryDecl.frozen = { digest: reader.declarationDigest(retryDecl) };
  const retryDouble = { ...td, args: ['--fail-first', path.join(scratch, 'failed-once')] };
  const retries = freeze('retry', { decl: retryDecl, testDouble: retryDouble });
  approve(retries);
  const retryResult = await experiments.executePlan(retries.directory, { testDouble: retryDouble });
  assert.equal(retryResult.report.controller.attempts, 3);
  assert.equal(retryResult.report.cost.attempts, 3);
  assert.equal(
    experiments
      .readJournal(retries.directory)
      .filter((e) => e.kind === 'settled')
      .reduce((sum, e) => sum + e.chargeUsd, 0),
    0.03,
  );
  const retryProvenance = experiments
    .readJournal(retries.directory)
    .filter((e) => e.kind === 'sealed')
    .map((e) => json(path.join(retries.directory, e.directory, 'provenance.json')));
  assert.deepEqual(
    retryProvenance.map((p) => p.status),
    ['failed', 'completed', 'completed'],
  );
  assert.equal(new Set(retryProvenance.map((p) => p.receipt.workspaceId)).size, 3);
  const stageDecl = declaration();
  stageDecl.scope.memberships.development = [nativeGroundTruth.fixtureSets[0].id];
  stageDecl.scope.memberships.validation = [nativeGroundTruth.fixtureSets[1].id];
  stageDecl.frozen = { digest: reader.declarationDigest(stageDecl) };
  const stagePlan = freeze('baseline-stage-cases', { decl: stageDecl, testDouble: td });
  assert.equal(stagePlan.plan.schedule.length, 1);
  assert.equal(stagePlan.plan.maxAttempts, 1);
  assert.equal(stagePlan.plan.estimatedElapsedMs, 65_000);
  assert.equal(stagePlan.plan.money.upperBoundUsd, 0.01);
  approve(stagePlan);
  assert.equal((await experiments.executePlan(stagePlan.directory, { testDouble: td })).report.cost.attempts, 1);
  const selectionStageDecl = structuredClone(pairedDecl);
  selectionStageDecl.scope.memberships.development = [nativeGroundTruth.fixtureSets[0].id];
  selectionStageDecl.scope.memberships.validation = [nativeGroundTruth.fixtureSets[1].id];
  selectionStageDecl.frozen = { digest: reader.declarationDigest(selectionStageDecl) };
  const selectionPlan = freeze('selection-stage-cases', { decl: selectionStageDecl, testDouble: pairedDouble });
  assert.equal(selectionPlan.plan.schedule.length, 4);
  assert.equal(selectionPlan.plan.money.upperBoundUsd, 0.04);
  for (const [name, amount, cap, args] of [
    ['six-cents', 0.01, 0.06, []],
    ['decimal-components', 0.3, 1.8, ['--target-cost', '0.1', '--tool-cost', '0.2']],
  ]) {
    const moneyDecl = declaration();
    moneyDecl.design.repeats = 3;
    moneyDecl.frozen = { digest: reader.declarationDigest(moneyDecl) };
    const moneyDouble = { ...td, boundUsd: amount, args };
    const money = freeze(name, { decl: moneyDecl, testDouble: moneyDouble, maxUsd: cap });
    approve(money);
    const moneyResult = await experiments.executePlan(money.directory, { testDouble: moneyDouble });
    assert.equal(moneyResult.report.cost.attempts, 6);
    const settlements = experiments.readJournal(money.directory).filter((entry) => entry.kind === 'settled');
    assert.equal(settlements.length, 6);
    assert.equal(settlements.at(-1).totalUsd, cap);
    assert.equal(Number(settlements.at(-1).totalUsdExact), cap);
  }
  const confirmationDecl = structuredClone(pairedDecl);
  confirmationDecl.stage = 'confirmation';
  confirmationDecl.frozen = { digest: reader.declarationDigest(confirmationDecl) };
  const confirmation = freeze('confirmation', { decl: confirmationDecl, testDouble: pairedDouble });
  assert.throws(() => approve(confirmation), /unseen/);
  assert.equal(experiments.readJournal(confirmation.directory).filter((e) => e.kind === 'dispatch').length, 0);
  // Retention-shaped import and deterministic scorer replay must work with every launch forbidden.
  const rawWorkspace = await staging.stageWorkspace(scoring.loadGroundTruth().fixtureSets[0]);
  const retained = await retainSkillArtifacts({
    artifactsDir: path.join(scratch, 'historical'),
    workspace: rawWorkspace,
    caseId: scoring.loadGroundTruth().fixtureSets[0].id,
    agent: 'custom',
    model: null,
    repetition: 1,
    attempt: 1,
    prompt: staging.buildPrompt(scoring.loadGroundTruth().fixtureSets[0]),
    observation: { exitCode: 0, artifacts: { design: { kind: 'text', value: '# historical document' } } },
  });
  fs.rmSync(rawWorkspace.dir, { recursive: true, force: true });
  const maliciousCustom = path.join(scratch, 'historical/_bmad/custom');
  const genericCompanion = path.join(scratch, 'generic-selection-arm-b');
  fs.cpSync(retained, genericCompanion, { recursive: true });
  const genericProvenance = json(path.join(genericCompanion, 'provenance.json'));
  genericProvenance.stage = 'selection';
  genericProvenance.arm = 'B';
  fs.writeFileSync(path.join(genericCompanion, 'provenance.json'), JSON.stringify(genericProvenance));
  fs.writeFileSync(
    path.join(genericCompanion, 'diagnostic.json'),
    JSON.stringify({ signature: 'unbound-companion', qualification: 'passed', metricContributions: {} }),
  );
  experiments.sealAttemptArchive(genericCompanion);
  const genericSaved = experiments.analyzeSaved({ saved: [genericCompanion] });
  assert.equal(genericSaved.report.descriptive.groups[0].cases[0].completed, 1);
  assert.equal(genericSaved.report.descriptive.groups[0].cases[0].stability.stable, null);
  assert.match(
    genericSaved.report.sourceLimitations.join(';'),
    /no verified source\/native binding.*original manifest-bound native result/,
  );
  assert.equal(json(path.join(genericCompanion, 'provenance.json')).arm, 'B');
  const retainedRace = path.join(scratch, 'retained-byte-race');
  fs.cpSync(genericCompanion, retainedRace, { recursive: true });
  const raceResult = editAfterCheckedRead(path.join(retainedRace, 'provenance.json'), () =>
    experiments.analyzeSaved({ saved: [retainedRace] }),
  );
  assert.equal(raceResult.report.cost.taskExecution.total, null);
  fs.mkdirSync(maliciousCustom, { recursive: true });
  const hookMarker = path.join(scratch, 'forbidden-hook-launch');
  fs.writeFileSync(
    path.join(maliciousCustom, 'bmad-tea-evaluate.user.toml'),
    [
      '[workflow]',
      `activation_steps_prepend = ["touch ${hookMarker}"]`,
      `activation_steps_append = ["touch ${hookMarker}"]`,
      `on_complete = "touch ${hookMarker}"`,
    ].join('\n'),
  );
  const originals = {};
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) {
    originals[name] = childProcess[name];
    childProcess[name] = () => {
      throw new Error('offline route launched a process');
    };
  }
  try {
    const saved = experiments.analyzeSaved({ searchRoot: path.join(scratch, 'historical'), out: path.join(scratch, 'offline-report') });
    assert.deepEqual(saved.report.savedInputs, [retained]);
    assert.equal(saved.report.cost.attempts, 1);
    assert.equal(saved.report.descriptive.groups[0].cases[0].successFraction, null);
    assert.doesNotMatch(reader.renderReport(saved.report), /null of/);
    assert.ok(saved.report.sourceLimitations.some((value) => value.includes('no companion diagnostic')));
    assert.equal(saved.report.descriptive.importedHistoricalTrials, 1);
    assert.deepEqual(saved.report.offlineAnalysis, { freshAttempts: 0, modelCalls: 0, judgeCalls: 0 });
    const incompatible = path.join(scratch, 'incompatible-retained');
    fs.cpSync(retained, incompatible, { recursive: true });
    const nativeSet = scoring.loadGroundTruth().fixtureSets[0];
    const epicDir = path.join(incompatible, 'workspace', nativeSet.projectRoot, 'docs/epics');
    fs.writeFileSync(path.join(epicDir, fs.readdirSync(epicDir)[0]), 'different requirements');
    const incompatibleReport = experiments.analyzeSaved({ saved: [incompatible] });
    assert.ok(incompatibleReport.report.sourceLimitations.some((value) => value.includes('input identity is incompatible')));
    assert.equal(incompatibleReport.report.descriptive.replay.results[0].unmeasurable, 'incompatible-input-identity');
    assert.equal(incompatibleReport.report.descriptive.replay.results[0].status, 'unavailable');
    const incompatibleMarkdown = reader.renderReport(incompatibleReport.report);
    assert.match(incompatibleMarkdown, /Replayed 0 document\(s\); 0 replayed identically twice/);
    assert.match(incompatibleMarkdown, /Replay unavailable for 1 document\(s\): incompatible-input-identity/);
    const incompleteManifest = path.join(scratch, 'incomplete-retention-manifest');
    fs.cpSync(retained, incompleteManifest, { recursive: true });
    fs.writeFileSync(path.join(incompleteManifest, 'diagnostic.json'), JSON.stringify({ metricContributions: {}, signature: null }));
    experiments.sealAttemptArchive(incompleteManifest);
    const completeManifest = json(path.join(incompleteManifest, 'manifest.json'));
    const consumedInput = completeManifest.files.find((entry) => entry.path.includes('/docs/epics/')).path;
    for (const missing of ['provenance.json', 'observation.json', 'prompt.txt', 'diagnostic.json', consumedInput]) {
      fs.writeFileSync(
        path.join(incompleteManifest, 'manifest.json'),
        JSON.stringify({ files: completeManifest.files.filter((entry) => entry.path !== missing) }),
      );
      assert.throws(() => experiments.analyzeSaved({ saved: [incompleteManifest] }), /does not list consumed evidence/);
    }

    assert.equal(fs.existsSync(hookMarker), false, 'offline prep, append and completion hooks remain suppressed');
    const archived = experiments.analyzeSaved({ saved: [sourceDirs[0]] });
    assert.equal(archived.report.cost.attempts, 1);
  } finally {
    for (const [name, original] of Object.entries(originals)) childProcess[name] = original;
  }
  const failedArchive = freeze('archive-failure', { testDouble: td });
  approve(failedArchive);
  const recovery = await experiments.executePlan(failedArchive.directory, {
    testDouble: td,
    archive: async () => {
      throw new Error('archive disk full');
    },
  });
  assert.equal(recovery.status, 'recovery-required');
  assert.ok(fs.existsSync(recovery.unresolvedReservations[0].originalWorkspace));
  assert.equal(experiments.readJournal(failedArchive.directory).filter((e) => e.kind === 'dispatch').length, 1);
  await assert.rejects(experiments.executePlan(failedArchive.directory, { testDouble: td }), /Recovery required/);
  const failedSeal = freeze('interrupted-sealing', { testDouble: td });
  approve(failedSeal);
  const sealingRecovery = await experiments.executePlan(failedSeal.directory, {
    testDouble: td,
    archive: async (options) => {
      const retained = await retainSkillArtifacts(options);
      fs.writeFileSync(path.join(retained, 'manifest.json'), 'partial manifest bytes');
      return retained;
    },
  });
  assert.equal(sealingRecovery.status, 'recovery-required');
  assert.ok(fs.existsSync(sealingRecovery.stopped.partialArchive));
  assert.ok(fs.existsSync(sealingRecovery.unresolvedReservations[0].originalWorkspace));
  await assert.rejects(experiments.executePlan(failedSeal.directory, { testDouble: td }), /Recovery required/);
  const interrupted = freeze('interrupted', { testDouble: td });
  approve(interrupted);
  await assert.rejects(
    experiments.executePlan(interrupted.directory, {
      testDouble: td,
      afterDispatch: () => {
        throw new Error('simulated interruption');
      },
    }),
    /simulated interruption/,
  );
  assert.equal(experiments.recoveryReport(interrupted.directory).status, 'recovery-required');
  const interruptedAnalysis = experiments.analyzeSaved({ saved: [interrupted.directory] });
  assert.equal(interruptedAnalysis.report.cost.attempts, 1);
  assert.equal(interruptedAnalysis.report.cost.experimentTotal.total, null);
  assert.equal(interruptedAnalysis.report.controller.recovery.unresolvedReservations.length, 1);
  await assert.rejects(experiments.executePlan(interrupted.directory, { testDouble: td }), /Recovery required/);
  const cap = freeze('cap', { testDouble: td, maxUsd: 0.005 });
  assert.throws(() => approve(cap), /cap/);
  assert.equal(experiments.readJournal(cap.directory).filter((e) => e.kind === 'dispatch').length, 0);
  const exceededDouble = { ...td, boundUsd: 0.005 };
  const exceeded = freeze('posthoc-bound-violation', { testDouble: exceededDouble });
  approve(exceeded);
  const exceededResult = await experiments.executePlan(exceeded.directory, { testDouble: exceededDouble });
  assert.equal(exceededResult.status, 'recovery-required');
  assert.match(exceededResult.stopped.reason, /bound violated/);
  assert.equal(experiments.readJournal(exceeded.directory).filter((entry) => entry.kind === 'dispatch').length, 1);
  assert.equal(experiments.readJournal(exceeded.directory).filter((entry) => entry.kind === 'settled').length, 0);
  assert.equal(experiments.analyzeSaved({ saved: [exceeded.directory] }).report.cost.experimentTotal.total, 0.01);
  const tamper = freeze('tamper', { testDouble: td });
  approve(tamper);
  const plan = json(path.join(tamper.directory, 'plan.json'));
  plan.maxUsd = 100;
  fs.writeFileSync(path.join(tamper.directory, 'plan.json'), JSON.stringify(plan));
  await assert.rejects(experiments.executePlan(tamper.directory, { testDouble: td }), /integrity/);
  const workspace = { dir: fs.mkdtempSync(path.join(scratch, 'retain-failed-')) };
  await assert.rejects(
    finishSkillAttempt({
      workspace,
      preserveOnFailure: true,
      retain: async () => {
        throw new Error('archival failure');
      },
    }),
    /archival failure/,
  );
  assert.ok(fs.existsSync(workspace.dir));
  const ordinaryFailedWorkspace = { dir: fs.mkdtempSync(path.join(scratch, 'ordinary-retain-failed-')) };
  await assert.rejects(
    finishSkillAttempt({
      workspace: ordinaryFailedWorkspace,
      retain: async () => {
        throw new Error('ordinary archival failure');
      },
    }),
    /ordinary archival failure/,
  );
  assert.equal(fs.existsSync(ordinaryFailedWorkspace.dir), false);
  const originalCopy = fs.cpSync;
  for (const preserveOnFailure of [false, true]) {
    const artifacts = path.join(scratch, `partial-retention-${preserveOnFailure}`);
    let partial;
    fs.cpSync = () => {
      throw new Error('injected copy failure');
    };
    try {
      await assert.rejects(
        retainSkillArtifacts({
          artifactsDir: artifacts,
          workspace,
          caseId: 'cleanup',
          agent: 'custom',
          repetition: 1,
          attempt: 1,
          prompt: 'cleanup boundary',
          preserveOnFailure,
        }),
        (error) => {
          partial = error.partialArchive;
          return /injected copy failure/.test(error.message);
        },
      );
    } finally {
      fs.cpSync = originalCopy;
    }
    if (preserveOnFailure) assert.ok(fs.existsSync(partial));
    else {
      assert.equal(partial, undefined);
      assert.deepEqual(fs.readdirSync(artifacts), []);
    }
  }
  const mixed = path.join(scratch, 'mixed');
  fs.mkdirSync(mixed);
  fs.cpSync(successful.directory, path.join(mixed, 'older-experiment'), { recursive: true });
  fs.cpSync(blocked.directory, path.join(mixed, 'latest-empty-proposal'), { recursive: true });
  fs.cpSync(path.join(root, 'test/fixtures/configuration-experiment/paired-example/incumbent-run'), path.join(mixed, 'older-legacy'), {
    recursive: true,
  });
  const recentRoot = path.join(mixed, 'latest-native');
  fs.mkdirSync(recentRoot);
  const recent = path.join(recentRoot, path.basename(retained));
  fs.cpSync(retained, recent, { recursive: true });
  const recentProvenance = json(path.join(recent, 'provenance.json'));
  recentProvenance.capturedAt = new Date(Date.now() + 1000).toISOString();
  recentProvenance.evaluationId = 'compatible-invocation';
  fs.writeFileSync(path.join(recent, 'provenance.json'), JSON.stringify(recentProvenance));
  const recentRetry = path.join(recentRoot, 'failed-attempt');
  fs.cpSync(recent, recentRetry, { recursive: true });
  const retryObservation = json(path.join(recentRetry, 'observation.json'));
  retryObservation.exitCode = 4;
  retryObservation.artifacts = {};
  fs.writeFileSync(path.join(recentRetry, 'observation.json'), JSON.stringify(retryObservation));
  const newerIncompatible = path.join(mixed, 'newer-incompatible');
  fs.cpSync(recent, newerIncompatible, { recursive: true });
  const incompatibleProvenance = json(path.join(newerIncompatible, 'provenance.json'));
  incompatibleProvenance.capturedAt = new Date(Date.now() + 5000).toISOString();
  incompatibleProvenance.evaluationId = 'incompatible-invocation';
  fs.writeFileSync(path.join(newerIncompatible, 'provenance.json'), JSON.stringify(incompatibleProvenance));
  fs.appendFileSync(path.join(newerIncompatible, 'prompt.txt'), 'changed prompt');
  assert.deepEqual(experiments.discoverSaved({ searchRoot: mixed }), [recentRetry, recent].sort());
  const latestCompatible = experiments.analyzeSaved({ searchRoot: mixed });
  assert.equal(latestCompatible.report.cost.attempts, 2);
  assert.ok(latestCompatible.report.skippedSavedGroups.some((entry) => entry.directories.includes(newerIncompatible)));
  const proposalInput = path.join(scratch, 'cli-proposal-input.json');
  fs.writeFileSync(proposalInput, JSON.stringify(declaration()));
  const cliProposal = path.join(scratch, 'cli-native-proposal');
  const proposed = spawnSync(
    process.execPath,
    ['cli/evaluate.js', 'experiment', '--propose', proposalInput, '--agent', 'claude', '--max-usd', '1', '--out', cliProposal],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.match(JSON.parse(proposed.stdout).blockers.join(';'), /applied reasoning effort/);
  assert.equal(experiments.readJournal(cliProposal).length, 1);
  const experimentOutput = path.join(scratch, 'cli-experiment-saved-output');
  const experimentSaved = spawnSync(
    process.execPath,
    ['cli/evaluate.js', 'experiment', '--saved', successful.directory, '--out', experimentOutput],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(experimentSaved.status, 0, experimentSaved.stderr);
  assert.deepEqual(json(path.join(experimentOutput, 'saved-inputs.json')).selected, [successful.directory]);
  const emptyRecovery = path.join(scratch, 'empty-recovery');
  fs.mkdirSync(emptyRecovery);
  const missingJournal = path.join(scratch, 'missing-journal');
  fs.cpSync(cliProposal, missingJournal, { recursive: true });
  fs.unlinkSync(path.join(missingJournal, 'journal.jsonl'));
  for (const directory of [path.join(scratch, 'nonexistent-recovery'), emptyRecovery, missingJournal]) {
    const invalidRecovery = spawnSync(process.execPath, ['cli/evaluate.js', 'experiment', '--recover', directory], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(invalidRecovery.status, 10, invalidRecovery.stderr);
    assert.equal(invalidRecovery.stdout, '');
  }
  const operations = [
    ['--saved', successful.directory],
    ['--search-root', mixed],
    ['--propose', proposalInput],
    ['--recover', cliProposal],
  ];
  for (let left = 0; left < operations.length; left++)
    for (let right = left + 1; right < operations.length; right++) {
      const output = path.join(scratch, `conflicting-${left}-${right}`);
      const conflict = spawnSync(
        process.execPath,
        ['cli/evaluate.js', 'experiment', ...operations[left], ...operations[right], '--out', output],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(conflict.status, 64, conflict.stderr);
      assert.equal(fs.existsSync(output), false);
    }
  for (const [label, repeats] of [
    ['nonnumeric', 'Infinity'],
    ['huge', 1_000_000_000],
  ]) {
    const invalidDeclaration = declaration();
    invalidDeclaration.design.repeats = repeats;
    invalidDeclaration.frozen = { digest: reader.declarationDigest(invalidDeclaration) };
    const invalidInput = path.join(scratch, `cli-${label}-proposal.json`);
    const invalidOutput = path.join(scratch, `cli-${label}-proposal-output`);
    fs.writeFileSync(invalidInput, JSON.stringify(invalidDeclaration));
    const invalidProposal = spawnSync(
      process.execPath,
      ['cli/evaluate.js', 'experiment', '--propose', invalidInput, '--out', invalidOutput],
      { cwd: root, encoding: 'utf8', timeout: 3000 },
    );
    assert.equal(invalidProposal.error, undefined, `${label}: proposal must return without a timeout`);
    assert.equal(invalidProposal.status, 10, invalidProposal.stderr);
    assert.match(invalidProposal.stderr, /Proposal schedule requires/);
    assert.equal(fs.existsSync(invalidOutput), false, `${label}: schedule validation precedes directory creation`);
  }
  const recovered = spawnSync(process.execPath, ['cli/evaluate.js', 'experiment', '--recover', interrupted.directory], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).unresolvedReservations.length, 1);
  const unavailableDispatch = spawnSync(process.execPath, ['cli/evaluate.js', 'experiment', '--execute', cliProposal], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(unavailableDispatch.status, 64);
  const cli = spawnSync(process.execPath, ['cli/evaluate.js', 'experiment', '--search-root', path.join(scratch, 'historical')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, cli.stderr);
  // Source-checkout entry points and installed runtime have the same dependencies.
  const installed = path.join(scratch, 'installed');
  fs.mkdirSync(installed);
  const packed = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', scratch], { cwd: root, encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stderr);
  const tarball = path.join(scratch, JSON.parse(packed.stdout)[0].filename);
  const unpacked = spawnSync('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1'], { encoding: 'utf8' });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  assert.equal(fs.existsSync(path.join(installed, 'test')), false);
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(installed, 'node_modules'), 'dir');
  const smoke = spawnSync(process.execPath, [path.join(installed, 'cli/evaluate.js'), 'experiment', '--saved', retained], {
    cwd: installed,
    encoding: 'utf8',
  });
  assert.equal(smoke.status, 0, smoke.stderr);
  const installedDriver = spawnSync(
    process.execPath,
    [
      '-e',
      `const e=require('./cli/lib/evaluate/experiments');const r=require('./cli/lib/evaluate/configuration-experiment');const fs=require('node:fs');const d=${JSON.stringify(declaration())};d.identity.fixed=e.nativeIdentity();d.frozen={digest:r.declarationDigest(d)};const td=${JSON.stringify(td)};const directory=${JSON.stringify(path.join(scratch, 'installed-experiment'))};const plan=e.freezeProposal(e.makeProposal({declaration:d,testDouble:td,maxUsd:1,timeoutMs:5000}),directory);e.approvePlan(directory,{approved:true,approvedBy:'installed deterministic test',planDigest:r.digestOf(plan),maxUsd:1});e.executePlan(directory,{testDouble:td}).then(result=>{if(result.report?.controller?.attempts!==2)throw new Error(JSON.stringify(result));});`,
    ],
    { cwd: installed, encoding: 'utf8' },
  );
  assert.equal(installedDriver.status, 0, installedDriver.stderr);
  fs.writeFileSync(
    path.join(scratch, 'demonstration.json'),
    JSON.stringify(
      {
        label: 'deterministic external-process double; no paid calls',
        successful: successful.directory,
        offline: path.join(scratch, 'offline-report'),
        installed: path.join(scratch, 'installed-experiment'),
      },
      null,
      2,
    ),
  );
  console.log(`Evaluate experiment tests passed; labeled evidence: ${scratch}`);
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
