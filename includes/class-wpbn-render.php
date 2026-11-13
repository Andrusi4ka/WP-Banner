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
    // A page whose content has a banner (a post, or one of an archive's posts): its styles in <head>, so it never shows
    // unstyled first. Banners from elsewhere (widgets, templates, a theme's HTML blocks) bring their stylesheet with them (scene()).
    public static function early_assets() {
        // WPBakery's frontend editor: a banner added there comes by AJAX, too late to load them itself.
        if (function_exists('vc_is_page_editable') && vc_is_page_editable()) { self::assets(); return; }
        global $wp_query;
        $posts = is_singular() ? array(get_post()) : (isset($wp_query->posts) && is_array($wp_query->posts) ? $wp_query->posts : array());
        foreach ($posts as $post) {
            if ($post instanceof WP_Post && self::has_banner($post)) { self::assets(); return; }
        }
    }
    // Whether a post's content has a banner: the WP Banner block (WPBN_Block) or the shortcode (or its old names).
    private static function has_banner($post) {
        if (function_exists('has_block') && has_block('wp-banner/scene', $post)) { return true; }
        foreach (array(self::SHORTCODE, 'wp_layer_motion', 'wp_banner_motion') as $tag) {
            if (has_shortcode($post->post_content, $tag)) { return true; }
        }
        return false;
    }
    public static function assets() {
        wp_enqueue_style('wpbn-frontend', WPBN_URL.'assets/css/frontend.css', array(), wpbn_asset('assets/css/frontend.css'));
        wp_enqueue_script('wpbn-frontend', WPBN_URL.'assets/js/frontend.js', array(), wpbn_asset('assets/js/frontend.js'), true);
    }
    public static function shortcode($atts) {
        $atts = shortcode_atts(array('id'=>0), $atts, 'wp_banner');
        $id = is_scalar($atts['id']) ? absint($atts['id']) : 0;
        if (get_post_type($id) !== 'wpbn_scene' || get_post_status($id) !== 'publish') { return ''; }
        return self::scene($id);
    }
    // A scene drawn by its id, whatever its status (shortcode() draws only published ones; the block editor shows drafts too).
    public static function scene($id) {
        self::assets();
        $s = WPBN_Settings::get($id);
        // Drawn after the page's <head> (a widget, a template, a theme's HTML block): its stylesheet just before it, once a
        // page, so it never shows unstyled (a stylesheet in the body holds back what follows it until it has loaded).
        $styles = '';
        if (did_action('wp_head') && !doing_action('wp_head') && !wp_doing_ajax() && !(defined('REST_REQUEST') && REST_REQUEST) && !wp_style_is('wpbn-frontend', 'done')) {
            ob_start();
            wp_print_styles('wpbn-frontend');
            $styles = (string) ob_get_clean();
        }
        return $styles.self::markup($s, array('host'=>WPBN_Settings::placed_by_class($s) ? $s['target'] : '', 'host_on'=>WPBN_Settings::placed_on($s), 'id'=>$id));
    }
    // Placed by class: the scene moves into the nearest block around it with that class, as its
    // background, as soon as the browser reads it (so it does not show first where it stands);
    // frontend.js does the same for scenes added later. No such block: it stays where it is.
    // Only on the devices in data-host-on (2026-11-13; none: every device); a comment left where it stood (wpbnSpot), so
    // frontend.js place() can put it back there on a screen it is not placed on.
    const HOST_SCRIPT = '(function(s){var c=s&&s.getAttribute("data-host"),o=s&&s.getAttribute("data-host-on"),p=s&&s.parentElement,w=innerWidth,h,m;if(!c||!p)return;if(o!==null&&(" "+o+" ").indexOf(" "+(w<=767?"mobile":w<=1024?"tablet":"desktop")+" ")<0)return;try{h=p.closest("."+(window.CSS&&CSS.escape?CSS.escape(c):c));}catch(e){}if(!h)return;s.classList.add("wpbn-scene--fill");h.classList.add("wpbn-host");if(getComputedStyle(h).position==="static")h.style.position="relative";m=document.createComment("wpbn");p.insertBefore(m,s);s.wpbnSpot=m;h.insertBefore(s,h.firstChild);})(document.currentScript&&document.currentScript.previousElementSibling);';
    // A typical screen per device, to guess how many pixels an image needs (sizes).
    const SCREENS = array('desktop'=>array(1440, 900), 'tablet'=>array(1024, 1366), 'mobile'=>array(430, 932));
    // The "sizes" of a layer's image on one device: the width its box shows the
    // photo at. Cover may show it wider than the box (a tall box, a wide photo):
    // then the height decides, in the unit the scene's height is set in.
    private static function size_for($s, $l, $device, $id) {
        list($screen_w, $screen_h) = self::SCREENS[$device];
        // An image object: its Width (% of its container, px or vw), grown by its Scale and Zoom.
        if (WPBN_Settings::object($l, $device)) {
            $grow = (WPBN_Settings::resolved($l, 'scale')[$device] / 100) * (1 + max(0, WPBN_Settings::resolved($l, 'zoom')[$device]) / 100) * WPBN_Animation::grow($l, $device) * 1.15;
            list($w, $hh) = WPBN_Settings::object_sizes($l)[$device];
            list($value, $unit) = $w;
            // Width Auto: as wide as the image at its Height (px, vh, or % of the scene's height).
            if ($unit === 'auto') {
                $meta = wp_get_attachment_metadata($id);
                $ratio = !empty($meta['width']) && !empty($meta['height']) ? $meta['width'] / $meta['height'] : 0;
                list($sh, $su) = WPBN_Settings::heights($s)[$device];
                $scene_px = $su === 'px' ? $sh : ($su === 'vh' ? $sh / 100 * $screen_h : $screen_h);
                $px = $hh[1] === 'px' ? $hh[0] : ($hh[1] === 'vh' ? $hh[0] / 100 * $screen_h : $hh[0] / 100 * $scene_px);
                // Never wider than its container (frontend.css --wpbn-mw).
                $c = WPBN_Container::of($l, $device);
                $room = $c ? max(1, min($screen_w - $c['side'], $c['width']) - $c['inner']) : $screen_w;
                return $ratio ? round(min($px * $ratio, $room) * $grow).'px' : '100vw';
            }
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
        // Its alt text from the media library; a copy seen through a Shape layer's object (WPBN_Shape::inner()) none: the layer itself is read out.
        // (A Decorative switch, alt="" for any image, was removed on 2026-11-09 at the user's request.)
        $alt = empty($l['copy']) ? trim((string) get_post_meta($ids['desktop'], '_wp_attachment_image_alt', true)) : '';
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
        $html = '<section'.($s['css_id'] !== '' ? ' id="'.esc_attr($s['css_id']).'"' : '').' class="wpbn-scene'.($fill ? ' wpbn-scene--fill' : '').($s['css_class'] !== '' ? ' '.esc_attr($s['css_class']) : '').'" style="'.esc_attr($style).'"'.($auto ? ' data-auto="'.esc_attr(implode(' ', $auto)).'"' : '').(!empty($context['host']) ? ' data-host="'.esc_attr($context['host']).'"'.(isset($context['host_on']) ? ' data-host-on="'.esc_attr(implode(' ', array_keys(array_filter($context['host_on'])))).'"' : '') : '').'>';
        // first: the page's first scene (its images load at once); loaded: an image drawn already (only the first gets
        // fetchpriority); links: the Google fonts' <link>s the layers need.
        // anchors: the uids of the layers drawn that others drawn are attached to (data-uid on them; frontend.js attach()).
        $state = array('first'=>$first, 'loaded'=>false, 'links'=>'', 'anchors'=>self::anchors($s['layers']));
        foreach ($s['layers'] as $i=>$l) {
            if (self::drawn($l)) { $html .= self::layer($s, $l, $i, $context, $state); }
        }
        $html = $state['links'].$html.'</section>';
        return empty($context['host']) ? $html : $html.'<script>'.self::HOST_SCRIPT.'</script>';
    }
    // Whether a layer is drawn at all.
    private static function drawn($l) {
        // Hidden, or a button without text and without an Icon (as WP Top Info Bar's): not drawn.
        // Hidden on every device one by one (Show on): not drawn either.
        if ($l['hidden'] || (!empty($l['hide_desktop']) && !empty($l['hide_tablet']) && !empty($l['hide_mobile'])) || ($l['type'] === 'button' && trim($l['button_text']) === '' && self::button_icon($l) === '')) { return false; }
        // A Shortcode layer: none set, or inside another one's banner: not drawn.
        if ($l['type'] === 'shortcode' && ($l['shortcode'] === '' || self::$in_shortcode)) { return false; }
        // A Shape layer without an SVG: nothing to show.
        return !($l['type'] === 'shape' && !$l['shape']);
    }
    // The drawn layers that drawn layers are attached to (WPBN_Settings::attachments()): uid => the devices it is hidden on (Show on).
    // One attached to a layer not drawn (hidden…), or on a device it is hidden on, stands at its own Position there.
    private static function anchors($layers) {
        $drawn = array();
        foreach ($layers as $l) { if ($l['uid'] !== '' && self::drawn($l)) { $drawn[$l['uid']] = array('desktop'=>!empty($l['hide_desktop']), 'tablet'=>!empty($l['hide_tablet']), 'mobile'=>!empty($l['hide_mobile'])); } }
        $used = array();
        foreach ($layers as $l) { if (($l['anchor'] ?? '') !== '' && isset($drawn[$l['anchor']]) && self::drawn($l)) { $used[$l['anchor']] = $drawn[$l['anchor']]; } }
        return $used;
    }
    // What an icon alone says: the image's alt text (or its title), or the icon's name (solid/arrow-right: arrow right).
    private static function icon_label($l) {
        if ($l['button_icon_type'] === 'image') {
            $alt = trim((string) get_post_meta($l['button_icon_image'], '_wp_attachment_image_alt', true));
            return $alt !== '' ? $alt : get_the_title($l['button_icon_image']);
        }
        return str_replace('-', ' ', preg_replace('#^[a-z]+/#', '', $l['button_icon']));
    }
    // A button's Icon: a Font Awesome icon (its own SVG, in the text colour), or an image (its own colours, or tinted: its
    // shape in the text colour, a mask); '' for none.
    private static function button_icon($l) {
        if ($l['button_icon_type'] === 'icon') {
            $svg = WPBN_Icons::svg($l['button_icon_svg']);
            return $svg !== '' ? '<span class="wpbn-button__icon" aria-hidden="true">'.$svg.'</span>' : '';
        }
        if ($l['button_icon_type'] !== 'image' || !$l['button_icon_image']) { return ''; }
        $url = wp_get_attachment_image_url($l['button_icon_image'], 'medium');
        if (!$url) { return ''; }
        if ($l['button_icon_tint']) {
            return '<span class="wpbn-button__icon wpbn-button__icon--tint" aria-hidden="true" style="'.esc_attr('--wpbn-im:url("'.esc_url_raw($url).'")').'"></span>';
        }
        return '<span class="wpbn-button__icon" aria-hidden="true"><img src="'.esc_url($url).'" alt="" decoding="async"></span>';
    }
    /**
     * One layer's <div>: its settings as CSS variables, its motion for frontend.js, its content. $i: its place in the
     * scene (z-index). A Shape layer's objects show a copy of another layer through them (WPBN_Shape::inner()), drawn here too.
     */
    public static function layer($s, $l, $i, $context, &$state) {
        $first = $state['first'];
        $loaded = &$state['loaded'];
        $links = &$state['links'];
        $l = WPBN_Settings::effective($l);
        // Each per-device setting as CSS variables (frontend.css picks them by breakpoint).
        $css = 'z-index:'.($i+1).';--wpbn-focus:'.$l['focus_x'].'% '.$l['focus_y'].'%;';
        // Its container (WPBN_Container): its width, from the theme where it can; '' the whole scene.
        $container = WPBN_Container::css($l);
        if ($container !== '') {
            $css .= '--wpbn-cw:'.$container.';';
            foreach (array_slice(self::SUFFIX, 1) as $device=>$suffix) { $own = WPBN_Container::css($l, $device); if ($own !== $container) { $css .= '--wpbn-cw'.$suffix.':'.$own.';'; } }
        }
        $vars = array('x'=>array('left','%',1), 'y'=>array('top','%',1), 'width'=>array('width','%',1), 'opacity'=>array('opacity','',100), 'scale'=>array('scale','',100), 'rotate'=>array('rot','deg',1), 'fit'=>array('fit','',0));
        foreach ($vars as $key=>$var) {
            // An overlay's width: its own Width (below).
            if ($key === 'width' && WPBN_Settings::sized($l)) { continue; }
            foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) {
                $css .= '--wpbn-'.$var[0].self::SUFFIX[$device].':'.($container !== '' && isset(self::IN_CONTAINER[$key]) ? sprintf(self::IN_CONTAINER[$key], self::CW[$device], $value / 100) : ($var[2] ? ($value / $var[2]).$var[1] : $value)).';';
            }
        }
        // A title, text, button, shortcode, overlay or image object: its Position is also the point of it placed there
        // (frontend.css ax, ay): within its container.
        // An image filling the scene on some devices: there its centre, as before.
        $fills = WPBN_Settings::fills_on($l);
        // Attached to a layer drawn here (2026-11-13): on the devices it has a place for, its own point is the one put at that layer's
        // A copy of it seen through a Shape object's window too (frontend.js places it as it places the layer, so they stay lined up).
        // (frontend.js attach() places it there; until then, and without scripts, it stands at its Position).
        $attached = WPBN_Settings::attachable($l) && ($l['anchor'] ?? '') !== '' && isset($state['anchors'][$l['anchor']]);
        $places = array();
        foreach (WPBN_Settings::ANCHOR_KEYS as $device=>$key) { $places[$device] = $attached && !$fills[$device] && !$state['anchors'][$l['anchor']][$device] ? ($l[$key] ?? null) : null; }
        $attached = $attached && array_filter($places);
        if (WPBN_Settings::anchored($l)) {
            foreach (array('x'=>array('anx', 2), 'y'=>array('any', 3)) as $key=>$var) {
                foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) {
                    $point = $places[$device] ? $places[$device][$var[1]] / 100 : ($fills[$device] ? .5 : max(0, min(1, $value / 100)));
                    $css .= '--wpbn-'.$var[0].self::SUFFIX[$device].':'.$point.';';
                }
            }
        }
        // The motion per device [desktop, tablet, mobile], and the box frontend.js needs to keep the edges hidden.
        $motion = array();
        foreach (WPBN_Settings::MOTION as $key) { $motion[$key] = array_values(WPBN_Settings::resolved($l, $key)); }
        $motion['fade'] = WPBN_Settings::fade($l);
        foreach (array('x', 'y', 'width', 'scale', 'rotate') as $key) { $motion['box_'.$key] = array_values(WPBN_Settings::resolved($l, $key)); }
        // Per device: an image layer with Cover fills the scene (its edges are kept out of view); Contain, a title or text,
        // an overlay (it does not move) or a layer in a container does not.
        // An image that is an object on a device (Fill the scene off there) does not fill it there.
        $motion['fill'] = array();
        foreach (WPBN_Settings::resolved($l, 'fit') as $device=>$fit) { $motion['fill'][] = $fills[$device] && $container === '' && $fit !== 'contain'; }
        // An image that fills the scene on some devices and is an object on others: where it is one (preview-dev.js).
        if (WPBN_Settings::object($l) && in_array(true, $fills, true)) { $motion['object'] = array_values(array_map(function ($f) { return !$f; }, $fills)); }
        // Follow the mouse (px; frontend.js, devices with a mouse): not an overlay.
        $motion['mouse'] = !empty($l['use_mouse']) && $l['type'] !== 'overlay' ? (float) $l['mouse'] : 0;
        // How far an Animation's slide takes it, per device [x, y] (WPBN_Animation::slack()): an image filling the scene grows to hide its edges.
        $motion['slack'] = WPBN_Entrance::slack($l, WPBN_Animation::slack($l));
        // Attached: the layer it is placed by (its data-uid) and, per device, that layer's point (0–1) and the offset (px); null: its Position.
        if ($attached) {
            $motion['anchor'] = array('to'=>$l['anchor'], 'at'=>array_values(array_map(function ($p) { return $p ? array($p[0] / 100, $p[1] / 100, $p[4], $p[5], $p[6] ?? 0, $p[7] ?? 0) : null; }, $places)));
        }
        $classes = 'wpbn-layer wpbn-layer--'.$l['type'];
        // Show on (2026-11-13): hidden on those devices (frontend.css); a copy seen through a Shape object's window is the object's.
        if (empty($l['copy'])) {
            foreach (array('desktop'=>'d', 'tablet'=>'t', 'mobile'=>'m') as $device=>$short) { if (!empty($l['hide_'.$device])) { $classes .= ' wpbn-layer--hide-'.$short; } }
        }
        // An overlay's or a shortcode's Width per device: % of its container (as the other layers' widths), px or vw.
        if (WPBN_Settings::sized($l)) {
            foreach (WPBN_Settings::heights($l, WPBN_Settings::OVERLAY_WIDTHS) as $device=>$w) {
                // An image filling the scene on this device: as wide as its container there.
                if ($fills[$device]) { $w = array(100, '%'); }
                // An image object's Auto (2026-11-13): as wide as its image at its Height (max-content: never squeezed near the scene's edge).
                $value = $w[1] === 'auto' ? 'max-content' : ($w[1] !== '%' ? $w[0].$w[1] : ($container !== '' ? sprintf(self::IN_CONTAINER['width'], self::CW[$device], $w[0] / 100) : $w[0].'%'));
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
        // Its Padding, Radius and Border (classes in $box): on the layer, or, for a title, text, button or shortcode with an
        // animation, on its innermost animation wrapper (below), so they come in and move with what they frame (2026-11-10).
        $box = '';
        // Its Padding (WPBN_Settings::paddings(); frontend.css): the space inside its box, per device.
        $padding = WPBN_Settings::paddings($l);
        if ($padding) {
            $box .= ' wpbn-layer--padding';
            $css .= '--wpbn-pad:'.$padding['desktop'].';--wpbn-pad-t:'.$padding['tablet'].';--wpbn-pad-m:'.$padding['mobile'].';';
        }
        // Its Radius (WPBN_Settings::radii(); frontend.css): on the same as its Border, per device.
        $radius = WPBN_Settings::radii($l);
        if ($radius) {
            $box .= ' wpbn-layer--radius';
            $css .= '--wpbn-brr:'.$radius['desktop'].';--wpbn-brr-t:'.$radius['tablet'].';--wpbn-brr-m:'.$radius['mobile'].';';
        }
        // Its Border (WPBN_Settings::borders(); frontend.css): on its picture, an overlay's box or its own box, per device.
        $border = WPBN_Settings::borders($l);
        if ($border) {
            $box .= ' wpbn-layer--border';
            $css .= '--wpbn-brw:'.$border['desktop'].';--wpbn-brw-t:'.$border['tablet'].';--wpbn-brw-m:'.$border['mobile'].';--wpbn-brs:'.$l['border_style'].';--wpbn-brc:'.$l['border_color'].';';
        }
        $inner = '';
        // An overlay: the whole scene in its colour, or its Gradient instead (only overlays have one: images and
        // titles had it until 2026-11-08; their values kept are not used). In a box of its own (.wpbn-overlay, 2026-11-09), so its
        // Entrance animation's wrapper can bring it in; the layer keeps its size and place.
        if ($l['type'] === 'overlay') {
            $gradient = !empty($l['use_gradient']) ? WPBN_Gradient::css($l['gradient']) : '';
            $fill = 'background:'.($gradient !== '' ? $gradient : $l['color']).';';
            // Its Shadow (the title's keys and block): around its box, or Inside its edges (a vignette).
            if (WPBN_Settings::shadow($l) !== '') { $fill .= 'box-shadow:'.(!empty($l['shadow_inset']) ? 'inset ' : '').WPBN_Settings::shadow($l).';'; }
            // Its Filters (2026-11-10): of the layers under it (backdrop-filter, frontend.css). Its Blur per device, then the
            // image's others (black and white, brightness…: their f_blur is not an overlay's); none: no backdrop-filter at all.
            $blur = WPBN_Settings::blurs($l);
            if (max($blur) > 0) { $css .= '--wpbn-blur:'.$blur['desktop'].'px;--wpbn-blur-t:'.$blur['tablet'].'px;--wpbn-blur-m:'.$blur['mobile'].'px;'; }
            $tones = WPBN_Settings::filter_vars($l, '--wpbn-bdf', array('f_blur'));
            $css .= $tones;
            $backdrop = max($blur) > 0 || $tones !== '';
            // Its Entrance animation on this box itself, not a wrapper: a box fading or moving around it would cut its blur off
            // from the layers behind (it would blur nothing).
            list($enter_class, $enter_css) = WPBN_Entrance::active($l) ? WPBN_Entrance::wrapper($l) : array('', '');
            $inner = '<div class="wpbn-overlay'.($backdrop ? ' wpbn-layer--blur' : '').($enter_class !== '' ? ' '.$enter_class : '').'" style="'.esc_attr($fill.$enter_css).'"></div>';
            // Its Height per device (frontend.css; % of the scene).
            foreach (WPBN_Settings::heights($l) as $device=>$h) { $css .= '--wpbn-oh'.self::SUFFIX[$device].':'.$h[0].$h[1].';'; }
        } elseif ($l['type'] === 'shortcode') {
            // The other plugin's element, as on a page (it loads its own styles and scripts); clickable (frontend.css).
            // Its Shadow around its box (Inside: within it) and its Filters per device (2026-11-10, user's request): on the same
            // box as its Border (frontend.css). Their own variables: a banner inside it must not take them.
            if (WPBN_Settings::shadow($l) !== '') { $box .= ' wpbn-layer--boxshadow'; $css .= '--wpbn-lsh:'.(!empty($l['shadow_inset']) ? 'inset ' : '').WPBN_Settings::shadow($l).';'; }
            $content_filter = WPBN_Settings::filter_vars($l, '--wpbn-cf');
            if ($content_filter !== '') { $box .= ' wpbn-layer--cfilter'; $css .= $content_filter; }
            self::$in_shortcode = true;
            $inner = do_shortcode($l['shortcode']);
            self::$in_shortcode = false;
        } elseif ($l['type'] === 'button') {
            // A button: its colours and its Size's padding, height and font size per device (frontend.css), a link
            // (a new window: noopener noreferrer) or, without one, a span.
            $css .= '--wpbn-bc:'.$l['button_color'].';--wpbn-bt:'.$l['button_text_color'].';';
            // Its Gradient (2026-11-10): its fill, border or line in it (frontend.css .wpbn-button--gradient).
            $gradient = !empty($l['use_button_gradient']) ? WPBN_Gradient::css($l['gradient']) : '';
            if ($gradient !== '') { $css .= '--wpbn-bg:'.$gradient.';'; }
            // Its Shadow (2026-11-10, the title's keys and block; frontend.css): Filled and Border around the button (Inside: within
            // its edges); Underline along its text and line (drop-shadow), as it has no box to see.
            if (WPBN_Settings::shadow($l) !== '') {
                $css .= $l['button_style'] === 'underline' ? '--wpbn-bds:drop-shadow('.WPBN_Settings::shadow($l).');'
                    : '--wpbn-bsh:'.(!empty($l['shadow_inset']) ? 'inset ' : '').WPBN_Settings::shadow($l).';';
            }
            foreach (WPBN_Settings::resolved($l, 'button_size') as $device=>$size) {
                $suffix = self::SUFFIX[$device];
                list($padding, $height, $font) = WPBN_Settings::BUTTON_SIZES[$size];
                $css .= '--wpbn-bp'.$suffix.':'.$padding.';--wpbn-bh'.$suffix.':'.$height.';--wpbn-bf'.$suffix.':'.$font.';';
            }
            $url = $l['button_url'];
            $tag = $url !== '' ? 'a' : 'span';
            $attrs = $url !== '' ? ' href="'.esc_url($url, WPBN_Settings::BUTTON_PROTOCOLS).'"'.($l['button_new_tab'] ? ' target="_blank" rel="noopener noreferrer"' : '') : '';
            // Its Blur (2026-11-10, the overlay's keys): what is under it blurred, per device (frontend.css .wpbn-layer--blur on the button).
            $blur = WPBN_Settings::blurs($l);
            if (max($blur) > 0) { $css .= '--wpbn-blur:'.$blur['desktop'].'px;--wpbn-blur-t:'.$blur['tablet'].'px;--wpbn-blur-m:'.$blur['mobile'].'px;'; }
            // Its Icon (WPBN_Icons), left or right of the text, its Size and Gap per device (frontend.css).
            $icon = self::button_icon($l);
            if ($icon !== '') {
                foreach (array('button_icon_size'=>'is', 'button_icon_gap'=>'ig') as $key=>$var) {
                    foreach (WPBN_Settings::resolved($l, $key) as $device=>$value) { $css .= '--wpbn-'.$var.self::SUFFIX[$device].':'.$value.'px;'; }
                }
            }
            $text = esc_html($l['button_text']);
            // An icon alone (no text): its name for screen readers (the image's alt, or the icon's name).
            if (trim($l['button_text']) === '' && $icon !== '') { $attrs .= ' aria-label="'.esc_attr(self::icon_label($l)).'"'; }
            $inner = '<'.$tag.' class="wpbn-button wpbn-button--'.$l['button_style'].' wpbn-button--'.$l['button_shape'].($gradient !== '' ? ' wpbn-button--gradient' : '').(max($blur) > 0 ? ' wpbn-layer--blur' : '').'"'.$attrs.'>'
                .($l['button_icon_position'] === 'left' ? $icon.$text : $text.$icon).'</'.$tag.'>';
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
            // Its Gradient (2026-11-10): the letters filled with it, the accent words keeping their colour (frontend.css
            // .wpbn-text-gradient). Its Shadow then along the letters' outline (drop-shadow): a text-shadow would show through them.
            $gradient = !empty($l['use_text_gradient']) ? WPBN_Gradient::css($l['gradient']) : '';
            $css .= '--wpbn-ls:'.$spacing['desktop'].'px;--wpbn-tablet-ls:'.$spacing['tablet'].'px;--wpbn-mobile-ls:'.$spacing['mobile'].'px;'
                .($l['text_transform'] !== 'none' ? 'text-transform:'.$l['text_transform'].';' : '')
                .($l['font_style'] === 'italic' ? 'font-style:italic;' : '')
                .(WPBN_Settings::shadow($l) !== '' && $gradient === '' ? 'text-shadow:'.WPBN_Settings::shadow($l).';' : '');
            // Its Text animation (WPBN_Text_Animation): the letters or words as pieces that come in one after another.
            list($ta_class, $ta_css) = WPBN_Text_Animation::active($l) ? WPBN_Text_Animation::wrapper($l) : array('', '');
            $split = $ta_class !== '' ? WPBN_Text_Animation::split($l['text'], $l) : '';
            if ($split === '') { $ta_class = $ta_css = ''; }
            $text = $split !== '' ? $split : self::title_html($l['text']);
            $tag = $l['tag'];
            // With its Gradient, each piece paints it (frontend.css, frontend.js pieces()).
            if ($ta_css !== '' && $gradient !== '') { $ta_css .= '--wpbn-tg:'.$gradient.';'; }
            $tag_css = $ta_css.($l['font_family'] !== '' ? 'font-family:'.WPBN_Fonts::css($l['font_family']).';' : '')
                .($gradient !== '' ? 'background-image:'.$gradient.';'.(WPBN_Settings::shadow($l) !== '' ? 'filter:drop-shadow('.WPBN_Settings::shadow($l).');' : '') : '');
            $tag_class = trim(($gradient !== '' ? 'wpbn-text-gradient ' : '').$ta_class);
            $inner = '<'.$tag.($tag_class !== '' ? ' class="'.esc_attr($tag_class).'"' : '').($tag_css !== '' ? ' style="'.esc_attr($tag_css).'"' : '').'>'.$text.'</'.$tag.'>';
            // A Google font (Woodmart's list) loaded here, at its weight; empty: the theme's heading font (its weight may not be loaded yet).
            $links .= WPBN_Fonts::link($l['font_family'] !== '' ? $l['font_family'] : 'var(--wd-title-font)', $l['font_weight'], $context['id'] ?? 0, $l['font_style'] === 'italic' ? 'italic' : '');
        } elseif ($l['type'] === 'shape') {
            // A Shape layer: each object a window onto its fill (WPBN_Shape::inner()); the SVG fitted per device.
            $css .= WPBN_Shape::fit_css($l);
            // How it is fitted, for frontend.js (boxes()).
            $motion['fit'] = WPBN_Shape::fit_data($l);
            // Its drawing's area [x, y, w, h] (trimmed or not), for the preview's Dev mode (preview-dev.js).
            $shape_meta = WPBN_Shape::meta($l['shape']);
            if ($shape_meta) { $motion['area'] = WPBN_Shape::area($l, $shape_meta); }
            $inner = WPBN_Shape::inner($s, $l, $context, $state);
        } else {
            // An image object: its Height per device (frontend.css; Auto: as tall as the image at its width); on a device it
            // fills the scene on, the scene's height.
            if (WPBN_Settings::object($l)) {
                $classes .= ' wpbn-layer--object';
                $sizes = WPBN_Settings::object_sizes($l);
                foreach ($sizes as $device=>$wh) { $h = $wh[1]; $css .= '--wpbn-oh'.self::SUFFIX[$device].':'.($fills[$device] ? '100%' : ($h[1] === 'auto' ? 'auto' : $h[0].$h[1])).';'; }
                // Width Auto on some device: its image as wide as its height makes it there (frontend.css --wpbn-iw).
                if (array_filter($sizes, function ($wh) { return $wh[0][1] === 'auto'; })) {
                    foreach ($sizes as $device=>$wh) {
                        $auto = !$fills[$device] && $wh[0][1] === 'auto';
                        // Never wider than its container (--wpbn-mw); narrower there, its image shrinks to fit (Contain, whatever its Image fit).
                        $css .= '--wpbn-iw'.self::SUFFIX[$device].':'.($auto ? 'auto' : '100%').';--wpbn-mw'.self::SUFFIX[$device].':'
                            .($auto ? ($container !== '' ? sprintf(self::IN_CONTAINER['width'], self::CW[$device], 1) : '100%') : 'none').';'
                            .($auto ? '--wpbn-fit'.self::SUFFIX[$device].':contain;' : '');
                    }
                }
            }
            // Its Shadow (the title's keys and block): along the image's outline, a transparent PNG's shape (frontend.css drop-shadow).
            if (WPBN_Settings::shadow($l) !== '') { $classes .= ' wpbn-layer--shadow'; $css .= '--wpbn-ds:'.WPBN_Settings::shadow($l).';'; }
            // Its Filters (black and white, blur…) per device (WPBN_Settings::filter_vars()).
            $filter = WPBN_Settings::filter_vars($l, '--wpbn-filter');
            if ($filter !== '') { $classes .= ' wpbn-layer--filter'; $css .= $filter; }
            // The first scene's images load at once, its back one first; later scenes' when they come near.
            $attrs = $first ? ' decoding="async" loading="eager"'.(!$loaded ? ' fetchpriority="high"' : '') : ' decoding="async" loading="lazy"';
            $inner = self::image($s, $l, $attrs);
            if ($inner) { $loaded = true; }
        }
        // An image's border is on its picture, an overlay's on its box (both inside the wrappers): theirs stay on the layer.
        $framed = !in_array($l['type'], array('image', 'overlay'), true);
        // A Shape layer's: around its objects (WPBN_Shape::inner()).
        $anim = $inner !== '' && WPBN_Animation::active($l) && $l['type'] !== 'shape';
        $enter = $inner !== '' && WPBN_Entrance::active($l) && $l['type'] !== 'overlay';
        if (!$framed || (!$anim && !$enter)) { $classes .= $box; $box = ''; }
        // Animation (WPBN_Animation): the content in a box of its own that it moves, so it adds up with the scroll motion on the layer.
        if ($anim) {
            list($anim_class, $anim_css) = WPBN_Animation::wrapper($l);
            $anim_class .= $box; $box = '';
            $inner = '<div class="'.esc_attr($anim_class).'" style="'.esc_attr($anim_css).'">'.$inner.'</div>';
        }
        // Entrance animation (WPBN_Entrance): around that, so it comes in once, then the Loop animation runs on.
        if ($enter) {
            list($enter_class, $enter_css) = WPBN_Entrance::wrapper($l);
            $enter_class .= $box; $box = '';
            $inner = '<div class="'.esc_attr($enter_class).'" style="'.esc_attr($enter_css).'">'.$inner.'</div>';
        }
        // The editor's preview: its place in the scene's list (admin.js Move finds the chosen layer by it).
        $index = !empty($context['indexes']) && empty($l['copy']) ? ' data-layer="'.(int) $i.'"' : '';
        // A layer others are attached to: its uid, for frontend.js to find it (not on a copy inside a Shape object: that one is not it).
        if (empty($l['copy']) && $l['uid'] !== '' && isset($state['anchors'][$l['uid']])) { $index .= ' data-uid="'.esc_attr($l['uid']).'"'; }
        return '<div class="'.esc_attr($classes).'" style="'.esc_attr($css).'" data-motion="'.esc_attr(wp_json_encode($motion)).'"'.$index.'>'.$inner.'</div>';
    }
}
