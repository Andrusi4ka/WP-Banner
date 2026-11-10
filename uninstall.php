<?php
/**
 * Runs when the plugin is deleted under Plugins (not on deactivation or
 * update): removes the scenes and their settings, "What's new" state and the
 * update checker's stored state. Images stay in the media library, where
 * other content may use them. As WP Swiper's uninstall.php.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// All in a function of its own: nothing left in the global scope.
(function () {
    // Every scene of the current site (any status, trash included);
    // wp_delete_post() also removes its post meta (_wpbn_scene).
    $uninstall_site = function () {
        global $wpdb;
        $ids = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = %s", 'wpbn_scene')); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- one-off cleanup.
        foreach ($ids as $id) {
            wp_delete_post((int) $id, true);
        }
        // The Shape layers' SVGs (WPBN_Shape: posts of their own type, with their objects in post meta).
        $shapes = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = %s", 'wpbn_shape')); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- one-off cleanup.
        foreach ($shapes as $id) {
            wp_delete_post((int) $id, true);
        }
        delete_option('wpbn_shapes_moved');
        // Who may do what (WPBN_Access).
        delete_option('wpbn_access');
        delete_option('wpbn_roles');
        // The buttons' icons, if they were updated (WPBN_Icons): the list in uploads/wp-banner/ and its record.
        $icons = get_option('wpbn_icons', array());
        if (is_array($icons) && !empty($icons['file']) && preg_match('#^wp-banner/fontawesome-[0-9.]+\.json$#', $icons['file'])) {
            $uploads = wp_upload_dir(null, false);
            if (empty($uploads['error'])) {
                wp_delete_file(trailingslashit($uploads['basedir']).$icons['file']);
                @rmdir(trailingslashit($uploads['basedir']).'wp-banner'); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- only if empty.
            }
        }
        delete_option('wpbn_icons');
        // "What's new": the version last run and the one updated from.
        delete_option('wpbn_version');
        delete_option('wpbn_updated_from');
        // The list of scenes placed by class.
        delete_transient('wpbn_class_scenes');
        // The mark that the records under the plugin's old name were moved.
        delete_option('wpbn_renamed');
    };

    if (is_multisite()) {
        foreach (get_sites(array('fields' => 'ids', 'number' => 0)) as $site_id) {
            switch_to_blog($site_id);
            $uninstall_site();
            restore_current_blog();
        }
    } else {
        $uninstall_site();
    }

    // "What's new": the version each user has seen (users are shared by a network's sites).
    delete_metadata('user', 0, 'wpbn_seen_version', '', true);

    // Last update check (Plugin Update Checker).
    delete_site_option('external_updates-wp-banner');
})();
