---
name: test
description: Run build, lint, and tests after code changes. Fix any failures before stopping.
---

# Test Skill

Run this skill after completing code changes to validate the work.

## Workflow

1. **Build config package** (always required before tests):
   ```bash
   pnpm build:config
   ```

2. **Run lint**:
   ```bash
   pnpm lint
   ```
   If lint fails: fix the issues and re-run.

3. **Run relevant tests based on what changed**:

   - If liquidity venues were modified:
     ```bash
     pnpm test:liquidity-venues
     ```
   - If pricers were modified:
     ```bash
     pnpm test:pricers
     ```
   - If bot core logic was modified:
     ```bash
     pnpm test:bot
     ```
   - If unsure what changed, or multiple areas were touched, run all:
     ```bash
     pnpm test:liquidity-venues && pnpm test:pricers && pnpm test:bot
     ```

4. **If tests fail**: read the error, fix the issue, rebuild config if needed, and re-run.

## Requirements

- All tests must pass before work is considered complete.
- Some tests hit live RPCs and have a 45s timeout — transient failures may occur. Retry once before investigating.
- If a test fails consistently, fix the root cause rather than skipping it.

## Invocation

- Automatic: run this after any code changes
- Manual: `/test`
