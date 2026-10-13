/** Read-only progress view for a running or finished Evaluate invocation. */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readFolderFile } = require('./folder');

const STALE_AFTER_MS = 90_000;
const POLL_MS = 2000;
const REPORT_EVERY_MS = 30_000;

/** Only the runtime's flat invocation identifiers may name a run. */
function validRunId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && value !== '.' && value !== '..';
}

function readRecord(folder, runId) {
  const relative = `runs/${runId}/run.json`;
  // An atomic progress replacement can land between the guarded path walk and
  // open. Retry that one race, while retaining every link and file-type refusal.
  let read;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    read = readFolderFile(folder, relative);
    if (read.ok || read.reason !== 'changed while it was read; run the command again') break;
  }
  if (!read.ok) return { error: `${relative} ${read.reason}` };
  let record;
  try {
    record = JSON.parse(read.bytes.toString('utf8'));
  } catch {
    return { error: `${relative} is not valid JSON` };
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record) || record.command !== 'run' || record.invocationId !== runId) {
    return { error: `${relative} does not identify a tea-evaluate run` };
  }
  return { record };
}

/** Resolve the requested run, or the newest run whose guarded record identifies it. */
function locateRun(folder, requested) {
  if (requested !== undefined) {
    if (!validRunId(requested)) return { error: `--run ${JSON.stringify(requested)} is not a run identifier` };
    const read = readRecord(folder, requested);
    return read.error === undefined ? { runId: requested, record: read.record } : read;
  }
  const runs = path.join(folder, 'runs');
  let names;
  try {
    if (!fs.lstatSync(runs).isDirectory()) return { error: `${runs} is not a runs directory` };
    names = fs.readdirSync(runs, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { error: `${runs} holds no tea-evaluate run` };
    return { error: `${runs} cannot be read (${error.code ?? error.message})` };
  }
  for (const entry of names
    .map((item) => item.name)
    .filter(validRunId)
    .sort()
    .toReversed()) {
    const read = readRecord(folder, entry);
    if (read.error === undefined) return { runId: entry, record: read.record };
  }
  return { error: `${runs} holds no tea-evaluate run` };
}

function elapsedText(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m ${seconds % 60}s`;
}

function shortDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return elapsedText(ms);
}

function safeText(value) {
  return typeof value === 'string' ? value.replaceAll(/[\r\n\t]+/g, ' ').trim() : '';
}

function costAmount(value) {
  return typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? value : null;
}

function costText(usage) {
  if (usage === null || typeof usage !== 'object' || usage.scope !== 'trials-only') return 'trial cost unknown (trials only)';
  const missing = Number.isInteger(usage.missingReports) && usage.missingReports >= 0 ? usage.missingReports : null;
  const reported = costAmount(usage.reportedTrialCostUsd);
  const complete = costAmount(usage.trialCostUsd);
  if (complete !== null && missing === 0) return `trial cost $${complete} (trials only)`;
  const parts = ['trial cost unknown'];
  if (reported !== null) parts.push(`reported $${reported}`);
  if (missing !== null) parts.push(`${missing} missing report${missing === 1 ? '' : 's'}`);
  return `${parts[0]} (${[...parts.slice(1), 'trials only'].join('; ')})`;
}

function statusOf(runId, record, now = Date.now()) {
  const progress = record.progress && typeof record.progress === 'object' && !Array.isArray(record.progress) ? record.progress : {};
  const outcome = record.outcome && typeof record.outcome === 'object' ? record.outcome : null;
  const updatedAt = Date.parse(progress.updatedAt);
  const startedAt = Date.parse(progress.startedAt ?? record.startedAt);
  const terminal = record.completed === true || outcome !== null;
  const stale = !terminal && (!Number.isFinite(updatedAt) || now - updatedAt >= STALE_AFTER_MS);
  const state = terminal ? (record.completed === true ? 'complete' : 'stopped') : stale ? 'stale' : 'live';
  const completedTrials = Number.isInteger(progress.completedTrials) && progress.completedTrials >= 0 ? progress.completedTrials : null;
  const totalTrials = Number.isInteger(progress.totalTrials) && progress.totalTrials >= 0 ? progress.totalTrials : null;
  const lastElapsed = Number.isFinite(progress.elapsedMs) && progress.elapsedMs >= 0 ? progress.elapsedMs : null;
  const timeSinceUpdate = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : 0;
  const elapsed =
    lastElapsed === null
      ? terminal && Number.isFinite(record.durationMs)
        ? record.durationMs
        : (stale && Number.isFinite(updatedAt) ? updatedAt : now) - startedAt
      : lastElapsed + (terminal || stale ? 0 : timeSinceUpdate);
  const parts = [`run ${runId}: ${state}`];
  if (safeText(progress.phase)) parts.push(safeText(progress.phase));
  if (safeText(progress.detail)) parts.push(safeText(progress.detail));
  if (Number.isFinite(progress.phaseElapsedMs) && progress.phaseElapsedMs >= 0) {
    parts.push(`phase elapsed ${elapsedText(progress.phaseElapsedMs + (terminal || stale ? 0 : timeSinceUpdate))}`);
  }
  if (completedTrials !== null && totalTrials !== null) parts.push(`trials ${completedTrials}/${totalTrials}`);
  parts.push(`elapsed ${elapsedText(elapsed)}`);
  const phaseDurations = progress.phaseDurationsMs;
  if (phaseDurations !== null && typeof phaseDurations === 'object' && !Array.isArray(phaseDurations)) {
    const finishedPhases = Object.entries(phaseDurations)
      .filter(([phase, ms]) => safeText(phase) !== '' && Number.isFinite(ms) && ms >= 0)
      .map(([phase, ms]) => `${safeText(phase)} ${shortDuration(ms)}`);
    if (finishedPhases.length > 0) parts.push(`phase times ${finishedPhases.join(', ')}`);
  }
  parts.push(
    costText(progress.usage),
    Number.isFinite(updatedAt)
      ? `last update ${new Date(updatedAt).toISOString()} (${elapsedText(Math.max(0, now - updatedAt))} ago)`
      : 'last update unknown',
  );
  if (outcome !== null) {
    if (Number.isInteger(outcome.exitCode)) parts.push(`exit ${outcome.exitCode}`);
    if (safeText(outcome.signal)) parts.push(`signal ${safeText(outcome.signal)}`);
  }
  return { runId, state, terminal, stale, line: parts.join(' | '), progress, outcome };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Emit one snapshot, then material changes and periodic heartbeats until the run ends. */
async function runStatusCommand(folder, { run, follow = false, emit, pollMs = POLL_MS, reportEveryMs = REPORT_EVERY_MS } = {}) {
  const located = locateRun(folder, run);
  if (located.error !== undefined) return { exitCode: 64, message: located.error };
  const { runId } = located;
  let lastIdentity = null;
  let lastReportAt = 0;
  for (;;) {
    const read = readRecord(folder, runId);
    if (read.error !== undefined) return { exitCode: 12, message: read.error };
    const now = Date.now();
    const status = statusOf(runId, read.record, now);
    const identity = JSON.stringify({
      state: status.state,
      phase: status.progress.phase,
      detail: status.progress.detail,
      completedTrials: status.progress.completedTrials,
      totalTrials: status.progress.totalTrials,
      outcome: status.outcome,
    });
    if (lastIdentity !== identity || now - lastReportAt >= reportEveryMs) {
      emit?.(status.line);
      lastIdentity = identity;
      lastReportAt = now;
    }
    if (!follow || status.terminal || status.stale) return { exitCode: 0, message: status.line, status };
    await sleep(pollMs);
  }
}

module.exports = { STALE_AFTER_MS, locateRun, runStatusCommand, statusOf, validRunId };
