<?php
defined('ABSPATH') || exit;
class WPBN_Admin {
    public static function init() {
        add_action('add_meta_boxes_wpbn_scene', array(__CLASS__, 'boxes'));
        add_action('save_post_wpbn_scene', array(__CLASS__, 'save'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('wp_ajax_wpbn_preview', array(__CLASS__, 'preview'));
        add_filter('manage_wpbn_scene_posts_columns', function($c) { $c['wpbn_shortcode'] = __('Shortcode','wp-banner'); return $c; });
        add_action('manage_wpbn_scene_posts_custom_column', function($c,$id) { if ($c==='wpbn_shortcode') { echo '<code>[wp_banner id="'.absint($id).'"]</code>'; } },10,2);
    }
    public static function boxes() {
        add_meta_box('wpbn-editor', __('Scene editor','wp-banner'), array(__CLASS__, 'editor'), 'wpbn_scene', 'normal', 'high');
        add_meta_box('wpbn-shortcode', __('Shortcode','wp-banner'), array(__CLASS__, 'shortcode_box'), 'wpbn_scene', 'side', 'high');
    }
    // As in WP Swiper: the shortcode in its own box above Publish.
    public static function shortcode_box($post) {
        echo '<input type="text" class="wpbn-shortcode" readonly value="'.esc_attr('[wp_banner id="'.absint($post->ID).'"]').'" onclick="this.select()" aria-label="'.esc_attr__('Scene shortcode','wp-banner').'">';
        echo '<p class="description">'.esc_html__('Paste it into any page, or use the “WP Banner” element in WPBakery. To make the scene the background of the row, column or block it stands in, see Placement in the scene settings.','wp-banner').'</p>';
    }
    // Shown under a layer's image: its file name, its pixel size and its weight.
    public static function image_info($id) {
        $meta = wp_get_attachment_metadata($id);
        $file = get_attached_file($id);
        $bytes = !empty($meta['filesize']) ? (int) $meta['filesize'] : ($file && file_exists($file) ? filesize($file) : 0);
        return array('name'=>$file ? wp_basename($file) : '', 'width'=>(int) ($meta['width'] ?? 0), 'height'=>(int) ($meta['height'] ?? 0), 'size'=>$bytes ? size_format($bytes, $bytes < 1048576 ? 0 : 1) : '');
    }
    // An SVG from assets/images, inline so it takes the button's colour.
    private static function icon($file) {
        $svg = (string) file_get_contents(WPBN_DIR.'assets/images/'.$file);
        // No comments, no line breaks between tags (they would be text in the button).
        return str_replace('<svg', '<svg aria-hidden="true" focusable="false"', trim(preg_replace(array('/<!--.*?-->/s', '/>\s+</'), array('', '><'), $svg)));
    }
    public static function assets() {
        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== 'wpbn_scene' || $screen->base !== 'post') { return; }
        wp_enqueue_media();
        // Pickr 1.9.1 (MIT), as in WP Swiper: every color field's picker (admin.js colorField()).
        wp_enqueue_style('wpbn-pickr', WPBN_URL.'assets/vendor/pickr/classic.min.css', array(), '1.9.1');
        wp_enqueue_script('wpbn-pickr', WPBN_URL.'assets/vendor/pickr/pickr.min.js', array(), '1.9.1', true);
        wp_enqueue_style('wpbn-admin', WPBN_URL.'assets/css/admin.css', array('wpbn-pickr'), wpbn_asset('assets/css/admin.css'));
        wp_enqueue_script('wpbn-admin', WPBN_URL.'assets/js/admin.js', array('wpbn-pickr'), wpbn_asset('assets/js/admin.js'), true);
    }
    public static function editor($post) {
        wp_nonce_field('wpbn_save', 'wpbn_nonce');
        $s = WPBN_Settings::get($post->ID);
        $images = array();
        $info = array();
        foreach ($s['layers'] as $l) {
            foreach (array($l['image'], $l['image_tablet'], $l['image_mobile']) as $image) {
                if ($image && !isset($images[$image])) { $images[$image] = wp_get_attachment_image_url($image,'large'); $info[$image] = self::image_info($image); }
            }
        }
        $boot = array('scene'=>$s, 'layer'=>WPBN_Settings::layer(), 'images'=>$images, 'imageInfo'=>$info,'assetBase'=>WPBN_URL, 'endpoint'=>admin_url('admin-ajax.php'), 'nonce'=>wp_create_nonce('wpbn_preview'), 'postId'=>$post->ID,
            // The color fields' palette: the theme's colors, black, white and greys.
            'palette'=>WPBN_Palette::colors(), 'primary'=>WPBN_Palette::primary(),
            // The Font list (Woodmart's fonts, with each one's weights); null without Woodmart: a text field.
            'fonts'=>WPBN_Fonts::groups(), 'fontFaces'=>WPBN_Fonts::faces(),
            // The theme's container for Container: Theme container (null: none, the scene's own width is used).
            'themeContainer'=>WPBN_Container::theme());
        // Classes the other scenes are placed by: two scenes with one class would both go into its blocks.
        $boot['classes'] = array();
        foreach (get_posts(array('post_type'=>'wpbn_scene', 'post_status'=>array('publish','draft','pending','private','future'), 'numberposts'=>200, 'exclude'=>array($post->ID))) as $other) {
            $o = WPBN_Settings::get($other->ID);
            if (WPBN_Settings::placed_by_class($o)) { $boot['classes'][$o['target']] = $other->post_title !== '' ? $other->post_title : '#'.$other->ID; }
        }
        $boot['icons'] = array('position'=>self::icon('position.svg'), 'clone'=>self::icon('clone.svg'), 'reset'=>self::icon('reset.svg'));
        echo '<div id="wpbn-app"><script type="application/json" id="wpbn-boot">'.wp_json_encode($boot, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).'</script>';
        echo '<input type="hidden" name="wpbn_data" id="wpbn-data" value="'.esc_attr(wp_json_encode($s)).'">';
        // Same three columns as WP Swiper's settings: menu (scene + layers), the chosen card, the preview.
        echo '<div class="wpbn-workspace"><aside class="wpbn-sidebar">';
        echo '<button type="button" class="wpbn-menu-item" id="wpbn-scene-settings" aria-current="false"><span class="dashicons dashicons-admin-generic" aria-hidden="true"></span>Scene settings</button>';
        echo '<fieldset class="wpbn-section wpbn-layers"><legend>Layers</legend><p class="description">Front layers are at the top. Drag a layer to change its depth.</p><div id="wpbn-layers" role="list"></div>';
        // Add element: a block like a layer row; it opens the kinds of element in the settings column (admin.js ELEMENTS).
        echo '<div class="wpbn-add" id="wpbn-add"><button type="button" class="wpbn-add__toggle" id="wpbn-add-toggle" aria-current="false"><span class="wpbn-add__plus dashicons dashicons-plus-alt2" aria-hidden="true"></span><span class="wpbn-add__label">Add element</span></button></div></fieldset></aside>';
        echo '<div class="wpbn-settings" id="wpbn-settings"></div>';
        echo '<div class="wpbn-preview"><div class="wpbn-toolbar"><span class="wpbn-preview-title">Preview</span>';
        echo '<select id="wpbn-device" aria-label="Preview device" hidden><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select>';
        echo '<button type="button" class="button" id="wpbn-rotate" aria-pressed="false" aria-label="Turn the tablet or phone sideways" title="Turn the tablet or phone sideways">'.self::icon('rotate.svg').'</button>';
        echo '<button type="button" class="button" id="wpbn-dark" aria-pressed="false" aria-label="Dark screen" title="Dark screen">'.self::icon('light-dark.svg').'</button>';
        echo '<div class="wpbn-toolbar__end"><div class="wpbn-preview-devices" role="group" aria-label="Preview device">';
        foreach (array('desktop'=>array('desktop','Desktop'), 'tablet'=>array('tablet','Tablet'), 'mobile'=>array('smartphone','Mobile')) as $device=>$d) {
            echo '<button type="button" class="wpbn-device-button" data-preview-device="'.$device.'" aria-pressed="'.($device==='desktop'?'true':'false').'"><span class="dashicons dashicons-'.$d[0].'" aria-hidden="true"></span>'.$d[1].'</button>';
        }
        echo '</div><button type="button" class="button" id="wpbn-refresh"><span class="dashicons dashicons-update" aria-hidden="true"></span>Update</button></div></div>';
        // A screen size of one's own for the device being previewed (admin.js); empty = the device's usual size.
        echo '<div class="wpbn-resolution" role="group" aria-labelledby="wpbn-res-label"><span class="wpbn-resolution__label" id="wpbn-res-label">Screen</span>'
            .'<input type="number" id="wpbn-res-w" min="240" max="3840" step="1" aria-label="Screen width (px)"><span aria-hidden="true">×</span>'
            .'<input type="number" id="wpbn-res-h" min="240" max="2160" step="1" aria-label="Screen height (px)"><span>px</span>'
            .'<span class="wpbn-resolution__hint" id="wpbn-res-hint" role="status"></span></div>';
        echo '<div id="wpbn-preview-stage"><div id="wpbn-device-shell"><iframe id="wpbn-frame" name="wpbn_preview_frame" title="Banner preview" sandbox="allow-scripts allow-same-origin"></iframe></div></div><div class="wpbn-scrub"><button type="button" class="button" id="wpbn-play" aria-pressed="false" aria-label="Play the scroll" title="Play the scroll"><span class="dashicons dashicons-controls-play" aria-hidden="true"></span></button><label for="wpbn-progress">Scroll simulation</label><input type="range" id="wpbn-progress" min="0" max="100" step="0.1" value="0"></div><p class="description">Preview uses unsaved settings: press Update to see your changes. Publish or update the scene to apply them on the site.</p></div></div></div>';
    }
    public static function save($id) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE || wp_is_post_revision($id) || !current_user_can('manage_options') || !current_user_can('edit_post',$id)) { return; }
        if (!isset($_POST['wpbn_nonce']) || !is_string($_POST['wpbn_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['wpbn_nonce'])), 'wpbn_save')) { return; }
        if (!isset($_POST['wpbn_data']) || !is_string($_POST['wpbn_data']) || strlen($_POST['wpbn_data'])>200000) { return; }
        $data = json_decode(wp_unslash($_POST['wpbn_data']),true);
        if (!is_array($data)) { return; }
        update_post_meta($id, WPBN_Settings::META, wp_slash(WPBN_Settings::sanitize($data)));
    }
    // % and Auto take their height from the block around the scene: in the
    // preview that block is as tall as the screen (a full-height row).
    public static function preview_markup($s) {
        // Placed by class (it fills its block): shown in a block as tall as the screen.
        if (WPBN_Settings::placed_by_class($s)) {
            return '<div class="wpbn-host" style="position:relative;height:100vh">'.WPBN_Render::markup($s, array('fill'=>true)).'</div>';
        }
        $markup = WPBN_Render::markup($s);
        if (array_intersect(array_column(WPBN_Settings::heights($s), 1), array('%','auto'))) {
            $markup = '<div class="wpbn-preview-parent" style="height:100vh">'.$markup.'</div>';
        }
        return $markup;
    }
    public static function preview() {
        check_ajax_referer('wpbn_preview', 'nonce');
        $id = isset($_POST['post_id']) && is_scalar($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!current_user_can('manage_options') || !current_user_can('edit_post',$id) || get_post_type($id)!=='wpbn_scene') { wp_die('Forbidden', '', array('response'=>403)); }
        if (!isset($_POST['scene']) || !is_string($_POST['scene']) || strlen($_POST['scene'])>200000) { wp_die('Invalid scene', '', array('response'=>400)); }
        $s = WPBN_Settings::sanitize(json_decode(wp_unslash($_POST['scene']),true));
        $markup = self::preview_markup($s);
        nocache_headers();
        header('Content-Type: text/html; charset='.get_option('blog_charset'));
        echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'.esc_url(WPBN_URL.'assets/css/frontend.css?ver='.wpbn_asset('assets/css/frontend.css')).'"><style>'.self::PAGE_CSS.self::theme_css().'</style></head><body>'.$markup.self::PAGE.'<script src="'.esc_url(WPBN_URL.'assets/js/frontend.js?ver='.wpbn_asset('assets/js/frontend.js')).'"></script></body></html>';
        exit;
    }
    // Under the scene in the preview: the rest of a page, drawn as grey blocks (a heading, text,
    // a picture, cards), so the page can scroll the scene out of view as on the site. At least a
    // screen tall: the scene's motion ends once it has scrolled up by its own height.
    const PAGE = '<main class="wpbn-page" aria-hidden="true"><div class="wpbn-page__intro"><span class="wpbn-page__title"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line wpbn-page__line--short"></span></div>'
        .'<div class="wpbn-page__media"><span class="wpbn-page__picture"></span><div><span class="wpbn-page__subtitle"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line wpbn-page__line--short"></span><span class="wpbn-page__button"></span></div></div>'
        .'<div class="wpbn-page__cards"><span class="wpbn-page__card"><span class="wpbn-page__thumb"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line wpbn-page__line--short"></span></span><span class="wpbn-page__card"><span class="wpbn-page__thumb"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line wpbn-page__line--short"></span></span><span class="wpbn-page__card"><span class="wpbn-page__thumb"></span><span class="wpbn-page__line"></span><span class="wpbn-page__line wpbn-page__line--short"></span></span></div></main>';
    // The preview page has none of the theme's styles: its primary color, which the titles' accent words take (frontend.css).
    public static function theme_css() {
        $primary = WPBN_Palette::primary();
        // And its fonts (WPBN_Fonts::theme_css()).
        return ($primary !== '' ? ':root{--wd-primary-color:'.$primary.'}' : '').WPBN_Fonts::theme_css();
    }
    // The placeholder page's look; the Dark button gives the body .wpbn-black (admin.js).
    // Thin scrollbars, as light or dark as the screen.
    const PAGE_CSS = 'html{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.28) transparent}html:has(body.wpbn-black){scrollbar-color:rgba(255,255,255,.28) transparent}'
        .'body{margin:0;background:#fff;--wpbn-ph:#e6e7e9;--wpbn-ph-strong:#d3d5d8;--wpbn-ph-bg:#fff}'
        .'body.wpbn-black{background:#121212;--wpbn-ph:#2a2c2f;--wpbn-ph-strong:#3a3d41;--wpbn-ph-bg:#121212}'
        .'.wpbn-page{box-sizing:border-box;min-height:100vh;max-width:1140px;margin:0 auto;padding:clamp(32px,6vw,72px) clamp(16px,4vw,40px);background:var(--wpbn-ph-bg)}'
        .'.wpbn-page span{display:block;border-radius:6px;background:var(--wpbn-ph)}'
        .'.wpbn-page__intro{max-width:720px;margin:0 auto clamp(40px,6vw,72px);text-align:center}'
        .'.wpbn-page__title{width:60%;height:clamp(22px,3vw,34px);margin:0 auto 22px;background:var(--wpbn-ph-strong)!important}'
        .'.wpbn-page__subtitle{width:55%;height:22px;margin-bottom:18px;background:var(--wpbn-ph-strong)!important}'
        .'.wpbn-page__line{height:12px;margin:0 auto 12px}'
        .'.wpbn-page__line--short{width:60%}'
        .'.wpbn-page__intro .wpbn-page__line--short{margin:0 auto}'
        .'.wpbn-page__media{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,4vw,48px);align-items:center;margin-bottom:clamp(40px,6vw,72px)}'
        .'.wpbn-page__media .wpbn-page__line{margin-left:0}'
        .'.wpbn-page__picture{aspect-ratio:4/3}'
        .'.wpbn-page__button{width:140px;height:40px;margin-top:24px;border-radius:20px!important;background:var(--wpbn-ph-strong)!important}'
        .'.wpbn-page__cards{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,3vw,32px)}'
        .'.wpbn-page__card{background:none!important}'
        .'.wpbn-page__thumb{aspect-ratio:16/10;margin-bottom:16px}'
        .'.wpbn-page__card .wpbn-page__line{margin-left:0}'
        .'@media(max-width:767px){.wpbn-page__media,.wpbn-page__cards{grid-template-columns:1fr}}';
}
