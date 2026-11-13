---
description: Run the student app checks (lint, unit tests, build, browser tests) and fix failures
argument-hint: "[e2e]"
---

Run the checks for this repo and make them pass. Use the exact commands listed in `CLAUDE.md` → Commands
(lint, unit tests, build for `packages/scratch-gui`, and the CodKid tests under `src/codkid/`).
If `$ARGUMENTS` contains `e2e`, also run the Playwright browser tests.

For each failure: find the real cause, fix it with the smallest change, re-run the failing part, then all checks.
Never skip, weaken, or delete a test to get green. If the same failure remains after 3 attempts,
stop and explain it in Japanese with 2 options.

Finish with a short Japanese report: what failed, what you changed, and the final result.
Do not commit unless the user asks.
