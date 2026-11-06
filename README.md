# WP Layer Motion

Standalone WordPress plugin for layered scroll scenes. No theme dependency. WPBakery integration is optional; use `[wp_layer_motion id="123"]` in any shortcode-compatible editor.

Activate the plugin, open **WP Layer Motion → Add scene**, and add image and text layers. The top row is the frontmost layer: drag rows (or press Alt + Up / Down on a row) to change the depth; the icons in a row hide, duplicate or delete that layer. Select a layer to edit its image, position, scale, opacity, and horizontal / vertical travel. Publish the scene and paste its shortcode (Shortcode box, right column) into a page. The editor follows WP Swiper's design: menu, grey cards, sliders beside numbers, device icons on per-device fields. In the Position window, drag the layer (or click to put its centre there); it is outlined, the others dimmed, and the side frames show the scene on desktop, tablet and mobile at their own heights. If an image layer leaves part of the scene uncovered, that part is hatched and a warning names the devices, also when only its travel uncovers an edge while scrolling.

For the mountain effect, use the original photo as the back layer (travel 0), a text layer in the middle, and a transparent cutout of the same photo in front (vertical travel -60). Keep the two images aligned. Slightly enlarge the foreground or provide extra image area below it to avoid exposed edges during motion. The plugin does not remove backgrounds from images.

The editor provides isolated desktop, tablet and mobile previews, rotation, a black screen background, and a scroll simulation slider. Black screen changes the empty preview background; it does not hide scene content. Preview does not save changes and is redrawn only when Update is pressed (the button turns blue while there are changes it does not show yet). Device rotation changes the actual preview viewport, so responsive breakpoints match the website.

Scene height is set per device as in WP Swiper: a number and a unit (px; vh, a share of the screen; %, of the block around the scene, which needs its own height; Auto, the free height of the parent column, measured by frontend.js; 500px where none). In the preview, % and Auto use a block as tall as the screen. The scene has no background colour of its own (the preview has a dark screen). Text sizes are configurable per device (the device icons beside the field switch the preview too; older scenes use the desktop text size on tablets). Breakpoints: mobile up to 767px, tablet up to 1024px. Motion respects reduced-motion preferences. Layers stay aligned until the scene top reaches the viewport top (0); travel reaches its full amount when the scene bottom reaches the viewport top (1). Scrolling backwards reverses it. No sticky scrolling is applied.

## Files

- `wp-layer-motion.php`: plugin registration and loader.
- `includes/class-wplm-settings.php`: defaults, validation and stored scene data.
- `includes/class-wplm-admin.php`: editor, saving, authenticated preview.
- `includes/class-wplm-render.php`: shortcode, markup and optional WPBakery element.
- `assets/js/admin.js`, `assets/css/admin.css`: layer editor and device previews.
- `assets/js/frontend.js`, `assets/css/frontend.css`: independent rendering and scroll motion.
- `includes/class-wplm-whats-new.php`, `assets/js/whats-new.js`, `assets/css/whats-new.css`: the "What's new" window after an update, from the Changelog in `readme.txt` (as WP Swiper's).
- `uninstall.php`: deleting the plugin under Plugins removes its scenes, settings and stored state; images stay in the media library.
- `vendor/plugin-update-checker`: updates from GitHub releases, "View details" and "Check for updates" under the plugin (MIT).

Scenes use the private `wplm_scene` post type and `_wplm_scene` post meta. Only administrators can edit or preview scenes. Only published scenes render publicly. Deactivation preserves scenes; deleting the plugin removes them.

Development checks: `php tests/settings.php` and `node tests/motion.cjs`. These use isolated stubs and do not access the WordPress database.

## Per-device layer settings

Position, width, scale, opacity, horizontal / vertical travel and image fit have a value per device, as in WP Swiper: desktop always has one; tablet and mobile follow the larger screen (mobile → tablet → desktop) until they get their own (a green dot on the device icon). Clearing a tablet / mobile number makes it follow again. The device icons beside a field also switch the preview. Scenes saved with the former "Motion on mobile (%)" get that share of their travel as the mobile travel. Text size and scene height already had a value per device.

Layers are reordered by dragging a row (grab cursor, the row follows the pointer) or with Alt + Up / Down. New layers come from the "Add element" block under the list: it opens on tiles, one per kind of element (Image, Text).

## Releases

Author: Relevant AS (https://relevant.no/). A release is a `vX.Y.Z` tag: `.github/workflows/release.yml` runs the checks (`tests.yml`), checks that the tag, the `Version:` header, `WPLM_VERSION` and `readme.txt`'s Stable tag match, and publishes `wp-layer-motion.zip` (dev files left out by `.gitattributes`, scripts and styles minified). Sites with the plugin then get the update under Plugins and, once updated, the "What's new" window with the new Changelog entries. Add each version's changes to `readme.txt` before tagging.
