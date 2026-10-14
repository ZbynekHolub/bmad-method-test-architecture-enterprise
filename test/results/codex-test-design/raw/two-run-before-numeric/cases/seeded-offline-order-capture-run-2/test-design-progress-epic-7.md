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

# Epic 7 test design progress

Mode: Create, epic-level. Design level: full. Execution: sequential. Capability probe: false.

Requirements: docs/epics/epic-7-offline-order-capture.md, the sole epic and sole requirements source. Epic/story requirements and acceptance criteria are present. Architecture context is unavailable and optional. No PRD, architecture document, or sprint status is required for this run.

Configuration: _bmad/config.toml. Project: field-service-platform. User: tea-eval-harness. Communication and output language: English. Run scope: epic. Epic: 7. Run key: epic-7. Output: test-artifacts/test-design/test-design-epic-7.md.

## Step 2: Context loaded

Config flags tea_use_playwright_utils, tea_use_pactjs_utils, tea_pact_mcp, tea_browser_automation are unset. No integration branch opens. test_stack_type defaults to auto. Scan found only config, epic, and workflow progress; no source manifests, tests, fixtures, runners, or prior system plans. Detected stack: mobile from explicit native Android epic context. Server context: order ingestion and persistence; technology unspecified. Browser exploration is inapplicable to native Android capture and no running environment is supplied. Capability probing is disabled.

Required knowledge loaded in deterministic order: risk-governance, probability-impact, test-levels-framework, test-priorities-matrix, then nfr-criteria because security, performance, reliability, and operational requirements are explicit. No Pact artifacts/package or explicit contract-testing request; no contract/Pact fragments. No Playwright CLI branch. Other mobile fragments excluded by the step's closed selection list.

Requirements: offline save and captured indication (AC1, story 7.1); edit until server acceptance (AC2, 7.2); automatic upload on usable network (AC3, 7.3); unchanged order visible in dispatcher console (AC4, 7.3). 2,000 queued items must fully sync within 30 seconds on fleet mid-range Android devices. Integration points: native screen, app-private SQLite queue, OS network notification, uploader, server order storage, existing dispatcher read path. Security data includes stored card reference and billing address. Edits append queue entries. Multiple offline technicians have unversioned last-arrival overwrite. Permanent rejection creates endless immediate retry. Release enables all users with store-only disable delay of 1–3 days.

Existing coverage: none present in supplied repository. All planned checks require later implementation. Flakiness and fixture patterns cannot be assessed. Optional PRD/architecture/sprint artifacts are intentionally absent. No missing requirements input or user question.

## Step 3: Risk and NFR assessment

System architecture review is conditional on system-level mode and does not apply to this epic-level run.

Probability: 1 unlikely, 2 possible or unmeasured, 3 likely or explicitly described defect/control gap. Impact: 1 minor, 2 degraded with recoverable workaround, 3 critical data exposure, irreversible data loss, blocked backlog, or fleet-wide outage. Score = probability × impact. Proposed owners below are roles awaiting assignment.

| Risk ID | Category | Description and source evidence | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Story 7.1: full payload with stored card reference and billing address in unencrypted SQLite; screen lock is the only barrier. A readable queue exposes customer financial identifiers and address data. Known plaintext control gap. | 3 | 3 | 9 | Minimize queued sensitive fields; protect remaining payload at rest and keys using Android platform security; verify database and auxiliary artifacts with synthetic canaries. | Android lead + Security | Before release candidate security sign-off |
| R-002 | DATA | Story 7.2: two offline technicians edit one order; unversioned arrival order overwrites earlier lines and leaves no record. Accepted technician work is irrecoverably lost. | 3 | 3 | 9 | Define product conflict policy; add version/conflict detection or safe merge and retained history; validate both arrival orders and append replay. | Backend lead + Product | Before release candidate data-integrity sign-off |
| R-003 | PERF | Story 7.3 requires all 2,000 queued items to sync within 30 seconds on fleet mid-range Android devices. New backlog sync has high measurement uncertainty; missing the target delays dispatch access while queued work remains recoverable. Critical deadline or permanent-loss consequence is unspecified. | 3 | 2 | 6 | Measure full client-to-server backlog drain on actual fleet devices; profile and optimize queue/read/upload/commit pipeline. | Android lead + Backend performance owner | Benchmark before release approval |
| R-004 | TECH | Story 7.3: immediately retry forever, with no backoff, cap, or dead-letter path. Permanently rejected payload consumes network/server/device resources continuously and can prevent useful backlog progress. | 3 | 3 | 9 | Classify transient/permanent failures; bounded exponential backoff/jitter and Retry-After; isolate permanently rejected items with recoverable status; verify healthy-item progress. | Android sync lead + Backend lead | Before release candidate resilience sign-off |
| R-005 | OPS | Story 7.4: enabled for every technician together; disabling requires store review lasting 1–3 days. Single-release exposure affects every technician; disable recovery is delayed 1–3 days. Fleet-wide operational degradation is bounded by the documented store path. | 3 | 2 | 6 | Recommend staged activation and remote disable or a tested containment/recovery plan; rehearse safe queue retention during disable/update. | Release owner + Operations | Before release authorization |
| R-006 | DATA | Stories 7.1–7.3 and AC1–AC4: captured status follows local queue save; edits append while awaiting acceptance; server order must arrive unchanged. Incorrect durable-save/acknowledgment transitions can falsely report capture, retire pending edits, or replay obsolete payloads. | 2 | 3 | 6 | Transactional queue writes, immutable snapshots, ordered same-device edits, acceptance-correlated retirement and reliable retry identity; validate queue-to-server-to-console equality. | Android lead + Backend lead | Before release candidate functional sign-off |

All six risks score ≥6; three score 9. Medium (score 3–4) and low (score 1–2) bands have no identified risks. No generic payment, tenancy, residency, browser-rendering, or contract risks added. The epic explicitly satisfies installation isolation and existing residency routing, leaves billing untouched, and has native Android capture with unchanged rendering.

NFR planning: security (R-001), performance/scalability within 2,000-item per-device envelope (R-003), reliability (R-002/R-004/R-006), and operational recovery (R-005). Exact product performance threshold: 2,000 items accepted within 30 seconds after usable connectivity returns on fleet mid-range devices. Planned evidence: monotonic client timestamps, server commit/ack traces, queue counts, payload equality, native device recordings, local-storage inspection, retry request histories, concurrency traces, release rehearsal records. Security control acceptance, conflict policy, retry/backoff/cap, permanent-failure disposition, fleet device/OS and network profile, resource budgets, rollout/disable thresholds are UNKNOWN; record as pre-execution decisions tied to existing risks. Compliance obligations, fleet-wide concurrent load, code-quality thresholds, and server technology are unspecified; no invented standard or numeric target. This is planning and has no executed NFR verdict.

Mitigation priority: address plaintext exposure, silent overwrite, and endless retry first; then establish backlog evidence, correct state transitions, and release containment. All risks OPEN; tests and mitigation validation remain planned. Score-9 risks block proposed release readiness until mitigation and reassessment.

## Step 4: Coverage and execution plan

Priorities: P0 critical business/security/data-integrity/compliance consequence with no safe workaround; P1 core/frequent/complex behavior with material reach and limited recovery; P2 secondary narrower-reach behavior with acceptable workaround; P3 rare/cosmetic/experimental behavior with minimal impact and easy workaround. Risk score informs remediation; priorities follow consequence and recovery separately. No P2/P3 scenarios: supplied scope covers core capture and sync, with rendering unchanged. Performance late delivery is recoverable degradation; a business-critical deadline beyond 30-second acceptance is UNKNOWN. Operational recovery takes 1–3 days via replacement build; app pause resolves neither pending work nor retry cause.

| Test ID | Priority | Requirement/scenario and planned oracle | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- | --- |
| 7.1-E2E-001 | P0 | AC1: open existing work order offline, add parts/labour, save, see captured order and reopen exact lines. | E2E | R-006 | Native Android journey; false capture can lose work. Source gives no safe recovery for falsely acknowledged data. |
| 7.1-INT-001 | P0 | Queue save transaction commits before captured acknowledgment; inject failed/partial SQLite write and require durable state and honest failure. | Integration | R-006 | Real SQLite plus native persistence/status boundary; data integrity, recovery unspecified. |
| 7.1-INT-002 | P0 | Inspect app queue and auxiliary SQLite files using synthetic card-reference/address canaries; demonstrate current plaintext exposure, then validate approved protection. | Integration | R-001 | At-rest security boundary needs actual storage. Screen lock alone does not protect extracted plaintext. Safe workaround absent. |
| 7.2-E2E-001 | P0 | AC2: offline queued order can be edited repeatedly; latest lines reopen before acceptance; block/delay acceptance to check editability boundary. | E2E | R-006 | User-visible pending/accepted transitions; lost changes have no source recovery. Post-acceptance behavior unspecified. |
| 7.2-INT-001 | P0 | Each same-device edit appends an entry; replay successive versions through actual uploader and SQLite; latest payload survives and acceptance retires only covered entries. | Integration | R-002, R-006 | Persistence/upload interaction; older arrival overwrite can lose final work, with no recovery record. |
| 7.2-API-001 | P0 | Two technicians edit same work order offline; deliver A→B and B→A, duplicate/delay one edit; record current lost lines and require approved conflict/history outcome after mitigation. | API | R-002 | Server ingestion and stored state reveal overwrite. Source explicitly loses earlier lines with no history or recovery. |
| 7.2-UNIT-001 | P0 | Immutable snapshots and payload serialization preserve all parts/labour, identifiers, card reference and address across successive edits. | Unit | R-006 | Pure transformation logic; isolate value/aliasing errors without duplicating SQLite interaction. Data-loss recovery unspecified. |
| 7.3-API-001 | P0 | Uploaded payload matches committed server order field for field, including parts/labour and synthetic financial/address fields. | API | R-006 | AC4 lower-level storage oracle; corruption undermines dispatch and lacks defined recovery. |
| 7.3-INT-001 | P0 | Inject upload disconnect before commit and after commit before acknowledgment; retain unaccepted work and verify replay has no duplicate logical effects. | Integration | R-006 | Queue/network/server acknowledgment boundary. Stable identity/idempotency is a proposed safety requirement needing agreement. |
| 7.3-INT-002 | P0 | Place permanently rejected payload ahead of valid items; measure repeated requests and progress; expose current tight loop, then validate approved isolation/bounded-retry behavior. | Integration | R-004 | Observe real uploader requests/resource use and valid-item acceptance. App pause leaves cause and work unresolved; source gives no safe recovery. |
| 7.3-UNIT-001 | P0 | After retry policy approval, classify transient/permanent outcomes and validate backoff/cap/Retry-After with controlled time. | Unit | R-004 | Proposed policy logic; exact values UNKNOWN. Prevents unbounded repeat that has no source-supported repair path. |
| 7.3-E2E-001 | P0 | AC3/AC4: capture and edit offline, restore usable OS network, take no upload action, then verify exact final order in existing dispatcher console. | E2E | R-004, R-006 | Critical cross-system journey and visible delivery. Complements API equality with automatic trigger and dispatcher read-path proof. |
| 7.3-E2E-002 | P1 | Seed exactly 2,000 realistic items; restore usable network on fleet mid-range Android device; measure all items accepted and retired within 30 seconds. | E2E | R-003 | Device performance includes OS trigger, SQLite read, transport, commit and acknowledgment. Late delivery is degradation with queued work recoverable; further critical deadline UNKNOWN. |
| 7.3-API-002 | P1 | Exercise server ingestion for representative 2,000-item backlog; collect acceptance count, throughput and commit latency to diagnose device budget. | API | R-003 | API load evidence isolates server contribution; device E2E owns 30-second verdict. No independent server SLO or fleet concurrency invented. |
| 7.3-INT-003 | P1 | Transient server rejection then acceptance; network loss/recovery during drain; verify pending work retained and eventual valid-item progress. | Integration | R-004, R-006 | Recoverable core-path disruption. Policy limits UNKNOWN; bounded test harness contains current indefinite behavior. |
| 7.3-E2E-003 | P1 | Restore usable network while client foreground/background transitions occur; verify native callback activates uploader and pending order arrives automatically. | E2E | R-004, R-006 | OS integration for AC3; supported background behavior UNKNOWN and a pre-execution decision. Delivery delay with pending work retained is recoverable. |
| 7.4-E2E-001 | P1 | Rehearse replacement-build/containment recovery with pending queue; update and resume, verifying pending work survives and dispatch gets exact final order. | E2E | R-005, R-006 | Operational path requires native installed build and server. Documented recovery is store-reviewed build in 1–3 days; store timing is process evidence. |
| 7.4-INT-001 | P1 | Rehearse fleet activation/disable controls if adopted; otherwise record all-user enablement, store-only disable path and containment readiness as open release risk. | Integration | R-005 | Operational build/config control boundary, supported by release rehearsal records. Proposed controls absent today. |
| 7.3-API-003 | P1 | Assert sync makes zero billing-service calls; existing nightly charging schedule remains unchanged in regression evidence. | API | R-006 | Explicit unchanged billing boundary. Billing-service regression ownership is existing service owner; suite unavailable in supplied repository. |
| 7.3-API-004 | P1 | Assert sync uses installation-specific endpoint/storage through existing regional routing; compare routing configuration and destination records. | API | R-006 | Explicit satisfied single-tenant isolation and unchanged residency boundary; coordinate platform regression. No new scored isolation/residency risk. |

Counts: P0 12, P1 8, P2 0, P3 0; total 20. Levels: E2E 6, API 5, Integration 7, Unit 2. No browser capture tests or generated test files. Repeat contexts are parameterized variants, not additional declared rows.

NFR evidence: R-001 local-storage inspection and security sign-off; R-003 fleet-device monotonic timestamps, 2,000-item server acceptance/queue-retirement counts, native profiler and API load metrics; R-002/R-004/R-006 concurrency traces, request timing/counts, SQLite/server snapshots, exact payload equality and native recordings; R-005 release activation/containment/update rehearsal and documented store recovery. Security/conflict/retry/device-network/resource/release policies UNKNOWN until agreed. Missing measurement is a blocker to validation, not a passing result. Formal NFR assessment deferred to nfr-assess after evidence exists.

Execution: PR functional checks when aggregate <15 minutes, P0 first then P1. Nightly full functional native/device/server regressions, network faults, two-device concurrency and 2,000-item benchmark; weekly physical fleet-device load/soak and release recovery rehearsal. A failed P0 blocks promotion. Before release run all declared P0/P1 and approved mitigation checks against installed candidate build. Native automation harness choice unconfirmed; Android instrumentation/device runner is a planning recommendation. API load runner likewise unselected.

Effort estimates: P0 ~40–60 hours, P1 ~24–40 hours, P2/P3 zero, shared environment/fixtures/fault controls ~12–20 hours; total ~76–120 engineer hours (~10–15 eight-hour days), calendar ~2–4 weeks assuming environments and policies ready. Mitigation implementation is additional and unestimated.

Quality gates: P0 pass rate 100%, P1 ≥95%, all four ACs and six risks linked to executed evidence, all score≥6 mitigations complete, score9 risks reassessed before release. Planned risk/AC coverage 100%; executed requirement/scenario coverage target ≥80% overall and 100% critical/high-risk/AC coverage. Because eight P1 rows are planned, ≥95% requires all eight to pass. No current executed coverage claimed. 2,000-item ≤30-second candidate evidence on fleet devices mandatory. NFR evidence identified for each in-scope category; missing thresholds need decisions before sign-off. Formal NFR/coverage gate verdict deferred to evidence-based workflows.

## Step 5: Completion report and validation

Resolved execution: explicit sequential. Capability probe false; no agents/probes/browser sessions launched. Mode: epic-level Create, full. Sole deliverable: test-artifacts/test-design/test-design-epic-7.md, populated in the exact section order of skill/test-design-template.md. No system handoff applies.

Six risk rows preserve category, probability, impact, correct score, evidence, owner, mitigation, timeline; all ≥6, three score9. Twenty coverage rows: 12 P0 and 8 P1; 6 E2E, 5 API, 7 Integration, 2 Unit. Every row links exact canonical R IDs; all risks/ACs/stories covered by planned checks. Empty medium/low risk bands and P2/P3 priority bands have no invented rows. NFR evidence/unknowns, consequence/recovery-based priorities, regression constraints, entry/exit, estimates, and residual risk included. Template/checklist validation complete for applicable planning criteria. Automated structural verification passed after correcting level summary counts; body has no unresolved placeholders or clause-connector dashes. YAML list markers are valid.

Key proposed gates: P0 100%, P1 ≥95%, all high-risk mitigation complete, AC/high-risk evidence 100%, overall executed scenario coverage ≥80%, 2,000 items fully drained within 30 seconds on fleet mid-range Android. Security/conflict/retry/fleet measurement/release controls remain pre-execution decisions. No executed coverage or final NFR status claimed. Draft approvals pending. System/Playwright-only checklist items inapplicable. Operational checkpoint records Quality & Testing Progress; no sprint status created. All steps completed in order. No docs input edited and no tests generated.
