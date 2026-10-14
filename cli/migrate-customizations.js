#!/usr/bin/env node
/** Move pre-3.0 TEA customization files to their canonical workflow names. */
const fs = require('node:fs');
const path = require('node:path');
const TOML = require('smol-toml');

const NAMES = ['automate', 'evaluate', 'framework', 'nfr', 'test-design', 'test-review', 'trace', 'atdd', 'ci'];
const PAIRS = [
  ...NAMES.map((suffix) => [`bmad-testarch-${suffix}`, `bmad-tea-${suffix}`]),
  ['bmad-teach-me-testing', 'bmad-tea-teach-me-testing'],
];

function isTable(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function merge(oldValue, newValue, oldFile, newFile, key = '') {
  const result = { ...oldValue };
  for (const [name, value] of Object.entries(newValue)) {
    const location = key ? `${key}.${name}` : name;
    if (!Object.hasOwn(result, name)) result[name] = value;
    else if (isTable(result[name]) && isTable(value)) result[name] = merge(result[name], value, oldFile, newFile, location);
    else if (JSON.stringify(result[name]) !== JSON.stringify(value)) {
      throw new Error(`Conflicting ${location} in ${oldFile} and ${newFile}`);
    }
  }
  return result;
}

function migrate(projectRoot, { check = false } = {}) {
  const customRoot = path.join(projectRoot, '_bmad', 'custom');
  const actions = [];
  for (const [oldName, newName] of PAIRS) {
    for (const suffix of ['.toml', '.user.toml']) {
      const oldFile = path.join(customRoot, oldName + suffix);
      const newFile = path.join(customRoot, newName + suffix);
      if (!fs.existsSync(oldFile)) continue;
      const oldText = fs.readFileSync(oldFile, 'utf8');
      const newText = fs.existsSync(newFile) ? fs.readFileSync(newFile, 'utf8') : null;
      const oldValue = TOML.parse(oldText);
      const newValue = newText === null ? null : TOML.parse(newText);
      const merged = newValue === null ? oldValue : merge(oldValue, newValue, oldFile, newFile);
      actions.push({ oldFile, newFile, text: newValue === null ? oldText : `${TOML.stringify(merged)}\n`, exists: newValue !== null });
    }
  }
  if (check) return actions;
  for (const action of actions) {
    if (action.exists) {
      const temp = `${action.newFile}.tea-migration-${process.pid}`;
      fs.writeFileSync(temp, action.text, { flag: 'wx' });
      fs.renameSync(temp, action.newFile);
      fs.unlinkSync(action.oldFile);
    } else fs.renameSync(action.oldFile, action.newFile);
  }
  return actions;
}

function main(argv = process.argv.slice(2)) {
  const usage = 'Usage: tea-migrate-customizations [--project-root PATH] [--check]';
  const rootIndex = argv.indexOf('--project-root');
  if (rootIndex !== -1 && (!argv[rootIndex + 1] || argv[rootIndex + 1].startsWith('--'))) {
    throw new Error('--project-root requires a path');
  }
  if (argv.some((arg, index) => arg !== '--check' && arg !== '--project-root' && index !== rootIndex + 1)) throw new Error(usage);
  const projectRoot = rootIndex < 0 ? process.cwd() : path.resolve(argv[rootIndex + 1]);
  const actions = migrate(projectRoot, { check: argv.includes('--check') });
  for (const { oldFile, newFile } of actions) process.stdout.write(`${oldFile} -> ${newFile}\n`);
  if (actions.length === 0) process.stdout.write('No legacy TEA customizations found.\n');
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { migrate, main };
