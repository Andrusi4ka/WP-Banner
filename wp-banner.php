<?php
/**
 * Plugin Name:       WP Banner
 * Plugin URI:        https://github.com/Andrusi4ka/WP-Banner
 * Description:       Layered scenes that move as the page scrolls: a photo, a title and a cutout in front, for a sense of depth. A visual layer editor with desktop, tablet and phone previews; insert a scene with a shortcode or the WPBakery element.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Relevant AS
 * Author URI:        https://relevant.no/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-banner
 * Domain Path:       /languages
 * Update URI:        https://github.com/Andrusi4ka/WP-Banner
 */
// "Update URI": updates come from this plugin's GitHub releases (wpbn_updates()), never from wordpress.org.
defined('ABSPATH') || exit;
define('WPBN_VERSION', '0.1.0');
define('WPBN_REPOSITORY', 'https://github.com/Andrusi4ka/WP-Banner/');
define('WPBN_FILE', __FILE__);
define('WPBN_DIR', plugin_dir_path(__FILE__));
define('WPBN_URL', plugin_dir_url(__FILE__));
// An asset's version: the plugin's plus the file's time, so browsers fetch it again when it changes.
function wpbn_asset($file) { $time = @filemtime(WPBN_DIR . $file); return $time ? WPBN_VERSION . '.' . $time : WPBN_VERSION; }
require_once WPBN_DIR . 'includes/class-wpbn-settings.php';
require_once WPBN_DIR . 'includes/class-wpbn-render.php';
require_once WPBN_DIR . 'includes/class-wpbn-admin.php';
require_once WPBN_DIR . 'includes/class-wpbn-whats-new.php';
require_once WPBN_DIR . 'includes/class-wpbn-wpbakery.php';
add_action('init', function () {
    load_plugin_textdomain('wp-banner', false, dirname(plugin_basename(__FILE__)) . '/languages');
    register_post_type('wpbn_scene', array(
        'labels' => array('name'=>'WP Banner', 'singular_name'=>__('Scene','wp-banner'), 'add_new_item'=>__('Add scene','wp-banner'), 'edit_item'=>__('Edit scene','wp-banner')),
        'public'=>false, 'show_ui'=>true, 'show_in_rest'=>false, 'supports'=>array('title'),
        'menu_icon'=>'dashicons-images-alt2', 'map_meta_cap'=>true,
        'capabilities'=>array_fill_keys(array('edit_posts','edit_others_posts','edit_private_posts','edit_published_posts','publish_posts','read_private_posts','delete_posts','delete_others_posts','delete_private_posts','delete_published_posts','create_posts'), 'manage_options'),
    ));
});
/**
 * Updates from GitHub, as WP Swiper's: a release (tag "vX.Y.Z" with the wp-banner.zip built by
 * .github/workflows/release.yml) shows up under Plugins like any other update. The same library adds
 * "View details" (from readme.txt) and "Check for updates" under the plugin there.
 */
function wpbn_updates() {
    $library = WPBN_DIR . 'vendor/plugin-update-checker/plugin-update-checker.php';
    if ((!is_admin() && !wp_doing_cron()) || !file_exists($library)) { return; }
    require_once $library;
    $checker = YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(WPBN_REPOSITORY, WPBN_FILE, 'wp-banner');
    // The release's zip, which holds just the plugin (not the repository's dev files).
    $checker->getVcsApi()->enableReleaseAssets('/wp-banner\.zip($|[?&#])/i');
    // Without a release yet, the details come from main.
    $checker->setBranch('main');
}
add_action('plugins_loaded', 'wpbn_updates');
/**
 * Before 0.1.0 was released the plugin was called "WP Layer Motion" (prefix wplm), then "WP Banner
 * Motion" (prefix wpbm). Once per site, the scenes and the plugin's own records saved under either
 * old name move to the current one; the old records are removed. Runs on the first page load after
 * the update (the activation, after a rename).
 */
function wpbn_rename_from_old_names() {
    if (get_option('wpbn_renamed')) { return; }
    global $wpdb;
    foreach (array('wplm'=>'wp-layer-motion', 'wpbm'=>'wp-banner-motion') as $old=>$old_slug) {
        // phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.SlowDBQuery -- one-off rename of the plugin's own rows.
        $wpdb->update($wpdb->posts, array('post_type'=>'wpbn_scene'), array('post_type'=>$old.'_scene'));
        $wpdb->update($wpdb->postmeta, array('meta_key'=>'_wpbn_scene'), array('meta_key'=>'_'.$old.'_scene'));
        $wpdb->update($wpdb->usermeta, array('meta_key'=>'wpbn_seen_version'), array('meta_key'=>$old.'_seen_version'));
        // phpcs:enable
        foreach (array('version', 'updated_from') as $name) {
            $value = get_option($old.'_'.$name, null);
            if ($value !== null && get_option('wpbn_'.$name, null) === null) { add_option('wpbn_'.$name, $value); }
            delete_option($old.'_'.$name);
        }
        delete_option($old.'_renamed');
        delete_transient($old.'_class_scenes');
        delete_site_option('external_updates-'.$old_slug);
    }
    wp_cache_flush();
    add_option('wpbn_renamed', 1);
}
add_action('init', 'wpbn_rename_from_old_names', 1);
WPBN_Render::init();
WPBN_Admin::init();
WPBN_Whats_New::init();
WPBN_WPBakery::init();
