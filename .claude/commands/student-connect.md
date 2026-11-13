---
description: Connect the student app to the platform API and build the student UI (login, lesson, auto-save) phase by phase
argument-hint: "[phase number to resume from, optional]"
---

You are connecting the CodKid student app (this Scratch fork) to the CodKid platform API
and building the student-facing UI from the approved design.

Read first:
- `CLAUDE.md` (all rules apply: AGPL, trademark, minimal upstream changes, `// CodKid:` comments)
- `docs/student-app-spec.md` (S-01, S-02, S-03, S-05, S-06, S-07)
- `docs/design/student-ui.md` and the prototype `.local/design/prototype.html` (student screens only)
- `docs/contracts/student-api.yaml` — the API contract from the platform repo. **Do not change it.**
- `docs/teacher-block-schema.md`, and the existing code in `packages/scratch-gui/src/codkid/`
  (block visibility + teacher blocks: reuse `setBlockVisibility(json)` and the teacher-block definition source)

Resume point: $ARGUMENTS (if empty, start at Phase 0).

## Phase 0 — Check and plan (stop here for approval)

1. Prerequisites — report anything missing with the exact fix:
   - `.local/` is in `.gitignore` (add it if not) and the prototype exists there
   - `docs/contracts/student-api.yaml` exists
   - the platform API answers at the URL in `.env.local` / runtime config (try its health endpoint)
   - git working tree is clean, on `codkid-main`
2. Create branch `feature/student-connect` from `codkid-main`.
3. Read the contract and list, for each student endpoint: path, request, response, errors.
   Check that it covers: class list for login, students of a class, picture-key login (+ lockout response),
   QR card login, lesson bundle (starter `.sb3`, block visibility JSON, teacher blocks JSON, steps + hints),
   load current work, auto-save (`.sb3` + thumbnail), logout. Check how the school/tenant is chosen on a shared iPad.
   **Anything missing or unclear → write it to `docs/api-requests.md`** (what is needed, why, proposed shape)
   and plan a mock for it instead of guessing the real API.
4. Find where to hook in with the fewest upstream changes: app entry / routing before the GUI,
   replacing the menu bar, adding the step card next to the stage, loading a project from a URL/blob,
   listening for project changes for auto-save, and getting a stage thumbnail.
5. Write `docs/plan/student-connect.md`: folders (all new code under `packages/scratch-gui/src/codkid/`),
   upstream files to touch with estimated lines, runtime config approach (prefer a runtime `codkid-config.json`
   so one build works for every environment), auth/token handling, offline queue design, test plan, phases.
6. Show a short Japanese summary and **wait for the user to say "go"**.

After approval, run Phases 1–6 **without stopping**, unless a check keeps failing (see "When stuck").

## Phases (after approval)

For **each** phase: implement → run the checks (`/verify` steps) → fix until green →
commit with a Conventional Commit message (e.g. `feat(codkid): add picture-key login (S-01)`) →
print a 2–3 line Japanese progress note → continue.

1. **API client** — typed client generated from or matching `student-api.yaml`; runtime config (API base URL);
   session token in memory + `sessionStorage`; one place for errors (401 → back to login, offline → queue).
   A mock API (MSW or a tiny local mock) that follows the contract, used by tests and by `?codkidMock=1` in dev builds.
2. **Login screen (S-01)** — exactly as `docs/design/student-ui.md` Screen 1: class pill + Change,
   name tiles, 3 picture slots, 3×3 pictures, wrong-key shake message, lockout message, QR card scan.
   Picture SVGs saved as asset files from the prototype and mapped to the contract's picture IDs.
   Bundle the Nunito font locally. iPad landscape first; works down to 768px wide.
3. **Lesson loading (S-02, S-03)** — after login, fetch the lesson bundle; load the student's current work
   or, if none, the starter `.sb3`; apply block visibility with `setBlockVisibility`; load teacher-block definitions
   through the existing definition source (replace the sample source with the API source; keep the sample for dev).
   Clear everything on logout (block visibility back to null, teacher blocks unloaded, project reset).
4. **Editor shell + step guide (S-06)** — CodKid top bar (logo, lesson pill with step dots, save status, My saves,
   avatar + name, Log out); remove Scratch logo and the unsuitable upstream menus (see design doc);
   step card with Back / Next / Done!, Free build mode; step position saved with the work.
   Share and Gallery buttons hidden for now.
5. **Auto-save (S-07)** — save a few seconds after the last change (debounced), and on step change, logout,
   tab hide/close. Send `.sb3` + thumbnail. Status label: Saving… / Saved / Saved on this iPad.
   When offline or the API fails: keep the latest copy in IndexedDB, retry with backoff, send when back online.
   Never lose work: on login, if a local copy is newer than the server copy, use it and upload it.
   My saves modal lists auto-save history read-only.
6. **Input help (S-05)** — number pad and word picker popovers from the design, opened when a student taps a
   number or text input on a block (including teacher-block inputs); **Type it** switches to the normal keyboard.
   Must work with touch on iPad Safari. Word list comes from the lesson bundle if the contract has it, else a default list.

## Tests

- Unit tests (existing test setup of scratch-gui) for: API client, auth/session, auto-save queue + offline recovery,
  picture mapping, step logic.
- Browser tests (Playwright, Chromium + WebKit with an iPad landscape viewport) against the mock API:
  login success / wrong key / lockout → lesson opens with the right blocks and teacher blocks →
  change a block → "Saved" → reload → work is restored → go offline → change → "Saved on this iPad" → back online → uploaded.
- One smoke test against the real local platform API (skipped automatically if it is not running).

## Rules while running

- Follow `CLAUDE.md`. New code under `packages/scratch-gui/src/codkid/`. Keep upstream edits tiny and marked `// CodKid:`.
- The contract is owned by the platform repo. Never change `student-api.yaml` here; record needs in `docs/api-requests.md`.
- If the real API blocks the browser (CORS etc.), do not work around it in the app. Write the exact fix needed on the
  platform side into `docs/api-requests.md`, use the mock, and continue.
- Do not copy anything from the prototype's teacher screens. Do not commit `.local/`.
- Never weaken or delete a test to get green. Never commit secrets. Never run `git push`.

## When stuck

If the same check fails after 3 honest fix attempts, stop and report in Japanese:
what you tried, the error, and 2 options for the user.

## At the end

Report in Japanese: what was built per phase, how to try it on the Mac and on an iPad (URLs, test logins),
the list in `docs/api-requests.md` for the platform repo, and the PR title + description text to paste.
