---
runScope: 'epic'
runKey: 'epic-7'
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
  - 'bmod-tea/knowledge/tea-index.csv'
  - 'bmod-tea/knowledge/risk-governance.md'
  - 'bmod-tea/knowledge/probability-impact.md'
  - 'bmod-tea/knowledge/test-levels-framework.md'
  - 'bmod-tea/knowledge/test-priorities-matrix.md'
  - 'bmod-tea/knowledge/nfr-criteria.md'
---

# Epic 7 test design progress

## Step 1: Detect mode and prerequisites

- Mode: epic-level, Create, full design, sequential execution, capability probe disabled.
- Identity: run_scope epic; epic_num 7; run_key epic-7.
- Requirements: docs/epics/epic-7-offline-order-capture.md contains stories 7.1 through 7.4 and acceptance criteria.
- Architecture, PRD and sprint status are outside the supplied input set; all required prerequisites are available.
- No prior scoped checkpoint exists. Fresh run.
- Config: user tea-eval-harness; project field-service-platform; communication and document languages English.
- Deliverable: test-artifacts/test-design/test-design-epic-7.md.


## Step 2: Context and knowledge

- Config integration flags and browser automation are unset. Stack auto-detection finds no manifests; the epic explicitly establishes native Android, SQLite, a server ingestion boundary and an unchanged dispatcher console. Detected client stack: mobile; server language and runner unknown.
- No source code, existing tests, fixtures, flaky-test evidence, prior system plans or Pact artifacts are supplied. Baseline coverage is unknown and every epic scenario requires planned coverage.
- Requirements: offline save with captured status; edit until acceptance; automatic reconnect upload; payload unchanged at dispatcher; append-only revisions; two-technician concurrent offline edits; 2,000 items within 30 seconds on mid-range fleet devices.
- Known design facts: unencrypted full payload, arrival-order overwrite without audit, immediate indefinite retries, universal release with one-to-three-day store recovery.
- Loaded closed-set fragments in order: risk-governance, probability-impact, test-levels-framework, test-priorities-matrix, nfr-criteria. NFR branch matches security, performance, reliability and operations. Browser, Playwright and Pact branches do not match configuration and repository facts.
- Browser exploration inapplicable to the native client and no runtime is supplied. No capability probing.
- The epic is the sole requirements source. All required inputs are available.


## Step 3: Risk and NFR planning

System-level architecture review is conditional on system-level mode; this run is epic-level. Scoring: probability 1 unlikely, 2 possible, 3 likely or explicit known weakness; impact 1 minor, 2 degraded with workaround, 3 critical exposure, irreversible data loss or widespread outage. Score is probability times impact. Scores 6 to 8 require mitigation; score 9 is a planned release blocker while open. All statuses are OPEN; these are design assessments with no executed implementation evidence.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1 explicitly persists the full order, stored card reference and billing address in an unencrypted SQLite file with only a screen lock. An extracted queue exposes customer and billing data. Plaintext persistence is certain; extraction likelihood is possible, so probability is 2. | 2 | 3 | 6 | Propose payload minimization and protected at-rest storage with device key protection; inspect queue and journal artifacts with synthetic sentinels. | Android lead and Security | Agree protection before implementation; verify before release. |
| R-002 | DATA | Story 7.2 permits two technicians offline on one order, appends edits and applies arrival order with no version or timestamp check. Reconnect ordering silently overwrites earlier lines with no audit record; this is a known destructive path. | 3 | 3 | 9 | Propose version-aware conflict handling and retained revisions; force both arrival orders and same-device revision reordering, proving no silent loss. | API lead and Android lead | Set conflict policy before implementation; verify before release. |
| R-003 | PERF | Story 7.3 requires 2,000 queued items to sync within 30 seconds on fleet mid-range devices. The large backlog, mid-range hardware and unmeasured device/network/server pipeline give high uncertainty (probability 3). Missing the deadline degrades timely dispatch while orders remain recoverable in the queue (impact 2); its business deadline consequence is unstated. | 3 | 2 | 6 | Profile complete device-to-server draining; consider batching and bounded concurrency with ordering guarantees; require all 2,000 acknowledgements within 30 seconds. | Android lead and API performance owner | Baseline first integrated build; pass target before release. |
| R-004 | TECH | Story 7.3 retries failed uploads immediately and indefinitely with no backoff, cap or dead-letter path. A permanently rejected item drives an endless request loop, consumes device/network/server resources and may obstruct valid items. | 3 | 3 | 9 | Propose classified failures, bounded retry with backoff and recoverable quarantine; measure permanent/transient failure requests and healthy-item progress. | Android sync lead and API lead | Define policy before implementation; fault-injection proof before release. |
| R-005 | OPS | Story 7.4 enables the feature for all technicians at once; disabling requires a new store build with a one-to-three-day delay. A defect can disrupt the entire installation for days. A triggering defect is possible, so probability is 2. | 2 | 3 | 6 | Propose a tested disable/containment path or staged enablement; rehearse recovery preserving captured orders and document store-delay exposure. | Release owner and Operations | Resolve containment before release approval; rehearse on release candidate. |

### Medium-Priority Risks (Score 3 to 4)

No identified risks in this band.

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |

### Low-Priority Risks (Score 1 to 2)

No identified risks in this band.

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |

NFR plan: security storage protection (R-001), reliability and integrity (R-002/R-004), 2,000/30-second performance (R-003), recoverability (R-005). Security protection policy, accepted conflict handling, retry limits, recovery objective, exact fleet/OS/network profile, payload distribution and fleet reconnect concurrency are UNKNOWN. Resolve as planning dependencies without inventing product thresholds. Compliance applicability is UNKNOWN; no claim of legal or PCI scope is made. Scalability is scoped to the stated queue bound; fleet-wide load is a supplemental profile pending installation size. Maintainability evidence can use future tests and CI reports; current code coverage and quality thresholds are UNKNOWN.

Evidence planned: synthetic queue extraction and SQLite journal inspection, forced concurrent edit deliveries with authoritative server revision inspection, physical-device monotonic timing with server receipts, request counters with deterministic faults, release recovery rehearsal retaining queues. No final NFR gate assessment.

Highest priorities: eliminate silent edit loss and endless retry loops; protect queued customer data; establish device performance evidence and release containment. Single-tenant installations with separate storage, unchanged regional routing, unchanged nightly billing and unchanged screen rendering are explicit scope constraints; use bounded regression assertions. They do not introduce additional scored risks.

## Step 4: Coverage and execution plan

Priority criteria: P0 critical business, security or data-integrity consequence with no safe workaround; P1 core/frequent/complex behavior with material user reach and limited recovery; P2 secondary behavior with narrower reach and acceptable workaround; P3 rare/cosmetic behavior with minimal impact and easy workaround. Scores guide remediation separately. Performance deadline violation is a release acceptance failure; its unstated business consequence remains a clarification. The queued work remains pending for later server acceptance, so latency coverage is P1. Release containment is P0 because every technician is exposed and the sole disable path takes one to three days.

### P0 coverage

| Test ID | Requirement / scenario and planned oracle | Test Level | Risk Link | Notes / owner |
| --- | --- | --- | --- | --- |
| 7.1-INT-001 | Story 7.1: save synthetic card-reference/address sentinels; inspect queue database, WAL/journal and extracted file for readable sensitive values. Require the agreed storage protection policy. | Integration | R-001 | Security-critical exposure; screen lock is the sole supplied control and provides no source-backed recovery after extraction. Current plaintext design exposes the sentinels. Android/Security. |
| 7.2-API-001 | Story 7.2: two assigned technicians submit distinct offline lines for one work order in each arrival order. Require both contributions preserved or a recorded, recoverable conflict under the agreed policy. | API | R-002 | Silent irreversible loss has no audit or recovery in the epic. Current arrival-order overwrite fails the safety oracle. Direct API control establishes server persistence/conflict behavior. API lead. |
| 7.2-INT-001 | Story 7.2: append several edits from one client; deliver earlier revision after the latest. Require monotonic revision handling or recorded conflict, retaining the intended final lines. | Integration | R-002 | Revision queue and uploader ordering boundary; mitigation policy prerequisite. Android lead. |
| 7.1-INT-002 | Story 7.1: commit an offline save in real SQLite, terminate/reopen the app before upload, and compare every retained payload field with the saved fixture. | Integration | R-002 | Persistence supports the capture-to-edit integrity path; crash survival is a derived queue boundary check. Android lead. |
| 7.2-INT-002 | AC2: hold server acceptance while an edit appends; release acceptance of the earlier entry. Require the unaccepted edit remains durable and eligible for upload. | Integration | R-002 | Detects lost-edit race at acknowledgement/dequeue boundary. Android lead. |
| 7.3-INT-001 | Story 7.3: place a permanently rejected payload ahead of a valid one. Count requests and prove the invalid payload becomes recoverable under the agreed policy while the valid item reaches the server. | Integration | R-004 | Known infinite immediate retries consume resources; stopping the app leaves orders pending and supplies no recovery. Backoff, cap and quarantine are proposed mitigations. Android sync lead. |
| 7.3-INT-002 | Story 7.3: commit at the server then drop the acknowledgement; retry and reconcile queue with server state. Require retained order integrity and no repeated destructive revision application. | Integration | R-002, R-004 | Fault at upload/acceptance boundary exercises proposed safe replay behavior; evidence includes commit receipts and queue entries. Android/API. |
| 7.3-UNIT-001 | Story 7.3 mitigation: classify permanent versus transient failures and exercise retry schedule, exhaustion and resume states with a controlled clock against the agreed limits. | Unit | R-004 | Tests isolated policy branches; actual request-loop behavior belongs to integration coverage. Retry values UNKNOWN until policy agreed. Android sync lead. |
| 7.1-E2E-001 | AC1: open an existing assigned order on native Android, disconnect, add parts/labour and save. Assert order is listed as captured and reopen it to compare saved lines. | E2E | R-002 | Missing or altered capture loses essential field work. Paper/re-keying is the described current process; it cannot recover silent queued-line loss. Native device journey. QA/Android. |
| 7.4-E2E-001 | Story 7.4: rehearse a faulty release and the proposed containment/replacement path on a release-like installation. Preserve queued orders through recovery and record time until technicians can capture and sync safely. | E2E | R-005 | Universal exposure plus one-to-three-day store disable path leaves essential operation unresolved. End-to-end deployment/device/server rehearsal is suitable for recoverability. Containment mechanism and target UNKNOWN. Release/Operations. |

### P1 coverage

| Test ID | Requirement / scenario and planned oracle | Test Level | Risk Link | Notes / owner |
| --- | --- | --- | --- | --- |
| 7.2-E2E-001 | AC2: reopen captured order offline, edit parts/labour, save and reopen; keep editing while acceptance is held. Assert latest lines and editable state until acceptance. | E2E | R-002 | Native edit-state journey complements server conflict tests; accepted-order behavior outside AC2 remains unspecified. QA. |
| 7.3-E2E-001 | AC3/AC4: restore usable OS connectivity with queued orders and take no action; verify server acceptance then open unchanged dispatcher console and compare order fields with the final expected fixture. | E2E | R-002, R-004 | Validates automatic OS-to-client-to-server-to-dispatcher handoff. Pending queue has the source-backed recovery condition of server acceptance. Dispatcher observation is a read-only regression. QA/API. |
| 7.3-E2E-002 | Story 7.3: seed exactly 2,000 queued items on actual mid-range fleet hardware; restore connectivity and measure monotonic time to all server acknowledgements and reconciled queue completion. Require ≤30 seconds and intact payloads. | E2E | R-003 | Full backlog deadline; delay degrades core operation while work remains queued. Critical business deadline or loss from exceeding 30 seconds is unstated. Physical device timing includes OS scheduling, SQLite and network. QA/performance owner. |
| 7.3-API-001 | Story 7.3: replay representative 2,000-item ingestion and measure server throughput, latency and exact accepted item counts; assess client timing bottlenecks with server receipts. | API | R-003 | Server profiling supplements the device deadline test. 2,000/30 implies at least 66.7 accepted items/second end to end. Fleet concurrency and per-request thresholds UNKNOWN. API performance owner. |
| 7.3-INT-003 | Story 7.3/AC3: inject transient failures and network flaps, then permit acceptance. Require eventual automatic progress and retained pending payloads through disconnections. | Integration | R-004 | The epic explicitly retries until server acceptance, which is the recoverability condition. Policy safety covered separately at P0. Android/API. |
| 7.1-COMP-001 | AC1/AC2: drive queued, editing and accepted state transitions in the native order component; verify captured/list/edit indicators match queue state and existing rendering remains stable. | Component | R-002 | UI state projection; rendering is unchanged. Avoid screenshot-suite expansion. Android lead. |
| 7.4-INT-001 | Story 7.4 mitigation: inject sync failure and confirm proposed telemetry distinguishes pending, accepted, rejected and oldest-item age without revealing customer payloads. | Integration | R-004, R-005 | Detection aids containment; existing telemetry is UNKNOWN and requires a test-access seam. Operations/Android. |
| 7.3-API-002 | Context constraint: ingest a synthetic order into one single-tenant installation and verify its receipt exists only in that installation's separate storage. | API | R-001 | Regression of satisfied deployment isolation; no new tenancy risk. Separate installations and no shared storage remain the supplied model. API/platform. |
| 7.3-API-003 | Context constraint: verify offline upload uses the same platform regional route as the existing online upload and reaches the existing regional server. | API | R-001 | Regression of unchanged residency routing. No residency jurisdiction, platform redesign or new compliance risk inferred. Platform/API. |
| 7.3-API-004 | Context/out-of-scope constraint: observe offline capture and replay through acceptance; require zero new billing-service calls and unchanged nightly-schedule configuration. | API | R-005 | Side-effect regression only; card charging is unchanged and the epic never calls billing. Billing processing tests stay outside this plan. API/release owner. |

P2 and P3 have zero planned scenarios. The scope concerns core offline order work, customer data, deadline validation and release recovery. No screen redesign or optional feature is supplied. Total: 20 scenarios (P0 10, P1 10); levels: Unit 1, Component 1, Integration 8, API 5, E2E 5.

NFR evidence: R-001 sanitized storage inspection with sentinel results; R-002 ordered receipts, revision/audit snapshots and native screenshots; R-003 monotonic timing, hardware/OS/network/payload manifests and server ingestion profiling; R-004 request counts, agreed schedule and pending/rejected queue states; R-005 drill timeline, recovery artifacts and queue-preservation report. NFR thresholds beyond 2,000 within 30 seconds are UNKNOWN and assigned to role owners as entry dependencies. Maintainability uses future CI execution/isolation reports; code-level targets await supplied source.

Execution: PR includes all functional tests if the measured suite fits under 15 minutes; P0 first, then P1. A PR smoke subset covers offline capture, reconnect and dispatch readback if device suites exceed that budget; nightly runs the full functional/device matrix and physical-device backlog benchmark. Weekly runs expensive long-offline/reconnect/soak and release recovery drills. Expensive suites must run against the release candidate before release regardless of cadence. Parameterized boundary cases reuse scenarios; they do not duplicate the same assertion at another level.

Estimates: P0 approximately 30 to 50 hours; P1 approximately 24 to 40 hours; P2/P3 zero planned hours. Shared device/fault-fixture setup approximately 12 to 20 hours. Total approximately 66 to 110 engineering hours, or 2 to 3 calendar weeks with Android, API, QA and Operations participation. Estimates cover implementing/verifying this plan later and exclude product remediation and store review delay. This run generates no tests.

Quality gates: P0 100% pass, P1 at least 95% pass, all four ACs validated and all five risks covered, every explicit deadline/protection/conflict/recovery criterion met. At least 80% overall planned scenario coverage; all 20 scenarios are required for this full design. Complete high-risk mitigations before release, remove open score-9 blockers, retain evidence for every in-scope NFR. Future NFR status belongs to nfr-assess; no execution evidence exists in this run.


## Step 5: Output and validation

- Execution resolved sequential from explicit run configuration; capability probe false. No agents or capability probes launched.
- Generated sole epic deliverable from skill/test-design-template.md: field-order-capture/test-artifacts/test-design/test-design-epic-7.md. System-level documents and handoff are N/A.
- Validated applicable skill/checklist.md criteria: canonical risk columns and five unique IDs; integer scores and multiplication; source grounding; 20 uniquely identified coverage rows with canonical levels and valid risk links; all four ACs mapped; empty medium/low risk and P2/P3 bands; resource ranges; NFR thresholds/evidence/unknowns; entry/exit gates; mitigation ownership, timeline and residual exposure; regression boundaries; intact relative links and no unresolved template placeholders.
- Validation totals: 5 high risks, 2 score-9 blockers, P0 10/P1 10; Unit 1, Component 1, Integration 8, API 5, E2E 5. All checks passed. A text-style check initially treated YAML list markers as clause connectors; restricting that check to prose resolves the false positive without changing valid YAML.
- No live browser sessions were opened; no session cleanup required. Scratch generation script removed. Documentation inputs unchanged by SHA-256 comparison across output generation. No tests generated or execution results claimed.
- Draft stakeholder approval and role-assigned UNKNOWN decisions remain pending. They do not prevent this planning deliverable from completing.

## Quality & Testing Progress

Epic 7, epic-level, full design, run epic-7 completed at 2026-10-14T00:49:19Z (2026-10-13 local date). Output: test-design-epic-7.md. Key risks: plaintext customer data, silent concurrent edit loss, backlog deadline, indefinite retries and delayed containment. Proposed gates: P0 100%, P1 ≥95%, all high-risk mitigations verified, ≥80% baseline scenario coverage with all 20 planned rows evaluated, 2,000 items within 30 seconds and NFR evidence retained. Open assumptions/policies and draft approvals are recorded in the deliverable.
