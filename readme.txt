=== WP Layer Motion ===
Contributors: andrusi4ka
Tags: parallax, layers, scroll, animation, wpbakery
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Layered scenes that move as the page scrolls: a photo, a title and a cutout in front of it, for a sense of depth.

== Description ==

WP Layer Motion adds a "WP Layer Motion" menu (for administrators only) where you build scenes from layers and show them anywhere with `[wp_layer_motion id="123"]` or the "WP Layer Motion" WPBakery element.

* Layers of images and text, the front one at the top of the list; drag a layer to change its depth, hide, duplicate or delete it from its row.
* The classic mountain effect: the photo at the back, a title in the middle, a transparent cutout of the same photo in front that moves up a little as the page scrolls.
* Per device (desktop, tablet, mobile): position, width, scale, opacity, horizontal and vertical travel, image fit and text size; tablet and mobile follow the larger screen until given their own.
* Image position: the part of a photo kept in view where its layer crops it, with each device's crop shown.
* Scene height in px, vh, % or Auto (fills the parent column), per device.
* Preview beside the settings, as on a desktop, tablet or phone, turned sideways too; Update redraws it and plays the scroll once, Play plays it again.
* Respects the visitor's reduced-motion setting.

Bundles [Plugin Update Checker](https://github.com/YahnisElsts/plugin-update-checker) 5 (MIT).

== Installation ==

1. Download `wp-layer-motion.zip` from the latest release on https://github.com/Andrusi4ka/WP-Layer-Motion/releases.
2. In WordPress go to Plugins > Add New > Upload Plugin and upload the zip, then activate it.
3. Go to WP Layer Motion > Add scene, add the layers and publish.
4. Paste the shortcode shown in the scene's "Shortcode" box into a page, or add the "WP Layer Motion" element in WPBakery.

Deleting the plugin under Plugins removes its scenes and settings; the images stay in the media library.

== Changelog ==

= 0.1.0 =
* Scenes of image and text layers that move as the page scrolls, with a visual editor and desktop, tablet and phone previews.
* Layers dragged into depth, hidden, duplicated or deleted from their rows; new ones from Add element.
* Settings per device, tablet and mobile following the larger screen; image position kept in view where a layer crops its photo.
* Scene height in px, vh, % or Auto.
* Updates from GitHub releases; a "What's new" window after an update.
