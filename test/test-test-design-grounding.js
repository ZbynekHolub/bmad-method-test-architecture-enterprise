/**
 * Deterministic guard for test-design grounding and coverage-link guidance.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { matchesGroups, normalizeText } = require('./eval-test-design');

const ROOT = path.join(__dirname, '..', 'skills', 'bmad-testarch-test-design');
const riskStep = fs.readFileSync(path.join(ROOT, 'steps-c', 'step-03-risk-and-testability.md'), 'utf8');
const coverageStep = fs.readFileSync(path.join(ROOT, 'steps-c', 'step-04-coverage-plan.md'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'test-design-template.md'), 'utf8');

assert.match(riskStep, /Ground every risk in an explicit statement from the supplied epic/);
assert.match(riskStep, /Do not add plausible risks merely because they are common in other systems/);
assert.match(coverageStep, /Use the exact `Risk ID` assigned in the risk register/);
assert.match(coverageStep, /Give every material risk at least one coverage row/);
assert.match(template, /Use the exact `Risk ID` from the risk assessment in `Risk Link`/);
assert.match(template, /Every material risk must appear in at least one coverage row/);

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'test-design-eval', 'ground-truth.json'), 'utf8'));
const risks = fixture.fixtureSets.find((set) => set.id === 'seeded-offline-order-capture').materialRisks;
const descriptions = [
  [
    'data-sync-conflict-overwrite',
    'Two offline editors apply arrival order without version checks. Later arrivals silently erase earlier lines and their history.',
  ],
  ['ops-no-release-kill-switch', 'No flag or staged release; disabling needs a new build and 1–3 days of store review.'],
];
for (const [id, description] of descriptions) {
  const risk = risks.find((entry) => entry.id === id);
  assert.ok(risk, `missing fixture risk ${id}`);
  assert.ok(matchesGroups(risk.anyOf, normalizeText(description)), `${id} should match an observed equivalent risk description`);
}

console.log('test-design grounding and coverage-link guidance is enforced');
