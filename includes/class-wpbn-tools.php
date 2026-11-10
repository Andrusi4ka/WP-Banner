<?php
/**
 * Scene tools, under a scene's title in the list: "Duplicate" (a draft copy to start a similar banner from).
 * Import and Export were removed (user's request, 2026-11-10).
 */
defined('ABSPATH') || exit;
class WPBN_Tools {
    const POST_TYPE = 'wpbn_scene';

    public static function init() {
        add_filter('post_row_actions', array(__CLASS__, 'row_actions'), 10, 2);
        add_action('admin_post_wpbn_duplicate', array(__CLASS__, 'duplicate'));
    }

    // A link to the action below, for a scene, with its nonce.
    private static function url($action, $id) {
        return wp_nonce_url(add_query_arg(array('action'=>$action, 'post'=>$id), admin_url('admin-post.php')), $action.'_'.$id);
    }

    public static function row_actions($actions, $post) {
        if ($post->post_type !== self::POST_TYPE || !WPBN_Access::can('create') || $post->post_status === 'trash') { return $actions; }
        $actions['wpbn_duplicate'] = '<a href="'.esc_url(self::url('wpbn_duplicate', $post->ID)).'">'.esc_html__('Duplicate', 'wp-banner').'</a>';
        return $actions;
    }

    // The scene an action is for, after its checks (Add and clone, WPBN_Access; and the scene's editing); it stops with an error otherwise.
    private static function scene($action) {
        $id = isset($_GET['post']) ? absint($_GET['post']) : 0;
        check_admin_referer($action.'_'.$id);
        if (!WPBN_Access::can('create') || !current_user_can('edit_post', $id) || get_post_type($id) !== self::POST_TYPE) {
            wp_die(esc_html__('You cannot do this to this scene.', 'wp-banner'), '', array('response'=>403));
        }
        return get_post($id);
    }

    // A draft copy, "(copy)" after its title, opened for editing.
    public static function duplicate() {
        $post = self::scene('wpbn_duplicate');
        /* translators: %s: the scene's title */
        $title = sprintf(__('%s (copy)', 'wp-banner'), $post->post_title !== '' ? $post->post_title : __('Scene', 'wp-banner'));
        $id = self::create($title, WPBN_Settings::get($post->ID));
        if (!$id) { wp_die(esc_html__('The scene could not be copied.', 'wp-banner')); }
        wp_safe_redirect(admin_url('post.php?action=edit&post='.$id));
        exit;
    }

    // A draft scene with these settings (sanitized); its id, or 0.
    private static function create($title, $settings) {
        $id = wp_insert_post(array('post_type'=>self::POST_TYPE, 'post_status'=>'draft', 'post_title'=>sanitize_text_field($title)), true);
        if (is_wp_error($id) || !$id) { return 0; }
        update_post_meta($id, WPBN_Settings::META, wp_slash(WPBN_Settings::sanitize($settings)));
        return (int) $id;
    }
}
