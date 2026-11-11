<?php
/**
 * A title's Font, from Woodmart's fonts as its own WPBakery elements list them
 * (woodmart_get_fonts_param()): the theme's fonts (kept as its CSS variables, so a
 * title follows Theme Settings), custom and Adobe fonts, system fonts and Google
 * fonts (the theme's own list, Google_Fonts::$all_google_fonts). A Google font is
 * loaded where the banner is (link()), as Woodmart loads its elements' fonts.
 * Without Woodmart: no list (the editor keeps a text field).
 */
defined('ABSPATH') || exit;
class WPBN_Fonts {
    const GOOGLE = 'XTS\Admin\Modules\Options\Google_Fonts\Google_Fonts';
    // The theme's fonts: its option => [the CSS variable it sets, the name it has in Theme Settings].
    const THEME = array('primary-font'=>array('--wd-title-font', 'Title font'), 'text-font'=>array('--wd-text-font', 'Text font'), 'secondary-font'=>array('--wd-alternative-font', 'Secondary font'));
    const ALL_WEIGHTS = '123456789';

    public static function available() {
        return function_exists('woodmart_get_opt') && (bool) self::google();
    }
    /*
     * Woodmart's fonts are its internal API (woodmart_get_opt(), Google_Fonts), not a public one: a theme
     * update that changes it must not stop the page or the editor. What reads it runs here; anything thrown
     * gives $fallback (the editor then keeps a text field, the page the theme's own fonts).
     */
    private static function guarded($read, $fallback) {
        try { return $read(); } catch (Throwable $e) { return $fallback; }
    }
    // Woodmart's Google fonts: family => {variants, subsets}.
    private static function google() {
        $class = self::GOOGLE;
        return class_exists($class) && isset($class::$all_google_fonts) && is_array($class::$all_google_fonts) ? $class::$all_google_fonts : array();
    }
    // A theme font's option as Woodmart keeps it: its family ('' none), maybe a variable of another.
    private static function option_family($option) {
        $value = self::guarded(function () use ($option) { return woodmart_get_opt($option); }, '');
        return is_array($value) && isset($value[0]['font-family']) && is_scalar($value[0]['font-family']) ? trim((string) $value[0]['font-family']) : '';
    }
    // A family as the browser gets it: a theme variable followed to the font it stands for ('' unknown).
    public static function resolve($family, $depth = 0) {
        if (!self::available() || $depth > 3) { return ''; }
        foreach (self::THEME as $option=>$theme) {
            if ($family === 'var('.$theme[0].')') { return self::resolve(self::option_family($option), $depth + 1); }
        }
        return $family;
    }
    // A Google font's weights as digits (4 = 400), upright ones only; all for any other font.
    public static function weights($family) {
        $google = self::google();
        $family = self::resolve($family);
        if (!isset($google[$family]['variants']) || !is_array($google[$family]['variants'])) { return self::ALL_WEIGHTS; }
        $out = '';
        foreach ($google[$family]['variants'] as $variant) {
            $id = is_array($variant) && isset($variant['id']) ? (string) $variant['id'] : '';
            if (preg_match('/^([1-9])00$/', $id, $m) && strpos($out, $m[1]) === false) { $out .= $m[1]; }
        }
        $out = str_split($out);
        sort($out);
        return $out ? implode('', $out) : self::ALL_WEIGHTS;
    }
    /**
     * The editor's list (admin.js fontField()): groups of [value, name, weights];
     * Google fonts as name => weights (the value is the name). Null without Woodmart.
     */
    public static function groups() {
        return self::available() ? self::guarded(array(__CLASS__, 'read_groups'), null) : null;
    }
    private static function read_groups() {
        $groups = array();
        $theme = array();
        foreach (self::THEME as $option=>$t) {
            $family = self::resolve('var('.$t[0].')');
            if ($family === '') { continue; }
            $theme[] = array('var('.$t[0].')', $t[1].' · '.self::label($family), self::weights($family));
        }
        $groups[] = array('Theme fonts', $theme);
        $custom = array();
        $fonts = woodmart_get_opt('multi_custom_fonts');
        foreach (is_array($fonts) ? $fonts : array() as $key=>$font) {
            if ($key === '{{index}}' || !is_array($font) || empty($font['font-name']) || !is_scalar($font['font-name'])) { continue; }
            $custom[] = array((string) $font['font-name'], (string) $font['font-name'], self::ALL_WEIGHTS);
        }
        $groups[] = array('Custom fonts', $custom);
        $adobe = array();
        $typekit = woodmart_get_opt('typekit_fonts');
        foreach (is_string($typekit) && $typekit !== '' ? explode(',', $typekit) : array() as $font) {
            if (trim($font) !== '') { $adobe[] = array(trim($font), ucfirst(trim($font)), self::ALL_WEIGHTS); }
        }
        $groups[] = array('Adobe fonts', $adobe);
        $system = array();
        $standard = function_exists('woodmart_get_config') ? woodmart_get_config('standard-fonts') : array();
        foreach (is_array($standard) ? $standard : array() as $stack=>$name) { $system[] = array((string) $stack, (string) $name, self::ALL_WEIGHTS); }
        $groups[] = array('System fonts', $system);
        $google = array();
        foreach (array_keys(self::google()) as $family) { $google[(string) $family] = self::weights((string) $family); }
        return array('groups'=>array_values(array_filter($groups, function ($group) { return $group[1]; })), 'google'=>$google);
    }
    // A family's name for people: the first font of a stack, without quotes.
    private static function label($family) {
        return trim(explode(',', $family)[0], " '\"");
    }
    // The family as CSS takes it: a Google font's name quoted ("Exo 2"); a stack or a variable as it is.
    public static function css($family) {
        return preg_match('/[,\'"(]/', $family) ? $family : '"'.$family.'"';
    }
    // The theme's font variables as the site has them, for the editor's preview (it has none of the theme's
    // styles); titles without a font of their own take the title font there too, as headings do on the site, Text the text font.
    public static function theme_css() {
        $vars = '';
        foreach (self::faces() as $value=>$face) { $vars .= substr($value, 4, -1).':'.$face['css'].';'; }
        return $vars === '' ? '' : ':root{'.$vars.'}.wpbn-scene .wpbn-layer--text>*{font-family:var(--wd-title-font)}.wpbn-scene .wpbn-layer--richtext{font-family:var(--wd-text-font)}';
    }
    // The theme's fonts as the browser gets them, by their variable: [css: the family, google: the Google font
    // to load ('' none)]. For the preview page and the editor's font sample (which have none of the theme's styles).
    public static function faces() {
        return self::available() ? self::guarded(array(__CLASS__, 'read_faces'), array()) : array();
    }
    private static function read_faces() {
        $standard = function_exists('woodmart_get_config') ? woodmart_get_config('standard-fonts') : array();
        $google = self::google();
        $faces = array();
        foreach (self::THEME as $theme) {
            $family = self::resolve('var('.$theme[0].')');
            if ($family === '') { continue; }
            // A system font is kept by its name ("System font stack"): its stack.
            $stack = is_array($standard) ? array_search($family, $standard, true) : false;
            $faces['var('.$theme[0].')'] = array('css'=>$stack !== false ? (string) $stack : self::css($family), 'google'=>isset($google[$family]) ? $family : '');
        }
        return $faces;
    }
    // The <link> that loads a Google font at its weight (once a page: Woodmart leaves out what it has loaded already); '' otherwise.
    public static function link($family, $weight, $id, $style = '') {
        $family = self::resolve($family);
        $google = self::google();
        if ($family === '' || !isset($google[$family])) { return ''; }
        if (!is_callable(array(self::GOOGLE, 'get_instance'))) { return ''; }
        $level = ob_get_level();
        ob_start();
        $printed = self::guarded(function () use ($family, $weight, $id, $style) {
            $instance = call_user_func(array(self::GOOGLE, 'get_instance'));
            if (!is_object($instance) || !method_exists($instance, 'enqueue_inline_fonts')) { return false; }
            $instance->enqueue_inline_fonts(array(array('font-family'=>$family, 'font-weight'=>(string) $weight, 'font-style'=>$style)), absint($id));
            return true;
        }, false);
        // Whatever it left open when it threw is closed again: the page's own output is not swallowed.
        while (ob_get_level() > $level + 1) { ob_end_clean(); }
        $html = (string) ob_get_clean();
        return $printed ? $html : '';
    }
}
