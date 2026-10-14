# Teach Me Testing live evidence

At source commit `3382a4f11fb37acd601e5295b43b1bb900f74772`, the scored evaluator ran one complete scripted two-turn session with Codex CLI 0.162.1 and `gpt-6.1-sol`.
The run took 336.666 seconds and met all five thresholds: placement, correction, re-teaching and continuation each scored 1; unearned mastery scored 0.
The evaluator emitted minute-by-minute progress and retained its staged workspace, prompts, observations and raw agent streams.
One repetition establishes this observed pass; stability and token cost remain unmeasured.

The same source also ran the public `tea-teach` command on a fresh consumer project.
Prompt-only mode succeeded, then two live Codex calls saved the learner's role and resumed with the next assessment question.
Both CLI calls exited 0 and took 52.437 and 44.408 seconds.
The archive includes their published state and retained attempt evidence.

`result.json` is the unedited evaluator result.
`raw.tar.gz` holds 163 archived entries from the evaluator and public CLI runs.
Their SHA-256 hashes are:

```text
80e586129432a312b0e6887f880ad682df3026125bb5cc1b293cbce7236c0d06  result.json
dcbc1e02e122c073b5369b7907066dbfe3d15fec93f07b61dea137c506bc468c  raw.tar.gz
```

After this frozen live run, the public CLI reproduced a quiz retake rejection.
The same PR adds the retake fix and controlled end-to-end CLI regression tests.
