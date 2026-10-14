---
runScope: 'epic'
runKey: 'epic-7'
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
**Status:** Draft; team approval pending

---

## Executive Summary

**Scope:** Full epic-level test design for Epic 7, stories 7.1 through 7.4. Native Android offline capture and editing, SQLite queue persistence, automatic upload, server acceptance and unchanged dispatcher readback.

**Risk Summary:**

- Total risks identified: 8, all OPEN.
- High-priority risks (score ≥6): 6. Three have score 9: plaintext sensitive queue data, silent overwrite of concurrent edits, and unlimited immediate retries.
- Critical categories: SEC, DATA, TECH. PERF and OPS also require mitigation.

**Coverage Summary:**

- P0 scenarios: 13, approximately 35 to 55 hours.
- P1 scenarios: 15, approximately 45 to 70 hours.
- P2/P3 scenarios: 0; no secondary or cosmetic feature is introduced.
- Total: 28 planned scenarios; approximately 80 to 125 hours, 10 to 16 person-days, or 2 to 4 calendar weeks with two contributors and shared device/server support.

These are design estimates including fixtures and initial qualification. No tests were generated or executed. Existing tests, implementation manifests and runtime measurements were absent from the supplied project. The epic is the sole requirements source; PRD, architecture and sprint status are inapplicable inputs for this run. Recommendations below describe proposed controls; approval and implementation are pending.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Other offline entities | Epic explicitly limits capture to work orders. | Preserve existing online behavior; the owning feature suites remain responsible. |
| Android rendering redesign, browser client or web view | Epic identifies a native Android application and states that rendering is unchanged. | Native order capture/edit/status assertions use the current screen; existing rendering regressions must pass. |
| Dispatcher console changes | Epic excludes changes to the console. | AC4 includes existing-console readback in 7.3-E2E-001; broader console coverage stays with its owner. |
| Card authorization, charging schedule and billing implementation | Epic says the existing billing service charges its stored reference nightly, independently of this change. | Preserve payload fields and assert no sync-to-charging call/configuration change in 7.3-INT-006; retain existing billing regressions. |
| Shared-storage multi-tenant isolation | Each installation already has its own database and application servers. | Verify unchanged installation bindings in 7.4-INT-002. No shared storage exposure is introduced by the supplied scope. |
| Regional routing and residency implementation | Epic says platform regional routing enforces unchanged residency. | Platform supplies baseline routing evidence; 7.4-INT-003 checks unchanged bindings. Broader routing validation stays with Platform. |
| Test generation and input-document edits | This workflow produces the epic plan and its progress checkpoint. | Implementation and test automation follow separately; requirements under docs remain unchanged. |

---

## Risk Assessment

Scores describe inherent planning risk before mitigation. Probability: 1 unlikely, 2 possible, 3 likely. Impact: 1 minor, 2 degraded operation, 3 critical security exposure, lost work or blocked essential operation. Score = probability × impact. A score of 9 is a planning release blocker; scores ≥6 require verified mitigation. These judgments use the epic statements cited in each row; they are unmeasured implementation outcomes.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | 7.1: full payload includes card reference and billing address in plaintext SQLite with screen lock as the sole protection. Reading the queue exposes sensitive customer data; plaintext retrieval is the stated storage behavior. | 3 | 3 | 9 | Minimize sensitive queued fields, protect remaining data at rest and verify DB/side-file/key-access behavior. | Android lead + Security | Control decision before implementation sign-off; evidence before release |
| R-002 | DATA | 7.2: appended edits arrive from two offline technicians; server overwrites by arrival order without version/timestamp checks or history. Earlier lines are silently and irrecoverably lost. Delayed stale revisions share this mechanism. | 3 | 3 | 9 | Approve conflict/version handling and recoverable history; validate both arrival orders and appended revisions. | Server + Android leads; Product decides conflict semantics | Policy before implementation sign-off; evidence before release |
| R-003 | PERF | 7.3: 2,000 items must finish syncing within 30 seconds on fleet mid-range devices. This unvalidated target requires more than 66 item completions per second. Budget breach delays order delivery. Likelihood 3 reflects the demanding unproven full-path budget; impact 2 reflects degraded delivery. | 3 | 2 | 6 | Benchmark full acceptance and local drain on fleet hardware with recorded network conditions; profile and remove measured bottlenecks. | Android + server performance owners | Baseline before candidate; qualified evidence before release |
| R-004 | TECH | 7.3: failed uploads retry immediately forever, with no backoff, cap or dead-letter path. A permanently rejected item produces an indefinite upload storm and resource consumption; valid-backlog progression must also be measured. | 3 | 3 | 9 | Classify failures; approve bounded retries, backoff and observable quarantine/recovery; preserve unaccepted payloads. | Android + server leads | Policy before implementation sign-off; fault evidence before release |
| R-005 | OPS | 7.4: feature enables every technician in one release, with no flag or staging and a one-to-three-day replacement-build delay to disable. A production fault can affect the entire fleet throughout the recovery delay. | 2 | 3 | 6 | Propose rapid disablement/staged enablement, or document containment and queue-safe replacement-build recovery; rehearse the chosen path. | Release lead + Android lead | Recovery decision before candidate; drill before release |
| R-006 | DATA | 7.1 makes the local queue the offline save destination; AC2 keeps work editable until acceptance. Failed persistence or queue completion before server acceptance can lose captured work while the UI implies success. | 2 | 3 | 6 | Atomic local save and acceptance-bound completion; inject commit/acknowledgement faults and prove retained recoverable payload. | Android lead | Persistence design before implementation sign-off; evidence before release |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | TECH | 7.3 and AC3 require upload after OS usable-network detection without user action. A missed scheduling transition leaves captured backlog unsynced until recovery. | 2 | 2 | 4 | Validate actual Android network transitions and lifecycle scheduling; evidence before release. | Android lead |
| R-008 | DATA | AC4 requires the server order to appear unchanged on the dispatcher console. Mapping/serialization across queue, upload, persistence and display can alter order lines or customer fields. | 2 | 2 | 4 | Compare distinct seeded fields across pure mapping, server readback and dispatcher outcome; evidence before release. | Android + server leads; dispatcher QA |

### Low-Priority Risks (Score 1-2)

No low-band risks are identified from the supplied evidence.

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |

### Risk Category Legend

- TECH: technical design, integration and reliability flaws.
- SEC: sensitive-data exposure and access protection.
- PERF: throughput, timing and resource degradation.
- DATA: loss, corruption and inconsistent order state.
- BUS: business logic and user/business consequences.
- OPS: deployment, recovery and operational controls.

Residual risk is unchanged because controls are proposed and unverified. Re-score after implementation evidence, keeping canonical IDs and recording rationale, owner and date. Single-tenant separation, regional routing and independent nightly billing are supplied scope constraints and receive bounded regression assertions.

---

## NFR Planning

**Purpose:** Plan validation and evidence for a later `nfr-assess` run. Numerical targets beyond the epic's backlog deadline require owner decisions.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security | Full sensitive payload is currently plaintext; required protection standard and retention policy UNKNOWN. | R-001 | Integration: 7.1-INT-001 inspects actual SQLite and side files; verify approved protection and key access. | Sanitized storage findings, build identity and security/control decision; preserve sensitive values outside reports. |
| Performance | 2,000 queued items finish within 30 seconds after usable connectivity on fleet mid-range devices. Device models/network profile and run qualification UNKNOWN. | R-003 | E2E: 7.3-E2E-004 measures whole Android/server path; API: 7.3-API-003 profiles server throughput with a load harness. | Monotonic complete-drain timings, counts, hardware/OS/build/network metadata and server/device traces. |
| Reliability and integrity | Capture survives local save; editing remains available until acceptance; exact final order reaches server/dispatcher. Conflict semantics UNKNOWN. | R-002, R-006, R-008 | API conflict arrival orders, SQLite commit/ack faults, serialization and native-to-dispatcher E2E. | Server history/readback, local transaction/completion states, device flow results and payload comparisons. |
| Automatic recovery | Upload begins without technician action after usable-network report. Scheduling deadline and lifecycle policy UNKNOWN. | R-007 | Integration and E2E: actual Android network transitions, repeated callbacks and background/foreground behavior. | OS transition/scheduler records and server acceptance evidence with no sync UI action. |
| Retry resilience and resource safety | Current immediate unlimited retries have no terminal recovery path. Attempt limit, backoff, quarantine/recovery and CPU/battery budgets UNKNOWN. | R-004 | Unit policy tests; Integration rejection/recovery; E2E sustained-rejection device measurements. | Policy/queue reports, bounded request traces, retained payload proof and device resource profile. |
| Operational recovery | Current disablement requires replacement build and one-to-three-day store review; acceptable recovery time UNKNOWN. | R-005 | E2E release/containment drill; Integration configuration and queued-work upgrade checks. | Recovery timeline, store-delay exercise record, build/config artifacts and queue reconciliation. |

**Unknown thresholds:** Specific fleet device/Android matrix; payload sizes and network latency/bandwidth/loss; concurrent fleet reconnect load; performance repetition/run profile; retry attempt/delay policy; CPU, memory and battery limits; conflict and replay semantics; recovery time; storage/key/retention standard. These are qualification blockers or assumptions listed below. Record missing evidence as unmeasured.

Scalability beyond the stated 2,000-item client backlog has no supplied target. Maintainability coverage/duplication limits and legal compliance obligations are UNKNOWN and unquantified. Preserve platform residency/billing boundaries through regression checks. A stored card reference does not define a charging integration or establish a compliance regime.

---

## Entry Criteria

- [ ] QA, Android, Server, Security, Product and Release owners confirm this plan's outcomes and pending mitigation policies.
- [ ] Installable Android build, supported fleet device/OS matrix and isolated server installation are available.
- [ ] Upload endpoint/schema and server readback/history access are identified from implementation.
- [ ] Synthetic work orders, two assigned technicians, distinct parts/labour and fake card/address markers are seeded with cleanup.
- [ ] Controllable usable-network transitions, commit failure, acknowledgement loss and permanent/transient rejection are available.
- [ ] SQLite and side-file inspection, monotonic timings, sanitized traces and device profiling are accessible.
- [ ] Conflict, sensitive-storage, retry/quarantine and release recovery policies are approved for mitigation qualification. Characterization may start earlier in isolation.
- [ ] Representative 2,000-item dataset and device/network performance profile are approved.
- [ ] Platform supplies current installation/routing bindings; billing/dispatcher owners supply relevant regression baselines.

The supplied epic satisfies requirements entry for design. Implementation and environment entry checks remain pending; absent optional planning documents require no action.

---

## Exit Criteria

- [ ] All 13 P0 scenarios pass with assertions proving the intended outcome.
- [ ] P1 pass rate is at least 95%; with 15 planned P1 scenarios, all 15 must pass. Required AC and timing checks cannot be omitted.
- [ ] AC1 through AC4 and all eight risks have executed evidence at the planned suitable levels.
- [ ] Every high-risk mitigation is verified and re-scored; no unresolved score-9 blocker or open critical/high-severity defect remains.
- [ ] All qualified 2,000-item device runs complete within 30 seconds and preserve final accepted payloads.
- [ ] Storage, conflict, retry/recovery, acceptance durability and release recovery evidence is available for `nfr-assess`.
- [ ] Regression boundaries and coverage targets below are met; all skipped/unmeasurable cases are reported as gaps.
- [ ] Product, Tech and QA record release decisions separately from this completed design run.

---

## Project Team (Optional)

Responsibility mapping is needed for cross-device conflicts, sensitive storage and release containment. Names and staffing commitments are UNKNOWN; roles below are proposed owners.

| Name | Role | Testing Responsibilities |
| --- | --- | --- |
| TBD | QA lead | Scenario implementation, traceability, evidence and release qualification. |
| TBD | Android lead | SQLite/native behavior, scheduling, retry harness and device profiling. |
| TBD | Server lead | Conflict handling, acceptance/readback and throughput evidence. |
| TBD | Security reviewer | Sensitive queue protection, keys and sanitized evidence. |
| TBD | Product Manager | Conflict/recovery outcomes and business consequence decisions. |
| TBD | Release/Platform lead | Fleet builds, recovery drill and installation/routing baselines. |
| TBD | Architect/Tech lead | Storage, versioning, retry and acceptance protocol decisions. |

---

## Test Coverage Plan

P0/P1/P2/P3 state test priority. Execution timing is defined in Execution Strategy. Test counts are scenario definitions; arrival orders, fault variants and device profiles add execution instances. Each row has one canonical test level and preserves the risk register ID. Risks may span levels where the observable boundary differs.

P0 protects sensitive data, durable capture, concurrent edit preservation and unchanged accepted order state. The epic supplies no safe recovery for plaintext disclosure or silent data loss. Immediate indefinite retries leave permanent rejection unresolved; pausing the app preserves that unresolved state. The paper/re-keying baseline cannot reconstruct lines already lost without history. Performance is P1 because the source sets a delivery latency target with retained queued work; it supplies no critical business cutoff for latency alone. Release containment is P1 pending a concrete incident consequence and recovery-time decision. Both remain mandatory release qualifications.

### P0 (Critical)

**Criteria:** Critical business, security, data-integrity, or compliance impact with no safe workaround. Risk score is supporting evidence and is not a required condition.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-INT-001 | 7.1; AC1 | Integration | R-001 | 1 | Android/Server Dev + QA | Capture synthetic card reference and address offline; inspect SQLite file, journal/WAL and retained copies. Characterize current plaintext exposure; after protection is implemented, verify sensitive fields are unreadable without authorized key access. Actual device persistence is the security boundary. Sensitive customer data exposure has no source-supported recovery workaround. Proposed protection is a risk mitigation; current stated design exposes plaintext. |
| 7.1-INT-002 | 7.1; AC1 | Integration | R-006 | 1 | Android/Server Dev + QA | Save parts and labour with real SQLite; inject a commit failure and reopen. Successful save has exact durable payload; failed commit produces no captured-success claim. Local queue is the only offline save destination. Lost work has no safe source-backed recovery; atomic commit and visible failure are proposed safeguards. |
| 7.1-E2E-001 | 7.1; AC1 | E2E | R-006 | 1 | QA + Android Dev | On Android without connectivity, open an existing work order, add parts and labour, save, leave the screen and reopen; assert captured listing and exact lines. Proves the user-visible save transition through local persistence. Missing captured work blocks essential order recording; paper/re-keying is the context baseline and cannot recover an order silently lost after reported success. |
| 7.2-API-001 | 7.2; AC2 | API | R-002 | 1 | Server Dev + QA | Submit two technicians’ queued edits for the same work order in both arrival orders. Inspect final stored lines and available history; demonstrate current silent overwrite, then validate approved conflict preservation/recovery. Server persistence and history expose the stated loss mechanism. Silent line loss has no record and no source-backed workaround. Approved conflict policy is pending; current arrival-order behavior must be characterized as hazardous. |
| 7.2-E2E-001 | 7.2; AC2 | E2E | R-002 | 1 | QA + Android Dev | Two Android devices capture different lines for one assigned work order offline; reconnect in controlled order and inspect both device outcomes and dispatcher order. Validates cross-device visibility and recoverability of conflicts. Different aspect from API order permutations. Permanent loss without a record makes this critical; mitigation outcome needs a Product decision. |
| 7.2-INT-001 | 7.2; AC2 | Integration | R-002 | 1 | Android/Server Dev + QA | Append multiple revisions on one device, including removal and correction of a line; upload them in controlled normal and delayed arrival order. Assert latest intended state survives or a conflict is recoverable. Appended stale revisions are a boundary of the same overwrite risk. Original edit snapshots must remain traceable until server acceptance; mitigation policy pending. |
| 7.3-UNIT-001 | 7.3 | Unit | R-004 | 1 | Android Dev | Exercise failure classification with transient, permanent and throttled responses using a fake clock; verify approved bounded attempts, delays and terminal disposition. Pure retry-policy logic is isolated. Current immediate infinite retries are a known design gap. Stopping the app leaves the payload unresolved; no source-backed recovery path. Numerical policy UNKNOWN. |
| 7.3-INT-001 | 7.3 | Integration | R-004 | 1 | Android/Server Dev + QA | Reject one queued payload permanently in a controlled upload harness; measure attempts over time and verify retained/quarantined payload and continued acceptance of later valid items after mitigation. Real queue/transport interaction reveals the upload storm and head-of-line behavior. Failure classification, bounds and quarantine policy must be approved before final oracle; current behavior is expected to expose the stated gap. |
| 7.3-INT-002 | 7.3; AC3 | Integration | R-006 | 1 | Android/Server Dev + QA | Accept an order on the server, drop its acknowledgement, restart the uploader and retry. Verify server state remains correct and local completion happens only after confirmed acceptance. Acceptance and local completion form a data-integrity boundary. Replay/idempotency semantics are UNKNOWN; assert no lost or duplicated parts/labour under approved behavior without inventing endpoint details. |
| 7.3-INT-003 | 7.3; AC2 | Integration | R-006 | 1 | Android/Server Dev + QA | Interrupt upload before acceptance, reject an item and inspect local state; confirmed acceptance retires only the acknowledged revision while unaccepted edits remain recoverable. Tests the acceptance-bound lifetime promised by AC2. Unaccepted work loss has no source-supported workaround; queue completion protocol needs implementation discovery. |
| 7.3-E2E-001 | 7.3; AC4 | E2E | R-008 | 1 | QA + Android Dev | Capture and edit offline, reconnect and open the unchanged dispatcher console; compare work-order identity, parts and labour with the expected final accepted payload. Full native-to-server-to-dispatcher journey proves unchanged order outcome. Corrupted order details are critical data-integrity loss with no stated recovery. Browser involvement is confined to existing dispatcher readback. |
| 7.3-UNIT-002 | 7.1-7.3; AC4 | Unit | R-008 | 1 | Android Dev | Round-trip full queued payload through actual mapping/serialization functions using distinct synthetic fields, empty lists, removed lines and address characters. Assert exact field equality. Isolates field transformation logic; customer-field persistence remains security-scoped in R-001. Does not invent pricing, tax or billing calculations. |
| 7.3-API-002 | 7.3; AC4 | API | R-008 | 1 | Server Dev + QA | Upload a known complete final order payload and read back persisted server order; compare parts, labour, card reference and billing address field by field. Verifies upload/server persistence without UI. Complements pure serialization and dispatcher-facing E2E with distinct boundary assertions. |

**Total P0:** 13 scenarios, approximately 35 to 55 hours.

### P1 (High)

**Criteria:** Core, frequent, or complex behavior with material user reach and a limited workaround. Risk score is supporting evidence and is not a required condition.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-E2E-002 | 7.1; AC1 | E2E | R-006 | 1 | QA + Android Dev | Save offline, kill the process and relaunch; repeat with device restart. Verify captured work remains available with exact content. Lifecycle persistence boundary is a planned assumption derived from local durable save; restart semantics require confirmation. No new scored risk. Primary save-loss coverage remains P0. |
| 7.2-E2E-002 | 7.2; AC2 | E2E | R-006 | 1 | QA + Android Dev | Reopen a captured order offline and edit parts/labour repeatedly while server acceptance is withheld; assert editing remains available and newest content is shown. Core editing availability with material reach. The epic provides no recovery path for a prematurely locked order; record that gap. Actual data loss is covered by P0 persistence cases. |
| 7.2-INT-002 | 7.2; AC2 | Integration | R-006 | 1 | Android/Server Dev + QA | Pause upload at the acceptance boundary and make another edit; verify the new revision stays queued and editable until its own acceptance. Exercises revision-specific lifetime race. Device UI editing path is covered separately. Accepted-versus-unaccepted edit semantics need implementation inspection. |
| 7.3-E2E-002 | 7.3; AC3 | E2E | R-007 | 1 | QA + Android Dev | With a captured backlog, restore an OS-usable network and take no UI action; observe actual scheduled upload and server acceptance. Core automatic-sync journey. Missed event delays delivery while local work remains captured; source-supported manual recovery is unresolved. Automatic-start deadline UNKNOWN. |
| 7.3-INT-004 | 7.3; AC3 | Integration | R-007 | 1 | Android/Server Dev + QA | Drive unavailable, connected-but-unusable and usable-network transitions through Android scheduling; verify usable transition initiates work and repeated callbacks preserve one correct backlog result. Tests OS/client scheduling boundary. Covers network flapping; server equivalence protects against duplicate scheduling without inventing callback timing requirements. |
| 7.3-E2E-003 | 7.3; AC3 | E2E | R-007 | 1 | QA + Android Dev | Restore usable connectivity while app is backgrounded, then foreground it; inspect scheduling and acceptance with no manual sync action. Background execution expectations and Android versions UNKNOWN. A planned lifecycle clarification supplements the explicit usable-network requirement. |
| 7.3-E2E-004 | 7.3; 2,000-item/30-second budget | E2E | R-003 | 1 | QA + Android Dev | Load 2,000 realistic queued entries on a fleet mid-range device, restore usable connectivity and measure until all entries are accepted and locally completed. Every measured qualified run must finish within 30 seconds. Actual hardware/client/server path is required to measure the full target. Deadline breach causes delayed dispatch availability; the epic establishes no critical business cutoff or permanent loss from latency alone. Local queue provides retention, but manual acceleration/recovery is unstated. P1 acceptance gate remains mandatory. |
| 7.3-API-003 | 7.3; backlog throughput | API | R-003 | 1 | Server Dev + QA | Replay representative upload traffic and profile server throughput, latency and errors; diagnose whether server capacity can support complete 2,000-item drain within the device budget. A load harness isolates server bottlenecks. The device E2E result is the authoritative 30-second measure. Concurrent fleet load and request-level latency thresholds UNKNOWN; do not substitute example SLOs. |
| 7.3-INT-005 | 7.3; retry reliability | Integration | R-004 | 1 | Android/Server Dev + QA | Inject transient failure, throttling and mid-upload disconnect, then restore acceptance; assert correct retained payload and eventual completion under approved retry policy. Exercises recovery interaction. Paper re-keying cannot establish recovery of the queued state; approved retry timing UNKNOWN. Permanent upload storm remains P0. |
| 7.3-E2E-005 | 7.3; retry reliability | E2E | R-004 | 1 | QA + Android Dev | On an actual Android device run sustained permanent rejection; capture request rate, CPU, memory, battery and UI responsiveness, then exercise approved recovery path. Device resource evidence complements retry logic. Observation window/resource budgets UNKNOWN and require approval before release qualification. Stop the bounded experiment via harness teardown, which is not a product recovery mechanism. |
| 7.4-E2E-001 | 7.4; release | E2E | R-005 | 1 | QA + Android Dev | Rehearse fleet-enabled release fault containment and queue-preserving replacement-build installation, including one-to-three-day store delay; demonstrate approved rapid disablement if introduced. Operational device/build recovery drill is an end-to-end process. All-technician exposure and delayed disablement are material operational limits. Specific outage consequence/RTO UNKNOWN; classify P1 until evidence establishes critical blocked operation. New control is proposed; current source has no flag, staging or immediate disable path. |
| 7.4-INT-001 | 7.4; release | Integration | R-005 | 1 | Android/Server Dev + QA | Install the release build across the approved fleet matrix and verify enablement configuration; upgrade with queued work and assert preservation against the approved migration policy. Checks build/config/local-storage interaction before full deployment. Upgrade semantics and fleet device list are prerequisites; current release enables every technician. |
| 7.3-INT-006 | Context; scope constraint | Integration | R-008 | 1 | Android/Server Dev + QA | Observe sync traffic and the existing billing boundary while accepting a known payload; verify sync makes no charging call and preserves card reference/address without changing billing schedule/configuration. Bounded regression assertion for explicitly unchanged charging. Existing nightly billing tests remain owned by billing; no card authorization, settlement or double-charge risk is inferred. |
| 7.4-INT-002 | Context; scope constraint | Integration | R-008 | 1 | Android/Server Dev + QA | Inspect release deployment bindings and sync server readback; verify one installation uses its own database/application servers and expected work-order identities. Single-tenant storage separation is supplied as satisfied context. This is a bounded deployment regression assertion; shared-storage tenant attack tests are excluded. |
| 7.4-INT-003 | Context; scope constraint | Integration | R-008 | 1 | Android/Server Dev + QA | Compare deployment routing configuration and sync destination evidence with the existing regional routing baseline; assert routing configuration remains unchanged. Regional routing enforces unchanged residency outside this epic. Baseline evidence must be supplied by Platform; no new residency violation is scored. |

**Total P1:** 15 scenarios, approximately 45 to 70 hours.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround. Risk score is supporting evidence and is not a required condition.

No scenarios in this band. All scoped outcomes are core behavior, data protection/integrity, or essential deployment regressions. The epic introduces no secondary, cosmetic or experimental feature.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |

**Total P2:** 0 scenarios, 0 to 0 hours.

### P3 (Low)

**Criteria:** Rare, cosmetic, or experimental behavior with minimal impact and an easy workaround. Risk score is supporting evidence and is not a required condition.

No scenarios in this band. All scoped outcomes are core behavior, data protection/integrity, or essential deployment regressions. The epic introduces no secondary, cosmetic or experimental feature.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |

**Total P3:** 0 scenarios, 0 to 0 hours.

### Acceptance-Criteria Traceability

| Acceptance Criterion | Primary Planned Evidence | Risk Link |
| --- | --- | --- |
| AC1: Save with no connectivity and see captured listing | 7.1-E2E-001; 7.1-INT-002 verifies durable save/error boundary. | R-006 |
| AC2: Captured order editable until server acceptance | 7.2-E2E-002; 7.2-INT-002 and 7.3-INT-003 verify revision/acceptance boundary. | R-006 |
| AC3: Queue uploads automatically after usable network returns | 7.3-E2E-002; 7.3-INT-004 verifies OS scheduling boundary. | R-007 |
| AC4: Accepted order appears unchanged on dispatcher console | 7.3-E2E-001; 7.3-API-002 verifies server persistence. | R-008 |

Planned mapping: 4 of 4 ACs and 8 of 8 risks. Executed coverage is unmeasured. No existing suite or flakiness evidence was supplied. Pure serialization, storage interactions, API arrival-order permutations and user-facing transitions have separate oracles; overlap on critical paths provides evidence at distinct boundaries. Component coverage is N/A because the supplied scope changes capture state and persistence without a rendering redesign.

---

## Execution Strategy

**Philosophy:** Run all functional scenarios on pull requests while measured duration stays below 15 minutes. Move suites with material device/infrastructure or duration cost to scheduled execution; each release candidate still requires the full qualification set.

- **PR:** Pure logic, API and SQLite/upload integration tests, native capture/edit/automatic-sync smoke and existing regression checks. Execute the smoke journey first, then remaining P0 before P1. Runner/device parallelism is contingent on isolated data and devices; execution for this design run is sequential.
- **Nightly:** Full backlog timing on actual mid-range devices, sustained permanent rejection/resource profiling and lifecycle/fault variants when they exceed the PR budget.
- **Weekly:** Expanded fleet/OS qualification, server load baselines and release containment/upgrade drill; repeat on the release candidate and after relevant mitigation changes.

No native browser automation is required. The existing dispatcher readback can use its current harness once identified. PR duration is UNKNOWN; measurements decide scheduling. CLI exploration was inapplicable and no browser session was opened.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 13 | Planning range about 2 to 5 | Approximately 35 to 55 | Sensitive storage, conflicts, save/ack faults and exact payload oracles. |
| P1 | 15 | Planning range about 2 to 6 | Approximately 45 to 70 | Physical-device performance, lifecycle and operational/regression baselines. |
| P2 | 0 | N/A | 0 to 0 | Empty band. |
| P3 | 0 | N/A | 0 to 0 | Empty band. |
| Total | 28 | Shared fixture effort included | Approximately 80 to 125 | About 2 to 4 calendar weeks with two contributors; 10 to 16 person-days. |

Intervals include fixtures, initial evidence collection and qualification. Product mitigation work, store-review delay and environment provisioning lead time are excluded. Re-estimate after build/harness discovery; the hours/test ranges are planning guides with shared setup.

### Prerequisites

**Test Data:** Synthetic work-order fixture with unique IDs and two assigned technicians; distinct parts/labour revisions; fake card/address markers; realistic 2,000-entry generator; permanent-rejection item mixed with valid work. Match queue counts to actual entries, including appended revisions. Per-run installation/account/order identifiers and deterministic cleanup isolate execution.

**Tooling:** Project-native unit runner for pure transformations/policy; Android instrumentation/device driver for native flows and storage; controlled upload/fault harness; server API/readback and load harness; SQLite inspection and Android resource/monotonic timing tools. Actual runners and versions are UNKNOWN. No Playwright or Pact dependency is present. A server load tool cannot establish the full on-device deadline by itself.

**Environment:** Installable qualified Android build; at least two devices for conflicts; representative physical mid-range fleet devices for timing; isolated single-tenant test server and database; existing dispatcher console read access; controllable network; sanitized logs/storage evidence and approved recovery drill environment. All access and readiness are pending implementation handoff.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- P0 pass rate: 100% of 13 planned scenarios.
- P1 pass rate: ≥95%; all 15 currently planned cases must pass to achieve this rate. Every AC and the explicit performance budget is mandatory.
- P2/P3: N/A for this plan; empty bands have no denominator.
- High-risk mitigation completion: 100% verified before release; unresolved score-9 risks block release. No waiver is granted by this document.
- Critical/high-severity defects: none open. Record skipped, failed and unmeasurable scenarios explicitly.

### Coverage Targets

- Planned AC and material-risk mapping: 100%.
- Executed overall planned-scenario coverage: ≥80%; P0/P1 pass gates above are stricter for the current 28-row plan.
- Critical paths and security scenarios: 100% at their required boundaries.
- Business logic branch coverage: ≥70% if measurable in the future implementation; this is a proposed test gate, with denominator to be agreed.
- Defined edge/fault variants: ≥50% overall, with every variant needed to prove a high-risk mitigation mandatory. Publish the variant list before measuring.

Coverage percentages measure executed outcomes or instrumented branches, as stated; planned rows alone establish mapping.

### Non-Negotiable Requirements

- [ ] All P0 tests pass and security exposure is mitigated with evidence.
- [ ] Every risk scoring ≥6 has implemented mitigation, named owner and verification.
- [ ] Conflict preservation/recovery and acceptance-bound queue lifetime have approved, tested semantics.
- [ ] All qualified 2,000-item device runs finish within 30 seconds, measured from OS usable-network report until server acceptance and local completion of the full backlog.
- [ ] Retry/quarantine recovery and queue-safe release containment are verified under the chosen approved policies.
- [ ] Evidence exists for each in-scope NFR category; `nfr-assess` makes the final evidence decision once implementation exists.

A later formal exception must name approver, rationale, compensating control and expiry. It remains a separate release decision. This workflow declares no implementation PASS/CONCERNS/FAIL status.

---

## Mitigation Plans

### R-001: Sensitive plaintext queue (Score: 9)

**Mitigation Strategy:** Review payload minimization and approved at-rest protection/key ownership. Inspect main SQLite file, journals/WAL and retained copies after save/edit/sync; use fake sensitive markers and sanitize evidence.
**Owner:** Android lead + Security.
**Timeline:** Decision before implementation sign-off; verification before release.
**Status:** Planned; OPEN.
**Verification:** 7.1-INT-001 must first characterize the stated plaintext design, then prove approved protection. Screen-lock presence alone does not close the queue-storage exposure.

### R-002: Silent arrival-order overwrite (Score: 9)

**Mitigation Strategy:** Product and engineering decide conflict/version semantics and recoverable history. Preserve recoverability of both technicians' work and prevent stale appended revisions from silently destroying later intent.
**Owner:** Server + Android leads; Product approves the resolution outcome.
**Timeline:** Policy before implementation sign-off; verification before release.
**Status:** Planned; OPEN.
**Verification:** 7.2-API-001, 7.2-E2E-001 and 7.2-INT-001 verify server permutations, cross-device user outcome and revision ordering respectively. Current silent overwrite demonstrates the gap.

### R-003: Full-backlog sync budget (Score: 6)

**Mitigation Strategy:** Confirm fleet hardware/network/payload profile, then measure complete drain. Profile SQLite/read/serialization, upload and server acceptance; optimize measured bottlenecks. Keep the 30-second target unchanged.
**Owner:** Android + server performance owners.
**Timeline:** Baseline before candidate; qualifying runs before release.
**Status:** Planned; OPEN.
**Verification:** 7.3-E2E-004 is authoritative; 7.3-API-003 diagnoses server capacity. Record all qualified runs and failures; request latency averages do not replace full-backlog completion.

### R-004: Unlimited immediate retry (Score: 9)

**Mitigation Strategy:** Approve transient/permanent response handling, bounded attempt/delay policy and observable quarantine with recovery. Preserve rejected work and prove valid work can progress. Numerical limits remain UNKNOWN until approved.
**Owner:** Android + server leads.
**Timeline:** Policy before implementation sign-off; fault evidence before release.
**Status:** Planned; OPEN.
**Verification:** 7.3-UNIT-001, 7.3-INT-001, 7.3-INT-005 and 7.3-E2E-005 supply policy, queue/transport recovery and real-device resource evidence. Bound the experiment in the harness; stopping the process leaves the product's rejection unresolved.

### R-005: Fleet-wide enablement and delayed disablement (Score: 6)

**Mitigation Strategy:** Decide whether to add staged enablement/rapid disablement or define a defensible containment and queue-safe replacement-build path. Rehearse store-delay recovery and queued-work upgrade. Current design provides no flag or immediate disable control.
**Owner:** Release lead + Android lead; Product approves recovery objectives.
**Timeline:** Decision before candidate; drill before release.
**Status:** Planned; OPEN.
**Verification:** 7.4-E2E-001 and 7.4-INT-001 provide recovery and build/queue evidence. A proposed flag does not count as an existing control. Approved RTO and any new control are UNKNOWN.

### R-006: Captured work lost before acceptance (Score: 6)

**Mitigation Strategy:** Make successful capture contingent on a durable local commit and retire only confirmed accepted revisions. Preserve unaccepted edits after upload/ack faults; agree replay semantics.
**Owner:** Android lead with Server support.
**Timeline:** Persistence design before implementation sign-off; verification before release.
**Status:** Planned; OPEN.
**Verification:** 7.1-INT-002 and 7.1-E2E-001 prove local save and UI outcome; 7.3-INT-002/003 and 7.2-INT-002 prove acknowledgement and revision lifetime. Lifecycle variants supplement this evidence.

All residual scores remain inherent scores until verification. Attach evidence and re-score with owner/date before claiming any mitigation complete.

---

## Assumptions and Dependencies

### Assumptions

1. The existing work order can be opened on a device before connectivity is lost. Offline authentication/cache prerequisites are UNKNOWN; confirm through implementation discovery.
2. Durable local capture should survive process death and device restart. Lifecycle and upgrade semantics require owner agreement; their tests are boundary explorations under R-006/R-005.
3. Upload replay, accepted-revision identity and conflict history can be inspected. Endpoint/schema, idempotency and version semantics are UNKNOWN.
4. Android usable-network events can be controlled and correlated with server acceptance. Background execution expectations and supported OS versions are UNKNOWN.
5. The business consequence of missing 30 seconds is delayed delivery from a retained queue. A critical dispatch cutoff, exact manual recovery route and permanent loss from latency alone are unstated clarification items.
6. Immediate repeated rejection creates unbounded requests by the stated design. Device-resource budgets and valid-item starvation need measurement; no existing terminal recovery route is stated.
7. Security, conflict, retry and operational safeguards are recommendations. Their approvals remain pending; the supplied docs remain unchanged.

### Dependencies

1. Android/Server deliver build, endpoints, seed/readback and fault injection before functional execution.
2. Security/Product/Tech approve storage, conflict and retry/recovery semantics before mitigation qualification.
3. Fleet/Platform supply device/OS/network profile and isolated deployment before performance qualification.
4. Release owner provides queue-safe containment/update path and recovery objective before candidate drill.
5. Dispatcher/Billing/Platform supply baseline regression evidence and shared-environment coordination before release qualification.

### Risks to Plan

- Missing build/harness/device access prevents measured coverage. QA and engineering must resolve entry blockers; keep execution unmeasured until available.
- Unknown conflict/retry/storage policies prevent definitive mitigation oracles. Characterize stated hazards first; publish approved outcomes before closing risks.
- Unknown hardware/network/concurrency profiles prevent repeatable performance evidence. Qualify the run profile without changing the 2,000-item/30-second requirement.
- Unspecified recovery objective prevents meaningful containment acceptance. Record the one-to-three-day source limitation and obtain an owner decision before release.

### Implementation Planning Handoff

Schedule storage protection, conflict preservation, retry recovery, atomic acceptance-bound persistence and release containment decisions with their role owners. QA needs native/device fixtures, transport fault injection and evidence collection. These are planning dependencies for a subsequent implementation workflow.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-automate` in red mode when explicitly requested to implement P0 tests after pending policy decisions provide definite oracles.
- Run `/bmad-testarch-automate` for remaining coverage when implementation exists.
- Run `nfr-assess` after collecting implementation evidence. This run generated no tests and started none of these workflows.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: TBD; date pending.
- [ ] Tech Lead: TBD; date pending.
- [ ] QA Lead: TBD; date pending.

**Comments:** Draft ready for team review. Owner names, exclusions, mitigation policy and qualification profiles require team sign-off. No approval or waiver has been inferred; design completion is recorded independently.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| Android order screen and SQLite queue | New offline save/edit state and durable outbound payload. | Existing online save/edit/status regressions must pass; native capture, transaction fault and lifecycle evidence verifies new boundaries. No existing suite was supplied. |
| Android connectivity/uploader | OS-driven sync, retry and acceptance lifetime. | Existing upload/connectivity behavior plus new scheduling, rejection and ack-fault tests; Android and server owners coordinate harness state. |
| Order server and database | Final accepted lines, concurrent edits and complete-backlog load. | Existing order ingestion/readback regressions; controlled arrival-order/history and payload equality checks. Server owner supplies isolated persistence access. |
| Existing dispatcher console | Displays accepted order unchanged. | Existing display/online-order tests plus AC4 readback only; coordinate access with dispatcher owner. |
| Existing billing service | Charging and schedule remain unchanged; card/address fields pass through queue. | Existing billing/reference/schedule regressions remain with billing owner; 7.3-INT-006 asserts no sync charging call or config/schedule change. |
| Installation database/server and regional routing | Existing separate storage and residency routing remain unchanged. | 7.4-INT-002/003 verify baseline bindings; Platform retains full installation/routing regression ownership. |
| Release build/store update path | All-technician enablement and delayed update recovery. | Build enablement and queued-work upgrade checks, approved recovery drill; Release/Fleet coordinate devices and candidate builds. |

No existing automated suite or baseline evidence is present in the supplied fixture. These are required regression scopes and owner dependencies; passing status is unmeasured.

---

## Appendix

### Knowledge Base References

- `bmod-tea/knowledge/risk-governance.md`: categories, ownership and mitigation governance.
- `bmod-tea/knowledge/probability-impact.md`: 1-to-3 scoring scales and remediation thresholds.
- `bmod-tea/knowledge/test-levels-framework.md`: unit, integration, API and E2E boundary selection.
- `bmod-tea/knowledge/test-priorities-matrix.md`: consequence/reach/recovery-based priority.
- `bmod-tea/knowledge/nfr-criteria.md`: threshold and planned evidence discipline.

The five fragments were selected in this order from `tea-index.csv`. Unconfigured integration/browser flags opened no optional branch. The epic explicitly identifies native Android; repository scanning found no implementation manifests. Server context is retained. Capability probing was disabled and orchestration resolved to sequential.

### Related Documents

- Epic and sole requirements source: [Epic 7](../../docs/epics/epic-7-offline-order-capture.md).
- Configuration: `field-order-capture/_bmad/config.toml`, sections `[core]` and `[modules.tea]`.
- Workflow/template/checklist: `skill/instructions.md`, sequential `skill/steps-c/step-01` through `step-05`, `skill/test-design-template.md`, `skill/checklist.md`.
- PRD, architecture, tech spec and sprint status: N/A for this run by supplied scope.
- Prior test design and existing tests: none supplied.

### Workflow Validation Record

All five create steps completed in order. Template sections, risk IDs/categories/product scores, high/medium/low ranges, one canonical level per coverage row, risk linkage, counts, AC mapping, mitigation ownership/timeline, residual risk and interval estimates were checked against `skill/checklist.md`.

System-level outputs, architecture-only prerequisites, browser-client parallelization and sprint/status-file edits are N/A. Native runner/device parallelism remains an implementation decision. Approval, named staffing, executed coverage and NFR findings remain pending; workflow validation checks the plan's completeness. P0 represents 13 of 28 cases because the supplied design explicitly includes sensitive data and silent loss hazards; lower-risk test padding would distort the scope. No browser sessions were opened and no temporary design artifacts are retained.

Quality & Testing Progress: Epic 7, full epic-level design complete on 2026-10-13. See the scoped workflow checkpoint for step history.

**Generated by:** BMad TEA Test Architect workflow.
**Workflow:** `bmad-testarch-test-design`.
**Template version:** 4.0 (BMad v6); step-file instructions version 5.0.

---
