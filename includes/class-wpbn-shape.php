<?php
/**
 * A Shape layer's SVG (WPBN_Settings type "shape"): a file of several objects (rectangles, paths…) whose shapes
 * become windows onto the layers' contents. An SVG may carry scripts, so it is never kept as it was sent: its
 * shapes' geometry is read out (parse()) and a new SVG is written from it alone (no colours, styles, links or
 * scripts), kept as an attachment (image/svg+xml) with its objects in META.
 *
 * Objects: the top-level elements of the drawing (a shape, or a group of shapes as one object); a single group
 * around everything (an Illustrator layer) is looked into. Text, embedded images, <use> and lines are left out
 * and named in "skipped", so the editor can say why.
 */
defined('ABSPATH') || exit;
class WPBN_Shape {
    // The attachment's objects: array('viewbox'=>[x, y, w, h], 'objects'=>[['key'=>'o1', 'name'=>'', 'markup'=>'<path…/>']], 'skipped'=>[kind=>count]).
    const META = '_wpbn_shape';
    const MIME = 'image/svg+xml';
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
        add_action('wp_ajax_'.self::AJAX, array(__CLASS__, 'upload'));
    }

    // An SVG uploaded in the Shape layer's card: checked, rewritten and kept; its editor data (editor()) back.
    public static function upload() {
        check_ajax_referer(self::AJAX, 'nonce');
        if (!current_user_can('manage_options') || !current_user_can('upload_files')) { wp_send_json_error(array('message'=>__('You cannot upload shapes.', 'wp-banner')), 403); }
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

    // The rewritten SVG as a file in the uploads folder and an attachment; its id (or a WP_Error). Also an imported scene's (WPBN_Tools).
    public static function store($name, $parsed) {
        $name = ($name !== '' ? $name : 'shape').'.svg';
        // Only this file, which parse() wrote: SVG is not an upload WordPress takes otherwise.
        $allow = function ($mimes) { $mimes['svg'] = self::MIME; return $mimes; };
        add_filter('upload_mimes', $allow);
        $upload = wp_upload_bits($name, null, self::svg($parsed));
        remove_filter('upload_mimes', $allow);
        if (!empty($upload['error'])) { return new WP_Error('wpbn_shape', (string) $upload['error']); }
        $id = wp_insert_attachment(array('post_mime_type'=>self::MIME, 'post_title'=>sanitize_text_field(wp_basename($name, '.svg')), 'post_content'=>'', 'post_status'=>'inherit'), $upload['file'], 0, true);
        if (is_wp_error($id)) { return $id; }
        update_post_meta($id, self::META, wp_slash($parsed));
        return (int) $id;
    }

    // A shape attachment's objects (META), or null.
    public static function meta($id) {
        $id = absint($id);
        if (!$id || get_post_mime_type($id) !== self::MIME) { return null; }
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
        $file = get_attached_file($id);
        return array('id'=>(int) $id, 'name'=>$file ? wp_basename($file) : '', 'viewbox'=>array_map('floatval', $meta['viewbox']), 'defaults'=>self::object_defaults(),
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
            'glass_blur'=>12, 'glass_color'=>'rgba(255,255,255,0.15)', 'opacity'=>100, 'invert'=>false, 'stroke'=>0, 'stroke_color'=>'#ffffff',
            'use_shadow'=>false, 'shadow_color'=>'rgba(0,0,0,0.5)', 'shadow_x'=>0, 'shadow_y'=>10, 'shadow_blur'=>25, 'move_x'=>0, 'move_y'=>0)
            + array_map(function ($f) { return $f[2]; }, WPBN_Settings::FILTERS);
    }
    private static function num($value, $fallback, $min, $max) {
        return is_scalar($value) && is_numeric($value) ? round(max($min, min($max, (float) $value)), 1) : $fallback;
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
        $out['stroke'] = self::num($o['stroke'] ?? null, $d['stroke'], 0, 30);
        $out['stroke_color'] = WPBN_Settings::color($o['stroke_color'] ?? null, $d['stroke_color']);
        $out['use_shadow'] = !empty($o['use_shadow']);
        $out['shadow_color'] = WPBN_Settings::color($o['shadow_color'] ?? null, $d['shadow_color']);
        foreach (array('shadow_x'=>array(-100, 100), 'shadow_y'=>array(-100, 100), 'shadow_blur'=>array(0, 200), 'move_x'=>array(-1000, 1000), 'move_y'=>array(-1000, 1000)) as $key=>$range) {
            $out[$key] = self::num($o[$key] ?? null, $d[$key], $range[0], $range[1]);
        }
        return $out + WPBN_Settings::filters($o);
    }

    /*
     * On the page (WPBN_Render): the layer covers the scene; each object is a box as large, its fill clipped to the
     * object's shape by a CSS mask (the object alone, as an SVG): every object sized and placed alike (the layer's Fit),
     * so they stay where the drawing has them and a copy of a layer inside lines up with that layer. Its travel moves
     * the mask (the window), not what is seen through it (frontend.js --wpbn-ox, --wpbn-oy).
     */
    const MASK_SIZES = array('cover'=>'cover', 'contain'=>'contain', 'stretch'=>'100% 100%');
    // The layer's Fit per device as CSS variables (frontend.css --wpbn-ms, -t, -m).
    public static function fit_css($l) {
        $css = '';
        foreach (WPBN_Settings::resolved($l, 'shape_fit') as $device=>$fit) { $css .= '--wpbn-ms'.WPBN_Render::SUFFIX[$device].':'.(self::MASK_SIZES[$fit] ?? 'cover').';'; }
        return $css;
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
            $filters = array_intersect_key($o, WPBN_Settings::FILTERS);
            if ($o['fill'] === 'layer' && isset($sources[$o['source']])) {
                // The layer as it is drawn (its place, size, motion), with the object's filters instead of its own, its
                // shadow left to it; drawn even while it is hidden itself (a photo seen only through the objects).
                $copy = array_merge($sources[$o['source']], $filters, array('use_shadow'=>false, 'hidden'=>false, 'copy'=>true));
                $content = WPBN_Render::layer($s, $copy, 0, $context, $state);
            } elseif ($o['fill'] === 'image' && $o['image']) {
                $url = wp_get_attachment_image_url($o['image'], 'full');
                if ($url) {
                    $srcset = wp_get_attachment_image_srcset($o['image'], 'full');
                    $filter = WPBN_Settings::filter_css($o);
                    $content = '<img class="wpbn-shape-img" src="'.esc_url($url).'" alt=""'.($srcset ? ' srcset="'.esc_attr($srcset).'" sizes="100vw"' : '')
                        .' decoding="async" loading="'.($state['first'] ? 'eager' : 'lazy').'"'.($filter !== '' ? ' style="'.esc_attr('filter:'.$filter).'"' : '').'>';
                }
            } elseif ($o['fill'] === 'color') {
                $gradient = $o['use_gradient'] ? WPBN_Gradient::css($o['gradient']) : '';
                $clip .= 'background:'.($gradient !== '' ? $gradient : $o['color']).';';
            } elseif ($o['fill'] === 'glass') {
                $clip .= 'background:'.$o['glass_color'].';-webkit-backdrop-filter:blur('.$o['glass_blur'].'px);backdrop-filter:blur('.$o['glass_blur'].'px);';
            }
            if ($o['opacity'] < 100) { $clip .= 'opacity:'.($o['opacity'] / 100).';'; }
            // Its edge (a solid line around it: four shadows without blur, one each way) and its shadow, along its
            // outline. Not on glass: a filter around it would leave the glass nothing behind it to blur.
            $item = '--wpbn-mask:'.self::mask($meta['viewbox'], $markup[$o['key']]).';';
            $effects = array();
            if ($o['fill'] !== 'glass') {
                if ($o['stroke'] > 0) {
                    foreach (array(array(1, 0), array(-1, 0), array(0, 1), array(0, -1)) as $dir) { $effects[] = 'drop-shadow('.($dir[0] * $o['stroke']).'px '.($dir[1] * $o['stroke']).'px 0 '.$o['stroke_color'].')'; }
                }
                if ($o['use_shadow']) { $effects[] = 'drop-shadow('.$o['shadow_x'].'px '.$o['shadow_y'].'px '.$o['shadow_blur'].'px '.$o['shadow_color'].')'; }
            }
            if ($effects) { $item .= 'filter:'.implode(' ', $effects).';'; }
            $move = $o['move_x'] || $o['move_y'] ? ' data-move="'.esc_attr(wp_json_encode(array('x'=>$o['move_x'], 'y'=>$o['move_y']))).'"' : '';
            $html .= '<div class="wpbn-shape-item" style="'.esc_attr($item).'"'.$move.'><div class="wpbn-shape-clip'.($o['invert'] ? ' wpbn-shape-clip--invert' : '').'"'
                .($clip !== '' ? ' style="'.esc_attr($clip).'"' : '').'>'.$content.'</div></div>';
        }
        return $html;
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
