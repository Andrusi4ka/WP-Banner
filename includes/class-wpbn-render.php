<?php
defined('ABSPATH') || exit;
class WPBN_Render {
    // Scenes drawn on this page so far: the first one's images load first (it is usually the top banner).
    private static $count = 0;
    // Drawing a Shortcode layer: a banner its shortcode shows draws no Shortcode layers of its own (no endless nesting).
    private static $in_shortcode = false;
    const SHORTCODE = 'wp_banner';
    // A layer in a container: its X and Width as shares of the container (--wpbn-cw; -t, -m where Custom's width is
    // its own on tablet / mobile), centred in the scene.
    const IN_CONTAINER = array('x'=>'calc((100%% - %1$s) / 2 + %1$s * %2$s)', 'width'=>'calc(%1$s * %2$s)');
    // The suffix of a CSS variable's tablet and mobile values (frontend.css): --wpbn-x, --wpbn-x-t, --wpbn-x-m.
    const SUFFIX = array('desktop'=>'', 'tablet'=>'-t', 'mobile'=>'-m');
    const CW = array('desktop'=>'var(--wpbn-cw)', 'tablet'=>'var(--wpbn-cw-t, var(--wpbn-cw))', 'mobile'=>'var(--wpbn-cw-m, var(--wpbn-cw-t, var(--wpbn-cw)))');
    public static function init() {
        add_shortcode(self::SHORTCODE, array(__CLASS__, 'shortcode'));
        // The shortcodes of the plugin's old names (WP Layer Motion, WP Banner Motion), for pages that still have them.
        add_shortcode('wp_layer_motion', array(__CLASS__, 'shortcode'));
        add_shortcode('wp_banner_motion', array(__CLASS__, 'shortcode'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'early_assets'));
    }
    // A page whose content has a banner: its styles in <head>, so it never shows unstyled first. Banners from
    // elsewhere (widgets, templates) still get them from shortcode(), late (printed in the footer).
    public static function early_assets() {
        // WPBakery's frontend editor: a banner added there comes by AJAX, too late to load them itself.
        if (function_exists('vc_is_page_editable') && vc_is_page_editable()) { self::assets(); return; }
        $post = get_post();
        if (!is_singular() || !$post) { return; }
        // The WP Banner block (WPBN_Block).
        if (function_exists('has_block') && has_block('wp-banner/scene', $post)) { self::assets(); return; }
        foreach (array(self::SHORTCODE, 'wp_layer_motion', 'wp_banner_motion') as $tag) {
            if (has_shortcode($post->post_content, $tag)) { self::assets(); return; }
        }
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
        // An image object: its Width (% of its container, px or vw), grown by its Scale and Zoom.
        if (WPBN_Settings::object($l)) {
            $grow = (WPBN_Settings::resolved($l, 'scale')[$device] / 100) * (1 + max(0, WPBN_Settings::resolved($l, 'zoom')[$device]) / 100) * WPBN_Animation::grow($l, $device) * 1.15;
            list($value, $unit) = WPBN_Settings::heights($l, WPBN_Settings::OVERLAY_WIDTHS)[$device];
            if ($unit === 'px') { return round($value * $grow).'px'; }
            $c = $unit === '%' ? WPBN_Container::of($l, $device) : null;
            if (!$c) { return round($value * $grow).'vw'; }
            return round(max(1, min($screen_w - $c['side'], $c['width']) - $c['inner']) * $value / 100 * $grow).'px';
        }
        list($h_number, $unit) = WPBN_Settings::heights($s)[$device];
        $grow = (WPBN_Settings::resolved($l, 'scale')[$device] / 100) * (1 + max(0, WPBN_Settings::resolved($l, 'zoom')[$device]) / 100) * WPBN_Animation::grow($l, $device) * 1.15;
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
        // Decorative (a cutout of the photo behind it…): screen readers skip it; otherwise the media library's alt text.
        $alt = empty($l['decorative']) ? trim((string) get_post_meta($ids['desktop'], '_wp_attachment_image_alt', true)) : '';
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
        // Its own id and classes (Scene settings).
        $html = '<section'.($s['css_id'] !== '' ? ' id="'.esc_attr($s['css_id']).'"' : '').' class="wpbn-scene'.($fill ? ' wpbn-scene--fill' : '').($s['css_class'] !== '' ? ' '.esc_attr($s['css_class']) : '').'" style="'.esc_attr($style).'"'.($auto ? ' data-auto="'.esc_attr(implode(' ', $auto)).'"' : '').(!empty($context['host']) ? ' data-host="'.esc_attr($context['host']).'"' : '').'>';
        $loaded = false;
        $links = '';
        foreach ($s['layers'] as $i=>$l) {
            // Hidden, or a button without text (as WP Top Info Bar's): not drawn.
            if ($l['hidden'] || ($l['type'] === 'button' && trim($l['button_text']) === '')) { continue; }
            // A Shortcode layer: none set, or inside another one's banner: not drawn.
            if ($l['type'] === 'shortcode' && ($l['shortcode'] === '' || self::$in_shortcode)) { continue; }
            $l = WPBN_Settings::effective($l);
            // Each per-device setting as CSS variables (frontend.css picks them by breakpoint).
            $css = 'z-index:'.($i+1).';--wpbn-focus:'.$l['focus_x'].'% '.$l['focus_y'].'%;';
            // Its container (WPBN_Container): its width, from the theme where it can; '' the whole scene.
            $container = WPBN_Container::css($l);
            if ($container !== '') {
                $css .= '--wpbn-cw:'.$container.';';
                foreach (array_slice(self::SUFFIX, 1) as $device=>$suffix) { $own = WPBN_Container::css($l, $device); if ($own !== $container) { $css .= '--wpbn-cw'.$suffix.':'.$own.';'; } }
            }
            $vars = array('x'=>array('left','%',1), 'y'=>array('top','%',1), 'width'=>array('width','%',1), 'opacity'=>array('opacity','',100), 'scale'=>array('scale','',100), 'fit'=>array('fit','',0));
            foreach ($vars as $key=>$var) {
                // An overlay's width: its own Width (below).
                if ($key === 'width' && WPBN_Settings::sized($l)) { continue; }
                foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) {
                    $css .= '--wpbn-'.$var[0].self::SUFFIX[$device].':'.($container !== '' && isset(self::IN_CONTAINER[$key]) ? sprintf(self::IN_CONTAINER[$key], self::CW[$device], $value / 100) : ($var[2] ? ($value / $var[2]).$var[1] : $value)).';';
                }
            }
            // A title, text, button, shortcode, overlay or image object: its Position is also the point of it placed there
            // (frontend.css ax, ay): within its container.
            if (WPBN_Settings::anchored($l)) {
                foreach (array('x'=>'anx', 'y'=>'any') as $key=>$var) {
                    foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) { $css .= '--wpbn-'.$var.self::SUFFIX[$device].':'.max(0, min(1, $value / 100)).';'; }
                }
            }
            // The motion per device [desktop, tablet, mobile], and the box frontend.js needs to keep the edges hidden.
            $motion = array();
            foreach (WPBN_Settings::MOTION as $key) { $motion[$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            $motion['fade'] = WPBN_Settings::fade($l);
            foreach (array('x', 'y', 'width', 'scale') as $key) { $motion['box_'.$key] = array_values(WPBN_Settings::resolved($l, $key)); }
            // Per device: an image layer with Cover fills the scene (its edges are kept out of view); Contain, a title or text,
            // an overlay (it does not move) or a layer in a container does not.
            $motion['fill'] = !WPBN_Settings::fills($l) || $container !== '' ? array(false, false, false) : array_values(array_map(function ($fit) { return $fit !== 'contain'; }, WPBN_Settings::resolved($l, 'fit')));
            // Follow the mouse (px; frontend.js, devices with a mouse): an overlay stays put, as with the scroll.
            $motion['mouse'] = !empty($l['use_mouse']) && $l['type'] !== 'overlay' ? (float) $l['mouse'] : 0;
            // How far an Animation's slide takes it, per device [x, y] (WPBN_Animation::slack()): an image filling the scene grows to hide its edges.
            $motion['slack'] = WPBN_Animation::slack($l);
            $classes = 'wpbn-layer wpbn-layer--'.$l['type'];
            // An overlay's or a shortcode's Width per device: % of its container (as the other layers' widths), px or vw.
            if (WPBN_Settings::sized($l)) {
                foreach (WPBN_Settings::heights($l, WPBN_Settings::OVERLAY_WIDTHS) as $device=>$w) {
                    $value = $w[1] !== '%' ? $w[0].$w[1] : ($container !== '' ? sprintf(self::IN_CONTAINER['width'], self::CW[$device], $w[0] / 100) : $w[0].'%');
                    $css .= '--wpbn-width'.self::SUFFIX[$device].':'.$value.';';
                }
            }
            // A title's or a Text layer's own Width per device (frontend.css --wpbn-tw; Auto: max-content, its text's), as an overlay's:
            // % of its container, px or vw. All Auto: nothing (as before it had one).
            if (WPBN_Settings::text_sized($l)) {
                $widths = WPBN_Settings::heights($l, WPBN_Settings::TEXT_WIDTHS);
                if (array_filter($widths, function ($w) { return $w[1] !== 'auto'; })) {
                    foreach ($widths as $device=>$w) {
                        $value = $w[1] === 'auto' ? 'max-content' : ($w[1] !== '%' ? $w[0].$w[1] : ($container !== '' ? sprintf(self::IN_CONTAINER['width'], self::CW[$device], $w[0] / 100) : $w[0].'%'));
                        $css .= '--wpbn-tw'.self::SUFFIX[$device].':'.$value.';';
                    }
                }
            }
            $inner = '';
            // An overlay: the whole scene in its colour, or its Gradient instead (only overlays have one: images and
            // titles had it until 2026-11-08; their values kept are not used).
            if ($l['type'] === 'overlay') {
                $gradient = !empty($l['use_gradient']) ? WPBN_Gradient::css($l['gradient']) : '';
                $css .= 'background:'.($gradient !== '' ? $gradient : $l['color']).';';
                // Its Shadow (the title's keys and block): around its box, or Inside its edges (a vignette).
                if (WPBN_Settings::shadow($l) !== '') { $css .= 'box-shadow:'.(!empty($l['shadow_inset']) ? 'inset ' : '').WPBN_Settings::shadow($l).';'; }
                // Its Blur per device (frontend.css): the layers under it blurred; none anywhere: no backdrop-filter at all.
                $blur = WPBN_Settings::blurs($l);
                if (max($blur) > 0) { $classes .= ' wpbn-layer--blur'; $css .= '--wpbn-blur:'.$blur['desktop'].'px;--wpbn-blur-t:'.$blur['tablet'].'px;--wpbn-blur-m:'.$blur['mobile'].'px;'; }
                // Its Height per device (frontend.css; % of the scene).
                foreach (WPBN_Settings::heights($l) as $device=>$h) { $css .= '--wpbn-oh'.self::SUFFIX[$device].':'.$h[0].$h[1].';'; }
            } elseif ($l['type'] === 'shortcode') {
                // The other plugin's element, as on a page (it loads its own styles and scripts); clickable (frontend.css).
                self::$in_shortcode = true;
                $inner = do_shortcode($l['shortcode']);
                self::$in_shortcode = false;
            } elseif ($l['type'] === 'button') {
                // A button: its colours and its Size's padding, height and font size per device (frontend.css), a link
                // (a new window: noopener noreferrer) or, without one, a span.
                $css .= '--wpbn-bc:'.$l['button_color'].';--wpbn-bt:'.$l['button_text_color'].';';
                foreach (WPBN_Settings::resolved($l, 'button_size') as $device=>$size) {
                    $suffix = self::SUFFIX[$device];
                    list($padding, $height, $font) = WPBN_Settings::BUTTON_SIZES[$size];
                    $css .= '--wpbn-bp'.$suffix.':'.$padding.';--wpbn-bh'.$suffix.':'.$height.';--wpbn-bf'.$suffix.':'.$font.';';
                }
                $url = $l['button_url'];
                $tag = $url !== '' ? 'a' : 'span';
                $attrs = $url !== '' ? ' href="'.esc_url($url, WPBN_Settings::BUTTON_PROTOCOLS).'"'.($l['button_new_tab'] ? ' target="_blank" rel="noopener noreferrer"' : '') : '';
                $inner = '<'.$tag.' class="wpbn-button wpbn-button--'.$l['button_style'].' wpbn-button--'.$l['button_shape'].'"'.$attrs.'>'.esc_html($l['button_text']).'</'.$tag.'>';
            } elseif ($l['type'] === 'richtext') {
                // Text: its paragraphs and lists (sanitized: WPBN_Settings::rich_text()), its font, size per device, colour and shadow.
                $font = WPBN_Settings::fonts($l);
                $css .= '--wpbn-font:'.$font['desktop'].'px;--wpbn-tablet-font:'.$font['tablet'].'px;--wpbn-mobile-font:'.$font['mobile'].'px;color:'.$l['color'].';font-weight:'.$l['font_weight'].';'
                    .($l['font_family'] !== '' ? 'font-family:'.WPBN_Fonts::css($l['font_family']).';' : '')
                    .(WPBN_Settings::shadow($l) !== '' ? 'text-shadow:'.WPBN_Settings::shadow($l).';' : '');
                $inner = $l['content'];
                // A Google font loaded here; empty: the theme's text font (the page's own).
                $links .= WPBN_Fonts::link($l['font_family'] !== '' ? $l['font_family'] : 'var(--wd-text-font)', $l['font_weight'], $context['id'] ?? 0);
            } elseif ($l['type'] === 'text') {
                $font = WPBN_Settings::fonts($l);
                $css .= '--wpbn-font:'.$font['desktop'].'px;--wpbn-tablet-font:'.$font['tablet'].'px;--wpbn-mobile-font:'.$font['mobile'].'px;color:'.$l['color'].';font-weight:'.$l['font_weight'].';'
                    // The words in <u>: their own color; none: the theme's primary color (frontend.css).
                    .($l['accent_color'] !== '' ? '--wpbn-accent:'.$l['accent_color'].';' : '');
                // Letter spacing per device (frontend.css), Case, Style and Shadow.
                $spacing = WPBN_Settings::spacings($l);
                $css .= '--wpbn-ls:'.$spacing['desktop'].'px;--wpbn-tablet-ls:'.$spacing['tablet'].'px;--wpbn-mobile-ls:'.$spacing['mobile'].'px;'
                    .($l['text_transform'] !== 'none' ? 'text-transform:'.$l['text_transform'].';' : '')
                    .($l['font_style'] === 'italic' ? 'font-style:italic;' : '')
                    .(WPBN_Settings::shadow($l) !== '' ? 'text-shadow:'.WPBN_Settings::shadow($l).';' : '');
                $text = self::title_html($l['text']);
                $tag = $l['tag'];
                $tag_css = ($l['font_family'] !== '' ? 'font-family:'.WPBN_Fonts::css($l['font_family']).';' : '');
                $inner = '<'.$tag.($tag_css !== '' ? ' style="'.esc_attr($tag_css).'"' : '').'>'.$text.'</'.$tag.'>';
                // A Google font (Woodmart's list) loaded here, at its weight; empty: the theme's heading font (its weight may not be loaded yet).
                $links .= WPBN_Fonts::link($l['font_family'] !== '' ? $l['font_family'] : 'var(--wd-title-font)', $l['font_weight'], $context['id'] ?? 0, $l['font_style'] === 'italic' ? 'italic' : '');
            } else {
                // An image object: its Height per device (frontend.css; Auto: as tall as the image at its width).
                if (WPBN_Settings::object($l)) {
                    $classes .= ' wpbn-layer--object';
                    foreach (WPBN_Settings::heights($l) as $device=>$h) { $css .= '--wpbn-oh'.self::SUFFIX[$device].':'.($h[1] === 'auto' ? 'auto' : $h[0].$h[1]).';'; }
                }
                // Its Shadow (the title's keys and block): along the image's outline, a transparent PNG's shape (frontend.css drop-shadow).
                if (WPBN_Settings::shadow($l) !== '') { $classes .= ' wpbn-layer--shadow'; $css .= '--wpbn-ds:'.WPBN_Settings::shadow($l).';'; }
                // The first scene's images load at once, its back one first; later scenes' when they come near.
                $attrs = $first ? ' decoding="async" loading="eager"'.(!$loaded ? ' fetchpriority="high"' : '') : ' decoding="async" loading="lazy"';
                $inner = self::image($s, $l, $attrs);
                if ($inner) { $loaded = true; }
            }
            // Animation (WPBN_Animation): the content in a box of its own that it moves, so it adds up with the scroll motion on the layer.
            if ($inner !== '' && WPBN_Animation::active($l)) {
                list($anim_class, $anim_css) = WPBN_Animation::wrapper($l);
                $inner = '<div class="'.esc_attr($anim_class).'" style="'.esc_attr($anim_css).'">'.$inner.'</div>';
            }
            $html .= '<div class="'.esc_attr($classes).'" style="'.esc_attr($css).'" data-motion="'.esc_attr(wp_json_encode($motion)).'">'.$inner.'</div>';
        }
        $html = $links.$html.'</section>';
        return empty($context['host']) ? $html : $html.'<script>'.self::HOST_SCRIPT.'</script>';
    }
}
