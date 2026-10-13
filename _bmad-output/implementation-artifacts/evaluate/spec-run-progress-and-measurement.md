---
title: 'Show Evaluate run progress and measure elapsed work'
type: 'feature'
created: '2026-10-13'
status: 'done'
baseline_commit: '04cf65b03620c07f63e6af8f90023ea56fa0348e'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '_bmad-output/planning-artifacts/evaluate/SPEC.md'
  - 'docs/reference/tea-evaluate-cli.md'
---

<frozen-after-approval reason="user authorized the Evaluate efficiency build">

## Intent

**Problem:** An Evaluate run can take hours while the user sees only occasional trial-start lines. Its final duration says little about where time went, and partial usage reports can make cost look like zero.

**Approach:** Persist a live progress snapshot with phase timings and trial counts in the run directory. Expose it through a read-only `status` command with a follow mode, print periodic heartbeats from the running command, and report measured usage with an explicit unknown state when reports are incomplete.

## Boundaries & Constraints

**Always:** Keep eval-quality as the sole scoring authority. Preserve held-out isolation, run-directory integrity, terminal outcome semantics, and deterministic score inputs. Derive elapsed time from the whole invocation; count a shared arm once when totaling trials. Treat missing cost as unknown. Let a new CLI process reconnect to a running invocation by ID.

**Never:** Claim an ETA without enough observations, infer a verdict from progress, expose held-out inputs through status, or present incomplete usage as a measured zero.

## I/O & Edge-Case Matrix

| Scenario       | Input / State                                   | Expected Output / Behavior                                                                         | Error Handling                                                                       |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Live run       | A phase or trial is in progress                 | `run.json` and `status` show phase, elapsed time, completed and planned trials, and last heartbeat | A stale heartbeat is labelled last reported, with no claim that the process is alive |
| Long call      | One target or evaluator call blocks for minutes | Stderr and `status --follow` emit a heartbeat at a bounded interval                                | A signal preserves the terminal signal state and stops heartbeats                    |
| Complete run   | All trial sets seal                             | Status shows completion, per-phase durations, and whole-run duration                               | Score reads the same sealed evidence as before                                       |
| Partial usage  | One or more steps omit cost or usage            | Cost is `unknown`; known figures may be shown as a subtotal                                        | Explicit reported zero stays distinct from missing data                              |
| Invalid run ID | Unknown, malformed, or linked run entry         | Status refuses it without following links                                                          | CLI exits with a usage or infrastructure error and a clear reason                    |

</frozen-after-approval>

## Code Map

- `cli/lib/evaluate/preflight.js`: owns the pipeline, guarded `run.json` writes, signal handling, and terminal outcomes. Start and stop progress here.
- `cli/lib/evaluate/run.js`: owns evaluator qualification, calibration, serial trial loops, sealed trial usage, and final duration. Mark phases and completed trials here.
- `cli/lib/evaluate/run-directory.js`: guarded atomic `replaceJson`; use it for live snapshots.
- `cli/lib/evaluate/score.js`: recent-run lookup; reuse its path and regular-file safeguards for read-only status without requiring a completed run.
- `cli/evaluate.js`: wire `status --evaluation --run --follow` and human-readable heartbeat output.
- `test/test-evaluate-run.js`: end-to-end fixture and usage-report cases; add live, terminal, and missing-usage coverage.
- `skills/bmad-testarch-evaluate/references/run.md` and `docs/reference/tea-evaluate-cli.md`: teach readers how to reconnect and interpret timing and cost.

## Tasks & Acceptance

**Execution:**

- [x] `cli/lib/evaluate/preflight.js` and `cli/lib/evaluate/run.js`: publish phase transitions, heartbeat, trial progress, phase durations, and terminal state through guarded `run.json` writes.
- [x] `cli/lib/evaluate/status.js` and `cli/evaluate.js`: provide read-only snapshot and follow output with safe run selection.
- [x] `test/test-evaluate-progress.js`: exercise live progress, long-call heartbeat, completed timing, stale state, invalid paths, and missing usage through the CLI.
- [x] `skills/bmad-testarch-evaluate/references/run.md`, `docs/reference/tea-evaluate-cli.md`, and `CHANGELOG.md`: document the commands and limits.

**Acceptance Criteria:**

- Given a run that is paused inside a long target call, when a second process requests status, then it sees the current phase, elapsed time, trial counts, and a recent heartbeat without reading sealed evidence.
- Given the run completes or receives a signal, when status is requested, then it reports the final outcome and stops live heartbeats.
- Given a run with incomplete usage reports, when status reports cost, then the total is unknown and the missing-report count is visible.
- Given a completed run with shared clean-arm trial sets, when time and usage are summarized, then the shared arm is counted once and total duration includes qualification and preflight.
- Given the same evaluation before and after this change, when `score` reads the sealed run, then its input digests and verdict semantics remain unchanged.

## Implementation Notes

- The run directory's guarded `replaceJson` publishes snapshots without changing score inputs or adding another evidence file.
- Full-run duration includes setup, qualification, preflight, calibration, trial execution, and sealing. Trial cost covers only scored target calls. Missing usage leaves trial cost unknown, with the reported subtotal retained.
- The regression suite found a moved-run-directory case where final progress could fail before the original outcome was recorded. Final progress now participates in the existing per-step failure report.
- The new guide examples required the command-sequence check to ignore read-only status commands. Three `doc-claims` errors reproduced on clean main and were repaired in the same branch.
- Progress uses a monotonic clock for elapsed and phase durations. The wall clock supplies timestamps. Status freezes elapsed time at the last update when a run stops or goes stale.

## Spec Change Log

## Review Triage Log

- **Patched:** Stopped and stale elapsed time kept increasing. Status now uses the recorded elapsed value, and the tests check the terminal and stale views.
- **Patched:** The first heartbeat was dated before setup completed. It now records the time the run record is created.
- **Patched:** Status omitted active phase time and phase durations used the wall clock. Both now use the monotonic elapsed counter, and status shows active phase time.
- **Patched:** Status included a failure message that could expose detailed engine output. It now reports the terminal state, exit code, and signal without copying the message.
- **Patched:** The records-import route implied a measured zero and offered no sound trial count. It now marks both unknown.
- **Patched:** Planned trial count appeared only after calibration and evaluator qualification. It now appears once arms are known.
- **Patched:** A heartbeat test could race stderr delivery. The test waits for the emitted line.
- **Patched:** The live test now observes an intermediate trial count through both status and follow; the measured-usage run checks the aggregated nonzero cost, and stale status is exercised through the CLI.
- **Patched:** Final progress was published before failed-run retraction. It now follows retraction, so a terminal view does not announce completion while that cleanup is pending.
- **Patched:** A guarded read could race an atomic progress replacement. Status retries that specific replacement race while preserving other read refusals.
- **Covered by existing suite:** The run suite invokes score and checks sealed input digests and verdicts. The new progress fixture does not duplicate those assertions.
- **Deferred:** The signal test constructs a terminal record. Existing signal and stopped-run tests exercise the runtime's signal outcome; a separate live signal progress test would largely repeat those paths.

## Verification

**Commands:**

- `npm run test:evaluate-progress`: live, followed, stale, terminal, and usage state passes.
- `npm run test:evaluate-run`: 596 run and scoring checks pass, including sealed digest behavior and nonzero reported trial cost.
- `npm run test:evaluate-records`: 338 evaluator checks pass.
- `npm run test:doc-claims`: 0 disagreements.
- `npm run test:shards`: 411 checks pass.
- `npm run test:ci-coverage`: 170 chain steps pass.
- `npm run test:release-metadata`: passes.
- `npm run test:evaluate-guidance`: passes.
- `npm run format:check`, `npm run lint`, `npm run lint:md`, and `npm run docs:validate-links`: pass.
- `git diff --check`: passes.
