<?php
defined('ABSPATH') || exit;
class WPBN_Settings {
    const META = '_wpbn_scene';
    // Placement: "target", a class; the WP Banner element standing inside a row, column or block with it
    // becomes that block's background, taking its size, behind its content (empty: not used).
    public static function defaults() {
        return array('height'=>720, 'tablet_height'=>null, 'mobile_height'=>null, 'height_unit'=>'auto', 'tablet_height_unit'=>null, 'mobile_height_unit'=>null,
            'target'=>'', 'layers'=>array());
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
    const HEIGHTS = array('desktop'=>array('height','height_unit'), 'tablet'=>array('tablet_height','tablet_height_unit'), 'mobile'=>array('mobile_height','mobile_height_unit'));
    // Before frontend.js sizes an Auto scene, and where it finds no free height.
    const FALLBACK_HEIGHT = 500;
    // Each device's height as [number, unit], the inherited ones filled in.
    public static function heights($s) {
        $out = array();
        $last = null;
        foreach (self::HEIGHTS as $device=>$keys) {
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
        'move_x'=>array(-1000,1000), 'move_y'=>array(-1000,1000), 'zoom'=>array(-90,300), 'end_opacity'=>array(0,100));
    const MOTION = array('move_x', 'move_y', 'zoom');
    const FITS = array('cover','contain');
    const TYPES = array('image', 'text');
    // A text layer is the banner's title: a heading (h2 unless it is the page's h1, or a lower one).
    const TAGS = array('h1', 'h2', 'h3', 'h4', 'h5');
    public static function layer() {
        $l = array('name'=>'Layer', 'type'=>'image', 'image'=>0, 'image_tablet'=>0, 'image_mobile'=>0, 'text'=>'YOUR TITLE', 'color'=>'#ffffff', 'accent_color'=>'', 'font_size'=>120, 'tablet_font_size'=>null, 'mobile_font_size'=>null,
            'tag'=>'h2', 'font_family'=>'', 'font_weight'=>800,
            'x'=>50, 'y'=>50, 'width'=>100, 'scale'=>100, 'move_x'=>0, 'move_y'=>-60, 'zoom'=>0, 'end_opacity'=>0,
            'opacity'=>100, 'fit'=>'cover', 'focus_x'=>50, 'focus_y'=>50, 'hidden'=>false, 'container'=>'full', 'container_width'=>1200,
            // Gradient (WPBN_Gradient): over an image, a title's letters filled with it; only with its switch on.
            'use_gradient'=>false, 'gradient'=>WPBN_Gradient::DEFAULT_VALUE,
            'use_scale'=>false, 'use_opacity'=>false, 'use_move_x'=>false, 'use_move_y'=>false, 'use_zoom'=>false, 'use_end_opacity'=>false);
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
        // within its container (0–100%: frontend.css places it so).
        if ($l['type'] === 'text') {
            foreach (array('scale', 'opacity') as $key) { $l[$key] = 100; $l[$key.'_tablet'] = null; $l[$key.'_mobile'] = null; }
            foreach (array('x', 'y') as $key) { foreach (array('', '_tablet', '_mobile') as $suffix) { if ($l[$key.$suffix] !== null) { $l[$key.$suffix] = max(0, min(100, $l[$key.$suffix])); } } }
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
    // A title's font size on each device (px), the inherited ones filled in.
    public static function fonts($l) {
        $tablet = $l['tablet_font_size'] ?? null;
        $tablet = $tablet === null ? $l['font_size'] : $tablet;
        $mobile = $l['mobile_font_size'] ?? null;
        return array('desktop'=>$l['font_size'], 'tablet'=>$tablet, 'mobile'=>$mobile === null ? $tablet : $mobile);
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
        // Scenes saved with the former "Insert into blocks by class" switch off: no class.
        if (array_key_exists('by_class', $input) && empty($input['by_class'])) { $out['target'] = ''; }
        foreach (array_slice(is_array($input['layers'] ?? null) ? $input['layers'] : array(), 0, 40) as $raw) {
            if (!is_array($raw)) { continue; }
            $l = self::layer();
            if (is_string($raw['name'] ?? null)) { $l['name'] = sanitize_text_field($raw['name']); }
            // Text keeps its line breaks and its <u> (the accent words, as in Woodmart's titles).
            if (is_string($raw['text'] ?? null)) { $l['text'] = self::title_text($raw['text']); }
            $l['type'] = self::choice($raw['type'] ?? null, self::TYPES, 'image');
            foreach (array('image', 'image_tablet', 'image_mobile') as $key) { $l[$key] = is_scalar($raw[$key] ?? null) ? absint($raw[$key]) : 0; }
            $l['color'] = self::color($raw['color'] ?? null, '#ffffff');
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
    public static function get($id) { return self::sanitize(get_post_meta($id, self::META, true)); }
}
