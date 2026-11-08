<?php
/**
 * The colors every color field's picker offers (admin.js colorField(), as WP Swiper's):
 * the theme's colors, then black, white and greys. Any other color can still be picked there.
 */
defined('ABSPATH') || exit;
class WPBN_Palette {
    // A CSS color as "#rrggbb" (lowercase): from "#rgb", "#rrggbb" or "rgb()" / "rgba()" (its alpha dropped); '' for anything else.
    public static function hex($value) {
        $value = strtolower(trim((string) $value));
        if (preg_match('/^#([0-9a-f]{3})$/', $value, $m)) { $value = '#'.$m[1][0].$m[1][0].$m[1][1].$m[1][1].$m[1][2].$m[1][2]; }
        if (preg_match('/^#[0-9a-f]{6}$/', $value)) { return $value; }
        if (preg_match('/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/', $value, $m)) {
            return sprintf('#%02x%02x%02x', min(255, (int) $m[1]), min(255, (int) $m[2]), min(255, (int) $m[3]));
        }
        return '';
    }
    // The theme's colors: Woodmart's own (Theme Settings), and any theme's palette (theme.json or its editor color palette).
    public static function theme_colors() {
        $colors = array();
        if (get_template() === 'woodmart') {
            $options = get_option('xts-woodmart-options');
            foreach (array('primary-color'=>'Primary color', 'secondary-color'=>'Secondary color', 'link-color'=>'Link color') as $key=>$name) {
                $value = is_array($options) && isset($options[$key]) ? $options[$key] : '';
                if (is_array($value)) { $value = $value['idle'] ?? ''; }
                $colors[] = array('color'=>self::hex(is_scalar($value) ? $value : ''), 'name'=>$name);
            }
        }
        if (function_exists('wp_get_global_settings')) {
            $palette = wp_get_global_settings(array('color', 'palette', 'theme'));
            foreach (is_array($palette) ? $palette : array() as $entry) {
                if (is_array($entry) && isset($entry['color']) && is_scalar($entry['color'])) {
                    $colors[] = array('color'=>self::hex($entry['color']), 'name'=>isset($entry['name']) && is_scalar($entry['name']) ? sanitize_text_field((string) $entry['name']) : '');
                }
            }
        }
        return array_values(array_filter($colors, function ($entry) { return $entry['color'] !== ''; }));
    }
    // The theme's primary color ("#rrggbb"; '' without one): the title's accent words take it until they get
    // a color of their own (frontend.css: --wd-primary-color on the site, set by the preview page here).
    public static function primary() {
        foreach (self::theme_colors() as $entry) { if ($entry['name'] === 'Primary color') { return $entry['color']; } }
        return '';
    }
    // Black, white and greys, always there.
    public static function basic_colors() {
        return array(array('color'=>'#000000', 'name'=>'Black'), array('color'=>'#444444', 'name'=>'Dark gray'), array('color'=>'#888888', 'name'=>'Gray'),
            array('color'=>'#cccccc', 'name'=>'Light gray'), array('color'=>'#ffffff', 'name'=>'White'));
    }
    // The palette: the theme's colors, then the basic ones; each color once (its first name), a nameless one named by itself.
    public static function colors() {
        $all = array();
        $seen = array();
        foreach (array_merge(self::theme_colors(), self::basic_colors()) as $entry) {
            if (isset($seen[$entry['color']])) { continue; }
            $seen[$entry['color']] = true;
            $all[] = array('color'=>$entry['color'], 'name'=>$entry['name'] !== '' ? $entry['name'] : $entry['color']);
        }
        return $all;
    }
}
