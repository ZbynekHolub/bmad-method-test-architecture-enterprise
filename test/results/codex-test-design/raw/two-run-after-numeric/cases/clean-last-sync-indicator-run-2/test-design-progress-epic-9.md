---
runScope: 'epic'
runKey: 'epic-9'
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

# Epic 9 Test Design Progress

## Step 1: Mode and prerequisites

Create mode; epic-level; full design; sequential execution; capability probe disabled.
Epic 9 requirements and acceptance criteria are available in `field-sync-indicator/docs/epics/epic-9-last-sync-indicator.md`.
This epic is the sole requirements source. Architecture, PRD, and sprint status are outside this run's inputs.
Run scope: epic. Run key: epic-9. Fresh run.
Deliverable: `field-sync-indicator/test-artifacts/test-design/test-design-epic-9.md`.

## Step 2: Context and knowledge

Config: test_artifacts resolved to field-sync-indicator/test-artifacts. Library flags and browser automation are unset; no integration branch activated. Stack setting defaults to auto. No stack manifests or runner artifacts exist; detected stack remains undetermined. Technician device context alone establishes no framework.
Inputs: sole epic source plus config; no prior system designs, implementation, tests, fixtures, or flakiness evidence found. Capability probe disabled; no target application exists for exploration.
Requirements: AC1 most recent successful sync relative time; AC2 absent field removes row and preserves home; AC3 completion event updates open screen; AC4 flag off restores previous home exactly.
Boundaries: existing settings store/key, existing completion event/progress spinner, existing organization flag.
Knowledge selection in order: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md, nfr-criteria.md. NFR branch matches explicit privacy, read-only, render-budget and rollback constraints. No Pact, package or contract relevance. No CLI branch enabled.
Coverage is planned; existing execution coverage is unverified. No requirement input is missing.

## Step 3: Risk and NFR planning

System architecture review and ASRs: outside epic-level mode.
Probability: 1 unlikely (simple established boundary), 2 possible (format/event edge), 3 likely (observed failures). Impact: 1 minor (informational UI, dispatch workaround), 2 degraded operational feature, 3 critical security/data/core workflow. Scores are P × I.

### High risk (score ≥6)

None identified from the supplied epic.

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |

### Medium risk (score 3 to 4)

None identified from the supplied epic.

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |

### Low risk (score 1 to 2)

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Wrong relative time or stale timestamp leaves technicians asking dispatch about freshness. Source: story 9.1 existing lastSuccessfulSyncAt rendered relatively; story 9.2 completion event refresh; AC1 and AC3. Formatting and event wiring introduce possible presentation errors; consequence is minor and existing sync behavior remains available. | 2 | 1 | 2 |
| R-002 | TECH | Conditional visibility leaves a row or blank gap on never-synced devices or after disabling the flag, violating prior home layout. Source: story 9.1 absent key hides row and leaves rest unchanged; AC2 and AC4 flag off restores previous home exactly. Simple guards make failure unlikely; consequence is minor UI regression with existing flag rollback. | 1 | 1 | 1 |

Mitigations planned: R-001 deterministic formatter/key/event assertions, developer owner, before epic completion. R-002 absent/flag visibility assertions and baseline visual comparison, developer and QA role owners, before release. Both remain open pending execution. Highest score is 2; no mandatory high-risk mitigation escalation.
NFR scope: privacy (same device timestamp/person, added personal fields 0), read-only data integrity (indicator writes/new fields 0), incremental resource usage (one local key lookup, added network/storage/polling/timers 0), reliability (completion refresh and existing spinner), rollback (existing organization flag restores baseline). Already-satisfied controls bound scope; they receive regression checks without new scored risks.
Numeric home render budget: UNKNOWN; compare existing baseline once available. Completion-event latency and exact relative-time rounding conventions: UNKNOWN; use deterministic event completion and existing formatter conventions. These planning details create no new exposure. Scalability, compliance and project-wide maintainability thresholds are outside the supplied epic.
Planned evidence: unit assertions for display conversion; integration UI/store/event tests and operation spies; real home visual baseline comparison; existing spinner regression. No final NFR or release gate verdict is assessed.

## Step 4: Coverage, execution and gates

Priority criteria retained: P0 critical business/security/data/compliance with no safe workaround; P1 core/frequent/complex behavior with material reach and limited workaround; P2 secondary behavior with acceptable workaround; P3 rare/cosmetic/experimental minimal-impact behavior. All eight scenarios are P2: secondary informational UI, existing dispatch workaround, bounded additive change and existing flag rollback. Usage metrics and any core-workflow consequence are unstated. Exact visual recovery when a flag guard itself fails is unverified; no stronger recovery is claimed.

| Test ID | Requirement/scenario | Test Level | Priority | Risk Link | Notes |
| --- | --- | --- | --- | --- | --- |
| 9.1-UNIT-001 | Fixed now and timestamp four minutes earlier produce correct relative text; boundary cases follow existing formatter conventions. | Unit | P2 | R-001 | Conversion only; mistaken display sends technician back to dispatch. |
| 9.1-INT-001 | Flag on: home reads current lastSuccessfulSyncAt from existing local store and binds it to one visible row. | Integration | P2 | R-001 | Verify source binding independently of formatter arithmetic. |
| 9.1-COMP-001 | Flag on and key absent: row and reserved gap absent; other home content intact. | Component | P2 | R-002 | Conditional visibility branch; cosmetic defect leaves existing home use available. |
| 9.2-INT-001 | Open home with old timestamp; existing completion updates stored timestamp then publishes event; row binds newer value and existing spinner still completes. | Integration | P2 | R-001 | Observe an old-to-new transition at actual store/event boundary. |
| 9.2-INT-002 | Open never-synced home; first successful completion makes the previously absent row appear. | Integration | P2 | R-001, R-002 | Distinct absent-to-present transition. |
| 9.1-E2E-001 | Toggle existing organization flag off with timestamp present; home matches pre-change baseline exactly. | E2E | P2 | R-002 | Real UI geometry and other controls; seeded on state before disabling. |
| 9.1-E2E-002 | Never-synced device with flag on matches pre-change home baseline exactly. | E2E | P2 | R-002 | Full-screen visual aspect complements component guard; single representative device/profile. |
| 9.2-INT-003 | Indicator operation trace at initial render and completion preserves local/read-only/event-only constraints; idle controlled clock advance schedules no indicator timer/polling. | Integration | P2 | R-001 | One key read per render; zero indicator writes, new fields, network, timers or polling. Already-satisfied constraints; no separate NFR risk. |

NFR evidence: constrained operation trace covers privacy/data/resource assertions; timestamp/event and spinner assertions cover reliability; flag-off UI baseline covers rollback. Existing numerical render budget UNKNOWN; baseline/approved existing budget required only for later numeric assessment. No new load suite or vendor is needed. Evidence reports/screenshots/profiles are future execution artifacts, not generated by this run.
PR: all eight scenarios if runtime <15 minutes; estimated 1 to 5 minutes once fixtures exist. Unit then component/integration then representative E2E visuals. Nightly and weekly: no additional epic suite justified; use existing product regression if available, without asserting it exists.
Estimates: P0/P1/P3 0 hours; P2 4 to 8 hours; shared fixture/baseline setup 1 to 2 hours; total 5 to 10 hours (roughly 1 to 2 working days). Eight logical scenarios: Unit 1, Component 1, Integration 4, E2E 2; parameter variants do not increase logical counts.
Gates: P0 100% and P1 ≥95% if introduced (currently N/A); planned AC coverage 4/4, target 100% for this small epic exceeds general ≥80%; all eight selected P2 checks pass before epic acceptance; high-risk mitigation complete if new risk appears; explicit NFR evidence collected for scoped controls. Execution gate and final NFR statuses unassessed.
Dependencies: future runnable app/harness, deterministic local store/key seeding, completion event path, controlled clock, local flag overrides, same-profile pre-change home baseline. No architecture/PRD/sprint input blocker. No tests are generated.

## Step 5: Output and validation

Explicit sequential execution selected; capability probe false; no delegation or probing.
Generated one epic-level deliverable from skill/test-design-template.md: field-sync-indicator/test-artifacts/test-design/test-design-epic-9.md.
Checklist applied in full for epic scope. Validated canonical categories, integer scores and products, 2 unique risk IDs, all 8 coverage links and levels, 4/4 acceptance criteria, empty bands, scoped NFR evidence, range estimates, gates, entry/exit criteria, exclusions and interworking.
E2E visual assertions follow the loaded level framework; generic runner-specific and system-only checklist items are N/A. Unknown thresholds recorded as assumptions. Approval and execution evidence remain pending; no final NFR verdict. No CLI session or exploration artifacts exist. Documentation hashes unchanged; no tests generated. Highest risk score 2; P0/P1 empty; all eight selected P2 checks required for epic acceptance.
Workflow complete on 2026-10-13. Completion report uses the user-requested single output-path line.
