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

## Step 1: Mode and prerequisites

Create mode; epic-level; full design; sequential execution; capability probe disabled.
Epic 7 is the sole requirements source: `field-order-capture/docs/epics/epic-7-offline-order-capture.md`.
Acceptance criteria are available. Architecture is optional and absent by design; no PRD or sprint status is required.
Run identity: epic / epic-7. No current or legacy scoped checkpoint existed.
Config: project field-service-platform; user tea-eval-harness; English communication and output.
Artifacts: `field-order-capture/test-artifacts/test-design/`.

## Step 2: Loaded context

Config utility flags and browser automation are unset, so no opt-in integrations are activated. test_stack_type defaults to auto. Repository scan found only config and epic; the epic explicitly establishes native Android, SQLite, server persistence and an unchanged dispatcher console. Detected stack: mobile, based on requirements; backend implementation and manifests are unavailable.

Requirements: AC1 offline save and captured list; AC2 editable until server acceptance; AC3 automatic upload on network recovery; AC4 unchanged server order on dispatcher console. Stories add append-only edits, arrival-order overwrites, 2,000 entries within 30 seconds, unlimited immediate retries, and all-user release with store recovery taking 1–3 days.

Integration boundaries: Android save to SQLite; Android usable-network signal to uploader; uploader to server persistence; server order to unchanged dispatcher console. Single-tenant installations share no storage. Regional routing and nightly billing are unchanged. Stored card reference and billing address remain within local-storage security scope.

No existing tests, fixtures, runners, flaky-test evidence, prior system designs, source code, target URL or runnable app are supplied. All planned coverage is new; observed implementation coverage is unknown. PRD, architecture and sprint status are intentionally absent. No browser exploration applies to the native Android client.

Deterministic fragment selection in order: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md, nfr-criteria.md. NFR branch matches security, performance, reliability and operations. Contract/Pact branches do not match repository facts or task intent. Browser CLI branch does not match the unset flag. No additional fragments selected. Requirements and configuration inputs are complete for this run.

## Step 3: Risk and NFR assessment

System-level architecture review does not apply to this epic-level run.
Probability: 1 unlikely, 2 possible or unmeasured, 3 likely or explicitly described failure. Impact: 1 minor, 2 degraded workflow, 3 critical data/security exposure or fleet outage. Scores are probability × impact. All risks are OPEN. Role owners are proposed assignments; due milestones are planning deadlines.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1 stores full payload, card reference and billing address in unencrypted SQLite with screen lock as the sole control. Obtaining file access exposes sensitive customer data. Exposure is possible; plaintext storage is certain. | 2 | 3 | 6 | Minimize sensitive local fields and protect persisted data and key access; verify files and sidecars with synthetic markers. | Android lead and Security | Storage control decision before implementation; evidence before release |
| R-002 | DATA | Story 7.2 permits two offline technicians, accepts edits by arrival order without version/timestamp checks, and silently discards earlier lines with no record. Work and order history are irrecoverably lost. The failure is explicitly described. | 3 | 3 | 9 | Agree conflict/version handling and preserve displaced edits with visible resolution or an audit record; reproduce both arrival orders. | Backend lead and Product | Conflict policy before implementation; resolution evidence before release |
| R-003 | PERF | Story 7.3 requires 2,000 queued items to sync within 30 seconds on fleet mid-range devices. Throughput is unmeasured; exceeding this bound delays dispatch visibility and blocks the stated full-day workload requirement. | 2 | 3 | 6 | Profile the real queue/uploader/server path, tune processing, and measure all-item completion on actual fleet hardware. | Android lead and Performance QA | Fleet and network profile before performance execution; evidence before release |
| R-004 | TECH | Story 7.3 retries rejected uploads immediately forever with no backoff, cap or dead-letter path. A permanently invalid payload drives a sustained request storm and drains device resources; valid backlog progress may be obstructed. Retry storm is explicitly described; queue starvation needs measurement. | 3 | 3 | 9 | Distinguish terminal/transient errors; agree bounded retry/backoff and quarantine handling; keep valid work progressing and retain rejected data for recovery. | Android lead and Backend lead | Retry/error policy before implementation; fault and resource evidence before release |
| R-005 | OPS | Story 7.4 enables every technician in one release with no feature flag, staged rollout or disable path; store recovery takes 1–3 days. A severe capture/sync defect reaches the fleet and remains active through the recovery delay. Defect occurrence is possible; slow recovery is certain. | 2 | 3 | 6 | Agree an operational containment and recovery mechanism; rehearse queue-preserving corrective build and release response against the documented 1–3-day delay. | Release lead and Product | Recovery decision before release candidate; rehearsal before release |
| R-006 | DATA | Stories 7.1–7.3 and AC1, AC2, AC4 require durable offline save, append-only editable queue entries, and unchanged accepted orders. A queue write, append/upload ordering or acknowledgement-boundary error can lose or alter captured parts/labour and customer fields. These are unverified new persistence/integration boundaries. | 2 | 3 | 6 | Atomic durable writes; preserve entry order and edits through acknowledgement; compare captured, queued, accepted and dispatcher-visible payloads; inject interrupted saves/uploads. | Android lead and Backend lead | Persistence/acceptance semantics before implementation; evidence before release |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | BUS | Story 7.3 and AC3 rely on the Android usable-network signal to start upload without technician action. A missed signal or scheduling failure leaves captured orders queued while connectivity is available, delaying dispatch. Boundary behavior is unverified. | 2 | 2 | 4 | Exercise real usable-network transitions and uploader scheduling; retain queued work across connectivity changes. | Android lead | Before release |

### Low-Priority Risks (Score 1–2)

No low-priority risk is supported by the supplied epic.

| Risk ID | Category | Description | Probability | Impact | Score |
| --- | --- | --- | --- | --- | --- |

### NFR planning

Security: local sensitive storage is in scope. Protection, key management and retention acceptance thresholds are UNKNOWN; proposed controls require Product/Security agreement. Planned evidence: synthetic marker extraction and device file/key inspection.
Performance: full 2,000-item backlog accepted within 30 seconds of usable connectivity on fleet mid-range devices. Device models, Android versions, payload distribution and network profile are UNKNOWN. Planned evidence: monotonic timing, accepted-item ledger and device CPU/memory/network profiles.
Reliability/data integrity: captured save persists; edits remain possible until acceptance; automatic sync; unchanged accepted order. Retry attempt/backoff/dead-letter and conflict-resolution policies are UNKNOWN. Current infinite retry and silent overwrite behavior are explicit concerns. Planned evidence: fault injection, SQLite snapshots, request counts, server records and native flows.
Operations: all-user release with recovery build delayed 1–3 days. Containment mechanism, incident detection and recovery objectives are UNKNOWN. Planned evidence: release rehearsal and preservation of pending queues during corrective upgrade.
Scalability: supported client backlog is 2,000. Fleet concurrency is UNKNOWN and can inform later server load planning; it adds no separate scored risk.
Maintainability: no code/test baseline or thresholds are provided; UNKNOWN. Execution evidence and owner mapping are planned, with no invented coverage percentage requirement.
Compliance obligations are UNKNOWN. Regional routing and installation isolation are explicitly satisfied constraints; regression assertions will confirm the established path. Charging and renderer changes are out of scope. No PCI/GDPR certification requirement is inferred from the card reference.

Highest priorities are R-002 and R-004 (score 9); R-001, R-003, R-005 and R-006 require documented mitigation. This is planned validation, with no final implementation NFR result or executed release gate. Mitigations are recommendations and remain unimplemented. Missing thresholds are recorded for owner decisions without pausing this run.

## Step 4: Coverage and execution plan

Priorities use business consequence, reach and current recoverability: P0 critical business/security/data integrity with no safe workaround; P1 core/frequent/complex behavior with material reach and a limited workaround; P2 secondary behavior with narrower reach and acceptable workaround; P3 rare/cosmetic/experimental behavior with minimal impact and easy workaround. Risk score supports this judgment. Proposed mitigation does not count as an existing workaround.

R-003 is refined to probability 2, impact 2, score 4: the epic supplies a throughput acceptance bound and delayed dispatch visibility, with durable queued work. It establishes no separate critical business deadline or permanent loss caused by exceeding 30 seconds. Business impact beyond delay and recovery-time guarantees remain UNKNOWN. Performance remains a mandatory release acceptance check at P1. R-007 remains P1 for the core automatic-sync boundary; recovery from missed scheduling is UNKNOWN. The historical paper/re-key workflow offers a costly fallback for capture; it cannot restore silently overwritten records or contain exposure/retry storms.

### P0 coverage

| Test ID | Requirement / Scenario | Test Level | Risk Link | Owner | Notes / oracle and priority rationale |
| --- | --- | --- | --- | --- | --- |
| 7.1-E2E-001 | AC1: open an existing order offline, add parts/labour, save and reopen captured list | E2E | R-006 | QA | Native Android flight-mode journey; captured order and complete lines persist after restart. Captured work loss is critical; re-key cannot recover lost lines. |
| 7.1-INT-001 | Interrupt SQLite save at the commit boundary | Integration | R-006 | Android | Real SQLite and application write path; committed save survives process termination, failed save preserves prior state and avoids a false captured status. Persistence failure loses work. |
| 7.1-INT-002 | Inspect outbound SQLite and sidecars containing synthetic address/card-reference markers | Integration | R-001 | Security and Android | Test device file access demonstrates current plaintext exposure. Proposed closure requires agreed local-data/key protection; screen lock supplies no protection once file access exists. Sensitive exposure has no documented recovery workaround. |
| 7.2-UNIT-001 | Serialize edits containing distinct parts/labour and customer fields | Unit | R-006 | Android | Pure payload transformation preserves exact field values and latest edited content. Loss/alteration of order data is critical. |
| 7.2-INT-001 | Append repeated edits and upload them with controlled acknowledgements | Integration | R-006 | Android | Real SQLite/uploader boundary retains earlier entries before acceptance; latest intended state reaches server in correct order. Avoid a stale edit overwriting the latest edit. |
| 7.2-E2E-001 | AC2: edit a queued order while server acceptance is delayed | E2E | R-006 | QA | Native edit remains available until acceptance and latest lines reach server. Post-acceptance edit policy is UNKNOWN; this row asserts only the stated boundary. |
| 7.2-API-001 | Two offline technicians edit the same work order; deliver A/B and B/A | API | R-002 | Backend and QA | Real server persistence reveals arrival-order overwrite and missing history. Proposed closure: agreed conflict/version policy preserves both contributions or surfaces an auditable conflict. Silent loss cannot be recovered under current policy. |
| 7.3-INT-001 | Server accepts an upload; acknowledgement is lost and upload repeats | Integration | R-006 | Android and Backend | Inject loss after real server commit; queued work remains until acceptance is known and replay leaves the intended complete order. Transport failure after commit must preserve captured data; duplicate-acceptance policy is UNKNOWN. |
| 7.3-INT-002 | Permanently reject one queued payload while valid entries follow | Integration | R-004 | Android and Backend | Bound the laboratory observation window; capture attempts, valid-item progress and CPU/network/battery trend. Current infinite immediate loop is expected; closure needs agreed terminal handling and bounded retries. Stopping the app leaves the order unresolved. |
| 7.3-UNIT-001 | Classify terminal/transient failures and choose retry transitions | Unit | R-004 | Android | Future policy validation uses deterministic clock once backoff/cap/quarantine rules are approved. A retry storm has no source-backed containment path; no retry numbers are invented. |
| 7.3-E2E-001 | AC4: captured and edited order syncs and appears unchanged to dispatcher | E2E | R-006 | QA | Native capture through real server to existing dispatcher console. Compare work-order identity, full parts/labour, address and stored reference at server; compare fields exposed by existing console. No console redesign is assumed. |
| 7.4-E2E-001 | Release incident rehearsal and corrective build upgrade with pending queue | E2E | R-005 | Release and QA | Real Android build/upgrade and server path verify pending work survives recovery. Record containment options and 1–3-day store-delay consequences. Fleet-wide critical defects have no disable path; a signed containment/recovery decision remains required. |

### P1 coverage

| Test ID | Requirement / Scenario | Test Level | Risk Link | Owner | Notes / oracle and priority rationale |
| --- | --- | --- | --- | --- | --- |
| 7.3-E2E-002 | AC3: usable network returns after offline capture | E2E | R-007 | QA | Real Android network transition triggers upload with no tap/relaunch; compare queued and accepted items. Core sync delay has material reach; permanent loss is unstated and scheduling recovery is UNKNOWN. |
| 7.3-INT-003 | Repeated usable-network callbacks and connectivity interruption during upload | Integration | R-007 | Android | Exercise Android callback/uploader scheduling boundary; resumable queued work progresses after a final stable transition without technician action. Callback orchestration gets lower-level isolation. |
| 7.3-E2E-003 | 2,000 queued items complete within 30 seconds on fleet mid-range device | E2E | R-003 | Performance QA and Android | Device-to-server performance journey; monotonic t0 is first usable-network report, t1 is last accepted-item acknowledgement plus queue reconciliation. Every run must finish ≤30 seconds with all items accounted for. Threshold is mandatory; delay is documented, critical deadline/permanent loss is unstated. |
| 7.3-INT-004 | Queue sizes 0, 1, 1,999 and 2,000 drain with all items accounted for | Integration | R-003 | Android | Parameterized real SQLite/uploader/server boundary confirms empty/capacity bookkeeping; device timing belongs to the distinct E2E row. Full-day throughput depends on correct backlog handling. |
| 7.4-INT-001 | Sync respects unchanged routing, installation storage and billing boundaries | Integration | R-005 | Backend and Release | Verify configured regional route, separate installation DB/server path and zero calls to billing from capture/sync; card reference round-trips unchanged. Scope-constraint regression guards release integration. No tenant-sharing or residency vulnerability is inferred. |

P2 and P3 contain no scenarios: the epic defines essential capture/sync and high-impact release concerns; cosmetic, secondary, browser-rendering and unrelated features are outside scope. There are 17 planned scenarios: 12 P0, 5 P1; 7 E2E, 7 Integration, 2 Unit, 1 API. Parameterized cases count as one scenario row. All four ACs and all seven risks have planned coverage; existing execution evidence remains unavailable.

NFR evidence: Security R-001 file/key-access findings; performance R-003 timestamps, accepted-item ledger and device profiles; reliability R-002/R-004/R-006/R-007 queue snapshots, request logs, fault timing and server/console comparisons; operations R-005 upgrade/incident rehearsal and recovery record. Sanitize artifacts and use synthetic sensitive fields. Missing policy thresholds, fleet models/network profiles, build and test seams block later execution or mitigation closure, while this design can be completed. Scalability uses the stated backlog bound; concurrency and maintainability metrics remain UNKNOWN without invented gates. Formal compliance scope is UNKNOWN.

Execution: sequential PR functional unit/integration/API and native smoke coverage if measured total is under 15 minutes; isolate each run's data. Nightly extended native/fault tests and 2,000-item physical-device measurements; weekly long offline soak and release/upgrade recovery rehearsal. These cadences never exempt mandatory pre-release cases. Execute P0 first, then P1, and all listed checks before release. No actual tests are generated or run here.

Resource estimates for later automation and first verification: P0 ~40–65 hours; P1 ~20–35 hours; P2/P3 0 hours for this scope; total ~60–100 hours, ~2–4 working weeks with Android/Backend/Security/Release support and one QA owner. Setup is included; implementation of recommended product controls is additional and unestimated. Runtime targets are unmeasured, including the proposed PR budget.

Quality gates: P0 100%; P1 ≥95%; every AC and material risk executed with evidence (100% of scoped requirement/risk mapping, exceeding default 80% because only four ACs and seven material risks exist). With five P1 rows, ≥95% requires all five to pass. The 2,000-item/30-second threshold always passes before release. Complete high-risk mitigations and resolve score-9 blockers before release; attach ownership and deadlines. Any exception requires authorized human decision with reason and expiry; no waiver exists in this run. NFR evidence sources must be available; final NFR verdict belongs to nfr-assess after implementation.

## Step 5: Completed output and validation

Resolved execution: sequential; explicit user override; probe false; no delegation.
Output: `field-order-capture/test-artifacts/test-design/test-design-epic-7.md`, populated in the supplied template's section order.
Final risk summary: seven OPEN risks, five score ≥6, two score 9. R-003 final score 4 per step 4 refinement.
Coverage: 12 P0, five P1; six E2E, eight Integration, two Unit, one API. Planned mapping covers every AC and material risk.
Gate plan: P0 100%; P1 ≥95% (all five rows); all AC/risk mappings executed; 2,000 items within 30 seconds; high-risk controls complete.
Unknown policies and environments recorded; no final implementation NFR verdict, tests, release or stakeholder approval claimed.
Checklist applied to epic-level sections in full. System-level outputs/handoff, absent optional inputs/status integration and browser-specific checks are N/A. Design-only counts and effort ranges checked; source evidence, canonical IDs, table levels/numeric scores and local links verified. Docs inventory and SHA-256 content unchanged. No browser sessions opened. Temporary assembly material removed after validation; no exploration artifacts exist.
