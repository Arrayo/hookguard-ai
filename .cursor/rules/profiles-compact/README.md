
# Task-Specific Profiles

For detailed workflows, see rules in this directory:
- debugging.mdc - Error-first, symbol-focused (90% savings)
- code-review.mdc - Diff-aware, API-focused (87% savings)
- refactoring.mdc - Graph-aware, test-verified (89% savings)
- testing.mdc - Coverage-aware, TDD-friendly (90% savings)
- architecture.mdc - Index-first, minimal-detail (90% savings)

These profiles are **conditionally applied** based on file globs and task context.
The base rule (devctx.mdc) is **always active** but kept minimal to reduce fixed context cost.
