---
workflowStatus: 'completed'
runScope: 'epic'
runKey: 'epic-9'
mode: 'epic-level'
design_level: 'full'
tea_execution_mode: 'sequential'
tea_capability_probe: false
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-13'
inputDocuments:
  - field-sync-indicator/_bmad/config.toml
  - field-sync-indicator/docs/epics/epic-9-last-sync-indicator.md
  - bmod-tea/knowledge/tea-index.csv
  - bmod-tea/knowledge/risk-governance.md
  - bmod-tea/knowledge/probability-impact.md
  - bmod-tea/knowledge/test-levels-framework.md
  - bmod-tea/knowledge/test-priorities-matrix.md
  - bmod-tea/knowledge/nfr-criteria.md
---

# Test Design: Epic 9: Show the last successful sync time on the technician home screen

**Date:** 2026-10-13
**Author:** tea-eval-harness
**Status:** Draft; workflow complete, stakeholder approval pending

## Executive Summary

**Scope:** Full epic-level test design for Epic 9, stories 9.1 and 9.2. The sole requirements source is [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md). The addition reads `lastSuccessfulSyncAt`, renders a relative time, refreshes on the existing completion event, and follows `home_last_sync_row`.

**Risk Summary:**

- Total risks identified: 2, both low, each score 2.
- High-priority risks (score ≥6): 0. Medium risks (score 3 to 4): 0.
- Categories represented: BUS and TECH. No critical category exposure is established.
- The existing read-only, local-only, privacy, render-budget and rollout controls bound this assessment. Their regression assertions appear in the coverage plan.

**Coverage Summary:**

- P0 scenarios: 0; effort N/A.
- P1 scenarios: 0; effort N/A.
- P2 scenarios: 7; approximately 4 to 8 hours.
- P3 scenarios: 0; effort N/A.
- Total: 7 planned scenario groups, comprising 1 Unit, 3 Component, 2 Integration and 1 E2E.
- **Total effort:** Approximately 4 to 8 hours, or 0.5 to 1 working day, assuming an existing application test harness.

All four acceptance criteria have planned coverage. The supplied project contains the epic and configuration only. Implementation, existing tests, fixtures, runner, stack manifests and historical results are unavailable. Test execution and measured coverage remain pending.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Sync engine transfer, retry and timestamp persistence algorithms | The epic consumes a field and event the engine already produces. | Preserve the established engine regression suite when available; validate the consumer interaction and spinner in this plan. |
| Backend APIs, vendor services and load testing | The epic explicitly adds no network call and uses one local lookup. | Assert zero row-attributable network calls; retain existing platform validation outside this epic. |
| Storage migrations, queue/order mutation and new privacy controls | The epic explicitly writes nothing, stores no new field and exposes the device's own timestamp to its holder. | Instrument the read path to preserve those constraints; retain existing storage/security suites. |
| Feature flag service implementation and organization targeting policy | `home_last_sync_row` and per-organization release toggling already exist. | Exercise both evaluated flag states and verify the previous home screen on disable. |
| Periodic aging of relative text | Story 9.2 requires completion-event refresh and explicitly excludes polling and timers. | Assert the completion-driven update and absence of row-added scheduling. |
| Implementation and generated tests | This workflow produces a test design document. | Implement the planned cases in a separately invoked automation workflow. |

## Risk Assessment

Probability: 1 = unlikely, 2 = possible boundary or integration mistake, 3 = likely with supporting evidence. Impact: 1 = minor informational or layout defect with an easy workaround, 2 = degraded operation, 3 = critical business, data, security or regulatory harm. Score = Probability × Impact.

Both risks use probability 2 because display binding and conditional rendering have boundary cases. No implementation defects or failure history support probability 3. Impact 1 reflects the secondary status hint, dispatch workaround described in the epic context, preserved essential home functions and existing organization flag rollback. Unknown user-reach metrics do not establish broader harm.

### High-Priority Risks (Score ≥6)

No high-priority risks are supported by the supplied epic.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Medium-Priority Risks (Score 3 to 4)

No medium-priority risks are supported by the supplied epic.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1 to 2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Incorrect or stale relative time removes the useful sync-status hint; technicians continue asking dispatch. Story 9.1 requires the latest `lastSuccessfulSyncAt`; story 9.2 and AC3 require re-render when the existing completion event fires. Initial stale reads and missed refreshes share the displayed-freshness consequence. | 2 | 1 | 2 | DOCUMENT; verify fixed-clock formatting, latest-key binding and completion-event refresh before rollout. |
| R-002 | TECH | Incorrect visibility gating leaves a row or empty gap on never-synced or flag-off home screens. Story 9.1 says the absent field produces no row and leaves the screen unchanged; AC4 requires the flag-off screen to match the previous screen exactly. Both conditions share the row visibility boundary. | 2 | 1 | 2 | DOCUMENT; verify absent-key and disabled-flag rendering, including the previous-screen visual baseline, before rollout. |

Scores 1 to 3 require documentation; 4 requires monitoring; scores ≥6 require mitigation; 9 blocks release. The template's score bands remain separate from test priorities. The current risks retain their initial scores until implementation evidence supports reassessment. No residual reduction or waiver is claimed.

### Risk Category Legend

- **TECH:** Technical and integration defects.
- **SEC:** Security and exposure defects.
- **PERF:** Performance and resource-budget defects.
- **DATA:** Data loss, corruption or inconsistency.
- **BUS:** Business logic and user experience harm.
- **OPS:** Deployment, configuration and operational defects.

## NFR Planning

This section plans later validation and evidence for `nfr-assess`. The epic's already-satisfied controls are scope constraints. No new SEC, DATA or PERF exposure is evidenced.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security / privacy | Same device-owned timestamp shown to its holder; zero added personal data, outbound calls or stored fields. | R-001, R-002 | 9.2-INT-002: render from the existing local field; instrument row-attributable traffic and persistence. Linked as display/visibility regression constraints. | Integration report, local-field trace and zero added traffic/storage assertions. |
| Performance | One local key lookup on the store already opened by home; zero added network calls, storage, polling or timers; existing render budget unchanged. | R-001, R-002 | 9.2-INT-002: instrument the lookup/read path and row-added scheduling; compare home rendering with the existing budget/baseline when available. | Lookup/scheduler/network report and existing home render comparison. |
| Reliability | Re-render on the existing completion event while home stays open; preserve spinner completion behavior. | R-001 | 9.2-INT-001 and 9.2-INT-002: use the established store-commit/event order and assert visible refresh plus spinner outcome. | Event/store/UI assertion report. |
| Operations / rollback | Existing per-organization `home_last_sync_row` off restores the previous home exactly. | R-002 | 9.1-COMP-003 and 9.1-E2E-001: evaluated flag-off state, including completion-event delivery, and pre-change baseline comparison. | Flag-state assertion report and screenshot/layout comparison. |

**Unknown thresholds:** Numeric home render budget and its measurement method are UNKNOWN in the epic, which states the existing budget is unchanged. Refresh latency in milliseconds, timestamp encoding, formatter rounding/localization boundaries and flag-application lifecycle are UNKNOWN. Use existing application contracts when implementation is available. These are execution assumptions outside the risk register; this plan invents no SLO or behavior for malformed/future timestamps. Scalability, compliance and numeric maintainability thresholds have no epic-specific requirements. Evidence sources above are planned and uncollected.

## Entry Criteria

- [ ] Developer and QA accept this plan's scope, cases and execution assumptions.
- [ ] A testable implementation build and the existing application runner are available.
- [ ] Local settings can be seeded with a valid timestamp or an absent key; fixtures restore state afterward.
- [ ] Clock, evaluated flag state and existing completion event are controllable using the application's established interfaces.
- [ ] A pre-change home baseline exists for matching viewport, fonts, theme and seeded screen content.
- [ ] Store/event ordering, formatter behavior and applicable existing render baseline are identified for the assertions that need them.

The epic supplies all planning prerequisites. The items above are prerequisites for later test execution. PRD, architecture and sprint-status documents are N/A for this run.

## Exit Criteria

- [ ] All four acceptance criteria and all seven planned scenario groups pass before rollout.
- [ ] No open high-severity defects or unmitigated risks scoring ≥6; reassess if evidence introduces either.
- [ ] Flag-off and never-synced states preserve the previous home screen.
- [ ] Completion updates visible text and preserves the existing spinner behavior.
- [ ] Read-only/local-only and event-only constraints have recorded regression evidence.
- [ ] Coverage targets below are met; any unmeasurable target is recorded with an owner and disposition.

## Test Coverage Plan

P0 through P3 express test priority. Scheduling is defined in Execution Strategy. Counts denote scenario groups; parameterized boundary variants are included in their group's count.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity or compliance impact with no safe workaround. Risk score provides supporting evidence.

No P0 scenarios: the epic adds a reversible informational row and establishes no critical exposure.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P0:** 0 tests; effort N/A.

### P1 (High)

**Criteria:** Core, frequent or complex behavior with material user reach and a limited workaround. Risk score provides supporting evidence.

No P1 scenarios: the epic establishes a simple secondary feature and an existing dispatch workaround. Frequency, user reach and known failure history are unavailable. Spinner preservation is a bounded regression check of the shared event.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P1:** 0 tests; effort N/A.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score provides supporting evidence.

Each primary risk meets the secondary-behavior criterion: R-001 affects a status hint whose dispatch workaround is stated in Context; R-002 affects row visibility and uses the established flag to restore the previous home. Essential home operations remain available under the epic's constraints. Organization rollout bounds exposure; actual usage and reach remain UNKNOWN.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 9.1-UNIT-001 | Story 9.1 / AC1: valid completion timestamp converts to relative time against a fixed clock. | Unit | R-001 | 1 | Developer | Freeze now; use a timestamp four minutes earlier and assert the expected relative interval. Parameterize existing formatter boundary rules once known. Tests arithmetic independently of home binding. Incorrect text reduces the status hint; dispatch remains the source-supported workaround. |
| 9.1-COMP-001 | Story 9.1 / AC1: enabled home reads the latest `lastSuccessfulSyncAt` on initial render. | Component | R-001 | 1 | Developer | Seed the existing store with the latest completion after an earlier one; mount real home binding and assert its row uses the latest value. Validate field selection and binding; formatter arithmetic belongs to the Unit case. |
| 9.1-COMP-002 | Story 9.1 / AC2: absent key yields no sync row or reserved gap. | Component | R-002 | 1 | Developer | Flag enabled, never-synced settings fixture. Compare other home content and layout tree with the previous home; reject a placeholder or fabricated time. A spurious informational row is minor; existing flag rollback restores home. |
| 9.2-INT-001 | Story 9.2 / AC3: a successful sync completion updates the already-open home. | Integration | R-001 | 1 | Developer with QA | Assert old visible text first, commit a newer timestamp through the existing engine/store boundary, publish its real completion event, then assert changed text without navigation. Include first-ever success after an absent key as a parameter variant. Exercises event/store/home ordering. Stale status has the dispatch workaround. |
| 9.1-COMP-003 | AC4: disabled `home_last_sync_row` preserves the previous home rendering. | Component | R-002 | 1 | Developer | Parameterize key present/absent; deliver completion with the flag disabled and confirm the row remains absent. Apply flag changes through the existing lifecycle. Tests evaluated flag gating separately from the absent-key guard. |
| 9.2-INT-002 | Stories 9.1/9.2 and satisfied constraints: the row preserves the existing read-only, local-only, event-driven operation and spinner. | Integration | R-001, R-002 | 1 | Developer | Instrument initial read/render and event refresh: one local key lookup per requested read, existing open store, zero row writes/new fields/network calls/polling/timers. Confirm spinner still receives completion and settles normally. Separate fixture setup and engine traffic/writes from row activity. Use existing render-budget comparison if available. This checks shared-boundary constraints without adding scored hypothetical exposures. |
| 9.1-E2E-001 | AC2/AC4 and home composition: whole-screen visual regression across the three supported row states. | E2E | R-002 | 1 | QA | Compare disabled/present and enabled/absent whole-screen states with the pre-change baseline; they must match exactly under controlled rendering conditions. In enabled/present state, verify the added row is readable, with other home content intact. The full-screen check establishes composition beyond Component guard logic; detailed time/event assertions remain at lower levels. |

**Total P2:** 7 tests; approximately 4 to 8 hours.

### P3 (Low)

**Criteria:** Rare, cosmetic or experimental behavior with minimal impact and an easy workaround. Risk score provides supporting evidence.

No additional P3 scenarios are evidenced. Exact home restoration is an acceptance criterion covered in P2.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** 0 tests; effort N/A.

**Acceptance traceability:** AC1 → 9.1-UNIT-001, 9.1-COMP-001; AC2 → 9.1-COMP-002, 9.1-E2E-001; AC3 → 9.2-INT-001; AC4 → 9.1-COMP-003, 9.1-E2E-001. Every material risk has suitable coverage: R-001 uses Unit/Component/Integration; R-002 uses Component/E2E plus shared-boundary regression. Overlap verifies distinct arithmetic, binding, interaction and full-screen aspects.

## Execution Strategy

Run all functional cases in pull requests while measured suite time stays below 15 minutes. Defer work only when its measured duration or infrastructure needs justify a separate schedule.

- **Pull request:** All seven scoped scenario groups. Run isolated lower-level checks before the full-screen smoke/visual check for quick feedback. Use fixed clocks, condition/event-based synchronization and fixture cleanup. Existing runner parallelization is conditional on isolated state; no Playwright installation or runner is assumed.
- **Nightly:** N/A for new epic suites. Any existing expensive home/sync regression continues on its established schedule; all seven scoped cases remain in PR validation.
- **Weekly:** N/A. This epic establishes no load, chaos or long-running workload.

Provisional execution target: below 5 minutes excluding build/device startup, to be measured once the runner exists. No browser target or configured automation branch was available; exploration and capability probing were omitted as configured. Workflow execution was sequential.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 0 | N/A | N/A | Empty band. |
| P1 | 0 | N/A | N/A | Empty band. |
| P2 | 7 | Approximately 0.25 to 1 | Approximately 4 to 8 | Includes shared clock/store/flag fixtures, baseline preparation and initial validation on an existing harness. |
| P3 | 0 | N/A | N/A | Empty band. |
| **Total** | **7** | N/A | **Approximately 4 to 8** | **Approximately 0.5 to 1 working day; 0.1 to 0.2 working weeks.** |

These are planning ranges. A new test framework would need a separate estimate after inspecting the implementation repository.

### Prerequisites

**Test Data:** A valid latest timestamp, absent-key settings, two sequential successful completions and deterministic evaluated flag values. Freeze the clock; seed the existing local settings outside the action under test; restore store, clock, flags and event listeners after each case.

**Tooling:** The application's existing Unit/Component runner, store/event integration harness and full-screen screenshot/layout comparison tool. Framework and stack are UNKNOWN. Device wording alone does not establish a native mobile stack. No new tool installation is required by this design run.

**Environment:** Testable home screen with seeded local settings, the existing completion publisher/spinner and controllable organization flag evaluation. Visual comparisons require the same viewport, theme, fonts, clock and home content as the previous build. Existing dynamic screen elements must be controlled consistently; changes to the sync row or surrounding geometry must remain visible to comparison.

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% if P0 cases are introduced; currently N/A.
- **P1 pass rate:** ≥95% if P1 cases are introduced, with approved waivers for failures; currently N/A.
- **P2 pass rate:** 100% of the seven scoped groups before organization rollout. This tightens the template's generic ≥90% threshold because this small suite directly covers the four acceptance criteria and satisfied constraints.
- **P3 pass rate:** N/A; any later P3 cases require an explicit disposition.
- **High-risk mitigations:** 100% complete or explicitly approved, time-bounded waivers if risks ≥6 emerge; currently none.

### Coverage Targets

- **Acceptance criteria:** 4/4 planned and later passing, 100%.
- **Risk linkage:** 2/2 material risks mapped, 100%.
- **Relevant changed logic:** ≥80% automated coverage when the runner can measure it; exercise all specified present/absent, enabled/disabled and completion-update branches regardless of line coverage.
- **Security and performance expansion:** N/A; preserve the explicitly satisfied privacy/local-only/read-only/render-budget constraints with the planned regression evidence.

### Non-Negotiable Requirements

- [ ] All acceptance criteria pass with reproducible evidence.
- [ ] No unresolved high-severity defects or unmitigated risks scoring ≥6.
- [ ] Zero row-attributable writes, new fields, network calls, polling or timers.
- [ ] Flag disable and absent-key behavior match the previous home; existing spinner regression passes.
- [ ] Each in-scope NFR has the evidence identified above, or an explicit owned disposition for unmeasurable evidence. Final NFR assessment follows `nfr-assess` once implementation evidence exists.

No release gate result is asserted by this planning run.

## Mitigation Plans

### R-001: Incorrect or stale relative time (Score: 2)

**Mitigation Strategy:** Verify fixed-clock formatting, actual home/store binding and the existing completion event's visible update through the linked coverage cases. Keep the current event-driven contract.
**Owner:** Developer, with QA verification.
**Timeline:** Before organization rollout; release date unspecified.
**Status:** Planned.
**Verification:** Unit/Component/Integration reports show correct initial and post-completion values, including first-ever completion. Residual risk remains score 2 pending evidence.

### R-002: Incorrect conditional visibility (Score: 2)

**Mitigation Strategy:** Cover absent-value and flag-off guards, then compare whole-screen output with the previous home under matching rendering conditions.
**Owner:** Developer for guards; QA for full-screen verification.
**Timeline:** Before organization rollout; release date unspecified.
**Status:** Planned.
**Verification:** Component reports and E2E visual/layout evidence show complete row removal, preserved surrounding content and exact baseline restoration. Residual risk remains score 2 pending evidence.

## Assumptions and Dependencies

### Assumptions

1. The implementation preserves the already-satisfied constraints stated in the epic. Evidence of a new exposure triggers rescoring.
2. Existing formatter and event/store contracts determine timestamp encoding, boundary wording and commit/publication order. Malformed timestamps, future clock values and periodic aging have no new product requirements in this source.
3. Tests can control local state, time and evaluated flag values through established application interfaces; these hooks have yet to be inspected.
4. The flag uses its existing application lifecycle. Immediate remote flag propagation or hot switching is outside the stated requirements.
5. No known failures, usage metrics, existing coverage measurements or flakiness evidence were supplied. Their absence describes this fixture's limits.

### Dependencies

1. Developer: testable build, local state seeding and actual completion-event interface, required before execution.
2. Developer and QA: previous home baseline plus fixed rendering conditions, required before the full-screen comparison.
3. QA: existing test runner and render-budget measurement/baseline, required before collecting corresponding evidence. Numeric budget remains UNKNOWN until identified.

### Risks to Plan

- **Harness access unavailable:** Automated execution cannot start. Inspect the implementation repository and resolve fixtures with Developer/QA before scheduling execution; retain the planned cases.
- **Baseline unavailable:** Exact previous-home restoration cannot be measured. Capture the previous build under identical conditions before recording that case as passing.
- **Contract details unavailable:** Formatter boundary and render-budget assertions remain unmeasurable. Use the existing contracts when supplied; record an owned disposition for any remaining evidence gap.

## Follow-on Workflows (Manual)

- Invoke `bmad-testarch-automate` explicitly to implement these P2 cases when the implementation and runner are available. P0 red-mode generation is N/A for this plan.
- Use `nfr-assess` and trace/gate workflows after evidence collection. No follow-on workflow ran here.

## Approval

**Test Design Approved By:** Pending stakeholder review; names and approval dates were not supplied.

- [ ] Product owner: validate scope and assumptions.
- [ ] Tech lead: validate application contracts and testability.
- [ ] QA owner: validate coverage, evidence and rollout readiness.

**Comments:** Completion denotes the finished design workflow. Stakeholder approval, implemented tests and release validation remain pending.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Technician home screen | Adds one optional informational row. | Existing home content/layout/navigation checks must continue passing when available; explicit flag-off and absent-key baseline checks are planned. |
| Local settings store | Reads the already-written success timestamp. | Existing settings reads remain intact; verify read-only access, no new stored fields and unchanged surrounding values. |
| Sync completion publisher and spinner | Existing event gains a home-row consumer. | Preserve spinner completion behavior and existing engine event contract; verify visible timestamp refresh. |
| Existing flag evaluator/release process | Controls organization exposure and rollback. | Preserve established flag evaluation; exercise evaluated enabled/disabled states without dependence on a live external flag service in isolated tests. |

Existing test names and results are unavailable. Developer and QA coordinate fixture/event/baseline access; no cross-team or vendor dependency is established by this epic.

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: canonical risks, evidence and ownership.
- `bmod-tea/knowledge/probability-impact.md`: probability, impact and remediation thresholds.
- `bmod-tea/knowledge/test-levels-framework.md`: Unit, Component, Integration and full-screen E2E selection.
- `bmod-tea/knowledge/test-priorities-matrix.md`: independent P0 through P3 classification and recoverability.
- `bmod-tea/knowledge/nfr-criteria.md`: measurable planned evidence and UNKNOWN thresholds.

### Related Documents

- Requirements: [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md), including both stories and all acceptance criteria.
- Configuration: [TEA/core configuration](../../_bmad/config.toml).
- Template: `skill/test-design-template.md`; validation: `skill/checklist.md`.
- PRD, architecture, tech spec, prior system-level designs and sprint status: N/A for the supplied scope.

### Workflow Validation

The five Create steps were executed in order, with sequential output generation and capability probing disabled. Applicable epic-level checklist items were checked: template sections, evidence-bounded risk register, score arithmetic, empty bands, canonical test levels/links, all acceptance criteria, estimates, execution strategy, constraints, entry/exit criteria and deferred approval/evidence. Optional Project Team was omitted because individual names are unknown and responsibility mapping is provided per case. System-level review, paired outputs and BMAD handoff are N/A. No exploration session was opened. No tests were generated or executed.

**Generated by:** BMad TEA Test Architect Module
**Workflow:** `bmad-testarch-test-design`, mode C, epic-9
**Workflow architecture version:** 5.0; epic template version: 4.0
