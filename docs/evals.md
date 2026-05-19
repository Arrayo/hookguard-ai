# HookGuard AI Evals

HookGuard AI evals are lightweight regression checks for the real React analysis backend. They send React snippets to `/api/reviews/react`, execute the configured AI model, and compare the response with expectation files.

## Run

Start the backend first:

```bash
npm run dev --prefix backend
```

Then run evals from the repo root:

```bash
npm run evals
```

Run one case while iterating on prompt quality:

```bash
npm run evals -- --case 01
```

Use a custom backend URL when needed:

```bash
EVALS_BACKEND_URL=http://localhost:3333 npm run evals
```

For slow local models, adjust the per-case timeout:

```bash
EVALS_TIMEOUT_MS=300000 npm run evals
```

## Files

Snippets live in `backend/evals/snippets/`.

Expectation cases live in `backend/evals/cases/`.

The runner is `backend/evals/run.ts`.

## Case Format

Each case is a small JSON file:

```json
{
  "id": "02-unstable-object-dependency",
  "name": "object literal used as effect dependency",
  "snippet": "02-unstable-object-dependency.tsx",
  "expectedCategory": "unstable dependencies",
  "expectedSeverity": "high",
  "expectedIssueCategory": "hooks",
  "requiredKeywords": ["filters", "dependency"],
  "forbiddenKeywords": ["remove the dependency array"],
  "scoreRanges": {
    "overall": { "min": 35, "max": 85 },
    "hooks": { "max": 75 }
  }
}
```

Supported evaluation categories are:

- `real infinite loops`
- `unstable dependencies`
- `harmless rerenders`
- `derived state`
- `random keys`
- `stale closures`
- `unnecessary effects`

## What Is Validated

The runner validates:

- Expected severity, including `none` for false-positive checks.
- Maximum allowed severity for harmless or low-risk snippets.
- Expected issue category from the backend response.
- Required and forbidden keywords across summary, issues, and refactors.
- Score ranges for `overall`, `hooks`, `architecture`, `maintainability`, and `performance`.
- Fallback parser usage, which fails the eval because it means the model response was not clean enough.

## Regression Reporting

Failures are grouped into concise regression types:

- `false positive detected`
- `incorrect loop classification`
- `invalid refactor suggestion`
- `expectation mismatch`

Example output:

```text
HookGuard AI evals: 10 cases against http://localhost:3333
PASS 01-real-infinite-loop - state update depends on the same state
FAIL 03-harmless-parent-rerender - plain render-only component

Summary: 9/10 passed in 42s

Mismatches:
- 03-harmless-parent-rerender: false positive detected - forbidden keyword "infinite loop" was present
```

## Adding Cases

Add a focused snippet and one expectation file. Keep snippets short and realistic. Prefer assertions that catch meaningful behavior regressions, such as a harmless rerender being marked critical or an unstable dependency being fixed by removing the dependency array.
