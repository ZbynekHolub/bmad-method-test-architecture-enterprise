---
runScope: 'epic'
runKey: 'epic-7'
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
completedAt: '2026-10-14T00:49:19Z'
inputDocuments:
  - 'field-order-capture/_bmad/config.toml'
  - 'field-order-capture/docs/epics/epic-7-offline-order-capture.md'
  - 'skill/test-design-template.md'
  - 'skill/checklist.md'
  - 'bmod-tea/knowledge/tea-index.csv'
  - 'bmod-tea/knowledge/risk-governance.md'
  - 'bmod-tea/knowledge/probability-impact.md'
  - 'bmod-tea/knowledge/test-levels-framework.md'
  - 'bmod-tea/knowledge/test-priorities-matrix.md'
  - 'bmod-tea/knowledge/nfr-criteria.md'
---

# Test Design: Epic 7: Offline order capture for field technicians

**Date:** 2026-10-13
**Author:** tea-eval-harness
**Status:** Draft; workflow complete, stakeholder approval pending

## Executive Summary

**Scope:** Full epic-level design for stories 7.1 through 7.4. The sole requirements source is the supplied epic. The technician client is native Android with a SQLite outbound queue; uploads reach the existing order server and dispatcher console.

**Risk Summary:** Five identified risks, all high-priority (score ≥6), across SEC, DATA, PERF, TECH and OPS. R-002 (silent edit loss) and R-004 (unbounded retry) score 9 and require mitigation before release. All five risks remain OPEN at planning time.

**Coverage Summary:**

- P0: 10 scenarios, approximately 30 to 50 hours.
- P1: 10 scenarios, approximately 24 to 40 hours.
- P2/P3: zero scenarios and zero planned effort.
- Shared setup: approximately 12 to 20 hours.
- Total: 20 scenarios, approximately 66 to 110 engineering hours; approximately 2 to 3 calendar weeks with role participation and prerequisites ready.

The plan supplies proposed safety mitigations and future validation. This run has no implementation, runtime, existing test suite or measurement evidence. It generates no tests. Final NFR assessment follows evidence collection.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Offline capture of entities other than work orders | Explicit epic exclusion. | Keep those existing online workflows in their owning regression suite. |
| Dispatcher console implementation or redesign | Explicit epic exclusion; AC4 requires unchanged order observation. | Read-only dispatcher readback in 7.3-E2E-001 verifies the existing display. |
| Card charging and nightly billing changes | Epic explicitly makes no billing call and changes no charging schedule. | 7.3-API-004 checks absence of new billing side effects; existing billing-service tests remain owned by that service. |
| Android screen rendering redesign, browser and web-view client flows | Epic specifies native Android with unchanged rendering and no web view. | Native status-state component regression; dispatcher browser observation is confined to AC4. |
| Shared multi-tenant storage design | Each installation already has separate database and servers with no shared storage. | Bounded installation-isolation regression in 7.3-API-002. |
| Regional routing or data-residency policy redesign | Epic explicitly preserves the platform regional routing layer. | Existing regional-route regression in 7.3-API-003; policy enforcement remains with Platform. |
| PRD, architecture and sprint-status artifacts | User defines the epic as the complete requirements set for this run. | Record unknown implementation details as dependencies in this plan. |

## Risk Assessment

Probability: 1 unlikely; 2 possible; 3 likely, a known defective path or high implementation uncertainty. Impact: 1 minor; 2 degraded service with recoverable work; 3 critical exposure, irreversible data loss or disruption to essential operation. Score equals Probability × Impact. Categories and scores describe remediation; scenario priority also considers business consequence, reach and available recovery.

For remediation: scores 1 to 3 require documentation, 4 requires monitoring, 6 to 8 require mitigation, and 9 blocks planned release while OPEN. Template risk bands use high ≥6, medium 3 to 4 and low 1 to 2. Re-score only after verified controls change exposure; adding a planned test does not reduce a risk.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1 explicitly persists the full order, stored card reference and billing address in an unencrypted SQLite file with only a screen lock. An extracted queue exposes customer and billing data. Plaintext persistence is certain; extraction likelihood is possible, so probability is 2. | 2 | 3 | 6 | Propose payload minimization and protected at-rest storage with device key protection; inspect queue and journal artifacts with synthetic sentinels. | Android lead and Security | Agree protection before implementation; verify before release. |
| R-002 | DATA | Story 7.2 permits two technicians offline on one order, appends edits and applies arrival order with no version or timestamp check. Reconnect ordering silently overwrites earlier lines with no audit record; this is a known destructive path. | 3 | 3 | 9 | Propose version-aware conflict handling and retained revisions; force both arrival orders and same-device revision reordering, proving no silent loss. | API lead and Android lead | Set conflict policy before implementation; verify before release. |
| R-003 | PERF | Story 7.3 requires 2,000 queued items to sync within 30 seconds on fleet mid-range devices. The large backlog, mid-range hardware and unmeasured device/network/server pipeline give high uncertainty (probability 3). Missing the deadline degrades timely dispatch while orders remain recoverable in the queue (impact 2); its business deadline consequence is unstated. | 3 | 2 | 6 | Profile complete device-to-server draining; consider batching and bounded concurrency with ordering guarantees; require all 2,000 acknowledgements within 30 seconds. | Android lead and API performance owner | Baseline first integrated build; pass target before release. |
| R-004 | TECH | Story 7.3 retries failed uploads immediately and indefinitely with no backoff, cap or dead-letter path. A permanently rejected item drives an endless request loop, consumes device/network/server resources and may obstruct valid items. | 3 | 3 | 9 | Propose classified failures, bounded retry with backoff and recoverable quarantine; measure permanent/transient failure requests and healthy-item progress. | Android sync lead and API lead | Define policy before implementation; fault-injection proof before release. |
| R-005 | OPS | Story 7.4 enables the feature for all technicians at once; disabling requires a new store build with a one-to-three-day delay. A defect can disrupt the entire installation for days. A triggering defect is possible, so probability is 2. | 2 | 3 | 6 | Propose a tested disable/containment path or staged enablement; rehearse recovery preserving captured orders and document store-delay exposure. | Release owner and Operations | Resolve containment before release approval; rehearse on release candidate. |

### Medium-Priority Risks (Score 3-4)

No identified risks in this band.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1-2)

No identified risks in this band.

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |

### Risk Category Legend

- **TECH:** Technical or integration flaws and resource behavior.
- **SEC:** Security and data exposure.
- **PERF:** Performance targets and capacity.
- **DATA:** Data loss, corruption or inconsistency.
- **BUS:** Business logic, user experience or revenue consequences.
- **OPS:** Deployment, recovery and monitoring.

Source references in the register name headings in [Epic 7](../../docs/epics/epic-7-offline-order-capture.md). Satisfied isolation, regional routing, billing and rendering constraints remain regression boundaries. No new scored risks are inferred for those controls. BUS has no distinct supported failure mechanism beyond the five registered risks.

## NFR Planning

This section plans evidence for later `nfr-assess`. Implementation measurement and final NFR status are pending.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security | Full customer payload is currently plaintext. Required storage protection/minimization policy is UNKNOWN. | R-001 | Integration inspection of synthetic queue and journal sentinels; protected-storage control validation after remediation. | Sanitized extraction report, readable-field findings and agreed protection policy. |
| Performance / bounded scalability | Exactly 2,000 queued items accepted within ≤30 seconds of usable connectivity on mid-range fleet devices. Fleet concurrency is UNKNOWN. | R-003 | Native-device E2E backlog drain plus API ingestion profiling. | Monotonic device timings, acceptance receipts, reconciled counts, device/OS/network and payload manifests. |
| Reliability / data integrity | Editable until server acceptance; automatic upload; unchanged final order at dispatcher. Conflict, replay and retry policies are UNKNOWN. | R-002, R-004 | API concurrency, SQLite/upload integration faults, isolated retry-policy branches and native E2E readback. | Revision/queue snapshots, conflict records, request counts, retry timing, server receipts and readback comparison. |
| Operational recoverability | All technicians enabled together; only stated disable path is new store build taking one to three days. Recovery objective is UNKNOWN. | R-005 | E2E recovery rehearsal and integration validation of proposed telemetry. | Recovery timeline, build/install records, order-preservation report and sanitized detection signals. |
| Maintainability of the changed queue/sync path | Existing coverage, code-quality thresholds and CI framework are UNKNOWN. | R-002, R-004 | Future CI reports for test isolation, failures, coverage and policy-branch diagnostics. | Test manifests and CI execution/coverage reports once source exists. |

**Unknown thresholds:** At-rest protection policy and key lifecycle; conflict resolution/audit semantics; retry spacing, caps, quarantine and resume rules; recovery objective; actual fleet models and supported Android versions; payload distribution; usable-network profile; reconnect concurrency; telemetry latency; code-quality targets. Role owners must record decisions before the affected validation starts. Compliance applicability is UNKNOWN. This plan makes no jurisdiction or card-data compliance claim. Scalability validation is bounded by the stated 2,000-item backlog until fleet size is supplied.

The performance budget is an explicit release criterion. The source supplies no critical business deadline, permanent loss or bounded time-to-dispatch consequence for a missed 30-second target. Pending uploads remain recoverable when accepted; R-003 carries impact 2 and P1 coverage. Further business consequences are a clarification item.

## Entry Criteria

- [ ] QA, Android, API and Product agree the supplied acceptance criteria and the derived safety oracles.
- [ ] Storage protection, conflict/revision policy, bounded retry/recovery policy and release containment decisions are recorded. They are proposed mitigations requiring implementation work.
- [ ] Native Android build, a release-like isolated installation, server receipts/state inspection and dispatcher access are available.
- [ ] Representative physical fleet devices and Android/network/payload profiles are recorded; an emulator can support functional coverage.
- [ ] Synthetic assigned orders, parts/labour, customer sentinels, two technician identities and exact 2,000-item queue fixtures are seedable and removable.
- [ ] Network disconnect, permanent rejection, transient failure, response loss and acceptance-hold controls are available without customer data.
- [ ] Queue/revision inspection and monotonic timing seams exist; Operations defines telemetry and recovery evidence access.

## Exit Criteria

- [ ] All P0 tests pass; P1 pass rate is at least 95%, with every failure triaged and any exception explicitly approved.
- [ ] All four acceptance criteria and the full 2,000-item/30-second threshold are verified against the release candidate.
- [ ] All five high-risk mitigations are complete and verified; no OPEN score-9 risk or high-severity bug remains.
- [ ] Planned scenario coverage is complete and every material risk has evidence from a suitable level.
- [ ] Security, data integrity, retry safety and recovery evidence meet the agreed policies; queue preservation is proven through recovery.
- [ ] Required regressions pass and NFR evidence is retained for later `nfr-assess`.

## Project Team

Named owners are unavailable. Role ownership is required to resolve the recorded dependencies.

| Name | Role | Testing Responsibilities |
| --- | --- | --- |
| Unassigned | QA lead | Native journeys, device matrix, evidence assembly and release validation. |
| Unassigned | Android lead | SQLite/queue boundaries, native state, retry policy and device timing. |
| Unassigned | API lead | Ingestion persistence, concurrent edits, replay and dispatcher readback. |
| Unassigned | Security owner | Storage protection policy and extraction verification. |
| Unassigned | Architect / technical lead | Conflict, ordering, replay and containment design decisions. |
| Unassigned | Product manager | Resolve business consequences and approve safety/acceptance decisions. |
| Unassigned | Release / Operations / Platform owners | Recovery rehearsal, telemetry, installation and regional-routing regressions. |

## Test Coverage Plan

P0/P1/P2/P3 express scenario priority. Execution timing is specified in Execution Strategy. Each row is one logical scenario; listed arrival orders, fault positions and device profiles are parameter variants. Tests at different levels address separate boundaries: policy logic, persistence, server behavior, UI state and complete native journeys.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity or compliance impact with no safe workaround. Risk score supports the decision separately.

**Purpose:** Prevent sensitive-data exposure, lost captured work, uncontrolled retry resource exhaustion and installation-wide disruption with delayed recovery. The epic supplies no recovery for silent lost revisions, extracted data or a permanently rejected payload. Its store-replacement path takes one to three days.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-INT-001 | Story 7.1: save synthetic card-reference/address sentinels; inspect queue database, WAL/journal and extracted file for readable sensitive values. Require the agreed storage protection policy. | Integration | R-001 | 1 | Android/Security | Security-critical exposure; screen lock is the sole supplied control and provides no source-backed recovery after extraction. Current plaintext design exposes the sentinels. |
| 7.2-API-001 | Story 7.2: two assigned technicians submit distinct offline lines for one work order in each arrival order. Require both contributions preserved or a recorded, recoverable conflict under the agreed policy. | API | R-002 | 1 | API lead | Silent irreversible loss has no audit or recovery in the epic. Current arrival-order overwrite fails the safety oracle. Direct API control establishes server persistence/conflict behavior. |
| 7.2-INT-001 | Story 7.2: append several edits from one client; deliver earlier revision after the latest. Require monotonic revision handling or recorded conflict, retaining the intended final lines. | Integration | R-002 | 1 | Android lead | Revision queue and uploader ordering boundary; mitigation policy prerequisite. |
| 7.1-INT-002 | Story 7.1: commit an offline save in real SQLite, terminate/reopen the app before upload, and compare every retained payload field with the saved fixture. | Integration | R-002 | 1 | Android lead | Persistence supports the capture-to-edit integrity path; crash survival is a derived queue boundary check. |
| 7.2-INT-002 | AC2: hold server acceptance while an edit appends; release acceptance of the earlier entry. Require the unaccepted edit remains durable and eligible for upload. | Integration | R-002 | 1 | Android lead | Detects lost-edit race at acknowledgement/dequeue boundary. |
| 7.3-INT-001 | Story 7.3: place a permanently rejected payload ahead of a valid one. Count requests and prove the invalid payload becomes recoverable under the agreed policy while the valid item reaches the server. | Integration | R-004 | 1 | Android sync lead | Known infinite immediate retries consume resources; stopping the app leaves orders pending and supplies no recovery. Backoff, cap and quarantine are proposed mitigations. |
| 7.3-INT-002 | Story 7.3: commit at the server then drop the acknowledgement; retry and reconcile queue with server state. Require retained order integrity and no repeated destructive revision application. | Integration | R-002, R-004 | 1 | Android/API | Fault at upload/acceptance boundary exercises proposed safe replay behavior; evidence includes commit receipts and queue entries. |
| 7.3-UNIT-001 | Story 7.3 mitigation: classify permanent versus transient failures and exercise retry schedule, exhaustion and resume states with a controlled clock against the agreed limits. | Unit | R-004 | 1 | Android sync lead | Tests isolated policy branches; actual request-loop behavior belongs to integration coverage. Retry values UNKNOWN until policy agreed. |
| 7.1-E2E-001 | AC1: open an existing assigned order on native Android, disconnect, add parts/labour and save. Assert order is listed as captured and reopen it to compare saved lines. | E2E | R-002 | 1 | QA/Android | Missing or altered capture loses essential field work. Paper/re-keying is the described current process; it cannot recover silent queued-line loss. Native device journey. |
| 7.4-E2E-001 | Story 7.4: rehearse a faulty release and the proposed containment/replacement path on a release-like installation. Preserve queued orders through recovery and record time until technicians can capture and sync safely. | E2E | R-005 | 1 | Release/Operations | Universal exposure plus one-to-three-day store disable path leaves essential operation unresolved. End-to-end deployment/device/server rehearsal is suitable for recoverability. Containment mechanism and target UNKNOWN. |

**Total P0:** 10 scenarios; approximately 30 to 50 hours.

### P1 (High)

**Criteria:** Core, frequent or complex behavior with material user reach and a limited workaround. Risk score supports the decision separately.

**Purpose:** Validate normal queued editing, automatic reconnect/readback, backlog timing and unchanged integration controls. Transient failure recovery occurs when the server accepts pending work. The backlog timing row covers recoverable delay; the 30-second release target remains mandatory. Recovery for additional observed business consequences must be documented before reprioritizing.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.2-E2E-001 | AC2: reopen captured order offline, edit parts/labour, save and reopen; keep editing while acceptance is held. Assert latest lines and editable state until acceptance. | E2E | R-002 | 1 | QA | Native edit-state journey complements server conflict tests; accepted-order behavior outside AC2 remains unspecified. |
| 7.3-E2E-001 | AC3/AC4: restore usable OS connectivity with queued orders and take no action; verify server acceptance then open unchanged dispatcher console and compare order fields with the final expected fixture. | E2E | R-002, R-004 | 1 | QA/API | Validates automatic OS-to-client-to-server-to-dispatcher handoff. Pending queue has the source-backed recovery condition of server acceptance. Dispatcher observation is a read-only regression. |
| 7.3-E2E-002 | Story 7.3: seed exactly 2,000 queued items on actual mid-range fleet hardware; restore connectivity and measure monotonic time to all server acknowledgements and reconciled queue completion. Require ≤30 seconds and intact payloads. | E2E | R-003 | 1 | QA/performance owner | Full backlog deadline; delay degrades core operation while work remains queued. Critical business deadline or loss from exceeding 30 seconds is unstated. Physical device timing includes OS scheduling, SQLite and network. |
| 7.3-API-001 | Story 7.3: replay representative 2,000-item ingestion and measure server throughput, latency and exact accepted item counts; assess client timing bottlenecks with server receipts. | API | R-003 | 1 | API performance owner | Server profiling supplements the device deadline test. 2,000/30 implies at least 66.7 accepted items/second end to end. Fleet concurrency and per-request thresholds UNKNOWN. |
| 7.3-INT-003 | Story 7.3/AC3: inject transient failures and network flaps, then permit acceptance. Require eventual automatic progress and retained pending payloads through disconnections. | Integration | R-004 | 1 | Android/API | The epic explicitly retries until server acceptance, which is the recoverability condition. Policy safety covered separately at P0. |
| 7.1-COMP-001 | AC1/AC2: drive queued, editing and accepted state transitions in the native order component; verify captured/list/edit indicators match queue state and existing rendering remains stable. | Component | R-002 | 1 | Android lead | UI state projection; rendering is unchanged. Avoid screenshot-suite expansion. |
| 7.4-INT-001 | Story 7.4 mitigation: inject sync failure and confirm proposed telemetry distinguishes pending, accepted, rejected and oldest-item age without revealing customer payloads. | Integration | R-004, R-005 | 1 | Operations/Android | Detection aids containment; existing telemetry is UNKNOWN and requires a test-access seam. |
| 7.3-API-002 | Context constraint: ingest a synthetic order into one single-tenant installation and verify its receipt exists only in that installation's separate storage. | API | R-001 | 1 | API/platform | Regression of satisfied deployment isolation; no new tenancy risk. Separate installations and no shared storage remain the supplied model. |
| 7.3-API-003 | Context constraint: verify offline upload uses the same platform regional route as the existing online upload and reaches the existing regional server. | API | R-001 | 1 | Platform/API | Regression of unchanged residency routing. No residency jurisdiction, platform redesign or new compliance risk inferred. |
| 7.3-API-004 | Context/out-of-scope constraint: observe offline capture and replay through acceptance; require zero new billing-service calls and unchanged nightly-schedule configuration. | API | R-005 | 1 | API/release owner | Side-effect regression only; card charging is unchanged and the epic never calls billing. Billing processing tests stay outside this plan. |

**Total P1:** 10 scenarios; approximately 24 to 40 hours.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score supports the decision separately.

**Purpose:** No supplied secondary feature requires this band. Native rendering is unchanged.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P2:** Zero scenarios; zero planned hours.

### P3 (Low)

**Criteria:** Rare, cosmetic or experimental behavior with minimal impact and an easy workaround. Risk score supports the decision separately.

**Purpose:** No supplied cosmetic or experimental feature requires this band.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** Zero scenarios; zero planned hours.

### Acceptance Criteria Traceability

| Criterion | Source | Planned scenarios | Observable outcome |
| --- | --- | --- | --- |
| AC1 | Offline save and captured listing | 7.1-E2E-001, 7.1-INT-002, 7.1-COMP-001 | Offline captured order contains the saved parts/labour and survives reopening. |
| AC2 | Editable until server acceptance | 7.2-E2E-001, 7.2-INT-002 | Saved edits remain available while acceptance is pending. |
| AC3 | Automatic upload on reconnect | 7.3-E2E-001, 7.3-INT-003 | Usable OS connectivity triggers acceptance without technician action. |
| AC4 | Unchanged order at dispatcher | 7.3-E2E-001 | Dispatcher fields match the expected final payload at the server. |

Coverage spans 1 Unit, 1 Component, 8 Integration, 5 API and 5 E2E scenarios. No existing tests or fixture conventions are supplied; existing coverage and flakiness are UNKNOWN. These are planned scenarios, with zero claimed execution results. Safety-oracle tests for conflicts, protected storage, bounded retries and containment depend on proposed controls and may fail against the epic's described design.

## Execution Strategy

**Philosophy:** Run all functional scenarios in PRs when the measured suite fits within 15 minutes. Infrastructure cost and duration determine scheduled execution.

- **PR:** Unit, component, SQLite/upload integration, API and short native journeys. Run isolated workers where safe; two-client conflict cases share only their explicitly seeded order. If measured device-suite cost exceeds the budget, retain a native capture/reconnect/readback smoke path and schedule the expensive cases nightly. Within a run, smoke precedes remaining P0, then P1. P2/P3 are empty.
- **Nightly:** Full functional/device matrix, representative physical-device 2,000-item benchmark, network-flap/failure runs and expensive integration coverage.
- **Weekly:** Long-offline soak, sustained rejection/reconnect resource profiling and release recovery rehearsal. All required expensive suites run on the release candidate before approval.

Native Android automation requires a device-capable runner selected when the build is available; repository runner evidence is absent. Playwright parallelization applies only if the team selects it for existing dispatcher readback. Client browser automation and capability probing are inapplicable to the native screen. Use synchronization signals, controlled clocks for policy logic, and bounded outcome waits; retain native screenshots, queue snapshots and sanitized receipts on failure.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 10 | Approximately 3 to 5 | Approximately 30 to 50 | Storage, concurrent state, fault injection and release rehearsal. |
| P1 | 10 | Approximately 2 to 4 | Approximately 24 to 40 | Native journeys, profiling and regression integration. |
| P2 | 0 | N/A | 0 planned | Empty scope band. |
| P3 | 0 | N/A | 0 planned | Empty scope band. |
| Shared setup | N/A | N/A | Approximately 12 to 20 | Device, SQLite, synthetic data and fault-control fixtures. |
| **Total** | **20** | **Varies** | **Approximately 66 to 110** | **Approximately 2 to 3 calendar weeks.** |

Ranges include test setup and verification after implementation exists. Product remediation, framework installation beyond fixture setup, external approval waits and one-to-three-day store review delays are excluded. Device/performance uncertainty can widen the timeline. Counts represent scenario rows; parameter execution counts depend on the agreed matrix.

### Prerequisites

**Test Data:** Synthetic existing orders and assigned technicians; distinct parts/labour revisions; fake card references and addresses for extraction sentinels; valid, transient-failing and permanently rejected payloads; an exact 2,000-entry backlog with representative payload sizes. Isolate each run and clean up test installation records.

**Tooling:** A native Android device-capable automation runner and instrumentation for SQLite/state/timing; controllable ingestion faults and server request counters; API profiling runner, such as k6 if selected; existing dispatcher observation; sanitized logs and release installation/recovery tooling. No tool or package installation is claimed.

**Environment:** Representative physical fleet devices for deadline validation, emulator support for functional work, an isolated single-tenant server/database, the existing regional route, dispatcher access and coordinated API/Platform/Operations test access. No production/customer data is needed.

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100%; each P0 row must pass.
- **P1 pass rate:** At least 95%; failures require triage and approved exceptions. With ten P1 rows, a single failed row yields 90% and fails this threshold.
- **P2/P3:** N/A while bands are empty; if introduced, target at least 90% with documented priority decisions.
- **High-risk mitigations:** All five verified before release; score-9 risks must leave OPEN status. No approval or waiver is granted by this document.
- **Explicit product target:** All 2,000 items accepted and reconciled within ≤30 seconds on the agreed fleet profile; exceeding the target blocks release even though the scenario priority is P1.

### Coverage Targets

- Overall planned scenario coverage: at least 80% baseline; this full epic plan requires all 20 rows implemented and evaluated before release.
- Critical paths and security scenarios: 100%; all four acceptance criteria and all five risks have planned mappings.
- Applicable business-logic branch coverage: target at least 70% once source is available.
- Identified edge-case coverage: target at least 50% baseline, with all listed conflict, acknowledgement, rejection and queue boundaries mandatory.

The percentages above are proposed test-plan gates. They do not assert measured code coverage or add product NFR thresholds.

### Non-Negotiable Requirements

- [ ] Every P0 scenario passes and no high-severity bug remains.
- [ ] Every high-risk mitigation has verified evidence and an accountable owner.
- [ ] Storage, conflict handling and retry policies satisfy the recorded safety decisions.
- [ ] The explicit performance budget and automatic-upload/readback criteria pass.
- [ ] Release recovery preserves queued work and satisfies its agreed objective.
- [ ] Each in-scope NFR category has the planned evidence from NFR Planning; final status is assessed later using `nfr-assess`.

## Mitigation Plans

All mitigation statuses are **Planned**. All risk statuses remain **OPEN**. Role owners require named assignment; timelines are milestone-relative because release dates are UNKNOWN.

### R-001: Plaintext queue exposure (Score: 6)

**Strategy:** Agree which sensitive fields offline capture actually needs, minimize stored payload, and implement protected at-rest storage with appropriately protected device keys. Include queue journals and migration paths in the storage decision.

**Owner:** Android lead and Security. **Timeline:** Policy before implementation; evidence before release.

**Verification:** 7.1-INT-001 detects readable synthetic sentinels in the described design and verifies the agreed protection after remediation. **Residual risk:** A compromised running device can still expose data in use; backup, retention and key recovery policies are UNKNOWN. Re-score after verified controls.

### R-002: Silent queued-edit loss (Score: 9)

**Strategy:** Agree a version/conflict policy preserving each technician's contribution or an explicit recoverable conflict. Retain revision evidence, preserve queued edits while acknowledgements arrive, and prevent stale/replayed entries from silently overwriting newer state.

**Owner:** API and Android leads. **Timeline:** Conflict/replay decision before implementation; all integrity evidence before release.

**Verification:** Ordered two-technician submissions, same-device reordering, persistence, acknowledgement race and readback rows establish separate boundaries. **Residual risk:** Manual conflict resolution may delay acceptance; resolution UX and retention duration are UNKNOWN. Current lost lines have no recovery record.

### R-003: Backlog deadline breach (Score: 6)

**Strategy:** Baseline native queue drain on the actual fleet; measure SQLite, serialization, transport and server acceptance. Evaluate batching/bounded concurrency while preserving the agreed revision semantics. Record the network and payload profile with every run.

**Owner:** Android lead and API performance owner. **Timeline:** First integrated build baseline; target verified before release.

**Verification:** 7.3-E2E-002 is the authoritative full-pipeline deadline check; 7.3-API-001 diagnoses server capacity. The target implies approximately 66.7 accepted items/second, with full client work included. **Residual risk:** Different network, payload or simultaneous fleet load may invalidate the baseline. Their profiles are UNKNOWN; a server-only result cannot establish fleet-device completion.

### R-004: Unbounded immediate retry (Score: 9)

**Strategy:** Classify permanent and transient failures; agree bounded attempts, backoff and recoverable rejected-item handling. Preserve valid queue progress and acceptance/replay integrity. Instrument requests and queue disposition without exposing payload fields.

**Owner:** Android sync lead and API lead. **Timeline:** Policy before implementation; deterministic failure and device resource evidence before release.

**Verification:** Permanent rejection, valid-item progress, acknowledgement loss, transient recovery and isolated retry-state coverage. **Residual risk:** Long outages delay pending work; poison-item recovery and support ownership remain UNKNOWN. Merely stopping the application leaves essential uploads unresolved.

### R-005: Delayed release containment (Score: 6)

**Strategy:** Propose a tested containment/disable mechanism or staged enablement and establish detection/recovery ownership. Rehearse queue-preserving recovery, including the stated store-review delay. These controls require a product/release decision; the epic currently supplies universal enablement and store replacement only.

**Owner:** Release owner and Operations. **Timeline:** Containment decision before release approval; rehearsal on release candidate.

**Verification:** 7.4-E2E-001 recovery timeline and order reconciliation, supported by 7.4-INT-001 detection evidence. **Residual risk:** Existing installed builds may remain exposed for one to three days; adoption timing and recovery objective are UNKNOWN. Retaining the supplied release model leaves this exposure open pending a documented decision.

## Assumptions and Dependencies

### Assumptions

1. The supplied epic and acceptance criteria are complete for this run. PRD, architecture and sprint status are outside its input set.
2. SQLite persistence and network/acceptance boundaries warrant the listed lifecycle/fault cases. Crash, replay and protection oracles are derived safety validation proposals.
3. Protected storage, conflict retention, bounded retries and containment are proposed controls. Their presence and detailed values are UNKNOWN.
4. Existing work orders can be made available on a disconnected device as the epic describes. Preloading behavior, expired-session behavior and accepted-order editing semantics are UNKNOWN; record those decisions before expanding tests.
5. A missed 30-second target leaves work queued. Any critical business consequence of that delay remains UNKNOWN; no billing change is inferred.
6. Named people, release date, hardware matrix and existing test history are UNKNOWN. Roles and relative milestones support this draft.

### Dependencies

| Dependency | Owner | Required by |
| --- | --- | --- |
| Storage protection/minimization policy and test extraction access | Android / Security | Before storage validation starts. |
| Revision, conflict and acceptance/replay policy; observable server history | Architect / API / Product | Before concurrency and replay validation starts. |
| Retry limits, backoff, rejected-item disposition and recovery policy | Android / API / Product | Before failure-policy validation starts. |
| Fleet device/OS/network/payload matrix and isolated backlog seed | QA / Android / Performance | Before deadline benchmark starts. |
| Detection signals, release containment/recovery objective and replacement builds | Release / Operations / Product | Before release rehearsal and approval. |
| Native/server build, dispatcher read-only access and test isolation/cleanup seams | QA / API / Platform | Before integrated testing starts. |

### Risks to Plan

- Unavailable physical fleet hardware prevents authoritative deadline evidence. Reserve representative devices; retain emulator functional coverage while reporting timing as unmeasured.
- Undecided safety policies prevent falsifiable storage/conflict/retry/recovery oracles. Role owners must record decisions; retain blocker status for affected validations.
- Missing fault/state access hides data loss and request-loop behavior. Provide deterministic seams and server-side receipts; screenshots alone cannot establish persistence.

## Follow-on Workflows (Manual)

- Explicitly run `/bmad-testarch-automate` in red mode for the P0 safety scenarios after the required decisions are recorded.
- Explicitly run `/bmad-testarch-automate` for broader coverage when implementation exists.
- Run `nfr-assess` after collecting the planned measurements and reports. No follow-on workflow runs as part of this task.

## Approval

**Test Design Approved By:**

- [ ] Product manager: unassigned; date pending.
- [ ] Technical lead: unassigned; date pending.
- [ ] QA lead: unassigned; date pending.

**Comments:** Draft ready for team review. All mitigation and implementation evidence remains pending. Team review scheduling belongs to these owners; no external message or input document update was made.

## Interworking & Regression

No existing regression suites are supplied. The following checks are required outcomes, with existing suite ownership to confirm when source is available.

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Native Android order screen | Captured/editable state reflects local queue and server acceptance. | Existing save/edit/list behavior, queued state component and native journey rows; rendering preserved. |
| SQLite queue and uploader | Append, durability, ordering, acceptance and retry boundaries. | Real SQLite lifecycle, ordered revisions, acknowledgement race/loss and permanent/transient failure cases. |
| Order ingestion and installation database | Receives existing work-order payloads from offline clients. | Existing online ingestion/readback plus concurrent offline integrity and separate-installation receipts. |
| Dispatcher console | Displays accepted orders unchanged. | AC4 read-only field comparison; no console implementation changes. |
| Regional routing layer | Upload follows unchanged regional path. | Existing online/offline route equivalence; coordinate Platform test access. |
| Nightly billing service | Remains outside capture/sync interaction. | Zero new sync-triggered billing calls and unchanged schedule; owning team's charging regressions remain required. |
| Release and Operations | Every technician receives enabled feature with delayed store replacement. | Detection, queue-preserving containment/replacement rehearsal and build evidence; coordinate shared test-installation windows. |

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: Categories, mitigation ownership and risk governance.
- `bmod-tea/knowledge/probability-impact.md`: Probability/impact scale and remediation bands.
- `bmod-tea/knowledge/test-levels-framework.md`: Unit, component, integration, API and E2E boundary selection.
- `bmod-tea/knowledge/test-priorities-matrix.md`: Business consequence, reach, workaround and P0 to P3 criteria.
- `bmod-tea/knowledge/nfr-criteria.md`: Threshold/evidence planning and unknown-value handling.

The deterministic selection loaded these five fragments in that order. The NFR branch matched security, performance, reliability and release operations. Browser/Playwright and Pact integration branches did not match configuration and supplied repository facts. Config flags are unset; no package manifests or Pact artifacts are present. No mobile-specific fragment was added outside the step's closed selection set.

### Related Documents

- Epic and stories: [Epic 7](../../docs/epics/epic-7-offline-order-capture.md).
- Config: [TEA/core configuration](../../_bmad/config.toml).
- PRD, architecture and tech spec: N/A for the supplied epic-only run.
- Source template: `skill/test-design-template.md`.

### Workflow Validation

Create mode completed steps 01 through 05 in order, using sequential execution with capability probing disabled. The applicable checklist confirms template sections, canonical risk IDs and integer scoring, source evidence, risk-to-level mapping, four-AC traceability, range estimates, required gate thresholds and regression boundaries. System-level outputs/handoff, unavailable PRD/architecture, live browser exploration and sprint-status updates are N/A. Approval, execution evidence and the recorded UNKNOWN decisions remain pending; no final NFR or release gate verdict is claimed.

**Generated by:** BMad TEA Test Architect Module
**Workflow:** `bmad-testarch-test-design`
**Version:** 5.0, step-file workflow; epic template structure retained
