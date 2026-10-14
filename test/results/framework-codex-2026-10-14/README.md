# Framework CLI live evaluation with current Codex

This capture covers a disposable Python voucher project with `gpt-6.1-sol` on Codex CLI 0.162.1. The request was to create stdlib unittest coverage and a GitHub Actions pipeline. `evidence.json.gz` stores the fixture, prompts, raw agent streams, journals, generated outputs, CLI results, native verification logs, and independent mutation score. `index.json` pins each original file's SHA-256 and the compressed archive.

| Run                    | Source     |     Elapsed | Outcome                                                                                                                                                 |
| ---------------------- | ---------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial Create         | `def7f26c` |  78 seconds | Incomplete. The fixture lacked a backend manifest, so skill preflight stopped.                                                                          |
| External Resume        | `def7f26c` | 320 seconds | Incomplete. The agent verified eight tests with Python 3.12, but the CLI's frozen `python3` command resolved to Python 3.9 and all eight tests errored. |
| Fresh Create after fix | `2d875dc9` | 396 seconds | Complete. The agent froze an explicit local Python 3.12 command and a separate CI command. Native verification passed eight tests.                      |

The final suite catches all three independent application mutations: disabled SAVE10, shifted SAVE20 threshold, and accepted negative subtotal. `actionlint` accepted the generated pipeline. The referenced `actions/checkout@v7` and `actions/setup-python@v7` tags existed when checked. Hosted CI for the disposable fixture was not run.

The first fixture prerequisite was corrected by adding `pyproject.toml` before Resume. The product fix exposed the CLI verifier's Python version and command environment in the agent prompt. A separate CLI fix retains original request text and input digests for external Resume. The final run exercised the verifier hint; the request retention fix has an end-to-end custom-agent test.

Codex reported 32,136, 128,846, and 213,716 tokens for these runs, respectively. These are raw CLI token counts; no vendor cost telemetry was available. The runs use different starting states and prompts, so elapsed time and token counts are observations, not a controlled speed or cost comparison.

To inspect a retained file:

```js
const fs = require('node:fs');
const zlib = require('node:zlib');
const capture = JSON.parse(zlib.gunzipSync(fs.readFileSync('test/results/framework-codex-2026-10-14/evidence.json.gz')));
const file = capture.files['after/artifacts/framework/cli-runs/tea-framework-gXHmPE/result.json'];
console.log(Buffer.from(file.base64, 'base64').toString('utf8'));
```
