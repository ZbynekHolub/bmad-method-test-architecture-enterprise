---
title: 'Route bounded Evaluate authoring work to current economical models'
type: 'feature'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent">

## Intent

**Problem:** Authoring an Evaluate suite can occupy a strong model for hours, while source inventory and candidate drafting are bounded tasks. The user needs lower authoring cost without weakening scored evidence or hiding time and usage.

**Approach:** Teach Evaluate to delegate bounded, read-only authoring tasks to the current economical model of the active provider, Haiku for Claude and Luna for Codex, when the host exposes a suitable subagent. Keep one parent responsible for decisions, artifact writes, gates, and interpreting scores. Record authoring timing and available usage so a baseline and routed run can be compared. Preserve the scored target and judge model conditions.

</frozen-after-approval>

## Implementation Notes

- The change is confined to Evaluate skill guidance and the changelog. The runtime's scored model configuration remains untouched.
- Added `references/authoring-routing.md` for current-tier selection, bounded read-only workers, parent-owned gates, held-out isolation, and an authoring ledger. Linked it from the skill workflow.
- The isolated worktree did not contain installed dependencies. The first documentation validation attempt could not start; `npm ci` is restoring the lockfile installation before rerunning the checks.
- After `npm ci`, `npm run test:evaluate-guidance`, `npm run lint:md`, `npm run format:check`, and `npm run docs:validate-links` passed. The guidance test initially treated the new reference as a thirteenth stage; the skill link now says `Read`, preserving the twelve-stage contract.

## Review Triage Log

- `medium`: A strict read-only host boundary would disable Codex routing because its subagents have writable tools. The guide now instructs workers to avoid writes and requires before/after file checks and repair of worker-attributed edits.
- `low`: The model ID rule conflicted with the audit log. The guide now prohibits versioned IDs in dispatch rules while recording the resolved ID per task.
- `medium`: Starting the log when the evaluation folder exists loses inspection timing. The guide now starts a working log before Stage 1 and carries it into the folder.
- `medium`: Resume omitted the authoring log. The skill now reads it on resume and marks unfinished worker tasks interrupted before adding new entries.
