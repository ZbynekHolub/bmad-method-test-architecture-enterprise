---
runScope: 'epic'
runKey: 'epic-9'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-13'
mode: 'epic-level'
designLevel: 'full'
executionMode: 'sequential'
capabilityProbe: false
inputDocuments:
  - field-sync-indicator/_bmad/config.toml
  - field-sync-indicator/docs/epics/epic-9-last-sync-indicator.md
  - bmod-tea/knowledge/risk-governance.md
  - bmod-tea/knowledge/probability-impact.md
  - bmod-tea/knowledge/test-levels-framework.md
  - bmod-tea/knowledge/test-priorities-matrix.md
  - bmod-tea/knowledge/nfr-criteria.md
---

# Test Design: Epic 9: Show the last successful sync time on the technician home screen

**Date:** 2026-10-13  
**Author:** tea-eval-harness  
**Status:** Draft; workflow complete, team approval pending

## Executive Summary

**Scope:** Full epic-level test design for Epic 9, stories 9.1 and 9.2. The sole requirements source is [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md). The indicator reads `lastSuccessfulSyncAt`, renders a relative age, and refreshes on the existing completion event behind `home_last_sync_row`.

**Risk Summary:** Two risks, both BUS: inaccurate or stale relative age and conditional visibility/layout drift. High-priority risks (score ≥6): 0. Medium risks (score 3 to 4): 0. Low risks (score 1 to 2): 2. The epic states that privacy, read-only access, local-only access, render budget, and organization rollback constraints are already satisfied. These controls receive regression assertions.

**Coverage Summary:** P0: 0 cases, no effort. P1: 0 cases, no effort. P2: 8 logical cases, approximately 6 to 12 hours. P3: 0 cases, no effort. Setup adds approximately 2 to 4 hours. **Total effort:** approximately 8 to 16 hours, about 1 to 3 working days within roughly 1 to 2 calendar weeks after an executable build and harness are available. Parameterized variants can produce additional executions.

Repository inspection found the epic and configuration, with no application source, manifests, runner, fixtures, existing tests, or runtime URL. Existing coverage and flakiness are unmeasured. Stack detection remains unresolved. No PRD, architecture, sprint status, or previous system design belongs to this run's input set. This document plans validation; implementation and test execution evidence remain pending.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Sync transport, retry policy, conflict resolution, order and queue persistence | The epic consumes an existing success timestamp and completion event; it changes no sync algorithm or persistence behavior. | Preserve existing engine regression when available; smoke verifies the success-to-screen connection and spinner. |
| New security, privacy, data integrity, or backend load suites | The epic adds no personal data, write, request, or stored field. No new exposure is documented. | Assert the stated boundaries locally; retain product-level security and persistence coverage when available. |
| New feature flag infrastructure and organization targeting policy | The existing release process already toggles `home_last_sync_row` per organization. | Exercise that mechanism with isolated test organization state; require exact disabled-screen restoration. |
| Live minute-by-minute aging and new timer/polling behavior | Story 9.2 explicitly adds no timer or polling and refreshes on completion events. | Verify idle clock advancement creates no indicator-driven refresh; calculate age on supported render triggers. |
| Platform-wide load, scalability, compliance, and maintainability metrics | The epic supplies no such targets or changes. | Preserve existing product gates; revisit scope if requirements or implementation evidence introduces an exposure. |

## Risk Assessment

Probability: 1 = unlikely for a simple established path; 2 = possible boundary or ordering error; 3 = likely with demonstrated problems. Impact: 1 = minor display defect with an easy workaround; 2 = degraded operation; 3 = critical business, data, security, or regulatory consequence. **Score = Probability × Impact.** Scores 1 to 3 require documentation; 4 requires monitoring; ≥6 requires mitigation; 9 blocks release until resolved or properly waived. Scored risks are planning judgments grounded in the epic. No incident history or failure rate is available.

### High-Priority Risks (Score ≥6)

No high-priority risks are supported by the supplied requirements.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Medium-Priority Risks (Score 3 to 4)

No medium-priority risks are supported by the supplied requirements.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1 to 2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Incorrect or stale relative age defeats the freshness cue and leaves technicians asking dispatch. [Epic 9, story 9.1 and AC1](../../docs/epics/epic-9-last-sync-indicator.md) require the most recent successful timestamp as relative time; story 9.2 and AC3 require completion-event refresh. | 2: Possible formatter boundaries or event/read ordering mistakes. | 1: Minor informational loss; the existing dispatch question remains available. | 2 | Document; validate formatter, store/event wiring, and user-visible refresh. Dev owns automation; QA owns smoke; before epic acceptance. |
| R-002 | BUS | Unwanted row, blank gap, or layout drift changes the home screen in absent-field or disabled-flag states. [Epic 9, story 9.1 and AC2/AC4](../../docs/epics/epic-9-last-sync-indicator.md) require no row and unchanged screen when absent, and exact previous-screen restoration when the flag is off. | 1: Unlikely for a single conditional row on an existing screen. | 1: Minor display defect with the existing flag rollback control. | 1 | Document; validate conditional visibility and deterministic pre-change baseline. Dev and QA own checks; before epic acceptance. |

### Risk Category Legend

TECH: architecture/integration fragility. SEC: security exposure. PERF: performance degradation. DATA: data integrity. BUS: business logic and user experience. OPS: rollout/configuration/operations. The assessed register contains BUS risks only. Explicitly satisfied controls provide no evidence of new SEC, DATA, PERF, or OPS exposure.

## NFR Planning

Plan evidence for the epic's existing constraints. Final NFR assessment is deferred to `nfr-assess` when implementation evidence exists.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security/privacy | Device's own timestamp shown to its holder; zero added personal data, per Constraints already satisfied. | R-001 | Inspect visible row content and local source in 9.1-INT-001 and 9.2-E2E-001. | Rendered content and local-read report. |
| Data integrity/read-only | Zero indicator writes, zero new stored fields; engine's existing writes continue. | R-001 | 9.2-INT-002 observes indicator-owned store calls independently of engine activity. | Store call report and before/after indicator storage comparison. |
| Performance/local access | One local key lookup per intended read on the already-open store; zero added network calls; existing render budget unchanged. | R-001 | 9.1-INT-001 checks offline read; 9.2-INT-002 checks call boundaries. Apply existing home-screen render-budget check when supplied. | Call report and existing render-budget result with baseline and threshold. |
| Reliability/event behavior | Re-render on existing successful completion event while home is open; zero added polling/timers. | R-001 | 9.2-INT-001 and 9.2-E2E-001 validate update and spinner; 9.2-INT-002 checks idle behavior and scheduling. | Event/render assertion report and scheduler call report. |
| Operations/rollback | Existing organization flag off restores previous home screen exactly. | R-002 | 9.1-E2E-002 exercises existing flag evaluation lifecycle and compares baseline. | Flag state, screen image/tree comparison, and control assertions. |

**Unknown thresholds:** The numerical existing render budget and measurement method are **UNKNOWN**. Obtain the existing threshold and baseline from implementation before claiming performance conformance. Exact formatter boundaries, platform geometry, and flag evaluation timing are implementation dependencies. No new milliseconds, load target, or security policy is inferred. Scalability, compliance, and organization-wide maintainability targets are N/A for this epic. These gaps remain assumptions or execution blockers outside the scored register.

## Entry Criteria

- [ ] Dev and QA confirm the epic requirements and the implementation assumptions below.
- [ ] Executable feature build, supported test target, and suitable existing runner are available.
- [ ] Isolated local settings fixtures, controlled clock, existing completion event, and organization flag state are controllable.
- [ ] A successful-sync mechanism is available for the user-visible smoke, without modifying product sync behavior.
- [ ] Deterministic pre-change home-screen baseline and existing render-budget evidence are available.

## Exit Criteria

- [ ] All four acceptance criteria and both risks have implemented coverage.
- [ ] All eight planned P2 cases and their required variants pass; no unresolved home-screen or spinner regression remains.
- [ ] P0 tests pass 100% and P1 tests pass at least 95% if later added; both bands are currently N/A.
- [ ] No open high-severity defect or unmitigated high-risk item remains.
- [ ] Changed executable logic meets the coverage target when measurable, and scoped NFR evidence is retained for later assessment.

## Test Coverage Plan

P0/P1/P2/P3 identify test priority. Scheduling is defined under Execution Strategy. Risk score informs the priority judgment. Each Test Count is one logical case; Notes identify its variants. Levels distinguish pure formatting, component visibility, integration boundaries, and real-screen wiring or baseline verification.

The epic describes a secondary informational cue. Its Context records the existing dispatch workaround; its Constraints describe an existing flag that restores the previous screen. R-001 affects that cue while essential sync work continues. R-002 affects a reversible display state. Both primary risks and associated constraint checks fit P2. User reach and usage metrics are unavailable; a home-screen location alone establishes no critical business deadline or blocked essential operation.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity, or compliance impact with no safe workaround. Risk score is supporting evidence.

No scenario has a documented consequence meeting these criteria.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P0:** 0 cases; no allocated effort.

### P1 (High)

**Criteria:** Core, frequent, or complex behavior with material user reach and a limited workaround. Risk score is supporting evidence.

The epic supports a simple secondary display with existing recovery controls. No material core-operation degradation or complex new integration is documented.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P1:** 0 cases; no allocated effort.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score is supporting evidence.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 9.1-UNIT-001: AC1 relative-time formatting | Unit | R-001 | 1 | Dev | Freeze now; include the epic's four-minute example and boundaries supported by the implementation formatter. This isolates pure age calculation. Wrong age loses the cue; Epic Context supplies dispatch as the existing workaround. |
| 9.1-INT-001: AC1 latest local timestamp on home open | Integration | R-001 | 1 | Dev | Seed distinct prior/latest values; render through actual screen/store adapter and verify the latest value is read. Repeat offline to prove the local source. This tests the read boundary. |
| 9.2-INT-001: AC3 existing completion-event refresh | Integration | R-001 | 1 | Dev | Store a new successful time, emit the existing completion event, and assert the changed rendered age. Variants: absent to first success; two distinct successes; leave/reopen home. Preserve spinner behavior and keep prior success after unsuccessful/incomplete sync using actual engine event semantics. This establishes event/store/screen interaction. |
| 9.1-COMP-001: AC2/AC4 conditional row guard | Component | R-002 | 1 | Dev | Cross flag on/off with timestamp present/absent. Enabled+present shows one row; other states contain no row or placeholder. This isolates conditional rendering. Unwanted display has the existing organization flag rollback described in Constraints. |
| 9.2-E2E-001: AC1/AC3 technician sees refresh during sync | E2E | R-001 | 1 | QA/Dev | Open home with a known prior age; complete a real sync while it stays open; assert a distinct new age and completed spinner. This smoke proves actual engine-to-user wiring; formatting boundaries remain in Unit coverage. |
| 9.1-E2E-001: AC2 never-synced screen preserves baseline | E2E | R-002 | 1 | QA/Dev | Enable flag, omit field, open home. Compare image and rendered tree against pre-change screen with identical fixture/geometry; verify no blank gap and existing controls work. This validates full-screen composition. |
| 9.1-E2E-002: AC4 organization flag off restores screen | E2E | R-002 | 1 | QA/Dev | First prove the row visible with a present value. Turn flag off through existing release mechanism and enter home under its normal evaluation lifecycle. Compare exact prior-screen image/tree and existing control behavior. Live flag-refresh semantics are outside the epic. |
| 9.2-INT-002: Stories 9.1/9.2 satisfied boundary controls | Integration | R-001 | 1 | Dev | Observe indicator-owned operations on mount, event, and idle clock advancement: same existing store handle, single key lookup per intended read, zero writes/new fields/requests/polling/timers. Idle alone causes no time-triggered refresh. Separate engine writes and unrelated screen activity. This guards scope constraints; it introduces no additional scored risk. |

**Total P2:** 8 logical cases; approximately 6 to 12 hours. Level distribution: Unit 1, Component 1, Integration 3, E2E 3. API tests are inapplicable to this local-only change.

**Acceptance traceability:** AC1 maps to 9.1-UNIT-001, 9.1-INT-001, and 9.2-E2E-001. AC2 maps to 9.1-COMP-001 and 9.1-E2E-001. AC3 maps to 9.2-INT-001 and 9.2-E2E-001. AC4 maps to 9.1-COMP-001 and 9.1-E2E-002. Planned coverage: 4/4 criteria and 2/2 risks.

### P3 (Low)

**Criteria:** Rare, cosmetic, or experimental behavior with minimal impact and an easy workaround. Risk score is supporting evidence.

No optional cosmetic expansion is justified. Baseline checks implement explicit acceptance criteria and remain P2.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** 0 cases; no allocated effort.

## Execution Strategy

Run all functional cases in pull requests while measured suite runtime stays below 15 minutes. Start with fast pure/component checks, then integration checks and full-screen smoke. If higher priorities are introduced, run P0 before P1 and P2 within the applicable suites.

- **PR:** All planned functional checks. Use deterministic clock, isolated local store and organization flag, event-driven assertion waits, and fixed screen baselines. Parallelize only independently seeded cases supported by the chosen runner. Playwright parallelization applies if a web implementation establishes that runner.
- **Nightly:** Only smoke requiring unavailable PR infrastructure or measured excessive runtime. No extra long-running suite is justified by current requirements.
- **Weekly:** Existing product regression and manual visual checks on supported targets when available. No new load, chaos, or soak suite is planned.

No browser exploration session was opened: automation settings, runtime URL, and stack are unavailable, and capability probing is disabled.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 0 | N/A | No effort | Empty band |
| P1 | 0 | N/A | No effort | Empty band |
| P2 | 8 | Roughly 0.5 to 2 | Approximately 6 to 12 | Mixed pure/component/integration/smoke cases and variants |
| P3 | 0 | N/A | No effort | Empty band |
| Setup | N/A | N/A | Approximately 2 to 4 | Fixtures, clock control, and deterministic baseline |
| **Total** | **8** | **N/A** | **Approximately 8 to 16** | **About 1 to 3 working days within roughly 1 to 2 calendar weeks** |

Estimates assume an existing application harness. Building a new runner or obtaining unavailable platform infrastructure requires separate estimation once implementation is supplied.

### Prerequisites

**Test Data:** Isolated present/absent `lastSuccessfulSyncAt`; distinct prior/latest successful timestamps; controlled now; enabled/disabled organization flag. Reset state after each case. Test-only seeding remains separate from the indicator's read-only product behavior.

**Tooling:** Existing unit/component/integration runner and screen/device automation selected from the actual stack. Observe local store, network, and scheduling boundaries; capture deterministic rendered tree/image. No runner or vendor has been established by this input.

**Environment:** Executable test build, representative supported screen geometry, isolated organization flag access, known baseline, and controllable existing sync completion. Dev owns test seams and automation; QA owns visible smoke and baseline evidence; release owner supplies existing flag mechanism. Named owners are unassigned.

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% if introduced; currently N/A.
- **P1 pass rate:** ≥95% if introduced; failures require documented approval; currently N/A.
- **P2/P3 pass rate:** All eight planned P2 cases and their required variants must pass for epic acceptance. The template's general ≥90% floor is strengthened because each case covers an explicit criterion or scope control. P3 is currently N/A.
- **High-risk mitigations:** 100% complete or approved waivers if subsequent evidence introduces any; currently no high risks.

### Coverage Targets

- **Requirements and risk mapping:** 100% of four ACs and two scored risks; achieved in this design.
- **Changed executable logic:** ≥80% measurable coverage using the chosen implementation runner; no coverage result is claimed here.
- **Business logic and boundaries:** All formatter boundaries actually used by the implementation and all stated present/absent, enabled/disabled, and completion variants. No whole-product percentage target is inferred.
- **Security scenarios:** No new SEC risk. The own-device timestamp/privacy boundary remains required regression evidence.

### Non-Negotiable Requirements

- [ ] Zero unresolved acceptance failure or home-screen/spinner regression.
- [ ] No open high-severity defect or unmitigated score ≥6 risk.
- [ ] Local-only, read-only, privacy, and timer/polling constraints evidenced by scoped checks.
- [ ] Existing render-budget conformance measured against the supplied existing threshold.
- [ ] Planned NFR evidence retained for `nfr-assess`; final NFR status awaits execution evidence.

## Mitigation Plans

### R-001: Inaccurate or stale age (Score: 2)

**Strategy:** Document the low residual display risk; verify pure formatting, latest local source, completion-event refresh, and engine-to-screen smoke through the linked coverage rows. Preserve the existing spinner and indicator boundary controls. **Owner:** Dev for automation, QA for smoke. **Timeline:** Before epic acceptance. **Status:** Planned. **Verification:** Case reports with seeded prior/latest values and deterministic clock. Existing dispatch questions and feature flag rollback remain the source-supported recovery paths. No probability reduction is claimed before evidence exists.

### R-002: Conditional visibility/layout drift (Score: 1)

**Strategy:** Document the low residual display risk; validate the flag/value guard and exact pre-change full-screen baselines for absent and disabled states. **Owner:** Dev for component guard, QA for screen comparisons; release owner supplies flag mechanism. **Timeline:** Before epic acceptance. **Status:** Planned. **Verification:** Conditional matrix, image/tree comparisons, and existing-control checks. The flag provides the epic's existing restoration control; correctness of restoration requires the planned test.

## Assumptions and Dependencies

### Assumptions

1. Implementation permits deterministic local state and clock control. Runner, selectors, event names, timestamp representation, and formatter rules are unverified.
2. Use the implementation formatter's supported labels and boundaries. Malformed timestamps, clock skew policy, time zones, and new localization behavior have no stated epic requirement; expand only with implementation evidence or added requirements.
3. Flag-off validation follows the existing organization flag evaluation lifecycle. The epic establishes exact screen restoration without specifying hot-toggle latency.

### Dependencies

1. Executable implementation, runner, and representative supported target: required before test development/execution; Dev owner, date unassigned.
2. Store/event/clock/flag fixtures and an actual successful-sync smoke path: required before mapped cases can run; Dev and release owners, date unassigned.
3. Pre-change screen baseline, geometry, and existing render-budget threshold: required before baseline/performance sign-off; QA and Dev owners, date unassigned.

### Risks to Plan

Harness and runtime access are unavailable in this fixture repository. Their absence limits execution and estimates. Retain the runner-independent design until implementation is supplied. Missing render-budget measurement blocks performance conformance claims. No source-backed new product exposure is created by these planning dependencies.

## Follow-on Workflows (Manual)

Run `bmad-testarch-automate` explicitly after implementation/harness availability to implement the coverage plan. P0 red-mode generation is N/A for the current empty P0 band. Run `nfr-assess` after scoped evidence exists. This workflow generates the plan only.

## Approval

**Test Design Approved By:** Pending; no named approvers supplied.

- [ ] Product owner: pending; date unassigned.
- [ ] Tech lead: pending; date unassigned.
- [ ] QA owner: pending; date unassigned.

**Comments:** Workflow validation is complete. Team approval and implementation execution have separate pending status. No team meeting or approval is claimed.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Existing home screen | Adds one conditional row | Existing content, layout, control behavior; exact absent/flag-off baseline; enabled-row visible and unclipped. |
| Existing settings store | Reads existing timestamp through already-open handle | Local read path; zero indicator writes/new fields; existing unrelated settings behavior when available. |
| Existing sync engine and spinner | Shared existing completion event | Successful completion still records timestamp and completes spinner; unsuccessful/incomplete attempt preserves prior success; repeated/open-screen completion updates row. |
| Existing organization release flag | Controls indicator exposure and rollback | Existing flag evaluation and isolation; disabled organization receives exact prior screen. |

No existing test names or results are available. Require relevant existing regressions when implementation supplies them. QA, Dev, and the existing release owner coordinate an isolated test organization and deterministic baseline; no additional team dependency is evidenced.

## Appendix

### Knowledge Base References

- [risk-governance.md](../../../bmod-tea/knowledge/risk-governance.md): categories, ownership, and traceability.
- [probability-impact.md](../../../bmod-tea/knowledge/probability-impact.md): scoring scales and action thresholds.
- [test-levels-framework.md](../../../bmod-tea/knowledge/test-levels-framework.md): suitable levels and distinct evidence across levels.
- [test-priorities-matrix.md](../../../bmod-tea/knowledge/test-priorities-matrix.md): consequence/workaround-based priorities.
- [nfr-criteria.md](../../../bmod-tea/knowledge/nfr-criteria.md): scoped thresholds and later evidence assessment.

### Related Documents

- [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md): sole requirements source, embedded stories and four ACs.
- [TEA configuration](../../_bmad/config.toml): project field-service-platform, user tea-eval-harness, English output.
- PRD, architecture, tech spec, and sprint status: N/A for this run.

### Workflow Validation

Executed Create steps 1 through 5 in order using full design, sequential execution, and disabled capability probe. Checked the applicable epic-level checklist: risk arithmetic/IDs/source evidence, canonical levels/links, four AC mappings, distinct coverage purposes, totals/ranges, entry/exit gates, scoped NFR evidence, assumptions, exclusions, and regression responsibilities. System-only outputs, optional architecture inputs, contract/browser branches, and unavailable existing test names are N/A. No tests were generated or executed. No browser session exists. Workflow inputs under `docs/` are unchanged. The requested epic plan is the sole retained deliverable; the run checkpoint was temporary workflow state.

**Generated by:** BMad TEA Test Architect workflow  
**Workflow:** `bmad-testarch-test-design`  
**Template:** `skill/test-design-template.md`
