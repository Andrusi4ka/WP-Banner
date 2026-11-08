=== WP Banner ===
Contributors: andrusi4ka
Tags: parallax, layers, scroll, animation, wpbakery
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Banners drawn from layers that move as the page scrolls: a photo, a title and a cutout in front of it, for a sense of depth.

== Description ==

WP Banner adds a "WP Banner" menu (for administrators only) where you build scenes from layers and show them anywhere with `[wp_banner id="123"]` or the "WP Banner" WPBakery element.

* Layers of images and titles, the front one at the top of the list; drag a layer to change its depth, hide, duplicate or delete it from its row.
* The classic mountain effect: the photo at the back, a title in the middle, a transparent cutout of the same photo in front.
* Motion as the page scrolls, each behind a switch: horizontal and vertical travel, zoom, and the opacity a layer ends at. Image edges never show while the layers move.
* Per device (desktop, tablet, mobile): position, scale, opacity, motion, image fit, the image itself and the text size; tablet and mobile follow the larger screen until given their own. Each slider resets to its default.
* Image position: the part of a photo kept in view where its layer crops it, with each device's crop shown.
* Title: line breaks, heading (h1–h5; h2 by default), colour, font and weight.
* Scene height in px, vh, % or Auto (fills the parent column), per device.
* Placed by class: inside a row, column or block with the scene's class, the element becomes that block's background, as wide and tall as the block, behind its content.
* The WPBakery element lists the scenes, with "Edit scene" and "Add scene"; with Woodmart it is under "Theme elements".
* Preview beside the settings, as on a desktop, tablet or phone (or a screen size of your own), turned sideways too, with a page under the banner and a scroll simulation.
* Respects the visitor's reduced-motion setting.

Bundles [Plugin Update Checker](https://github.com/YahnisElsts/plugin-update-checker) 5 (MIT).

== Installation ==

1. Download `wp-banner.zip` from the latest release on https://github.com/Andrusi4ka/WP-Banner/releases.
2. In WordPress go to Plugins > Add New > Upload Plugin and upload the zip, then activate it.
3. Go to WP Banner > Add scene, add the layers and publish.
4. Add the "WP Banner" element in WPBakery and choose the scene, or paste the shortcode shown in the scene's "Shortcode" box into a page.

Deleting the plugin under Plugins removes its scenes and settings; the images stay in the media library.

== Changelog ==

= 0.1.0 =
* Banners of image and title layers that move as the page scrolls, with a visual editor and desktop, tablet and phone previews.
* Motion: travel, zoom and the opacity a layer ends at, each behind a switch; image edges kept out of view while layers move.
* Settings per device, tablet and mobile following the larger screen, with a reset beside each slider; an image of its own for tablet and phone.
* Placement by class: the element becomes the background of the row, column or block with the scene's class.
* WPBakery element with "Edit scene" and "Add scene"; under Woodmart's "Theme elements".
* Scene height in px, vh, % or Auto.
* Updates from GitHub releases; a "What's new" window after an update.
