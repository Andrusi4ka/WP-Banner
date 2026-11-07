# WP Banner

WordPress plugin for banners drawn from layers that move as the page scrolls, for a sense of depth (the photo at the back, a title in the middle, a transparent cutout of the photo in front). No theme dependency; WPBakery integration is optional. Formerly "WP Layer Motion", then "WP Banner Motion" (both renamed before the first release; the plugin moves their data once and keeps their shortcodes working).

## Using it

Activate the plugin, open **WP Banner → Add scene**, and add image and text layers. The top row is the frontmost layer: drag rows (or press Alt + Up / Down on a row) to change the depth; the icons in a row hide, duplicate or delete that layer. Publish the scene, then add the **WP Banner** element in WPBakery (under Woodmart's "Theme elements" when the theme is active; "Edit scene" and "Add scene" open in a new tab) or paste `[wp_banner id="123"]` into any shortcode-compatible editor.

**Placement.** By default the scene is a block of its own height (Scene settings → Size: px, vh, % of the block around it, or Auto, the free height of the parent column). With **Insert into blocks by class** on, an element standing inside a row, column or block with the scene's class becomes that block's background: as wide and tall as the block, behind its content (a short script right after the scene's markup moves it while the page loads; `frontend.js` does the same for scenes added later). The scene's height is then used only where the element is not inside such a block, or the block has no height of its own.

**Layers.** Image layers: the image (one of its own for tablet / phone if needed), Image fit (Cover fills the scene; Contain shows the whole image, sized by Scale) and Position (the point kept in view where Cover crops the photo). Their width is always the scene's. Text layers: text with line breaks, tag (div, h1–h3, p), colour, size per device, font and weight, position and width. Scale and Opacity of image layers sit behind switches.

**Motion**, each behind a switch: horizontal and vertical travel (px), Zoom (% added) and Opacity at the end (the layer goes from its Opacity to this one). Layers start moving when the scene's top reaches the top of the screen and reach the full amount when its bottom does; scrolling back reverses it. The image layers that fill the scene (Cover) grow together, around the scene's middle, just enough that their edges never show while they move, so a photo and its cutout stay aligned. Motion respects reduced-motion preferences.

**Per device.** Position, scale, opacity, motion, image fit and image have a value per device: desktop always has one; tablet and mobile follow the larger screen (mobile → tablet → desktop) until they get their own (a green dot on the device icon). Clearing a tablet / mobile number, or its reset button, makes it follow again; on desktop the reset button restores the default. Breakpoints: mobile up to 767px, tablet up to 1024px.

**Preview.** Desktop, tablet and phone frames (or a screen size of your own per device, in a plain frame), turned sideways, a dark screen, a placeholder page under the banner and a scroll simulation slider with Play. It uses the unsaved settings and is redrawn only when Update is pressed (the button turns blue while there are changes it does not show yet).

## Files

- `wp-banner.php`: plugin registration, loader, updates, the one-off move of data from the old names.
- `includes/class-wpbn-settings.php`: defaults, validation and stored scene data.
- `includes/class-wpbn-admin.php`: editor, saving, authenticated preview.
- `includes/class-wpbn-render.php`: shortcode and markup.
- `includes/class-wpbn-wpbakery.php`, `assets/js/wpbakery.js`: the WPBakery element (scene list, Edit / Add scene).
- `assets/js/admin.js`, `assets/css/admin.css`: layer editor and device previews.
- `assets/js/frontend.js`, `assets/css/frontend.css`: rendering and scroll motion.
- `includes/class-wpbn-whats-new.php`, `assets/js/whats-new.js`, `assets/css/whats-new.css`: the "What's new" window after an update, from the Changelog in `readme.txt`.
- `uninstall.php`: deleting the plugin under Plugins removes its scenes, settings and stored state; images stay in the media library.
- `vendor/plugin-update-checker`: updates from GitHub releases, "View details" and "Check for updates" under the plugin (MIT).

Scenes use the private `wpbn_scene` post type and `_wpbn_scene` post meta. Only administrators can edit or preview scenes. Only published scenes render publicly. Deactivation preserves scenes; deleting the plugin removes them.

Development checks: `npm install` once, then `npm test` runs both `tests/settings.php` (also run on every push by `.github/workflows/tests.yml`) and the browser tests `tests/motion.cjs` (local: `playwright-core` drives the Chrome already installed; set `PHP_BIN` / `BROWSER_BIN` if PHP or Chrome are elsewhere). They use isolated stubs and do not access the WordPress database.

## Releases

Author: Relevant AS (https://relevant.no/). A release is a `vX.Y.Z` tag: `.github/workflows/release.yml` runs the checks (`tests.yml`), checks that the tag, the `Version:` header and `readme.txt`'s Stable tag match, and publishes `wp-banner.zip` (dev files left out by `.gitattributes`, scripts and styles minified). Sites with the plugin then get the update under Plugins and, once updated, the "What's new" window with the new Changelog entries. Add each version's changes to `readme.txt` before tagging.
