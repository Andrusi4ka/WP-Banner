<?php
/**
 * A layer's container (its Container, WPBN_Settings::CONTAINERS): the width its Position X and
 * Width are shares of, centred in the scene, so it lines up with the page's content.
 * "Theme container" asks the theme, in this order, and falls back to the layer's own width:
 *  - Woodmart: its container (Theme Settings > Site width; --wd-container-w), less its 15px
 *    padding on each side, as its rows' columns have it;
 *  - a block theme: its content size (theme.json; --wp--style--global--content-size), within the
 *    page's padding;
 *  - neither: the width set in the layer (container_width), as "Custom".
 * The CSS uses the theme's own variables (a change in its settings is followed) with the width
 * known here behind them (the editor's preview has none of the theme's styles).
 */
defined('ABSPATH') || exit;
class WPBN_Container {
    // Woodmart's site widths (as its class-themesettingscss.php has them).
    const WOODMART = array('full-width'=>1222, 'boxed'=>1160, 'boxed-2'=>1160, 'wide'=>1600);
    /**
     * The theme's container: [name, width (px), css]: css as min(100% - side, width) - inner
     * gives the content's width ('%s' the width's CSS); null without one.
     */
    public static function theme() {
        if (function_exists('woodmart_get_opt')) {
            $site = woodmart_get_opt('site_width');
            $width = $site === 'custom' ? (int) woodmart_get_opt('site_custom_width') : (self::WOODMART[is_string($site) ? $site : ''] ?? 1222);
            if ($width > 0) { return array('name'=>'Woodmart', 'width'=>$width, 'side'=>0, 'inner'=>30, 'var'=>'var(--wd-container-w, '.$width.'px)'); }
        }
        if (function_exists('wp_get_global_settings')) {
            $size = wp_get_global_settings(array('layout', 'contentSize'));
            if (is_string($size) && preg_match('/^(\d+(?:\.\d+)?)px$/', trim($size), $m)) {
                return array('name'=>'Theme', 'width'=>(int) round($m[1]), 'side'=>0, 'inner'=>0, 'var'=>'var(--wp--style--global--content-size, '.$m[1].'px)',
                    'pad'=>'var(--wp--style--root--padding-left, 0px) - var(--wp--style--root--padding-right, 0px)');
            }
        }
        return null;
    }
    /**
     * The container a layer stands in (its container and container_width), as admin.js container()
     * works it out: its content width at a scene width W is min(W - side, width) - inner. Null: the whole scene.
     */
    public static function of($l, $device = 'desktop') {
        if ($l['container'] === 'full') { return null; }
        $theme = $l['container'] === 'theme' ? self::theme() : null;
        if ($theme) { return array('width'=>$theme['width'], 'side'=>$theme['side'], 'inner'=>$theme['inner']); }
        // Custom, or no theme container: the width set, 15px kept clear on each side of a narrower screen.
        return array('width'=>WPBN_Settings::resolved($l, 'container_width')[$device], 'side'=>30, 'inner'=>0);
    }
    // The content width as CSS (--wpbn-cw) on a device (Custom's width may be its own there); '' for the whole scene.
    public static function css($l, $device = 'desktop') {
        if ($l['container'] === 'full') { return ''; }
        $theme = $l['container'] === 'theme' ? self::theme() : null;
        if (!$theme) { return 'min(100% - 30px, '.WPBN_Settings::resolved($l, 'container_width')[$device].'px)'; }
        $side = isset($theme['pad']) ? ' - '.$theme['pad'] : '';
        return $theme['inner'] ? 'calc(min(100%'.$side.', '.$theme['var'].') - '.$theme['inner'].'px)' : 'min(100%'.$side.', '.$theme['var'].')';
    }
}
