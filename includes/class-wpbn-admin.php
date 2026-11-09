<?php
defined('ABSPATH') || exit;
class WPBN_Admin {
    public static function init() {
        add_action('add_meta_boxes_wpbn_scene', array(__CLASS__, 'boxes'));
        add_action('save_post_wpbn_scene', array(__CLASS__, 'save'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('wp_ajax_wpbn_preview', array(__CLASS__, 'preview'));
        add_action('admin_notices', array(__CLASS__, 'save_notice'));
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
        echo '<p class="description">'.esc_html__('Paste it into any page, or use the “WP Banner” element in WPBakery. To make the scene the background of the row, column or block it stands in, see “Insert into blocks by class” in Scene settings.','wp-banner').'</p>';
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
        // The Text layer's editor (WordPress's, wp.editor: admin.js startEditor()).
        wp_enqueue_editor();
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
        $boot = array('scene'=>$s, 'layer'=>WPBN_Settings::layer(), 'overlayColor'=>WPBN_Settings::OVERLAY_COLOR, 'textColors'=>WPBN_Palette::tinymce_map(), 'images'=>$images, 'imageInfo'=>$info,'assetBase'=>WPBN_URL, 'endpoint'=>admin_url('admin-ajax.php'), 'nonce'=>wp_create_nonce('wpbn_preview'), 'postId'=>$post->ID,
            // The color fields' palette: the theme's colors, black, white and greys.
            'palette'=>WPBN_Palette::colors(), 'primary'=>WPBN_Palette::primary(),
            // The Font list (Woodmart's fonts, with each one's weights); null without Woodmart: a text field.
            'fonts'=>WPBN_Fonts::groups(), 'fontFaces'=>WPBN_Fonts::faces(),
            // The theme's container for Container: Theme container (null: none, the scene's own width is used).
            'themeContainer'=>WPBN_Container::theme());
        // Classes the other scenes are placed by: two scenes with one class would both go into its blocks.
        $boot['classes'] = array();
        foreach (get_posts(array('post_type'=>'wpbn_scene', 'post_status'=>array('publish','draft','pending','private','future'), 'numberposts'=>200, 'exclude'=>array($post->ID))) as $other) {
            $class = WPBN_Settings::placed_class($other->ID);
            if ($class !== '') { $boot['classes'][$class] = $other->post_title !== '' ? $other->post_title : '#'.$other->ID; }
        }
        // The Animation's kinds and choices (WPBN_Animation; admin.js animationCard()).
        $boot['animations'] = WPBN_Animation::editor();
        $boot['maxData'] = self::MAX_DATA;
        $boot['tooLarge'] = __('The scene settings are too large to be saved. Remove some layers or shorten their texts, then update the scene again.', 'wp-banner');
        $boot['icons'] = array('position'=>self::icon('position.svg'), 'clone'=>self::icon('clone.svg'), 'reset'=>self::icon('reset.svg'));
        echo '<div id="wpbn-app"><script type="application/json" id="wpbn-boot">'.wp_json_encode($boot, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).'</script>';
        echo '<input type="hidden" name="wpbn_data" id="wpbn-data" value="'.esc_attr(wp_json_encode($s)).'">';
        // Same three columns as WP Swiper's settings: menu (scene + layers), the chosen card, the preview.
        echo '<div class="wpbn-workspace"><aside class="wpbn-sidebar">';
        echo '<button type="button" class="wpbn-menu-item" id="wpbn-scene-settings" aria-current="false"><span class="dashicons dashicons-admin-generic" aria-hidden="true"></span>'.esc_html__('Scene settings','wp-banner').'</button>';
        echo '<fieldset class="wpbn-section wpbn-layers"><legend>'.esc_html__('Layers','wp-banner').'</legend><p class="description">'.esc_html__('Front layers are at the top. Drag a layer to change its depth.','wp-banner').'</p><div id="wpbn-layers" role="list"></div>';
        // Add element: a block like a layer row; it opens the kinds of element in the settings column (admin.js ELEMENTS).
        echo '<div class="wpbn-add" id="wpbn-add"><button type="button" class="wpbn-add__toggle" id="wpbn-add-toggle" aria-current="false"><span class="wpbn-add__plus dashicons dashicons-plus-alt2" aria-hidden="true"></span><span class="wpbn-add__label">'.esc_html__('Add element','wp-banner').'</span></button></div></fieldset></aside>';
        echo '<div class="wpbn-settings" id="wpbn-settings"></div>';
        echo '<div class="wpbn-preview"><div class="wpbn-toolbar"><span class="wpbn-preview-title">'.esc_html__('Preview','wp-banner').'</span>';
        $devices = array('desktop'=>array('desktop', __('Desktop','wp-banner')), 'tablet'=>array('tablet', __('Tablet','wp-banner')), 'mobile'=>array('smartphone', __('Mobile','wp-banner')));
        echo '<select id="wpbn-device" aria-label="'.esc_attr__('Preview device','wp-banner').'" hidden>';
        foreach ($devices as $device=>$d) { echo '<option value="'.esc_attr($device).'">'.esc_html($d[1]).'</option>'; }
        echo '</select>';
        $rotate = esc_attr__('Turn the tablet or phone sideways','wp-banner');
        echo '<button type="button" class="button" id="wpbn-rotate" aria-pressed="false" aria-label="'.$rotate.'" title="'.$rotate.'">'.self::icon('rotate.svg').'</button>';
        $dark = esc_attr__('Dark screen','wp-banner');
        echo '<button type="button" class="button" id="wpbn-dark" aria-pressed="false" aria-label="'.$dark.'" title="'.$dark.'">'.self::icon('light-dark.svg').'</button>';
        // A screen size of one's own for the device being previewed (admin.js), small, beside the Dark button; empty = the device's usual size.
        echo '<div class="wpbn-resolution" role="group" aria-labelledby="wpbn-res-label"><span class="wpbn-resolution__label" id="wpbn-res-label">'.esc_html__('Screen','wp-banner').'</span>'
            .'<input type="number" id="wpbn-res-w" min="240" max="3840" step="1" aria-label="'.esc_attr__('Screen width (px)','wp-banner').'"><span aria-hidden="true">×</span>'
            .'<input type="number" id="wpbn-res-h" min="240" max="2160" step="1" aria-label="'.esc_attr__('Screen height (px)','wp-banner').'"><span>px</span></div>';
        echo '<div class="wpbn-toolbar__end"><div class="wpbn-preview-devices" role="group" aria-label="'.esc_attr__('Preview device','wp-banner').'">';
        foreach ($devices as $device=>$d) {
            echo '<button type="button" class="wpbn-device-button" data-preview-device="'.esc_attr($device).'" aria-pressed="'.($device==='desktop'?'true':'false').'"><span class="dashicons dashicons-'.$d[0].'" aria-hidden="true"></span>'.esc_html($d[1]).'</button>';
        }
        // Undo and Redo (admin.js; also Ctrl + Z, Ctrl + Shift + Z / Ctrl + Y) for the changes made since the page opened.
        $undo = esc_attr__('Undo (Ctrl + Z)','wp-banner');
        $redo = esc_attr__('Redo (Ctrl + Shift + Z)','wp-banner');
        echo '</div><span class="wpbn-history" role="group" aria-label="'.esc_attr__('History','wp-banner').'">'
            .'<button type="button" class="button" id="wpbn-undo" aria-label="'.$undo.'" title="'.$undo.'" disabled><span class="dashicons dashicons-undo" aria-hidden="true"></span></button>'
            .'<button type="button" class="button" id="wpbn-redo" aria-label="'.$redo.'" title="'.$redo.'" disabled><span class="dashicons dashicons-redo" aria-hidden="true"></span></button></span>';
        echo '<button type="button" class="button" id="wpbn-refresh"><span class="dashicons dashicons-update" aria-hidden="true"></span>'.esc_html__('Update','wp-banner').'</button></div></div>';
        $play = esc_attr__('Play the scroll','wp-banner');
        echo '<div id="wpbn-preview-stage"><div id="wpbn-device-shell"><iframe id="wpbn-frame" name="wpbn_preview_frame" title="'.esc_attr__('Banner preview','wp-banner').'" sandbox="allow-scripts allow-same-origin"></iframe></div></div><div class="wpbn-scrub"><button type="button" class="button" id="wpbn-play" aria-pressed="false" aria-label="'.$play.'" title="'.$play.'"><span class="dashicons dashicons-controls-play" aria-hidden="true"></span></button><label for="wpbn-progress">'.esc_html__('Scroll simulation','wp-banner').'</label><input type="range" id="wpbn-progress" min="0" max="100" step="0.1" value="0"></div><p class="description">'.esc_html__('Preview uses unsaved settings: press Update to see your changes. Publish or update the scene to apply them on the site.','wp-banner').'</p></div></div></div>';
    }
    public static function save($id) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE || wp_is_post_revision($id) || !current_user_can('manage_options') || !current_user_can('edit_post',$id)) { return; }
        if (!isset($_POST['wpbn_nonce']) || !is_string($_POST['wpbn_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['wpbn_nonce'])), 'wpbn_save')) { return; }
        if (!isset($_POST['wpbn_data']) || !is_string($_POST['wpbn_data'])) { return; }
        // The size as sent (unslashed: WordPress's slashes would count every quote twice).
        $json = wp_unslash($_POST['wpbn_data']); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- JSON, sanitized below.
        if (strlen($json) > self::MAX_DATA) { self::save_error('too_large'); return; }
        $data = json_decode($json, true);
        if (!is_array($data)) { self::save_error('invalid'); return; }
        if (is_array($data['layers'] ?? null) && count($data['layers']) > WPBN_Settings::MAX_LAYERS) { self::save_error('too_many'); }
        update_post_meta($id, WPBN_Settings::META, wp_slash(WPBN_Settings::sanitize($data)));
        WPBN_Settings::forget($id);
    }
    // The scene's settings as sent, at most (admin.js checks it before the form is sent).
    const MAX_DATA = 500000;
    // Why the scene's settings were not (all) saved: shown once, on the screen the save leads to.
    private static function save_error($code) {
        set_transient('wpbn_save_error_'.get_current_user_id(), $code, 120);
    }
    public static function save_notice() {
        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== 'wpbn_scene') { return; }
        $key = 'wpbn_save_error_'.get_current_user_id();
        $code = get_transient($key);
        if (!$code) { return; }
        delete_transient($key);
        $messages = array(
            'too_large'=>__('The scene settings were not saved: they are too large. Remove some layers or shorten their texts, then update the scene again.', 'wp-banner'),
            'invalid'=>__('The scene settings were not saved: the editor sent them damaged. Reload the page and try again.', 'wp-banner'),
            /* translators: %d: the most layers a scene can have */
            'too_many'=>sprintf(__('A scene can have at most %d layers: only the first ones were saved.', 'wp-banner'), WPBN_Settings::MAX_LAYERS),
        );
        if (isset($messages[$code])) { echo '<div class="notice notice-error is-dismissible"><p>'.esc_html($messages[$code]).'</p></div>'; }
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
        // A Shortcode layer: the plugins' styles and scripts it loads, as on a page. Their assets are registered as on a
        // page (wp_enqueue_scripts); what that queues for every page (the theme's) is dropped: only the shortcodes' own.
        $shortcodes = (bool) array_filter($s['layers'], function ($l) { return $l['type'] === 'shortcode' && !$l['hidden'] && $l['shortcode'] !== ''; });
        if ($shortcodes) {
            do_action('wp_enqueue_scripts');
            wp_styles()->queue = array();
            wp_scripts()->queue = array();
        }
        $markup = self::preview_markup($s);
        $head = $foot = '';
        if ($shortcodes) {
            ob_start(); wp_print_styles(); $head = ob_get_clean();
            ob_start(); wp_print_scripts(); $foot = ob_get_clean();
        }
        nocache_headers();
        header('Content-Type: text/html; charset='.get_option('blog_charset'));
        echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'.esc_url(WPBN_URL.'assets/css/frontend.css?ver='.wpbn_asset('assets/css/frontend.css')).'"><style>'.self::PAGE_CSS.self::theme_css().'</style>'.$head.'</head><body>'.$markup.self::PAGE.$foot.'<script src="'.esc_url(WPBN_URL.'assets/js/frontend.js?ver='.wpbn_asset('assets/js/frontend.js')).'"></script></body></html>';
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
