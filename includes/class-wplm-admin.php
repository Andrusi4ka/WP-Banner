<?php
defined('ABSPATH') || exit;
class WPLM_Admin {
    public static function init() {
        add_action('add_meta_boxes_wplm_scene', array(__CLASS__, 'boxes'));
        add_action('save_post_wplm_scene', array(__CLASS__, 'save'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('wp_ajax_wplm_preview', array(__CLASS__, 'preview'));
        add_filter('manage_wplm_scene_posts_columns', function($c) { $c['wplm_shortcode'] = __('Shortcode','wp-layer-motion'); return $c; });
        add_action('manage_wplm_scene_posts_custom_column', function($c,$id) { if ($c==='wplm_shortcode') { echo '<code>[wp_layer_motion id="'.absint($id).'"]</code>'; } },10,2);
    }
    public static function boxes() {
        add_meta_box('wplm-editor', __('Scene editor','wp-layer-motion'), array(__CLASS__, 'editor'), 'wplm_scene', 'normal', 'high');
        add_meta_box('wplm-shortcode', __('Shortcode','wp-layer-motion'), array(__CLASS__, 'shortcode_box'), 'wplm_scene', 'side', 'high');
    }
    // As in WP Swiper: the shortcode in its own box above Publish.
    public static function shortcode_box($post) {
        echo '<input type="text" class="wplm-shortcode" readonly value="'.esc_attr('[wp_layer_motion id="'.absint($post->ID).'"]').'" onclick="this.select()" aria-label="'.esc_attr__('Scene shortcode','wp-layer-motion').'">';
        echo '<p class="description">'.esc_html__('Paste it into any page, or use the “WP Layer Motion” element in WPBakery.','wp-layer-motion').'</p>';
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
        $svg = (string) file_get_contents(WPLM_DIR.'assets/images/'.$file);
        // No comments, no line breaks between tags (they would be text in the button).
        return str_replace('<svg', '<svg aria-hidden="true" focusable="false"', trim(preg_replace(array('/<!--.*?-->/s', '/>\s+</'), array('', '><'), $svg)));
    }
    public static function assets() {
        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== 'wplm_scene' || $screen->base !== 'post') { return; }
        wp_enqueue_media();
        wp_enqueue_style('wplm-admin', WPLM_URL.'assets/css/admin.css', array(), wplm_asset('assets/css/admin.css'));
        wp_enqueue_script('wplm-admin', WPLM_URL.'assets/js/admin.js', array(), wplm_asset('assets/js/admin.js'), true);
    }
    public static function editor($post) {
        wp_nonce_field('wplm_save', 'wplm_nonce');
        $s = WPLM_Settings::get($post->ID);
        $images = array();
        $info = array();
        foreach ($s['layers'] as $l) {
            if ($l['image'] && !isset($images[$l['image']])) { $images[$l['image']] = wp_get_attachment_image_url($l['image'],'large'); $info[$l['image']] = self::image_info($l['image']); }
        }
        $boot = array('scene'=>$s, 'layer'=>WPLM_Settings::layer(), 'images'=>$images, 'imageInfo'=>$info,'assetBase'=>WPLM_URL, 'endpoint'=>admin_url('admin-ajax.php'), 'nonce'=>wp_create_nonce('wplm_preview'), 'postId'=>$post->ID);
        $boot['icons'] = array('position'=>self::icon('position.svg'), 'clone'=>self::icon('clone.svg'));
        echo '<div id="wplm-app"><script type="application/json" id="wplm-boot">'.wp_json_encode($boot, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).'</script>';
        echo '<input type="hidden" name="wplm_data" id="wplm-data" value="'.esc_attr(wp_json_encode($s)).'">';
        // Same three columns as WP Swiper's settings: menu (scene + layers), the chosen card, the preview.
        echo '<div class="wplm-workspace"><aside class="wplm-sidebar">';
        echo '<button type="button" class="wplm-menu-item" id="wplm-scene-settings" aria-current="false"><span class="dashicons dashicons-admin-generic" aria-hidden="true"></span>Scene settings</button>';
        echo '<fieldset class="wplm-section wplm-layers"><legend>Layers</legend><p class="description">Front layers are at the top. Drag a layer to change its depth.</p><div id="wplm-layers" role="list"></div>';
        // Add element: a block like a layer row; it opens the kinds of element in the settings column (admin.js ELEMENTS).
        echo '<div class="wplm-add" id="wplm-add"><button type="button" class="wplm-add__toggle" id="wplm-add-toggle" aria-current="false"><span class="wplm-add__plus dashicons dashicons-plus-alt2" aria-hidden="true"></span><span class="wplm-add__label">Add element</span></button></div></fieldset></aside>';
        echo '<div class="wplm-settings" id="wplm-settings"></div>';
        echo '<div class="wplm-preview"><div class="wplm-toolbar"><span class="wplm-preview-title">Preview</span>';
        echo '<select id="wplm-device" aria-label="Preview device" hidden><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select>';
        echo '<button type="button" class="button" id="wplm-rotate" aria-pressed="false" aria-label="Turn the tablet or phone sideways" title="Turn the tablet or phone sideways">'.self::icon('rotate.svg').'</button>';
        echo '<button type="button" class="button" id="wplm-dark" aria-pressed="false" aria-label="Dark screen" title="Dark screen">'.self::icon('light-dark.svg').'</button>';
        echo '<div class="wplm-toolbar__end"><div class="wplm-preview-devices" role="group" aria-label="Preview device">';
        foreach (array('desktop'=>array('desktop','Desktop'), 'tablet'=>array('tablet','Tablet'), 'mobile'=>array('smartphone','Mobile')) as $device=>$d) {
            echo '<button type="button" class="wplm-device-button" data-preview-device="'.$device.'" aria-pressed="'.($device==='desktop'?'true':'false').'"><span class="dashicons dashicons-'.$d[0].'" aria-hidden="true"></span>'.$d[1].'</button>';
        }
        echo '</div><button type="button" class="button" id="wplm-refresh"><span class="dashicons dashicons-update" aria-hidden="true"></span>Update</button></div></div>';
        echo '<div id="wplm-preview-stage"><div id="wplm-device-shell"><iframe id="wplm-frame" name="wplm_preview_frame" title="Layer Motion preview" sandbox="allow-scripts allow-same-origin"></iframe></div></div><div class="wplm-scrub"><button type="button" class="button" id="wplm-play" aria-pressed="false" aria-label="Play the scroll" title="Play the scroll"><span class="dashicons dashicons-controls-play" aria-hidden="true"></span></button><label for="wplm-progress">Scroll simulation</label><input type="range" id="wplm-progress" min="0" max="100" step="0.1" value="0"></div><p class="description">Preview uses unsaved settings: press Update to see your changes. Publish or update the scene to apply them on the site.</p></div></div></div>';
    }
    public static function save($id) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE || wp_is_post_revision($id) || !current_user_can('manage_options') || !current_user_can('edit_post',$id)) { return; }
        if (!isset($_POST['wplm_nonce']) || !is_string($_POST['wplm_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['wplm_nonce'])), 'wplm_save')) { return; }
        if (!isset($_POST['wplm_data']) || !is_string($_POST['wplm_data']) || strlen($_POST['wplm_data'])>200000) { return; }
        $data = json_decode(wp_unslash($_POST['wplm_data']),true);
        if (!is_array($data)) { return; }
        update_post_meta($id, WPLM_Settings::META, wp_slash(WPLM_Settings::sanitize($data)));
    }
    // % and Auto take their height from the block around the scene: in the
    // preview that block is as tall as the screen (a full-height row).
    public static function preview_markup($s) {
        $markup = WPLM_Render::markup($s);
        if (array_intersect(array($s['height_unit'], $s['tablet_height_unit'], $s['mobile_height_unit']), array('%','auto'))) {
            $markup = '<div class="wplm-preview-parent" style="height:100vh">'.$markup.'</div>';
        }
        return $markup;
    }
    public static function preview() {
        check_ajax_referer('wplm_preview', 'nonce');
        $id = isset($_POST['post_id']) && is_scalar($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!current_user_can('manage_options') || !current_user_can('edit_post',$id) || get_post_type($id)!=='wplm_scene') { wp_die('Forbidden', '', array('response'=>403)); }
        if (!isset($_POST['scene']) || !is_string($_POST['scene']) || strlen($_POST['scene'])>200000) { wp_die('Invalid scene', '', array('response'=>400)); }
        $s = WPLM_Settings::sanitize(json_decode(wp_unslash($_POST['scene']),true));
        $markup = self::preview_markup($s);
        nocache_headers();
        header('Content-Type: text/html; charset='.get_option('blog_charset'));
        echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'.esc_url(WPLM_URL.'assets/css/frontend.css?ver='.wplm_asset('assets/css/frontend.css')).'"><style>body{margin:0;background:#f0f0f1}body:after{content:"";display:block;height:100vh}body.wplm-black:after{background:#121212}</style></head><body>'.$markup.'<script src="'.esc_url(WPLM_URL.'assets/js/frontend.js?ver='.wplm_asset('assets/js/frontend.js')).'"></script></body></html>';
        exit;
    }
}
