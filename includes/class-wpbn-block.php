<?php
/**
 * The "WP Banner" block for the block editor (any theme, no page builder needed): a scene chosen from a list,
 * shown in the editor as on the page (rendered by the server, without the scroll motion) and drawn on the
 * site as [wp_banner id=""] is. assets/js/block.js: plain JavaScript on WordPress's own scripts, no build step.
 */
defined('ABSPATH') || exit;
class WPBN_Block {
    const NAME = 'wp-banner/scene';

    public static function init() {
        add_action('init', array(__CLASS__, 'register'));
    }

    public static function register() {
        if (!function_exists('register_block_type')) { return; }
        wp_register_script('wpbn-block', WPBN_URL.'assets/js/block.js', array('wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-server-side-render', 'wp-i18n'), wpbn_asset('assets/js/block.js'), true);
        // The banner's look in the editor too.
        wp_register_style('wpbn-frontend', WPBN_URL.'assets/css/frontend.css', array(), wpbn_asset('assets/css/frontend.css'));
        register_block_type(self::NAME, array(
            'api_version'=>2,
            'title'=>__('WP Banner', 'wp-banner'),
            'description'=>__('A layered banner that moves as the page scrolls.', 'wp-banner'),
            'category'=>'media',
            'icon'=>'images-alt2',
            'keywords'=>array('banner', 'parallax', 'hero'),
            'attributes'=>array('id'=>array('type'=>'number', 'default'=>0)),
            'supports'=>array('html'=>false, 'align'=>array('wide', 'full')),
            'editor_script'=>'wpbn-block',
            'editor_style'=>'wpbn-frontend',
            'render_callback'=>array(__CLASS__, 'render'),
        ));
        // The scenes to choose from, and where to make and edit them.
        add_action('enqueue_block_editor_assets', function () {
            $scenes = class_exists('WPBN_WPBakery') ? WPBN_WPBakery::scenes() : array();
            wp_add_inline_script('wpbn-block', 'window.wpbnBlock='.wp_json_encode(array(
                'scenes'=>$scenes,
                'edit'=>WPBN_Access::can('edit') ? admin_url('post.php?action=edit&post=') : '',
                'add'=>WPBN_Access::can('create') ? admin_url('post-new.php?post_type=wpbn_scene') : '',
            )).';', 'before');
        });
    }

    // On the site as the shortcode draws it; in the editor's preview (the REST renderer) too, its motion aside.
    public static function render($attributes) {
        $id = isset($attributes['id']) ? absint($attributes['id']) : 0;
        if (!$id) { return ''; }
        $html = WPBN_Render::shortcode(array('id'=>$id));
        // In the block editor a scene that is not published (a draft…) shows too, with a word on why the page will not show it;
        // one deleted, that word alone. The site shows neither.
        if ($html === '' && self::editing()) {
            if (get_post_type($id) !== 'wpbn_scene' || get_post_status($id) === 'trash') {
                return '<p class="wpbn-block-note" style="margin:0 0 8px;padding:8px 12px;border-left:4px solid #dba617;background:#fcf9e8;color:#1d2327;font-size:13px">'.esc_html__('This scene no longer exists. Choose another one.', 'wp-banner').'</p>';
            }
            if (current_user_can('edit_post', $id)) {
                $html = '<p class="wpbn-block-note" style="margin:0 0 8px;padding:8px 12px;border-left:4px solid #dba617;background:#fcf9e8;color:#1d2327;font-size:13px">'.esc_html__('This scene is not published: it shows here, not on the site.', 'wp-banner').'</p>'.WPBN_Render::scene($id);
            }
        }
        $align = isset($attributes['align']) && in_array($attributes['align'], array('wide', 'full'), true) ? ' align'.$attributes['align'] : '';
        return $html === '' ? '' : '<div class="wp-block-wp-banner-scene'.$align.'">'.$html.'</div>';
    }
    // The block editor's preview of the block (ServerSideRender: the REST block renderer, in the edit context).
    private static function editing() {
        return defined('REST_REQUEST') && REST_REQUEST && isset($_GET['context']) && sanitize_key(wp_unslash($_GET['context'])) === 'edit'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- REST checks the request; this only adds a note.
    }
}
