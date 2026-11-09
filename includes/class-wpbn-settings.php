<?php
defined('ABSPATH') || exit;
class WPBN_Settings {
    const META = '_wpbn_scene';
    // The most layers a scene keeps (admin.js stops adding them there too).
    const MAX_LAYERS = 40;
    // Placement: "target", a class; the WP Banner element standing inside a row, column or block with it
    // becomes that block's background, taking its size, behind its content (empty: not used).
    public static function defaults() {
        return array('height'=>720, 'tablet_height'=>null, 'mobile_height'=>null, 'height_unit'=>'auto', 'tablet_height_unit'=>null, 'mobile_height_unit'=>null,
            'target'=>'', 'css_id'=>'', 'css_class'=>'', 'layers'=>array());
    }
    // The scene's own id and classes (Scene settings, Attributes), on its <section>, as WPBakery's "Element ID" and
    // "Extra class name": an id (a letter first; letters, digits, - and _), classes separated by spaces (a dot dropped).
    public static function css_id($value) {
        $value = is_string($value) ? ltrim(trim($value), '#') : '';
        return preg_match('/^[A-Za-z][\w-]{0,79}$/', $value) ? $value : '';
    }
    public static function css_classes($value) {
        $classes = array();
        foreach (preg_split('/[\s,]+/', is_string($value) ? $value : '') as $class) {
            $class = self::css_class($class);
            if ($class !== '' && !in_array($class, $classes, true)) { $classes[] = $class; }
        }
        return substr(implode(' ', $classes), 0, 200);
    }
    // A layer's Container: the box its Position X and Width are shares of, centred in the scene. full: the whole
    // scene; theme: the theme's content width (Woodmart's container, a block theme's content size; WPBN_Container),
    // so a layer lines up with the page's content; custom: container_width (px). The editor gives a new title the
    // theme's and a new image the whole scene (a photo and its cutout fill it); layers from before it: the whole scene.
    const CONTAINERS = array('full', 'theme', 'custom');
    // Placement by class applies only while the (desktop) Height is Auto: the height then comes from the block
    // around the scene. With another height the switch is greyed in the editor and does nothing; it is kept.
    public static function placed_by_class($s) {
        return $s['target'] !== '' && $s['height_unit'] === 'auto';
    }
    // A class as the block's "Extra class name" field takes it: one class, no dot.
    public static function css_class($value) {
        return is_string($value) ? substr(sanitize_html_class(ltrim(trim($value), '.')), 0, 80) : '';
    }
    // Height per device: a number and its unit. Auto fills the parent column (frontend.js). Tablet and
    // mobile without a unit of their own (null) take the larger screen's height and unit (mobile → tablet → desktop).
    const UNITS = array('auto', 'px', 'vh', '%');
    // An overlay's Height: % of the scene (100: all of it), px or vh; its Width: % of its container, px or vw.
    const LAYER_UNITS = array('%', 'px', 'vh');
    const WIDTH_UNITS = array('%', 'px', 'vw');
    const OVERLAY_WIDTHS = array('desktop'=>array('overlay_width','overlay_width_unit'), 'tablet'=>array('tablet_overlay_width','tablet_overlay_width_unit'), 'mobile'=>array('mobile_overlay_width','mobile_overlay_width_unit'));
    // A title's or a Text layer's Width per device: Auto (as wide as its text, up to its container: as before it had one),
    // % of its container, px or vw; its lines wrap there, never wider than its container.
    const TEXT_WIDTHS = array('desktop'=>array('text_width','text_width_unit'), 'tablet'=>array('tablet_text_width','tablet_text_width_unit'), 'mobile'=>array('mobile_text_width','mobile_text_width_unit'));
    const TEXT_WIDTH_UNITS = array('auto', '%', 'px', 'vw');
    public static function text_sized($l) { return in_array($l['type'], array('text', 'richtext'), true); }
    const HEIGHTS = array('desktop'=>array('height','height_unit'), 'tablet'=>array('tablet_height','tablet_height_unit'), 'mobile'=>array('mobile_height','mobile_height_unit'));
    // Before frontend.js sizes an Auto scene, and where it finds no free height.
    const FALLBACK_HEIGHT = 500;
    // Each device's height as [number, unit], the inherited ones filled in.
    public static function heights($s, $map = self::HEIGHTS) {
        $out = array();
        $last = null;
        foreach ($map as $device=>$keys) {
            $out[$device] = $last = ($s[$keys[1]] ?? null) === null && $last ? $last : array($s[$keys[0]], $s[$keys[1]]);
        }
        return $out;
    }
    public static function css_heights($s) {
        $css = array();
        foreach (self::heights($s) as $device=>$h) {
            $css[$device] = $h[1] === 'auto' ? self::FALLBACK_HEIGHT.'px' : $h[0].$h[1];
        }
        return $css;
    }
    // Layer settings with a value per device. Desktop always has one; tablet
    // and mobile may be null: the larger screen's (mobile → tablet → desktop).
    // The motion ones are reached at the end of the scroll: travel (px),
    // zoom (% of the layer's size added) and end_opacity (the layer's opacity at the end, %; it starts at its Opacity).
    const RESPONSIVE = array('x'=>array(-100,200), 'y'=>array(-100,200), 'width'=>array(1,300), 'scale'=>array(10,300), 'opacity'=>array(0,100),
        'move_x'=>array(-1000,1000), 'move_y'=>array(-1000,1000), 'zoom'=>array(-90,300), 'end_opacity'=>array(0,100))
        // The Animation's per-device values (WPBN_Animation): where it starts and ends, how long a run takes.
        + WPBN_Animation::RESPONSIVE;
    const MOTION = array('move_x', 'move_y', 'zoom');
    const FITS = array('cover','contain');
    // overlay: a colour or a Gradient over the whole scene, over the layers under it (e.g. a photo shaded under
    // the title); it does not move, only its Opacity at the end (effective()).
    // richtext: "Text" in the editor (text is the title's key): paragraphs and lists from WordPress's editor (rich_text()).
    // button: a button as WP Top Info Bar's (its text, link, Background, Corners, Size per device, colours).
    // shortcode: another plugin's element (a slider…) by its shortcode, as wide as its Width, in its place among the layers.
    // shape: an SVG's objects (WPBN_Shape), each a window onto what it is filled with.
    const TYPES = array('image', 'text', 'overlay', 'richtext', 'button', 'shortcode', 'shape');
    // Title, Text, Button and Shortcode: placed by their Position within their container (their own point there), at 100% scale and opacity.
    public static function textual($l) { return in_array($l['type'], array('text', 'richtext', 'button', 'shortcode'), true); }
    // An image layer with "Fill the scene" on (default; as before 2026-11-08): it fills the scene (Cover / Contain, Scale).
    // Off: an object, as an overlay: its Container, Width and Height per device (Height Auto: the image's proportions),
    // placed by its Position as a title is; Image fit and the point in view within its box.
    public static function fills($l) { return $l['type'] === 'image' && !empty($l['fill_scene']); }
    public static function object($l) { return $l['type'] === 'image' && empty($l['fill_scene']); }
    // Placed by their Position as a title is (their own point there, 0–100% within their container).
    public static function anchored($l) { return self::textual($l) || $l['type'] === 'overlay' || self::object($l); }
    // An overlay, a shortcode and an image object have a Width of their own (OVERLAY_WIDTHS), not their content's.
    public static function sized($l) { return $l['type'] === 'overlay' || $l['type'] === 'shortcode' || self::object($l); }
    // A Shortcode layer's text: as a post's (wp_kses_post), without this plugin's own shortcodes (a banner in itself).
    const OWN_SHORTCODES = '/\[\/?(wp_banner|wp_banner_motion|wp_layer_motion)\b[^\]]*\]/i';
    public static function shortcode($text) {
        return trim(substr(preg_replace(self::OWN_SHORTCODES, '', wp_kses_post((string) $text)), 0, 5000));
    }
    // A button's Background, Corners and Size (WoodMart's size presets, as WP Top Info Bar's: padding, height, font size).
    const BUTTON_STYLES = array('filled', 'bordered', 'underline');
    const BUTTON_SHAPES = array('square', 'rounded', 'round');
    const BUTTON_SIZES = array('extra-small'=>array('5px 10px', '28px', '11px'), 'small'=>array('5px 14px', '36px', '12px'), 'default'=>array('5px 20px', '42px', '13px'),
        'large'=>array('5px 28px', '48px', '14px'), 'extra-large'=>array('5px 40px', '56px', '16px'));
    // Its link: a page address, a path or #anchor, mailto: or tel:.
    const BUTTON_PROTOCOLS = array('http', 'https', 'mailto', 'tel');
    // A new overlay's colour (the editor's; color is also a title's colour).
    const OVERLAY_COLOR = 'rgba(0,0,0,0.4)';
    // A text layer is the banner's title: a heading (h2 unless it is the page's h1, or a lower one).
    const TAGS = array('h1', 'h2', 'h3', 'h4', 'h5');
    // A title's Case (CSS text-transform) and its Shadow's colour to start with.
    const CASES = array('none', 'uppercase', 'lowercase', 'capitalize');
    const SHADOW_COLOR = 'rgba(0,0,0,0.5)';
    // Filters (an image layer's, a Shape layer's object's): key => [min, max, value at rest, CSS function, unit].
    const FILTERS = array('f_grayscale'=>array(0, 100, 0, 'grayscale', '%'), 'f_blur'=>array(0, 40, 0, 'blur', 'px'), 'f_brightness'=>array(0, 200, 100, 'brightness', '%'),
        'f_contrast'=>array(0, 200, 100, 'contrast', '%'), 'f_saturate'=>array(0, 300, 100, 'saturate', '%'));
    public static function filters($raw) {
        $out = array();
        foreach (self::FILTERS as $key=>$f) { $out[$key] = round(self::number($raw[$key] ?? null, $f[2], $f[0], $f[1]), 1); }
        return $out;
    }
    // The filters as CSS filter (only those away from their rest); '' for none.
    public static function filter_css($o) {
        $parts = array();
        foreach (self::FILTERS as $key=>$f) {
            $value = isset($o[$key]) ? (float) $o[$key] : $f[2];
            if ($value != $f[2]) { $parts[] = $f[3].'('.$value.$f[4].')'; }
        }
        return implode(' ', $parts);
    }
    // A Shape layer's SVG in the scene, per device: Cover (fills it, cropped), Contain (whole, inside it), Stretch (its size).
    const SHAPE_FITS = array('cover', 'contain', 'stretch');
    public static function layer() {
        $l = array('name'=>'Layer', 'type'=>'image', 'image'=>0, 'image_tablet'=>0, 'image_mobile'=>0, 'text'=>'YOUR TITLE', 'content'=>'', 'shortcode'=>'', 'color'=>'#ffffff', 'accent_color'=>'', 'font_size'=>120, 'tablet_font_size'=>null, 'mobile_font_size'=>null,
            'tag'=>'h2', 'font_family'=>'', 'font_weight'=>800,
            // A title's Letter spacing (px, per device as Font size), Case (text-transform), Style (italic) and Shadow.
            'letter_spacing'=>0, 'tablet_letter_spacing'=>null, 'mobile_letter_spacing'=>null, 'text_transform'=>'none', 'font_style'=>'normal',
            'use_shadow'=>false, 'shadow_color'=>self::SHADOW_COLOR, 'shadow_x'=>0, 'shadow_y'=>2, 'shadow_blur'=>10,
            // An overlay's Shadow Inside its edges (a vignette) instead of around it.
            'shadow_inset'=>false,
            // An overlay's Height per device, as the scene's (heights()): 100% of the scene; tablet and mobile follow the larger screen.
            'height'=>100, 'height_unit'=>'%', 'tablet_height'=>null, 'tablet_height_unit'=>null, 'mobile_height'=>null, 'mobile_height_unit'=>null,
            // Its Blur (px, per device as Font size): the layers under it blurred (backdrop-filter); 0: none.
            'backdrop_blur'=>0, 'tablet_backdrop_blur'=>null, 'mobile_backdrop_blur'=>null,
            // Its Width per device, kept as its Height (widths()): 100% of its container.
            'overlay_width'=>100, 'overlay_width_unit'=>'%', 'tablet_overlay_width'=>null, 'tablet_overlay_width_unit'=>null, 'mobile_overlay_width'=>null, 'mobile_overlay_width_unit'=>null,
            // A title's or a Text layer's Width per device (TEXT_WIDTHS): Auto, its text's.
            'text_width'=>600, 'text_width_unit'=>'auto', 'tablet_text_width'=>null, 'tablet_text_width_unit'=>null, 'mobile_text_width'=>null, 'mobile_text_width_unit'=>null,
            // An image layer fills the scene; off: an object (fills(), object()).
            'fill_scene'=>true,
            // A Shape layer's SVG (an attachment WPBN_Shape wrote) and its objects [{key, name, hidden}], the back one first.
            'shape'=>0, 'shape_objects'=>array(), 'shape_fit'=>'cover', 'shape_fit_tablet'=>null, 'shape_fit_mobile'=>null,
            // The layer's own name for others to point to it (a Shape object showing it: WPBN_Shape), given by the editor; '' none yet.
            'uid'=>'',
            // Decorative: an image screen readers skip (alt=""), e.g. a cutout of the photo behind it; off: its alt text from the media library.
            'decorative'=>false,
            // Follow the mouse (px): how far the layer moves as the pointer crosses the scene (devices with a mouse; WPBN_Render, frontend.js).
            'use_mouse'=>false, 'mouse'=>20,
            'x'=>50, 'y'=>50, 'width'=>100, 'scale'=>100, 'move_x'=>0, 'move_y'=>-60, 'zoom'=>0, 'end_opacity'=>0,
            'opacity'=>100, 'fit'=>'cover', 'focus_x'=>50, 'focus_y'=>50, 'hidden'=>false, 'container'=>'full', 'container_width'=>1200, 'container_width_tablet'=>null, 'container_width_mobile'=>null,
            // Gradient (WPBN_Gradient): an overlay's fill instead of its colour, with its switch on (only overlays: WPBN_Render).
            'use_gradient'=>false, 'gradient'=>WPBN_Gradient::DEFAULT_VALUE,
            // A button (as WP Top Info Bar's): its text, link (a new window or not), Background, Corners, Size per device
            // (tablet and mobile null: the larger screen's), Fill / border color and Text color.
            'button_text'=>'Learn more', 'button_url'=>'', 'button_new_tab'=>false, 'button_style'=>'filled', 'button_shape'=>'square',
            'button_size'=>'default', 'button_size_tablet'=>null, 'button_size_mobile'=>null, 'button_color'=>'#2271b1', 'button_text_color'=>'#ffffff',
            'use_scale'=>false, 'use_opacity'=>false, 'use_move_x'=>false, 'use_move_y'=>false, 'use_zoom'=>false, 'use_end_opacity'=>false)
            // Animation (WPBN_Animation): motion of its own, running by itself; off by default.
            + WPBN_Animation::defaults()
            // Filters: at rest (none).
            + array_map(function ($f) { return $f[2]; }, self::FILTERS);
        foreach (array_merge(array_keys(self::RESPONSIVE), array('fit')) as $key) { $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
        return $l;
    }
    // A setting's value on each device, the inherited ones filled in.
    public static function resolved($l, $key) {
        $tablet = $l[$key.'_tablet'] ?? null;
        $tablet = $tablet === null ? $l[$key] : $tablet;
        $mobile = $l[$key.'_mobile'] ?? null;
        return array('desktop'=>$l[$key], 'tablet'=>$tablet, 'mobile'=>$mobile === null ? $tablet : $mobile);
    }
    // Settings with a switch: they apply only with it on; off, they have their value at rest (their values kept).
    // key => [switch, value when off, image layers only]: Scale and Opacity of an image layer; every layer's motion.
    // A layer's Width is always its container's (100%: effective()).
    const OPTIONAL = array('scale'=>array('use_scale', 100, true), 'opacity'=>array('use_opacity', 100, true),
        'move_x'=>array('use_move_x', 0, false), 'move_y'=>array('use_move_y', 0, false), 'zoom'=>array('use_zoom', 0, false),
        // Off: the layer keeps its Opacity to the end (no value of its own: see fade()).
        'end_opacity'=>array('use_end_opacity', null, false));
    public static function effective($l) {
        // Every layer is as wide as its container (the scene on Full width): no Width setting (titles had one until
        // 2026-11-08; the value kept is not used).
        $l['width'] = 100; $l['width_tablet'] = null; $l['width_mobile'] = null;
        // A title has no Scale and no Opacity (2026-11-08): 100% (the values kept are not used). Its Position is
        // within its container (0–100%: frontend.css places it so); an overlay's too.
        if (self::textual($l)) {
            foreach (array('scale', 'opacity') as $key) { $l[$key] = 100; $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
        }
        if (self::anchored($l)) {
            foreach (array('x', 'y') as $key) { foreach (array('', '_tablet', '_mobile') as $suffix) { if ($l[$key.$suffix] !== null) { $l[$key.$suffix] = max(0, min(100, $l[$key.$suffix])); } } }
        }
        // An overlay: as wide as its Container, its own Height, placed by its Position as a title is; it stays there:
        // at 100% scale and opacity, no travel or zoom (its edges would show); only its Opacity at the end (the values
        // kept are not used).
        if ($l['type'] === 'overlay') {
            foreach (array('scale'=>100, 'opacity'=>100, 'move_x'=>0, 'move_y'=>0, 'zoom'=>0) as $key=>$value) { $l[$key] = $value; $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
        }
        // A Shape layer: the whole scene, in place (its objects move on their own: WPBN_Shape); no Animation or fade
        // (the copies of the layers in its objects would no longer line up with them, frosted glass would show nothing).
        if ($l['type'] === 'shape') {
            foreach (array('x'=>50, 'y'=>50, 'scale'=>100, 'opacity'=>100, 'move_x'=>0, 'move_y'=>0, 'zoom'=>0) as $key=>$value) { $l[$key] = $value; $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
            $l['container'] = 'full'; $l['use_anim'] = false; $l['use_end_opacity'] = false; $l['use_mouse'] = false;
        }
        foreach (self::OPTIONAL as $key=>$o) {
            list($flag, $off, $image_only) = $o;
            if ($off !== null && ($l['type'] === 'image' || !$image_only) && empty($l[$flag])) { $l[$key] = $off; $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
        }
        return $l;
    }
    // What frontend.js adds to the opacity by the end of the scroll, per device [desktop, tablet, mobile]:
    // from the layer's Opacity to its Opacity at the end ($l as effective() gives it); nothing while its switch is off.
    public static function fade($l) {
        $start = self::resolved($l, 'opacity');
        $end = self::resolved($l, 'end_opacity');
        $fade = array();
        foreach ($start as $device=>$value) { $fade[] = empty($l['use_end_opacity']) ? 0 : $end[$device] - $value; }
        return $fade;
    }
    // A title's letter spacing on each device (px), the inherited ones filled in.
    public static function spacings($l) { return self::inherited($l, 'letter_spacing'); }
    // An overlay's Blur on each device (px), the inherited ones filled in.
    public static function blurs($l) { return self::inherited($l, 'backdrop_blur'); }
    // A title's Shadow as CSS text-shadow; '' with its switch off.
    public static function shadow($l) {
        return empty($l['use_shadow']) ? '' : $l['shadow_x'].'px '.$l['shadow_y'].'px '.$l['shadow_blur'].'px '.$l['shadow_color'];
    }
    // A title's font size on each device (px), the inherited ones filled in.
    public static function fonts($l) { return self::inherited($l, 'font_size'); }
    // A value per device kept as $key, tablet_$key and mobile_$key (null: the larger screen's), the inherited ones filled in.
    private static function inherited($l, $key) {
        $tablet = $l['tablet_'.$key] ?? null;
        $tablet = $tablet === null ? $l[$key] : $tablet;
        $mobile = $l['mobile_'.$key] ?? null;
        return array('desktop'=>$l[$key], 'tablet'=>$tablet, 'mobile'=>$mobile === null ? $tablet : $mobile);
    }
    // The image on each device: tablet and mobile 0 = the larger screen's.
    public static function images($l) {
        $tablet = $l['image_tablet'] ?: $l['image'];
        return array('desktop'=>$l['image'], 'tablet'=>$tablet, 'mobile'=>$l['image_mobile'] ?: $tablet);
    }
    private static function number($value, $fallback, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? max($min, min($max, (float)$value)) : $fallback;
    }
    // A color as the color fields keep it (admin.js colorField()): "#rrggbb", or "rgba(r,g,b,a)" below full
    // opacity (a fully opaque one as "#rrggbb"). "#rgb" is widened; anything else: the fallback.
    public static function color($value, $fallback) {
        $value = is_string($value) ? strtolower(preg_replace('/\s+/', '', $value)) : '';
        if (preg_match('/^#([0-9a-f])([0-9a-f])([0-9a-f])$/', $value, $m)) { return '#'.$m[1].$m[1].$m[2].$m[2].$m[3].$m[3]; }
        if (preg_match('/^#[0-9a-f]{6}$/', $value)) { return $value; }
        if (preg_match('/^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d*\.?\d+)\)$/', $value, $m)) {
            $rgb = array(min(255, (int) $m[1]), min(255, (int) $m[2]), min(255, (int) $m[3]));
            $alpha = round(min(1, (float) $m[4]), 2);
            return $alpha >= 1 ? vsprintf('#%02x%02x%02x', $rgb) : 'rgba('.implode(',', $rgb).','.$alpha.')';
        }
        return $fallback;
    }
    // A title's text: plain text with its line breaks, and <u>…</u> around the words in the accent color
    // (as Woodmart's titles). Only bare <u> and </u> stay (any case, no attributes), paired and never nested:
    // an unclosed one ends with the text, a stray </u> goes.
    const U_OPEN = '[[wpbn-u]]';
    const U_CLOSE = '[[/wpbn-u]]';
    public static function title_text($text) {
        $text = preg_replace(array('/<u\s*>/i', '/<\/u\s*>/i'), array(self::U_OPEN, self::U_CLOSE), (string) $text);
        $out = '';
        $open = false;
        foreach (preg_split('/(\[\[\/?wpbn-u\]\])/', sanitize_textarea_field($text), -1, PREG_SPLIT_DELIM_CAPTURE) as $part) {
            if ($part === self::U_OPEN || $part === self::U_CLOSE) {
                if (($part === self::U_OPEN) !== $open) { $out .= $open ? '</u>' : '<u>'; $open = !$open; }
                continue;
            }
            $out .= $part;
        }
        return $open ? $out.'</u>' : $out;
    }
    /*
     * A Text layer's HTML, as WP Swiper's descriptions keep theirs: paragraphs, headings (h1–h6) and line breaks,
     * bold, italic, underline, a colour (a span the editor styles), links (href, target, rel; one opening in another
     * tab gets "noopener"), bulleted and numbered lists; paragraphs, headings and list items aligned (their
     * text-align only). Only tags or the editor's empty paragraph: ''.
     */
    const RICH_TAGS = array('p'=>array('style'=>true), 'h1'=>array('style'=>true), 'h2'=>array('style'=>true), 'h3'=>array('style'=>true),
        'h4'=>array('style'=>true), 'h5'=>array('style'=>true), 'h6'=>array('style'=>true), 'br'=>array(), 'strong'=>array(), 'b'=>array(), 'em'=>array(), 'i'=>array(), 'u'=>array(),
        'span'=>array('style'=>true), 'a'=>array('href'=>true, 'target'=>true, 'rel'=>true), 'ul'=>array(), 'ol'=>array(), 'li'=>array('style'=>true));
    const RICH_STYLES = array('color', 'text-decoration', 'text-decoration-line', 'text-align');
    public static function rich_text($html) {
        $html = preg_replace_callback('#<(p|h[1-6]|li)\b([^>]*)>#i', function ($m) {
            return '<'.strtolower($m[1]).(preg_match('/text-align\s*:\s*(left|center|right|justify)/i', $m[2], $a) ? ' style="text-align: '.strtolower($a[1]).'"' : '').'>';
        }, (string) $html);
        $only = function () { return WPBN_Settings::RICH_STYLES; };
        add_filter('safe_style_css', $only, 999);
        $html = trim(wp_kses($html, self::RICH_TAGS));
        remove_filter('safe_style_css', $only, 999);
        // A link opening in another tab: "noopener" in its rel (as WP Swiper's noopener()).
        $html = preg_replace_callback('#<a\s[^>]*\btarget="[^"]*"[^>]*>#i', function ($m) {
            if (preg_match('#\brel="([^"]*)"#i', $m[0], $rel)) {
                return preg_match('#(^|\s)noopener(\s|$)#i', $rel[1]) ? $m[0] : str_replace($rel[0], 'rel="'.trim($rel[1].' noopener').'"', $m[0]);
            }
            return substr($m[0], 0, -1).' rel="noopener">';
        }, $html);
        $text = preg_replace('/[\s\x{00A0}]+/u', '', html_entity_decode(wp_strip_all_tags($html), ENT_QUOTES, 'UTF-8'));
        return (string) $text === '' ? '' : $html;
    }
    private static function choice($value, $allowed, $fallback) {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }
    public static function sanitize($input) {
        $input = is_array($input) ? $input : array();
        $out = self::defaults();
        $px = array('desktop'=>720.0, 'tablet'=>600.0, 'mobile'=>540.0);
        foreach (self::HEIGHTS as $device=>$keys) {
            list($key, $unit) = $keys;
            // Auto by default on desktop: the height of the block around the scene. Tablet and mobile
            // follow the larger screen unless they have a unit of their own (then a number too).
            $out[$unit] = in_array($input[$unit] ?? null, self::UNITS, true) ? $input[$unit] : $out[$unit];
            if ($out[$unit] === null) { $out[$key] = null; continue; }
            // px: a fixed size; vh and %: a share (100 = all of it). Auto keeps the number for a later switch back.
            $out[$key] = in_array($out[$unit], array('vh','%'), true) ? self::number($input[$key] ?? null, 100, 1, 200) : self::number($input[$key] ?? null, $px[$device], $out[$unit] === 'px' ? 160 : 1, 2400);
        }
        $out['target'] = self::css_class($input['target'] ?? '');
        $out['css_id'] = self::css_id($input['css_id'] ?? '');
        $out['css_class'] = self::css_classes($input['css_class'] ?? '');
        // Scenes saved with the former "Insert into blocks by class" switch off: no class.
        if (array_key_exists('by_class', $input) && empty($input['by_class'])) { $out['target'] = ''; }
        foreach (array_slice(is_array($input['layers'] ?? null) ? $input['layers'] : array(), 0, self::MAX_LAYERS) as $raw) {
            if (!is_array($raw)) { continue; }
            $l = self::layer();
            if (is_string($raw['name'] ?? null)) { $l['name'] = sanitize_text_field($raw['name']); }
            // Text keeps its line breaks and its <u> (the accent words, as in Woodmart's titles).
            if (is_string($raw['text'] ?? null)) { $l['text'] = self::title_text($raw['text']); }
            // A Text layer's paragraphs and lists (its editor's HTML, cleaned).
            if (is_string($raw['content'] ?? null)) { $l['content'] = self::rich_text($raw['content']); }
            // A Shortcode layer's shortcode.
            if (is_string($raw['shortcode'] ?? null)) { $l['shortcode'] = self::shortcode($raw['shortcode']); }
            $l['type'] = self::choice($raw['type'] ?? null, self::TYPES, 'image');
            foreach (array('image', 'image_tablet', 'image_mobile') as $key) { $l[$key] = is_scalar($raw[$key] ?? null) ? absint($raw[$key]) : 0; }
            // A title's colour; an overlay's fill.
            $l['color'] = self::color($raw['color'] ?? null, $l['type'] === 'overlay' ? self::OVERLAY_COLOR : '#ffffff');
            // The words in <u>: '' = the theme's primary color (Woodmart's), or the title's color without it.
            $l['accent_color'] = self::color($raw['accent_color'] ?? null, '');
            $l['hidden'] = !empty($raw['hidden']);
            $l['font_size'] = self::number($raw['font_size'] ?? null, $l['font_size'], 8, 500);
            // Tablet and mobile: empty follows the larger screen (scenes saved before tablets had a size of their own too).
            foreach (array('tablet_font_size'=>500, 'mobile_font_size'=>250) as $key=>$max) {
                $value = $raw[$key] ?? null;
                $l[$key] = $value === null || $value === '' ? null : self::number($value, null, 8, $max);
            }
            // Titles saved as div or p (before text layers became titles): h2.
            $l['tag'] = self::choice($raw['tag'] ?? null, self::TAGS, 'h2');
            // A font family as CSS takes it ("Playfair Display", serif); empty = the theme's.
            // Or one of Woodmart's font variables (WPBN_Fonts::THEME): the title follows Theme Settings.
            $family = is_string($raw['font_family'] ?? null) ? trim($raw['font_family']) : '';
            $l['font_family'] = preg_match('/^var\(--wd-(title|text|alternative)-font\)$/', $family) ? $family : substr(trim(preg_replace('/[^\w \-,\'"]/u', '', $family)), 0, 120);
            $l['font_weight'] = (int) round(self::number($raw['font_weight'] ?? null, 800, 100, 900) / 100) * 100;
            // Letter spacing (px, to 0.1): tablet and mobile empty follow the larger screen.
            $l['letter_spacing'] = round(self::number($raw['letter_spacing'] ?? null, 0, -20, 100), 1);
            foreach (array('tablet_letter_spacing', 'mobile_letter_spacing') as $key) {
                $value = $raw[$key] ?? null;
                $l[$key] = $value === null || $value === '' ? null : round(self::number($value, 0, -20, 100), 1);
            }
            $l['text_transform'] = self::choice($raw['text_transform'] ?? null, self::CASES, 'none');
            $l['font_style'] = self::choice($raw['font_style'] ?? null, array('normal', 'italic'), 'normal');
            $l['use_shadow'] = !empty($raw['use_shadow']);
            $l['shadow_inset'] = !empty($raw['shadow_inset']);
            $l['shadow_color'] = self::color($raw['shadow_color'] ?? null, self::SHADOW_COLOR);
            foreach (array('shadow_x'=>array(-100, 100), 'shadow_y'=>array(-100, 100), 'shadow_blur'=>array(0, 200)) as $key=>$range) {
                $l[$key] = round(self::number($raw[$key] ?? null, $l[$key], $range[0], $range[1]), 1);
            }
            foreach (self::RESPONSIVE as $key=>$range) {
                $l[$key] = self::number($raw[$key] ?? null, $l[$key], $range[0], $range[1]);
                foreach (array('_tablet','_mobile') as $suffix) {
                    $value = $raw[$key.$suffix] ?? null;
                    $l[$key.$suffix] = $value === null || $value === '' ? null : self::number($value, null, $range[0], $range[1]);
                }
            }
            // Scenes saved before the switches: on where a device has a value other than the one at rest.
            foreach (self::OPTIONAL as $key=>$o) {
                list($flag, $off) = $o;
                if ($off === null) { continue; }
                $l[$flag] = array_key_exists($flag, $raw) ? !empty($raw[$flag]) : count(array_filter(array($l[$key], $l[$key.'_tablet'], $l[$key.'_mobile']), function ($v) use ($off) { return $v !== null && (float) $v !== (float) $off; })) > 0;
            }
            $l['use_end_opacity'] = !empty($raw['use_end_opacity']);
            // Scenes saved with "Fade" (opacity added by the end): the opacity it ended at, on each device.
            if (!array_key_exists('end_opacity', $raw) && isset($raw['fade'])) {
                $old = array();
                foreach (array('', '_tablet', '_mobile') as $suffix) {
                    $value = $raw['fade'.$suffix] ?? null;
                    $old['fade'.$suffix] = $value === null || $value === '' ? ($suffix === '' ? 0 : null) : self::number($value, 0, -100, 100);
                }
                $fade = self::resolved($old, 'fade');
                $start = self::resolved(self::effective($l), 'opacity');
                $end = array();
                foreach ($fade as $device=>$value) { $end[$device] = (float) max(0, min(100, $start[$device] + $value)); }
                $l['end_opacity'] = $end['desktop'];
                $l['end_opacity_tablet'] = $end['tablet'] != $end['desktop'] ? $end['tablet'] : null;
                $l['end_opacity_mobile'] = $end['mobile'] != $end['tablet'] ? $end['mobile'] : null;
                $l['use_end_opacity'] = array_key_exists('use_fade', $raw) ? !empty($raw['use_fade']) : (bool) array_filter($fade);
            }
            // Container. Titles saved while it was the scene's (before it was each layer's): the scene's.
            $from_scene = $l['type'] === 'text' && !array_key_exists('container', $raw) && isset($input['container']);
            $l['container'] = self::choice($from_scene ? $input['container'] : ($raw['container'] ?? null), self::CONTAINERS, 'full');
            $l['container_width'] = (int) round(self::number($from_scene ? ($input['container_width'] ?? null) : ($raw['container_width'] ?? null), 1200, 320, 3000));
            // Its own on tablet / mobile; empty follows the larger screen.
            foreach (array('_tablet', '_mobile') as $suffix) {
                $value = $raw['container_width'.$suffix] ?? null;
                $l['container_width'.$suffix] = $value === null || $value === '' ? null : (int) round(self::number($value, 1200, 320, 3000));
            }
            $l['decorative'] = !empty($raw['decorative']);
            // A Shape layer: its SVG and its objects (only the file's own: WPBN_Shape::objects()).
            if ($l['type'] === 'shape') {
                $l['shape'] = is_scalar($raw['shape'] ?? null) ? absint($raw['shape']) : 0;
                $l['shape_objects'] = WPBN_Shape::objects($l['shape'], $raw['shape_objects'] ?? null);
                if (!$l['shape_objects']) { $l['shape'] = 0; }
                $l['shape_fit'] = self::choice($raw['shape_fit'] ?? null, self::SHAPE_FITS, 'cover');
                foreach (array('_tablet', '_mobile') as $suffix) { $l['shape_fit'.$suffix] = self::choice($raw['shape_fit'.$suffix] ?? null, self::SHAPE_FITS, null); }
            }
            $l['uid'] = is_string($raw['uid'] ?? null) && preg_match('/^[a-z0-9]{4,16}$/', $raw['uid']) ? $raw['uid'] : '';
            $l = array_merge($l, self::filters($raw));
            $l['use_mouse'] = !empty($raw['use_mouse']);
            $l['mouse'] = round(self::number($raw['mouse'] ?? null, 20, -200, 200));
            // Fill the scene (an image layer); off: an object. Layers saved before: on.
            $l['fill_scene'] = array_key_exists('fill_scene', $raw) ? !empty($raw['fill_scene']) : true;
            // An overlay's Height: px, vh or % of the scene (no Auto); tablet and mobile without a unit follow the larger screen.
            // An image object's too, or Auto (as tall as the image at its width), its default.
            $height_units = $l['type'] === 'image' ? array_merge(array('auto'), self::LAYER_UNITS) : self::LAYER_UNITS;
            foreach (self::HEIGHTS as $device=>$keys) {
                list($key, $unit) = $keys;
                $l[$unit] = in_array($raw[$unit] ?? null, $height_units, true) ? $raw[$unit] : ($device === 'desktop' ? ($l['type'] === 'image' ? 'auto' : '%') : null);
                if ($l[$unit] === null) { $l[$key] = null; continue; }
                $range = array('%'=>array(100, 100), 'vh'=>array(100, 200), 'px'=>array(300, 2400), 'auto'=>array(100, 2400));
                $l[$key] = self::number($raw[$key] ?? null, $range[$l[$unit]][0], 1, $range[$l[$unit]][1]);
            }
            // An overlay's Blur (px): tablet and mobile empty follow the larger screen.
            $l['backdrop_blur'] = (int) round(self::number($raw['backdrop_blur'] ?? null, 0, 0, 100));
            foreach (array('tablet_backdrop_blur', 'mobile_backdrop_blur') as $key) {
                $value = $raw[$key] ?? null;
                $l[$key] = $value === null || $value === '' ? null : (int) round(self::number($value, 0, 0, 100));
            }
            // An overlay's Width, as its Height: %, px or vw.
            foreach (self::OVERLAY_WIDTHS as $device=>$keys) {
                list($key, $unit) = $keys;
                $l[$unit] = in_array($raw[$unit] ?? null, self::WIDTH_UNITS, true) ? $raw[$unit] : ($device === 'desktop' ? '%' : null);
                if ($l[$unit] === null) { $l[$key] = null; continue; }
                $range = array('%'=>array(100, 100), 'vw'=>array(100, 100), 'px'=>array(600, 3000));
                $l[$key] = self::number($raw[$key] ?? null, $range[$l[$unit]][0], 1, $range[$l[$unit]][1]);
            }
            // A title's or a Text layer's Width: Auto (layers saved before it: Auto), %, px or vw; tablet and mobile without a unit follow the larger screen.
            foreach (self::TEXT_WIDTHS as $device=>$keys) {
                list($key, $unit) = $keys;
                $l[$unit] = in_array($raw[$unit] ?? null, self::TEXT_WIDTH_UNITS, true) ? $raw[$unit] : ($device === 'desktop' ? 'auto' : null);
                if ($l[$unit] === null) { $l[$key] = null; continue; }
                $range = array('auto'=>array(600, 3000), '%'=>array(100, 100), 'vw'=>array(100, 100), 'px'=>array(600, 3000));
                $l[$key] = self::number($raw[$key] ?? null, $range[$l[$unit]][0], 1, $range[$l[$unit]][1]);
            }
            // A button's text, link and look.
            if (is_string($raw['button_text'] ?? null)) { $l['button_text'] = substr(sanitize_text_field($raw['button_text']), 0, 200); }
            $l['button_url'] = is_string($raw['button_url'] ?? null) ? esc_url_raw(trim($raw['button_url']), self::BUTTON_PROTOCOLS) : '';
            $l['button_new_tab'] = !empty($raw['button_new_tab']);
            $l['button_style'] = self::choice($raw['button_style'] ?? null, self::BUTTON_STYLES, 'filled');
            $l['button_shape'] = self::choice($raw['button_shape'] ?? null, self::BUTTON_SHAPES, 'square');
            $l['button_size'] = self::choice($raw['button_size'] ?? null, array_keys(self::BUTTON_SIZES), 'default');
            foreach (array('_tablet', '_mobile') as $suffix) { $l['button_size'.$suffix] = self::choice($raw['button_size'.$suffix] ?? null, array_keys(self::BUTTON_SIZES), null); }
            $l['button_color'] = self::color($raw['button_color'] ?? null, '#2271b1');
            $l['button_text_color'] = self::color($raw['button_text_color'] ?? null, '#ffffff');
            // Animation: its switch, type, delay, repeat and easing (its per-device values: RESPONSIVE, above).
            $l = WPBN_Animation::sanitize($raw, $l);
            $l['use_gradient'] = !empty($raw['use_gradient']);
            $l['gradient'] = WPBN_Gradient::sanitize($raw['gradient'] ?? null);
            // An image's point kept in view where its box crops it (object-position): one for every device.
            foreach (array('focus_x','focus_y') as $key) { $l[$key] = self::number($raw[$key] ?? null, 50, 0, 100); }
            $l['fit'] = in_array($raw['fit'] ?? null, self::FITS, true) ? $raw['fit'] : 'cover';
            foreach (array('_tablet','_mobile') as $suffix) { $l['fit'.$suffix] = in_array($raw['fit'.$suffix] ?? null, self::FITS, true) ? $raw['fit'.$suffix] : null; }
            // Scenes saved with "Motion on mobile (%)": that share of the travel becomes the mobile travel.
            if (isset($raw['mobile_motion']) && is_numeric($raw['mobile_motion']) && (float)$raw['mobile_motion'] != 100) {
                $share = max(0, min(100, (float)$raw['mobile_motion'])) / 100;
                foreach (array('move_x','move_y') as $key) {
                    if ($l[$key.'_mobile'] === null) { $l[$key.'_mobile'] = round(self::resolved($l, $key)['tablet'] * $share, 1); }
                }
            }
            $out['layers'][] = $l;
        }
        return $out;
    }
    // Sanitized (and old formats migrated) once a request per scene: a page may draw a scene more than once.
    private static $cache = array();
    public static function get($id) {
        $id = (int) $id;
        if (!isset(self::$cache[$id])) { self::$cache[$id] = self::sanitize(get_post_meta($id, self::META, true)); }
        return self::$cache[$id];
    }
    public static function forget($id) { unset(self::$cache[(int) $id]); }
    // The class a scene is placed by ('' none), without sanitizing its layers (the editor lists the other scenes').
    public static function placed_class($id) {
        $raw = get_post_meta($id, self::META, true);
        if (!is_array($raw) || (array_key_exists('by_class', $raw) && empty($raw['by_class']))) { return ''; }
        $unit = in_array($raw['height_unit'] ?? null, self::UNITS, true) ? $raw['height_unit'] : 'auto';
        return $unit === 'auto' ? self::css_class($raw['target'] ?? '') : '';
    }
}
