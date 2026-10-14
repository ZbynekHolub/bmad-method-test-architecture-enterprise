---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-13'
runScope: 'epic'
runKey: 'epic-9'
mode: 'epic-level'
designLevel: 'full'
executionMode: 'sequential'
capabilityProbe: false
inputDocuments:
  - 'field-sync-indicator/_bmad/config.toml'
  - 'field-sync-indicator/docs/epics/epic-9-last-sync-indicator.md'
  - 'bmod-tea/knowledge/tea-index.csv'
  - 'bmod-tea/knowledge/risk-governance.md'
  - 'bmod-tea/knowledge/probability-impact.md'
  - 'bmod-tea/knowledge/test-levels-framework.md'
  - 'bmod-tea/knowledge/test-priorities-matrix.md'
  - 'bmod-tea/knowledge/nfr-criteria.md'
---

# Test Design: Epic 9: Last successful sync time on the technician home screen

**Date:** 2026-10-13  
**Author:** tea-eval-harness  
**Status:** Draft; workflow complete; execution and team approval pending

## Executive Summary

**Scope:** Full epic-level test design for Epic 9, stories 9.1 and 9.2. The sole requirements source is [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md). The home screen reads `lastSuccessfulSyncAt` from the existing local settings store, shows a relative time when present, refreshes through the existing sync completion event, and obeys `home_last_sync_row`.

**Risk Summary:**

- Total risks identified: 3; all low, scores 1 to 2.
- High-priority risks (score ≥6): 0. Medium risks (score 3 to 4): 0.
- Categories represented: BUS and TECH. No critical category exposure is established by this epic.

**Coverage Summary:**

- P0 scenarios: 0; effort N/A.
- P1 scenarios: 0; effort N/A.
- P2 scenarios: 10; approximately 6 to 12 hours of test development.
- P3 scenarios: 0; effort N/A.
- Total effort including setup and review: approximately 8 to 16 hours, around 1 to 3 working days within a 1 to 2 week scheduling window.
- Planned acceptance coverage: 4/4 criteria. Planned risk coverage: 3/3 risks.

The supplied project contains the epic and configuration. Application code, manifests, test suites, fixtures, runnable environment and prior system-level plans are unavailable. Existing coverage and flakiness cannot be measured. All scenarios below are proposed; this run generates no tests and reports no execution results. Stack detection remains undetermined. Optional browser, Playwright Utils and Pact settings are unset; package and contract relevance gates are unsatisfied. No browser exploration or capability probe was performed.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Sync engine transport, retries and timestamp-writing algorithm | Epic consumes a value and completion event the engine already produces. | Preserve existing sync-engine regression coverage; validate the consumer boundary in the planned integration checks. |
| Orders, queue mutation and settings migration | Epic explicitly states the new field read is read-only and adds no stored field. | Verify the feature performs zero writes and reuse product regression for these existing operations. |
| New security/privacy controls or cross-organization data access | Timestamp belongs to the device and is shown to its holder; epic states no new personal data exposure. | Keep the documented local-data boundary and assert no added feature network activity. Existing product security checks retain their scope. |
| Backend load, infrastructure, failover, vendor contracts and scalability suites | Epic adds one local key lookup on an already-open screen with no new network/storage. | Check the stated cost constraints at the consumer seam; existing product suites handle platform concerns. |
| Live flag-service targeting and release-process redesign | Existing release process already toggles the flag per organization. | Use deterministic flag fixtures and verify the existing rollback path. Preserve existing targeting coverage. |
| New polling, periodic age refresh, timestamp schema or formatter specification | Story 9.2 explicitly uses completion events with no polling/timer; rounding and timestamp representation are unspecified. | Reuse existing store/formatter conventions and test event-driven refresh. Record remaining conventions as implementation assumptions. |

## Risk Assessment

Probability: 1 = unlikely with a simple established mechanism; 2 = possible at an unverified boundary; 3 = likely with evidence of issues or major uncertainty. Impact: 1 = minor informational/presentation harm with an easy workaround; 2 = material feature degradation; 3 = critical business, data, security or compliance harm. Score = Probability × Impact. Action thresholds: scores 1 to 3 document, 4 to 5 monitor, 6 to 8 mitigate, 9 block. Risk-band headings retain the template's ranges.

### High-Priority Risks (Score ≥6)

No high-priority risks are supported by the epic.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Medium-Priority Risks (Score 3-4)

No medium-priority risks are supported by the epic.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Relative-time conversion misstates sync recency. Story 9.1 requires the existing timestamp rendered as relative time, with “synced 4 minutes ago” as an example. Conversion/unit boundaries have possible mistakes. Consequence: a minor informational error; technicians retain the documented dispatch workaround. | 2 | 1 | 2 | Document; verify feature-owned elapsed-time logic and rendered label. Developer; before epic acceptance. |
| R-002 | TECH | Cached reads or a missed completion event leave an older timestamp displayed. Stories 9.1/9.2 and AC1/AC3 require the latest successful value and refresh while home is open. Store/event wiring is unverified. Consequence: stale secondary information, with the documented dispatch workaround. | 2 | 1 | 2 | Document; verify initial store binding and event-to-display transitions. Developer; before epic acceptance. |
| R-003 | BUS | Visibility guard leaves a row or reserved gap when the field is absent or the flag is disabled. Story 9.1 and AC2/AC4 require row omission and exact restoration of the previous home. A simple guard has low likelihood. Consequence: minor home-screen presentation discrepancy; home operations remain available and the existing flag provides rollback. | 1 | 1 | 1 | Document; cover the visibility state matrix and baseline layout. Developer and QA roles; before epic acceptance. |

Stale cache and missed events share R-002's freshness mechanism and mitigation. Absent-value and disabled-flag cases share R-003's conditional visibility mechanism. Their individual triggers appear in coverage. No probability reduction is claimed before execution. Residual risk is the current scored risk until tests establish mitigation evidence. Review scores when implementation or requirements establish a new exposure.

### Risk Category Legend

- TECH: Technical integration and architecture.
- SEC: Security and access/data exposure.
- PERF: Performance and resource limits.
- DATA: Data integrity and consistency.
- BUS: Business logic and user experience.
- OPS: Deployment, configuration and operations.

## NFR Planning

This section plans evidence for later `nfr-assess`. The epic's already-satisfied controls bound the scope. Their regression checks carry links to the functional risks they support; they create no additional scored exposure.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security / privacy | Existing device-owned timestamp shown locally to its holder; zero new personal data or feature network calls. | R-001, R-002 | Integration consumer call inspection in 9.2-INT-003; inspect rendered field binding. | Scoped test report, feature call counters and implementation diff. |
| Data integrity | Zero writes by this feature; zero new fields or storage. | R-002, R-003 | Integration read-only adapter and store-before/after comparison in 9.2-INT-003. Attribute timestamp changes to the existing engine. | Store snapshot pair and feature write-call count of zero. |
| Performance | Single local key lookup on reused open store; zero added timers, polling, network or storage; existing render budget unchanged. | R-001, R-002, R-003 | Integration instrumentation in 9.2-INT-003 separates existing screen/engine work from feature work. Inspect reuse of store and event path. | Call-count delta report and source inspection. Numeric render budget: UNKNOWN. |
| Reliability | Most recent successful value appears initially and after completion while home is open; spinner retains its completion behavior. | R-002 | Integration event/store transition checks, 9.1-INT-001 and 9.2-INT-001/002. | Test report with old/new values and spinner assertions. |
| Maintainability | Reuse existing field, store, event and flag. No new mechanism is required by the epic. | R-001, R-002, R-003 | Feature-owned unit/component/integration checks and implementation seam-reuse inspection. | Scoped CI test report and implementation diff; numeric coverage/duplication threshold: UNKNOWN. |
| Operations | Existing `home_last_sync_row` off restores previous home exactly. | R-003 | Component guard test and E2E baseline comparison. | Flag-fixture state, rendered structure and fixed-profile screenshot pair. |

**Unknown thresholds:** Numeric render budget, elapsed-time units/rounding, timestamp representation and any existing numeric code-quality thresholds are UNKNOWN in the supplied epic. Resolve them from the implementation's existing conventions before executable assertions are authored. They remain assumptions/dependencies, with no new invented SLO. Functional recency/freshness risks are R-001/R-002. Scalability and new compliance controls are outside this epic. Final NFR evidence status is deferred until implementation evidence exists.

## Entry Criteria

- [ ] Epic requirements and the scoped assumptions reviewed by the responsible product/development/QA roles.
- [ ] Application implementation and existing test harness available; stack and supported device profile identified.
- [ ] Local-store fixtures can seed populated and absent `lastSuccessfulSyncAt` states with cleanup.
- [ ] Existing completion event and flag can be controlled deterministically; clock and formatter convention available.
- [ ] Feature built in a test environment; flag enabled for positive cases and disabled for rollback cases.
- [ ] Prior-home baseline captured on the same build/profile/clock/data conditions; instrumentation distinguishes feature work from existing engine work.

## Exit Criteria

- [ ] All four acceptance criteria and all three risks have executed evidence at the planned suitable levels.
- [ ] All scoped P2 scenarios pass; empty P0/P1/P3 bands recorded as N/A.
- [ ] No open high-severity regression or unmitigated high-risk item introduced during implementation.
- [ ] Prior home restored exactly with flag off; absent-value home and existing spinner regression pass.
- [ ] Local/read-only/no-added-work assertions pass; scoped evidence available for later NFR assessment.

## Test Coverage Plan

P0/P1/P2/P3 express test priority. Execution timing is defined in Execution Strategy. Each count below represents a logical scenario; parameterized values stay within the named scenario.

All primary risks have P2 coverage. The row supplies secondary information and introduces no change to essential sync or order operations. For R-001 and R-002, technicians can continue asking dispatch about device recency, as described in the epic context. R-003 affects presentation while home operations remain available; the existing flag restores the prior screen. These consequences support an acceptable workaround. No user-reach percentages, frequency metrics or revenue impact are inferred. Planned rollback verification establishes the documented control before reliance on it at release.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity or compliance impact with no safe workaround. Risk score provides supporting evidence.

No scenarios meet this criterion within the documented scope.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P0:** 0 scenarios; effort N/A.

### P1 (High)

**Criteria:** Core, frequent or complex behavior with material user reach and a limited workaround. Risk score provides supporting evidence.

The epic establishes a secondary display with an existing workaround and rollback. It supplies no material core-operation consequence or usage evidence supporting P1.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P1:** 0 scenarios; effort N/A.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score provides supporting evidence.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 9.1-UNIT-001 | Story 9.1 / AC1: a timestamp four minutes before fixed now converts to the corresponding relative elapsed time. | Unit | R-001 | 1 | Developer | Pure feature-owned conversion/glue. Failure misstates secondary recency; dispatch remains the documented workaround. Reuse existing formatter tests when they already establish conversion. |
| 9.1-UNIT-002 | Story 9.1: elapsed-time transition between existing formatter units uses its established rounding convention. | Unit | R-001 | 1 | Developer | Parameterize values around an established boundary. Exact rounding/units UNKNOWN until implementation inspected. Cover feature-owned logic; reuse existing formatter-library coverage. |
| 9.1-COMP-001 | Story 9.1 / AC1: populated field and enabled flag render one visible relative-time row. | Component | R-001, R-002 | 1 | Developer | Fixed clock and known field input; asserts display binding and presentation, with lower-level conversion established separately. |
| 9.1-COMP-002 | Story 9.1 / AC2: absent key and enabled flag omit row and reserved gap. | Component | R-003 | 1 | Developer | Compare home structure and existing controls. Failure is a presentation discrepancy; original home operations remain usable. |
| 9.1-COMP-003 | AC4: disabled `home_last_sync_row` omits row for populated and absent fields. | Component | R-003 | 1 | Developer | Parameterized disabled states complete populated/absent × enabled/disabled matrix. Guard behavior restores the previous structure; existing flag is the documented rollback. |
| 9.1-INT-001 | Story 9.1 / AC1: initial home reads the latest successful timestamp from the actual local settings adapter. | Integration | R-002 | 1 | Developer | Seed older then newer successful values; open home and verify binding to newer value. Establishes real store-to-screen wiring; dispatch is the fallback for informational failure. |
| 9.2-INT-001 | Story 9.2 / AC3: successive successful completion events refresh an open home to each newest value. | Integration | R-002 | 1 | Developer | Write through the existing engine/store seam, then publish the existing event. Assert visible old-to-new transitions without navigation. Existing spinner still settles correctly. Covers cached-read and missed-event triggers together. |
| 9.2-INT-002 | Stories 9.1/9.2 / AC2/AC3: first successful completion creates the row while the home screen remains open. | Integration | R-002, R-003 | 1 | Developer | Begin with absent key and visibly absent row; persist first success through the existing seam and publish completion. Assert row appears with that value. |
| 9.2-INT-003 | Stories 9.1/9.2 and satisfied constraints: display/refresh uses the existing local read and event path. | Integration | R-001, R-002, R-003 | 1 | Developer | Regression guard: reused store; single key lookup per load/refresh; zero feature writes, new fields/storage, network calls, timers or polling. Instrument the consumer separately from existing engine activity. Supports display risks within the documented boundary; adds no scored SEC/DATA/PERF risk. |
| 9.1-E2E-001 | AC1/AC2/AC4: built home shows a readable row, matches original layout with absent value, and restores the original home with flag off. | E2E | R-001, R-002, R-003 | 1 | QA role | One focused visual smoke on fixed device profile, clock and data. Compare against captured prior-home baseline; verify spacing, clipping, visible controls and pixel equality in omitted states. Justified by AC4's exact full-screen restoration; lower levels establish logic/wiring. Use the existing flag application path, with propagation semantics taken from implementation. |

**Total P2:** 10 logical scenarios, approximately 6 to 12 hours of test development. Distribution: 2 Unit, 3 Component, 4 Integration, 1 E2E. API coverage is N/A because the feature adds no API interaction.

**Acceptance traceability:** AC1 maps to 9.1-UNIT-001, 9.1-COMP-001 and 9.1-INT-001; AC2 to 9.1-COMP-002 and 9.2-INT-002; AC3 to 9.2-INT-001/002; AC4 to 9.1-COMP-003 and 9.1-E2E-001. Cross-level assertions address conversion, presentation, wiring and full-screen layout separately. Reuse existing lower-level coverage when implementation inspection establishes it.

### P3 (Low)

**Criteria:** Rare, cosmetic or experimental behavior with minimal impact and an easy workaround. Risk score provides supporting evidence.

No additional rare or experimental behavior is specified. Layout checks directly establish the epic's exact restoration criterion and remain in P2.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** 0 scenarios; effort N/A.

## Execution Strategy

Run all functional scenarios in pull requests when the measured suite duration stays below 15 minutes. Execution for this run is sequential, as requested. Runner choice remains dependent on the existing product stack.

- **Pull request:** Unit, component, integration and focused visual smoke coverage, including the existing home/spinner regression affected by the change. Identify and run the smallest home smoke first, followed by any P0/P1 additions and remaining scoped cases.
- **Nightly:** Any device visual execution with measured duration or setup cost that exceeds the PR budget. No new long-running load or chaos suite is justified by this epic.
- **Weekly:** Existing product-wide regression and any manual visual review requiring a wider supported-profile check. This plan adds no new weekly infrastructure suite.

The 15-minute value is a scheduling target from the workflow, with actual runtime currently unmeasured. Playwright parallelization is N/A for this sequential, stack-undetermined run.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 0 | N/A | N/A | Empty scope band. |
| P1 | 0 | N/A | N/A | Empty scope band. |
| P2 | 10 | Approximately 0.5 to 1.5 | Approximately 6 to 12 | Mixed unit/component/integration effort and one visual smoke; assumes existing harness. |
| P3 | 0 | N/A | N/A | Empty scope band. |
| Setup and review | N/A | N/A | Approximately 2 to 4 | Deterministic local data, clock, flag, baseline and report review. |
| **Total** | **10** | **N/A** | **Approximately 8 to 16** | **Around 1 to 3 working days within a 1 to 2 week scheduling window.** |

Ranges are planning estimates. Harness absence or inaccessible state/event seams requires re-estimation before execution; no framework-build estimate is inferred from this documentation-only fixture.

### Prerequisites

**Test Data:** Populated and absent timestamp states, older/newer successful values, fixed clock, deterministic enabled/disabled flag state, original-home baseline and isolated cleanup. Preserve the existing timestamp representation.

**Tooling:** Existing product unit/component runner, local-store/event integration harness, screenshot-capable app/device runner and feature-scoped call instrumentation. Tool names, selectors, routes and package versions are unverified.

**Environment:** Runnable implementation on the product's supported profile; local store and flag available; baseline and feature build share viewport/device, text scale, clock and unrelated data conditions. No non-standard external access is established by this epic.

## Quality Gate Criteria

### Pass/Fail Thresholds

- P0 pass rate: 100% if scope changes introduce P0; current band N/A.
- P1 pass rate: ≥95%, with explicit approved waiver for any failure if introduced; current band N/A.
- P2 pass rate: 100% of this small scoped plan before epic acceptance. Every scenario contributes an acceptance or constraint check.
- P3 pass rate: ≥90% if introduced; current band N/A.
- High-risk mitigation: 100% complete or explicitly approved waiver if new evidence introduces score ≥6; current count 0.

### Coverage Targets

- Acceptance criteria: 100% (4/4) with executed evidence, stricter than the workflow's ≥80% general target because this epic has four criteria.
- Material risks: 100% (3/3) at suitable levels.
- Documented visibility states and specified event transitions: 100% of the planned cases.
- Newly changed feature-owned logic: cover its identified branches; existing numeric code-coverage standard UNKNOWN. Reuse verified existing formatter coverage.
- Security/data/performance scope: verify stated local/read-only/no-added-work invariants. Platform security and load targets remain outside this epic.

### Non-Negotiable Requirements

- [ ] Applicable P0/P1 thresholds satisfied; empty bands remain N/A.
- [ ] No open high-severity regression and no unmitigated score ≥6 item.
- [ ] Prior-home baseline restoration and spinner regression pass.
- [ ] Evidence for every in-scope NFR row is available before release validation; full NFR evidence decision deferred to `nfr-assess`.

Design validation establishes completeness of this plan. Release readiness remains unassessed because execution evidence is unavailable.

## Mitigation Plans

All actions below are planned; owners are responsibility roles, with no named assignment supplied.

### R-001: Incorrect relative time (Score: 2)

**Strategy:** Fix the clock; validate feature-owned conversion at the example interval and existing formatter boundary; validate the rendered field binding.  
**Owner:** Developer. **Timeline:** Before epic acceptance. **Status:** Planned.  
**Verification:** 9.1-UNIT-001/002 and 9.1-COMP-001, using existing formatter coverage where applicable.

### R-002: Stale display (Score: 2)

**Strategy:** Seed the actual store, verify the latest value on initial open, and exercise first and successive completion events while the screen stays open. Preserve spinner completion behavior.  
**Owner:** Developer. **Timeline:** Before epic acceptance. **Status:** Planned.  
**Verification:** 9.1-INT-001 and 9.2-INT-001/002, with distinguishable before/after values and visible transition assertions.

### R-003: Incorrect conditional visibility (Score: 1)

**Strategy:** Exercise populated/absent field with enabled/disabled flag and compare omitted states with the original home baseline.  
**Owner:** Developer and QA roles. **Timeline:** Before epic acceptance. **Status:** Planned.  
**Verification:** 9.1-COMP-002/003 and 9.1-E2E-001; retain all existing controls and exact omitted-state layout.

## Assumptions and Dependencies

### Assumptions

1. The supplied epic's local-only, read-only, privacy, cost and release-flag constraints hold. Regression assertions verify them during implementation.
2. Existing formatter and store define timestamp representation, units and rounding. Their details are UNKNOWN here; the example wording describes the expected relative-time behavior.
3. Existing engine completion updates the persisted successful value in an order the screen can observe. Exact ordering and event API must be inspected before wiring tests.
4. Flag propagation semantics and supported device/viewport profiles come from the implementation. AC4 requires exact restoration once the existing flag-off path takes effect; this plan invents no propagation deadline.
5. Generic knowledge examples do not establish platform requirements for this epic. Numerical runtime, render and coverage measurements remain unavailable.

### Dependencies

1. Runnable application and existing tests/harness: required before executable test work.
2. Deterministic store, completion-event, clock and flag seams: required before integration/component work.
3. Original-home visual baseline with fixed profile and stable data: required before E2E visual comparison.
4. Applicable prior-home and spinner regression cases: identify in the implementation repository before acceptance. This fixture supplies no existing test filenames.

### Risks to Plan

- **Missing implementation/harness evidence:** estimates and runner selection depend on assets beyond this fixture. **Contingency:** inspect the implementation repository, reuse its test patterns and re-estimate setup if necessary. This limits execution readiness and leaves design completion possible.
- **Unknown formatter/baseline conventions:** executable expectations need the existing product rules. **Contingency:** resolve these implementation details before authoring assertions and keep the sole epic requirements source intact.

## Follow-on Workflows (Manual)

Run `bmad-testarch-automate` explicitly when implementation/harness context is available to implement the scoped coverage. Red-mode P0 generation is N/A because the plan has no P0 cases. Run `nfr-assess` after implementation evidence exists. No follow-on workflow was executed during this run.

## Approval

**Test Design Approved By:** Pending team review; no approval or meeting is asserted.

- [ ] Product responsibility: review scope and informational consequence.
- [ ] Technical responsibility: validate existing formatter/store/event conventions and implementation boundaries.
- [ ] QA responsibility: review coverage and visual baseline evidence.

**Comments:** Optional Project Team section omitted because no names are provided; ownership roles appear in coverage and mitigation plans.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Technician home screen | One optional row shares an already-rendered screen. | Existing home content, controls/navigation and layout remain usable; absent/disabled states equal prior baseline. Existing test names unavailable. |
| Local settings store | Read existing `lastSuccessfulSyncAt` through the store already used by home. | Existing settings reads remain intact; feature adds zero writes, stored fields or extra store opens. |
| Sync engine completion event and progress spinner | New display consumes event already used by spinner. | Engine timestamp production continues; new subscriber sees latest completion; spinner progress/completion behavior remains intact. |
| Existing organization flag path | `home_last_sync_row` governs display and rollback. | Existing enabled/disabled evaluation and release-toggle path continue to work; deterministic fixtures avoid live flag-service dependence. |

No new cross-team service coordination is established by the epic. Existing home/sync/release owners supply baseline and regression context during implementation.

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: category, ownership and risk traceability.
- `bmod-tea/knowledge/probability-impact.md`: 1 to 3 scoring scales and remediation actions.
- `bmod-tea/knowledge/test-levels-framework.md`: unit, component, integration and visual E2E suitability.
- `bmod-tea/knowledge/test-priorities-matrix.md`: consequence, workaround and recoverability-based priorities.
- `bmod-tea/knowledge/nfr-criteria.md`: planned evidence; generic examples applied within epic scope.

### Related Documents

- Epic and stories: [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md), sole requirements source.
- Configuration: [TEA configuration](../../_bmad/config.toml).
- PRD, architecture, tech spec and sprint status: N/A for this run, as specified.
- Output template: `skill/test-design-template.md`.

### Workflow Validation

Steps 1 through 5 completed in sequence. Mode and run identity stayed epic-level / epic-9; output generation stayed sequential with probing disabled. Validated against `skill/checklist.md` for applicable epic-level requirements: risk schema/arithmetic/IDs, suitable coverage links, four AC mappings, priority justification, ranges, NFR planning, entry/exit criteria and regression scope. Source documents remained unchanged.

System-level documents/handoff, status-file updates, browser session cleanup, Playwright parallelization, live exploration, team approval and P0 generation are N/A within this run. The single E2E visual smoke is justified by exact full-screen restoration in AC4 and the test-levels visual-regression guidance. Execution evidence, team sign-off and implementation convention resolution remain pending prerequisites; no final release/NFR gate decision is made.

**Generated by:** BMad TEA Test Architect workflow  
**Workflow:** `bmad-testarch-test-design`  
**Template:** `skill/test-design-template.md`
