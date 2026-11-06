<?php
defined('ABSPATH') || exit;
class WPLM_Render {
    public static function init() {
        add_shortcode('wp_layer_motion', array(__CLASS__, 'shortcode'));
        add_action('vc_before_init', array(__CLASS__, 'wpbakery'));
    }
    public static function wpbakery() {
        if (function_exists('vc_map')) {
            vc_map(array('name'=>'WP Layer Motion','base'=>'wp_layer_motion','category'=>'Content','icon'=>'icon-wpb-images-stack','params'=>array(array('type'=>'textfield','heading'=>__('Scene ID','wp-layer-motion'),'param_name'=>'id'))));
        }
    }
    public static function assets() {
        wp_enqueue_style('wplm-frontend', WPLM_URL.'assets/css/frontend.css', array(), wplm_asset('assets/css/frontend.css'));
        wp_enqueue_script('wplm-frontend', WPLM_URL.'assets/js/frontend.js', array(), wplm_asset('assets/js/frontend.js'), true);
    }
    public static function shortcode($atts) {
        $atts = shortcode_atts(array('id'=>0), $atts, 'wp_layer_motion');
        $id = is_scalar($atts['id']) ? absint($atts['id']) : 0;
        if (get_post_type($id) !== 'wplm_scene' || get_post_status($id) !== 'publish') { return ''; }
        self::assets();
        return self::markup(WPLM_Settings::get($id));
    }
    public static function markup($s) {
        $h = WPLM_Settings::css_heights($s);
        $style = '--wplm-height:'.$h['desktop'].';--wplm-tablet-height:'.$h['tablet'].';--wplm-mobile-height:'.$h['mobile'].';';
        $auto = array();
        foreach (WPLM_Settings::HEIGHTS as $device=>$keys) { if ($s[$keys[1]] === 'auto') { $auto[] = $device; } }
        $html = '<section class="wplm-scene" style="'.esc_attr($style).'"'.($auto ? ' data-auto="'.esc_attr(implode(' ', $auto)).'"' : '').'>';
        foreach ($s['layers'] as $i=>$l) {
            if ($l['hidden']) { continue; }
            // Each per-device setting as CSS variables (frontend.css picks them by
            // breakpoint); the travel per device for frontend.js.
            $css = 'z-index:'.($i+1).';--wplm-focus:'.$l['focus_x'].'% '.$l['focus_y'].'%;--wplm-font:'.$l['font_size'].'px;--wplm-tablet-font:'.$l['tablet_font_size'].'px;--wplm-mobile-font:'.$l['mobile_font_size'].'px;color:'.$l['color'].';';
            $vars = array('x'=>array('left','%',1), 'y'=>array('top','%',1), 'width'=>array('width','%',1), 'opacity'=>array('opacity','',100), 'scale'=>array('scale','',100), 'fit'=>array('fit','',0));
            foreach ($vars as $key=>$var) {
                foreach (WPLM_Settings::resolved($l, $key) as $device=>$value) {
                    $css .= '--wplm-'.$var[0].($device === 'desktop' ? '' : ($device === 'tablet' ? '-t' : '-m')).':'.($var[2] ? ($value / $var[2]).$var[1] : $value).';';
                }
            }
            $move = array();
            foreach (array('move_x','move_y') as $key) { $move[$key] = implode(' ', WPLM_Settings::resolved($l, $key)); }
            $html .= '<div class="wplm-layer wplm-layer--'.esc_attr($l['type']).'" style="'.esc_attr($css).'" data-move-x="'.esc_attr($move['move_x']).'" data-move-y="'.esc_attr($move['move_y']).'">';
            if ($l['type'] === 'text') { $html .= '<span>'.esc_html($l['text']).'</span>'; }
            else {
                $url = wp_get_attachment_image_url($l['image'], 'full');
                if ($url) { $html .= '<img src="'.esc_url($url).'" alt="" decoding="async">'; }
            }
            $html .= '</div>';
        }
        return $html.'</section>';
    }
}
