const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const TOML = require('smol-toml');
const { migrate } = require('../cli/migrate-customizations');

test('moves every pre-3.0 customization namespace and preserves values', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-migration-'));
  try {
    const custom = path.join(root, '_bmad', 'custom');
    fs.mkdirSync(custom, { recursive: true });
    for (const name of [
      'bmad-testarch-automate',
      'bmad-testarch-evaluate',
      'bmad-testarch-framework',
      'bmad-testarch-nfr',
      'bmad-testarch-test-design',
      'bmad-testarch-test-review',
      'bmad-testarch-trace',
      'bmad-testarch-atdd',
      'bmad-testarch-ci',
      'bmad-teach-me-testing',
    ]) {
      fs.writeFileSync(path.join(custom, `${name}.toml`), '[workflow]\non_complete = "retain me"\n');
      fs.writeFileSync(path.join(custom, `${name}.user.toml`), '[workflow]\npersistent_facts = ["my fact"]\n');
    }
    assert.equal(migrate(root, { check: true }).length, 20);
    assert.equal(migrate(root).length, 20);
    assert.equal(migrate(root).length, 0);
    for (const name of [
      'automate',
      'evaluate',
      'framework',
      'nfr',
      'test-design',
      'test-review',
      'trace',
      'atdd',
      'ci',
      'teach-me-testing',
    ]) {
      const prefix = `bmad-tea-${name}`;
      assert.equal(TOML.parse(fs.readFileSync(path.join(custom, `${prefix}.toml`), 'utf8')).workflow.on_complete, 'retain me');
      assert.deepEqual(TOML.parse(fs.readFileSync(path.join(custom, `${prefix}.user.toml`), 'utf8')).workflow.persistent_facts, [
        'my fact',
      ]);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports conflicts before changing any file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-migration-'));
  try {
    const custom = path.join(root, '_bmad', 'custom');
    fs.mkdirSync(custom, { recursive: true });
    const oldFile = path.join(custom, 'bmad-testarch-ci.toml');
    const newFile = path.join(custom, 'bmad-tea-ci.toml');
    fs.writeFileSync(oldFile, '[workflow]\nci_platform = "github-actions"\n');
    fs.writeFileSync(newFile, '[workflow]\nci_platform = "gitlab-ci"\n');
    assert.throws(
      () => migrate(root),
      (error) => error.message.includes(oldFile) && error.message.includes(newFile),
    );
    assert.equal(fs.readFileSync(oldFile, 'utf8'), '[workflow]\nci_platform = "github-actions"\n');
    assert.equal(fs.readFileSync(newFile, 'utf8'), '[workflow]\nci_platform = "gitlab-ci"\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('merges distinct old and new settings in one customization layer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tea-migration-'));
  try {
    const custom = path.join(root, '_bmad', 'custom');
    fs.mkdirSync(custom, { recursive: true });
    const oldFile = path.join(custom, 'bmad-testarch-evaluate.user.toml');
    const newFile = path.join(custom, 'bmad-tea-evaluate.user.toml');
    fs.writeFileSync(oldFile, '[workflow]\nevaluations_folder = "my-evals"\n');
    fs.writeFileSync(newFile, '[workflow]\non_complete = "report result"\n');
    assert.equal(migrate(root).length, 1);
    assert.deepEqual(TOML.parse(fs.readFileSync(newFile, 'utf8')).workflow, {
      evaluations_folder: 'my-evals',
      on_complete: 'report result',
    });
    assert.equal(fs.existsSync(oldFile), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
