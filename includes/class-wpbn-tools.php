<?php
/**
 * Scene tools, for administrators: under a scene's title in the list, "Duplicate" (a draft copy to start a
 * similar banner from) and "Export" (a .json file: its title, settings and its images' addresses); under the
 * WP Banner menu, "Import" (such a file, from this site or another one: a draft scene, its images found in the
 * media library by their address or, if asked, downloaded into it).
 */
defined('ABSPATH') || exit;
class WPBN_Tools {
    const POST_TYPE = 'wpbn_scene';
    // An exported scene's file: its kind, so another .json is not taken for one.
    const FORMAT = 'wp-banner-scene';
    const MAX_FILE = 2097152;
    const IMPORT_PAGE = 'wpbn-import';

    public static function init() {
        add_filter('post_row_actions', array(__CLASS__, 'row_actions'), 10, 2);
        add_action('admin_post_wpbn_duplicate', array(__CLASS__, 'duplicate'));
        add_action('admin_post_wpbn_export', array(__CLASS__, 'export'));
        add_action('admin_post_wpbn_import', array(__CLASS__, 'import'));
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_notices', array(__CLASS__, 'notices'));
    }

    // A link to one of the actions below, for a scene, with its nonce.
    private static function url($action, $id) {
        return wp_nonce_url(add_query_arg(array('action'=>$action, 'post'=>$id), admin_url('admin-post.php')), $action.'_'.$id);
    }

    public static function row_actions($actions, $post) {
        if ($post->post_type !== self::POST_TYPE || !current_user_can('manage_options') || $post->post_status === 'trash') { return $actions; }
        $actions['wpbn_duplicate'] = '<a href="'.esc_url(self::url('wpbn_duplicate', $post->ID)).'">'.esc_html__('Duplicate', 'wp-banner').'</a>';
        $actions['wpbn_export'] = '<a href="'.esc_url(self::url('wpbn_export', $post->ID)).'">'.esc_html__('Export', 'wp-banner').'</a>';
        return $actions;
    }

    // The scene an action is for, after its checks; it stops with an error otherwise.
    private static function scene($action) {
        $id = isset($_GET['post']) ? absint($_GET['post']) : 0;
        check_admin_referer($action.'_'.$id);
        if (!current_user_can('manage_options') || get_post_type($id) !== self::POST_TYPE) {
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

    // The images a scene's layers show (each device's), by id.
    private static function image_ids($settings) {
        $ids = array();
        foreach ($settings['layers'] as $l) {
            foreach (array('image', 'image_tablet', 'image_mobile') as $key) { if ($l[$key]) { $ids[(int) $l[$key]] = true; } }
            // A Shape layer's objects' own images.
            foreach ($l['shape_objects'] as $o) { if (!empty($o['image'])) { $ids[(int) $o['image']] = true; } }
        }
        return array_keys($ids);
    }

    // The scene's Shape layers' SVGs, by attachment id: in the export file itself (an SVG cannot be downloaded into
    // another site's media library; WPBN_Shape writes it again from this, checked as any other).
    private static function shapes($settings) {
        $out = array();
        foreach ($settings['layers'] as $l) {
            $meta = $l['type'] === 'shape' && $l['shape'] ? WPBN_Shape::meta($l['shape']) : null;
            if ($meta) { $out[(string) $l['shape']] = WPBN_Shape::svg($meta); }
        }
        return $out;
    }

    // An imported scene's Shape layers: each SVG in the file made again here (once each); its layers point to it.
    private static function import_shapes($scene, $shapes) {
        if (!is_array($scene['layers'] ?? null)) { return $scene; }
        $made = array();
        foreach ($scene['layers'] as $i=>$l) {
            if (!is_array($l) || ($l['type'] ?? '') !== 'shape') { continue; }
            $old = is_scalar($l['shape'] ?? null) ? (string) absint($l['shape']) : '0';
            if (!isset($made[$old])) {
                $made[$old] = 0;
                $svg = $shapes[$old] ?? null;
                $parsed = is_string($svg) && strlen($svg) <= WPBN_Shape::MAX_FILE ? WPBN_Shape::parse($svg, true) : null;
                if ($parsed && !is_wp_error($parsed)) {
                    $id = WPBN_Shape::store('shape', $parsed);
                    if (!is_wp_error($id)) { $made[$old] = $id; }
                }
            }
            $scene['layers'][$i]['shape'] = $made[$old];
        }
        return $scene;
    }

    // The scene as a .json file to download.
    public static function export() {
        $post = self::scene('wpbn_export');
        $settings = WPBN_Settings::get($post->ID);
        $images = array();
        foreach (self::image_ids($settings) as $image) {
            $url = wp_get_attachment_url($image);
            if ($url) { $images[(string) $image] = array('url'=>$url, 'alt'=>(string) get_post_meta($image, '_wp_attachment_image_alt', true)); }
        }
        $data = array('format'=>self::FORMAT, 'version'=>WPBN_VERSION, 'title'=>$post->post_title, 'scene'=>$settings, 'images'=>$images, 'shapes'=>self::shapes($settings));
        $name = sanitize_file_name(($post->post_title !== '' ? sanitize_title($post->post_title) : 'scene-'.$post->ID).'.json');
        nocache_headers();
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="'.$name.'"');
        echo wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function menu() {
        add_submenu_page('edit.php?post_type='.self::POST_TYPE, __('Import scene', 'wp-banner'), __('Import', 'wp-banner'), 'manage_options', self::IMPORT_PAGE, array(__CLASS__, 'import_page'));
    }

    public static function import_page() {
        echo '<div class="wrap"><h1>'.esc_html__('Import scene', 'wp-banner').'</h1>';
        echo '<p>'.esc_html__('Choose a file exported from WP Banner (Export, under a scene in the list), from this site or another one. It becomes a new draft scene.', 'wp-banner').'</p>';
        echo '<form method="post" enctype="multipart/form-data" action="'.esc_url(admin_url('admin-post.php')).'">';
        wp_nonce_field('wpbn_import');
        echo '<input type="hidden" name="action" value="wpbn_import">';
        echo '<p><input type="file" name="wpbn_file" accept=".json,application/json" required></p>';
        echo '<p><label><input type="checkbox" name="wpbn_download" value="1" checked> '.esc_html__('Download the images this site does not have into its media library', 'wp-banner').'</label></p>';
        echo '<p class="description">'.esc_html__('Images already in the media library (the same address) are used as they are. Off, or where one cannot be downloaded, its layer is left without an image to choose again.', 'wp-banner').'</p>';
        submit_button(__('Import', 'wp-banner'));
        echo '</form></div>';
    }

    // Back to the Import page, with what went wrong.
    private static function fail($code) {
        wp_safe_redirect(add_query_arg(array('post_type'=>self::POST_TYPE, 'page'=>self::IMPORT_PAGE, 'wpbn_error'=>$code), admin_url('edit.php')));
        exit;
    }

    public static function import() {
        check_admin_referer('wpbn_import');
        if (!current_user_can('manage_options')) { wp_die(esc_html__('You cannot import scenes.', 'wp-banner'), '', array('response'=>403)); }
        $file = $_FILES['wpbn_file'] ?? null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- an uploaded file, read below.
        if (!is_array($file) || !isset($file['tmp_name'], $file['error'], $file['size']) || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) { self::fail('upload'); }
        if ($file['size'] > self::MAX_FILE) { self::fail('size'); }
        $data = json_decode((string) file_get_contents($file['tmp_name']), true); // phpcs:ignore WordPress.WP.AlternativeFunctions -- the uploaded file.
        if (!is_array($data) || ($data['format'] ?? '') !== self::FORMAT || !is_array($data['scene'] ?? null)) { self::fail('format'); }
        // Its Shape layers' SVGs first: their objects are kept only for an SVG this site has.
        $settings = WPBN_Settings::sanitize(self::import_shapes($data['scene'], is_array($data['shapes'] ?? null) ? $data['shapes'] : array()));
        // Its images: this site's own (by address), downloaded if asked, or none (0).
        $download = !empty($_POST['wpbn_download']);
        $map = array();
        $missing = 0;
        $images = is_array($data['images'] ?? null) ? $data['images'] : array();
        foreach (self::image_ids($settings) as $old) {
            $url = isset($images[$old]['url']) && is_string($images[$old]['url']) ? esc_url_raw($images[$old]['url'], array('http', 'https')) : '';
            $new = $url !== '' ? attachment_url_to_postid($url) : 0;
            if (!$new && $url !== '' && $download) { $new = self::download($url, isset($images[$old]['alt']) && is_string($images[$old]['alt']) ? $images[$old]['alt'] : ''); }
            if (!$new) { $missing++; }
            $map[$old] = (int) $new;
        }
        foreach ($settings['layers'] as $i=>$l) {
            foreach (array('image', 'image_tablet', 'image_mobile') as $key) { if ($l[$key]) { $settings['layers'][$i][$key] = $map[(int) $l[$key]] ?? 0; } }
            foreach ($l['shape_objects'] as $j=>$o) { if ($o['image']) { $settings['layers'][$i]['shape_objects'][$j]['image'] = $map[(int) $o['image']] ?? 0; } }
        }
        $title = is_string($data['title'] ?? null) && $data['title'] !== '' ? $data['title'] : __('Imported scene', 'wp-banner');
        $id = self::create($title, $settings);
        if (!$id) { self::fail('create'); }
        wp_safe_redirect(add_query_arg(array('action'=>'edit', 'post'=>$id, 'wpbn_imported'=>1, 'wpbn_missing'=>$missing), admin_url('post.php')));
        exit;
    }

    // An image from another site into the media library (an image file only); its id, or 0.
    private static function download($url, $alt) {
        require_once ABSPATH.'wp-admin/includes/media.php';
        require_once ABSPATH.'wp-admin/includes/file.php';
        require_once ABSPATH.'wp-admin/includes/image.php';
        $id = media_sideload_image($url, 0, null, 'id');
        if (is_wp_error($id) || !$id) { return 0; }
        if ($alt !== '') { update_post_meta($id, '_wp_attachment_image_alt', sanitize_text_field($alt)); }
        return (int) $id;
    }

    // After an import (on the new scene's screen), or why it did not happen (on the Import page).
    public static function notices() {
        if (!current_user_can('manage_options')) { return; }
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- only which message to show.
        if (isset($_GET['wpbn_imported'])) {
            $missing = isset($_GET['wpbn_missing']) ? absint($_GET['wpbn_missing']) : 0;
            $text = $missing
                /* translators: %d: how many images were not found */
                ? sprintf(_n('Scene imported as a draft. %d image was not found: choose it again in its layer.', 'Scene imported as a draft. %d images were not found: choose them again in their layers.', $missing, 'wp-banner'), $missing)
                : __('Scene imported as a draft.', 'wp-banner');
            echo '<div class="notice notice-'.($missing ? 'warning' : 'success').' is-dismissible"><p>'.esc_html($text).'</p></div>';
        }
        if (isset($_GET['wpbn_error'], $_GET['page']) && $_GET['page'] === self::IMPORT_PAGE) {
            $messages = array('upload'=>__('The file could not be uploaded.', 'wp-banner'), 'size'=>__('The file is too large (2 MB at most).', 'wp-banner'),
                'format'=>__('This is not a scene exported from WP Banner.', 'wp-banner'), 'create'=>__('The scene could not be created.', 'wp-banner'));
            $code = sanitize_key(wp_unslash($_GET['wpbn_error']));
            if (isset($messages[$code])) { echo '<div class="notice notice-error"><p>'.esc_html($messages[$code]).'</p></div>'; }
        }
        // phpcs:enable
    }
}
