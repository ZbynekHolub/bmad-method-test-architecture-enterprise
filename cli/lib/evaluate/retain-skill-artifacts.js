/** Preserve generated workspaces and raw observations before eval cleanup. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const writeText = (file, text) => fs.promises.writeFile(file, text);
/** Observe each attempt before retry cleanup can discard its workspace. */
function captureProbe(port, record) {
  return {
    async probe(request, signal) {
      try {
        const observation = await port.probe(request, signal);
        record(observation);
        return observation;
      } catch (error) {
        record({ fault: { name: error.name, code: error.code, message: error.message, detail: error.detail } });
        throw error;
      }
    },
  };
}
/** Retain exact workspace bytes, prompt, raw observation and live provenance. */
async function retainSkillArtifacts({
  artifactsDir,
  workspace,
  caseId,
  agent,
  model,
  repetition,
  attempt,
  prompt,
  observation,
  provenance = {},
}) {
  if (!artifactsDir) return null;
  const root = path.resolve(artifactsDir);
  fs.mkdirSync(root, { recursive: true });
  const label = `${agent}-${caseId}-run-${repetition}-attempt-${attempt}`.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  const destination = fs.mkdtempSync(path.join(root, `${label}-`));
  try {
    fs.cpSync(workspace.dir, path.join(destination, 'workspace'), { recursive: true });
    await writeText(path.join(destination, 'prompt.txt'), prompt);
    if (observation !== undefined) await writeText(path.join(destination, 'observation.json'), `${JSON.stringify(observation, null, 2)}\n`);
    await writeText(
      path.join(destination, 'provenance.json'),
      `${JSON.stringify({ mode: 'live', caseId, agent, requestedModel: model, repetition, attempt, capturedAt: new Date().toISOString(), originalWorkspace: workspace.dir, ...provenance }, null, 2)}\n`,
    );
    process.stderr.write(`retained skill artifacts: ${destination}\n`);
    return destination;
  } catch (error) {
    error.retainedWorkspace = workspace.dir;
    error.partialArchive = destination;
    throw error;
  }
}
/** Always clean an attempt while preserving its original run failure. */
async function finishSkillAttempt({ retain, workspace, runError, remove = fs.rmSync }) {
  let failure = runError;
  let retained = false;
  try {
    await retain();
    retained = true;
  } catch (error) {
    if (failure) process.stderr.write(`artifact retention failed: ${error.message}\n`);
    else failure = error;
  } finally {
    try {
      if (retained) remove(workspace.dir, { recursive: true, force: true });
    } catch (error) {
      if (failure) process.stderr.write(`attempt cleanup failed: ${error.message}\n`);
      else failure = error;
    }
  }
  if (failure && failure !== runError) throw failure;
}
module.exports = { retainSkillArtifacts, captureProbe, finishSkillAttempt };
