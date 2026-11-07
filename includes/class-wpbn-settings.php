<?php
defined('ABSPATH') || exit;
class WPBN_Settings {
    const META = '_wpbn_scene';
    // Placement: with by_class the scene also goes into every element on the site with the class
    // "target" (a row, a column, any block), taking that element's size, behind its content.
    public static function defaults() {
        return array('height'=>720, 'tablet_height'=>600, 'mobile_height'=>540, 'height_unit'=>'px', 'tablet_height_unit'=>'px', 'mobile_height_unit'=>'px',
            'by_class'=>false, 'target'=>'', 'layers'=>array());
    }
    // A class as the block's "Extra class name" field takes it: one class, no dot.
    public static function css_class($value) {
        return is_string($value) ? substr(sanitize_html_class(ltrim(trim($value), '.')), 0, 80) : '';
    }
    // Height per device: a number and its unit. Auto fills the parent column (frontend.js).
    const UNITS = array('px', 'vh', '%', 'auto');
    const HEIGHTS = array('desktop'=>array('height','height_unit'), 'tablet'=>array('tablet_height','tablet_height_unit'), 'mobile'=>array('mobile_height','mobile_height_unit'));
    // Before frontend.js sizes an Auto scene, and where it finds no free height.
    const FALLBACK_HEIGHT = 500;
    public static function css_heights($s) {
        $css = array();
        foreach (self::HEIGHTS as $device=>$keys) {
            $css[$device] = $s[$keys[1]] === 'auto' ? self::FALLBACK_HEIGHT.'px' : $s[$keys[0]].$s[$keys[1]];
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
    const TAGS = array('div', 'h1', 'h2', 'h3', 'p');
    public static function layer() {
        $l = array('name'=>'Layer', 'type'=>'image', 'image'=>0, 'image_tablet'=>0, 'image_mobile'=>0, 'text'=>'YOUR TITLE', 'color'=>'#ffffff', 'font_size'=>120, 'tablet_font_size'=>120, 'mobile_font_size'=>48,
            'tag'=>'div', 'font_family'=>'', 'font_weight'=>800,
            'x'=>50, 'y'=>50, 'width'=>100, 'scale'=>100, 'move_x'=>0, 'move_y'=>-60, 'zoom'=>0, 'end_opacity'=>0,
            'opacity'=>100, 'fit'=>'cover', 'focus_x'=>50, 'focus_y'=>50, 'hidden'=>false,
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
    // An image layer's Width is always the scene's (100%); text layers keep theirs (where the text wraps).
    const OPTIONAL = array('scale'=>array('use_scale', 100, true), 'opacity'=>array('use_opacity', 100, true),
        'move_x'=>array('use_move_x', 0, false), 'move_y'=>array('use_move_y', 0, false), 'zoom'=>array('use_zoom', 0, false),
        // Off: the layer keeps its Opacity to the end (no value of its own: see fade()).
        'end_opacity'=>array('use_end_opacity', null, false));
    public static function effective($l) {
        if ($l['type'] === 'image') { $l['width'] = 100; $l['width_tablet'] = null; $l['width_mobile'] = null; }
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
    // The image on each device: tablet and mobile 0 = the larger screen's.
    public static function images($l) {
        $tablet = $l['image_tablet'] ?: $l['image'];
        return array('desktop'=>$l['image'], 'tablet'=>$tablet, 'mobile'=>$l['image_mobile'] ?: $tablet);
    }
    private static function number($value, $fallback, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? max($min, min($max, (float)$value)) : $fallback;
    }
    private static function choice($value, $allowed, $fallback) {
        return in_array($value, $allowed, true) ? $value : $fallback;
    }
    public static function sanitize($input) {
        $input = is_array($input) ? $input : array();
        $out = self::defaults();
        foreach (self::HEIGHTS as $keys) {
            list($key, $unit) = $keys;
            $out[$unit] = in_array($input[$unit] ?? null, self::UNITS, true) ? $input[$unit] : 'px';
            // px: a fixed size; vh and %: a share (100 = all of it). Auto keeps the number for a later switch back.
            $out[$key] = in_array($out[$unit], array('vh','%'), true) ? self::number($input[$key] ?? null, 100, 1, 200) : self::number($input[$key] ?? null, $out[$key], $out[$unit] === 'px' ? 160 : 1, 2400);
        }
        $out['target'] = self::css_class($input['target'] ?? '');
        $out['by_class'] = !empty($input['by_class']) && $out['target'] !== '';
        foreach (array_slice(is_array($input['layers'] ?? null) ? $input['layers'] : array(), 0, 40) as $raw) {
            if (!is_array($raw)) { continue; }
            $l = self::layer();
            if (is_string($raw['name'] ?? null)) { $l['name'] = sanitize_text_field($raw['name']); }
            // Text keeps its line breaks.
            if (is_string($raw['text'] ?? null)) { $l['text'] = sanitize_textarea_field($raw['text']); }
            $l['type'] = self::choice($raw['type'] ?? null, self::TYPES, 'image');
            foreach (array('image', 'image_tablet', 'image_mobile') as $key) { $l[$key] = is_scalar($raw[$key] ?? null) ? absint($raw[$key]) : 0; }
            $l['color'] = is_string($raw['color'] ?? null) ? (sanitize_hex_color($raw['color']) ?: '#ffffff') : '#ffffff';
            $l['hidden'] = !empty($raw['hidden']);
            foreach (array('font_size'=>array(8,500),'mobile_font_size'=>array(8,250)) as $key=>$range) {
                $l[$key] = self::number($raw[$key] ?? null, $l[$key], $range[0], $range[1]);
            }
            // Scenes saved before tablets had their own size used the desktop size there.
            $l['tablet_font_size'] = self::number($raw['tablet_font_size'] ?? null, $l['font_size'], 8, 500);
            $l['tag'] = self::choice($raw['tag'] ?? null, self::TAGS, 'div');
            // A font family as CSS takes it ("Playfair Display", serif); empty = the theme's.
            $l['font_family'] = is_string($raw['font_family'] ?? null) ? substr(trim(preg_replace('/[^\w \-,\'"]/u', '', $raw['font_family'])), 0, 120) : '';
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
