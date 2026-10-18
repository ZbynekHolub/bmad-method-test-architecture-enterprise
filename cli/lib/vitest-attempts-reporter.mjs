// A Vitest reporter tea-unit-check adds beside the JSON reporter. Vitest's JSON
// keeps one result per test even when a retry or repeat ran it several times,
// so this records each test's actual retry and repeat counts. It imports
// nothing, so it works with whichever Vitest the project installs.
import fs from 'node:fs';

export default class AttemptsReporter {
  constructor() {
    this.tests = [];
  }

  onTestCaseResult(testCase) {
    const diagnostic = testCase.diagnostic?.();
    this.tests.push({
      moduleId: testCase.module?.moduleId ?? null,
      fullName: testCase.fullName ?? null,
      retryCount: diagnostic?.retryCount ?? null,
      repeatCount: diagnostic?.repeatCount ?? null,
    });
  }

  onTestRunEnd() {
    const output = process.env.TEA_UNIT_CHECK_ATTEMPTS;
    if (output) fs.writeFileSync(output, JSON.stringify(this.tests));
  }
}
