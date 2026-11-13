# Student UI design (from the approved CodKid Studio prototype)

Source of truth for look and behaviour: the prototype `.local/design/prototype.html`
(git-ignored, local only — it also contains teacher screens that must not be published).
Open it in a browser to see it. Only the **student** screens are in scope here.

When this file and the prototype disagree, follow this file.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--navy` | `#16386B` | main text on buttons, solid buttons, headings |
| `--teal` | `#1E8CAE` | brand ("Kid" in logo), number dots, selected states, Lesson category |
| `--teal-d` | `#105A6E` | dark teal text |
| `--teal-bg` | `#E3F1F5` | selected background |
| `--red` | `#E53935` | big "Hello!" title |
| `--green` | `#2E7D32` | "Saved" label, OK / go buttons |
| `--orange` | `#F57C00` | current step dot, selected name tile border, focus ring |
| `--ink` | `#1C2B45` | body text |
| `--ink-2` | `#4A5464` | secondary text |
| `--line` | `#E4E8EF` | borders |
| `--bg` | `#F4F6FA` | page background |
| `--sun` / `--sun-line` / `--sun-ink` | `#FFF6E0` / `#F2D68A` / `#5A4A1E` | step card, banners |
| Font | `Nunito` 600–900, fallback `Hiragino Sans`, `system-ui` | bundle the font locally (no CDN) |

- Buttons: min height **44px**, radius 12px, 2px border `#CBE2F2`, background `#F4F8FA`, weight 800, 15px.
  Variants: `solid` (navy), `go` (green), `teal` (`#17758F`), `warn` (pink bg `#FBEAF0`, text `#A61D1D`).
- Focus ring: 3px solid orange, offset 2px. Respect `prefers-reduced-motion`.
- Logo: "Cod" black + "Kid" teal, weight 900, plus a small navy pill "STUDIO". Never the Scratch logo.

## Screen 1 — Login (S-01)

Layout: max width 1180px, padding 24px, two white panels (radius 22px) side by side; stack on narrow screens.

- Top row: logo (left).
- Title row: **"Hello!"** (red, 900, 34–46px) and sub-text **"Tap your name. Tap your 3 pictures."** (navy, 800, 21px).
  Right side: class pill (white, green border `#BFE3C4`, text `#1E5D25`) with the class name and a **Change** button
  (opens a modal listing the classes as big tiles).
- Panel 1 — number dot "1" + **"Who are you?"**: grid of name tiles, 3 columns (2 on narrow).
  Tile: min height 120px, radius 16px, round avatar 58px with the first letter on the student's display colour,
  name below (900, 18px). Selected: 4px orange border, background `#FFF3E0`.
- Panel 2 — number dot "2" + **"Your picture key"** (or **"Pick your name first"** before a name is chosen):
  - 3 key slots (84×76, dashed border; filled = teal border + teal-bg, showing the picture)
  - 9 picture buttons in a 3×3 grid (min height 84px), disabled until a name is picked
  - Message line (aria-live): on a wrong key show **"Not this key. Try again!"** in red, shake the slots,
    clear after ~0.9s.
- Pictures: crab, star, shell, fish, sun, boat, apple, rocket, heart — use the SVGs from the prototype (`PICS`),
  saved as asset files. Map them to the picture IDs defined by the API contract.
- Lockout (from the API): show a friendly message, e.g. **"Please ask your teacher."** No timers or numbers for kids.
- QR login card: a **Scan card** button opens the camera and reads the card's QR, which logs the student in directly.
- No "Teacher" button in the student app (teachers use the operator app).

## Screen 2 — Editor shell (around the Scratch editor)

Keep the Scratch blocks area, stage and sprite pane from upstream. Replace only the top menu bar and add the side step card.

**Top bar** (min height 64px, white, bottom border 2px `--line`, wraps on narrow screens):

| Left | Middle | Right |
|---|---|---|
| Logo | Lesson pill: material title + step dots + "Step 2 of 6" | "Saved" status · **My saves** · **Share** · **Gallery** · avatar + first name · **Log out** |

- Step dots: 9px circles; done = teal, current = 20×9 orange pill, todo = `#CBD2DC`.
- Save status: cloud-check icon + **"Saved"** (green). While saving: **"Saving…"**. Offline: **"Saved on this iPad"**.
- For UAT1, **Share** and **Gallery** are hidden (not in scope). **My saves** opens a list of auto-saves (read only for UAT1).
- Remove upstream menus that do not fit kids or the trademark rules: Scratch logo, File menu items that save to the computer,
  "See project page", tutorials, community links, language menu (English only).
  Keep green flag / stop and full-screen stage controls from upstream.

**Step card** (S-06) — above or below the stage, in the side column:
- Card: background sun, 3px `--sun-line` border, radius 16px.
- Label **"Step 2 of 6"** (900, 13px, `#8B5A00`), step text (900, 19px), hint box (white, 15px).
- Buttons: **Back** and **Next** (solid navy). On the last step **Next** becomes **"Done!"**.
- No steps in the material → label **"Free build"**, text **"Make anything you like!"**, buttons disabled.
- Step position is saved with the work.

## Popovers — input help (S-05)

Small white popover (236px, radius 18px, shadow) next to the tapped input, with a light backdrop.

- **Number pad**: title "Tap a number", display box (orange border), quick chips `1 5 10 50 -10 0 90 100`,
  keys 1–9, `-`, 0, `.`, delete, and a green **OK** (spans 2 columns).
- **Word picker**: title "Tap the words", word buttons from the material/system word list, plus **Type it**
  (switches to the normal keyboard).
- Tapping the backdrop closes without changes.

## Modals

White, radius 22px, max width 560px (wide 1040px), title navy 900 24px, close button (X icon, 48px).
**My saves** rows: time ago ("just now", "5 min ago") + tag ("Auto save", "Step 2 done") + **Go back** (later phase).

## Toasts

Bottom centre, navy background, white 800 text, radius 14px.
Examples: "Great job! Share your game in the gallery." / "Done. Your old work is in My saves."

## Copy rules

English only. Short words. One instruction per line. Concrete verbs: tap, drag, snap, click.
