<?php
defined('ABSPATH') || exit;
class WPLM_Settings {
    const META = '_wplm_scene';
    public static function defaults() {
        return array('height'=>720, 'tablet_height'=>600, 'mobile_height'=>540, 'height_unit'=>'px', 'tablet_height_unit'=>'px', 'mobile_height_unit'=>'px', 'layers'=>array());
    }
    // Height per device, as WP Swiper's: a number and its unit. Auto fills the parent column (frontend.js).
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
    // and mobile may be null: the larger screen's (mobile → tablet → desktop), as in WP Swiper.
    const RESPONSIVE = array('x'=>array(-100,200), 'y'=>array(-100,200), 'width'=>array(1,300), 'scale'=>array(10,300), 'opacity'=>array(0,100), 'move_x'=>array(-1000,1000), 'move_y'=>array(-1000,1000));
    const FITS = array('cover','contain');
    public static function layer() {
        $l = array('name'=>'Layer', 'type'=>'image', 'image'=>0, 'text'=>'YOUR TITLE', 'color'=>'#ffffff', 'font_size'=>120, 'tablet_font_size'=>120, 'mobile_font_size'=>48, 'x'=>50, 'y'=>50, 'width'=>100, 'scale'=>100, 'move_x'=>0, 'move_y'=>-60, 'opacity'=>100, 'fit'=>'cover', 'focus_x'=>50, 'focus_y'=>50, 'hidden'=>false);
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
    private static function number($value, $fallback, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? max($min, min($max, (float)$value)) : $fallback;
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
        foreach (array_slice(is_array($input['layers'] ?? null) ? $input['layers'] : array(), 0, 40) as $raw) {
            if (!is_array($raw)) { continue; }
            $l = self::layer();
            foreach (array('name','text') as $key) { if (is_string($raw[$key] ?? null)) { $l[$key] = sanitize_text_field($raw[$key]); } }
            $l['type'] = ($raw['type'] ?? '') === 'text' ? 'text' : 'image';
            $l['image'] = is_scalar($raw['image'] ?? null) ? absint($raw['image']) : 0;
            $l['color'] = is_string($raw['color'] ?? null) ? (sanitize_hex_color($raw['color']) ?: '#ffffff') : '#ffffff';
            $l['hidden'] = !empty($raw['hidden']);
            foreach (array('font_size'=>array(8,500),'mobile_font_size'=>array(8,250)) as $key=>$range) {
                $l[$key] = self::number($raw[$key] ?? null, $l[$key], $range[0], $range[1]);
            }
            // Scenes saved before tablets had their own size used the desktop size there.
            $l['tablet_font_size'] = self::number($raw['tablet_font_size'] ?? null, $l['font_size'], 8, 500);
            foreach (self::RESPONSIVE as $key=>$range) {
                $l[$key] = self::number($raw[$key] ?? null, $l[$key], $range[0], $range[1]);
                foreach (array('_tablet','_mobile') as $suffix) {
                    $value = $raw[$key.$suffix] ?? null;
                    $l[$key.$suffix] = $value === null || $value === '' ? null : self::number($value, null, $range[0], $range[1]);
                }
            }
            // An image's point kept in view where its box crops it (object-position), as WP Swiper's Image position: one for every device.
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
