# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CodKid Studio — Student App

This repository is the **student app** of CodKid Studio: a fork of the Scratch editor
(scratchfoundation/scratch-editor) customised for kids aged 8–11 (grades 3–5) on iPad.

- Spec for this repo: `docs/student-app-spec.md` (read it before any feature work)
- Upstream remote: `upstream` = scratchfoundation/scratch-editor
  (not configured in every clone — check `git remote -v`; `origin` also carries many leftover upstream branches)
- Our main branch: `codkid-main` (based on an upstream release tag)

## Commands

npm-workspaces monorepo. Run from the repo root unless noted. Node is pinned in `.nvmrc`
(CI uses it): `nvm install && nvm use`.

```sh
NODE_ENV=development npm ci   # install like CI. Also runs `husky install` and scratch-gui's
                              # scripts/prepare.mjs, which downloads the micro:bit hex (needs network)
npm run build                 # production build of all 4 packages in dependency order (slow)
```

### Run the app (dev server: http://localhost:8601, override with `PORT`)

```sh
nvm use               # switch to the Node version in .nvmrc
npm run build:deps    # once after install, and again after changing svg-renderer, render or vm
npm start             # = npm start -w @scratch/scratch-gui
```

`build:deps` runs `npm run build -w` for `@scratch/scratch-svg-renderer`, `@scratch/scratch-render`
and `@scratch/scratch-vm`, in that order. Both `build:deps` and `start` are CodKid additions to
the root package.json.

Why the deps must be built: scratch-gui's TypeScript (`module: commonjs`) resolves
`@scratch/scratch-vm` etc. through package.json `main` → `dist/node/…`. Without `dist/` you get
`TS2307: Cannot find module '@scratch/scratch-vm'`. Webpack itself bundles the sibling packages
from `src/` (they map the `webpack` export condition to `src/index.js`), but `dist/` is still
needed for type resolution and for `extension-worker.js`, which gui copies from
`scratch-vm/dist/web`. `dist/` is gitignored.

Inside `packages/scratch-gui`, `npm run build` builds only the playground into `build/`.
The library `dist/` is built only with `NODE_ENV=production` or `BUILD_MODE=dist`
(root `npm run build` sets `NODE_ENV=production`).

### Tests and lint

CI runs `npm test` inside each affected package (`npm test -w @scratch/<pkg>` from root).
Every package's `test` script runs lint first, so one lint error fails the whole run.

| Package | Test runner | Commands (run inside `packages/<pkg>`) |
|---|---|---|
| scratch-vm | tap 16 | `npm run tap:unit`, `npm run tap:integration`, `npm run lint` (eslint + format-message lint) |
| scratch-render | tap 16 | `npx tap --no-coverage test/unit` (plain Node), `npm run lint` |
| scratch-svg-renderer | tap 16 | `npm run test:unit`, `npm run test:lint` |
| scratch-gui | jest 21 | `npm run test:unit`, `npm run test:lint`, `npm run test:integration` |

Run a single test:

```sh
# tap packages (vm, render, svg-renderer). --no-coverage is required: package.json `tap`
# sets global coverage thresholds, so a partial run exits 1 even when every test passes.
npx tap --no-coverage test/unit/util_cast.js
npx tap --no-coverage --grep=toBoolean test/unit/util_cast.js   # one test by name

# scratch-gui
npx jest test/unit/reducers/mode-reducer.test.js -t '<test name>'
```

Test environment requirements:

- **scratch-vm integration tests** load `.sb2`/`.sb3` fixtures from `test/fixtures`. Some fetch
  assets from the Scratch CDN, so they need network access.
- **scratch-render integration tests** (`test/integration/*.js`) run in headless Chromium
  (playwright-chromium). They load the `dist/web` bundles of render, vm and svg-renderer, so
  build all three first, and run `npx playwright install chromium`. `npm run tap` and
  `npm test` in scratch-render include these.
- **scratch-gui integration tests** use selenium-webdriver 3.6 against `file://…/build/index.html`.
  They need:
  - a fresh `npm run build` in the package;
  - Chrome;
  - `chromedriver` on PATH (it is not a dependency).

  `USE_HEADLESS=no` shows the browser. Their XPath selectors depend on CSS-module class names
  and English UI text.

### Commits

Conventional Commits, enforced by the husky `commit-msg` hook and by commitlint in CI.

- Allowed types: `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test`.
- The subject must start lowercase, e.g. `docs: add student app spec`.
- commitizen is configured in package.json but not installed, so write messages by hand.

## Architecture

Upstream Scratch editor monorepo with four packages and a strict dependency chain:
**scratch-svg-renderer → scratch-render → scratch-vm → scratch-gui**.

- All packages share one version, and internal `@scratch/*` deps are pinned to it exactly.
- The release tooling rewrites these values; do not hand-edit them.
- The per-package `CHANGELOG.md` files are stale upstream history.

### scratch-vm — project model and execution

`VirtualMachine` (`src/virtual-machine.js`) is an EventEmitter facade over `Runtime`
(`src/engine/runtime.js`). Most VM events are re-emitted Runtime events. The VM also emits
`targetsUpdate` and `workspaceUpdate`, which the GUI consumes.

**Execution**
- `runtime.start()` runs `_step` on an interval. The GUI enables compatibility mode, so this is 30 fps.
- Each step: start edge-activated hats → `Sequencer.stepThreads()` (time-sliced, round-robin)
  → `renderer.draw()` → emit target and monitor updates.
- A primitive may return a Promise. The thread then waits (`STATUS_PROMISE_WAIT`).

**Core blocks**
- Classes in `src/blocks/scratch3_*.js`. `getPrimitives()` maps opcode → `(args, util)`, where
  `util` is a `BlockUtility`. Optional: `getHats()`, `getMonitored()`.
- They are registered via `defaultBlockPackages` in `runtime.js`.

**Extensions**
- Built-ins are a hard-coded map in `src/extension-manager.js` and run in-process.
- Any other extension id is treated as a URL and loaded in a Web Worker.
- The GUI extension-library entry is separate, in scratch-gui.

**Object model**
- A `Sprite` owns the shared `Blocks` container, costumes and sounds.
- Each instance or clone is a `RenderedTarget`. It pushes state straight to the renderer by
  drawable ID.
- `src/engine/blocks.js` mutations must call `resetCache()`; otherwise execution caches go stale.

**Services are injected, not imported**
- `attachRenderer`, `attachStorage`, `attachAudioEngine`, `attachV2BitmapAdapter`.
- Without them the VM runs headless. The tests run this way.

**Serialization** (`src/serialization/sb3.js`, `sb2.js`)
- The opcode prefix (the text before the first `_`) decides the extension id.
- A prefix outside sb3's `CORE_EXTENSIONS` is treated as an extension and loaded on project
  load. Choose prefixes for new blocks with this in mind.

### scratch-render / scratch-svg-renderer

**scratch-render** is the WebGL renderer (`RenderWebGL`, twgl).
- Its API is ID-based: skins and drawables.
- Skins (SVG, Bitmap, Pen, TextBubble) are shared by many Drawables.
- Collision and touching run on the CPU against `Silhouette`s. Color matching is deliberately
  lossy, to match Scratch 2.

**scratch-svg-renderer** is a set of SVG utilities.
- `src/sanitize-svg.js` (DOMPurify plus css-tree hooks) cleans every SVG that goes through
  `loadSvgString` (that is, every SVG skin) and every SVG costume upload in the GUI.
- Its test compares exact strings against `test/fixtures/*.sanitized.svg`.
- `.svg`, `.sb*` and `.sprite*` files are marked binary in `.gitattributes`. Never reformat them:
  asset MD5s must match.

### scratch-gui — React app

React 16, Redux 3, react-redux 5 (use `connect`; there are no hooks) and react-intl 2.
Mostly JS/JSX; TypeScript appears only at API seams (`src/index.ts`, `src/reducers/gui.ts`,
`src/reducers/vm.ts`, `src/lib/editor-state.tsx`, …).

**Entry points**
- `src/playground/index.jsx` → `render-gui.jsx` is the app the dev server serves. It builds into `build/`.
- `src/index.ts` and `src/index-standalone.tsx` are library builds into `dist/`.

**Store**
- Shape: `{locales, scratchGui, scratchPaint}`. The `scratchGui` slices are combined in
  `src/reducers/gui.ts`.
- The store is built by `EditorState` (`src/lib/editor-state.tsx`), via `AppStateHOC`.

**One VM per store**
- It is created in the reducer initial state (`src/reducers/vm.ts`, together with `attachStorage`).
- Never construct another. Read `state.scratchGui.vm` or the `vm` prop.

**Services are attached in different places**
- `src/lib/vm-manager-hoc.jsx`: audio engine, compatibility mode, `vm.start()`, `vm.loadProject()`.
- `src/containers/stage.jsx`: renderer and bitmap adapter.
- `src/lib/vm-listener-hoc.jsx`: maps VM events to Redux actions and forwards keyboard events.

**App shell**
- `src/containers/gui.jsx` composes the HOC chain: localization, error boundary, fonts, project
  fetch/save, VM manager and listener, file upload, cloud.
- The project lifecycle is a state machine in `src/reducers/project-state.js` (`LoadingState`
  plus `getIs*` helpers). Those HOCs react to it.

**Blocks workspace**
- `src/containers/blocks.jsx` injects scratch-blocks and wires workspace events to
  `vm.blockListener`.
- It reloads XML on `workspaceUpdate`.
- The toolbox XML is generated by `src/lib/make-toolbox-xml.js`. This is where block
  visibility is controlled.

**Code layout**
- `src/components/<name>/` holds presentational components with co-located CSS Modules.
- `src/containers/` holds components connected to Redux or the VM.

**UI text**
- ESLint `react/jsx-no-literals` is an error, so strings go through react-intl messages.
- New message ids have no scratch-l10n translations.

**Upstream defaults that CodKid must replace**
- `project-fetcher-hoc` fetches projects and assets from `projects.scratch.mit.edu` /
  `assets.scratch.mit.edu`.
- The libraries use `cdn.assets.scratch.mit.edu`.
- There is no CodKid-specific code in `packages/` yet.

### Upstream scripts and workflows — do not run

- `npm run build-monorepo`, `scripts/git-batch-push.sh`, `npm run refresh-gh-workflow`: stale,
  one-time upstream migration scripts.
- `npm version`: triggers `scripts/npm-version.sh`, which needs bash 4+ and jq.
- `.github/workflows/publish.yml` is unchanged upstream. A GitHub Release would:
  - `npm publish` the `@scratch/*` packages;
  - push to `develop`;
  - force-move the tag;
  - deploy to gh-pages.

  Adapt the workflow before using releases.
- CI (`ci.yml`) builds everything, then tests only the affected packages and their dependents.

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
