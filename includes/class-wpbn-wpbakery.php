<?php
/**
 * The WPBakery Page Builder element: the [wp_banner] shortcode with a list of
 * the scenes and, under it, "Edit scene" and "Add scene" (as WP Swiper's element).
 */
defined('ABSPATH') || exit;

class WPBN_WPBakery {
    // The "Edit scene" and "Add scene" buttons under the Scene list (a param type of its own).
    const EDIT_PARAM = 'wp_banner_edit';
    // The Scene list again (wpbakery.js, once back from adding one): its AJAX action.
    const LIST_ACTION = 'wp_banner_vc_scenes';
    const POST_TYPE = 'wpbn_scene';

    public static function init() {
        add_action('vc_before_init', array(__CLASS__, 'map'));
        add_action('wp_ajax_'.self::LIST_ACTION, array(__CLASS__, 'ajax_scenes'));
    }

    public static function map() {
        // Not an element at all for those without the WPBakery element right (WP Banner → Settings). Pages
        // still show the scenes: WPBakery keeps the shortcode's own handler.
        if (!WPBN_Access::can('wpbakery')) { return; }
        if (function_exists('vc_add_shortcode_param')) {
            vc_add_shortcode_param(self::EDIT_PARAM, array(__CLASS__, 'edit_param'), WPBN_URL.'assets/js/wpbakery.js?ver='.rawurlencode(wpbn_asset('assets/js/wpbakery.js')));
        }
        if (function_exists('vc_lean_map')) {
            // Lean map: the settings (and the scenes query) load only when the editor needs them.
            vc_lean_map(WPBN_Render::SHORTCODE, array(__CLASS__, 'settings'));
        }
    }

    /**
     * The "Add element" tab: with the Woodmart theme its own "Theme elements"
     * (next to its galleries and carousels), named as the theme names it;
     * otherwise WPBakery's "Content".
     */
    private static function category() {
        if (function_exists('woodmart_get_tab_title_category_for_wpb')) {
            return woodmart_get_tab_title_category_for_wpb(esc_html__('Theme elements', 'woodmart')); // phpcs:ignore WordPress.WP.I18n.TextDomainMismatch -- the theme's own tab name.
        }
        return __('Content', 'wp-banner');
    }

    public static function settings() {
        return array(
            'name'        => __('WP Banner', 'wp-banner'),
            'base'        => WPBN_Render::SHORTCODE,
            'icon'        => WPBN_URL.'assets/images/wpbakery-icon.svg',
            'category'    => self::category(),
            // Last in the "Add element" list: WPBakery sorts by weight (default 0), then by mapping order.
            'weight'      => -100,
            'description' => __('Layered banner that moves as the page scrolls', 'wp-banner'),
            'params'      => array(
                array(
                    'type'        => 'dropdown',
                    'heading'     => __('Scene', 'wp-banner'),
                    'param_name'  => 'id',
                    'value'       => self::scene_options(),
                    'admin_label' => true,
                    'description' => sprintf(
                        /* translators: %s: link to the scenes screen */
                        __('Create and edit scenes under %s. A scene placed by class becomes the background of the row, column or block with its class that this element stands in.', 'wp-banner'),
                        '<a href="'.esc_url(admin_url('edit.php?post_type='.self::POST_TYPE)).'" target="_blank">WP Banner</a>'
                    ),
                ),
                // Opens the chosen scene's edit screen in a new tab (wpbakery.js keeps
                // it pointing at the scene chosen above). Saves nothing in the shortcode.
                array(
                    'type'       => self::EDIT_PARAM,
                    'heading'    => '',
                    'param_name' => self::EDIT_PARAM,
                ),
            ),
        );
    }

    /**
     * The buttons under the Scene list: "Edit scene", a link to post.php for the
     * scene chosen (wpbakery.js sets it and hides it while none is), and "Add
     * scene", the new scene screen; both open in a new tab, as the note under
     * them says. Back from adding one, wpbakery.js asks for the list again
     * (data-list: admin-ajax.php, LIST_ACTION, its nonce) and chooses the new
     * scene. Its field is empty, so WPBakery adds nothing to the shortcode.
     */
    public static function edit_param($settings, $value) {
        unset($value);
        $name = isset($settings['param_name']) ? $settings['param_name'] : self::EDIT_PARAM;
        $add = '';
        if (self::can_add()) {
            $add = sprintf(' <a class="button wpbn-vc-edit__add" href="%1$s" target="_blank" rel="noopener">%2$s</a>', esc_url(admin_url('post-new.php?post_type='.self::POST_TYPE)), esc_html__('Add scene', 'wp-banner'));
        }
        $list = add_query_arg(array('action'=>self::LIST_ACTION, '_wpnonce'=>wp_create_nonce(self::LIST_ACTION)), admin_url('admin-ajax.php'));
        return sprintf(
            '<div class="wpbn-vc-edit" data-url="%1$s" data-list="%6$s"><a class="button wpbn-vc-edit__link" href="#" target="_blank" rel="noopener" hidden>%2$s</a>%7$s<p class="description wpbn-vc-edit__note" style="margin:6px 0 0">%5$s</p><input type="hidden" name="%3$s" class="wpb_vc_param_value %3$s %4$s" value=""></div>',
            esc_url(admin_url('post.php?action=edit&post=')),
            esc_html__('Edit scene', 'wp-banner'),
            esc_attr($name),
            esc_attr(self::EDIT_PARAM),
            esc_html__('Opens in a new tab. When you come back, a scene you published there is chosen in the list.', 'wp-banner'),
            esc_url($list),
            $add // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped where it is built.
        );
    }

    // Whether the user may add scenes (the post type's own capability).
    private static function can_add() {
        $type = get_post_type_object(self::POST_TYPE);
        return $type && current_user_can($type->cap->create_posts);
    }

    /**
     * The scenes the list offers (published), by title.
     *
     * @return array [ [ 'id' => int, 'label' => string ] ]
     */
    public static function scenes() {
        $list = array();
        foreach (get_posts(array('post_type'=>self::POST_TYPE, 'post_status'=>'publish', 'posts_per_page'=>-1, 'orderby'=>'title', 'order'=>'ASC')) as $scene) {
            $title = $scene->post_title !== '' ? $scene->post_title : __('(no title)', 'wp-banner');
            $list[] = array('id'=>(int) $scene->ID, 'label'=>sprintf('%s (#%d)', $title, $scene->ID));
        }
        return $list;
    }

    // WPBakery dropdown values: label => value.
    private static function scene_options() {
        $options = array(__('— Select scene —', 'wp-banner') => '');
        foreach (self::scenes() as $scene) { $options[$scene['label']] = (string) $scene['id']; }
        return $options;
    }

    // The Scene list again, for wpbakery.js, to administrators (with the nonce edit_param() gave).
    public static function ajax_scenes() {
        check_ajax_referer(self::LIST_ACTION);
        if (!WPBN_Access::can('wpbakery')) { wp_send_json_error(null, 403); }
        wp_send_json_success(self::scenes());
    }
}
