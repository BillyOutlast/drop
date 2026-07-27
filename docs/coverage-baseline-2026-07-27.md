# Coverage Baseline — 2026-07-27

Measured on branch `rebuild` at commit `838727e7`.
Snapshot only — no gates, no thresholds.

## Summary (server — `server/server/` backend only)

| Metric | Value |
|---|---|
| Statements | 28.06% |
| Branches | 22.09% |
| Functions | 35.48% |
| Lines | 29.32% |

## Detail

```
server coverage: Statements   : 28.06% ( 421/1500 )
server coverage: Branches     : 22.09% ( 158/715 )
server coverage: Functions    : 35.48% ( 88/248 )
server coverage: Lines        : 29.32% ( 402/1371 )
```

## How to reproduce

```bash
pnpm --filter drop coverage
```

Output: `server/coverage/lcov.info`.
CI uploads to Codecov via `codecov/codecov-action@v5` with flag `server`.
