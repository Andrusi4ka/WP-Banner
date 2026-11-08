<?php
defined('ABSPATH') || exit;
class WPBN_Render {
    // Scenes drawn on this page so far: the first one's images load first (it is usually the top banner).
    private static $count = 0;
    const SHORTCODE = 'wp_banner';
    // A layer in a container: its X and Width as shares of the container (--wpbn-cw), centred in the scene.
    const IN_CONTAINER = array('x'=>'calc((100%% - var(--wpbn-cw)) / 2 + var(--wpbn-cw) * %s)', 'width'=>'calc(var(--wpbn-cw) * %s)');
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
        return self::markup($s, array('host'=>WPBN_Settings::placed_by_class($s) ? $s['target'] : '', 'id'=>$id));
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
        list($h_number, $unit) = WPBN_Settings::heights($s)[$device];
        $grow = (WPBN_Settings::resolved($l, 'scale')[$device] / 100) * (1 + max(0, WPBN_Settings::resolved($l, 'zoom')[$device]) / 100) * 1.15;
        $width_vw = WPBN_Settings::resolved($l, 'width')[$device] * $grow;
        $meta = wp_get_attachment_metadata($id);
        $ratio = !empty($meta['width']) && !empty($meta['height']) ? $meta['width'] / $meta['height'] : 0;
        if (!$ratio) { return round($width_vw).'vw'; }
        $height = $unit === 'px' ? array($h_number * $grow * $ratio, 'px', $h_number * $grow * $ratio)
            : array(($unit === 'vh' ? $h_number : 100) * $grow * $ratio, 'vh', ($unit === 'vh' ? $h_number : 100) / 100 * $screen_h * $grow * $ratio);
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
    // A title's text as HTML: escaped, its line breaks as <br>, its <u> pairs (WPBN_Settings::title_text()
    // leaves only paired, bare ones) as tags again.
    public static function title_html($text) {
        $text = WPBN_Settings::title_text($text);
        return nl2br(str_replace(array('&lt;u&gt;', '&lt;/u&gt;'), array('<u>', '</u>'), esc_html($text)), false);
    }
    // An image's Gradient stays on what is not see-through in a cutout: the photo itself as its mask, on each
    // device (frontend.css), for the kinds of image that can be see-through; none (all of the box) for others.
    const SEE_THROUGH = array('image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml');
    private static function mask($l) {
        $css = '';
        foreach (WPBN_Settings::images($l) as $device=>$id) {
            $url = $id && in_array(get_post_mime_type($id), self::SEE_THROUGH, true) ? wp_get_attachment_image_url($id, 'full') : '';
            $css .= '--wpbn-mask'.($device === 'desktop' ? '' : ($device === 'tablet' ? '-t' : '-m')).':'.($url ? 'url("'.esc_url($url).'")' : 'none').';';
        }
        return $css;
    }
    // $context  fill: the scene fills the element it is put into (no height of its own; the editor's preview);
    //           host: the class of the block it becomes the background of, if it stands inside one (HOST_SCRIPT);
    //           eager: load its images at once (default: only the page's first scene does);
    //           id: the scene's (the id of the <link> that loads its Google font).
    public static function markup($s, $context = array()) {
        $fill = !empty($context['fill']);
        $first = isset($context['eager']) ? (bool) $context['eager'] : self::$count === 0;
        self::$count++;
        $h = WPBN_Settings::css_heights($s);
        $style = '--wpbn-height:'.$h['desktop'].';--wpbn-tablet-height:'.$h['tablet'].';--wpbn-mobile-height:'.$h['mobile'].';';
        $auto = array();
        foreach (WPBN_Settings::heights($s) as $device=>$h) { if (!$fill && $h[1] === 'auto') { $auto[] = $device; } }
        $html = '<section class="wpbn-scene'.($fill ? ' wpbn-scene--fill' : '').'" style="'.esc_attr($style).'"'.($auto ? ' data-auto="'.esc_attr(implode(' ', $auto)).'"' : '').(!empty($context['host']) ? ' data-host="'.esc_attr($context['host']).'"' : '').'>';
        $loaded = false;
        $links = '';
        foreach ($s['layers'] as $i=>$l) {
            if ($l['hidden']) { continue; }
            $l = WPBN_Settings::effective($l);
            // Each per-device setting as CSS variables (frontend.css picks them by breakpoint).
            $css = 'z-index:'.($i+1).';--wpbn-focus:'.$l['focus_x'].'% '.$l['focus_y'].'%;';
            // Its container (WPBN_Container): its width, from the theme where it can; '' the whole scene.
            $container = WPBN_Container::css($l);
            if ($container !== '') { $css .= '--wpbn-cw:'.$container.';'; }
            $vars = array('x'=>array('left','%',1), 'y'=>array('top','%',1), 'width'=>array('width','%',1), 'opacity'=>array('opacity','',100), 'scale'=>array('scale','',100), 'fit'=>array('fit','',0));
            foreach ($vars as $key=>$var) {
                foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) {
                    $css .= '--wpbn-'.$var[0].($device === 'desktop' ? '' : ($device === 'tablet' ? '-t' : '-m')).':'.($container !== '' && isset(self::IN_CONTAINER[$key]) ? sprintf(self::IN_CONTAINER[$key], $value / 100) : ($var[2] ? ($value / $var[2]).$var[1] : $value)).';';
                }
            }
            // A title: its Position is also the point of it placed there (frontend.css ax, ay): within its container.
            if ($l['type'] === 'text') {
                foreach (array('x'=>'anx', 'y'=>'any') as $key=>$var) {
                    foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) { $css .= '--wpbn-'.$var.($device === 'desktop' ? '' : ($device === 'tablet' ? '-t' : '-m')).':'.max(0, min(1, $value / 100)).';'; }
                }
            }
            // The motion per device [desktop, tablet, mobile], and the box frontend.js needs to keep the edges hidden.
            $motion = array();
            foreach (WPBN_Settings::MOTION as $key) { $motion[$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            $motion['fade'] = WPBN_Settings::fade($l);
            foreach (array('x', 'y', 'width', 'scale') as $key) { $motion['box_'.$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            // Per device: an image layer with Cover fills the scene (its edges are kept out of view); Contain, text or
            // a layer in a container does not.
            $motion['fill'] = $l['type'] === 'text' || $container !== '' ? array(false, false, false) : array_values(array_map(function ($fit) { return $fit !== 'contain'; }, WPBN_Settings::resolved($l, 'fit')));
            $classes = 'wpbn-layer wpbn-layer--'.$l['type'];
            // Gradient: over an image (frontend.css), a title's letters filled with it (below).
            $gradient = !empty($l['use_gradient']) ? WPBN_Gradient::css($l['gradient']) : '';
            if ($gradient !== '' && $l['type'] === 'image') { $classes .= ' wpbn-layer--gradient'; $css .= '--wpbn-gradient:'.$gradient.';'.self::mask($l); }
            $inner = '';
            if ($l['type'] === 'text') {
                $font = WPBN_Settings::fonts($l);
                $css .= '--wpbn-font:'.$font['desktop'].'px;--wpbn-tablet-font:'.$font['tablet'].'px;--wpbn-mobile-font:'.$font['mobile'].'px;color:'.$l['color'].';font-weight:'.$l['font_weight'].';'
                    // The words in <u>: their own color; none: the theme's primary color (frontend.css).
                    .($l['accent_color'] !== '' ? '--wpbn-accent:'.$l['accent_color'].';' : '');
                $text = self::title_html($l['text']);
                $tag = $l['tag'];
                $tag_css = ($l['font_family'] !== '' ? 'font-family:'.WPBN_Fonts::css($l['font_family']).';' : '')
                    .($gradient !== '' ? 'background-image:'.$gradient.';-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;' : '');
                $inner = '<'.$tag.($tag_css !== '' ? ' style="'.esc_attr($tag_css).'"' : '').'>'.$text.'</'.$tag.'>';
                // A Google font (Woodmart's list) loaded here, at its weight; empty: the theme's heading font (its weight may not be loaded yet).
                $links .= WPBN_Fonts::link($l['font_family'] !== '' ? $l['font_family'] : 'var(--wd-title-font)', $l['font_weight'], $context['id'] ?? 0);
            } else {
                // The first scene's images load at once, its back one first; later scenes' when they come near.
                $attrs = $first ? ' decoding="async" loading="eager"'.(!$loaded ? ' fetchpriority="high"' : '') : ' decoding="async" loading="lazy"';
                $inner = self::image($s, $l, $attrs);
                if ($inner) { $loaded = true; }
            }
            $html .= '<div class="'.esc_attr($classes).'" style="'.esc_attr($css).'" data-motion="'.esc_attr(wp_json_encode($motion)).'">'.$inner.'</div>';
        }
        $html = $links.$html.'</section>';
        return empty($context['host']) ? $html : $html.'<script>'.self::HOST_SCRIPT.'</script>';
    }
}
