// A Vitest reporter tea-unit-check adds beside the JSON reporter. Vitest's JSON
// keeps one result per test even when a retry or repeat ran it several times,
// so this records each test's actual retry and repeat counts. It imports
// nothing, so it works with whichever Vitest the project installs.
import fs from 'node:fs';

export default class AttemptsReporter {
  constructor() {
    this.tests = [];
  }

  // The reporter API (Vitest 3 or newer) gives a test that ran its diagnostic; a
  // skipped test never ran, so it has none and made no attempt. A test that ran
  // without one records null, which tea-unit-check treats as unknown attempts.
  onTestCaseResult(testCase) {
    const diagnostic = typeof testCase.diagnostic === 'function' ? testCase.diagnostic() : undefined;
    const skipped = testCase.result?.()?.state === 'skipped';
    this.tests.push({
      moduleId: testCase.module?.moduleId ?? null,
      fullName: testCase.fullName ?? null,
      retryCount: diagnostic ? diagnostic.retryCount : skipped ? 0 : null,
      repeatCount: diagnostic ? diagnostic.repeatCount : skipped ? 0 : null,
    });
  }

  onTestRunEnd() {
    const output = process.env.TEA_UNIT_CHECK_ATTEMPTS;
    if (output) fs.writeFileSync(output, JSON.stringify(this.tests));
  }
}
