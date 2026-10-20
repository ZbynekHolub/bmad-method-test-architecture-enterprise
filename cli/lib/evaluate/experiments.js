/** Explicit opt-in experiments. Offline imports never load an execution mechanism. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const reader = require('./configuration-experiment');
const scoring = require('./test-design-replay');
const staging = require('../test-design-staging');
const { digest, digestPrompts } = require('./digest');
const { decimalNumber } = require('./usage-report');
const usdText = (value) => (typeof value === 'string' ? value : decimalNumber(value));
const usdParts = (value) => {
  const text = usdText(value);
  const [whole, fraction = ''] = text.split('.');
  return { units: BigInt(whole + fraction), places: fraction.length };
};
function usdSum(values) {
  const parts = values.map(usdParts);
  const places = Math.max(0, ...parts.map((part) => part.places));
  const units = parts.reduce((sum, part) => sum + part.units * 10n ** BigInt(places - part.places), 0n);
  const digits = String(units).padStart(places + 1, '0');
  return places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
function usdGreater(left, right) {
  const a = usdParts(left);
  const b = usdParts(right);
  const places = Math.max(a.places, b.places);
  return a.units * 10n ** BigInt(places - a.places) > b.units * 10n ** BigInt(places - b.places);
}
function usdMultiply(value, count) {
  const part = usdParts(value);
  const digits = String(part.units * BigInt(count)).padStart(part.places + 1, '0');
  return part.places === 0 ? digits : `${digits.slice(0, -part.places)}.${digits.slice(-part.places)}`;
}
function stageCases(declaration) {
  const memberships = declaration.scope?.memberships ?? {};
  return declaration.stage === 'confirmation'
    ? []
    : declaration.stage === 'selection'
      ? [...(memberships.development ?? []), ...(memberships.validation ?? [])]
      : (memberships.development ?? []);
}
const NATIVE_IDENTITY = nativeSuiteIdentity();
const PACKAGE_ROOT = path.resolve(__dirname, '../../..');
const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const now = () => new Date().toISOString();
function writeJson(file, value) {
  const fd = fs.openSync(file, 'wx');
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function confinedPath(root, relative) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative !== path.normalize(relative) ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`)
  )
    throw new Error('Evidence path must be relative and confined to its archive');
  let file = root;
  for (const part of relative.split(path.sep)) {
    file = path.join(file, part);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Evidence path contains a symbolic link');
  }
  return file;
}
function regularBytes(root, relative) {
  const file = confinedPath(root, relative);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const held = fs.fstatSync(fd);
    const named = fs.lstatSync(file);
    if (!held.isFile() || held.nlink !== 1 || named.dev !== held.dev || named.ino !== held.ino || named.nlink !== 1)
      throw new Error('Evidence must be a regular file with one link');
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function runnerSource(workspace, observation) {
  let result;
  try {
    result = (observation.stdout?.kind === 'json' ? observation.stdout.value : JSON.parse(observation.stdout?.value ?? '')).sourceCapture;
    if (!['verified', 'rejected'].includes(result?.status) || path.basename(result.path) !== result.path)
      throw new Error('runner supplied no trusted capture result');
    if (result.status === 'verified' && result.path !== 'source-capture.json') throw new Error('unexpected source receipt path');
    if (result.status === 'rejected' && !/^source-capture-recovery-[\da-f-]+\.json$/.test(result.path))
      throw new Error('unexpected recovery receipt path');
    const bytes = regularBytes(workspace.dir, result.path);
    if (sha(bytes) !== result.sha256) throw new Error('source receipt differs from runner digest');
    return { status: result.status, source: JSON.parse(bytes), result };
  } catch (error) {
    return { status: 'unverified', source: null, result: result ?? null, error: error.message };
  }
}

function filesUnder(root) {
  const result = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'workspace'].includes(entry.name)) walk(file);
      } else if (entry.isFile()) result.push(file);
    }
  };
  walk(path.resolve(root));
  return result;
}
function nativeSuiteIdentity() {
  const files = [];
  const corpus = path.join(__dirname, 'test-design-corpus');
  for (const set of scoring.loadGroundTruth().fixtureSets) {
    const root = path.join(corpus, set.root);
    for (const file of filesUnder(root))
      files.push({ relative: `test/fixtures/test-design-eval/${set.root}/${path.relative(root, file).split(path.sep).join('/')}`, file });
  }
  const parts = files
    .sort((a, b) => a.relative.localeCompare(b.relative))
    .flatMap((entry) => [entry.relative, fs.readFileSync(entry.file)]);
  return { suiteDigest: digest(parts), promptDigest: digestPrompts(staging.caseIndex(scoring.loadGroundTruth().fixtureSets)) };
}
function verifyManifest(directory, required = []) {
  const manifest = JSON.parse(regularBytes(directory, 'manifest.json'));
  if (!Array.isArray(manifest.files)) throw new Error('manifest.files must be an array');
  const seen = new Set();
  const verifiedBytes = new Map();
  for (const entry of manifest.files) {
    const relative = path.normalize(entry.path);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`) || seen.has(relative))
      throw new Error('invalid or duplicate manifest path');
    seen.add(relative);
    let file = directory;
    for (const part of relative.split(path.sep)) {
      file = path.join(file, part);
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('manifest contains a symbolic link');
    }
    const bytes = regularBytes(directory, relative);
    if (entry.bytes !== bytes.length || entry.sha256 !== sha(bytes).slice(7)) throw new Error(`integrity failure: ${entry.path}`);
    verifiedBytes.set(relative, bytes);
  }
  for (const relative of required)
    if (!seen.has(path.normalize(relative))) throw new Error(`manifest does not list consumed evidence: ${relative}`);
  return { ...manifest, verifiedBytes };
}
function sealAttemptArchive(directory) {
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'manifest.json' && !prefix) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('archive contains a symbolic link');
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative);
      else {
        const bytes = fs.readFileSync(path.join(dir, entry.name));
        files.push({ path: relative, bytes: bytes.length, sha256: sha(bytes).slice(7) });
      }
    }
  };
  walk(directory);
  writeJson(path.join(directory, 'manifest.json'), { files });
}
function discoverSaved({ searchRoot, saved = [], skipped = [] }) {
  if (saved.length > 0) return saved.map((file) => path.resolve(file));
  if (!searchRoot) throw new Error('Name a saved run or a search root for the latest compatible Test Design records');
  const directories = [
    ...new Set(
      filesUnder(searchRoot)
        .filter((file) => ['result.json', 'provenance.json', 'plan.json'].includes(path.basename(file)))
        .map((file) => path.dirname(file)),
    ),
  ];
  const groups = [];
  const experimentRoots = [];
  const candidate = (directory, read) => {
    try {
      return read();
    } catch (error) {
      skipped.push({ directories: [directory], reason: error.message });
      return null;
    }
  };
  const stamp = (value, fallback) => (Number.isFinite(Date.parse(value)) ? Date.parse(value) : fs.statSync(fallback).mtimeMs);
  for (const dir of directories.filter(
    (dir) => fs.existsSync(path.join(dir, 'plan.json')) && fs.existsSync(path.join(dir, 'journal.jsonl')),
  )) {
    experimentRoots.push(dir);
    const plan = candidate(dir, () => readJson(path.join(dir, 'plan.json')));
    if (!plan) continue;
    if (
      plan.declaration?.scope?.workflow !== 'bmad-tea-test-design' ||
      plan.declaration?.identity?.fixed?.suiteDigest !== NATIVE_IDENTITY.suiteDigest
    )
      continue;
    const journal = candidate(dir, () => readJournal(dir));
    if (!journal) continue;
    if (!journal.some((entry) => entry.kind === 'sealed' || entry.kind === 'completion')) continue;
    groups.push({
      kind: 'experiment',
      directories: [dir],
      at: Math.max(...journal.filter((entry) => entry.kind === 'completion').map((entry) => stamp(entry.at, dir))),
    });
  }
  const insideExperiment = (dir) => experimentRoots.some((root) => dir.startsWith(`${root}${path.sep}`));
  for (const dir of directories.filter(
    (dir) => !insideExperiment(dir) && fs.existsSync(path.join(dir, 'result.json')) && fs.existsSync(path.join(dir, 'manifest.json')),
  )) {
    const result = candidate(dir, () => readJson(path.join(dir, 'result.json')));
    if (!result || result.runners?.length !== 1) continue;
    if (result.suite?.fixtureDigest !== NATIVE_IDENTITY.suiteDigest) continue;
    groups.push({ kind: 'legacy', directories: [dir], at: stamp(result.generatedAt, dir) });
  }
  const retainedGroups = new Map();
  for (const dir of directories.filter(
    (dir) =>
      !insideExperiment(dir) &&
      fs.existsSync(path.join(dir, 'provenance.json')) &&
      fs.existsSync(path.join(dir, 'prompt.txt')) &&
      fs.existsSync(path.join(dir, 'observation.json')),
  )) {
    const provenance = candidate(dir, () => readJson(path.join(dir, 'provenance.json')));
    if (!provenance) continue;
    const groupId = `${path.dirname(dir)}:${provenance.evaluationId ?? provenance.invocationId ?? 'historical-unbound-siblings'}`;
    const group = retainedGroups.get(groupId) ?? { kind: 'retained', directories: [], at: 0 };
    group.directories.push(dir);
    group.at = Math.max(group.at, stamp(provenance.capturedAt, dir));
    retainedGroups.set(groupId, group);
  }
  groups.push(...retainedGroups.values());
  if (groups.length === 0)
    throw new Error(
      `No compatible Test Design records found. Expected native suite identity ${NATIVE_IDENTITY.suiteDigest}, or retained native cases with prompt/observation/workspace and matching companion ground truth`,
    );
  const groundTruth = scoring.loadGroundTruth();
  for (const group of groups.sort((a, b) => b.at - a.at || a.directories[0].localeCompare(b.directories[0]))) {
    try {
      if (group.kind === 'retained') {
        const groupRows = [];
        for (const dir of group.directories) {
          const rows = retainedRows(dir, [], groundTruth);
          groupRows.push(...rows);
        }
        if (!groupRows.some((row) => row.provenance.replayCompatible))
          throw new Error('retained prompt/workspace input identity is incompatible or missing');
      } else if (group.kind === 'legacy') {
        const loaded = reader.loadRecordedTestDesignRun({ dir: group.directories[0] });
        if (
          loaded.integrity.problems.length > 0 ||
          !loaded.rows.every((row) => {
            const set = groundTruth.fixtureSets.find((entry) => entry.id === row.caseId);
            return set && row.inputSha256 === sha(staging.buildPrompt(set));
          })
        )
          throw new Error('legacy integrity or prompt identity is incompatible');
      } else {
        validateFrozen(group.directories[0]);
        for (const entry of readJournal(group.directories[0]).filter((entry) => entry.kind === 'sealed')) {
          const dir = confinedPath(group.directories[0], entry.directory);
          if (sha(fs.readFileSync(path.join(dir, 'manifest.json'))) !== entry.manifestSha256)
            throw new Error('sealed manifest differs from journal');
          const loaded = reader.loadSealedTestDesignAttempt({ dir });
          if (Object.values(loaded.records).some((record) => record.manifestSha256 !== entry.manifestSha256))
            throw new Error('Sealed manifest differs from controller journal');
          for (const row of loaded.rows)
            if (
              !retainedInputCompatible(
                dir,
                groundTruth.fixtureSets.find((set) => set.id === row.caseId),
                loaded.verifiedBytes.get('prompt.txt'),
                loaded.verifiedBytes,
              )
            )
              throw new Error('experiment staged input identity is incompatible');
        }
      }
      return group.directories.sort();
    } catch (error) {
      skipped.push({ directories: group.directories, reason: error.message });
    }
  }
  throw new Error(`No compatible Test Design evidence group: ${skipped.map((entry) => entry.reason).join('; ')}`);
}

function retainedInputCompatible(directory, set, prompt, checkedBytes = null) {
  if (!set || prompt.toString('utf8') !== staging.buildPrompt(set)) return false;
  const corpus = path.join(__dirname, 'test-design-corpus', set.root);
  const workspace = path.join(directory, 'workspace', set.projectRoot);
  const manifest = !checkedBytes && fs.existsSync(path.join(directory, 'manifest.json')) ? verifyManifest(directory) : null;
  const bytes = checkedBytes ?? manifest?.verifiedBytes;
  for (const source of filesUnder(corpus)) {
    const retained = path.join(workspace, path.relative(corpus, source));
    if (bytes && !bytes.has(path.relative(directory, retained)))
      throw new Error(`manifest does not list consumed evidence: ${path.relative(directory, retained)}`);
    const retainedBytes =
      bytes?.get(path.relative(directory, retained)) ??
      (fs.existsSync(retained) ? regularBytes(directory, path.relative(directory, retained)) : null);
    if (!retainedBytes || !fs.readFileSync(source).equals(retainedBytes)) return false;
  }
  return true;
}
function retainedRows(directory, limitations, groundTruth) {
  const required = ['provenance.json', 'observation.json', 'prompt.txt'];
  if (fs.existsSync(path.join(directory, 'diagnostic.json'))) required.push('diagnostic.json');
  const sealed = fs.existsSync(path.join(directory, 'manifest.json'));
  const manifest = sealed ? verifyManifest(directory, required) : null;
  const read = (relative) => (manifest ? manifest.verifiedBytes.get(path.normalize(relative)) : regularBytes(directory, relative));
  const provenance = JSON.parse(read('provenance.json'));
  const observation = JSON.parse(read('observation.json'));
  try {
    if (
      (observation.stdout?.kind === 'json' ? observation.stdout.value : JSON.parse(observation.stdout?.value ?? '{}')).sourceCapture
        ?.status === 'rejected'
    )
      throw new Error('Rejected source capture cannot be imported as authentic saved evidence');
  } catch (error) {
    if (error.message.startsWith('Rejected source capture')) throw error;
  }
  const prompt = read('prompt.txt');
  const set = groundTruth.fixtureSets.find((set) => set.id === provenance.caseId);
  const compatible = retainedInputCompatible(directory, set, prompt, manifest?.verifiedBytes);
  const diagnostic =
    manifest?.verifiedBytes.has('diagnostic.json') || (!manifest && fs.existsSync(path.join(directory, 'diagnostic.json')))
      ? JSON.parse(read('diagnostic.json'))
      : null;
  const text = observation.artifacts?.design?.value ?? null;
  if (!compatible)
    limitations.push(
      `${directory}: input identity is incompatible or missing. Expected native Test Design case, exact prompt and matching retained input bytes; supply the original matching ground truth for scorer replay`,
    );
  if (!provenance.evaluationId && !provenance.invocationId)
    limitations.push(
      `${directory}: historical retention has no evaluation invocation identity; all retained siblings under this root are reported without asserting a common invocation`,
    );
  if (diagnostic)
    limitations.push(
      `${directory}: companion diagnostic has no verified source/native binding. Native stability and qualification are unknown; supply the original manifest-bound native result.json or source-captured attempt directory for ${directory}`,
    );
  else limitations.push(`${directory}: no companion diagnostic. Native stability and qualification are unknown`);
  const replayed = compatible && text !== null ? reader.testDesignReplay({ groundTruth })(text, { caseId: provenance.caseId }) : null;
  const projected = diagnostic
    ? reader.metricsFromContributions(diagnostic.metricContributions ?? {})
    : { metrics: replayed?.metrics ?? {}, counts: replayed?.counts ?? {}, notApplicable: replayed?.notApplicable ?? [] };
  if (!diagnostic && replayed)
    limitations.push(
      `${directory}: metric spread uses the current deterministic scorer on compatible saved bytes; the native diagnostic remains unknown`,
    );
  return [
    {
      attemptId: directory,
      runId: path.dirname(directory),
      arm: 'A',
      stage: 'baseline',
      caseId: provenance.caseId ?? 'unknown',
      clusterId: provenance.caseId ?? 'unknown',
      repetition: provenance.repetition ?? 1,
      attempt: provenance.attempt ?? 1,
      status: provenance.status ?? (observation.exitCode === 0 && text !== null ? 'completed' : 'failed'),
      error: observation.fault ?? null,
      outputText: text,
      outputSha256: text === null ? null : sha(text),
      inputSha256: sha(prompt),
      // Historical capture fields are copied exactly. No fresh receipt is generated while importing.
      receipt: provenance.receipt ?? null,
      observed: provenance.observed ?? null,
      blockId: provenance.blockId ?? null,
      usage: provenance.usage ?? null,
      cost: provenance.cost ?? null,
      latency: provenance.latency ?? null,
      provenance: { ...provenance, replayCompatible: compatible },
      ...projected,
    },
  ];
}
function nativeQualification(contributions) {
  for (const [metric, minimum] of Object.entries(scoring.THRESHOLDS)) {
    if (metric.startsWith('max')) continue;
    const denominator = contributions[`${metric}.denominator`];
    if (denominator === 0 && contributions[`${metric}.expected`] === 0) continue;
    if (!(denominator > 0) || contributions[`${metric}.numerator`] / denominator < minimum) return 'failed';
  }
  for (const [value, maximum] of [
    ['ungroundedRisks', 'maxUngroundedRisks'],
    ['unscoredRiskTables', 'maxUnscoredRiskTables'],
    ['topSeverityMissed', 'maxTopSeverityMissed'],
    ['riskCeilingExcess', 'maxRiskCeilingExcess'],
    ['fixtureMutations', 'maxFixtureMutations'],
  ])
    if (!(contributions[value] <= scoring.THRESHOLDS[maximum])) return 'failed';
  return 'passed';
}
function nativeIdentity(workspace, set) {
  const inputs = [];
  for (const [prefix, root] of [
    ['corpus', path.join(__dirname, 'test-design-corpus')],
    ['skill', path.join(PACKAGE_ROOT, 'skills/bmad-tea-test-design')],
    ['knowledge', path.join(PACKAGE_ROOT, 'skills/bmod-tea')],
  ]) {
    for (const file of filesUnder(root).sort()) {
      const relative = path.relative(root, file);
      let observedFile = file;
      if (workspace) {
        if (prefix === 'skill') observedFile = path.join(workspace.dir, 'skill', relative);
        if (prefix === 'knowledge') observedFile = path.join(workspace.dir, 'bmod-tea', relative);
        if (prefix === 'corpus' && relative.startsWith(`${set.root}${path.sep}`))
          observedFile = path.join(workspace.projectDir, path.relative(set.root, relative));
      }
      inputs.push([`${prefix}/${relative}`, fs.existsSync(observedFile) ? sha(fs.readFileSync(observedFile)) : 'missing']);
    }
    if (workspace && prefix !== 'corpus') {
      const stagedRoot = path.join(workspace.dir, prefix === 'skill' ? 'skill' : 'bmod-tea');
      for (const file of filesUnder(stagedRoot).sort()) {
        const relative = path.relative(stagedRoot, file);
        if (!fs.existsSync(path.join(root, relative))) inputs.push([`${prefix}/${relative}`, sha(fs.readFileSync(file))]);
      }
    }
  }
  if (workspace) {
    for (const relative of staging.filesUnder(workspace.projectDir)) {
      if (
        !relative.startsWith(`test-artifacts${path.sep}`) &&
        !relative.startsWith(`${path.dirname(staging.TEA_CONFIG_RELATIVE_PATH)}${path.sep}`) &&
        !workspace.corpusFiles.includes(relative)
      )
        inputs.push([`corpus/${set.root}/${relative}`, sha(fs.readFileSync(path.join(workspace.projectDir, relative)))]);
    }
  }
  const config = workspace ? fs.readFileSync(path.join(workspace.projectDir, staging.TEA_CONFIG_RELATIVE_PATH)) : staging.configToml();
  inputs.push(['config', sha(config)]);
  return {
    ...NATIVE_IDENTITY,
    groundTruthDigest: sha(fs.readFileSync(path.join(__dirname, 'test-design-corpus/ground-truth.json'))),
    scorerDigest: digest([
      'test-design-replay.js',
      fs.readFileSync(path.join(__dirname, 'test-design-replay.js')),
      'test-design-parser.js',
      fs.readFileSync(path.join(__dirname, '../test-design-parser.js')),
    ]),
    analysisDigest: digest([
      'configuration-experiment.js',
      fs.readFileSync(path.join(__dirname, 'configuration-experiment.js')),
      'experiments.js',
      fs.readFileSync(__filename),
    ]),
    executionDigest: digest(
      [
        'test-design-runner.js',
        'lib/run-agent.js',
        'lib/agent-adapters.js',
        'lib/agent-supervisor.js',
        'lib/test-design-staging.js',
        'lib/test-design-staged-config.js',
        'lib/evaluate/retain-skill-artifacts.js',
      ].flatMap((file) => [file, fs.readFileSync(path.join(PACKAGE_ROOT, 'cli', file))]),
    ),
    thresholdsDigest: reader.digestOf(scoring.THRESHOLDS),
    rubricDigest: 'not-applicable',
    inputTreeDigest: reader.digestOf(inputs),
    environment: { cacheRegime: 'deterministic double; process and workspace fresh' },
  };
}
function baselineDeclaration(rows, experimentId) {
  const cases = [...new Set(rows.map((row) => row.caseId))];
  return {
    schemaVersion: '1.0.0',
    experimentId,
    stage: 'baseline',
    scope: {
      workflow: 'bmad-tea-test-design',
      owner: 'saved-record analysis',
      claim: 'fixed-suite',
      judge: 'none',
      baseline: { id: 'saved-records' },
      memberships: { development: cases, validation: [], confirmation: [] },
    },
    identity: { fixed: {} },
    design: { repeats: Math.max(1, ...rows.map((row) => row.repetition)) },
    gates: { success: { metrics: {} } },
    resources: { authorization: null },
  };
}
function analyzeSaved({ searchRoot, saved, out }) {
  const skipped = [];
  const selected = discoverSaved({ searchRoot, saved, skipped });
  const groundTruth = scoring.loadGroundTruth();
  const limitations = [];
  const attempts = [];
  const records = {};
  for (const directory of selected) {
    if (fs.existsSync(path.join(directory, 'plan.json'))) {
      const result = analyzeExperiment(directory);
      result.report.skippedSavedGroups = skipped;
      result.report.sourceLimitations.push(
        ...skipped.map((entry) => `Skipped saved group ${entry.directories.join(', ')}: ${entry.reason}`),
      );
      if (out) {
        fs.mkdirSync(out, { recursive: true });
        writeJson(path.join(out, 'saved-inputs.json'), { selected });
        reader.writeOutputs(result, out);
      }
      return result;
    }
    if (fs.existsSync(path.join(directory, 'result.json'))) {
      const suite = readJson(path.join(directory, 'result.json')).suite;
      if (suite?.fixtureDigest !== NATIVE_IDENTITY.suiteDigest)
        throw new Error(
          `Unsupported Test Design corpus: expected suite fixture identity ${NATIVE_IDENTITY.suiteDigest}. Supply its original matching ground truth and reader input; this route ships only the native two-case corpus`,
        );
      if (readJson(path.join(directory, 'result.json')).runners?.length !== 1)
        throw new Error(
          'Legacy Test Design ingestion supports one runner per saved directory. Supply the corresponding per-attempt retained directories for a multi-runner result',
        );
      const loaded = reader.loadRecordedTestDesignRun({ dir: directory });
      if (loaded.integrity.problems.length > 0) throw new Error(loaded.integrity.problems.join('\n'));
      for (const row of loaded.rows) {
        const set = groundTruth.fixtureSets.find((set) => set.id === row.caseId);
        const compatible = Boolean(set) && row.inputSha256 === sha(staging.buildPrompt(set));
        row.provenance.replayCompatible = compatible;
        if (!compatible)
          limitations.push(`${row.attemptId}: historical prompt identity differs from the shipped corpus; scorer replay unavailable`);
      }
      attempts.push(...loaded.rows);
      Object.assign(records, loaded.records);
    } else if (
      fs.existsSync(path.join(directory, 'manifest.json')) &&
      fs.existsSync(path.join(directory, 'workspace/source-capture.json')) &&
      fs.existsSync(path.join(directory, 'diagnostic.json'))
    ) {
      const loaded = reader.loadSealedTestDesignAttempt({ dir: directory });
      for (const row of loaded.rows) {
        const set = groundTruth.fixtureSets.find((set) => set.id === row.caseId);
        row.provenance.replayCompatible = retainedInputCompatible(
          directory,
          set,
          loaded.verifiedBytes.get('prompt.txt'),
          loaded.verifiedBytes,
        );
        row.stage = 'baseline';
        row.arm = 'A';
      }
      attempts.push(...loaded.rows);
      Object.assign(records, loaded.records);
    } else attempts.push(...retainedRows(directory, limitations, groundTruth));
  }
  const declaration = baselineDeclaration(attempts, `saved-${crypto.randomUUID()}`);
  const replay = reader.testDesignReplay({ groundTruth });
  const result = reader.readExperiment({
    declaration,
    attempts,
    nativeRecords: records,
    replay: (text, row) => (row.provenance?.replayCompatible ? replay(text, row) : { unmeasurable: 'incompatible-input-identity' }),
  });
  // No business success threshold was authorized for this retrospective reading.
  for (const group of result.report.descriptive?.groups ?? [])
    for (const entry of group.cases) {
      entry.successes = null;
      entry.successFraction = null;
    }
  result.report.sourceLimitations.push(
    ...limitations,
    ...skipped.map((entry) => `Skipped saved group ${entry.directories.join(', ')}: ${entry.reason}`),
    'No recorded experiment success thresholds were supplied. Success fractions are unavailable; counts, spread, native signatures and deterministic scorer replay remain descriptive.',
    feasibility().limitation,
  );
  result.report.savedInputs = selected;
  result.report.skippedSavedGroups = skipped;
  result.report.offlineAnalysis = { freshAttempts: 0, modelCalls: 0, judgeCalls: 0 };
  result.report.sourceLimitations.push(
    'Every selected record is saved historical evidence. A stored fresh-workspace receipt describes its original capture; this analysis dispatched no fresh trial.',
  );
  if (attempts.some((row) => row.provenance?.label === 'deterministic-test-double'))
    result.report.sourceLimitations.push(
      'These saved records contain deterministic test doubles and establish no provider quality or savings.',
    );
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    writeJson(path.join(out, 'saved-inputs.json'), { selected });
    writeJson(path.join(out, 'declaration.json'), declaration);
    reader.writeOutputs(result, out);
  }
  return result;
}
function feasibility() {
  const independentCases = scoring.loadGroundTruth().fixtureSets.length;
  return {
    independentCases,
    selectionFeasible: independentCases >= 2,
    confirmationFeasible: false,
    limitation: `The native corpus has ${independentCases} independent cases. Selection needs two clusters; no genuinely unseen cases remain for confirmation. Repetitions cannot add independent cases or produce a confirmed recommendation.`,
  };
}
function liveBlockers(agent) {
  return [
    `${agent ?? 'native'}: applied reasoning effort is unavailable`,
    `${agent ?? 'native'}: an enforceable verified all-in USD bound including tools, retries and overhead is unavailable`,
    ...(agent === 'codex' ? ['codex: verified money telemetry is unavailable'] : []),
  ];
}
function makeProposal({ declaration, agent = 'codex', maxUsd, timeoutMs = 1_200_000, testDouble = null }) {
  declaration = structuredClone(declaration);
  if (declaration.design && declaration.design.maxAttempts === undefined) {
    const frozenValid = !declaration.frozen || declaration.frozen.digest === reader.declarationDigest(declaration);
    declaration.design.maxAttempts = 1;
    if (declaration.frozen && frozenValid) declaration.frozen = { digest: reader.declarationDigest(declaration) };
  }
  const validation = reader.validateDeclaration(declaration);
  const ids = stageCases(declaration);
  const attempts =
    ids.length * (declaration.scope?.candidate ? 2 : 1) * (declaration.design?.repeats ?? 0) * (declaration.design?.maxAttempts ?? 1);
  const blockers = validation.problems.map((entry) => `${entry.where}: ${entry.message}`);
  if (!Number.isSafeInteger(declaration.design?.maxAttempts) || declaration.design.maxAttempts < 1)
    blockers.push('maxAttempts must be a positive safe integer');
  if (declaration.scope?.candidate) blockers.push(...validation.pairedProblems.map((entry) => `${entry.where}: ${entry.message}`));
  if (declaration.stage === 'confirmation') blockers.push(feasibility().limitation);
  if (declaration.scope?.workflow !== 'bmad-tea-test-design') blockers.push('Only native Test Design is supported');
  if (!testDouble) blockers.push(...liveBlockers(agent));
  const actualFixed = nativeIdentity();
  if (testDouble) {
    const overhead = declaration.resources?.overhead;
    if (
      !Array.isArray(overhead) ||
      !overhead.every((entry) => entry.currency === 'USD' && Number.isFinite(entry.amount) && entry.amount >= 0) ||
      !Number.isFinite(testDouble.overheadUsd ?? 0) ||
      (testDouble.overheadUsd ?? 0) < 0 ||
      usdGreater(usdSum(overhead.map((entry) => entry.amount)), testDouble.overheadUsd ?? 0) ||
      usdGreater(testDouble.overheadUsd ?? 0, usdSum(overhead.map((entry) => entry.amount)))
    )
      blockers.push('All overhead requires a verified USD amount matching the reserved test-double bound');
    if (
      !Number.isFinite(testDouble.boundUsd) ||
      testDouble.boundUsd < 0 ||
      !Number.isFinite(testDouble.overheadUsd ?? 0) ||
      (testDouble.overheadUsd ?? 0) < 0
    )
      blockers.push('Test double money bounds must be finite nonnegative amounts');
    if (reader.canonicalJson(declaration.identity?.fixed) !== reader.canonicalJson(actualFixed))
      blockers.push('Fixed input/scorer identities must match nativeIdentity() before approval');
    if (declaration.scope?.candidate) {
      const factor = declaration.scope.changedFactor;
      const placeholder =
        factor?.kind === 'model' ? '{model}' : factor?.kind === 'effort' && factor.setting === 'effort' ? '{effort}' : null;
      if (!placeholder || !(testDouble.args ?? []).some((arg) => arg.includes(placeholder)))
        blockers.push(
          'This double supports model or effort comparisons only when the changed value is passed through its frozen argv placeholder',
        );
    }
  }
  if (!Number.isFinite(maxUsd) || maxUsd < 0) blockers.push('A verified USD spending cap is required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) blockers.push('A positive elapsed bound is required');
  return {
    kind: 'evaluate-experiment-proposal',
    declaration,
    agent,
    testDouble: testDouble
      ? {
          command: path.resolve(testDouble.command),
          args: testDouble.args ?? [],
          executableSha256: testDouble.executableSha256,
          boundUsd: testDouble.boundUsd,
          overheadUsd: testDouble.overheadUsd ?? 0,
        }
      : null,
    maxUsd: maxUsd ?? null,
    timeoutMs,
    maxAttempts: attempts,
    estimatedElapsedMs: attempts * (timeoutMs + 60_000),
    elapsedEstimateIncludes: 'per-attempt target timeout plus one minute for native runner, staging and archive overhead',
    money:
      testDouble &&
      Number.isSafeInteger(attempts) &&
      attempts >= 0 &&
      Number.isFinite(testDouble.boundUsd) &&
      testDouble.boundUsd >= 0 &&
      Number.isFinite(testDouble.overheadUsd ?? 0) &&
      (testDouble.overheadUsd ?? 0) >= 0
        ? {
            label: 'deterministic-test-double',
            upperBoundUsd: Number(usdSum([usdMultiply(testDouble.boundUsd, attempts), testDouble.overheadUsd ?? 0])),
            upperBoundUsdExact: usdSum([usdMultiply(testDouble.boundUsd, attempts), testDouble.overheadUsd ?? 0]),
          }
        : null,
    feasibility: feasibility(),
    blockers,
    requiresApproval: [
      'frozen declaration and thresholds',
      'execution scope and attempt/retry schedule',
      'elapsed estimate',
      'verified all-in money cap, confirmation and overhead',
    ],
    automaticAdoption: false,
  };
}
function appendJournal(directory, event) {
  const entries = readJournal(directory);
  const payload = { sequence: entries.length + 1, previous: entries.at(-1)?.hash ?? null, at: now(), ...event };
  const entry = { ...payload, hash: reader.digestOf(payload) };
  const fd = fs.openSync(path.join(directory, 'journal.jsonl'), 'a');
  try {
    fs.writeFileSync(fd, `${JSON.stringify(entry)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return entry;
}
function readJournal(directory) {
  const file = path.join(directory, 'journal.jsonl');
  if (!fs.existsSync(file)) return [];
  const entries = fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  let previous = null;
  let approved = false;
  let finished = false;
  const kinds = new Set([
    'frozen',
    'approved',
    'reserved',
    'exposure',
    'dispatch',
    'completion',
    'sealed',
    'settled',
    'archive-failed',
    'stopped',
    'finished',
  ]);
  const states = new Map();
  for (const [index, entry] of entries.entries()) {
    const { hash, ...payload } = entry;
    if (entry.previous !== previous || entry.sequence !== index + 1 || hash !== reader.digestOf(payload))
      throw new Error('Controller journal integrity failure');
    if (!kinds.has(entry.kind)) throw new Error('Unknown controller journal event');
    if ((index === 0 && entry.kind !== 'frozen') || (index > 0 && entry.kind === 'frozen') || finished)
      throw new Error('Controller journal must have one frozen first event and no events after finish');
    if (entry.kind === 'approved') {
      if (approved || index !== 1) throw new Error('Controller approval must occur once immediately after freeze');
      approved = true;
    }
    if (['reserved', 'dispatch', 'completion', 'sealed', 'settled', 'archive-failed'].includes(entry.kind)) {
      if (!approved || !entry.attemptId) throw new Error('Controller attempt requires prior approval');
      const prior = states.get(entry.attemptId);
      const expected = {
        reserved: undefined,
        dispatch: 'reserved',
        completion: 'dispatch',
        sealed: 'completion',
        settled: 'sealed',
        'archive-failed': 'completion',
      };
      if (prior !== expected[entry.kind]) throw new Error(`Controller ${entry.kind} ordering failure for ${entry.attemptId}`);
      states.set(entry.attemptId, entry.kind);
    }
    if (entry.kind === 'finished') {
      if (!approved || [...states.values()].some((state) => state !== 'settled'))
        throw new Error('Controller finished with unresolved attempts');
      finished = true;
    }
    if (entry.kind === 'exposure' && (!approved || states.get(entry.entry?.attemptId) !== 'reserved'))
      throw new Error('Exposure requires an approved reserved attempt');
    if (['stopped', 'archive-failed'].includes(entry.kind)) finished = true;
    previous = hash;
  }
  return entries;
}
function freezeProposal(proposal, directory) {
  const repeats = proposal.declaration?.design?.repeats;
  const maxAttempts = proposal.declaration?.design?.maxAttempts;
  const development = proposal.declaration?.scope?.memberships?.development ?? [];
  const validation = proposal.declaration?.scope?.memberships?.validation ?? [];
  const confirmation = proposal.declaration?.scope?.memberships?.confirmation ?? [];
  const arms = proposal.declaration?.scope?.candidate ? ['A', 'B'] : ['A'];
  const cases =
    Array.isArray(development) && Array.isArray(validation) && Array.isArray(confirmation) ? stageCases(proposal.declaration) : [];
  const totalAttempts = cases.length * arms.length * repeats * maxAttempts;
  const estimatedElapsedMs = totalAttempts * (proposal.timeoutMs + 60_000);
  const nativeCases = new Set(scoring.loadGroundTruth().fixtureSets.map((set) => set.id));
  if (
    !Array.isArray(development) ||
    !Array.isArray(validation) ||
    !Array.isArray(confirmation) ||
    !Number.isSafeInteger(repeats) ||
    repeats < 1 ||
    repeats > 1000 ||
    !Number.isSafeInteger(maxAttempts) ||
    maxAttempts < 1 ||
    !Number.isSafeInteger(totalAttempts) ||
    (totalAttempts < 1 && proposal.declaration.stage !== 'confirmation') ||
    !Number.isSafeInteger(proposal.timeoutMs) ||
    proposal.timeoutMs < 1 ||
    !Number.isSafeInteger(estimatedElapsedMs) ||
    !cases.every((caseId) => nativeCases.has(caseId)) ||
    new Set(cases).size !== cases.length
  )
    throw new Error(
      'Proposal schedule requires native case arrays, repeats from 1 through 1000, positive safe-integer retries and safe finite attempt/elapsed bounds',
    );
  // Fixed interleaving is supported; randomized dispatch needs a declared and implemented RNG.
  if (proposal.declaration.design.order === 'randomized')
    throw new Error('Randomized live dispatch is unavailable; propose interleaved order');
  const schedule = [];
  for (let repetition = 1; repetition <= repeats; repetition++)
    for (const caseId of cases) for (const arm of arms) schedule.push({ caseId, repetition, arm, blockId: `${caseId}-run-${repetition}` });
  fs.mkdirSync(directory, { recursive: false });
  const plan = {
    ...proposal,
    exposureScope: 'this-experiment-only; prior exposure unknown',
    schedule,
    createdAt: now(),
    planId: crypto.randomUUID(),
  };
  writeJson(path.join(directory, 'plan.json'), plan);
  writeJson(path.join(directory, 'declaration.json'), proposal.declaration);
  writeJson(path.join(directory, 'experiment-exposure-initial.json'), []);
  appendJournal(directory, {
    kind: 'frozen',
    planDigest: reader.digestOf(plan),
    declarationDigest: reader.declarationDigest(plan.declaration),
  });
  return plan;
}
function approvePlan(directory, approval) {
  const plan = readJson(path.join(directory, 'plan.json'));
  if (plan.blockers.length > 0) throw new Error(`Live experiment blocked: ${plan.blockers.join('; ')}`);
  if (plan.money && usdGreater(plan.money.upperBoundUsdExact, plan.maxUsd))
    throw new Error('Verified all-in money bound exceeds approved cap');
  if (
    approval.planDigest !== reader.digestOf(plan) ||
    approval.maxUsd !== plan.maxUsd ||
    !approval.approvedBy ||
    approval.approved !== true
  )
    throw new Error('Approval must bind the exact frozen plan, thresholds, scope, attempts, elapsed estimate and USD cap');
  writeJson(path.join(directory, 'approval.json'), approval);
  appendJournal(directory, { kind: 'approved', planDigest: approval.planDigest, approvalDigest: reader.digestOf(approval) });
}
function recoveryReport(directory) {
  const journal = readJournal(directory);
  validateFrozen(directory, { requireApproval: journal.some((entry) => ['reserved', 'dispatch'].includes(entry.kind)) });
  const reservations = journal.filter((entry) => entry.kind === 'reserved');
  const unsettled = reservations.filter(
    (entry) => !journal.some((later) => later.kind === 'settled' && later.attemptId === entry.attemptId),
  );
  return {
    status: unsettled.length > 0 ? 'recovery-required' : 'settled',
    unresolvedReservations: unsettled,
    settlements: journal.filter((entry) => entry.kind === 'settled'),
    stopped: journal.findLast((entry) => ['stopped', 'archive-failed'].includes(entry.kind)) ?? null,
    message:
      unsettled.length > 0
        ? 'Dispatched or reserved attempts remain unresolved. Preserve original workspaces and partial archives. Do not rerun or release their reservations without verified settlement.'
        : 'Every recorded reservation is settled',
  };
}
function validateFrozen(directory, { requireApproval = true } = {}) {
  const plan = readJson(path.join(directory, 'plan.json'));
  const entries = readJournal(directory);
  if (
    entries[0]?.kind !== 'frozen' ||
    entries[0].planDigest !== reader.digestOf(plan) ||
    entries[0].declarationDigest !== reader.declarationDigest(plan.declaration) ||
    entries.some((entry) => entry.kind === 'dispatch' && entry.planDigest !== reader.digestOf(plan)) ||
    reader.canonicalJson(readJson(path.join(directory, 'declaration.json'))) !== reader.canonicalJson(plan.declaration)
  )
    throw new Error('Frozen plan/declaration integrity failure');
  if (!fs.existsSync(path.join(directory, 'approval.json'))) {
    if (requireApproval) throw new Error('Explicit approval of the frozen plan is required before dispatch');
    return plan;
  }
  const approval = readJson(path.join(directory, 'approval.json'));
  if (
    !entries.some(
      (entry) =>
        entry.kind === 'approved' && entry.approvalDigest === reader.digestOf(approval) && entry.planDigest === approval.planDigest,
    ) ||
    approval.planDigest !== reader.digestOf(plan) ||
    approval.approved !== true ||
    !approval.approvedBy ||
    approval.maxUsd !== plan.maxUsd
  )
    throw new Error('Approval binding integrity failure');
  return plan;
}
async function executePlan(directory, { testDouble = null, archive = null, afterDispatch = null } = {}) {
  const plan = validateFrozen(directory);
  if (plan.blockers.length > 0) throw new Error(`Live experiment blocked: ${plan.blockers.join('; ')}`);
  if (!testDouble || plan.money?.label !== 'deterministic-test-double') throw new Error(liveBlockers(plan.agent).join('; '));
  if (!Number.isFinite(testDouble.boundUsd) || testDouble.boundUsd < 0 || usdGreater(plan.money.upperBoundUsdExact, plan.maxUsd))
    throw new Error('Verified all-in money bound exceeds approved cap');
  if (recoveryReport(directory).status !== 'settled') throw new Error('Recovery required before any dispatch');
  if (readJournal(directory).some((entry) => entry.kind === 'dispatch'))
    throw new Error('A frozen plan executes once. Resume through recovery; attempts are never rerun');
  const normalizedDouble = {
    command: path.resolve(testDouble.command),
    args: testDouble.args ?? [],
    executableSha256: testDouble.executableSha256,
    boundUsd: testDouble.boundUsd,
    overheadUsd: testDouble.overheadUsd ?? 0,
  };
  if (reader.canonicalJson(normalizedDouble) !== reader.canonicalJson(plan.testDouble))
    throw new Error('Test double execution settings differ from the approved plan');
  const executable = path.resolve(testDouble.command);
  if (sha(fs.readFileSync(executable)) !== testDouble.executableSha256) throw new Error('Test double executable identity mismatch');
  const { createRegistry, probeRequest } = require('./registry');
  const { gitAccessOf } = require('./workspace');
  const { retainSkillArtifacts } = require('./retain-skill-artifacts');
  const registry = createRegistry(
    [
      {
        interfaceId: 'tea-test-design-runner',
        executable: 'tea-test-design-runner',
        target: 'cli/test-design-runner.js',
        subcommandPaths: [[]],
        artifacts: {},
        environmentKeys: [],
        maxElapsedMs: plan.timeoutMs + 60_000,
        infrastructureExitCodes: [1, 3, 4, 5, 6],
      },
    ],
    { root: PACKAGE_ROOT },
  );
  if (reader.canonicalJson(plan.declaration.identity.fixed) !== reader.canonicalJson(nativeIdentity()))
    throw new Error('Native inputs or scorer changed after approval');
  const groundTruth = scoring.loadGroundTruth();
  const attemptRoot = path.join(directory, 'attempts');
  fs.mkdirSync(attemptRoot);
  let spent = usdText(testDouble.overheadUsd ?? 0);
  let ledger = [];
  for (const slot of plan.schedule) {
    for (let attempt = 1; attempt <= plan.declaration.design.maxAttempts; attempt++) {
      if (usdGreater(usdSum([spent, testDouble.boundUsd]), plan.maxUsd)) {
        appendJournal(directory, { kind: 'stopped', reason: 'approved cap exhausted' });
        return recoveryReport(directory);
      }
      const set = groundTruth.fixtureSets.find((set) => set.id === slot.caseId);
      if (!set) throw new Error(`Unsupported native Test Design case ${slot.caseId}`);
      const workspace = await staging.stageWorkspace(set);
      const leaked = await staging.assertGroundTruthAbsent(workspace.dir);
      if (leaked.length > 0) {
        fs.rmSync(workspace.dir, { recursive: true, force: true });
        throw new Error(leaked.join('; '));
      }
      const attemptId = `${slot.caseId}/${slot.repetition}/${slot.arm}/${attempt}`;
      appendJournal(directory, { kind: 'reserved', attemptId, boundUsd: testDouble.boundUsd, originalWorkspace: workspace.dir });
      if (plan.declaration.scope.candidate && !ledger.some((entry) => entry.caseId === slot.caseId)) {
        ledger = reader.appendExposure(ledger, {
          kind: 'selection-exposure',
          candidateId: plan.declaration.scope.candidate.id,
          caseId: slot.caseId,
          stage: plan.declaration.stage,
          attemptId,
          at: now(),
        });
        appendJournal(directory, { kind: 'exposure', entry: ledger.at(-1) });
      }
      appendJournal(directory, {
        kind: 'dispatch',
        attemptId,
        ...slot,
        attempt,
        planDigest: reader.digestOf(plan),
        originalWorkspace: workspace.dir,
      });
      const prompt = staging.buildPrompt(set);
      let observation;
      try {
        const { port } = await registry.createProbePort({
          cwd: workspace.dir,
          git: gitAccessOf(workspace),
          privateRoot: registry.privateRoot,
        });
        observation = await port.probe(
          probeRequest({
            probeId: attemptId.toLowerCase().replaceAll('/', '-'),
            interfaceId: 'tea-test-design-runner',
            operationId: 'design-fixture-set',
            option: {
              agent: 'custom',
              'agent-cmd': executable,
              'agent-arg': (testDouble.args ?? []).map((arg) =>
                arg
                  .replaceAll('{model}', plan.declaration.identity?.arms?.[slot.arm]?.model?.requested ?? '')
                  .replaceAll('{effort}', plan.declaration.identity?.arms?.[slot.arm]?.effort?.requested ?? ''),
              ),
              model: plan.declaration.identity?.arms?.[slot.arm]?.model?.requested ?? 'deterministic-test-double',
              'design-path': staging.designArtifactPaths(set).design,
              'timeout-ms': String(plan.timeoutMs),
              'capture-path': 'source-capture.json',
              'capture-test-double': true,
            },
            environment: {},
            stdin: { kind: 'text', value: prompt },
          }),
          new AbortController().signal,
        );
      } catch (error) {
        observation = { fault: { name: error.name, code: error.code ?? null, message: error.message } };
      }
      appendJournal(directory, { kind: 'completion', attemptId, exitCode: observation.exitCode ?? null, fault: observation.fault ?? null });
      if (afterDispatch) await afterDispatch({ directory, workspace, observation, attemptId });
      const capturedSource = runnerSource(workspace, observation);
      if (capturedSource.status !== 'verified') {
        let partialArchive = null;
        try {
          partialArchive = await (archive ?? retainSkillArtifacts)({
            preserveOnFailure: true,
            artifactsDir: attemptRoot,
            workspace,
            caseId: slot.caseId,
            agent: 'custom',
            model: null,
            repetition: slot.repetition,
            attempt,
            prompt,
            observation,
            provenance: { status: 'failed', sourceIntegrity: capturedSource.status },
          });
          writeJson(path.join(partialArchive, 'runner-source-result.json'), capturedSource);
        } catch (error) {
          partialArchive = partialArchive ?? error.partialArchive ?? null;
        }
        appendJournal(directory, {
          kind: 'archive-failed',
          attemptId,
          originalWorkspace: workspace.dir,
          partialArchive,
          message: `Source capture integrity ${capturedSource.status}: ${capturedSource.error ?? 'runner rejected modified capture'}`,
        });
        return recoveryReport(directory);
      }
      const source = capturedSource.source;
      const text =
        observation.artifacts?.design?.value ??
        (fs.existsSync(path.join(workspace.dir, staging.designArtifactPaths(set).design))
          ? fs.readFileSync(path.join(workspace.dir, staging.designArtifactPaths(set).design), 'utf8')
          : null);
      // The registry reads both deliverable and source receipt as artifacts; also retain exact workspace bytes on faults.
      observation.artifacts ??= {};
      observation.artifacts.design = text === null ? { kind: 'absent' } : { kind: 'text', value: text };
      const status =
        source?.status === 'completed' && observation.exitCode === 0
          ? 'completed'
          : source?.status === 'timeout'
            ? 'timeout'
            : source?.status === 'canceled'
              ? 'canceled'
              : 'failed';
      const replayed = text === null ? null : reader.testDesignReplay({ groundTruth })(text, { caseId: slot.caseId });
      const diagnostic = {
        caseId: slot.caseId,
        repetition: slot.repetition,
        completionState: status,
        signature: replayed?.signature ?? null,
        metricContributions: {},
        failureClass: status === 'completed' ? 'none' : (source.failureClass ?? 'environment-transport'),
      };
      const read = text === null ? null : scoring.readDesign({ kind: 'text', value: text });
      const mutations = await staging.corpusMutations(workspace);
      if (read?.ok) {
        const scored = scoring.scoreRun(set, read.design, new Set(groundTruth.riskCategories));
        diagnostic.metricContributions = scoring.numericContributions(scoring.testDesignDiagnosticProjection(scored, mutations));
        diagnostic.signature = scoring.signatureOf(scored, mutations);
      }
      diagnostic.metricContributions.fixtureMutations = mutations;
      diagnostic.metricContributions.maxFixtureMutations = scoring.THRESHOLDS.maxFixtureMutations;
      if (mutations > 0) diagnostic.failureClass = 'environment-configuration';
      diagnostic.qualification = status === 'completed' ? nativeQualification(diagnostic.metricContributions) : 'failed';
      if (diagnostic.qualification === 'failed' && diagnostic.failureClass === 'none') diagnostic.failureClass = 'quality';
      const observed = {
        fixed: nativeIdentity(workspace, set),
        arm: {
          model: { requested: source?.requested?.model ?? null, resolved: source?.observed?.resolvedModel ?? null },
          effort: {
            requested: plan.declaration.identity?.arms?.[slot.arm]?.effort?.requested ?? null,
            applied: source?.observed?.appliedEffort ?? null,
          },
        },
      };
      const provenance = {
        evaluationId: plan.planId,
        originalWorkspace: source?.workspace ?? workspace.dir,
        label: 'deterministic-test-double',
        stage: plan.declaration.stage,
        arm: slot.arm,
        status,
        blockId: slot.blockId,
        observed,
        receipt: source?.endedAt
          ? {
              kind: 'fresh-workspace',
              workspaceId: source.workspaceId,
              startedAt: source.startedAt,
              endedAt: source.endedAt,
              artifactSha256: source.artifactSha256 ?? null,
            }
          : null,
        usage: source?.usage ?? null,
        cost: source?.cost ?? null,
        latency: source?.endedAt ? { wallMs: Date.parse(source.endedAt) - Date.parse(source.startedAt) } : null,
      };
      let retained;
      try {
        retained = await (archive ?? retainSkillArtifacts)({
          preserveOnFailure: true,
          artifactsDir: attemptRoot,
          workspace,
          caseId: slot.caseId,
          agent: 'custom',
          model: source?.requested?.model ?? null,
          repetition: slot.repetition,
          attempt,
          prompt,
          observation,
          provenance,
        });
        writeJson(path.join(retained, 'diagnostic.json'), diagnostic);
        sealAttemptArchive(retained);
        appendJournal(directory, {
          kind: 'sealed',
          attemptId,
          directory: path.relative(directory, retained),
          manifestSha256: sha(fs.readFileSync(path.join(retained, 'manifest.json'))),
        });
      } catch (error) {
        appendJournal(directory, {
          kind: 'archive-failed',
          attemptId,
          originalWorkspace: workspace.dir,
          partialArchive: retained ?? error.partialArchive ?? null,
          message: error.message,
        });
        return recoveryReport(directory);
      }
      const cost = source?.cost;
      const charge =
        cost?.currency === 'USD' &&
        Object.keys(cost.components ?? {}).includes('target') &&
        Object.keys(cost.components ?? {}).includes('tools') &&
        Object.values(cost.components).every((value) => Number.isFinite(value) && value >= 0)
          ? usdSum(Object.values(cost.components))
          : null;
      if (
        charge === null ||
        usdGreater(charge, testDouble.boundUsd) ||
        !source?.observed?.resolvedModel ||
        !source?.observed?.appliedEffort
      ) {
        appendJournal(directory, {
          kind: 'stopped',
          attemptId,
          reason: 'required source identity/cost missing or reserved bound violated',
        });
        return recoveryReport(directory);
      }
      spent = usdSum([spent, charge]);
      appendJournal(directory, {
        kind: 'settled',
        attemptId,
        chargeUsd: Number(charge),
        totalUsd: Number(spent),
        chargeUsdExact: charge,
        totalUsdExact: spent,
      });
      fs.rmSync(workspace.dir, { recursive: true, force: true });
      if (status === 'completed') break;
    }
  }
  writeJson(path.join(directory, 'exposure.json'), ledger);
  appendJournal(directory, { kind: 'finished', totalUsd: Number(spent), totalUsdExact: spent });
  return analyzeExperiment(directory, path.join(directory, 'analysis'));
}
function analyzeExperiment(directory, out) {
  const journal = readJournal(directory);
  const captured = journal.some((entry) => ['dispatch', 'completion', 'sealed'].includes(entry.kind));
  const plan = validateFrozen(directory, { requireApproval: captured });
  const attempts = [];
  const limitations = [];
  const groundTruth = scoring.loadGroundTruth();
  const nativeRecords = {};
  for (const entry of journal.filter((entry) => entry.kind === 'sealed')) {
    const archive = confinedPath(directory, entry.directory);
    if (sha(fs.readFileSync(path.join(archive, 'manifest.json'))) !== entry.manifestSha256)
      throw new Error('Sealed manifest differs from controller journal');
    const loaded = reader.loadSealedTestDesignAttempt({ dir: archive, runId: plan.planId });
    if (Object.values(loaded.records).some((record) => record.manifestSha256 !== entry.manifestSha256))
      throw new Error('Sealed manifest differs from controller journal');
    attempts.push(...loaded.rows);
    Object.assign(nativeRecords, loaded.records);
  }
  for (const entry of journal.filter(
    (entry) => entry.kind === 'dispatch' && !journal.some((later) => later.kind === 'sealed' && later.attemptId === entry.attemptId),
  )) {
    attempts.push({
      attemptId: `${plan.planId}/${entry.attemptId}`,
      runId: plan.planId,
      stage: plan.declaration.stage,
      arm: entry.arm,
      caseId: entry.caseId,
      clusterId: entry.caseId,
      repetition: entry.repetition,
      attempt: entry.attempt,
      blockId: entry.blockId,
      status: 'failed',
      outputText: null,
      outputSha256: null,
      receipt: null,
      observed: null,
      cost: null,
      usage: null,
      latency: null,
      metrics: {},
      counts: {},
      error: 'Dispatched attempt has no verified sealed source evidence; its reservation remains unresolved',
    });
  }
  const ledger = journal.filter((entry) => entry.kind === 'exposure').map((entry) => entry.entry);
  if (
    fs.existsSync(path.join(directory, 'exposure.json')) &&
    reader.canonicalJson(readJson(path.join(directory, 'exposure.json'))) !== reader.canonicalJson(ledger)
  )
    throw new Error('Exposure history differs from durable controller journal');
  const result = reader.readExperiment({
    declaration: plan.declaration,
    attempts,
    nativeRecords,
    replay: reader.testDesignReplay({ groundTruth }),
    ledger,
  });
  result.report.savedInputs = [directory];
  result.report.offlineAnalysis = { freshAttempts: 0, modelCalls: 0, judgeCalls: 0 };
  result.report.controller = {
    status: captured ? 'captured-experiment' : 'proposal-without-evidence',
    proposalBlockers: plan.blockers,
    label: plan.money?.label ?? 'native',
    journalEntries: journal.length,
    recovery: recoveryReport(directory),
    attempts: attempts.length,
    automaticAdoption: false,
  };
  if (!captured)
    result.report.sourceLimitations.push(
      'This frozen proposal has no captured attempts. Offline inspection needs no execution or spending approval and dispatches nothing.',
    );
  result.report.sourceLimitations.push(
    ...limitations,
    feasibility().limitation,
    'Deterministic doubles verify orchestration and accounting only. They establish no provider quality or savings.',
    'The local unsigned journal checks retained sequence and bindings. It cannot prove tail completeness, resist wholesale rechaining, or establish independent wall-clock ordering.',
    'Exposure history covers this experiment only. Prior candidate exposure outside these records is unknown; native confirmation remains unavailable.',
  );
  if (out) reader.writeOutputs(result, out);
  return result;
}
async function experimentCommand(options) {
  if (['saved', 'searchRoot', 'propose', 'recover'].filter((key) => options[key] !== undefined).length > 1)
    throw Object.assign(new Error('Choose exactly one experiment operation: --saved, --search-root, --propose or --recover'), {
      code: 'EXPERIMENT_USAGE',
    });
  let result;
  if (options.saved || options.searchRoot)
    result = analyzeSaved({ saved: options.saved ? [options.saved] : [], searchRoot: options.searchRoot, out: options.out });
  else if (options.recover) result = recoveryReport(path.resolve(options.recover));
  else if (options.propose) {
    const declaration = readJson(options.propose);
    result = makeProposal({ declaration, agent: options.agent, maxUsd: options.maxUsd === undefined ? undefined : Number(options.maxUsd) });
    if (options.out) freezeProposal(result, path.resolve(options.out));
  } else throw new Error('Use --saved <path>, --search-root <path>, --propose <declaration.json>, or --recover <experiment directory>');
  process.stdout.write(`${JSON.stringify(result.report ?? result, null, 2)}\n`);
  return 0;
}
module.exports = {
  nativeIdentity,
  runnerSource,
  discoverSaved,
  analyzeSaved,
  feasibility,
  liveBlockers,
  makeProposal,
  freezeProposal,
  approvePlan,
  executePlan,
  analyzeExperiment,
  readJournal,
  recoveryReport,
  experimentCommand,
  sealAttemptArchive,
};
