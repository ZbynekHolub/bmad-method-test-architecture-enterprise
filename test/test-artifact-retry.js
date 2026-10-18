/**
 * Every artifact transfer in quality.yaml retries through a GitHub
 * artifact-service outage, and a real failure still fails.
 *
 * actions/upload-artifact and actions/download-artifact retry internally for
 * about 50 seconds. A chain shard once failed on five CreateArtifact timeouts
 * inside that window, which then failed the coverage job, though every test in
 * the shard had passed. So quality.yaml transfers artifacts only through the
 * local upload-artifact-retry and download-artifact-retry composite actions,
 * and this check holds both halves of that:
 *
 *  - the workflow: no step in quality.yaml calls actions/upload-artifact or
 *    actions/download-artifact directly; each retrying step carries a
 *    timeout-minutes bound, and each job's timeout leaves room for them;
 *  - each action: four attempts; the first three continue on error and each
 *    later one runs only when the previous one failed; the last attempt can
 *    fail the step; every upload attempt sets overwrite: true, so a retry after
 *    a partial upload cannot collide; the waits between attempts total at least
 *    two minutes and fit inside the step's timeout.
 *
 * A local action resolves from the job's checkout, so a step that uses one on
 * a path where the checkout has not succeeded fails on the missing action.yaml.
 * The coverage job once did exactly that: its chain gate ran before the
 * checkout, and the always() upload after it errored a second time. So in
 * every workflow, each step that uses a local action comes after an
 * actions/checkout step of this repository that cannot swallow its own
 * failure. A step whose if: can run after a failed step (always(), failure(),
 * cancelled(), !success(), or success() joined by ||), and every step after a
 * checkout that carries its own if:, also requires that checkout's success
 * with `&& steps.<id>.outcome == 'success'`. A step with no status function
 * runs only when every earlier step succeeded, the checkout included.
 *
 * It then proves it can fail: each guard is reverted in a parsed copy and must
 * be reported.
 *
 * Usage: node test/test-artifact-retry.js
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const WORKFLOW = path.join(WORKFLOWS, 'quality.yaml');
const ACTIONS = {
  './.github/actions/upload-artifact-retry': {
    file: '.github/actions/upload-artifact-retry/action.yaml',
    wraps: 'actions/upload-artifact@',
  },
  './.github/actions/download-artifact-retry': {
    file: '.github/actions/download-artifact-retry/action.yaml',
    wraps: 'actions/download-artifact@',
  },
};
const ATTEMPTS = 4;
const MIN_WAIT_SECONDS = 120;
// Each attempt can spend about 50 seconds in the wrapped action's own retries.
const ATTEMPT_SECONDS = 60;

let checks = 0;
const load = (file) => yaml.load(fs.readFileSync(path.join(ROOT, file), 'utf8'));

function actionProblems(uses, action) {
  const { wraps } = ACTIONS[uses];
  const problems = [];
  const steps = action?.runs?.steps ?? [];
  if (action?.runs?.using !== 'composite') problems.push(`${uses} is not a composite action`);
  const attempts = steps.filter((step) => typeof step.uses === 'string' && step.uses.startsWith(wraps));
  if (attempts.length !== ATTEMPTS) problems.push(`${uses} makes ${attempts.length} attempts, expected ${ATTEMPTS}`);
  for (const [index, attempt] of attempts.entries()) {
    const last = index === attempts.length - 1;
    const label = `${uses} attempt ${index + 1}`;
    if (!last && (attempt['continue-on-error'] !== true || !attempt.id))
      problems.push(`${label} must continue on error and carry an id, so the next attempt can run`);
    if (last && attempt['continue-on-error'] !== undefined) problems.push(`${label} is the last and must be able to fail the step`);
    const previous = attempts[index - 1];
    if (index === 0 ? attempt.if !== undefined : attempt.if !== `steps.${previous?.id}.outcome == 'failure'`)
      problems.push(`${label} must run ${index === 0 ? 'unconditionally' : `only when attempt ${index} failed`}`);
    if (wraps.startsWith('actions/upload-artifact') && String(attempt.with?.overwrite) !== 'true')
      problems.push(`${label} must set overwrite: true, so a retry after a partial upload cannot collide`);
  }
  let waited = 0;
  for (const step of steps.filter((candidate) => typeof candidate.run === 'string')) {
    const seconds = Number(/^sleep (\d+)$/.exec(step.run.trim())?.[1]);
    if (Number.isSafeInteger(seconds)) waited += seconds;
    else problems.push(`${uses} runs an unexpected command: ${step.run}`);
    if (!/^steps\.[\w-]+\.outcome == 'failure'$/.test(String(step.if))) problems.push(`${uses} waits even when no attempt failed`);
  }
  if (waited < MIN_WAIT_SECONDS) problems.push(`${uses} waits ${waited} s in all, under the ${MIN_WAIT_SECONDS} s an outage can last`);
  return { problems, worstSeconds: waited + ATTEMPTS * ATTEMPT_SECONDS };
}

/** The steps of each job that use a local action on a path where the repository may not be checked out. */
function localActionProblems(workflow) {
  const problems = [];
  for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
    const steps = job.steps ?? [];
    const checkoutIndex = steps.findIndex(
      (step) =>
        typeof step.uses === 'string' &&
        step.uses.startsWith('actions/checkout@') &&
        step.with?.repository === undefined &&
        step.with?.path === undefined,
    );
    const checkout = steps[checkoutIndex];
    for (const [index, step] of steps.entries()) {
      if (typeof step.uses !== 'string' || !step.uses.startsWith('./')) continue;
      const label = `${jobName}: "${step.name}" uses ${step.uses}`;
      if (checkoutIndex === -1 || checkoutIndex > index) {
        problems.push(`${label} before the job checks the repository out`);
        continue;
      }
      if (checkout['continue-on-error'] !== undefined && checkout['continue-on-error'] !== false)
        problems.push(`${label} after a checkout that continues on error, so it can run without the checkout`);
      const condition = String(step.if ?? '')
        .replace(/^\s*\$\{\{\s*([\s\S]*?)\s*\}\}\s*$/, '$1')
        .trim();
      // With no status function, or only success() in a plain conjunction, the step runs only when every
      // earlier step succeeded. Any other status function, a negation or an || can run it after a failed
      // checkout, and a checkout with its own if: can be skipped, which counts as success.
      const statusCanSkipCheckout =
        /\b(?:always|failure|cancelled)\(\)/.test(condition) ||
        /!\s*success\(\)/.test(condition) ||
        (/\bsuccess\(\)/.test(condition) && condition.includes('||'));
      const conditionalCheckout = checkout.if !== undefined;
      if (!statusCanSkipCheckout && !conditionalCheckout) continue;
      const guard = checkout.id && `steps.${checkout.id}.outcome == 'success'`;
      const guarded = guard && (condition === guard || condition.endsWith(` && ${guard}`)) && !condition.includes('||');
      if (!guarded)
        problems.push(
          `${label} under if: ${condition || '(none)'}${conditionalCheckout ? ' after a conditional checkout' : ''}, which can run without the checkout; add && steps.<checkout id>.outcome == 'success'`,
        );
    }
  }
  return problems;
}

function workflowProblems(workflow, actions) {
  const problems = [...localActionProblems(workflow)];
  const worst = Object.fromEntries(Object.keys(ACTIONS).map((uses) => [uses, actionProblems(uses, actions[uses])]));
  for (const { problems: found } of Object.values(worst)) problems.push(...found);
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    let retryMinutes = 0;
    for (const step of job.steps ?? []) {
      if (typeof step.uses !== 'string') continue;
      if (/^actions\/(?:upload|download)-artifact@/.test(step.uses))
        problems.push(`${jobName}: "${step.name}" calls ${step.uses} directly; use the retrying local action`);
      if (!ACTIONS[step.uses]) continue;
      const minutes = step['timeout-minutes'];
      if (!Number.isSafeInteger(minutes)) problems.push(`${jobName}: "${step.name}" has no timeout-minutes bound`);
      else if (minutes * 60 < worst[step.uses].worstSeconds)
        problems.push(`${jobName}: "${step.name}" times out before its last attempt can run`);
      else retryMinutes += minutes;
    }
    if (retryMinutes > 0 && !(job['timeout-minutes'] > retryMinutes))
      problems.push(`${jobName}: timeout-minutes ${job['timeout-minutes']} leaves no room for ${retryMinutes} minutes of artifact retries`);
  }
  return problems;
}

const workflow = yaml.load(fs.readFileSync(WORKFLOW, 'utf8'));
const actions = Object.fromEntries(Object.entries(ACTIONS).map(([uses, { file }]) => [uses, load(file)]));
assert.deepEqual(workflowProblems(workflow, actions), []);
checks++;
for (const file of fs.readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name))) {
  assert.deepEqual(
    localActionProblems(load(path.join('.github', 'workflows', file))),
    [],
    `${file} uses a local action without a checkout`,
  );
  checks++;
}
const transfers = Object.values(workflow.jobs).flatMap((job) => (job.steps ?? []).filter((step) => ACTIONS[step.uses]));
assert.ok(transfers.length >= 5, 'quality.yaml routes its uploads and the coverage download through the retrying actions');
checks++;

const reverts = [
  [
    'a direct upload-artifact call',
    (copy) => (copy.workflow.jobs.chain.steps.find((step) => ACTIONS[step.uses]).uses = 'actions/upload-artifact@v4'),
    /calls actions\/upload-artifact@v4 directly/,
  ],
  [
    'a direct download-artifact call',
    (copy) =>
      (copy.workflow.jobs.coverage.steps.find((step) => step.uses === './.github/actions/download-artifact-retry').uses =
        'actions/download-artifact@v4'),
    /calls actions\/download-artifact@v4 directly/,
  ],
  [
    'a retrying step without a timeout',
    (copy) => delete copy.workflow.jobs.chain.steps.find((step) => ACTIONS[step.uses])['timeout-minutes'],
    /has no timeout-minutes bound/,
  ],
  [
    'a step timeout shorter than the ladder',
    (copy) => (copy.workflow.jobs.chain.steps.find((step) => ACTIONS[step.uses])['timeout-minutes'] = 2),
    /times out before its last attempt can run/,
  ],
  ['a job timeout with no room for retries', (copy) => (copy.workflow.jobs.chain['timeout-minutes'] = 20), /leaves no room/],
  [
    'an upload without overwrite',
    (copy) => delete copy.actions['./.github/actions/upload-artifact-retry'].runs.steps[0].with.overwrite,
    /must set overwrite: true/,
  ],
  [
    'a last attempt that swallows its failure',
    (copy) => (copy.actions['./.github/actions/upload-artifact-retry'].runs.steps.at(-1)['continue-on-error'] = true),
    /is the last and must be able to fail the step/,
  ],
  [
    'a first attempt that fails the step',
    (copy) => delete copy.actions['./.github/actions/download-artifact-retry'].runs.steps[0]['continue-on-error'],
    /must continue on error/,
  ],
  [
    'a retry that runs after a success',
    (copy) => delete copy.actions['./.github/actions/upload-artifact-retry'].runs.steps[2].if,
    /must run only when attempt 1 failed/,
  ],
  [
    'a dropped attempt',
    (copy) => copy.actions['./.github/actions/upload-artifact-retry'].runs.steps.splice(-2, 2),
    /makes 3 attempts, expected 4/,
  ],
  [
    'an always() local-action step without the checkout guard',
    (copy) => (copy.workflow.jobs.coverage.steps.find((step) => step.name === 'Upload the coverage report').if = 'always()'),
    /coverage: "Upload the coverage report" uses .* under if: always\(\), which can run without the checkout/,
  ],
  [
    'a checkout guard joined by ||',
    (copy) => (copy.workflow.jobs.chain.steps.find((step) => ACTIONS[step.uses]).if = "always() || steps.checkout.outcome == 'success'"),
    /which can run without the checkout/,
  ],
  [
    'a local-action step under !success() without the checkout guard',
    (copy) => (copy.workflow.jobs.coverage.steps.find((step) => step.name === 'Upload the coverage report').if = '${{ !success() }}'),
    /under if: !success\(\), which can run without the checkout/,
  ],
  [
    'a checkout guard naming another step',
    (copy) =>
      (copy.workflow.jobs.coverage.steps.find((step) => step.name === 'Upload the coverage report').if =
        "always() && steps.setup.outcome == 'success'"),
    /which can run without the checkout/,
  ],
  [
    'a conditional checkout',
    (copy) =>
      (copy.workflow.jobs.coverage.steps.find((step) => step.uses?.startsWith('actions/checkout@')).if = "github.event_name == 'push'"),
    /coverage: "Download every shard's raw coverage" uses .* after a conditional checkout/,
  ],
  [
    'a local-action step ahead of the checkout',
    (copy) => {
      const { steps } = copy.workflow.jobs.coverage;
      const download = steps.splice(
        steps.findIndex((step) => step.uses === './.github/actions/download-artifact-retry'),
        1,
      );
      steps.unshift(...download);
    },
    /coverage: "Download every shard's raw coverage" uses .* before the job checks the repository out/,
  ],
  [
    'a checkout that continues on error',
    (copy) => (copy.workflow.jobs.coverage.steps.find((step) => step.uses?.startsWith('actions/checkout@'))['continue-on-error'] = true),
    /after a checkout that continues on error/,
  ],
  [
    'a checkout into another path',
    (copy) => (copy.workflow.jobs.chain.steps.find((step) => step.uses?.startsWith('actions/checkout@')).with.path = 'elsewhere'),
    /chain: .* before the job checks the repository out/,
  ],
  [
    'waits too short for an outage',
    (copy) => {
      for (const step of copy.actions['./.github/actions/download-artifact-retry'].runs.steps) if (step.run) step.run = 'sleep 5';
    },
    /under the 120 s an outage can last/,
  ],
];
for (const [label, mutate, pattern] of reverts) {
  const copy = structuredClone({ workflow, actions });
  mutate(copy);
  const problems = workflowProblems(copy.workflow, copy.actions);
  assert.ok(
    problems.some((problem) => pattern.test(problem)),
    `${label}: no problem matches ${pattern}\n${JSON.stringify(problems)}`,
  );
  checks++;
  console.log(`✓ ${label} is refused`);
}
console.log(`\n${checks} artifact-retry check(s) passed.`);
