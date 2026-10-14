---
runScope: 'epic'
runKey: 'epic-9'
mode: 'epic-level'
designLevel: 'full'
executionMode: 'sequential'
capabilityProbe: false
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-13'
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

**Scope:** Full epic-level test design for Epic 9, stories 9.1 and 9.2. The sole requirements source is [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md).

The indicator reads `lastSuccessfulSyncAt` from the existing local settings store, renders relative time, and refreshes through the existing sync completion event. An absent field hides the row. The existing `home_last_sync_row` flag restores the previous home screen when disabled.

**Risk Summary:**

- Total risks identified: 2; both low scoring.
- High-priority risks (score ≥6): 0. Medium risks (score 3 to 4): 0.
- Categories identified: BUS and TECH. Highest score: 2.
- The epic's already-satisfied privacy, read-only, resource and rollout controls constrain this plan's scope.

**Coverage Summary:**

- P0 scenarios: 0; effort N/A.
- P1 scenarios: 0; effort N/A.
- P2 scenarios: 8; approximately 4 to 8 hours.
- P3 scenarios: 0; effort N/A.
- Shared fixture and baseline preparation: approximately 1 to 2 hours.
- **Total effort:** approximately 5 to 10 hours; approximately 1 to 2 working days, within a working week once prerequisites are ready.

These are eight logical scenarios: 1 Unit, 1 Component, 4 Integration and 2 E2E. Parameter variants remain within their named scenario. All four acceptance criteria have planned coverage. Implementation coverage and test results are unverified: this project contains the epic and configuration, with no application, test suite, runner manifests or prior system test designs.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Sync algorithm, transport, retries and remote services | Epic 9 consumes an existing timestamp and event; engine changes are outside the epic. | Preserve the existing spinner interaction and run available engine regression tests when implementation is accessible. |
| Authentication, authorization and personal-data collection | The epic explicitly shows the device's own timestamp to its holder and adds no personal data. | Assert the added row contains only the relative sync information; retain existing product security coverage. |
| Orders, queue mutations and settings migrations | The epic explicitly writes nothing and adds no stored field. | Check indicator operation traces for zero writes and zero new fields. Existing mutation coverage remains with those features. |
| Network load, service scaling and new infrastructure | A single local key lookup adds zero network calls, storage, polling or timers. | Assert those operation constraints; use the existing home render baseline if numeric performance validation is needed. |
| New flag service or rollout platform | `home_last_sync_row` already has organization targeting and release toggles. | Override the existing flag deterministically in tests and validate flag-off home restoration. |
| Broad device matrix, malformed timestamp policy and new time-format rules | The epic supplies no platform matrix, corrupt-value behavior or rounding specification. | Use one representative existing profile and the established formatter conventions; record unresolved conventions below. |
| Test implementation and requirements-document edits | This run produces a test plan. | Follow-on automation requires a separate explicit invocation. |

## Risk Assessment

Probability: **1** unlikely with simple established boundaries; **2** possible with conversion or event-wiring edges; **3** likely with documented faults or substantial uncertainty. Impact: **1** minor informational or layout defect with essential operations preserved; **2** degraded operational capability; **3** critical core workflow, data, security or regulatory exposure. Score = Probability × Impact.

The judgments below use the supplied epic. There is no defect history or implementation evidence. Formatting errors and missed refreshes share the display-freshness consequence and mitigation. Absent-value and disabled-flag cases share conditional-visibility coverage. The source-backed dispatch workaround resolves the technician's freshness question. No source establishes financial loss, blocked work or critical exposure from this row.

### High-Priority Risks (Score ≥6)

No high-priority risks identified in the supplied scope.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Medium-Priority Risks (Score 3 to 4)

No medium-priority risks identified in the supplied scope.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1 to 2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Incorrect relative time or stale display leaves technicians asking dispatch about freshness. Story 9.1 requires the existing `lastSuccessfulSyncAt` value as relative time; story 9.2 requires completion-event refresh; AC1 and AC3 require the latest success. Conversion and event binding make a display fault possible. Impact is minor: this informational row leaves sync and the documented radio workaround available. | 2 | 1 | 2 | Document; developer validates conversion, local value binding and completion transitions before epic completion. |
| R-002 | TECH | Conditional visibility leaves a row or blank gap on a never-synced device or after flag disable, violating the previous home layout. Story 9.1 explicitly omits the absent-value row; AC2 and AC4 require unchanged home and exact flag-off restoration. Simple visibility guards make a defect unlikely. Impact is a minor UI regression in one additive row. | 1 | 1 | 1 | Document; developer checks guards, QA checks full-screen baselines before release. |

### Risk Category Legend

- **TECH:** Technical or architecture integration faults.
- **SEC:** Security exposure.
- **PERF:** Performance or resource degradation.
- **DATA:** Data integrity loss or corruption.
- **BUS:** Business logic or user-experience harm.
- **OPS:** Deployment, configuration or operations faults.

The already-satisfied controls establish the absence of new SEC, DATA, PERF and OPS exposures in this epic. Coverage verifies these controls. Both registered risks remain open pending implementation and execution; planned checks provide no measured residual-risk reduction yet.

## NFR Planning

This section defines future validation evidence for the epic's explicit constraints. Final NFR status is deferred to `nfr-assess` after implementation evidence exists.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security / privacy | Device-local timestamp shown to its holder; added personal data: 0. | N/A: already-satisfied scope constraint | Inspect rendered row in 9.1-INT-001 and operation boundaries in 9.2-INT-003. | Rendered-content assertion and indicator operation report. |
| Data integrity | Indicator writes: 0; new stored fields: 0; existing store read-only for this key. | N/A: already-satisfied scope constraint | 9.2-INT-003 captures indicator-attributable operations while engine-owned timestamp updates remain distinct. | Store access trace and unchanged indicator-owned storage snapshot. |
| Performance / resource use | One local key lookup per indicator render on the already-open store; added network calls, storage, polling and timers: 0; existing render budget unchanged. | N/A: already-satisfied scope constraint | 9.2-INT-003 verifies operation counts and idle behavior with controlled clock. Compare existing home render baseline if numeric budget evidence is available. | Operation report; existing baseline/profile for later numeric assessment. |
| Reliability | Open-screen value updates on existing completion event; existing spinner continues to complete; no periodic refresh added. | R-001 | 9.2-INT-001 and 9.2-INT-002 establish successful state transitions; 9.2-INT-003 verifies event-only resource use. | Event/store/render assertion report, spinner regression result. |
| Operations / rollback | Existing organization flag off restores previous home exactly without a new build. | R-002 | 9.1-E2E-001 compares flag-off home against the pre-change baseline. | Same-profile screenshot comparison and visible-control assertions. |
| Scalability, compliance, project-wide maintainability | N/A: no additional requirement in this epic. | N/A | Preserve existing product checks where available. | No additional epic-specific evidence required. |

**Unknown thresholds:** Numeric existing render budget, completion-to-display latency, and exact relative-time rounding/locale conventions are **UNKNOWN** in the supplied source. Resolve the existing budget and formatter conventions from implementation before numeric or boundary claims; do not introduce new values. Event tests await the defined completion/render boundary without a guessed latency SLA. These are planning assumptions, with no source-backed new exposure requiring a scored risk. Evidence sources are planned; no evidence was collected in this run.

## Entry Criteria

- [ ] Epic implementation and a runnable home-screen test environment are available.
- [ ] Existing store can be seeded with a valid timestamp or an absent key; each test restores its state.
- [ ] Controlled clock and the real completion-event publication path are accessible.
- [ ] Existing organization flag can be overridden locally for deterministic enabled and disabled states.
- [ ] A pre-change home baseline exists for the same profile, viewport, clock and other screen data.
- [ ] QA and development agree on existing relative-time conventions and any numeric render baseline used.

The supplied epic satisfies requirements prerequisites. Execution depends on the future application and harness. PRD, architecture and sprint status are outside this run's required inputs.

## Exit Criteria

- [ ] All eight selected P2 scenarios pass; all four acceptance criteria have execution evidence.
- [ ] Existing home controls and progress-spinner regressions pass where those suites are available.
- [ ] No open high-severity bug, new critical exposure or unmitigated high risk remains.
- [ ] Evidence demonstrates the epic's read-only, local-only, event-driven and rollback constraints.
- [ ] Visual comparisons establish exact baseline restoration in absent-value and flag-off states.
- [ ] Any remaining unknown numeric NFR threshold is recorded for later `nfr-assess`.

## Test Coverage Plan

P0, P1, P2 and P3 express priority. Execution timing is defined in Execution Strategy. Priorities follow business consequence, reach and recoverability; risk scores support the judgment.

All primary scenarios are P2. The indicator is a secondary informational feature for technicians using the flagged home screen. The source documents a dispatch workaround for freshness questions and an existing flag control for rollout. A cosmetic row defect preserves essential home use. Exact visual recovery after a faulty flag guard is unverified until tested; this plan claims no additional rollback mechanism. The epic gives no usage metrics or material core-workflow consequence that would elevate these scenarios to P1 or P0.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity or compliance impact with no safe workaround. Risk score is supporting evidence and is not a required condition.

No P0 scenarios: the supplied epic establishes zero new critical exposures or blocked essential operations.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P0:** 0 tests; effort N/A.

### P1 (High)

**Criteria:** Core, frequent or complex behavior with material user reach and a limited workaround. Risk score is supporting evidence and is not a required condition.

No P1 scenarios: the epic supplies a bounded informational addition and a dispatch workaround; frequency and material core impact are unstated.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P1:** 0 tests; effort N/A.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score is supporting evidence and is not a required condition.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 9.1-UNIT-001: AC1, relative-time conversion | Unit | R-001 | 1 | Developer | Fixed now and timestamp four minutes earlier yield the relative value represented by “synced 4 minutes ago.” Include boundaries according to existing formatter conventions once confirmed. Pure conversion assertions isolate arithmetic. Wrong text returns the freshness question to dispatch, the source-backed workaround. |
| 9.1-INT-001: AC1, latest stored success reaches the row | Integration | R-001 | 1 | Developer | Flag on; seed the existing key with the latest successful completion time and mount home using its store adapter. Assert one visible row binds that value. This verifies store-to-screen wiring; formatter arithmetic is covered above. Added row content contains only relative sync information. |
| 9.1-COMP-001: AC2, missing key omits the row | Component | R-002 | 1 | Developer | Flag on; absent field yields no row or reserved gap; existing home content is intact. Covers conditional render behavior. A row-layout fault leaves essential home use available; exact full-screen geometry is checked separately below. |
| 9.2-INT-001: AC3, later completion refreshes open home | Integration | R-001 | 1 | Developer | Start with an older visible value. Exercise the existing completion path updating the key and publishing the event. Assert the newer value is rendered and the existing spinner completes. Distinct before/after values prove refresh. Dispatch remains the documented workaround if freshness display fails. |
| 9.2-INT-002: AC2 and AC3, first success reveals the row | Integration | R-001, R-002 | 1 | Developer | Start with absent key and row. Exercise first successful completion through the existing store/event boundary; row appears with that success. Covers the absent-to-present transition, distinct from replacing an existing row value. |
| 9.1-E2E-001: AC4, flag-off home restoration | E2E | R-002 | 1 | QA | On the representative existing device/profile, begin flag on with a timestamp and visible row, disable the existing organization flag through its established release mechanism, then render home as that mechanism requires. Assert row absent, full-screen geometry and other controls equal the pre-change baseline. E2E establishes actual visual restoration. Flag propagation timing is unspecified. |
| 9.1-E2E-002: AC2, never-synced full-screen baseline | E2E | R-002 | 1 | QA | Flag on and key absent. Compare home with the same-profile pre-change baseline; assert other controls remain visible and usable. Complements component conditional rendering with actual screen geometry. Restrict to one representative supported profile. |
| 9.2-INT-003: stories 9.1 and 9.2, constrained operation trace | Integration | R-001 | 1 | Developer | Trace indicator initial render and event refresh: one lookup of the existing key per render on the existing store; zero indicator writes, new fields, network calls, timers or polling. Advance controlled time during idle to verify periodic work remains absent. Distinguish engine-owned timestamp writes from indicator operations. This regression assertion preserves source-stated controls; its risk link is event-driven display freshness. |

**Total P2:** 8 logical tests; approximately 4 to 8 hours. Cases and variants should reuse existing fixtures. No framework or vendor is selected without repository evidence.

### P3 (Low)

**Criteria:** Rare, cosmetic or experimental behavior with minimal impact and an easy workaround. Risk score is supporting evidence and is not a required condition.

No P3 scenarios are added. Visual restoration is an explicit acceptance requirement covered by P2 baseline checks; the plan includes no unrelated polish or speculative rare states.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** 0 tests; effort N/A.

**Acceptance traceability:** AC1 maps to 9.1-UNIT-001 and 9.1-INT-001; AC2 to 9.1-COMP-001, 9.1-E2E-002 and the transition in 9.2-INT-002; AC3 to 9.2-INT-001 and 9.2-INT-002; AC4 to 9.1-E2E-001. Shared risk links preserve distinct conversion, binding, transition and visual assertions. No API test is needed for a local-only addition.

## Execution Strategy

Run every functional scenario in pull requests while the suite stays below 15 minutes. Priority remains independent of execution timing.

- **Pull request:** Run Unit, Component and Integration checks first, followed by the two representative E2E baseline checks. Expected execution envelope is approximately 1 to 5 minutes once the harness exists; measure actual duration before adopting it. This workflow executes sequentially. The eventual runner may parallelize isolated fixtures if supported; Playwright applicability is unverified.
- **Nightly:** No additional long-running suite is justified by Epic 9. Preserve existing product regression scheduling when available.
- **Weekly:** No new load, chaos or broad device suite is justified. Existing product-wide schedules remain outside this plan.

Avoid wall-clock sleeps, live flag evaluation dependencies and live network setup for this local-only feature. Fix the clock and all baseline data, synchronize on observable events/renders, and reset store, flag and subscriptions between scenarios.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 0 | N/A | N/A | Empty band. |
| P1 | 0 | N/A | N/A | Empty band. |
| P2 | 8 | Approximately 0.5 to 1 | Approximately 4 to 8 | Reusable local fixtures and two visual checks. |
| P3 | 0 | N/A | N/A | Empty band. |
| Shared setup | N/A | N/A | Approximately 1 to 2 | Existing harness adaptation, local clock/store/event fixtures and baseline capture. |
| **Total** | **8** | **N/A** | **Approximately 5 to 10** | **Approximately 1 to 2 working days; within a working week after entry readiness.** |

Estimates assume an existing application harness becomes available. Building a new product test framework is outside this epic estimate; re-estimate if that dependency changes.

### Prerequisites

**Test Data:** Valid fixed timestamps; an absent-key fixture; distinct old and new successful times; deterministic flag states and unchanged other home fields. Reset every fixture after use.

**Tooling:** Existing project Unit/Component/Integration runner and UI capture capability, once identified. No stack manifest or installed test-library evidence is available. Library flags and browser automation are unset; capability probing is disabled. No Pact or contract-testing branch applies.

**Environment:** Runnable application, representative existing device/profile, controllable clock, real local-store adapter, existing completion-event path and locally controlled flag. Baseline and candidate must share viewport, locale, font state and other visible data. No browser session was opened during planning.

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% if a P0 scenario is introduced; currently N/A, zero scenarios.
- **P1 pass rate:** ≥95%, with approved waivers for failures if introduced; currently N/A, zero scenarios.
- **P2 pass rate:** 100% for this small selected suite: all eight scenarios support explicit requirements or constraints.
- **P3 pass rate:** ≥90% if introduced; currently N/A, zero scenarios.
- **High-risk mitigations:** 100% complete or formally waived if a new score ≥6 risk appears; currently zero.

### Coverage Targets

- Acceptance-criterion design coverage: **100%**, four of four criteria mapped; execution target is also four of four.
- Registered risk coverage: **100%**, two of two risks mapped to suitable levels.
- Selected documented boundary scenarios: **100%**, present, absent, updated, first success and flag-off.
- General ≥80% coverage baseline is exceeded by this bounded plan. Code-coverage percentage is unmeasured and creates no new requirement here.
- New critical security paths: N/A. Privacy scope and zero-write/resource invariants require evidence as mapped in NFR Planning.

### Non-Negotiable Requirements

- [ ] Every selected acceptance and constraint check passes without committed skips or flaky rerun-only acceptance.
- [ ] No open high-severity defect or unmitigated score ≥6 risk.
- [ ] Existing home content, spinner behavior and exact baseline states are preserved.
- [ ] Planned evidence exists for each in-scope NFR control; unknown numeric thresholds remain explicit.
- [ ] Final NFR and release decisions are made from implementation evidence in subsequent workflows.

No execution gate or NFR verdict is issued by this planning run.

## Mitigation Plans

### R-001: Incorrect or stale relative-time display (Score: 2)

**Mitigation Strategy:** Fix time in fixtures; verify conversion and local-store binding independently; exercise existing completion transitions for both an existing timestamp and a first success. Preserve spinner completion and event-only behavior.  
**Owner:** Developer; QA confirms execution evidence.  
**Timeline:** Before Epic 9 completion.  
**Status:** Planned.  
**Verification:** Passing Unit and Integration results named in the coverage matrix. Residual risk remains unmeasured pending those results; documented dispatch fallback remains available.

### R-002: Conditional row visibility changes the home layout (Score: 1)

**Mitigation Strategy:** Exercise absent-key rendering and use same-profile pre-change baselines for never-synced and disabled-flag home states. Verify other controls alongside image geometry.  
**Owner:** Developer for guards; QA for full-screen comparison.  
**Timeline:** Before release enables the row.  
**Status:** Planned.  
**Verification:** Passing Component/transition assertions and E2E visual reports named in the coverage matrix. Exact restoration remains unverified until execution.

## Assumptions and Dependencies

### Assumptions

1. Existing formatter conventions can supply rounding, locale and valid timestamp interpretation. These details are UNKNOWN in the epic; tests reuse confirmed conventions.
2. Event refresh uses the existing successful-completion publication path. Store/event ordering must be observed in the implementation; no latency SLA is invented.
3. Existing home render budget and visual baselines can be retrieved. Numeric budget is UNKNOWN; zero-added-operation constraints are explicit.
4. A representative profile and local flag override can be chosen from the actual application harness. The platform and runner remain undetermined.

### Dependencies

1. Runnable feature and existing harness: required before test implementation and execution; developer role owns readiness.
2. Local store seeding, controlled time, existing event path and flag overrides: required before deterministic coverage; developer role owns fixture integration.
3. Same-profile pre-change home baseline: required before visual acceptance; QA role owns capture and comparison.

### Risks to Plan

Application and harness availability can delay execution and widen estimates. Re-estimate fixture effort after access is available. Unknown formatting and numeric budgets constrain later measurement; record them as unresolved details without adding new feature behavior or speculative scored risks. No supplied document or test failure establishes flakiness.

## Follow-on Workflows (Manual)

Run `bmad-testarch-automate` separately once implementation and entry prerequisites exist. There are no P0 cases for a P0-only red run. Use this coverage plan for scoped automation; run `nfr-assess` when evidence exists. This run generates no tests.

## Approval

**Test Design Approved By:** Pending team review; no approval or review appointment is recorded.

- [ ] Product owner: pending assignment; scope and acceptance criteria.
- [ ] Technical lead: pending assignment; fixtures and regression boundaries.
- [ ] QA reviewer: pending assignment; visual evidence and coverage sufficiency.

**Comments:** Role labels are responsibility placeholders; personal names are unavailable.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Technician home screen | Adds conditional relative-time row. | Preserve existing home controls, layout and content in absent and disabled states; compare actual baselines. |
| Local settings store | Existing key is read through already-open store. | Available settings-reader regressions; indicator-attributable zero writes/new fields and correct key binding. |
| Sync completion publisher and progress spinner | Shares an existing event. | Available spinner completion/subscription regressions; new row observes successful completion with existing consumers still functioning. |
| Existing organization feature flag | Gates visibility and supports restoration. | Available organization-targeting and release-toggle regressions; flag-off exact home restoration. |

Existing suite names are unavailable. Development and QA coordinate within these existing component boundaries; no new external-team dependency is established by the epic.

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: scope, scoring and ownership.
- `bmod-tea/knowledge/probability-impact.md`: probability and impact scales.
- `bmod-tea/knowledge/test-levels-framework.md`: conversion, boundary and visual level selection.
- `bmod-tea/knowledge/test-priorities-matrix.md`: separate business-impact priority judgment.
- `bmod-tea/knowledge/nfr-criteria.md`: future evidence planning for explicit constraints.

### Related Documents

- Epic: [Epic 9](../../docs/epics/epic-9-last-sync-indicator.md), sole requirements source; story text and acceptance criteria are embedded.
- Config: [TEA configuration](../../_bmad/config.toml).
- PRD, architecture, tech spec, sprint status: N/A for this run.

### Workflow Validation

Create steps 1 through 5 executed in order with sequential orchestration and capability probing disabled. The checklist was applied to epic-level scope: risk IDs, integer scores, source evidence, coverage levels/links, counts, priorities, NFR evidence plans, estimates, gates, exclusions and regressions were checked. Empty bands retain table schemas and absence statements.

System-level documents, handoff, browser exploration and sprint integration are N/A. E2E is limited to the epic's exact full-screen visual acceptance, consistent with the loaded test-level framework's visual-regression guidance. Runner-specific parallelization and critical-business E2E examples in the generic checklist establish no new epic requirement. Team approval and future execution remain pending. Requirements inputs were preserved.

**Generated by:** BMad TEA Test Architect workflow  
**Workflow:** `bmad-testarch-test-design`  
**Template:** `skill/test-design-template.md`
