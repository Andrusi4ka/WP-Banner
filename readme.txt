=== WP Banner ===
Contributors: andrusi4ka
Tags: parallax, layers, scroll, animation, wpbakery
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Banners drawn from layers that move as the page scrolls: a photo, a title and a cutout in front of it, for a sense of depth.

== Description ==

WP Banner adds a "WP Banner" menu (for administrators only) where you build scenes from layers and show them anywhere with `[wp_banner id="123"]`, the "WP Banner" block or the "WP Banner" WPBakery element. It works with any theme; with Woodmart it also offers its fonts, colours and container.

* Layers of images, titles, texts, buttons, shortcodes and overlays, the front one at the top of the list; drag a layer to change its depth, hide, duplicate or delete it from its row.
* The classic mountain effect: the photo at the back, a title in the middle, a transparent cutout of the same photo in front.
* Motion as the page scrolls, each behind a switch: horizontal and vertical travel, zoom, and the opacity a layer ends at. Image edges never show while the layers move.
* Animation, for each layer: motion of its own that runs by itself, as well as the scroll motion, from the moment the page loads or once the banner is in view: zoom (with its direction), fade, or a slide sideways or up and down; start and end and duration per device, a delay, back and forth / from the start / once, and its easing. Paused while the banner is off the screen.
* Follow the mouse, for each layer: on computers it moves a little with the pointer; front layers moving more than back ones add depth.
* Per device (desktop, tablet, mobile): position, scale, opacity, motion, image fit, the image itself and the text size; tablet and mobile follow the larger screen until given their own. Each slider resets to its default.
* Scene attributes: an Element ID and extra CSS classes on the banner's block.
* Image objects: an image that does not fill the scene (Fill the scene off), with its own Width and Height per device (Auto: its proportions), placed where you put it.
* Image position: the part of a photo kept in view where its layer crops it, with each device's crop shown.
* Text layers: paragraphs, headings and lists written in WordPress's editor (bold, italic, underline, colours, alignment, lists, links), with their font, size and width per device, colour and shadow.
* Decorative images: screen readers skip a cutout or a second copy of a photo.
* Shortcode layers: another plugin's element (a slider…) by its shortcode, in its place among the layers, with its Width per device.
* Button layers: text, a link (also in a new window), Filled / Border / Underline, Square / Rounded / Round corners, preset sizes per device, colours; clickable on the banner.
* Overlay layers: a colour or a gradient shading the layers under it (e.g. the photo under the title), over the whole scene or a band of it (its container, a width and a height per device in %, px or vw / vh, its position); a blur of what is under it (frosted glass), per device; it can fade out as the page scrolls.
* Gradient for an overlay (as in WP Swiper): linear or radial, up to ten colours with opacity.
* Container, for each layer: it lines up with the page's content (the theme's container: Woodmart's or a block theme's content width), a width of your own (per device), or the whole scene.
* Title: line breaks, heading (h1–h5; h2 by default), colour (with opacity and the theme's colours, as in WP Swiper), an accent colour for the words wrapped in <u></u> (as Woodmart's titles; the theme's primary colour by default), font (with Woodmart: its fonts in a list with a search box, Google fonts loaded with the banner), weight (the font's own weights), size and letter spacing per device, case, italic and a shadow.
* Scene height in px, vh, % or Auto (fills the parent column), per device.
* Placed by class: inside a row, column or block with the scene's class, the element becomes that block's background, as wide and tall as the block, behind its content.
* The WPBakery element lists the scenes, with "Edit scene" and "Add scene"; with Woodmart it is under "Theme elements".
* Undo and Redo in the editor (Ctrl + Z, Ctrl + Shift + Z); the scene's earlier versions under Revisions (WordPress 6.4 or later).
* Duplicate a scene, export it to a file and import it on another site (its images downloaded into the media library).
* Preview beside the settings, as on a desktop, tablet or phone (or a screen size of your own), turned sideways too, with a page under the banner and a scroll simulation.
* Shape layers: an SVG of several objects (strips, a torn edge…), each a window onto a photo layer (with filters of its own: colour over black and white, sharp over blurred), an image, a colour or gradient, or frosted glass; an edge, a shadow, invert (a window cut out), opacity and its own travel as the page scrolls; the drawing fitted to the scene per device. Only the shapes of the SVG are kept: its scripts, styles and links are removed.
* Filters for image layers: black and white, blur, brightness, contrast, saturation.
* Respects the visitor's reduced-motion setting.

Bundles [Plugin Update Checker](https://github.com/YahnisElsts/plugin-update-checker) 5 (MIT) and [Pickr](https://github.com/simonwep/pickr) 1.9.1 (MIT).

== Installation ==

1. Download `wp-banner.zip` from the latest release on https://github.com/Andrusi4ka/WP-Banner/releases.
2. In WordPress go to Plugins > Add New > Upload Plugin and upload the zip, then activate it.
3. Go to WP Banner > Add scene, add the layers and publish.
4. Add the "WP Banner" block (block editor) or element (WPBakery) and choose the scene, or paste the shortcode shown in the scene's "Shortcode" box into a page.

Deleting the plugin under Plugins removes its scenes and settings; the images stay in the media library.

== Changelog ==

= 0.2.0 =
* Animation for each layer: zoom (with its direction), fade and slide, from the page's load or once the banner is in view, per device; paused off the screen.
* Follow the mouse: layers move a little with the pointer, for depth.
* Width for titles and texts, per device (Auto, %, px, vw).
* Decorative images, skipped by screen readers.
* Undo and Redo in the editor; revisions of a scene's settings (WordPress 6.4+).
* Duplicate, export and import scenes.
* The "WP Banner" block for the block editor.
* WPBakery's frontend editor: a banner added there moves at once.
* A gradient's direction shown as it is set; clearer help texts.
* Styles load in the page's head (no unstyled flash); a notice when a scene's settings cannot be saved.
* Without Woodmart, the title's accent words take a block theme's primary colour.

= 0.1.0 =
* Banners of layers that move as the page scrolls, with a visual editor and desktop, tablet and phone previews (a screen size of your own, turned sideways too).
* Layers: images (filling the scene, or objects with their own width and height), titles, texts (WordPress's editor), buttons, other plugins' shortcodes and overlays (a colour or a gradient, with blur).
* Titles: heading level, font from Woodmart's list, weight, size and letter spacing per device, case, italic, shadow, accent colour for words in <u></u>.
* Container for each layer (the theme's, a width of your own, or the whole scene) and a Position window that shows every device.
* Scene attributes: an Element ID and extra classes.
* Motion: travel, zoom and the opacity a layer ends at, each behind a switch; image edges kept out of view while layers move.
* Settings per device, tablet and mobile following the larger screen, with a reset beside each slider; an image of its own for tablet and phone.
* Placement by class: the element becomes the background of the row, column or block with the scene's class.
* WPBakery element with "Edit scene" and "Add scene"; under Woodmart's "Theme elements".
* Scene height in px, vh, % or Auto.
* Updates from GitHub releases; a "What's new" window after an update.
