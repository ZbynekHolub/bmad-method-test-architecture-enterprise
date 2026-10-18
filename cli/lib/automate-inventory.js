'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parse } = require('@babel/parser');
const { minimatch } = require('minimatch');
const { UNIT_CHECK_KIND, normalizeUnitReport, unitReportRunner } = require('./unit-runners');

const slash = (value) => value.split(path.sep).join('/');
const canonical = (value) => {
  let ancestor = path.resolve(value);
  const suffix = [];
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    suffix.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  return path.resolve(fs.realpathSync(ancestor), ...suffix);
};
const literal = (node) =>
  node?.type === 'StringLiteral'
    ? node.value
    : node?.type === 'TemplateLiteral' && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : null;

// JSONReporter serializes both globs and RegExp instances with toString().
// Apply the runner's absolute-path, reset-lastIndex and case-insensitive glob rules.
function nativeMatches(patterns, absolute) {
  if (!Array.isArray(patterns)) throw new Error('native Playwright selectors must be arrays');
  return patterns.some((pattern) => {
    if (typeof pattern !== 'string') throw new Error('native Playwright selector is invalid');
    const serialized = pattern.match(/^\/(.*)\/([dgimsuvy]*)$/s);
    if (serialized) {
      let expression;
      try {
        expression = new RegExp(serialized[1], serialized[2]);
      } catch {
        throw new Error('native Playwright RegExp selector is invalid');
      }
      expression.lastIndex = 0;
      if (expression.test(absolute)) return true;
      expression.lastIndex = 0;
      return path.sep === '\\' && expression.test(slash(absolute));
    }
    return minimatch(absolute, pattern.startsWith('**/') ? pattern : `**/${pattern}`, { nocase: true, dot: true });
  });
}

// Registration names per runner family. Playwright registers suites through
// test.describe and maps a transformed named import's call to its callee end.
// Vitest and Jest export describe/suite as their own functions, and both report
// an identifier call at its start and a member call at its property.
// Vitest 5 maps an identifier call in a .js/.mjs file to its opening parenthesis
// and in TypeScript to the callee start, so a unit identifier leaf records both.
const VOCABULARIES = {
  playwright: { names: { test: 'test', mergeTests: 'merge' }, globals: { test: 'test' }, importEnd: true, alternateEnd: false },
  unit: {
    names: { test: 'test', it: 'test', describe: 'suite', suite: 'suite', vi: 'utility', jest: 'utility' },
    globals: { test: 'test', it: 'test', describe: 'suite', suite: 'suite', vi: 'utility', jest: 'utility' },
    importEnd: false,
    alternateEnd: true,
  },
};
// Modules whose exports register tests; a call rooted in any other installed package registers none.
const TEST_MODULES = new Set(['vitest', '@jest/globals', '@playwright/test']);
const REGISTRATION_KINDS = new Set(['test', 'suite', 'namespace', 'merge']);

// Track lexical declarations so a shadowed name cannot inherit a test binding.
function sourceBindings(ast, file, projectRoot, vocabulary = VOCABULARIES.playwright, source = '') {
  const kindOf = (name) => (typeof name === 'string' && Object.hasOwn(vocabulary.names, name) ? vocabulary.names[name] : 'other');
  const scopes = new WeakMap();
  const root = { parent: null, bindings: new Map(), functionScope: true };
  const assignments = [];
  const children = (node, visit) => {
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end'].includes(key)) continue;
      if (Array.isArray(value)) for (const child of value) visit(child);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  const declare = (pattern, scope, init, property) => {
    if (!pattern) return;
    switch (pattern.type) {
      case 'Identifier': {
        scope.bindings.set(pattern.name, { init, property });
        break;
      }
      case 'ObjectPattern': {
        for (const item of pattern.properties) declare(item.value ?? item.argument, scope, init, item.key?.name ?? literal(item.key));
        break;
      }
      case 'AssignmentPattern': {
        declare(pattern.left, scope, init, property);
        break;
      }
      case 'ArrayPattern': {
        for (const item of pattern.elements) declare(item, scope, null);
        break;
      }
      case 'RestElement': {
        declare(pattern.argument, scope, null);
        break;
      }
      default: {
        break;
      }
    }
  };
  const build = (node, scope, parentNode) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id) declare(node.id, scope, null);
    if (node.type === 'ClassDeclaration' && node.id) declare(node.id, scope, null);
    if (node.type === 'BlockStatement' || /Function/.test(node.type) || node.type === 'CatchClause') {
      scope = { parent: scope, bindings: new Map(), functionScope: /Function/.test(node.type) };
      for (const parameter of node.params ?? []) declare(parameter, scope, null);
      declare(node.param, scope, null);
    }
    scopes.set(node, scope);
    if (node.type === 'ImportDeclaration')
      for (const item of node.specifiers) {
        const namespace = ['ImportNamespaceSpecifier', 'ImportDefaultSpecifier'].includes(item.type);
        scope.bindings.set(item.local.name, {
          kind: namespace ? 'namespace' : kindOf(item.imported?.name ?? literal(item.imported)),
          imported: true,
          source: node.source.value,
        });
      }
    if (node.type === 'VariableDeclarator') {
      let declarationScope = scope;
      if (parentNode?.kind === 'var') while (!declarationScope.functionScope) declarationScope = declarationScope.parent;
      declare(node.id, declarationScope, node.init);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') assignments.push(node);
    children(node, (child) => build(child, scope, node));
  };
  build(ast.program, root);
  const findBinding = (node) => {
    let scope = scopes.get(node);
    while (scope && !scope.bindings.has(node.name)) scope = scope.parent;
    return scope?.bindings.get(node.name);
  };
  for (const assignment of assignments) {
    const binding = findBinding(assignment.left);
    if (binding) (binding.assignments ??= []).push(assignment.right);
  }
  let moduleSource = /\.(?:mjs|mts)$/.test(file);
  if (!/\.(?:[cm]js|[cm]ts)$/.test(file)) {
    let directory = path.dirname(path.resolve(projectRoot, file));
    while (true) {
      const pkg = path.join(directory, 'package.json');
      if (fs.existsSync(pkg)) {
        moduleSource = JSON.parse(fs.readFileSync(pkg, 'utf8')).type === 'module';
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  const memberName = (node) => (node.computed ? literal(node.property) : node.property.name);
  const resolve = (node, seen = new Set()) => {
    if (!node) return null;
    if (node.type === 'Identifier') {
      const binding = findBinding(node);
      // Bare globals are retained for native ATDD and Jest/Vitest global inventories.
      if (!binding)
        return Object.hasOwn(vocabulary.globals, node.name)
          ? { kind: vocabulary.globals[node.name], importEnd: vocabulary.importEnd }
          : null;
      if (seen.has(binding)) return null;
      seen = new Set([...seen, binding]);
      if (
        binding.assignments?.length &&
        (REGISTRATION_KINDS.has(binding.kind) ||
          REGISTRATION_KINDS.has(resolve(binding.init, seen)?.kind) ||
          binding.assignments.some((value) => REGISTRATION_KINDS.has(resolve(value, seen)?.kind)))
      )
        throw new Error(`generated test inventory has reassigned test binding: ${file}`);
      if (binding.kind) return { kind: binding.kind, importEnd: vocabulary.importEnd && binding.imported && !moduleSource };
      const value = resolve(binding.init, seen);
      if (binding.property) return value?.kind === 'namespace' ? { kind: kindOf(binding.property) } : null;
      return value ? { kind: value.kind } : null;
    }
    if (node.type === 'MemberExpression') {
      const value = resolve(node.object, seen);
      if (value?.kind === 'namespace' && node.computed && memberName(node) === null)
        throw new Error(`generated test inventory has computed registration: ${file}`);
      if (value?.kind === 'namespace') return { kind: kindOf(memberName(node)) };
      return null;
    }
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require' && literal(node.arguments[0]) !== null)
        return { kind: 'namespace' };
      if (resolve(node.callee, seen)?.kind === 'merge') {
        if (node.arguments.length === 0 || node.arguments.some((argument) => resolve(argument, seen)?.kind !== 'test'))
          throw new Error(`generated test inventory has unresolved merged binding: ${file}`);
        return { kind: 'test' };
      }
      if (
        node.callee.type === 'MemberExpression' &&
        memberName(node.callee) === 'extend' &&
        resolve(node.callee.object, seen)?.kind === 'test'
      )
        return { kind: 'test' };
    }
    return null;
  };
  const registration = (node) => {
    const value = resolve(node);
    if (value?.kind === 'test' || value?.kind === 'suite') return { kind: value.kind, binding: value, chain: [], base: node };
    if (node?.type === 'MemberExpression') {
      const parent = registration(node.object);
      if (parent) return { ...parent, chain: [...parent.chain, memberName(node)] };
    }
    return null;
  };
  const location = (callee, binding) => {
    // Native member calls point at the property. Transformed named imports map
    // the generated indirect call to callee-end; local/CJS/ESM calls use start.
    const point = callee.type === 'MemberExpression' ? callee.property.loc.start : binding.importEnd ? callee.loc.end : callee.loc.start;
    return { line: point.line, column: point.column + 1 };
  };
  // The call's opening parenthesis, for an identifier callee: whitespace and line breaks may precede it.
  const lineStarts = [0];
  for (let index = 0; index < source.length; index++) if (source[index] === '\n') lineStarts.push(index + 1);
  const alternate = (call, callee) => {
    if (!vocabulary.alternateEnd || callee.type !== 'Identifier') return null;
    let offset = callee.end;
    while (offset < call.end && source[offset] !== '(') offset++;
    let line = lineStarts.length - 1;
    while (lineStarts[line] > offset) line--;
    return { line: line + 1, column: offset - lineStarts[line] + 1 };
  };
  // A member call rooted at a runner utility (vi.mock, an aliased or namespaced vi) registers no test.
  const utility = (callee) => {
    for (let node = callee.type === 'MemberExpression' ? callee.object : null; node; node = node.object) {
      if (resolve(node)?.kind === 'utility') return true;
      if (node.type !== 'MemberExpression') return false;
    }
    return false;
  };
  // Nor does a member call rooted in another installed package, such as MSW's
  // http.get(path, resolver) or an Express app built by express().
  const packageSource = (source) =>
    typeof source === 'string' && !/^[./]/.test(source) && !TEST_MODULES.has(source) && !source.startsWith('vitest/');
  const external = (callee) => {
    const seen = new Set();
    let node = callee.type === 'MemberExpression' ? callee.object : null;
    while (node) {
      switch (node.type) {
        case 'MemberExpression': {
          node = node.object;
          break;
        }
        case 'CallExpression': {
          if (node.callee.type === 'Identifier' && node.callee.name === 'require' && !findBinding(node.callee))
            return packageSource(literal(node.arguments[0]));
          node = node.callee;
          break;
        }
        case 'Identifier': {
          const binding = findBinding(node);
          if (!binding || seen.has(binding)) return false;
          seen.add(binding);
          if (binding.imported) return packageSource(binding.source);
          node = binding.init;
          break;
        }
        default: {
          return false;
        }
      }
    }
    return false;
  };
  return { registration, location, alternate, utility, external };
}

// Enumerate registrations without executing adopter code. Runtime enumeration is
// deliberately unmeasured: a numerical report cannot prove its missing leaves.
// Vitest and Jest share one registration grammar: test/it leaves, describe/suite
// blocks and module-level hooks. Every form whose leaves are only known at
// runtime is rejected, matching the Playwright inventory's strictness.
const UNIT_LEAF_MODIFIERS = new Set(['only', 'skip', 'concurrent', 'sequential']);
const UNIT_SUITE_MODIFIERS = new Set(['only', 'skip', 'concurrent', 'sequential', 'shuffle']);
const UNIT_DYNAMIC = new Set(['each', 'for', 'skipIf', 'runIf', 'todo', 'fails', 'failing']);

function unitLeaves(ast, file, bindings, inventory, activations) {
  const { registration, location, alternate, utility, external } = bindings;
  const isCallback = (arg) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(arg.type);
  const walk = (node, titles = [], dynamic = false) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') {
      const resolved = registration(node.callee);
      // test.each(table)('title', fn) and its relatives register through a returned function.
      if (!resolved && node.callee.type === 'CallExpression' && registration(node.callee.callee))
        throw new Error(`generated test inventory has unresolved table registration: ${file}`);
      if (
        !resolved &&
        !dynamic &&
        !utility(node.callee) &&
        !external(node.callee) &&
        literal(node.arguments[0]) !== null &&
        node.arguments.some(isCallback)
      )
        throw new Error(`generated test inventory has unresolved registration binding: ${file}`);
      if (resolved) {
        const { chain } = resolved;
        if (chain.includes(null)) throw new Error(`generated test inventory has computed registration: ${file}`);
        if (chain.some((member) => UNIT_DYNAMIC.has(member)))
          throw new Error(`generated test inventory has unresolved table registration: ${file}`);
        const callback = node.arguments.find(isCallback);
        if (resolved.kind === 'suite') {
          if (chain.length > 1 || (chain.length === 1 && !UNIT_SUITE_MODIFIERS.has(chain[0])))
            throw new Error(`generated test inventory has unsupported registration: ${file}`);
          const title = literal(node.arguments[0]);
          if (title === null || !callback || dynamic) throw new Error(`generated test inventory has dynamic suite registration: ${file}`);
          walk(callback.body, [...titles, title], false);
          return;
        }
        if (chain.length === 0 || (chain.length === 1 && UNIT_LEAF_MODIFIERS.has(chain[0]))) {
          const title = literal(node.arguments[0]);
          if (!callback) throw new Error(`generated test inventory has unresolved callback registration: ${file}`);
          if (title === null || dynamic) throw new Error(`generated test inventory has dynamic test registration: ${file}`);
          const skip = chain[0] === 'skip';
          const base = skip ? location(resolved.base, resolved.binding) : null;
          // Activation blanks `.skip`, so the activated call keeps this call's parenthesis.
          const paren = alternate(node, node.callee);
          const activatedParen = skip ? alternate(node, resolved.base) : null;
          inventory.tests.push({
            file,
            titlePath: [...titles, title],
            ...location(node.callee, resolved.binding),
            ...(paren ? { alternateLine: paren.line, alternateColumn: paren.column } : {}),
            ...(skip ? { activationLine: base.line, activationColumn: base.column } : {}),
            ...(activatedParen ? { activationAlternateLine: activatedParen.line, activationAlternateColumn: activatedParen.column } : {}),
          });
          // Activation deletes exactly the `.skip` member between the base and the call.
          if (skip && activations) activations.push({ file, start: node.callee.object.end, end: node.callee.end });
          return;
        }
        if (!(chain.length === 1 && chain[0] === 'extend'))
          throw new Error(`generated test inventory has unsupported registration: ${file}`);
      }
    }
    const nestedDynamic = dynamic || /(?:Function|Method|For|While|If|Conditional|Switch)/.test(node.type);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end'].includes(key)) continue;
      if (Array.isArray(value)) for (const child of value) walk(child, titles, nestedDynamic);
      else if (value && typeof value === 'object') walk(value, titles, nestedDynamic);
    }
  };
  walk(ast.program);
}

function generatedInventory(projectRoot, files, { runner = 'playwright', activations } = {}) {
  const unit = runner === 'vitest' || runner === 'jest';
  if (!unit && runner !== 'playwright') throw new Error(`generated test inventory has an unsupported runner: ${runner}`);
  const inventory = {
    schemaVersion: 1,
    basis: 'post-generation source syntax',
    projectRoot: fs.realpathSync(projectRoot),
    ...(unit ? { runner } : {}),
    files: [],
    tests: [],
  };
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(projectRoot, file));
    inventory.files.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) continue;
    const ast = parse(bytes.toString('utf8'), { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
    if (unit) {
      unitLeaves(ast, file, sourceBindings(ast, file, projectRoot, VOCABULARIES.unit, bytes.toString('utf8')), inventory, activations);
      continue;
    }
    const { registration, location } = sourceBindings(ast, file, projectRoot);
    const walk = (node, titles = [], dynamic = false) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'CallExpression') {
        const resolved = registration(node.callee);
        if (
          !resolved &&
          !dynamic &&
          literal(node.arguments[0]) !== null &&
          node.arguments.some((arg) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(arg.type))
        )
          throw new Error(`generated test inventory has unresolved registration binding: ${file}`);
        if (resolved) {
          const chain = ['test', ...resolved.chain];
          if (chain.includes(null)) throw new Error(`generated test inventory has computed registration: ${file}`);
          if (chain[1] === 'each') throw new Error(`generated test inventory has unresolved table registration: ${file}`);
          if (chain[1] === 'describe' && ['describe', 'only', 'skip', 'serial', 'parallel'].includes(chain.at(-1))) {
            const title = literal(node.arguments[0]);
            const callback = node.arguments.find((arg) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(arg.type));
            if (title === null || !callback || dynamic) throw new Error(`generated test inventory has dynamic suite registration: ${file}`);
            walk(callback.body, [...titles, title], false);
            return;
          }
          if (chain.length === 1 || (chain.length === 2 && ['only', 'skip', 'fixme', 'fail'].includes(chain[1]))) {
            // test.skip(condition, reason) inside a test is metadata, never a leaf.
            const callback = node.arguments.find((arg) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(arg.type));
            if (callback) {
              const title = literal(node.arguments[0]);
              if (title === null || dynamic) throw new Error(`generated test inventory has dynamic test registration: ${file}`);
              inventory.tests.push({
                file,
                titlePath: [...titles, title],
                ...location(node.callee, resolved.binding),
                ...(chain[1] === 'skip'
                  ? {
                      activationLine: location(resolved.base, resolved.binding).line,
                      activationColumn: location(resolved.base, resolved.binding).column,
                    }
                  : {}),
              });
              return;
            }
            if (chain.length === 1 || literal(node.arguments[0]) !== null)
              throw new Error(`generated test inventory has unresolved callback registration: ${file}`);
          }
          if (
            node.arguments.some((arg) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(arg.type)) &&
            !['beforeEach', 'beforeAll', 'afterEach', 'afterAll', 'step', 'extend'].includes(chain[1])
          )
            throw new Error(`generated test inventory has unsupported registration: ${file}`);
          if (
            chain.length > 1 &&
            ![
              'describe',
              'only',
              'skip',
              'fixme',
              'fail',
              'beforeEach',
              'beforeAll',
              'afterEach',
              'afterAll',
              'step',
              'extend',
              'use',
              'info',
              'setTimeout',
              'slow',
              'expect',
            ].includes(chain[1])
          )
            throw new Error(`generated test inventory has unresolved registration: ${file}`);
        }
      }
      const nestedDynamic = dynamic || /(?:Function|Method|For|While|If|Conditional|Switch)/.test(node.type);
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end'].includes(key)) continue;
        if (Array.isArray(value)) for (const child of value) walk(child, titles, nestedDynamic);
        else if (value && typeof value === 'object') walk(value, titles, nestedDynamic);
      }
    };
    walk(ast.program);
  }
  if (inventory.tests.length === 0) throw new Error('generated test inventory contains no measurable test leaves');
  return inventory;
}

function reportFamily(report) {
  if (Array.isArray(report.suites)) return 'playwright';
  if (report.kind === UNIT_CHECK_KIND) return `unit-check:${report.runner}`;
  return unitReportRunner(report) ?? (report.schemaVersion === 1 && Array.isArray(report.files) ? 'native-atdd' : 'unrecognized');
}

function reconcileInventory(inventory, reports, { mode, runners, reportProjectRoot = inventory.projectRoot } = {}) {
  const covered = new Map();
  const projectsByFile = new Map();
  if (new Set(reports.map(reportFamily)).size > 1) throw new Error('final execution mixes incompatible runner scope identities');
  const identity = (leaf, project) => JSON.stringify([leaf.file, leaf.titlePath, leaf.line, leaf.column, project]);
  const sourceLeaves = new Map();
  const atddLeaves = new Map();
  const sourceKey = (file, titles, line, column) => JSON.stringify([file, titles, line, column]);
  const index = (map, key, leaf) => map.set(key, [...(map.get(key) ?? []), leaf]);
  for (const leaf of inventory.tests) {
    index(sourceLeaves, sourceKey(leaf.file, leaf.titlePath, leaf.line, leaf.column), leaf);
    if (leaf.alternateLine !== undefined)
      index(sourceLeaves, sourceKey(leaf.file, leaf.titlePath, leaf.alternateLine, leaf.alternateColumn), leaf);
    if (mode === 'red' && leaf.activationLine !== undefined)
      index(sourceLeaves, sourceKey(leaf.file, leaf.titlePath, leaf.activationLine, leaf.activationColumn), leaf);
    if (mode === 'red' && leaf.activationAlternateLine !== undefined)
      index(sourceLeaves, sourceKey(leaf.file, leaf.titlePath, leaf.activationAlternateLine, leaf.activationAlternateColumn), leaf);
    index(atddLeaves, JSON.stringify([leaf.file, leaf.titlePath.at(-1)]), leaf);
  }
  for (const report of reports) {
    if (Array.isArray(report.suites)) {
      if (
        !report.config?.configFile ||
        !report.config.rootDir ||
        !Array.isArray(report.config.projects) ||
        report.config.projects.length === 0
      )
        throw new Error('native Playwright evidence lacks file and project identity configuration');
      if (!reportProjectRoot) throw new Error('native execution reconciliation requires the consuming project root');
      const base = canonical(reportProjectRoot);
      const confined = (absolute) => {
        const relative = path.relative(base, absolute);
        return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
      };
      if (!confined(canonical(report.config.configFile)) || !confined(canonical(report.config.rootDir)))
        throw new Error('native Playwright evidence identifies a different consuming project root');
      const reportedFile = (file) =>
        slash(path.relative(base, canonical(path.isAbsolute(file) ? file : path.resolve(report.config.rootDir, file))));
      const projectIds = report.config.projects.map((project) => project.id ?? project.name);
      if (projectIds.some((id) => typeof id !== 'string') || new Set(projectIds).size !== projectIds.length)
        throw new Error('native Playwright project identities are missing or duplicated');
      // Every configured matching project is part of the generated execution scope.
      for (const leaf of inventory.tests) {
        const projects = projectsByFile.get(leaf.file) ?? new Map();
        for (const project of report.config.projects) {
          const relative = slash(path.relative(canonical(project.testDir ?? report.config.rootDir), path.resolve(base, leaf.file)));
          if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) continue;
          const matches = (patterns) => nativeMatches(patterns, path.resolve(base, leaf.file));
          if ((project.testMatch?.length && !matches(project.testMatch)) || (project.testIgnore?.length && matches(project.testIgnore)))
            continue;
          const repeatEach = project.repeatEach ?? 1;
          if (!Number.isSafeInteger(repeatEach) || repeatEach < 1) throw new Error('native Playwright repeatEach must be positive');
          const id = project.id ?? project.name;
          if (projects.has(id) && projects.get(id) !== repeatEach) throw new Error('final reports disagree on project repetition scope');
          projects.set(id, repeatEach);
        }
        projectsByFile.set(leaf.file, projects);
      }
      const scopesInReport = new Map();
      const walk = (suite, titles) => {
        const nextTitles = suite.line > 0 && suite.title ? [...titles, suite.title] : titles;
        for (const spec of suite.specs ?? []) {
          const file = reportedFile(spec.file ?? suite.file ?? '');
          const titlePath = [...nextTitles, spec.title];
          const leaves = sourceLeaves.get(sourceKey(file, titlePath, spec.line, spec.column)) ?? [];
          if (leaves.length !== 1) throw new Error(`runner result does not identify one generated test leaf: ${file} ${spec.title ?? ''}`);
          for (const test of spec.tests ?? []) {
            const project = test.projectId ?? test.projectName;
            if (!projectIds.includes(project) || !projectsByFile.get(file)?.has(project))
              throw new Error(`runner result has an unrelated project: ${file}`);
            if (!test.results?.length) throw new Error(`runner result has no attempts: ${file} ${spec.title}`);
            const key = identity(leaves[0], project);
            scopesInReport.set(key, (scopesInReport.get(key) ?? 0) + 1);
          }
        }
        for (const child of suite.suites ?? []) walk(child, nextTitles);
      };
      for (const suite of report.suites) walk(suite, []);
      for (const [key, count] of scopesInReport) {
        if (covered.has(key)) throw new Error('final runner reports repeat a generated test/project scope');
        covered.set(key, count);
      }
    } else if (report.kind === UNIT_CHECK_KIND || unitReportRunner(report)) {
      const checked = report.kind === UNIT_CHECK_KIND;
      const runner = checked ? report.runner : unitReportRunner(report);
      const label = runner === 'jest' ? 'Jest' : runner === 'vitest' ? 'Vitest' : JSON.stringify(runner);
      const declared = (runners ?? []).find((entry) => entry.runner === runner);
      if (!declared) throw new Error(`native ${label} evidence does not match a test runner the project declares`);
      if (inventory.runner !== runner) throw new Error(`generated test inventory was not derived for ${label}`);
      if (!reportProjectRoot) throw new Error('native execution reconciliation requires the consuming project root');
      const base = canonical(reportProjectRoot);
      // Vitest's JSON reporter drops unhandled errors and the process outcome, so
      // only tea-unit-check (which records both) establishes Vitest execution.
      // Red needs the disposable activation only tea-unit-check proves.
      if (!checked && (runner === 'vitest' || mode === 'red'))
        throw new Error(
          `raw ${label} JSON cannot establish ${mode === 'red' ? 'verified red' : 'Vitest execution'}; run tea-unit-check --mode ${mode === 'red' ? 'red' : 'expand'}`,
        );
      let results;
      const red = checked && report.mode === 'red';
      if (checked) {
        if (report.schemaVersion !== 1 || typeof report.projectRoot !== 'string' || canonical(report.projectRoot) !== base)
          throw new Error('tea-unit-check evidence identifies a different consuming project root');
        if (report.mode !== mode)
          throw new Error(`tea-unit-check evidence ran in ${JSON.stringify(report.mode)} mode for a ${mode} request`);
        if (report.configFile !== declared.configFile) throw new Error(`tea-unit-check used a different ${label} configuration`);
        if (!Array.isArray(report.files)) throw new Error('tea-unit-check evidence lacks file results');
        results = report.files.map((entry) => {
          const listed = inventory.files.find((item) => item.file === entry?.file);
          if (!listed || listed.sha256 !== entry.sha256)
            throw new Error(`tea-unit-check evaluated different generated bytes: ${entry?.file ?? ''}`);
          if (!Array.isArray(entry.tests)) throw new Error(`tea-unit-check evidence lacks test results: ${entry.file}`);
          return { file: entry.file, tests: entry.tests };
        });
      } else {
        results = normalizeUnitReport(report).files.map((entry) => {
          const relative = path.relative(base, canonical(entry.name));
          if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
            throw new Error(`native ${label} evidence identifies a different consuming project root`);
          return { file: slash(relative), tests: entry.tests };
        });
      }
      for (const { file, tests } of results) {
        if (inventory.files.some((item) => item.file === file)) projectsByFile.set(file, new Map([[runner, 1]]));
        for (const test of tests) {
          if (!Array.isArray(test?.titlePath) || test.titlePath.some((title) => typeof title !== 'string'))
            throw new Error(`native ${label} result has a malformed test identity: ${file}`);
          if (!Number.isSafeInteger(test.line) || !Number.isSafeInteger(test.column))
            throw new Error(`native ${label} evidence lacks test locations: ${file}`);
          const leaves = sourceLeaves.get(sourceKey(file, test.titlePath, test.line, test.column)) ?? [];
          if (leaves.length !== 1)
            throw new Error(`runner result does not identify one generated test leaf: ${file} ${test.titlePath.at(-1) ?? ''}`);
          if (red && leaves[0].activationLine === undefined)
            throw new Error(`tea-unit-check executed a generated test that is not a skipped scaffold: ${file} ${test.titlePath.at(-1)}`);
          const key = identity(leaves[0], runner);
          if (covered.has(key)) throw new Error('final runner reports repeat a generated test scope');
          covered.set(key, 1);
        }
      }
    } else if (report.schemaVersion === 1 && Array.isArray(report.files)) {
      for (const leaf of inventory.tests) projectsByFile.set(leaf.file, new Map([['native-atdd', 1]]));
      for (const file of report.files)
        for (const test of file.tests ?? []) {
          const leaves = atddLeaves.get(JSON.stringify([slash(file.file ?? ''), test.title])) ?? [];
          if (leaves.length !== 1)
            throw new Error(`native ATDD result does not identify one generated test leaf: ${file.file ?? ''} ${test.title ?? ''}`);
          const key = identity(leaves[0], 'native-atdd');
          if (covered.has(key)) throw new Error('final runner reports repeat a generated test scope');
          covered.set(key, 1);
        }
    }
  }
  for (const leaf of inventory.tests) {
    const projects = projectsByFile.get(leaf.file);
    if (!projects?.size) throw new Error(`generated test file has no selected runner project: ${leaf.file}`);
    for (const [project, repetitions] of projects)
      if (covered.get(identity(leaf, project)) !== repetitions)
        throw new Error(`final execution omits generated test/project scope: ${leaf.file} ${leaf.titlePath.join(' > ')} [${project}]`);
  }
  return { ...inventory, executionScopes: [...covered].map(([key, repetitions]) => ({ identity: JSON.parse(key), repetitions })) };
}

module.exports = { generatedInventory, reconcileInventory };
