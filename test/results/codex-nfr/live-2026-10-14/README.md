# NFR live evaluation and public CLI, October 14, 2026

This capture uses Codex CLI 0.162.1 with `gpt-6.1-sol` against the two NFR fixture projects. `evidence.tar.gz` preserves the four evaluator workspaces, prompts, observations, generated reports, original result, console log, and public CLI attempts. `index.json` pins the source commit, archive digest, each generated report digest, and the deterministic replay result.

| Run                                                                  | Model calls |              Elapsed | Result                                                                                                                                               |
| -------------------------------------------------------------------- | ----------: | -------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evaluator, two repetitions per fixture                               |           4 |              31m 33s | Original scorer exit 1: five fabricated citations and two unstable cases.                                                                            |
| Replay of the same four reports after scorer correction              |           0 | Less than one second | No fabricated citations; both fixture pairs have identical scored signatures. All 16 domain judgments and four overall judgments match ground truth. |
| Public `tea-nfr` on clean fixture with full evidence                 |           1 |               11m 7s | PASS, gate passed, exit 0.                                                                                                                           |
| Public `tea-nfr` on clean fixture with incomplete evidence selection |           1 |               8m 26s | CONCERNS, gate failed, exit 1. The logging configuration was omitted from `--evidence`.                                                              |

The original evaluator read valid links such as `[evidence/load-test.json](../../evidence/load-test.json)` as two citations. The report-relative target was marked fabricated. One clean report used sentence-style criterion headings such as `### Response time.`; the scorer failed to associate their evidence with a criterion. The parser changes normalize report-relative links and terminal heading periods. The generated reports, fixtures, and ground truth are unchanged in the replay.

The public CLI result proves a complete, valid audit on the clean fixture. The incomplete evidence call shows the gate catching a missing supplied evidence role. The docs now say to include implementation files under `--evidence` when they prove observations.

The archive is inspectable with `tar -tzf evidence.tar.gz` and extractable with `tar -xzf evidence.tar.gz -C <directory>`. `index.json` lists relative paths for all four reports. The original `result.json` remains in the archive, including the incorrect quality verdict. No vendor cost telemetry was available. Elapsed time is an observation, not a model speed comparison.
