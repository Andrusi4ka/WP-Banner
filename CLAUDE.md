# WP Banner — notes for the next agent

Read this first, then `README.md` (how the plugin works for users) and `readme.txt` (features, changelog).

## What this plugin is

A WordPress plugin for **drawing banners from layers that move as the page scrolls**, for a sense of depth — the classic "mountain" effect: the photo at the back, a title in the middle, a transparent cutout of the same photo in front. Built for the user's own sites (WordPress + Woodmart theme + WPBakery), but with **no hard dependency on Woodmart**, and WPBakery optional.

The user wants it **minimal**: it is only for banners. Do not add settings "just in case". On 2026-11-07 a long list of features was removed on purpose (pin/sticky, start mode, easing, smoothing, mouse motion, blur, rotation, overlay layers, links, per-device visibility, layer Width for images, Fade). **Do not re-add any of them without the user asking.**

History: started as "WP Layer Motion" (prefix `wplm`), renamed to "WP Banner Motion" (`wpbm`), then "WP Banner" (`wpbn`) — all before the first release. `wpbn_rename_from_old_names()` in `wp-banner.php` moves old data once; the old shortcodes `[wp_layer_motion]` and `[wp_banner_motion]` still work.

## Where things are

- Plugin folder (also the git working copy): `wp-content/plugins/WP-Banner-main`, repo https://github.com/Andrusi4ka/WP-Banner, branch `main`. No releases or tags yet (version 0.1.0).
- `wp-banner.php` — loader, post type `wpbn_scene`, GitHub updates (Plugin Update Checker), the one-off rename.
- `includes/class-wpbn-settings.php` — the data model: defaults, `sanitize()` (all input goes through it, also old scenes — migrations live there), per-device helpers `resolved()`, `heights()`, `fonts()`, `images()`, switches `OPTIONAL` + `effective()`, `fade()`, `placed_by_class()`.
- `includes/class-wpbn-render.php` — shortcode `[wp_banner id=""]`, markup (CSS variables per device, `data-motion` JSON per layer), `srcset`/`sizes`, the inline script that moves a scene into its host block.
- `includes/class-wpbn-admin.php` — the scene editor metabox, saving, the authenticated preview (admin-ajax `wpbn_preview`) with a placeholder page under the banner.
- `includes/class-wpbn-wpbakery.php` + `assets/js/wpbakery.js` — WPBakery element copied from WP Swiper's: scene list, "Edit scene" / "Add scene" (new tab, list refreshes on return), under Woodmart's "Theme elements".
- `assets/js/admin.js`, `assets/css/admin.css` — the editor (one big IIFE; HTML built as strings).
- `assets/js/frontend.js`, `assets/css/frontend.css` — rendering and scroll motion.
- `tests/settings.php` (PHP, no WordPress; CI runs it on every push), `tests/motion.cjs` (Playwright browser tests, local).

## How it works (the important ideas)

- **Scenes** are a private post type; settings in post meta `_wpbn_scene`. A scene = Height (per device) + an optional class + layers.
- **Layers**: `image` and `text` (shown to users as **Title**; the internal type key stays `text`). The top of the list is the front layer.
- **Per device** (desktop / tablet / mobile, breakpoints 1024 / 767 like Woodmart): desktop always has a value; tablet and mobile are `null` = inherit the larger screen (mobile → tablet → desktop), shown with a green dot when they have their own. This holds for layer settings, scene Height (number + unit inherit as a pair; "Inherit" option) and Title font size.
- **Switches** (`OPTIONAL` in settings, same table in admin.js): image Scale / Opacity and every layer's motion (X, Y travel, Zoom, "Opacity at the end") apply only with their switch on; off = value at rest, but the stored value is kept.
- **Motion**: progress 0→1 from the scene's top reaching the screen top until its bottom does. frontend.js sets `--wpbn-dx/dy/z/f`; "Opacity at the end" is turned into an opacity delta (`fade`) by `WPBN_Settings::fade()`.
- **Edges**: image layers with Cover that fill the scene are grown together (same factor, around the scene centre, so photo and cutout stay aligned) just enough that edges never show while moving (`bleed()` in frontend.js). Contain images and titles are excluded.
- **Placement**: always via the WP Banner element / shortcode (so designers see it in WPBakery). If the scene has a class and its **desktop Height is Auto**, an element standing inside a row/column/block with that class becomes that block's background (absolute, z-index -1 in a host with `isolation:isolate`). Otherwise it is a normal block with its own height. The class field is greyed when Height isn't Auto.
- **Preview**: iframe rendered server-side from the unsaved form, redrawn **only by the Update button** (no auto-refresh, no auto-play); Scroll simulation slider + Play; device frames (SVG) or a custom Width × Height per device in a plain frame.

## The user's rules (follow them)

- Replies to the user in **Ukrainian**; all plugin UI strings in **English**.
- When the user asks a question ("просто питання", "не кодь"), answer without changing code.
- Admin UX like WP Swiper: settings that don't apply are **greyed, not hidden**, values kept (exception: child fields of a toggle may hide). Help texts go into an **"i" tooltip** on a dark background (`tip()` / `withTip()` in admin.js), not paragraphs. Per-device fields keep their own small device icons.
- Commits: **no "Co-Authored-By: Claude" trailer**. Commit/push only when asked; never tag or release without the user's explicit command.
- **Never write to the site database in tests** (read-only inspection via a PHP CLI script with `wp-load.php` is fine). Never edit the user's pages/posts content.
- Keep `tests/settings.php` and `tests/motion.cjs` in step with every change; run `npm test` before reporting.

## Running things on this machine (Windows, OSPanel)

- PHP: `C:/OSPanel/modules/PHP-8.3/PHP/php.exe` (also 7.4 — the plugin supports PHP 7.4, lint both). Not in PATH. The site runs on PHP 8.4 / Apache.
- `npm install` once, then `npm test` (PHP checks + browser checks; Playwright drives the installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`).
- No Python, no `gh`; git pushes with stored credentials. GitHub Actions status: `api.github.com/repos/Andrusi4ka/WP-Banner/actions/runs`.
- Shell quoting is fragile for patches with apostrophes: write a small Node script to a scratch file and run it, or use the Edit tool.

## Deferred, do when the user says the plugin is ready

- Preview screen presets (1920×1080, 1366×768, iPad, iPhone…), each with its own SVG device drawing (the custom size now uses a plain frame; TODO near `SCREENS` in admin.js).
- Open questions the user may come back to: Title font size defaults (mobile now inherits 120px from desktop; 48px was offered as a start value), "Inherit" wording for Image fit on tablet/mobile (still "Same as Desktop (Cover)"), a "Fill the scene" switch for image objects (would bring back Width for them).
