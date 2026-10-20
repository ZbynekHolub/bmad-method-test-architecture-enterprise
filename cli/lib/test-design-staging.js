/** Native Test Design staging, shared with the checkout harness. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { digest } = require('./evaluate/digest');
const { TEA_CONFIG_RELATIVE_PATH, TEA_KNOWLEDGE_PROMPT_LINE, stageTeaKnowledge, teaConfigToml } = require('./test-design-staged-config');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_ROOT = path.join(__dirname, 'evaluate/test-design-corpus');
const GROUND_TRUTH = path.join(FIXTURE_ROOT, 'ground-truth.json');
const SKILL_ROOT = path.join(PROJECT_ROOT, 'skills/bmad-tea-test-design');
async function readText(file) {
  try {
    return { present: true, text: fs.readFileSync(file, 'utf8') };
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false };
    throw error;
  }
}
async function writeText(file, text) {
  fs.writeFileSync(file, text);
}
const GROUND_TRUTH_ONLY_TOKENS = [
  'materialRisks',
  'unsupportedRisks',
  'severityRank',
  'acceptableCoverage',
  'groundingQuote',
  'exclusionQuote',
  'maxRisks',
  // The two keys that carry the matcher vocabulary itself. Neither string occurs in
  // the staged skill tree or in either epic, so naming them costs nothing and closes
  // the one channel through which the matchers could reach the agent.
  'anyOf',
  'exampleDescription',
];
function projectRootOf(set) {
  return set.projectRoot;
}

function designArtifactPaths(set) {
  const design = path.posix.join(projectRootOf(set), 'test-artifacts', 'test-design', `test-design-epic-${set.epicNum}.md`);
  return { design };
}

function filesUnder(root) {
  const found = [];
  const walk = (directory, prefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) walk(absolute, relative);
      else if (entry.isFile()) found.push(relative);
    }
  };
  if (fs.existsSync(root)) walk(root, '');
  return found;
}

async function digestTree(root, relativePaths, io = {}) {
  const parts = [];
  for (const relative of relativePaths) {
    const read = await (io.readText ?? readText)(path.join(root, relative));
    // `fs.readFileSync` threw here and the behaviour is kept, named. Absence has
    // to be loud: the alternative is decoding a null into the digest, so a file
    // the walk found and the read did not would produce a digest that compares
    // equal to nothing and reads as a mutation nobody can locate.
    if (!read.present) {
      throw new Error(`${relative} was listed under ${root} and could not be read, so the corpus digest cannot be taken`);
    }
    parts.push(`${relative}\0${read.text}`);
  }
  return digest(parts.join('\u0001'));
}

function configToml() {
  return teaConfigToml({
    header: ['# Written by the native Test Design fixture runner for one staged fixture set.'],
    core: [
      ['user_name', 'tea-eval-harness'],
      ['project_name', 'field-service-platform'],
      ['communication_language', 'English'],
      ['document_output_language', 'English'],
      ['output_folder', 'docs'],
    ],
    tea: [['test_artifacts', 'test-artifacts']],
  });
}

async function corpusMutations(workspace, io = {}) {
  const changed = (await digestTree(workspace.projectDir, workspace.corpusFiles, io)) === workspace.corpusDigest ? 0 : 1;
  const added = filesUnder(workspace.projectDir).filter(
    (relative) =>
      !relative.startsWith(`test-artifacts${path.sep}`) &&
      !relative.startsWith(`_bmad${path.sep}`) &&
      !workspace.corpusFiles.includes(relative),
  );
  return changed + added.length;
}

async function stageWorkspace(set, io = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-test-design-eval-'));
  try {
    return await stageIntoWorkspace(dir, set, io);
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

async function stageIntoWorkspace(dir, set, io = {}) {
  const projectDir = path.join(dir, projectRootOf(set));
  const setRoot = path.join(FIXTURE_ROOT, set.root);

  for (const relative of filesUnder(setRoot)) {
    const target = path.join(projectDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(setRoot, relative), target);
  }
  // The workflow writes its document and its progress checkpoint here. Neither set
  // brings anything into this directory, so a run cannot inherit a checkpoint.
  fs.mkdirSync(path.join(projectDir, 'test-artifacts'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '_bmad'), { recursive: true });
  await (io.writeText ?? writeText)(path.join(projectDir, TEA_CONFIG_RELATIVE_PATH), configToml());

  for (const relative of filesUnder(SKILL_ROOT)) {
    const target = path.join(dir, 'skill', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(SKILL_ROOT, relative), target);
  }
  stageTeaKnowledge(dir);

  // The corpus files the run must leave alone. test-artifacts and _bmad are excluded
  // because the run legitimately writes into the first and the harness wrote the second.
  const corpusFiles = filesUnder(projectDir).filter(
    (relative) => !relative.startsWith(`test-artifacts${path.sep}`) && !relative.startsWith(`_bmad${path.sep}`),
  );
  return { dir, projectDir, corpusFiles, corpusDigest: await digestTree(projectDir, corpusFiles, io) };
}

async function assertGroundTruthAbsent(dir, io = {}) {
  const problems = [];
  // Both existence checks are gone: each read answers absence itself. A staged
  // file that vanished between the walk and the read used to contribute an empty
  // string, which is the same silence one file at a time, and is reported now.
  const groundTruthBytes = (await (io.readText ?? readText)(io.groundTruth ?? GROUND_TRUTH)).text;
  for (const relative of filesUnder(dir)) {
    if (path.basename(relative) === 'ground-truth.json') {
      problems.push(`staged workspace contains ${relative}`);
      continue;
    }
    const staged = await (io.readText ?? readText)(path.join(dir, relative));
    if (!staged.present) {
      problems.push(`staged file ${relative} disappeared between the walk and the read, so it was not checked`);
      continue;
    }
    const text = staged.text;
    if (groundTruthBytes && text === groundTruthBytes) {
      problems.push(`staged file ${relative} carries the ground truth verbatim`);
      continue;
    }
    for (const token of GROUND_TRUTH_ONLY_TOKENS) {
      if (text.includes(token)) problems.push(`staged file ${relative} carries the ground-truth-only key "${token}"`);
    }
  }
  return problems;
}

function buildPrompt(set, { designLevel = 'full' } = {}) {
  const root = projectRootOf(set);
  return [
    `You are running the TEA workflow \`bmad-tea-test-design\` against the project in \`${root}/\`.`,
    '',
    'The workflow is in `skill/`. Read `skill/instructions.md` first, then execute every step file it',
    'names in order, in full, without skipping or reordering. The step files are under `skill/steps-c/`.',
    '',
    '----- run configuration -----',
    'Take mode C (Create). Resolve the workflow placeholders to these values:',
    '',
    `- \`{project-root}\`: \`${root}\``,
    `- TEA config (\`[core]\` and \`[modules.tea]\`): \`${root}/_bmad/config.toml\``,
    `- \`{test_artifacts}\`: \`${root}/test-artifacts\``,
    '- `{skill-root}`: `skill`',
    TEA_KNOWLEDGE_PROMPT_LINE,
    '- `mode`: `epic-level`',
    '- `run_scope`: `epic`',
    `- \`epic_num\`: \`${set.epicNum}\``,
    `- \`run_key\`: \`epic-${set.epicNum}\``,
    `- \`design_level\`: \`${designLevel}\``,
    '- `tea_execution_mode`: `sequential`',
    '- `tea_capability_probe`: `false`',
    '',
    `The epic is the one document under \`${root}/docs/epics/\`. It is the only requirements source for this`,
    'run; there is no PRD, no architecture document and no sprint status file, and none is missing.',
    '',
    '----- what to produce -----',
    'Write the one deliverable epic-level mode declares:',
    '',
    `- \`${root}/test-artifacts/test-design/test-design-epic-${set.epicNum}.md\`, from \`skill/test-design-template.md\`, carrying`,
    '  the risk assessment and the test coverage plan the template lays out, with each risk row stating its',
    '  category, probability, impact and score, and each coverage row naming its test level and the risk it',
    '  covers.',
    '',
    `Do not add, edit, or delete any file under \`${root}/docs/\`. This workflow does not change its inputs,`,
    'and it does not generate tests.',
    '',
    'Do not stop to ask a question. Every value the workflow would otherwise ask for is stated above.',
    '',
    'When you are done, print one line naming the file you wrote. Nothing else you print is read.',
  ].join('\n');
}

function caseIndex(sets) {
  return sets.map((set) => ({ id: set.id, prompt: buildPrompt(set) }));
}
module.exports = {
  TEA_CONFIG_RELATIVE_PATH,
  corpusMutations,
  projectRootOf,
  designArtifactPaths,
  filesUnder,
  digestTree,
  configToml,
  stageWorkspace,
  stageIntoWorkspace,
  assertGroundTruthAbsent,
  buildPrompt,
  caseIndex,
};
