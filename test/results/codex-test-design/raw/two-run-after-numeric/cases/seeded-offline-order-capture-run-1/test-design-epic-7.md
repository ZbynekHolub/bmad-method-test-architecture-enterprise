---
runScope: 'epic'
runKey: 'epic-7'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-13'
inputDocuments:
  - field-order-capture/_bmad/config.toml
  - field-order-capture/docs/epics/epic-7-offline-order-capture.md
  - bmod-tea/knowledge/risk-governance.md
  - bmod-tea/knowledge/probability-impact.md
  - bmod-tea/knowledge/test-levels-framework.md
  - bmod-tea/knowledge/test-priorities-matrix.md
  - bmod-tea/knowledge/nfr-criteria.md
---

# Test Design: Epic 7: Offline order capture for field technicians

**Date:** 2026-10-13
**Author:** tea-eval-harness
**Status:** Draft; stakeholder approval pending

---

## Executive Summary

**Scope:** Full epic-level test design for Epic 7 of field-service-platform. Requirements come solely from [Epic 7](../../docs/epics/epic-7-offline-order-capture.md). The client is native Android, using an outbound SQLite queue and server sync. The unchanged dispatcher console is the final acceptance observation point.

**Risk Summary:**

- Total risks identified: 7; all OPEN.
- High-priority risks (≥6): 5. Two score 9: silent concurrent-edit loss and unlimited immediate retries.
- Critical categories: SEC, DATA, TECH and OPS. PERF and BUS each carry a score-4 risk.

**Coverage Summary:**

- P0 scenarios: 12; ~40–65 hours.
- P1 scenarios: 5; ~20–35 hours.
- P2/P3 scenarios: 0; no scoped effort.
- Total: 17 planned scenarios; ~60–100 hours, ~8–13 person-days, delivered over ~2–4 working weeks subject to prerequisites.

Repository inspection found only the epic and configuration. All coverage is planned; no implementation, existing test suite, fixture pattern, runtime result or flakiness evidence is available. PRD, architecture and sprint status are intentionally absent. Create mode uses sequential execution with capability probing disabled. This workflow produces the plan and its required progress checkpoint.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Offline capture of other entities | Epic explicitly covers work orders only. | Separate feature plans must cover those entities. |
| Dispatcher console changes | Epic explicitly excludes console changes. | AC4 verifies the accepted order through the existing console; existing online-order regression remains required. |
| Charging behavior | Billing uses the stored reference on an unchanged nightly schedule; capture/sync never calls it. | Verify zero capture/sync billing calls and exact reference preservation. Billing owners retain nightly-charge coverage. |
| Regional routing changes | Data residency is unchanged and already enforced by the platform routing layer. | Assert sync follows the existing regional route. Platform owners retain routing evidence. |
| Shared tenant infrastructure | Each installation has its own database and application servers; no storage is shared. | Assert the existing installation-specific server/database path. This plan introduces no scored cross-tenant exposure. |
| Browser/web-view capture and renderer redesign | The capture client is native Android with no browser or web view; order rendering is unchanged. | Exercise native captured/editable states and existing screen behavior; no browser capture or redesign suite is needed. |
| Formal compliance certification | The epic names no regulatory standard or certification requirement. | Security review covers the explicitly stored card reference and billing address. Compliance obligations remain UNKNOWN. |

---

## Risk Assessment

Probability: 1 = unlikely; 2 = possible or unmeasured boundary behavior; 3 = likely or explicitly described failure. Impact: 1 = minor; 2 = degraded workflow; 3 = critical data/security exposure or fleet outage. Score = Probability × Impact. Scores ≥6 require mitigation; open score-9 risks block the planned release gate. Role owners below are proposed assignments, with milestone deadlines.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1 stores full payload, card reference and billing address in unencrypted SQLite with screen lock as the sole control. Obtaining file access exposes sensitive customer data. Exposure is possible; plaintext storage is certain. | 2 | 3 | 6 | Minimize sensitive local fields and protect persisted data and key access; verify files and sidecars with synthetic markers. | Android lead and Security | Storage control decision before implementation; evidence before release |
| R-002 | DATA | Story 7.2 permits two offline technicians, accepts edits by arrival order without version/timestamp checks, and silently discards earlier lines with no record. Work and order history are irrecoverably lost. The failure is explicitly described. | 3 | 3 | 9 | Agree conflict/version handling and preserve displaced edits with visible resolution or an audit record; reproduce both arrival orders. | Backend lead and Product | Conflict policy before implementation; resolution evidence before release |
| R-004 | TECH | Story 7.3 retries rejected uploads immediately forever with no backoff, cap or dead-letter path. A permanently invalid payload drives a sustained request storm and drains device resources; valid backlog progress may be obstructed. Retry storm is explicitly described; queue starvation needs measurement. | 3 | 3 | 9 | Distinguish terminal/transient errors; agree bounded retry/backoff and quarantine handling; keep valid work progressing and retain rejected data for recovery. | Android lead and Backend lead | Retry/error policy before implementation; fault and resource evidence before release |
| R-005 | OPS | Story 7.4 enables every technician in one release with no feature flag, staged rollout or disable path; store recovery takes 1–3 days. A severe capture/sync defect reaches the fleet and remains active through the recovery delay. Defect occurrence is possible; slow recovery is certain. | 2 | 3 | 6 | Agree an operational containment and recovery mechanism; rehearse queue-preserving corrective build and release response against the documented 1–3-day delay. | Release lead and Product | Recovery decision before release candidate; rehearsal before release |
| R-006 | DATA | Stories 7.1–7.3 and AC1, AC2, AC4 require durable offline save, append-only editable queue entries, and unchanged accepted orders. A queue write, append/upload ordering or acknowledgement-boundary error can lose or alter captured parts/labour and customer fields. These are unverified new persistence/integration boundaries. | 2 | 3 | 6 | Atomic durable writes; preserve entry order and edits through acknowledgement; compare captured, queued, accepted and dispatcher-visible payloads; inject interrupted saves/uploads. | Android lead and Backend lead | Persistence/acceptance semantics before implementation; evidence before release |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-003 | PERF | Story 7.3 requires 2,000 queued items to sync within 30 seconds on fleet mid-range devices. Unmeasured throughput may breach this bound and delay dispatcher visibility. The epic states no separate critical business deadline or permanent loss caused by exceeding it; business impact beyond delay is UNKNOWN. | 2 | 2 | 4 | Profile the real queue/uploader/server path and measure all-item completion on actual fleet hardware. | Android lead and Performance QA | Fleet/network profile before performance execution; evidence before release |
| R-007 | BUS | Story 7.3 and AC3 rely on the Android usable-network signal to start upload without technician action. A missed signal or scheduling failure leaves captured orders queued while connectivity is available, delaying dispatch. Boundary behavior is unverified. | 2 | 2 | 4 | Exercise real usable-network transitions and uploader scheduling; retain queued work across connectivity changes. | Android lead | Before release |

### Low-Priority Risks (Score 1-2)

No low-priority risk is supported by the epic.

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |

### Risk Category Legend

- **TECH:** Technical architecture, integration and resource-control failures.
- **SEC:** Access and sensitive-data exposure.
- **PERF:** Throughput, latency and resource limits.
- **DATA:** Loss, corruption and inconsistency.
- **BUS:** User workflow and business impact.
- **OPS:** Deployment, containment and recovery.

The probability/impact reasoning is in each description. R-003 reflects delayed availability; its 30-second acceptance bound remains mandatory. Single-tenant storage and regional routing are established constraints with regression coverage. Current residual risk equals the listed score: every mitigation is planned and no control has been implemented or verified in this run.

---

## NFR Planning

**Purpose:** Plan epic-specific validation and evidence for later `nfr-assess`. Final NFR assessment requires implementation evidence.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security | Full payload contains stored card reference and billing address in plaintext SQLite. Protection/key/retention acceptance policy is UNKNOWN. | R-001 | Integration inspection of real queue files and sidecars using synthetic markers, followed by approved storage-control validation. | Sanitized file-access findings, key-access review and device test report. |
| Performance | Entire 2,000-item backlog syncs within 30 seconds of usable connectivity on fleet mid-range devices. | R-003 | E2E physical-device timing plus Integration backlog-boundary accounting. | Monotonic timestamps, accepted-item ledger, queue reconciliation, hardware/network profile and device CPU/memory/network measurements. |
| Reliability and integrity | Durable captured saves; editable until acceptance; automatic sync; unchanged accepted payload. Conflict and replay policies are UNKNOWN. | R-002, R-006, R-007 | Unit payload checks, real SQLite Integration fault injection, API concurrent edits and native E2E journeys. | Queue snapshots, server commit/acknowledgement ledger, request logs and dispatcher comparison. |
| Reliability and resource control | Current rejected upload retries immediately forever. Approved retry/backoff/cap/quarantine thresholds are UNKNOWN. | R-004 | Unit retry-policy transitions and Integration permanent/transient rejection with device-resource observation. | Timestamped attempt counts, retained rejected data, valid-item progress and resource profiles. |
| Operations | All-user release; disabling needs a store build with 1–3-day review delay. Containment and recovery objectives are UNKNOWN. | R-005 | E2E release incident and corrective-build upgrade rehearsal. | Recovery decision/runbook, build/upgrade logs, queue-preservation evidence and detection/containment record. |
| Scalability | Client backlog bound: 2,000. Fleet concurrency is UNKNOWN. | R-003 | Reuse backlog validation; record concurrent-load profile before adding server load cases. | Backlog ledger and measured profile; server load report if a concurrency requirement is established later. |
| Maintainability | Code baseline and quality thresholds are UNKNOWN. | R-004, R-006 | Track implementation/test mapping and available native/backend CI checks when code exists. | CI reports and ownership records; numeric quality thresholds require agreement. |
| Compliance | Formal obligations UNKNOWN; residency routing unchanged. | R-001, R-005 | Security review and established-route regression only. | Security decision and platform routing regression record; no certification verdict inferred. |

**Unknown thresholds:** Fleet model/Android version, payload distribution, network bandwidth/latency, performance repetition protocol, battery/resource budget, retry classification and limits, conflict-resolution/audit policy, duplicate-acceptance behavior, queue retention, local-data/key protection, incident detection and recovery objectives, fleet concurrency and maintainability/compliance criteria. Record these as owner decisions and execution blockers. Use the epic's explicit 30-second bound without inventing a percentile, device model or fleet size.

---

## Entry Criteria

- [ ] QA, Android, Backend, Product, Security and Release owners agree requirements, scope and proposed mitigation policies.
- [ ] R-001 storage policy, R-002 conflict handling and R-004 retry policy are decided before their mitigation tests are implemented. Current-behavior characterization can proceed first.
- [ ] Test Android build, fleet device models/OS versions, isolated single-installation server/database and dispatcher-console access are ready.
- [ ] Synthetic work orders, two technician accounts assigned to one order, distinct parts/labour/address/reference markers and 2,000-entry datasets are ready.
- [ ] Network transitions, response rejection, acknowledgement loss, commit-boundary interruption and queue/server state inspection can be controlled and observed.
- [ ] Performance network/payload profile and repeat protocol are agreed; operational recovery rehearsal is scheduled by Release.

All execution prerequisites are pending because only planning inputs are supplied. No feature flag is required by this epic.

---

## Exit Criteria

- [ ] P0 pass rate = 100%; P1 pass rate ≥95%. With five P1 scenarios, every P1 row must pass.
- [ ] All four ACs and all seven risks have executed mapped evidence; security coverage is complete.
- [ ] Every measured 2,000-item fleet-device run finishes within 30 seconds with full item accounting.
- [ ] Score-9 risks R-002/R-004 are resolved; high-risk mitigations are complete and reassessed with evidence.
- [ ] No open high-severity data loss, sensitive exposure, fleet outage or core-workflow defect remains.
- [ ] Planned NFR evidence is collected and ready for `nfr-assess`; recovery and regression evidence are attached.

---

## Project Team (Optional)

Responsibility mapping uses roles because names are unavailable. Named assignment and stakeholder approval are pending.

| Name | Role | Testing Responsibilities |
| --- | --- | --- |
| Pending | QA Lead | Native journeys, traceability, evidence and test gate tracking. |
| Pending | Android Lead / Dev Lead | Queue durability, payload handling, retry scheduling and device profiling. |
| Pending | Backend Lead | Acceptance boundary, concurrent edits and server-order verification. |
| Pending | Architecture owner | Cross-boundary conflict, replay and storage-control decisions; assigned by Tech Lead. |
| Pending | Product Manager | Conflict UX, business consequence clarification and acceptance policy. |
| Pending | Security owner | Synthetic-data inspection, key/storage decision and exposure closure. |
| Pending | Release owner | Corrective-build rehearsal, incident containment and recovery evidence. |

---

## Test Coverage Plan

P0/P1/P2/P3 express priority. Execution Strategy specifies cadence. Scenario counts are planning counts; parameterized variants share one row. Unit checks isolate logic; Integration checks cover SQLite, uploader and OS boundaries; API tests establish server persistence behavior; E2E tests establish native user or release outcomes across real boundaries.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity or compliance impact with no safe workaround. Risk score is supporting evidence.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-E2E-001 | AC1: open an existing order offline, add parts/labour, save and reopen captured list | E2E | R-006 | 1 | QA | Native Android flight-mode journey; captured order and complete lines persist after restart. Captured work loss is critical; re-key cannot recover lost lines. |
| 7.1-INT-001 | Interrupt SQLite save at the commit boundary | Integration | R-006 | 1 | Android | Real SQLite and application write path; committed save survives process termination, failed save preserves prior state and avoids a false captured status. Persistence failure loses work. |
| 7.1-INT-002 | Inspect outbound SQLite and sidecars containing synthetic address/card-reference markers | Integration | R-001 | 1 | Security and Android | Test device file access demonstrates current plaintext exposure. Proposed closure requires agreed local-data/key protection; screen lock supplies no protection once file access exists. Sensitive exposure has no documented recovery workaround. |
| 7.2-UNIT-001 | Serialize edits containing distinct parts/labour and customer fields | Unit | R-006 | 1 | Android | Pure payload transformation preserves exact field values and latest edited content. Loss/alteration of order data is critical. |
| 7.2-INT-001 | Append repeated edits and upload them with controlled acknowledgements | Integration | R-006 | 1 | Android | Real SQLite/uploader boundary retains earlier entries before acceptance; latest intended state reaches server in correct order. Avoid a stale edit overwriting the latest edit. |
| 7.2-E2E-001 | AC2: edit a queued order while server acceptance is delayed | E2E | R-006 | 1 | QA | Native edit remains available until acceptance and latest lines reach server. Post-acceptance edit policy is UNKNOWN; this row asserts only the stated boundary. |
| 7.2-API-001 | Two offline technicians edit the same work order; deliver A/B and B/A | API | R-002 | 1 | Backend and QA | Real server persistence reveals arrival-order overwrite and missing history. Proposed closure: agreed conflict/version policy preserves both contributions or surfaces an auditable conflict. Silent loss cannot be recovered under current policy. |
| 7.3-INT-001 | Server accepts an upload; acknowledgement is lost and upload repeats | Integration | R-006 | 1 | Android and Backend | Inject loss after real server commit; queued work remains until acceptance is known and replay leaves the intended complete order. Transport failure after commit must preserve captured data; duplicate-acceptance policy is UNKNOWN. |
| 7.3-INT-002 | Permanently reject one queued payload while valid entries follow | Integration | R-004 | 1 | Android and Backend | Bound the laboratory observation window; capture attempts, valid-item progress and CPU/network/battery trend. Current infinite immediate loop is expected; closure needs agreed terminal handling and bounded retries. Stopping the app leaves the order unresolved. |
| 7.3-UNIT-001 | Classify terminal/transient failures and choose retry transitions | Unit | R-004 | 1 | Android | Future policy validation uses deterministic clock once backoff/cap/quarantine rules are approved. A retry storm has no source-backed containment path; no retry numbers are invented. |
| 7.3-E2E-001 | AC4: captured and edited order syncs and appears unchanged to dispatcher | E2E | R-006 | 1 | QA | Native capture through real server to existing dispatcher console. Compare work-order identity, full parts/labour, address and stored reference at server; compare fields exposed by existing console. No console redesign is assumed. |
| 7.4-E2E-001 | Release incident rehearsal and corrective build upgrade with pending queue | E2E | R-005 | 1 | Release and QA | Real Android build/upgrade and server path verify pending work survives recovery. Record containment options and 1–3-day store-delay consequences. Fleet-wide critical defects have no disable path; a signed containment/recovery decision remains required. |

**Total P0:** 12 scenarios; ~40–65 hours.

### P1 (High)

**Criteria:** Core, frequent or complex behavior with material user reach and a limited workaround. Risk score is supporting evidence.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.3-E2E-002 | AC3: usable network returns after offline capture | E2E | R-007 | 1 | QA | Real Android network transition triggers upload with no tap/relaunch; compare queued and accepted items. Core sync delay has material reach; permanent loss is unstated and scheduling recovery is UNKNOWN. |
| 7.3-INT-003 | Repeated usable-network callbacks and connectivity interruption during upload | Integration | R-007 | 1 | Android | Exercise Android callback/uploader scheduling boundary; resumable queued work progresses after a final stable transition without technician action. Callback orchestration gets lower-level isolation. |
| 7.3-E2E-003 | 2,000 queued items complete within 30 seconds on fleet mid-range device | E2E | R-003 | 1 | Performance QA and Android | Device-to-server performance journey; monotonic t0 is first usable-network report, t1 is last accepted-item acknowledgement plus queue reconciliation. Every run must finish ≤30 seconds with all items accounted for. Threshold is mandatory; delay is documented, critical deadline/permanent loss is unstated. |
| 7.3-INT-004 | Queue sizes 0, 1, 1,999 and 2,000 drain with all items accounted for | Integration | R-003 | 1 | Android | Parameterized real SQLite/uploader/server boundary confirms empty/capacity bookkeeping; device timing belongs to the distinct E2E row. Full-day throughput depends on correct backlog handling. |
| 7.4-INT-001 | Sync respects unchanged routing, installation storage and billing boundaries | Integration | R-005 | 1 | Backend and Release | Verify configured regional route, separate installation DB/server path and zero calls to billing from capture/sync; card reference round-trips unchanged. Scope-constraint regression guards release integration. No tenant-sharing or residency vulnerability is inferred. |

**Total P1:** 5 scenarios; ~20–35 hours.

The throughput target describes a dispatch delay; it provides no separate critical deadline or permanent-loss consequence. Work remains queued for sync. Recoverability time is UNKNOWN. Automatic scheduling recovery is also UNKNOWN. The source's paper/re-key workflow provides a costly capture fallback; it cannot restore silently overwritten lines or contain exposure, infinite retries or a fleet release incident. These recovery limits drive the P0/P1 judgments.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score is supporting evidence.

No scenario qualifies within this epic's essential capture/sync and release scope.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P2:** 0 scenarios; no scoped effort.

### P3 (Low)

**Criteria:** Rare, cosmetic or experimental behavior with minimal impact and an easy workaround. Risk score is supporting evidence.

No scenario qualifies; renderer changes and unrelated features are excluded.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |

**Total P3:** 0 scenarios; no scoped effort.

### Acceptance-Criteria Traceability

| Acceptance Criterion | Primary Coverage | Risk Link |
| --- | --- | --- |
| AC1: Offline save appears captured | 7.1-E2E-001; commit-boundary support in 7.1-INT-001 | R-006 |
| AC2: Captured order stays editable until server acceptance | 7.2-E2E-001; append/upload support in 7.2-INT-001 | R-006 |
| AC3: Network recovery uploads automatically | 7.3-E2E-002; callback-boundary support in 7.3-INT-003 | R-007 |
| AC4: Accepted order appears unchanged in existing dispatcher console | 7.3-E2E-001; serialization support in 7.2-UNIT-001 | R-006 |

Total distribution: 6 E2E, 8 Integration, 2 Unit and 1 API. Overlap provides distinct evidence: persistence/serialization correctness at lower levels and visible end-to-end outcomes at device level. No new UI component behavior warrants a Component suite. No existing tests are credited toward coverage.

---

## Execution Strategy

**Philosophy:** Run every functional scenario in pull requests when the measured suite stays below 15 minutes. Defer suites with material device-lab, infrastructure or duration costs.

- **Pull request:** Unit, SQLite/uploader Integration, server API and native critical-journey checks. Use isolated seeded data and condition-based synchronization. Target <15 minutes; runtime is currently unmeasured.
- **Nightly:** Physical-device backlog performance, sustained rejection/resource measurements, and extended lifecycle/network fault injection.
- **Weekly:** Long offline soak, corrective-build upgrade and operational recovery rehearsal on the agreed fleet matrix.

Within each applicable run, execute native critical smoke first, remaining P0 next, then P1. Before release, run every listed scenario regardless of cadence. Native Android execution follows the supplied sequential mode. Playwright parallelization is N/A for the native capture client; a read-only observation of the existing dispatcher console may use its established automation if later supplied. No browser session was opened in this workflow.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 12 | ~3–6 | ~40–65 | Shared setup, security inspection, conflict/retry characterization and recovery rehearsal. |
| P1 | 5 | ~3–8 | ~20–35 | Physical device access, dataset setup, profiling and network boundaries. |
| P2 | 0 | N/A | N/A | No scoped scenarios. |
| P3 | 0 | N/A | N/A | No scoped scenarios. |
| **Total** | **17** | N/A | **~60–100** | **~8–13 person-days; ~2–4 working weeks.** |

Ranges include shared setup and first verification. One QA owner needs Android, Backend, Security and Release support. Production changes to implement proposed mitigations are additional and unestimated. Runtime and flakiness remain unmeasured.

### Prerequisites

**Test Data:** Synthetic existing work orders with known parts/labour and customer-field markers; two offline technicians on one order; append-edit sequences; empty, single-entry, 1,999-entry and 2,000-entry queue datasets; permanently rejected and transiently rejected payloads. Give runs unique IDs and clean up queue/server records after evidence capture.

**Tooling:** Native Android runner/instrumentation chosen when build facts are available; real SQLite inspection and fault seams; programmable response/network fault proxy; server record reader and monotonic device profiler. Existing dispatcher-console tools remain a dependency. No runner, package or endpoint is claimed to exist. A future HTTP load tool can supplement server capacity evidence; the real-device 30-second gate needs the application path.

**Environment:** Android build and representative fleet devices, isolated single-tenant test installation, agreed network profile, dispatcher account, test-only file/state access and corrective upgrade artifacts. All access is pending. Use synthetic references/addresses and sanitized evidence; protect collected snapshots and delete them according to the agreed retention policy.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100%.
- **P1 pass rate:** ≥95%; five planned rows require five passes.
- **P2/P3 pass rate:** N/A; no scoped scenarios.
- **High-risk mitigations:** 100% complete and reassessed. Open score-9 risks block release.
- **Performance:** Full 2,000-item backlog finishes ≤30 seconds on agreed fleet devices/profile in every measured acceptance run.

### Coverage Targets

- **Critical paths and scoped requirements:** 100% of the four ACs, exceeding the default ≥80% target because this scope is small and essential.
- **Material risks:** All seven have suitable executed coverage.
- **Security scenarios:** 100%.
- **Business logic and scoped boundary cases:** All listed cases executed; code-coverage percentages remain UNKNOWN until implementation/policy exists.

Coverage means executed scenario-to-requirement/risk evidence. Seventeen planned rows establish design traceability; they establish no observed pass rate.

### Non-Negotiable Requirements

- [ ] All P0 tests pass and no high-severity defect remains.
- [ ] R-001/R-002/R-004/R-005/R-006 mitigation evidence is complete.
- [ ] Security inspection establishes the approved local-data/key protection.
- [ ] Performance bound and unchanged accepted-order assertions pass.
- [ ] Evidence for each in-scope NFR category is available for later `nfr-assess`.

Current known weaknesses must be characterized openly. A green characterization test that proves plaintext storage, silent loss or unbounded retry leaves the mitigation gate open. Proposed storage, conflict and retry controls need owner agreement; none is claimed to be a current requirement or implementation. Any exception requires an authorized human record with approver, reason, scope and expiry. No waiver is granted here. Final NFR and coverage-gate verdicts require later implementation evidence.

---

## Mitigation Plans

All mitigation statuses are **Planned**. Owner names and approvals are pending; timelines are milestone deadlines.

### R-001: Sensitive queue exposure (Score: 6)

**Mitigation Strategy:** Agree field minimization and local encryption/key-access protection. Include queue sidecars and retention. Screen-lock-only protection leaves extracted plaintext exposed.
**Owner:** Android Lead and Security.
**Timeline:** Control decision before implementation; evidence before release.
**Verification:** 7.1-INT-002 demonstrates the current exposure with synthetic markers and verifies the approved protection after changes. File/key access and device loss residual threats need documented reassessment.

### R-002: Silent concurrent-edit loss (Score: 9)

**Mitigation Strategy:** Agree conflict/version handling and preserve displaced contributions with visible resolution or an audit record. Characterize both arrival orders first.
**Owner:** Backend Lead and Product.
**Timeline:** Policy before implementation; verified closure before release.
**Verification:** 7.2-API-001 establishes persisted outcomes and recovery/audit evidence for two technicians. Arrival-order overwrite remains an open blocker until closure.

### R-004: Infinite immediate retry storm (Score: 9)

**Mitigation Strategy:** Agree terminal/transient classification, bounded backoff/attempt policy and rejected-item recovery; retain failed work and maintain valid-item progress.
**Owner:** Android Lead and Backend Lead.
**Timeline:** Policy before implementation; fault/resource evidence before release.
**Verification:** 7.3-UNIT-001 verifies policy transitions; 7.3-INT-002 measures attempts, valid backlog progress and device resources. Cap the laboratory observation duration without changing the application's characterized behavior. Numeric retry/resource criteria remain UNKNOWN.

### R-005: Fleet exposure and slow release recovery (Score: 6)

**Mitigation Strategy:** Product and Release must decide containment and queue-preserving recovery before shipping. Rehearse corrective upgrade and account for the documented 1–3-day store delay. A disable mechanism or staged control is a recommendation requiring a product decision; the epic currently provides neither.
**Owner:** Release Lead and Product.
**Timeline:** Decision before release candidate; rehearsal before release.
**Verification:** 7.4-E2E-001 validates recovery with pending queues; 7.4-INT-001 guards unchanged integration boundaries. Faster containment remains UNKNOWN until approved and demonstrated.

### R-006: Captured/edited payload loss or alteration (Score: 6)

**Mitigation Strategy:** Make save durable and atomic, preserve append order and latest edits through upload acceptance, and define replay/acknowledgement handling.
**Owner:** Android Lead and Backend Lead.
**Timeline:** Persistence/acceptance decisions before implementation; evidence before release.
**Verification:** Use the linked Unit, Integration and E2E rows for payload fidelity, interrupted writes, append ordering, lost acknowledgement and dispatcher visibility. Residual boundary behavior must be reassessed after evidence exists.

Medium risks R-003 and R-007 retain their table owners and timelines. The 30-second acceptance bound and automatic upload remain required before release.

---

## Assumptions and Dependencies

### Assumptions

1. Existing work orders can be available on the device before losing connectivity, as the capture story requires. Preloading/authentication-expiry behavior is UNKNOWN and adds no scored risk without source evidence.
2. Android runner, source language, API routes, database schema and background-worker implementation are UNKNOWN. The plan names boundaries and outcomes without inventing implementation details.
3. Baseline characterization follows the epic's described plaintext, overwrite and infinite-retry behavior. Mitigation closure follows future approved decisions recorded alongside evidence.
4. The dispatcher console exposes only its established fields. Server-side comparison checks the full accepted payload; console comparison checks the visible order representation.
5. Security, conflict, retry, performance profile and recovery decisions remain open. No agreement, stakeholder exclusion approval, historical failure or completed test is claimed.

### Dependencies

1. Android/Backend build, runner and isolated environment: required before execution.
2. Security/Product/Backend policy decisions: required before mitigation tests and release closure.
3. Fleet device/OS and network/payload/repeat profiles: required before performance execution.
4. Commit/acknowledgement fault injection, request accounting and queue/server state readout: required before boundary execution.
5. Release incident/upgrade artifacts and agreed recovery criteria: required before release rehearsal.

### Risks to Plan

Missing builds, test seams or devices can delay the estimated ~2–4-week schedule. QA should implement available lower-level coverage first and keep device/release checks pending until the environment exists. Missing business/operational thresholds prevent mitigation sign-off; record owner decisions without interpreting a missing value as a passing result. No product-input file changes are required by this workflow.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-automate` in red mode for the P0 plan after the relevant policy decisions and implementation seams exist.
- Run `/bmad-testarch-automate` for broader coverage when implementation is available.
- Run `nfr-assess` when the planned evidence has been collected.

These workflows require explicit invocation. This run generates no tests.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: pending; date pending.
- [ ] Tech Lead: pending; date pending.
- [ ] QA Lead: pending; date pending.

**Comments:** Draft prepared for later team review. Scope exclusions, role assignments and proposed controls await stakeholder approval. No approval meeting or release has been scheduled by this workflow.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Native Android order screen | Captured and editable state now depends on local queue and acceptance. | Existing online save/edit behavior and unchanged rendering must pass; verify offline captured/editable states through native flows. |
| SQLite outbound queue | Holds full payload and append-only edit entries. | Persistence, interrupted writes, append sequence and acceptance cleanup; pending data survives corrective upgrade. |
| Android connectivity/uploader | Starts automatic sync and handles failures. | Usable-network transitions, scheduling, transient recovery, permanent rejection and acknowledgement loss. |
| Server work-order persistence | Receives offline edits, including concurrent technicians. | Full payload fidelity, accepted-record visibility and concurrency outcome/history under agreed policy. |
| Existing dispatcher console | Displays accepted server records. | Read-only AC4 comparison and existing online-order display regression; no console change. |
| Platform installation/routing | Existing isolated DB/server and regional paths. | Established installation mapping and configured regional route remain enforced. |
| Billing service boundary | Reference passes through payload; nightly billing remains unchanged. | Capture/sync makes zero billing calls and preserves reference. Billing owner retains its existing nightly suite. |

No regression suite was supplied. Android, Backend, Platform, Security and Release owners must provide relevant existing regressions or implement the stated assertions before release; no pass is assumed. Coordinate a shared isolated environment and correlated run IDs for the server/dispatcher acceptance check and device recovery rehearsal.

---

## Appendix

### Knowledge Base References

- [risk-governance.md](../../../bmod-tea/knowledge/risk-governance.md): risk categories, ownership and mitigation.
- [probability-impact.md](../../../bmod-tea/knowledge/probability-impact.md): scoring scale and thresholds.
- [test-levels-framework.md](../../../bmod-tea/knowledge/test-levels-framework.md): suitable test levels and duplicate-coverage guard.
- [test-priorities-matrix.md](../../../bmod-tea/knowledge/test-priorities-matrix.md): consequence/recoverability priority decisions.
- [nfr-criteria.md](../../../bmod-tea/knowledge/nfr-criteria.md): planned NFR thresholds and later evidence needs.

### Related Documents

- Epic: [Epic 7](../../docs/epics/epic-7-offline-order-capture.md), sole requirements source.
- Config: [config.toml](../../_bmad/config.toml).
- PRD, architecture, tech spec, sprint status and prior system-level designs: N/A for supplied run.
- Template: [test-design-template.md](../../../skill/test-design-template.md).
- Validation: [checklist.md](../../../skill/checklist.md).

### Workflow Validation Record

Create steps 01–05 executed in order and in full; run identity epic-7 preserved. Applicable checklist items checked for source-backed risks, bare integer scores, canonical coverage levels/links, all-AC/all-risk mapping, effort ranges, simple cadence, pending approvals and later NFR evidence. System-level deliverables, Playwright parallelization and status-file edits are N/A for this native epic-only input. No browser session or exploration artifact was created. No source document or test file was changed.

**Generated by:** BMad TEA Test Architect workflow
**Workflow:** `bmad-testarch-test-design`
