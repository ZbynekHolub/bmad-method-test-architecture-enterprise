/** Keep captured agent text from becoming a GitHub Actions workflow command. */
function neutralizeWorkflowCommands(value) {
  // The runner recognizes legacy ##[ commands anywhere in a log line.
  return String(value).replaceAll('##[', '# #[').replaceAll('::', ': :');
}

module.exports = { neutralizeWorkflowCommands };
