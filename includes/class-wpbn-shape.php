<?php
/**
 * A Shape layer's SVG (WPBN_Settings type "shape"): a file of several objects (rectangles, paths…) whose shapes
 * become windows onto the layers' contents. An SVG may carry scripts, so it is never kept as it was sent: its
 * shapes' geometry is read out (parse()) and a new SVG is written from it alone (no colours, styles, links or
 * scripts), kept as a post of the plugin's own type (POST_TYPE) with its objects in META. Not in the media library, nor a
 * file in the uploads folder (user's request, 2026-11-10: so it cannot be deleted there by mistake; the site draws the objects
 * from META, the editor its SVG written from them). Before that, an attachment (image/svg+xml): migrate() moves those, ids kept.
 *
 * Objects: the top-level elements of the drawing (a shape, or a group of shapes as one object); a single group
 * around everything (an Illustrator layer) is looked into. Text, embedded images, <use> and lines are left out
 * and named in "skipped", so the editor can say why.
 */
defined('ABSPATH') || exit;
class WPBN_Shape {
    // The attachment's objects: array('viewbox'=>[x, y, w, h], 'objects'=>[['key'=>'o1', 'name'=>'', 'markup'=>'<path…/>']], 'skipped'=>[kind=>count]).
    const META = '_wpbn_shape';
    // Its post type: not public, no screen of its own, not in menus, searches or exports.
    const POST_TYPE = 'wpbn_shape';
    // The mime type the shapes had as attachments (until 2026-11-10; migrate()).
    const MIME = 'image/svg+xml';
    const MIGRATED = 'wpbn_shapes_moved';
    const AJAX = 'wpbn_shape_upload';
    const MAX_FILE = 1048576;
    const MAX_OBJECTS = 60;
    // Shapes kept, with the attributes that make their geometry.
    const SHAPES = array('rect'=>array('x', 'y', 'width', 'height', 'rx', 'ry'), 'circle'=>array('cx', 'cy', 'r'), 'ellipse'=>array('cx', 'cy', 'rx', 'ry'),
        'polygon'=>array('points'), 'polyline'=>array('points'), 'path'=>array('d'));
    // Left out without a word: what holds no drawing of its own.
    const SILENT = array('defs', 'style', 'title', 'desc', 'metadata', 'script', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'filter', 'symbol', 'marker');
    // Left out and counted (the editor names them): text not turned into outlines, pictures, references to other objects, lines.
    const SKIPPED = array('text'=>'text', 'image'=>'image', 'use'=>'use', 'line'=>'line', 'foreignObject'=>'other', 'switch'=>'other', 'a'=>'other');
    const NS = 'http://www.w3.org/2000/svg';

    public static function init() {
        add_action('init', array(__CLASS__, 'register'));
        add_action('init', array(__CLASS__, 'migrate'), 20);
        add_action('wp_ajax_'.self::AJAX, array(__CLASS__, 'upload'));
    }

    public static function register() {
        register_post_type(self::POST_TYPE, array('label'=>'WP Banner shapes', 'public'=>false, 'show_ui'=>false, 'show_in_menu'=>false, 'show_in_nav_menus'=>false,
            'show_in_rest'=>false, 'exclude_from_search'=>true, 'publicly_queryable'=>false, 'query_var'=>false, 'rewrite'=>false, 'can_export'=>false, 'supports'=>array('title')));
    }

    /*
     * Once per site: the shapes kept as attachments (before 2026-11-10) become posts of POST_TYPE, their ids (in the scenes'
     * layers) kept; their files (the SVGs this class wrote, not the ones uploaded) and the attachment's records removed.
     */
    public static function migrate() {
        if (get_option(self::MIGRATED)) { return; }
        global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.SlowDBQuery -- one-off move of the plugin's own rows.
        $ids = $wpdb->get_col($wpdb->prepare("SELECT p.ID FROM {$wpdb->posts} p INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = %s WHERE p.post_type = 'attachment' AND p.post_mime_type = %s", self::META, self::MIME));
        foreach ($ids as $id) {
            $id = (int) $id;
            $file = get_attached_file($id);
            $wpdb->update($wpdb->posts, array('post_type'=>self::POST_TYPE, 'post_status'=>'publish', 'post_mime_type'=>'', 'guid'=>'', 'post_parent'=>0), array('ID'=>$id));
            delete_post_meta($id, '_wp_attached_file');
            delete_post_meta($id, '_wp_attachment_metadata');
            if ($file && is_file($file) && strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'svg') { wp_delete_file($file); }
            clean_post_cache($id);
        }
        // phpcs:enable
        add_option(self::MIGRATED, 1);
    }

    // An SVG uploaded in the Shape layer's card: checked, rewritten and kept; its editor data (editor()) back.
    public static function upload() {
        check_ajax_referer(self::AJAX, 'nonce');
        if (!WPBN_Access::can('edit')) { wp_send_json_error(array('message'=>__('You cannot upload shapes.', 'wp-banner')), 403); }
        $file = $_FILES['file'] ?? null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- an uploaded file, read below.
        if (!is_array($file) || !isset($file['tmp_name'], $file['error'], $file['size'], $file['name']) || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            wp_send_json_error(array('message'=>__('The file could not be uploaded.', 'wp-banner')));
        }
        if ($file['size'] > self::MAX_FILE) { wp_send_json_error(array('message'=>__('The file is too large (1 MB at most).', 'wp-banner'))); }
        $parsed = self::parse((string) file_get_contents($file['tmp_name'])); // phpcs:ignore WordPress.WP.AlternativeFunctions -- the uploaded file.
        if (is_wp_error($parsed)) { wp_send_json_error(array('message'=>$parsed->get_error_message())); }
        $id = self::store(sanitize_file_name(wp_basename((string) $file['name'], '.svg')), $parsed);
        if (is_wp_error($id)) { wp_send_json_error(array('message'=>$id->get_error_message())); }
        wp_send_json_success(self::editor($id));
    }

    // The rewritten SVG's objects as a post of POST_TYPE (no file); its id (or a WP_Error).
    public static function store($name, $parsed) {
        $id = wp_insert_post(array('post_type'=>self::POST_TYPE, 'post_title'=>sanitize_text_field($name !== '' ? $name : 'shape'), 'post_content'=>'', 'post_status'=>'publish'), true);
        if (is_wp_error($id)) { return $id; }
        update_post_meta($id, self::META, wp_slash($parsed));
        return (int) $id;
    }

    // A shape's objects (META), or null. A shape not moved yet (migrate()) is still read as the attachment it was.
    public static function meta($id) {
        $id = absint($id);
        $type = $id ? get_post_type($id) : false;
        if ($type !== self::POST_TYPE && !($type === 'attachment' && get_post_mime_type($id) === self::MIME)) { return null; }
        $meta = get_post_meta($id, self::META, true);
        return is_array($meta) && isset($meta['viewbox'], $meta['objects']) && is_array($meta['objects']) ? $meta : null;
    }

    // The SVG written from the objects: each one a <g data-key="…"> (the editor finds them by it).
    public static function svg($parsed) {
        $out = '<svg xmlns="'.self::NS.'" viewBox="'.esc_attr(implode(' ', $parsed['viewbox'])).'">';
        foreach ($parsed['objects'] as $object) { $out .= '<g data-key="'.esc_attr($object['key']).'"'.($object['name'] !== '' ? ' data-name="'.esc_attr($object['name']).'"' : '').'>'.$object['markup'].'</g>'; }
        return $out.'</svg>';
    }

    // What the editor needs (admin.js shapes): the file's name, its objects, the SVG to draw and what was left out.
    public static function editor($id) {
        $meta = self::meta($id);
        if (!$meta) { return null; }
        $file = get_post_type($id) === 'attachment' ? get_attached_file($id) : '';
        $name = $file ? wp_basename($file) : (get_the_title($id) !== '' ? get_the_title($id).'.svg' : '');
        return array('id'=>(int) $id, 'name'=>$name, 'viewbox'=>array_map('floatval', $meta['viewbox']), 'defaults'=>self::object_defaults(),
            'objects'=>array_map(function ($o) { return array('key'=>$o['key'], 'name'=>$o['name']); }, $meta['objects']),
            'svg'=>self::svg($meta), 'skipped'=>is_array($meta['skipped'] ?? null) ? $meta['skipped'] : array());
    }

    /*
     * What fills an object: layer: a copy of another (image) layer of the scene, lined up with it and moving as it does,
     * so the object is a window onto it (with its own filters: a colour photo over its black and white self); image: a
     * picture of its own, covering the object's area; color: a colour or a gradient; glass: what is behind it blurred
     * (frosted glass) under a tint; none: nothing, only its edge and shadow.
     */
    const FILLS = array('layer', 'image', 'color', 'glass', 'none');
    // An object's settings, as a new one has them (key and name come from the file).
    public static function object_defaults() {
        return array('key'=>'', 'name'=>'', 'hidden'=>false, 'fill'=>'layer', 'source'=>'', 'image'=>0, 'color'=>'#ffffff', 'use_gradient'=>false, 'gradient'=>WPBN_Gradient::DEFAULT_VALUE,
            'glass_blur'=>12, 'glass_color'=>'rgba(255,255,255,0.15)', 'opacity'=>100, 'invert'=>false,
            // Effect (2026-11-10, user's request; Border instead of Edge): a line along its outline, its width per device (in the
            // drawing's px: it scales with the drawing), Inside / Center / Outside its edge; Radius: a rectangle's corners (px of
            // the drawing or % of its shorter side), per device; radius_linked: the editor sets the four together.
            'use_border'=>false, 'border_width'=>2, 'border_width_tablet'=>null, 'border_width_mobile'=>null, 'border_position'=>'inside', 'border_style'=>'solid', 'border_color'=>'#ffffff',
            'use_radius'=>false, 'radius_linked'=>true, 'radius_tl'=>20, 'radius_tr'=>20, 'radius_br'=>20, 'radius_bl'=>20,
            'radius_tl_tablet'=>null, 'radius_tr_tablet'=>null, 'radius_br_tablet'=>null, 'radius_bl_tablet'=>null,
            'radius_tl_mobile'=>null, 'radius_tr_mobile'=>null, 'radius_br_mobile'=>null, 'radius_bl_mobile'=>null,
            'radius_tl_unit'=>'px', 'radius_tr_unit'=>'px', 'radius_br_unit'=>'px', 'radius_bl_unit'=>'px',
            'use_shadow'=>false, 'shadow_color'=>'rgba(0,0,0,0.5)', 'shadow_x'=>0, 'shadow_y'=>10, 'shadow_blur'=>25, 'use_scroll'=>false, 'move_x'=>0, 'move_y'=>0,
            // Its box in the drawing [x, y, w, h] (the editor measures it, admin.js sync()): where Reveal and Zoom play.
            'box'=>array())
            // Entrance and Loop animation (2026-11-10, user's request): a layer's settings (Loop: From, To and Duration per device).
            + WPBN_Entrance::defaults() + WPBN_Animation::defaults()
            + array('anim_from_tablet'=>null, 'anim_from_mobile'=>null, 'anim_to_tablet'=>null, 'anim_to_mobile'=>null, 'anim_duration_tablet'=>null, 'anim_duration_mobile'=>null)
            + WPBN_Settings::filters(array());
    }
    private static function num($value, $fallback, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? round(max($min, min($max, (float) $value)), 1) : $fallback;
    }
    /*
     * An object's Entrance animation (2026-11-10, user's request): kind => [its keyframes (frontend.css .wpbn-oenter--…),
     * the side a slide comes from]. A slide moves the window (what it shows stays), Reveal uncovers it from a side, Zoom
     * grows it into place around its middle (frontend.js boxes(): its box on the screen). On glass no fading of the whole
     * object (it would stop the blur until the end): its blur and tint come in instead.
     */
    const ENTER = array('fade'=>array('fade', null), 'slide-up'=>array('slide', array(0, 1)), 'slide-down'=>array('slide', array(0, -1)),
        'slide-left'=>array('slide', array(1, 0)), 'slide-right'=>array('slide', array(-1, 0)),
        'reveal-left'=>array('reveal-left', null), 'reveal-right'=>array('reveal-right', null), 'reveal-top'=>array('reveal-top', null), 'reveal-bottom'=>array('reveal-bottom', null),
        'zoom'=>array('zoom', null));
    // The editor's names (admin.js entranceCard()).
    public static function enter_names() {
        return array('fade'=>__('Fade in', 'wp-banner'), 'slide-up'=>__('Slide up (from below)', 'wp-banner'), 'slide-down'=>__('Slide down (from above)', 'wp-banner'),
            'slide-left'=>__('Slide left (from the right)', 'wp-banner'), 'slide-right'=>__('Slide right (from the left)', 'wp-banner'),
            'reveal-left'=>__('Reveal from the left', 'wp-banner'), 'reveal-right'=>__('Reveal from the right', 'wp-banner'), 'reveal-top'=>__('Reveal from the top', 'wp-banner'), 'reveal-bottom'=>__('Reveal from the bottom', 'wp-banner'),
            'zoom'=>__('Zoom', 'wp-banner'));
    }
    // Its item's classes and CSS variables, and its box for frontend.js: [class, css, attributes]; none without one.
    private static function entrance($o, $viewbox) {
        if (empty($o['use_enter']) || !isset(self::ENTER[$o['enter_type']])) { return array('', '', ''); }
        list($kind, $side) = self::ENTER[$o['enter_type']];
        $css = '--wpbn-ed:'.$o['enter_duration'].'s;'.($o['enter_delay'] > 0 ? '--wpbn-edl:'.$o['enter_delay'].'s;' : '').($o['enter_easing'] !== 'ease-out' ? '--wpbn-ee:'.$o['enter_easing'].';' : '');
        if ($side) { $css .= '--wpbn-ex:'.($side[0] * $o['enter_distance']).'px;--wpbn-ey:'.($side[1] * $o['enter_distance']).'px;'; }
        if ($kind === 'zoom') { $css .= '--wpbn-es:'.round($o['enter_scale'] / 100, 3).';'; }
        $class = ' wpbn-oenter wpbn-oenter--'.(strpos($kind, 'reveal') === 0 ? 'reveal wpbn-oenter--'.$kind : $kind).($o['fill'] === 'glass' ? ' wpbn-oenter--glass' : '').($o['enter_start'] === 'visible' ? ' wpbn-oenter--visible' : '');
        return array($class, $css, $kind === 'zoom' || strpos($kind, 'reveal') === 0);
    }
    /*
     * An object's Loop animation (2026-11-10, user's request): a layer's kinds (WPBN_Animation), on a box around its fill and
     * line (.wpbn-shape-loop: apart from its Entrance animation's, so the two add up). Slide moves the window (--wpbn-lox,
     * -loy added to its masks' place), Zoom grows it around a point of its own box (Direction: --wpbn-fx, -fy), Fade: on
     * glass its blur and tint (a fading box around it would stop the blur), elsewhere the whole. [class, css]; none without one.
     */
    const ORIGIN_POINTS = array('center'=>array(.5, .5), 'top'=>array(.5, 0), 'bottom'=>array(.5, 1), 'left'=>array(0, .5), 'right'=>array(1, .5),
        'top-left'=>array(0, 0), 'top-right'=>array(1, 0), 'bottom-left'=>array(0, 1), 'bottom-right'=>array(1, 1));
    private static function loop($o) {
        $types = WPBN_Animation::types();
        if (empty($o['use_anim']) || !isset($types[$o['anim_type']])) { return array('', ''); }
        $type = $types[$o['anim_type']];
        $css = '';
        foreach (array('desktop'=>'-d', 'tablet'=>'-t', 'mobile'=>'-m') as $device=>$suffix) {
            $v = array();
            foreach (array('anim_from', 'anim_to') as $key) { $v[] = round(max($type['min'], min($type['max'], self::at($o, $key, $device))) / $type['div'], 4); }
            $seconds = max(WPBN_Animation::DURATION[0], min(WPBN_Animation::DURATION[1], self::at($o, 'anim_duration', $device)));
            $css .= '--wpbn-a0'.$suffix.':'.$v[0].$type['unit'].';--wpbn-a1'.$suffix.':'.$v[1].$type['unit'].';--wpbn-ad'.$suffix.':'.$seconds.'s;';
        }
        if ($o['anim_delay'] > 0) { $css .= 'animation-delay:'.$o['anim_delay'].'s;--wpbn-ald:'.$o['anim_delay'].'s;'; }
        if ($o['anim_easing'] !== 'ease-in-out') { $css .= 'animation-timing-function:'.$o['anim_easing'].';--wpbn-ale:'.$o['anim_easing'].';'; }
        if ($o['anim_repeat'] !== 'alternate') { $css .= '--wpbn-alc:'.($o['anim_repeat'] === 'once' ? '1' : 'infinite').';--wpbn-alr:normal;'; }
        if ($o['anim_type'] === 'zoom' && isset(self::ORIGIN_POINTS[$o['anim_origin']]) && $o['anim_origin'] !== 'center') {
            $css .= '--wpbn-fx:'.self::ORIGIN_POINTS[$o['anim_origin']][0].';--wpbn-fy:'.self::ORIGIN_POINTS[$o['anim_origin']][1].';';
        }
        return array('wpbn-shape-loop wpbn-anim wpbn-anim--'.$o['anim_type'].' wpbn-anim--'.$o['anim_repeat'].($o['fill'] === 'glass' ? ' wpbn-oloop--glass' : '').($o['anim_start'] === 'visible' ? ' wpbn-anim--visible' : ''), $css);
    }
    const BORDER_POSITIONS = array('inside', 'center', 'outside');
    const BORDER_STYLES = array('solid', 'dashed', 'dotted');
    const CORNERS = array('tl', 'tr', 'br', 'bl');
    // A value per device ($min to $max): desktop's always, tablet's and mobile's null where they follow the larger screen.
    private static function per_device($o, $key, $fallback, $max, $min = 0) {
        $out = array($key=>self::num($o[$key] ?? null, $fallback, $min, $max));
        foreach (array('tablet', 'mobile') as $device) {
            $v = $o[$key.'_'.$device] ?? null;
            $out[$key.'_'.$device] = is_scalar($v) && is_numeric($v) ? self::num($v, null, $min, $max) : null;
        }
        return $out;
    }
    // An object's value on a device: its own, or the larger screen's.
    private static function at($o, $key, $device) {
        $chain = array('desktop'=>array(''), 'tablet'=>array('_tablet', ''), 'mobile'=>array('_mobile', '_tablet', ''));
        foreach ($chain[$device] as $suffix) { if (isset($o[$key.$suffix])) { return (float) $o[$key.$suffix]; } }
        return 0.0;
    }
    private static function n($value) { return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.'); }

    // An object that is one rectangle (in groups that place it): its Radius can round its corners.
    const RECT = '#^((?:<g [^>]*>)*)<rect ([^>]*)/>((?:</g>)*)$#';
    /**
     * Its geometry on a device: a rectangle with Radius on as a path with those corners (as CSS, each at most half its
     * shorter side; % of that side), its place, transform and fill rule kept; anything else as it is.
     */
    public static function rounded($markup, $o, $device) {
        if (empty($o['use_radius']) || !preg_match(self::RECT, $markup, $m)) { return $markup; }
        preg_match_all('/([\w:-]+)="([^"]*)"/', $m[2], $pairs, PREG_SET_ORDER);
        $a = array();
        foreach ($pairs as $p) { $a[$p[1]] = $p[2]; }
        $x = (float) ($a['x'] ?? 0); $y = (float) ($a['y'] ?? 0); $w = (float) ($a['width'] ?? 0); $h = (float) ($a['height'] ?? 0);
        if ($w <= 0 || $h <= 0) { return $markup; }
        $side = min($w, $h);
        $r = array();
        foreach (self::CORNERS as $c) {
            $v = self::at($o, 'radius_'.$c, $device);
            if (($o['radius_'.$c.'_unit'] ?? 'px') === '%') { $v = $v / 100 * $side; }
            $r[$c] = self::n(max(0, min($side / 2, $v)));
        }
        $n = function ($v) { return self::n($v); };
        $d = 'M'.$n($x + $r['tl']).' '.$n($y).'H'.$n($x + $w - $r['tr']).'A'.$r['tr'].' '.$r['tr'].' 0 0 1 '.$n($x + $w).' '.$n($y + $r['tr'])
            .'V'.$n($y + $h - $r['br']).'A'.$r['br'].' '.$r['br'].' 0 0 1 '.$n($x + $w - $r['br']).' '.$n($y + $h)
            .'H'.$n($x + $r['bl']).'A'.$r['bl'].' '.$r['bl'].' 0 0 1 '.$n($x).' '.$n($y + $h - $r['bl'])
            .'V'.$n($y + $r['tl']).'A'.$r['tl'].' '.$r['tl'].' 0 0 1 '.$n($x + $r['tl']).' '.$n($y).'Z';
        $keep = '';
        foreach (array('transform', 'fill-rule', 'clip-rule') as $k) { if (isset($a[$k])) { $keep .= ' '.$k.'="'.$a[$k].'"'; } }
        return $m[1].'<path d="'.$d.'"'.$keep.'/>'.$m[3];
    }
    /**
     * Its Border on a device as SVG (black, for a mask; admin.js lineSvg() the same): a line along its outline, its width in
     * the drawing's px. Inside / Outside: twice as wide, the half outside (inside) the object hidden by a mask of it. '' for none.
     */
    public static function line($markup, $o, $device, $viewbox) {
        $w = self::at($o, 'border_width', $device);
        if (empty($o['use_border']) || $w <= 0) { return ''; }
        $position = $o['border_position'] ?? 'inside';
        $sw = $position === 'center' ? $w : $w * 2;
        $dash = '';
        if (($o['border_style'] ?? '') === 'dashed') { $dash = ' stroke-dasharray="'.self::n($w * 3).' '.self::n($w * 2).'"'; }
        elseif (($o['border_style'] ?? '') === 'dotted') { $dash = ' stroke-linecap="round" stroke-dasharray="0 '.self::n($sw * 2).'"'; }
        $stroke = '<g fill="none" stroke="#000" stroke-width="'.self::n($sw).'"'.$dash.'>'.$markup.'</g>';
        if ($position === 'center') { return $stroke; }
        $area = 'x="'.self::n($viewbox[0] - $sw).'" y="'.self::n($viewbox[1] - $sw).'" width="'.self::n($viewbox[2] + $sw * 2).'" height="'.self::n($viewbox[3] + $sw * 2).'"';
        $mask = $position === 'inside' ? '<g fill="#fff">'.$markup.'</g>' : '<rect '.$area.' fill="#fff"/><g fill="#000">'.$markup.'</g>';
        return '<mask id="b" maskUnits="userSpaceOnUse" '.$area.'>'.$mask.'</mask><g mask="url(#b)">'.$stroke.'</g>';
    }
    // CSS variables per device: desktop's, then tablet's and mobile's where they differ from the larger screen's (frontend.css).
    private static function device_vars($name, $values) {
        $css = $name.':'.$values['desktop'].';';
        if ($values['tablet'] !== $values['desktop']) { $css .= $name.'-t:'.$values['tablet'].';'; }
        if ($values['mobile'] !== $values['tablet']) { $css .= $name.'-m:'.$values['mobile'].';'; }
        return $css;
    }

    /**
     * A layer's objects as kept (WPBN_Settings::sanitize()), the back one first, as the scene's layers. Only the
     * file's own objects, each once; ones the layer does not list yet are added at the front.
     */
    public static function objects($id, $raw) {
        $meta = self::meta($id);
        if (!$meta) { return array(); }
        $names = array();
        foreach ($meta['objects'] as $o) { $names[$o['key']] = $o['name']; }
        $out = array();
        foreach (is_array($raw) ? $raw : array() as $o) {
            $key = is_array($o) && is_string($o['key'] ?? null) ? $o['key'] : '';
            if (!isset($names[$key]) || isset($out[$key])) { continue; }
            $out[$key] = self::object($o, $names[$key]);
        }
        foreach ($names as $key=>$name) { if (!isset($out[$key])) { $out[$key] = self::object(array('key'=>$key), $name); } }
        return array_values($out);
    }
    // One object's settings, checked.
    private static function object($o, $file_name) {
        $d = self::object_defaults();
        $name = is_string($o['name'] ?? null) ? mb_substr(sanitize_text_field($o['name']), 0, 80) : '';
        $out = array('key'=>$o['key'], 'name'=>$name !== '' ? $name : $file_name, 'hidden'=>!empty($o['hidden']));
        $out['fill'] = in_array($o['fill'] ?? null, self::FILLS, true) ? $o['fill'] : $d['fill'];
        $out['source'] = is_string($o['source'] ?? null) && preg_match('/^[a-z0-9]{4,16}$/', $o['source']) ? $o['source'] : '';
        $out['image'] = is_scalar($o['image'] ?? null) ? absint($o['image']) : 0;
        $out['color'] = WPBN_Settings::color($o['color'] ?? null, $d['color']);
        $out['use_gradient'] = !empty($o['use_gradient']);
        $out['gradient'] = WPBN_Gradient::sanitize($o['gradient'] ?? null);
        $out['glass_blur'] = self::num($o['glass_blur'] ?? null, $d['glass_blur'], 0, 60);
        $out['glass_color'] = WPBN_Settings::color($o['glass_color'] ?? null, $d['glass_color']);
        $out['opacity'] = self::num($o['opacity'] ?? null, $d['opacity'], 0, 100);
        $out['invert'] = !empty($o['invert']);
        // Saved with an Edge (before 2026-11-10): a Border as wide, Outside, as the Edge was.
        if (!array_key_exists('use_border', $o) && is_scalar($o['stroke'] ?? null) && (float) $o['stroke'] > 0) {
            $o = array_merge($o, array('use_border'=>true, 'border_width'=>$o['stroke'], 'border_position'=>'outside', 'border_color'=>$o['stroke_color'] ?? $d['border_color']));
        }
        $out['use_border'] = !empty($o['use_border']);
        $out += self::per_device($o, 'border_width', $d['border_width'], 100);
        $out['border_position'] = in_array($o['border_position'] ?? null, self::BORDER_POSITIONS, true) ? $o['border_position'] : $d['border_position'];
        $out['border_style'] = in_array($o['border_style'] ?? null, self::BORDER_STYLES, true) ? $o['border_style'] : $d['border_style'];
        $out['border_color'] = WPBN_Settings::color($o['border_color'] ?? null, $d['border_color']);
        $out['use_radius'] = !empty($o['use_radius']);
        $out['radius_linked'] = array_key_exists('radius_linked', $o) ? !empty($o['radius_linked']) : true;
        foreach (self::CORNERS as $c) {
            $unit = ($o['radius_'.$c.'_unit'] ?? null) === '%' ? '%' : 'px';
            $out += self::per_device($o, 'radius_'.$c, $d['radius_'.$c], $unit === '%' ? 50 : 1000);
            $out['radius_'.$c.'_unit'] = $unit;
        }
        $out['use_shadow'] = !empty($o['use_shadow']);
        $out['shadow_color'] = WPBN_Settings::color($o['shadow_color'] ?? null, $d['shadow_color']);
        foreach (array('shadow_x'=>array(-100, 100), 'shadow_y'=>array(-100, 100), 'shadow_blur'=>array(0, 200), 'move_x'=>array(-1000, 1000), 'move_y'=>array(-1000, 1000)) as $key=>$range) {
            $out[$key] = self::num($o[$key] ?? null, $d[$key], $range[0], $range[1]);
        }
        // Scroll animation: no switch since 2026-11-09 (user's request), always on; saved with it off: no travel (it stays as it was).
        if (array_key_exists('use_scroll', $o) && empty($o['use_scroll'])) { $out['move_x'] = 0; $out['move_y'] = 0; }
        $out['use_scroll'] = true;
        $box = is_array($o['box'] ?? null) ? array_values($o['box']) : array();
        $out['box'] = count($box) === 4 && count(array_filter($box, 'is_numeric')) === 4 && $box[2] > 0 && $box[3] > 0 ? array_map(function ($v) { return round((float) $v, 2); }, $box) : array();
        // Entrance animation (2026-11-10, user's request): a layer's settings, its own kinds (ENTER).
        $enter = WPBN_Entrance::sanitize($o, array());
        $enter['enter_type'] = isset(self::ENTER[$o['enter_type'] ?? '']) ? $o['enter_type'] : 'fade';
        // Loop animation (2026-11-10, user's request): a layer's kinds and settings.
        $loop = WPBN_Animation::sanitize($o, array());
        foreach (array('anim_from'=>WPBN_Animation::RANGE, 'anim_to'=>WPBN_Animation::RANGE, 'anim_duration'=>WPBN_Animation::DURATION) as $key=>$range) {
            $loop += self::per_device($o, $key, $d[$key], $range[1], $range[0]);
        }
        return $out + $enter + $loop + WPBN_Settings::filters($o);
    }

    /*
     * On the page (WPBN_Render): the layer covers the scene; each object is a box as large, its fill clipped to the
     * object's shape by a CSS mask (the object alone, as an SVG): every object sized and placed alike (the layer's Fit),
     * so they stay where the drawing has them and a copy of a layer inside lines up with that layer. Its travel moves
     * the mask (the window), not what is seen through it (frontend.js --wpbn-ox, --wpbn-oy).
     */
    /*
     * The layer's Fit per device as CSS variables (frontend.css): the drawing's box in the scene, as lengths, so the whole
     * Shape's Zoom can scale it (2026-11-10): its width and height (--wpbn-dw, --wpbn-dh) and its top left corner (--wpbn-dl,
     * --wpbn-dt), each with -t, -m. cqw / cqh: shares of the layer, the scene. Cover / Contain: as large as the scene's larger
     * / smaller side needs, centred; Stretch: the scene; Custom size: its own, its middle at the layer's Position.
     * fit_data(): the same for frontend.js boxes().
     */
    public static function fit_css($l) {
        $css = '';
        $meta = self::meta($l['shape']);
        $area = $meta ? self::area($l, $meta) : array(0, 0, 1, 1);
        $ratio = $area[2] / $area[3];
        $sizes = WPBN_Settings::resolved($l, 'shape_size');
        $where = $l['shape_place'] ?? array('x'=>array('desktop'=>50, 'tablet'=>50, 'mobile'=>50), 'y'=>array('desktop'=>50, 'tablet'=>50, 'mobile'=>50));
        foreach (WPBN_Settings::resolved($l, 'shape_fit') as $device=>$fit) {
            $suffix = WPBN_Render::SUFFIX[$device];
            if ($fit === 'custom') {
                $size = (float) $sizes[$device];
                // [width, height] as numbers in one unit: px, or cqw / cqh (% of the scene's width or height).
                if ($l['shape_size_by'] === 'width') { $unit = $l['shape_size_unit'] === '%' ? 'cqw' : 'px'; $wh = array($size, $size / $ratio); }
                else { $unit = $l['shape_size_unit'] === '%' ? 'cqh' : 'px'; $wh = array($size * $ratio, $size); }
                $box = array(self::n($wh[0]).$unit, self::n($wh[1]).$unit,
                    'calc('.self::n($where['x'][$device]).'cqw - '.self::n($wh[0] / 2).$unit.')', 'calc('.self::n($where['y'][$device]).'cqh - '.self::n($wh[1] / 2).$unit.')');
            } elseif ($fit === 'stretch') {
                $box = array('100cqw', '100cqh', '0px', '0px');
            } else {
                $f = $fit === 'contain' ? 'min' : 'max';
                $w = $f.'(100cqw, '.self::n(100 * $ratio).'cqh)'; $h = $f.'(100cqh, '.self::n(100 / $ratio).'cqw)';
                $box = array($w, $h, 'calc((100cqw - '.$w.') / 2)', 'calc((100cqh - '.$h.') / 2)');
            }
            foreach (array('dw', 'dh', 'dl', 'dt') as $i=>$name) { $css .= '--wpbn-'.$name.$suffix.':'.$box[$i].';'; }
        }
        return $css;
    }
    // How the drawing is fitted per device, for frontend.js: [fit, x, y, size, unit, by] each.
    public static function fit_data($l) {
        $out = array();
        $sizes = WPBN_Settings::resolved($l, 'shape_size');
        foreach (WPBN_Settings::resolved($l, 'shape_fit') as $device=>$fit) {
            $out[] = $fit === 'custom' ? array('custom', (float) $l['shape_place']['x'][$device], (float) $l['shape_place']['y'][$device], (float) $sizes[$device], $l['shape_size_unit'], $l['shape_size_by']) : array($fit);
        }
        return $out;
    }
    /**
     * The drawing's area [x, y, w, h]: its viewBox or, with Trim empty space, its objects' box (as the editor measured them),
     * with room for a line outside their edges. The viewBox where an object has no box yet.
     */
    public static function area($l, $meta) {
        $viewbox = array_map('floatval', $meta['viewbox']);
        if (empty($l['shape_trim'])) { return $viewbox; }
        $x0 = INF; $y0 = INF; $x1 = -INF; $y1 = -INF; $room = 0;
        foreach ($l['shape_objects'] as $o) {
            if (empty($o['box'])) { return $viewbox; }
            list($x, $y, $w, $h) = $o['box'];
            $x0 = min($x0, $x); $y0 = min($y0, $y); $x1 = max($x1, $x + $w); $y1 = max($y1, $y + $h);
            if (!empty($o['use_border'])) {
                $width = max(self::at($o, 'border_width', 'desktop'), self::at($o, 'border_width', 'tablet'), self::at($o, 'border_width', 'mobile'));
                $room = max($room, ($o['border_position'] ?? '') === 'outside' ? $width : (($o['border_position'] ?? '') === 'center' ? $width / 2 : 0));
            }
        }
        if ($x1 <= $x0 || $y1 <= $y0) { return $viewbox; }
        $room += 1;
        return array(round($x0 - $room, 2), round($y0 - $room, 2), round($x1 - $x0 + $room * 2, 2), round($y1 - $y0 + $room * 2, 2));
    }
    // One object as a CSS mask: url("data:image/svg+xml,…") of the drawing's area with the object alone, black.
    // Not kept to its proportions inside its box (Stretch); Cover and Contain give it a box of its proportions anyway.
    public static function mask($viewbox, $markup) {
        $box = implode(' ', array_map('floatval', $viewbox));
        $svg = "<svg xmlns='".self::NS."' width='".(float) $viewbox[2]."' height='".(float) $viewbox[3]."' viewBox='".$box."' preserveAspectRatio='none'>".str_replace('"', "'", $markup).'</svg>';
        return 'url("data:image/svg+xml,'.strtr($svg, array('%'=>'%25', '<'=>'%3C', '>'=>'%3E', '#'=>'%23', '"'=>'%22')).'")';
    }
    // The layer's objects (WPBN_Render::layer()): hidden ones left out, the back one first.
    public static function inner($s, $l, $context, &$state) {
        $meta = self::meta($l['shape']);
        if (!$meta) { return ''; }
        // The drawing's area: its viewBox, or trimmed to its objects.
        $meta['viewbox'] = self::area($l, $meta);
        $markup = array();
        foreach ($meta['objects'] as $o) { $markup[$o['key']] = $o['markup']; }
        // The image layers others can show, by their uid.
        $sources = array();
        foreach ($s['layers'] as $other) { if ($other['type'] === 'image' && $other['uid'] !== '') { $sources[$other['uid']] = $other; } }
        $html = '';
        foreach ($l['shape_objects'] as $o) {
            if ($o['hidden'] || !isset($markup[$o['key']])) { continue; }
            $content = '';
            $clip = '';
            // A colour or gradient: on the box inside, as a picture is (moved back as the window moves, so it stays in place).
            $paint = '';
            $filters = array_intersect_key($o, array_flip(WPBN_Settings::filter_keys()));
            if ($o['fill'] === 'layer' && isset($sources[$o['source']])) {
                // The layer as it is drawn (its place, size, motion), with the object's filters instead of its own, its
                // shadow left to it; drawn even while it is hidden itself (a photo seen only through the objects).
                $copy = array_merge($sources[$o['source']], $filters, array('use_shadow'=>false, 'hidden'=>false, 'copy'=>true));
                $content = WPBN_Render::layer($s, $copy, 0, $context, $state);
            } elseif ($o['fill'] === 'image' && $o['image']) {
                $url = wp_get_attachment_image_url($o['image'], 'full');
                if ($url) {
                    $srcset = wp_get_attachment_image_srcset($o['image'], 'full');
                    // Its Filters per device (frontend.css .wpbn-shape-img--filter).
                    $filter = WPBN_Settings::filter_vars($o, '--wpbn-filter');
                    $content = '<img class="wpbn-shape-img'.($filter !== '' ? ' wpbn-shape-img--filter' : '').'" src="'.esc_url($url).'" alt=""'.($srcset ? ' srcset="'.esc_attr($srcset).'" sizes="100vw"' : '')
                        .' decoding="async" loading="'.($state['first'] ? 'eager' : 'lazy').'"'.($filter !== '' ? ' style="'.esc_attr($filter).'"' : '').'>';
                }
            } elseif ($o['fill'] === 'color') {
                $gradient = $o['use_gradient'] ? WPBN_Gradient::css($o['gradient']) : '';
                $paint = 'background:'.($gradient !== '' ? $gradient : $o['color']).';';
            } elseif ($o['fill'] === 'glass') {
                // Its blur and tint as variables too: its animations bring them in (frontend.css wpbn-oe-glass, wpbn-ol-glass).
                $clip .= 'background:'.$o['glass_color'].';-webkit-backdrop-filter:blur('.$o['glass_blur'].'px);backdrop-filter:blur('.$o['glass_blur'].'px);--wpbn-gb:'.$o['glass_blur'].'px;--wpbn-gc:'.$o['glass_color'].';';
            }
            // Its Opacity: with the whole Shape's fades, on its fill itself (frontend.css; glass keeps its blur).
            if ($o['opacity'] < 100) { $clip .= '--wpbn-oo:'.($o['opacity'] / 100).';'; }
            // Its shape per device (a rectangle's Radius) as its mask, and its Border: a box of its colour masked by the line,
            // sized and moved as the fill's (on glass too: no filter around it).
            $fills = array(); $lines = array();
            foreach (array('desktop', 'tablet', 'mobile') as $device) {
                $geometry = self::rounded($markup[$o['key']], $o, $device);
                $fills[$device] = self::mask($meta['viewbox'], $geometry);
                $line = self::line($geometry, $o, $device, $meta['viewbox']);
                $lines[$device] = $line === '' ? '' : self::mask($meta['viewbox'], $line);
            }
            $item = self::device_vars('--wpbn-mask', $fills);
            $border = '';
            if (array_filter($lines)) {
                foreach ($lines as $device=>$line) { if ($line === '') { $lines[$device] = 'linear-gradient(transparent,transparent)'; } }
                $item .= self::device_vars('--wpbn-line', $lines);
                $border = '<div class="wpbn-shape-line" style="'.esc_attr('background:'.$o['border_color']).'"></div>';
            }
            // Its shadow, along its outline (and its Border). Not on glass: a filter around it would leave the glass nothing behind it to blur.
            if ($o['fill'] !== 'glass' && $o['use_shadow']) { $item .= 'filter:drop-shadow('.$o['shadow_x'].'px '.$o['shadow_y'].'px '.$o['shadow_blur'].'px '.$o['shadow_color'].');'; }
            $move = $o['use_scroll'] && ($o['move_x'] || $o['move_y']) ? ' data-move="'.esc_attr(wp_json_encode(array('x'=>$o['move_x'], 'y'=>$o['move_y']))).'"' : '';
            list($enter_class, $enter_css, $boxed) = self::entrance($o, $meta['viewbox']);
            list($loop_class, $loop_css) = self::loop($o);
            $item .= $enter_css;
            // Its box for frontend.js (boxes()): where a Reveal or a Zoom plays.
            $attrs = $o['box'] && ($boxed || ($loop_class !== '' && $o['anim_type'] === 'zoom')) ? ' data-box="'.esc_attr(implode(' ', $o['box'])).'" data-vb="'.esc_attr(implode(' ', array_map('floatval', $meta['viewbox']))).'"' : '';
            // What it shows in a box of its own (.wpbn-shape-fill: frontend.css moves it back as the window moves).
            $fill = $content !== '' || $paint !== '' ? '<div class="wpbn-shape-fill"'.($paint !== '' ? ' style="'.esc_attr($paint).'"' : '').'>'.$content.'</div>' : '';
            $inner = '<div class="wpbn-shape-clip'.($o['invert'] ? ' wpbn-shape-clip--invert' : '').'"'.($clip !== '' ? ' style="'.esc_attr($clip).'"' : '').'>'.$fill.'</div>'.$border;
            if ($loop_class !== '') { $inner = '<div class="'.$loop_class.'" style="'.esc_attr($loop_css).'">'.$inner.'</div>'; }
            $html .= '<div class="wpbn-shape-item'.$enter_class.'" style="'.esc_attr($item).'"'.$move.$attrs.'>'.$inner.'</div>';
        }
        // The whole Shape's Loop animation around its objects, its Entrance animation around that.
        foreach (array(self::layer_loop($l), self::layer_entrance($l)) as $wrap) {
            if ($wrap[0] !== '') { $html = '<div class="'.esc_attr($wrap[0]).'"'.($wrap[1] !== '' ? ' style="'.esc_attr($wrap[1]).'"' : '').'>'.$html.'</div>'; }
        }
        return $html;
    }
    /*
     * The whole Shape's Entrance animation (2026-11-10, user's request): its objects' kinds (ENTER) and the layer's enter_*
     * settings, on a box around all its objects (.wpbn-shape-in) that moves nothing itself: it animates values its objects'
     * masks and fills read (frontend.css --wpbn-sea opacity, --wpbn-sex / -sey the windows' offset, --wpbn-sez their scale,
     * --wpbn-sev a Reveal across the drawing's box). So what is seen through them stays in place and glass keeps its blur.
     * [class, css]; none without one.
     */
    public static function layer_entrance($l) {
        if (empty($l['use_enter']) || !isset(self::ENTER[$l['enter_type']])) { return array('', ''); }
        list($kind, $side) = self::ENTER[$l['enter_type']];
        $css = 'animation-duration:'.$l['enter_duration'].'s;'.($l['enter_delay'] > 0 ? 'animation-delay:'.$l['enter_delay'].'s;' : '').($l['enter_easing'] !== 'ease-out' ? 'animation-timing-function:'.$l['enter_easing'].';' : '');
        if ($side) { $css .= '--wpbn-sx0:'.($side[0] * $l['enter_distance']).'px;--wpbn-sy0:'.($side[1] * $l['enter_distance']).'px;'; }
        if ($kind === 'zoom') { $css .= '--wpbn-ss0:'.round($l['enter_scale'] / 100, 3).';'; }
        $name = strpos($kind, 'reveal') === 0 ? 'reveal wpbn-shape-in--'.$kind : $kind;
        return array('wpbn-shape-in wpbn-shape-in--'.$name.($l['enter_start'] === 'visible' ? ' wpbn-shape-in--visible' : ''), $css);
    }
    /*
     * The whole Shape's Loop animation (2026-11-10, user's request): a layer's (WPBN_Animation::wrapper(), its values per
     * device), on a box around all its objects (.wpbn-shape-all) that animates values they read: Zoom their windows' scale
     * around a point of the drawing (Direction: --wpbn-fx0, -fy0), Fade their fills' opacity, Slide their windows' offset.
     */
    public static function layer_loop($l) {
        if (!WPBN_Animation::active($l)) { return array('', ''); }
        list($class, $css) = WPBN_Animation::wrapper($l);
        $css = preg_replace('/transform-origin:[^;]*;/', '', $css);
        if ($l['anim_type'] === 'zoom' && isset(self::ORIGIN_POINTS[$l['anim_origin']]) && $l['anim_origin'] !== 'center') {
            $css .= '--wpbn-fx0:'.self::ORIGIN_POINTS[$l['anim_origin']][0].';--wpbn-fy0:'.self::ORIGIN_POINTS[$l['anim_origin']][1].';';
        }
        return array('wpbn-shape-all '.$class, $css);
    }

    /**
     * An SVG's objects: array('viewbox', 'objects', 'skipped') as META keeps them, or a WP_Error. No DOCTYPE (no
     * entities: nothing read from elsewhere, no "billion laughs"), no network.
     * $exported: an SVG this class wrote (svg(), a scene's export file): each <g data-key> is one object, its key kept
     * (the scene's objects point to it), checked as any other SVG.
     */
    public static function parse($source, $exported = false) {
        if (!class_exists('DOMDocument')) { return new WP_Error('wpbn_shape', __('This server cannot read SVG files (PHP\'s DOM extension is missing).', 'wp-banner')); }
        $source = (string) $source;
        if (preg_match('/<!DOCTYPE|<!ENTITY/i', $source)) { return new WP_Error('wpbn_shape', __('This SVG has a DOCTYPE, which is not accepted. Export it again without one.', 'wp-banner')); }
        $doc = new DOMDocument();
        $errors = libxml_use_internal_errors(true);
        $loaded = $doc->loadXML($source, LIBXML_NONET | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($errors);
        $root = $loaded ? $doc->documentElement : null;
        if (!$root || $root->localName !== 'svg') { return new WP_Error('wpbn_shape', __('This is not an SVG file.', 'wp-banner')); }
        $viewbox = self::viewbox($root);
        if (!$viewbox) { return new WP_Error('wpbn_shape', __('The SVG has no size: give it a viewBox (or a width and a height).', 'wp-banner')); }
        $rules = self::class_rules($doc);
        $skipped = array();
        // Groups around everything (an Illustrator layer): their objects are the drawing's; their transforms kept around each.
        $items = self::items($root, $rules);
        $wrap = array();
        while (!$exported && count($items) === 1 && $items[0]->localName === 'g') {
            $transform = self::transform($items[0]);
            if ($transform === null) { return new WP_Error('wpbn_shape', __('The SVG\'s main group has a transform that cannot be read. Export it again.', 'wp-banner')); }
            if ($transform !== '') { $wrap[] = $transform; }
            $items = self::items($items[0], $rules);
        }
        $objects = array();
        foreach ($items as $el) {
            $markup = self::clean($el, $rules, $skipped);
            if ($markup === '') { continue; }
            foreach (array_reverse($wrap) as $transform) { $markup = '<g transform="'.esc_attr($transform).'">'.$markup.'</g>'; }
            $key = $exported && preg_match('/^o\d{1,3}$/', $el->getAttribute('data-key')) ? $el->getAttribute('data-key') : 'o'.(count($objects) + 1);
            if (in_array($key, array_column($objects, 'key'), true)) { continue; }
            $objects[] = array('key'=>$key, 'name'=>self::label($el), 'markup'=>$markup);
            if (count($objects) >= self::MAX_OBJECTS) { break; }
        }
        if (!$objects) { return new WP_Error('wpbn_shape', __('No shapes were found in this SVG. Turn text into outlines and embed no pictures.', 'wp-banner')); }
        return array('viewbox'=>$viewbox, 'objects'=>$objects, 'skipped'=>$skipped);
    }

    // The drawing's area [x, y, w, h]: its viewBox, or its width and height; null without one.
    private static function viewbox($root) {
        $parts = preg_split('/[\s,]+/', trim($root->getAttribute('viewBox')));
        if (count($parts) === 4 && count(array_filter($parts, 'is_numeric')) === 4 && $parts[2] > 0 && $parts[3] > 0) { return array_map('floatval', $parts); }
        $w = self::number($root->getAttribute('width'));
        $h = self::number($root->getAttribute('height'));
        return $w !== null && $h !== null && $w > 0 && $h > 0 ? array(0.0, 0.0, $w, $h) : null;
    }

    // From the file's <style> rules, per class: fill-rule, clip-rule and display:none (Illustrator puts them there).
    private static function class_rules($doc) {
        $rules = array();
        foreach ($doc->getElementsByTagName('style') as $style) {
            if (!preg_match_all('/([^{}]+)\{([^{}]*)\}/', $style->textContent, $blocks, PREG_SET_ORDER)) { continue; }
            foreach ($blocks as $block) {
                $props = self::props($block[2]);
                if (!$props) { continue; }
                foreach (preg_split('/\s*,\s*/', trim($block[1])) as $selector) {
                    if (preg_match('/^\.([\w-]+)$/', $selector, $m)) { $rules[$m[1]] = array_merge($rules[$m[1]] ?? array(), $props); }
                }
            }
        }
        return $rules;
    }

    // The properties that matter here from a style text: fill-rule, clip-rule, display:none.
    private static function props($css) {
        $props = array();
        foreach (array('fill-rule', 'clip-rule') as $name) {
            if (preg_match('/(?:^|;)\s*'.$name.'\s*:\s*(evenodd|nonzero)/i', $css, $m)) { $props[$name] = strtolower($m[1]); }
        }
        if (preg_match('/(?:^|;)\s*display\s*:\s*none/i', $css)) { $props['display'] = 'none'; }
        return $props;
    }

    // An element's own properties: its attributes, its style, then its classes' rules (the first found wins).
    private static function prop($el, $rules, $name) {
        $value = strtolower(trim($el->getAttribute($name)));
        if ($value !== '') { return $value; }
        $style = self::props($el->getAttribute('style'));
        if (isset($style[$name])) { return $style[$name]; }
        foreach (preg_split('/\s+/', trim($el->getAttribute('class'))) as $class) {
            if (isset($rules[$class][$name])) { return $rules[$class][$name]; }
        }
        return '';
    }

    // An element's children that draw (SVG elements, not hidden, nothing SILENT).
    private static function items($parent, $rules) {
        $items = array();
        foreach ($parent->childNodes as $node) {
            if ($node->nodeType !== XML_ELEMENT_NODE || ($node->namespaceURI !== null && $node->namespaceURI !== self::NS)) { continue; }
            if (in_array($node->localName, self::SILENT, true) || self::prop($node, $rules, 'display') === 'none') { continue; }
            $items[] = $node;
        }
        return $items;
    }

    // An element as clean markup (only its geometry); '' for what holds none. What is left out is counted in $skipped.
    private static function clean($el, $rules, &$skipped) {
        $tag = $el->localName;
        if ($tag === 'g') {
            $inner = '';
            foreach (self::items($el, $rules) as $child) { $inner .= self::clean($child, $rules, $skipped); }
            if ($inner === '') { return ''; }
            $transform = self::transform($el);
            if ($transform === null) { $skipped['other'] = ($skipped['other'] ?? 0) + 1; return ''; }
            return $transform !== '' ? '<g transform="'.esc_attr($transform).'">'.$inner.'</g>' : $inner;
        }
        if (!isset(self::SHAPES[$tag])) {
            $kind = self::SKIPPED[$tag] ?? 'other';
            $skipped[$kind] = ($skipped[$kind] ?? 0) + 1;
            return '';
        }
        // A shape this cannot read (a value that is not geometry, a transform of something else): left out and
        // counted, rather than drawn somewhere else than it was.
        $unreadable = function () use (&$skipped) { $skipped['other'] = ($skipped['other'] ?? 0) + 1; return ''; };
        $attrs = array();
        foreach (self::SHAPES[$tag] as $name) {
            $value = trim($el->getAttribute($name));
            if ($value === '') { continue; }
            if ($name === 'd') {
                if (!preg_match('/^[MmZzLlHhVvCcSsQqTtAa\d\s,.eE+\-]+$/', $value) || !preg_match('/\d/', $value)) { return $unreadable(); }
            } elseif ($name === 'points') {
                if (!preg_match('/^[\d\s,.eE+\-]+$/', $value)) { return $unreadable(); }
            } else {
                $number = self::number($value);
                if ($number === null) { return $unreadable(); }
                $value = (string) $number;
            }
            $attrs[$name] = preg_replace('/\s+/', ' ', $value);
        }
        // Nothing to draw: no path, an empty rectangle or circle.
        $needed = array('rect'=>array('width', 'height'), 'circle'=>array('r'), 'ellipse'=>array('rx', 'ry'), 'polygon'=>array('points'), 'polyline'=>array('points'), 'path'=>array('d'));
        foreach ($needed[$tag] as $name) { if (!isset($attrs[$name]) || (is_numeric($attrs[$name]) && (float) $attrs[$name] <= 0)) { return ''; } }
        $transform = self::transform($el);
        if ($transform === null) { return $unreadable(); }
        if ($transform !== '') { $attrs['transform'] = $transform; }
        // Holes (a ring, the letter O): evenodd. A clip path follows clip-rule, a drawing fill-rule: both, from either.
        $rule = self::prop($el, $rules, 'fill-rule') ?: self::prop($el, $rules, 'clip-rule');
        if ($rule === 'evenodd') { $attrs['fill-rule'] = $rule; $attrs['clip-rule'] = $rule; }
        $out = '<'.$tag;
        foreach ($attrs as $name=>$value) { $out .= ' '.$name.'="'.esc_attr($value).'"'; }
        return $out.'/>';
    }

    // A transform made only of SVG's functions with numbers in them; '' for none, null for one that is something else.
    private static function transform($el) {
        $value = trim(preg_replace('/\s+/', ' ', $el->getAttribute('transform')));
        if ($value === '') { return ''; }
        return preg_match('/^((matrix|translate|scale|rotate|skewX|skewY)\s*\([\d\s,.eE+\-]*\)[\s,]*)+$/', $value) ? $value : null;
    }

    // A length as a number (px dropped); null if it is not one (%, em…).
    private static function number($value) {
        $value = trim((string) $value);
        return preg_match('/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(px)?$/i', $value) ? (float) $value : null;
    }

    // An object's name from the drawing program: its data-name (Illustrator's, as typed), or its id (Illustrator
    // writes "_x31_" for a character an id cannot have, "_" for a space); '' without one.
    private static function label($el) {
        $name = $el->getAttribute('data-name');
        if ($name === '') {
            $name = preg_replace_callback('/_x([0-9a-f]{2})_/i', function ($m) { $c = hexdec($m[1]); return $c >= 32 && $c < 127 ? chr($c) : ''; }, $el->getAttribute('id'));
            $name = str_replace('_', ' ', $name);
        }
        return mb_substr(trim(sanitize_text_field($name)), 0, 80);
    }
}
