# CodKid Studio — Student App

This repository is the **student app** of CodKid Studio: a fork of the Scratch editor
(scratchfoundation/scratch-editor) customised for kids aged 8–11 (grades 3–5) on iPad.

- Spec for this repo: `docs/student-app-spec.md` (read it before any feature work)
- Upstream remote: `upstream` = scratchfoundation/scratch-editor
- Our main branch: `codkid-main` (based on an upstream release tag)

## Commands

<!-- /init will fill in the exact install / build / start / test commands here. -->

## Rules — license and trademark (must follow)

- This repository is **public** and licensed under **AGPL-3.0**.
- Never change or delete `LICENSE` or `TRADEMARK`.
- Never put passwords, API keys, tokens, `.env` files, student data, or lesson content in this repo.
- Do not use the name "Scratch", the Scratch logo, Scratch Cat, or other Scratch characters
  in product UI text, product names, or bundled media. Code identifiers and package names
  inherited from upstream may stay as they are.
- Do not copy or import code from the private repository (`codkid-studio`).
  This app talks to it **only through the HTTP API**.

## Rules — keeping upstream updates easy

- Keep changes to upstream files (`packages/*`) as small as possible.
- Put new CodKid code in clearly separated places (e.g. a `codkid/` folder or new files),
  and connect it to upstream code with small, well-commented hook points.
- Mark every change inside an upstream file with a comment: `// CodKid: <reason>`.
- When a change to upstream files is unavoidable, explain why in the PR description.

## Rules — product

- Users are kids aged 8–11. Main device: **iPad Safari, landscape**.
- All student-facing UI text is **English**: short words, short sentences, one instruction per line.
  Prefer concrete verbs (tap, drag, snap, click).
- Tap targets are **44px or larger**.
- Do not rely on colour alone to show information. Keep text contrast high.
- No free-text comments or chat between students.
- Block running behaviour must stay the same as upstream Scratch 3.

## How to work

- Start any non-trivial task in **plan mode**: investigate, propose options, then wait for approval.
- One feature = one branch (`feature/<name>`) = one pull request.
- Before writing code, say which files you will change and why.
- After changes, run the app and check the result in the browser. Run existing tests when relevant.
- Explain results to the user in **Japanese**. Write code, comments and commit messages in **English**.
- Do not run `git push`. The user pushes.
