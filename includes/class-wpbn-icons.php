<?php
/**
 * A button's icons (user's request, 2026-11-10, as Woodmart's): Font Awesome Free, kept in the plugin as one list
 * (assets/icons/fontawesome.json: each icon's name, label, search words and its SVG per style), so nothing depends on
 * WPBakery or a font. The editor's picker reads the list; a button keeps the chosen icon's own SVG (button_icon_svg),
 * drawn inline on the page in its text colour, so a later list (an update) never changes or loses it.
 *
 * Updates: WP Banner → Settings → Icons fetches the latest Font Awesome Free (npm's registry, the list from jsDelivr),
 * builds the same list into uploads/wp-banner/ and uses it while it is newer than the plugin's own. A plugin update
 * with a newer list takes over again by itself.
 *
 * Font Awesome Free: icons CC BY 4.0, fonts SIL OFL 1.1, code MIT (assets/icons/LICENSE.txt).
 */
defined('ABSPATH') || exit;
class WPBN_Icons {
    // The list the plugin comes with.
    const BUNDLED = 'assets/icons/fontawesome.json';
    const BUNDLED_VERSION = '7.3.1';
    // An updated list: its version and file (uploads/wp-banner/).
    const OPTION = 'wpbn_icons';
    const DIR = 'wp-banner';
    const REGISTRY = 'https://registry.npmjs.org/@fortawesome/fontawesome-free/latest';
    const METADATA = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@%s/metadata/icon-families.json';
    // Font Awesome Free's styles (classic): style => its letter in the list.
    const STYLES = array('solid'=>'s', 'regular'=>'r', 'brands'=>'b');
    const ACTION = 'wpbn_icons_update';

    public static function init() {
        add_action('admin_post_'.self::ACTION, array(__CLASS__, 'update'));
    }

    // The list in use: [version, url], the updated one while it is newer than the plugin's own.
    public static function current() {
        $saved = get_option(self::OPTION, array());
        if (is_array($saved) && !empty($saved['version']) && !empty($saved['file']) && version_compare($saved['version'], self::BUNDLED_VERSION, '>')) {
            $uploads = wp_upload_dir(null, false);
            if (empty($uploads['error']) && is_readable(trailingslashit($uploads['basedir']).$saved['file'])) {
                return array($saved['version'], trailingslashit($uploads['baseurl']).$saved['file']);
            }
        }
        return array(self::BUNDLED_VERSION, WPBN_URL.self::BUNDLED.'?ver='.self::BUNDLED_VERSION);
    }

    // For the editor (admin.js iconPicker()).
    public static function boot() {
        list($version, $url) = self::current();
        return array('version'=>$version, 'url'=>$url);
    }

    /*
     * The list from Font Awesome's icon-families.json: {version, icons: [[name, label, search words, {s|r|b: [width,
     * height, path]}], …]}, by name. Only the classic Free styles; an icon with more than one path (none in Free) left out.
     */
    public static function build($families, $version) {
        $icons = array();
        foreach ((array) $families as $name=>$icon) {
            // Names as 0–9 come as numbers.
            $name = (string) $name;
            if (!preg_match('/^[a-z0-9-]+$/', $name) || !is_array($icon) || empty($icon['svgs']['classic'])) { continue; }
            $svgs = array();
            foreach (self::STYLES as $style=>$letter) {
                $svg = $icon['svgs']['classic'][$style] ?? null;
                if (!is_array($svg) || !is_string($svg['path'] ?? null) || !self::path_ok($svg['path'])) { continue; }
                $svgs[$letter] = array((int) $svg['width'], (int) $svg['height'], $svg['path']);
            }
            if (!$svgs) { continue; }
            $words = array_merge((array) ($icon['search']['terms'] ?? array()), (array) ($icon['aliases']['names'] ?? array()));
            $words = implode(' ', array_unique(array_filter(array_map('strval', $words))));
            $icons[] = array($name, (string) ($icon['label'] ?? $name), $words, $svgs);
        }
        usort($icons, function ($a, $b) { return strcmp($a[0], $b[0]); });
        return array('version'=>(string) $version, 'icons'=>$icons);
    }

    // An SVG path as Font Awesome's are: its commands and numbers only.
    public static function path_ok($path) {
        return is_string($path) && $path !== '' && strlen($path) < 30000 && preg_match('/^[MmZzLlHhVvCcSsQqTtAa0-9eE.,\s+-]+$/', $path);
    }

    // A button's kept SVG ("width height|path"), checked: [width, height, path] or null.
    public static function parse($value) {
        if (!is_string($value) || !preg_match('/^(\d{1,5}) (\d{1,5})\|(.+)$/s', $value, $m) || !self::path_ok($m[3]) || !$m[1] || !$m[2]) { return null; }
        return array((int) $m[1], (int) $m[2], $m[3]);
    }

    // The icon as inline SVG, in the text's colour; '' for none.
    public static function svg($value) {
        $svg = self::parse($value);
        if (!$svg) { return ''; }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '.$svg[0].' '.$svg[1].'" focusable="false"><path fill="currentColor" d="'.esc_attr($svg[2]).'"/></svg>';
    }

    // WP Banner → Settings: the list in use, and its update.
    public static function section() {
        list($version) = self::current();
        $notice = isset($_GET['wpbn_icons']) ? sanitize_key(wp_unslash($_GET['wpbn_icons'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a notice only.
        $notices = array(
            'updated'=>array('success', __('The icons were updated.', 'wp-banner')),
            'current'=>array('info', __('The icons are up to date.', 'wp-banner')),
            'failed'=>array('error', __('The icons could not be updated. Try again later.', 'wp-banner')),
        );
        ?>
        <h2><?php esc_html_e('Icons', 'wp-banner'); ?></h2>
        <?php if (isset($notices[$notice])) : ?>
            <div class="notice notice-<?php echo esc_attr($notices[$notice][0]); ?> inline"><p><?php echo esc_html($notices[$notice][1]); ?></p></div>
        <?php endif; ?>
        <p class="description">
            <?php
            /* translators: %s: a version, e.g. 7.3.1 */
            echo esc_html(sprintf(__('The buttons\' icons: Font Awesome Free %s. Updating gets the newest icons for the picker; the buttons keep the icons they have.', 'wp-banner'), $version));
            ?>
        </p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="<?php echo esc_attr(self::ACTION); ?>">
            <?php wp_nonce_field(self::ACTION); ?>
            <?php submit_button(__('Check for new icons', 'wp-banner'), 'secondary', 'wpbn-icons-check', false); ?>
        </form>
        <?php
    }

    // The update: the latest version's list, built into uploads, when it is newer than the one in use.
    public static function update() {
        if (!current_user_can(WPBN_Access::CAPABILITY)) { wp_die(esc_html__('You cannot do this.', 'wp-banner'), '', array('response'=>403)); }
        check_admin_referer(self::ACTION);
        $back = admin_url('edit.php?post_type=wpbn_scene&page='.WPBN_Access::PAGE);
        $result = self::fetch();
        wp_safe_redirect(add_query_arg('wpbn_icons', $result, $back));
        exit;
    }

    // updated, current or failed.
    private static function fetch() {
        list($version) = self::current();
        $response = wp_remote_get(self::REGISTRY, array('timeout'=>15));
        $latest = is_wp_error($response) ? null : json_decode(wp_remote_retrieve_body($response), true);
        $latest = is_array($latest) && is_string($latest['version'] ?? null) && preg_match('/^\d+\.\d+\.\d+$/', $latest['version']) ? $latest['version'] : '';
        if ($latest === '') { return 'failed'; }
        if (!version_compare($latest, $version, '>')) { return 'current'; }
        $response = wp_remote_get(sprintf(self::METADATA, $latest), array('timeout'=>60));
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) { return 'failed'; }
        $families = json_decode(wp_remote_retrieve_body($response), true);
        $list = is_array($families) ? self::build($families, $latest) : null;
        // A list that is not one (too few icons): the one in use stays.
        if (!$list || count($list['icons']) < 500) { return 'failed'; }
        $uploads = wp_upload_dir();
        if (!empty($uploads['error'])) { return 'failed'; }
        $dir = trailingslashit($uploads['basedir']).self::DIR;
        $file = 'fontawesome-'.$latest.'.json';
        if (!wp_mkdir_p($dir) || file_put_contents($dir.'/'.$file, wp_json_encode($list)) === false) { return 'failed'; }
        // The list before it, if it was another update.
        $saved = get_option(self::OPTION, array());
        if (is_array($saved) && !empty($saved['file']) && $saved['file'] !== self::DIR.'/'.$file) { wp_delete_file(trailingslashit($uploads['basedir']).$saved['file']); }
        update_option(self::OPTION, array('version'=>$latest, 'file'=>self::DIR.'/'.$file), false);
        return 'updated';
    }
}
