# Vietnamese Product Advisor evaluation results

Date: 2026-10-21
Provider mode: off
Live provider requests: `0`

Command:

```bash
cd apps/ai-service
uv run python -m app.evaluation.agent_eval
```

## Result

| Metric                          | Observed |
| ------------------------------- | -------: |
| Unique cases                    |       62 |
| Categories                      |       14 |
| Route accuracy                  | 1.000000 |
| Tool-selection cases            |       45 |
| Tool-selection accuracy         | 1.000000 |
| Failed cases                    |        0 |
| Commerce mutation tools allowed |        0 |
| Provider calls                  |        0 |

The latest local invocation reported router p50 `0.007437 ms` and p95 `0.021917 ms`. These are
in-process micro-benchmark values and are not production or network latency.

## Structural gates

- PASS: no evaluation case allows a commerce mutation tool.
- PASS: all cases bind the complete forbidden mutation policy.
- PASS: no provider request was issued.
- PASS in tests: unobserved product slugs, response URLs and response price/availability claims are
  rejected; provider/tool/request limits fail closed; logs drop non-allowlisted fields.

## Not measured

Schema-valid live response rate, grounded response rate, provider/tool/end-to-end p50/p95 latency,
token usage, real rate-limit behavior and provider error distribution are **NOT TESTED**. They remain
blocked by the live-provider approval checkpoint and must not be inferred from router results.
