<?php
defined('ABSPATH') || exit;
class WPBN_Render {
    // Scenes drawn on this page so far: the first one's images load first (it is usually the top banner).
    private static $count = 0;
    const SHORTCODE = 'wp_banner';
    public static function init() {
        add_shortcode(self::SHORTCODE, array(__CLASS__, 'shortcode'));
        // The shortcodes of the plugin's old names (WP Layer Motion, WP Banner Motion), for pages that still have them.
        add_shortcode('wp_layer_motion', array(__CLASS__, 'shortcode'));
        add_shortcode('wp_banner_motion', array(__CLASS__, 'shortcode'));
    }
    public static function assets() {
        wp_enqueue_style('wpbn-frontend', WPBN_URL.'assets/css/frontend.css', array(), wpbn_asset('assets/css/frontend.css'));
        wp_enqueue_script('wpbn-frontend', WPBN_URL.'assets/js/frontend.js', array(), wpbn_asset('assets/js/frontend.js'), true);
    }
    public static function shortcode($atts) {
        $atts = shortcode_atts(array('id'=>0), $atts, 'wp_banner');
        $id = is_scalar($atts['id']) ? absint($atts['id']) : 0;
        if (get_post_type($id) !== 'wpbn_scene' || get_post_status($id) !== 'publish') { return ''; }
        self::assets();
        $s = WPBN_Settings::get($id);
        return self::markup($s, array('host'=>$s['by_class'] ? $s['target'] : ''));
    }
    // Placed by class: the scene moves into the nearest block around it with that class, as its
    // background, as soon as the browser reads it (so it does not show first where it stands);
    // frontend.js does the same for scenes added later. No such block: it stays where it is.
    const HOST_SCRIPT = '(function(s){var c=s&&s.getAttribute("data-host"),p=s&&s.parentElement,h;if(!c||!p)return;try{h=p.closest("."+(window.CSS&&CSS.escape?CSS.escape(c):c));}catch(e){}if(!h)return;s.classList.add("wpbn-scene--fill");h.classList.add("wpbn-host");if(getComputedStyle(h).position==="static")h.style.position="relative";h.insertBefore(s,h.firstChild);})(document.currentScript&&document.currentScript.previousElementSibling);';
    // A typical screen per device, to guess how many pixels an image needs (sizes).
    const SCREENS = array('desktop'=>array(1440, 900), 'tablet'=>array(1024, 1366), 'mobile'=>array(430, 932));
    // The "sizes" of a layer's image on one device: the width its box shows the
    // photo at. Cover may show it wider than the box (a tall box, a wide photo):
    // then the height decides, in the unit the scene's height is set in.
    private static function size_for($s, $l, $device, $id) {
        list($screen_w, $screen_h) = self::SCREENS[$device];
        $keys = WPBN_Settings::HEIGHTS[$device];
        $grow = (WPBN_Settings::resolved($l, 'scale')[$device] / 100) * (1 + max(0, WPBN_Settings::resolved($l, 'zoom')[$device]) / 100) * 1.15;
        $width_vw = WPBN_Settings::resolved($l, 'width')[$device] * $grow;
        $meta = wp_get_attachment_metadata($id);
        $ratio = !empty($meta['width']) && !empty($meta['height']) ? $meta['width'] / $meta['height'] : 0;
        if (!$ratio) { return round($width_vw).'vw'; }
        $unit = $s[$keys[1]];
        $height = $unit === 'px' ? array($s[$keys[0]] * $grow * $ratio, 'px', $s[$keys[0]] * $grow * $ratio)
            : array(($unit === 'vh' ? $s[$keys[0]] : 100) * $grow * $ratio, 'vh', ($unit === 'vh' ? $s[$keys[0]] : 100) / 100 * $screen_h * $grow * $ratio);
        $by_width = $width_vw / 100 * $screen_w;
        $cover = WPBN_Settings::resolved($l, 'fit')[$device] !== 'contain';
        $use_height = $cover ? $height[2] > $by_width : $height[2] < $by_width;
        return $use_height ? round($height[0]).$height[1] : round($width_vw).'vw';
    }
    private static function srcset($id) {
        $srcset = wp_get_attachment_image_srcset($id, 'full');
        return $srcset ? $srcset : '';
    }
    // An image layer: one <img>, or a <picture> where tablet or mobile has a photo of its own.
    private static function image($s, $l, $attrs) {
        $ids = WPBN_Settings::images($l);
        $url = wp_get_attachment_image_url($ids['desktop'], 'full');
        if (!$url) { return ''; }
        $one = $ids['desktop'] === $ids['tablet'] && $ids['tablet'] === $ids['mobile'];
        $sizes = function ($device, $id) use ($s, $l) { return self::size_for($s, $l, $device, $id); };
        $alt = trim((string) get_post_meta($ids['desktop'], '_wp_attachment_image_alt', true));
        $img = '<img src="'.esc_url($url).'" alt="'.esc_attr($alt).'"'.$attrs;
        $srcset = self::srcset($ids['desktop']);
        if ($srcset) {
            $all = $one ? '(max-width:767px) '.$sizes('mobile', $ids['desktop']).', (max-width:1024px) '.$sizes('tablet', $ids['desktop']).', '.$sizes('desktop', $ids['desktop']) : $sizes('desktop', $ids['desktop']);
            $img .= ' srcset="'.esc_attr($srcset).'" sizes="'.esc_attr($all).'"';
        }
        $img .= '>';
        if ($one) { return $img; }
        $html = '<picture>';
        foreach (array('mobile'=>'(max-width:767px)', 'tablet'=>'(max-width:1024px)') as $device=>$media) {
            $source = self::srcset($ids[$device]) ?: (string) wp_get_attachment_image_url($ids[$device], 'full');
            if ($source) { $html .= '<source media="'.$media.'" srcset="'.esc_attr($source).'" sizes="'.esc_attr($sizes($device, $ids[$device])).'">'; }
        }
        return $html.$img.'</picture>';
    }
    // $context  fill: the scene fills the element it is put into (no height of its own; the editor's preview);
    //           host: the class of the block it becomes the background of, if it stands inside one (HOST_SCRIPT);
    //           eager: load its images at once (default: only the page's first scene does).
    public static function markup($s, $context = array()) {
        $fill = !empty($context['fill']);
        $first = isset($context['eager']) ? (bool) $context['eager'] : self::$count === 0;
        self::$count++;
        $h = WPBN_Settings::css_heights($s);
        $style = '--wpbn-height:'.$h['desktop'].';--wpbn-tablet-height:'.$h['tablet'].';--wpbn-mobile-height:'.$h['mobile'].';';
        $auto = array();
        foreach (WPBN_Settings::HEIGHTS as $device=>$keys) { if (!$fill && $s[$keys[1]] === 'auto') { $auto[] = $device; } }
        $html = '<section class="wpbn-scene'.($fill ? ' wpbn-scene--fill' : '').'" style="'.esc_attr($style).'"'.($auto ? ' data-auto="'.esc_attr(implode(' ', $auto)).'"' : '').(!empty($context['host']) ? ' data-host="'.esc_attr($context['host']).'"' : '').'>';
        $loaded = false;
        foreach ($s['layers'] as $i=>$l) {
            if ($l['hidden']) { continue; }
            $l = WPBN_Settings::effective($l);
            // Each per-device setting as CSS variables (frontend.css picks them by breakpoint).
            $css = 'z-index:'.($i+1).';--wpbn-focus:'.$l['focus_x'].'% '.$l['focus_y'].'%;';
            $vars = array('x'=>array('left','%',1), 'y'=>array('top','%',1), 'width'=>array('width','%',1), 'opacity'=>array('opacity','',100), 'scale'=>array('scale','',100), 'fit'=>array('fit','',0));
            foreach ($vars as $key=>$var) {
                foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) {
                    $css .= '--wpbn-'.$var[0].($device === 'desktop' ? '' : ($device === 'tablet' ? '-t' : '-m')).':'.($var[2] ? ($value / $var[2]).$var[1] : $value).';';
                }
            }
            // The motion per device [desktop, tablet, mobile], and the box frontend.js needs to keep the edges hidden.
            $motion = array();
            foreach (WPBN_Settings::MOTION as $key) { $motion[$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            $motion['fade'] = WPBN_Settings::fade($l);
            foreach (array('x', 'y', 'width', 'scale') as $key) { $motion['box_'.$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            // Per device: an image layer with Cover fills the scene (its edges are kept out of view); Contain or text does not.
            $motion['fill'] = $l['type'] === 'text' ? array(false, false, false) : array_values(array_map(function ($fit) { return $fit !== 'contain'; }, WPBN_Settings::resolved($l, 'fit')));
            $classes = 'wpbn-layer wpbn-layer--'.$l['type'];
            $inner = '';
            if ($l['type'] === 'text') {
                $css .= '--wpbn-font:'.$l['font_size'].'px;--wpbn-tablet-font:'.$l['tablet_font_size'].'px;--wpbn-mobile-font:'.$l['mobile_font_size'].'px;color:'.$l['color'].';font-weight:'.$l['font_weight'].';';
                $text = nl2br(esc_html($l['text']), false);
                $tag = $l['tag'];
                $inner = '<'.$tag.($l['font_family'] !== '' ? ' style="'.esc_attr('font-family:'.$l['font_family']).'"' : '').'>'.$text.'</'.$tag.'>';
            } else {
                // The first scene's images load at once, its back one first; later scenes' when they come near.
                $attrs = $first ? ' decoding="async" loading="eager"'.(!$loaded ? ' fetchpriority="high"' : '') : ' decoding="async" loading="lazy"';
                $inner = self::image($s, $l, $attrs);
                if ($inner) { $loaded = true; }
            }
            $html .= '<div class="'.esc_attr($classes).'" style="'.esc_attr($css).'" data-motion="'.esc_attr(wp_json_encode($motion)).'">'.$inner.'</div>';
        }
        $html .= '</section>';
        return empty($context['host']) ? $html : $html.'<script>'.self::HOST_SCRIPT.'</script>';
    }
}
