<?php
/**
 * Plugin Name:       WP Layer Motion
 * Plugin URI:        https://github.com/Andrusi4ka/WP-Layer-Motion
 * Description:       Layered scenes that move as the page scrolls: a photo, a title and a cutout in front, for a sense of depth. A visual layer editor with desktop, tablet and phone previews; insert a scene with a shortcode or the WPBakery element.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Relevant AS
 * Author URI:        https://relevant.no/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-layer-motion
 * Domain Path:       /languages
 * Update URI:        https://github.com/Andrusi4ka/WP-Layer-Motion
 */
// "Update URI": updates come from this plugin's GitHub releases (wplm_updates()), never from wordpress.org.
defined('ABSPATH') || exit;
define('WPLM_VERSION', '0.1.0');
define('WPLM_REPOSITORY', 'https://github.com/Andrusi4ka/WP-Layer-Motion/');
define('WPLM_FILE', __FILE__);
define('WPLM_DIR', plugin_dir_path(__FILE__));
define('WPLM_URL', plugin_dir_url(__FILE__));
// An asset's version: the plugin's plus the file's time, so browsers fetch it again when it changes.
function wplm_asset($file) { $time = @filemtime(WPLM_DIR . $file); return $time ? WPLM_VERSION . '.' . $time : WPLM_VERSION; }
require_once WPLM_DIR . 'includes/class-wplm-settings.php';
require_once WPLM_DIR . 'includes/class-wplm-render.php';
require_once WPLM_DIR . 'includes/class-wplm-admin.php';
require_once WPLM_DIR . 'includes/class-wplm-whats-new.php';
add_action('init', function () {
    load_plugin_textdomain('wp-layer-motion', false, dirname(plugin_basename(__FILE__)) . '/languages');
    register_post_type('wplm_scene', array(
        'labels' => array('name'=>'WP Layer Motion', 'singular_name'=>__('Scene','wp-layer-motion'), 'add_new_item'=>__('Add scene','wp-layer-motion'), 'edit_item'=>__('Edit scene','wp-layer-motion')),
        'public'=>false, 'show_ui'=>true, 'show_in_rest'=>false, 'supports'=>array('title'),
        'menu_icon'=>'dashicons-images-alt2', 'map_meta_cap'=>true,
        'capabilities'=>array_fill_keys(array('edit_posts','edit_others_posts','edit_private_posts','edit_published_posts','publish_posts','read_private_posts','delete_posts','delete_others_posts','delete_private_posts','delete_published_posts','create_posts'), 'manage_options'),
    ));
});
/**
 * Updates from GitHub, as WP Swiper's: a release (tag "vX.Y.Z" with the wp-layer-motion.zip built by
 * .github/workflows/release.yml) shows up under Plugins like any other update. The same library adds
 * "View details" (from readme.txt) and "Check for updates" under the plugin there.
 */
function wplm_updates() {
    $library = WPLM_DIR . 'vendor/plugin-update-checker/plugin-update-checker.php';
    if ((!is_admin() && !wp_doing_cron()) || !file_exists($library)) { return; }
    require_once $library;
    $checker = YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(WPLM_REPOSITORY, WPLM_FILE, 'wp-layer-motion');
    // The release's zip, which holds just the plugin (not the repository's dev files).
    $checker->getVcsApi()->enableReleaseAssets('/wp-layer-motion\.zip($|[?&#])/i');
    // Without a release yet, the details come from main.
    $checker->setBranch('main');
}
add_action('plugins_loaded', 'wplm_updates');
WPLM_Render::init();
WPLM_Admin::init();
WPLM_Whats_New::init();
