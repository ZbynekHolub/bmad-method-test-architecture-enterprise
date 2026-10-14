---
runScope: 'epic'
runKey: 'epic-7'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-14T00:20:00.945000+00:00'
inputDocuments:
  - 'field-order-capture/_bmad/config.toml'
  - 'field-order-capture/docs/epics/epic-7-offline-order-capture.md'
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
**Status:** Draft; implementation, evidence, and team approval pending.

## Executive Summary

**Scope:** Full epic-level test design for Epic 7: Offline order capture for field technicians. Run: `epic-7`, Create mode, sequential execution, capability probe disabled. Sole requirements source: `docs/epics/epic-7-offline-order-capture.md`.

The client is native Android. Offline saves and edits enter an app-private SQLite outbound queue; the OS network notification initiates upload; accepted orders must appear unchanged in the existing dispatcher console. Deployment has one customer per installation with separate storage and servers.

**Risk Summary:**

- Six identified risks, all high priority with scores ≥6.
- Three critical score-9 risks: R-001 plaintext customer data, R-002 silent competing-edit loss, R-004 indefinite immediate retries.
- Other score-6 risks: R-003 backlog deadline breach, R-005 fleet release recovery delay, R-006 incorrect durable-save and acceptance transitions.
- Categories: SEC, DATA, TECH, PERF, OPS. All remain OPEN; mitigation owners are proposed roles.

**Coverage Summary:**

- P0: 12 planned scenarios, ~40–60 hours.
- P1: 8 planned scenarios, ~24–40 hours.
- P2/P3: 0 scenarios, 0 hours.
- Shared setup: ~12–20 hours. Total: ~76–120 engineer hours, ~10–15 eight-hour days, calendar ~2–4 weeks after prerequisites are ready.

Planning covers four of four acceptance criteria and six of six risks. Execution evidence is unavailable. The three score-9 risks require mitigation and reassessment before release readiness. Formal NFR and executed coverage gate decisions belong to later evidence-based workflows.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Offline entities other than work orders | Explicit epic exclusion. | Preserve existing behavior and constrain fixtures to existing work orders. |
| Dispatcher console implementation or rendering changes | Epic excludes changes; order visibility remains AC4. | Verify existing console read path and exact received order in E2E; request existing console regression from its owner. |
| Android order-screen visual redesign and browser capture | Native Android has no browser/web view, and rendering is unchanged. | Verify captured status and editability on device; retain existing screen smoke checks. |
| Charging implementation, card authorization, and billing schedule | Epic never calls or modifies billing; existing stored-card charge is nightly. | Assert sync causes zero billing-service calls; request existing nightly billing regression evidence. Protect queued card-reference/address data under R-001. |
| New tenancy controls | Separate installation databases and servers already satisfy isolation. | Verify installation-specific destination/storage as a regression constraint with platform owners. |
| Regional routing/data-residency redesign | Residency is unchanged and enforced by existing platform routing. | Verify unchanged routing configuration and destination evidence; retain platform regression. |
| Fleet-wide capacity targets, legal certification, and generic code-quality targets | Epic supplies no fleet concurrency, legal standard, or code metric. | Record these as unspecified; validate the stated per-device backlog and customer-data exposure. |

Exclusions are draft scope decisions derived from the epic; stakeholder approval remains pending.

## Risk Assessment

**Scale:** Probability 1 = unlikely; 2 = possible or partially unknown; 3 = likely, explicit defect/control gap, or high uncertainty in a new integration. Impact 1 = minor; 2 = degraded with recoverable work or bounded recovery; 3 = critical data exposure, irreversible loss, or unresolved core-operation failure. Score = probability × impact. Remediation actions: scores 1–3 document, 4 monitor, 6 mitigate, 9 block proposed release readiness until resolved and reassessed. Test priorities are assigned separately.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1: full payload with stored card reference and billing address in unencrypted SQLite; screen lock is the only barrier. A readable queue exposes customer financial identifiers and address data. Known plaintext control gap. | 3 | 3 | 9 | Minimize queued sensitive fields; protect remaining payload at rest and keys using Android platform security; verify database and auxiliary artifacts with synthetic canaries. | Android lead + Security | Before release candidate security sign-off |
| R-002 | DATA | Story 7.2: two offline technicians edit one order; unversioned arrival order overwrites earlier lines and leaves no record. Accepted technician work is irrecoverably lost. | 3 | 3 | 9 | Define product conflict policy; add version/conflict detection or safe merge and retained history; validate both arrival orders and append replay. | Backend lead + Product | Before release candidate data-integrity sign-off |
| R-003 | PERF | Story 7.3 requires all 2,000 queued items to sync within 30 seconds on fleet mid-range Android devices. New backlog sync has high measurement uncertainty; missing the target delays dispatch access while queued work remains recoverable. Critical deadline or permanent-loss consequence is unspecified. | 3 | 2 | 6 | Measure full client-to-server backlog drain on actual fleet devices; profile and optimize queue/read/upload/commit pipeline. | Android lead + Backend performance owner | Benchmark before release approval |
| R-004 | TECH | Story 7.3: immediately retry forever, with no backoff, cap, or dead-letter path. Permanently rejected payload consumes network/server/device resources continuously and can prevent useful backlog progress. | 3 | 3 | 9 | Classify transient/permanent failures; bounded exponential backoff/jitter and Retry-After; isolate permanently rejected items with recoverable status; verify healthy-item progress. | Android sync lead + Backend lead | Before release candidate resilience sign-off |
| R-005 | OPS | Story 7.4: enabled for every technician together; disabling requires store review lasting 1–3 days. Single-release exposure affects every technician; disable recovery is delayed 1–3 days. Fleet-wide operational degradation is bounded by the documented store path. | 3 | 2 | 6 | Recommend staged activation and remote disable or a tested containment/recovery plan; rehearse safe queue retention during disable/update. | Release owner + Operations | Before release authorization |
| R-006 | DATA | Stories 7.1–7.3 and AC1–AC4: captured status follows local queue save; edits append while awaiting acceptance; server order must arrive unchanged. Incorrect durable-save/acknowledgment transitions can falsely report capture, retire pending edits, or replay obsolete payloads. | 2 | 3 | 6 | Transactional queue writes, immutable snapshots, ordered same-device edits, acceptance-correlated retirement and reliable retry identity; validate queue-to-server-to-console equality. | Android lead + Backend lead | Before release candidate functional sign-off |

Each description cites a story in the sole epic. These are initial planning scores; the supplied document describes the implementation choices, and no executable implementation was provided. Probability 3 on R-001/R-002/R-004 reflects explicit exposure, loss, and retry behavior. R-003 reflects high uncertainty in an unmeasured 2,000-item native pipeline; impact 2 reflects delayed delivery. R-005 reflects known fleet-wide enablement and bounded store recovery.

### Medium-Priority Risks (Score 3–4)

No medium-band risks identified from the supplied scope.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1–2)

No low-band risks identified from the supplied scope.

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Risk Category Legend

- TECH: architecture, integration, and technical failure mechanisms.
- SEC: security and sensitive-data exposure.
- PERF: latency, throughput, and resource degradation.
- DATA: loss, corruption, and inconsistent order state.
- BUS: business logic and customer operation.
- OPS: release, configuration, and recovery.

**Residual risk:** All six risks are OPEN at their initial scores. Proposed controls have no demonstrated reduction yet. Tests that characterize plaintext, overwritten lines, or tight retries provide defect evidence; those observations keep mitigation verification pending. Any later waiver requires a named approver, reason, compensating control, owner, and expiry. No waiver or approval is granted by this design.

## NFR Planning

Plan epic-specific thresholds and evidence for later `nfr-assess`.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security | Full customer payload is plaintext today. Approved protection/minimization policy UNKNOWN. | R-001 | 7.1-INT-002 inspects real queue artifacts with synthetic canaries before and after mitigation. | Storage inspection report, control/key-handling review, mitigation test results; redact evidence. |
| Performance and bounded scalability | Exactly 2,000 queued items fully accepted within 30 seconds of usable network return on fleet mid-range devices. | R-003 | 7.3-E2E-002 device backlog benchmark; 7.3-API-002 ingestion/load diagnosis. | Monotonic start/end timestamps, device/OS/network profile, server accepted-item count, final queue count, client profiler and API metrics. |
| Reliability and data integrity | Editable through acceptance; automatic sync; unchanged final order. Conflict and retry policy UNKNOWN. | R-002, R-004, R-006 | Concurrency, append/replay, transactional-save, lost-acknowledgment, permanent/transient rejection, and native lifecycle scenarios in coverage plan. | Queue/server snapshots, exact payload comparisons, request counts/timing, conflict history, native flow report/video. |
| Operational recovery | All-user activation; current disable takes store review of 1–3 days. Containment objectives UNKNOWN. | R-005 | 7.4-E2E-001 replacement-build recovery; 7.4-INT-001 activation/containment rehearsal. | Release rehearsal report, activation scope, preserved pending work, documented store recovery ownership and timing. |

**Measurement:** Start timing when the OS reports a usable network after a known offline state. Stop when all 2,000 queue entries have server acceptance and client acknowledgment/retirement. Reconcile each entry ID and final order payload; same-order snapshots can produce fewer than 2,000 final stored orders. The 30-second limit applies to full backlog drain on the device. API latency diagnostics support that result. Repeat on agreed fleet profiles and preserve every run result. Do not replace full-drain timing with average request latency.

**Unknown thresholds and decisions:** Fleet device models/Android versions, network latency/bandwidth/loss profile, payload distribution, and repeat count; approved security controls and key/backup handling; conflict resolution/history policy; retry classifications, backoff/cap and rejected-item recovery; CPU/battery/network budgets; release activation/disable objectives; background execution guarantees. Resolve these before affected execution/sign-off. The source establishes no additional critical business deadline for a 30-second miss. Formal compliance and maintainability metrics are unspecified; record applicable obligations when evidence exists, without importing example thresholds from the knowledge base.

## Entry Criteria

- [ ] QA, Android, Backend, Product, Security, and Release owners agree the scope and unresolved decisions below.
- [ ] Installed candidate Android build, isolated test installation, order server, and existing dispatcher console are available.
- [ ] Fleet mid-range physical devices and agreed Android/network profiles are available; emulator may support functional checks.
- [ ] Synthetic work orders, parts/labour lines, stored card references, addresses, two assigned technicians, and exact 2,000-item datasets are ready with cleanup.
- [ ] Queue inspection, server readback, network fault injection, response rejection/delay, OS-network control, and timestamps are available.
- [ ] Conflict, security, retry, and release mitigation policies have testable approval criteria. Characterization can begin against current behavior before mitigation; candidate sign-off needs approved controls.
- [ ] Test environment isolates indefinite retries and customer-like data. Stop conditions are in the harness, and reported request counts preserve the documented defect.
- [ ] API routes, schema, acceptance semantics, stable identity, native selectors, and supported background behavior are identified from implementation.

## Exit Criteria

- [ ] All P0 scenarios pass: 100%.
- [ ] P1 pass rate ≥95%; eight planned rows require all eight passing. Failed release acceptance or high-risk checks block release; any waiver needs separate approval.
- [ ] No open P0/P1 defect or unresolved critical/high-risk mitigation.
- [ ] All four ACs and all six risks have executed, linked evidence; overall planned-scenario executed coverage ≥80%, critical/AC/high-risk coverage 100%.
- [ ] Full 2,000-item backlog completes in ≤30 seconds on agreed fleet devices with server/queue reconciliation.
- [ ] Security controls, conflict/history safety, bounded rejection handling, and release containment are verified and residual scores reassessed.
- [ ] Evidence exists for every in-scope NFR; unresolved thresholds prevent affected sign-off. Formal NFR status is assessed in `nfr-assess`.
- [ ] Existing ingestion, Android online-save, dispatcher read-path, billing, installation-routing, and regional-routing regressions have owner evidence.

## Project Team (Optional)

Names are unavailable. Responsibility mapping is needed for mitigation and evidence; all roles below require assignment before execution.

| Name | Role | Testing Responsibilities |
| --- | --- | --- |
| Unassigned | QA Lead | Native journeys, fixtures, traceability, reports, candidate evidence. |
| Unassigned | Android Lead / Dev Lead | SQLite/uploader integration, pure logic, storage controls, device instrumentation. |
| Unassigned | Backend Lead / Architect | Ingestion/readback, concurrency/conflict policy, acceptance identity, testability and capacity. |
| Unassigned | Product Manager | Conflict outcome, acceptance interpretation, recovery decisions, scope approval. |
| Unassigned | Security Owner | At-rest exposure mitigation, synthetic-data handling, residual security review. |
| Unassigned | Release / Platform Owner | Activation/containment rehearsal, fleet profiles, store recovery, routing regression. |

## Test Coverage Plan

P0/P1/P2/P3 define business priority. The Execution Strategy section defines run timing. Every scenario is planned and unexecuted. Each row counts as one logical scenario; parameterized variants are included in its estimate. The repository contains no tests, fixtures, source code, or existing coverage evidence.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity, or compliance impact with no safe workaround. Risk score supports remediation planning; priority follows consequence and recovery.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-E2E-001 | AC1: open existing work order offline, add parts/labour, save, see captured order and reopen exact lines. | E2E | R-006 | 1 | QA + Android | Native Android journey; false capture can lose work. Source gives no safe recovery for falsely acknowledged data. |
| 7.1-INT-001 | Queue save transaction commits before captured acknowledgment; inject failed/partial SQLite write and require durable state and honest failure. | Integration | R-006 | 1 | Android + QA | Real SQLite plus native persistence/status boundary; data integrity, recovery unspecified. |
| 7.1-INT-002 | Inspect app queue and auxiliary SQLite files using synthetic card-reference/address canaries; demonstrate current plaintext exposure, then validate approved protection. | Integration | R-001 | 1 | Android + Security + QA | At-rest security boundary needs actual storage. Screen lock alone does not protect extracted plaintext. Safe workaround absent. |
| 7.2-E2E-001 | AC2: offline queued order can be edited repeatedly; latest lines reopen before acceptance; block/delay acceptance to check editability boundary. | E2E | R-006 | 1 | QA + Android | User-visible pending/accepted transitions; lost changes have no source recovery. Post-acceptance behavior unspecified. |
| 7.2-INT-001 | Each same-device edit appends an entry; replay successive versions through actual uploader and SQLite; latest payload survives and acceptance retires only covered entries. | Integration | R-002, R-006 | 1 | Android + QA | Persistence/upload interaction; older arrival overwrite can lose final work, with no recovery record. |
| 7.2-API-001 | Two technicians edit same work order offline; deliver A→B and B→A, duplicate/delay one edit; record current lost lines and require approved conflict/history outcome after mitigation. | API | R-002 | 1 | Backend + QA | Server ingestion and stored state reveal overwrite. Source explicitly loses earlier lines with no history or recovery. |
| 7.2-UNIT-001 | Immutable snapshots and payload serialization preserve all parts/labour, identifiers, card reference and address across successive edits. | Unit | R-006 | 1 | Android | Pure transformation logic; isolate value/aliasing errors without duplicating SQLite interaction. Data-loss recovery unspecified. |
| 7.3-API-001 | Uploaded payload matches committed server order field for field, including parts/labour and synthetic financial/address fields. | API | R-006 | 1 | Backend + QA | AC4 lower-level storage oracle; corruption undermines dispatch and lacks defined recovery. |
| 7.3-INT-001 | Inject upload disconnect before commit and after commit before acknowledgment; retain unaccepted work and verify replay has no duplicate logical effects. | Integration | R-006 | 1 | Android + QA | Queue/network/server acknowledgment boundary. Stable identity/idempotency is a proposed safety requirement needing agreement. |
| 7.3-INT-002 | Place permanently rejected payload ahead of valid items; measure repeated requests and progress; expose current tight loop, then validate approved isolation/bounded-retry behavior. | Integration | R-004 | 1 | Android + QA | Observe real uploader requests/resource use and valid-item acceptance. App pause leaves cause and work unresolved; source gives no safe recovery. |
| 7.3-UNIT-001 | After retry policy approval, classify transient/permanent outcomes and validate backoff/cap/Retry-After with controlled time. | Unit | R-004 | 1 | Android | Proposed policy logic; exact values UNKNOWN. Prevents unbounded repeat that has no source-supported repair path. |
| 7.3-E2E-001 | AC3/AC4: capture and edit offline, restore usable OS network, take no upload action, then verify exact final order in existing dispatcher console. | E2E | R-004, R-006 | 1 | QA + Android | Critical cross-system journey and visible delivery. Complements API equality with automatic trigger and dispatcher read-path proof. |

**Total P0:** 12 scenarios, ~40–60 hours.

### P1 (High)

**Criteria:** Core, frequent, or complex behavior with material user reach and a limited workaround. Risk score supports remediation planning; priority follows consequence and recovery.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.3-E2E-002 | Seed exactly 2,000 realistic items; restore usable network on fleet mid-range Android device; measure all items accepted and retired within 30 seconds. | E2E | R-003 | 1 | QA + Android | Device performance includes OS trigger, SQLite read, transport, commit and acknowledgment. Late delivery is degradation with queued work recoverable; further critical deadline UNKNOWN. |
| 7.3-API-002 | Exercise server ingestion for representative 2,000-item backlog; collect acceptance count, throughput and commit latency to diagnose device budget. | API | R-003 | 1 | Backend + QA | API load evidence isolates server contribution; device E2E owns 30-second verdict. No independent server SLO or fleet concurrency invented. |
| 7.3-INT-003 | Transient server rejection then acceptance; network loss/recovery during drain; verify pending work retained and eventual valid-item progress. | Integration | R-004, R-006 | 1 | Android + QA | Recoverable core-path disruption. Policy limits UNKNOWN; bounded test harness contains current indefinite behavior. |
| 7.3-E2E-003 | Restore usable network while client foreground/background transitions occur; verify native callback activates uploader and pending order arrives automatically. | E2E | R-004, R-006 | 1 | QA + Android | OS integration for AC3; supported background behavior UNKNOWN and a pre-execution decision. Delivery delay with pending work retained is recoverable. |
| 7.4-E2E-001 | Rehearse replacement-build/containment recovery with pending queue; update and resume, verifying pending work survives and dispatch gets exact final order. | E2E | R-005, R-006 | 1 | Release + QA + Android | Operational path requires native installed build and server. Documented recovery is store-reviewed build in 1–3 days; store timing is process evidence. |
| 7.4-INT-001 | Rehearse fleet activation/disable controls if adopted; otherwise record all-user enablement, store-only disable path and containment readiness as open release risk. | Integration | R-005 | 1 | Release + Operations + QA | Operational build/config control boundary, supported by release rehearsal records. Proposed controls absent today. |
| 7.3-API-003 | Assert sync makes zero billing-service calls; existing nightly charging schedule remains unchanged in regression evidence. | API | R-006 | 1 | Backend + QA | Explicit unchanged billing boundary. Billing-service regression ownership is existing service owner; suite unavailable in supplied repository. |
| 7.3-API-004 | Assert sync uses installation-specific endpoint/storage through existing regional routing; compare routing configuration and destination records. | API | R-006 | 1 | Backend + QA | Explicit satisfied single-tenant isolation and unchanged residency boundary; coordinate platform regression. No new scored isolation/residency risk. |

**Total P1:** 8 scenarios, ~24–40 hours.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score supports remediation planning; priority follows consequence and recovery.

No scenarios in this band. The supplied epic covers core offline capture, sync, data protection, and recovery; screen rendering is unchanged.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |

**Total P2:** 0 scenarios, 0 hours.

### P3 (Low)

**Criteria:** Rare, cosmetic, or experimental behavior with minimal impact and an easy workaround. Risk score supports remediation planning; priority follows consequence and recovery.

No scenarios in this band. The supplied epic covers core offline capture, sync, data protection, and recovery; screen rendering is unchanged.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |

**Total P3:** 0 scenarios, 0 hours.

**Acceptance-criteria traceability:** AC1 → 7.1-E2E-001; AC2 → 7.2-E2E-001; AC3 → 7.3-E2E-001 and 7.3-E2E-003; AC4 → 7.3-E2E-001 and 7.3-API-001. Stories 7.1–7.4 each have planned coverage.

**Level selection:** 6 E2E, 5 API, 7 Integration, 2 Unit. Native journeys establish user-visible capture and OS behavior; API checks establish server outcomes; Integration checks establish actual persistence and uploader boundaries; Unit checks isolate transformations and approved retry logic. Repeated journey components assert distinct outcomes at each boundary.

**Priority rationale:** R-001 exposes customer data; R-002 loses earlier work without history; R-004 endlessly repeats permanently rejected uploads without a recovery path; R-006 can falsely acknowledge or corrupt captured work. Their primary checks are P0 because safe recovery is absent or unresolved in the source. R-003 has a 30-second acceptance target; the epic leaves the business-critical deadline consequence unspecified, and queued work remains available for later sync. R-005 affects all technicians and has a documented 1–3-day replacement-build recovery. Their primary checks are P1 for material degradation. Proposed mitigations have no effect on current priority until verified.

## Execution Strategy

Run every functional scenario in pull requests while aggregate runtime stays under 15 minutes. Timing depends on measured duration and infrastructure needs.

- **PR:** Unit, SQLite/uploader Integration, API functional checks, and native device smoke/journeys. Use isolated data per worker if parallelizing. Start with core offline-to-dispatch smoke, then remaining P0 and P1; P2/P3 are empty. Native Android automation runner selection is pending; browser capture automation is inapplicable.
- **Nightly:** Long fault/retry runs, lifecycle stress, two-device concurrency if it exceeds PR budget, and full 2,000-item device benchmark plus API load diagnosis. Ordinary functional checks stay in PR.
- **Weekly:** Physical fleet device/network matrix, sustained rejection/resource profiling, and release replacement/containment rehearsal. Repeat before release authorization against the installed candidate.

A P0 failure blocks promotion. Native recordings, storage/server states, and timing traces diagnose failures. No browser/CLI session was started. Performance/API harness choice requires implementation context; no tool integration flag is enabled in the supplied configuration.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 12 | Variable; batch estimate | ~40–60 | Storage security, concurrency, queue/ack faults, critical native journeys. |
| P1 | 8 | Variable; batch estimate | ~24–40 | Fleet benchmark, OS behavior, release recovery, unchanged-boundary regression. |
| P2 | 0 | N/A | 0 | No supplied secondary scenarios. |
| P3 | 0 | N/A | 0 | No supplied rare/cosmetic scenarios. |
| Shared setup | N/A | N/A | ~12–20 | Devices, seed/readback, isolated faults, storage and timestamp evidence. |
| **Total** | **20** | **Variable** | **~76–120** | **~10–15 eight-hour engineer days; calendar ~2–4 weeks.** |

Ranges assume access and policies are ready. Production mitigation effort is additional and unestimated. Unknown runner/backend details can extend the calendar.

### Prerequisites

**Test Data:** Synthetic existing work-order factory; parts/labour snapshots; canary card references and billing addresses; two technicians assigned to one order; rejected payload followed by valid payload; exactly 2,000 queued items including repeated edits. Unique installation/run/order/entry IDs; reset queue and server records between scenarios. Device-user workflows load an existing work order before going offline, matching epic context.

**Tooling:** Proposed Android native instrumentation/device automation; actual SQLite inspection and lifecycle/network controls; API seeding/readback and programmable response faults; API load/profiling runner and monotonic timer correlation. Specific libraries and routes are UNKNOWN. No tests or framework are generated by this workflow.

**Environment:** Isolated single-customer installation with order ingestion, persistence, and existing dispatcher console; actual fleet mid-range devices for the acceptance benchmark; two independent Android clients for competing edits; inspection-enabled candidate for test observability plus installed release-equivalent build for device behavior. Pending access and instrumentation are execution blockers.

## Quality Gate Criteria

### Pass/Fail Thresholds

- P0 pass rate: 100%.
- P1 pass rate: ≥95%; all eight rows must pass at this count. Any waiver is separately approved and time-limited.
- P2/P3: N/A with empty bands; future scenarios use ≥90% informational pass rate.
- High-risk mitigations: 100% complete and verified before release. Score-9 risks require reassessment; this plan grants no waiver.

### Coverage Targets

- Overall executed planned-scenario coverage: ≥80%; denominator is all declared scenarios. Pending/skipped checks remain uncovered.
- Critical journeys, all four ACs, all six material risks, and security checks: 100% evidence coverage because release affects all technicians.
- Relevant pure business-logic branch target: ≥80% once implementation exists; branch inventory unavailable today.
- Enumerated critical edge cases: 100% across conflict orders, rejected-item progression, save failures, and acknowledgment loss. Avoid inferring coverage from a green happy path.

### Non-Negotiable Requirements

- [ ] All P0 tests pass, and no open high-severity defect remains.
- [ ] Every score≥6 mitigation is verified; residual scores and ownership are recorded.
- [ ] Sensitive local-storage controls pass approved security criteria.
- [ ] Full 2,000-item drain meets ≤30-second target on the agreed fleet devices.
- [ ] Every in-scope NFR has actual evidence before release assessment.

These are proposed release gates. All execution outcomes remain unmeasured. Final NFR status belongs to `nfr-assess`; formal coverage gate evaluation belongs to the evidence-based trace workflow.

## Mitigation Plans

### R-001: Plaintext customer payload (Score: 9)

**Mitigation Strategy:** Approve minimum queued fields; protect retained payload and keys; inspect main/auxiliary storage and approved backup/log paths with synthetic canaries.

**Owner:** Android lead + Security. **Timeline:** Before candidate security sign-off. **Status:** Planned; OPEN.

**Verification:** 7.1-INT-002 storage inspection and Security control review.

**Residual risk:** Initial score 9; reassess after implemented controls and execution evidence.

### R-002: Silent competing-edit loss (Score: 9)

**Mitigation Strategy:** Define conflict policy; detect competing versions or perform safe merge; retain auditable earlier edits; preserve same-device edit order.

**Owner:** Backend lead + Product. **Timeline:** Before candidate data-integrity sign-off. **Status:** Planned; OPEN.

**Verification:** 7.2-API-001 both arrival orders and replay; 7.2-INT-001 appended same-device revisions.

**Residual risk:** Initial score 9; reassess after implemented controls and execution evidence.

### R-003: Backlog timing degradation (Score: 6)

**Mitigation Strategy:** Agree fleet/network/payload measurement profile; benchmark full 2,000-item drain; profile client/server contributors; optimize and repeat on candidate.

**Owner:** Android lead + Backend performance owner. **Timeline:** Before release approval. **Status:** Planned; OPEN.

**Verification:** 7.3-E2E-002 ≤30-second full-drain evidence; 7.3-API-002 load diagnostics.

**Residual risk:** Initial score 6; reassess after implemented controls and execution evidence.

### R-004: Immediate indefinite retry (Score: 9)

**Mitigation Strategy:** Approve transient/permanent classification and retry parameters; implement bounded backoff/jitter and supported Retry-After; isolate rejected items for recovery while valid work progresses.

**Owner:** Android sync lead + Backend lead. **Timeline:** Before candidate resilience sign-off. **Status:** Planned; OPEN.

**Verification:** 7.3-INT-002 poison-item request/progress traces; 7.3-UNIT-001 policy boundaries; 7.3-INT-003 recovery.

**Residual risk:** Initial score 9; reassess after implemented controls and execution evidence.

### R-005: Fleet-wide release recovery delay (Score: 6)

**Mitigation Strategy:** Propose staged activation/remote containment; document controls adopted; rehearse replacement build within documented store path; protect pending work through disable/update/resume.

**Owner:** Release owner + Operations. **Timeline:** Before release authorization. **Status:** Planned; OPEN.

**Verification:** 7.4-INT-001 operational control evidence; 7.4-E2E-001 installed-build recovery and queue preservation.

**Residual risk:** Initial score 6; reassess after implemented controls and execution evidence.

### R-006: Incorrect capture/acceptance state (Score: 6)

**Mitigation Strategy:** Commit immutable queue snapshots transactionally; correlate server acceptance with retired entries; agree stable replay identity and duplicate handling; reconcile exact payload through dispatcher.

**Owner:** Android lead + Backend lead. **Timeline:** Before candidate functional sign-off. **Status:** Planned; OPEN.

**Verification:** 7.1-INT-001 save failures; 7.2-UNIT-001 serialization; 7.3-INT-001 lost acknowledgments; 7.3-API-001 server equality and 7.3-E2E-001 dispatcher journey.

**Residual risk:** Initial score 6; reassess after implemented controls and execution evidence.

## Assumptions and Dependencies

### Assumptions

1. The supplied epic is the complete requirements source for this run; embedded story and AC headings provide traceability. PRD, architecture, and sprint status are intentionally absent.
2. Existing work orders are available on device before connectivity disappears, consistent with opening an existing work order. Offline loading behavior beyond this context is unspecified.
3. Mitigation proposals require Product/Engineering/Security approval and implementation. Encryption/minimization, version/history policy, stable replay identity, bounded retries, and remote controls are proposals; the current epic documents different behavior.
4. Exact post-acceptance editing semantics, background guarantees, upload schema/endpoints, key management, and measurement profiles remain UNKNOWN. This workflow records decisions without asking questions per run configuration.
5. Roles are proposed and approvals are pending. Historical failures, current tests, flakiness, fixture patterns, and runtime metrics are unavailable.

### Dependencies

1. Candidate build, native runner, test installation, and dispatcher access: required before functional execution; owners Android, Backend, QA.
2. Storage protection, conflict/history outcomes, retry classification/recovery, and stable acceptance semantics: required before affected mitigation checks; owners Security, Product, Android, Backend.
3. Fleet device/OS, network and payload profiles, resource budgets, and repeat policy: required before performance/resilience sign-off; owners Android, QA, Performance.
4. Store replacement/containment plan and any adopted activation/disable controls: required before release rehearsal; owners Release/Operations.
5. Billing, console, and routing regression evidence and shared-environment scheduling: required before release; coordinate service/platform owners. No existing suites were supplied.

### Risks to Plan

- Unavailable source/build/test seams prevent execution. Contingency: retain this planning artifact, assign testability setup, and record checks as unmeasured.
- Unknown conflict/security/retry criteria prevent mitigation sign-off. Contingency: characterize current behavior, obtain decisions, and verify the approved outcomes without lowering current scores.
- Indefinite retry can exhaust test infrastructure. Contingency: isolated installation, finite observation window, harness stop control, synthetic data; retain defect evidence.
- Missing fleet measurement profiles prevent a representative benchmark. Contingency: reserve fleet hardware and capture profiles before claiming the 30-second target.

These are execution dependencies/assumptions; they do not introduce unsupported scored risks.

## Follow-on Workflows (Manual)

- After policy decisions and implementation/test environment availability, explicitly invoke `bmad-testarch-automate` in red mode for failing P0 checks, then broader coverage.
- Run `nfr-assess` and evidence-based trace/gate assessment after execution reports exist.

No follow-on workflow, generated tests, or changes to requirements documents are performed in this run.

## Approval

**Test Design Approved By:**

- [ ] Product Manager: unassigned. Date: pending.
- [ ] Tech Lead: unassigned. Date: pending.
- [ ] QA Lead: unassigned. Date: pending.
- [ ] Security and Release owners: unassigned. Date: pending.

**Comments:** Draft planning document. Team review and resource allocation remain pending. Workflow completion records artifact validation only.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Native Android order screen and local SQLite queue | New offline persistence, queued edit state, and uploader. | Existing online save/edit behavior; durable capture status; reopening exact queued data; append/acceptance retirement. Existing suites unavailable. |
| OS connectivity and app lifecycle | Usable-network notification initiates upload automatically. | Foreground/background network return; interrupted drain and retry; installed candidate native behavior. |
| Order ingestion and server persistence | Receives appended/retried edits from multiple technicians. | Field equality, same-device ordering, conflicting-arrival history, replay identity, accepted-item reconciliation. Coordinate Backend. |
| Existing dispatcher console | Reads accepted order without feature changes. | Existing order-list/detail read-path smoke and exact final parts/labour; API readback complements console verification. Coordinate console owner. |
| Existing billing service | Stored card reference remains in payload; charging path untouched. | Zero calls from sync; retain existing nightly charging schedule regression evidence. Coordinate billing owner; charging authorization/execution excluded. |
| Installation servers/storage and regional routing | Existing isolation and residency constraints remain satisfied. | Installation-specific destination/storage and unchanged regional route; platform regression evidence required. |
| Release packaging/store recovery | All-user activation and replacement-build recovery affect pending queues. | Candidate upgrade retains pending work; containment/resumption delivers accepted payload; activation scope documented. Coordinate Release and Operations. |

Existing regression suites are unavailable in the supplied repository. These are required scopes for owners to supply or implement, with planned checks identified in coverage. This run sends no external coordination messages.

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: categories, mitigation ownership, and release-readiness governance.
- `bmod-tea/knowledge/probability-impact.md`: 1–3 scoring scales and remediation actions.
- `bmod-tea/knowledge/test-levels-framework.md`: Unit, Integration, API-boundary, and E2E selection.
- `bmod-tea/knowledge/test-priorities-matrix.md`: P0–P3 consequence and recovery judgments.
- `bmod-tea/knowledge/nfr-criteria.md`: threshold/evidence planning and unknowns.
- `bmod-tea/knowledge/tea-index.csv`: deterministic fragment selection. Optional Pact/Playwright branches remained closed; integration flags are unset and relevant artifacts absent.

### Related Documents

- Epic: [Epic 7: Offline order capture](../../docs/epics/epic-7-offline-order-capture.md).
- Configuration: [TEA config](../../_bmad/config.toml).
- PRD, architecture, tech spec, and sprint status: intentionally unavailable; no missing required input.
- Template: `skill/test-design-template.md`; instructions and steps 01 through 05 executed sequentially.

### Validation Record

Applicable epic-level checklist items were checked: all template sections present; six unique canonical risk IDs and correct scores; explicit score-band headings; empty bands without placeholder rows; every scenario has a canonical test level and exact risk links; all ACs/stories traceable; counts/effort ranges consistent; evidence and unknowns recorded; scope, entry/exit, mitigation, residual risk, regression, and approvals explicit. Source inputs remain unchanged. No browser sessions or exploration artifacts were created. System-only outputs, handoff, and web/Playwright-specific checks are inapplicable. Approvals and executed evidence remain pending as shown above.

**Generated by:** BMad TEA Test Architect Module.
**Workflow:** `bmad-testarch-test-design`.
**Mode:** Create, epic-level, full, sequential. **Run key:** `epic-7`.
**Completion date:** 2026-10-13.

