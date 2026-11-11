<?php
/**
 * A layer's Entrance animation (2026-11-09, at the user's request): how it comes into the banner, once — fading in,
 * sliding in from a side or growing / shrinking into place — as the page loads or once the banner is in view. Its
 * content is wrapped in .wpbn-enter (WPBN_Render), outside the Loop animation's .wpbn-anim, so the two and the scroll
 * motion on the layer add up. The Loop animation (WPBN_Animation) is the one that runs on, e.g. a photo slowly zooming.
 *
 * Kept in the layer: use_enter (its switch), enter_type (TYPES), enter_start (WPBN_Animation::STARTS), enter_distance
 * (px, a slide's), enter_scale (%, a zoom's start size), enter_duration and enter_delay (s), enter_easing
 * (WPBN_Animation::EASINGS). Not for a Shape layer (the copies of layers in its objects would not line up while it moves):
 * its objects have their own (WPBN_Shape::ENTER), with these settings.
 */
defined('ABSPATH') || exit;
class WPBN_Entrance {
    // type => [CSS keyframes (frontend.css wpbn-enter-<name>), the side a slide comes from as [x, y] signs].
    // From an edge (2026-11-09, user's request): in from outside the banner, all the way (frontend.js edges() measures how far;
    // until then a screen's width or height). Flips and Rotate Z: as Woodmart's theme animations look (our own CSS, no tie to it).
    const TYPES = array('fade'=>array('fade', null), 'slide-up'=>array('slide', array(0, 1)), 'slide-down'=>array('slide', array(0, -1)),
        'slide-left'=>array('slide', array(1, 0)), 'slide-right'=>array('slide', array(-1, 0)), 'zoom'=>array('zoom', null),
        'edge-left'=>array('edge', array(-1, 0)), 'edge-right'=>array('edge', array(1, 0)), 'edge-top'=>array('edge', array(0, -1)), 'edge-bottom'=>array('edge', array(0, 1)),
        'flip-x-top'=>array('flip-x-top', null), 'flip-x-bottom'=>array('flip-x-bottom', null), 'flip-y-left'=>array('flip-y-left', null), 'flip-y-right'=>array('flip-y-right', null),
        'rotate-z'=>array('rotate-z', null));
    const DISTANCE = array(0, 1000);
    const SCALE = array(10, 300);
    const DURATION = array(0.1, 10);
    const DELAY = array(0, 30);

    // The layer's settings, as a new layer has them.
    public static function defaults() {
        return array('use_enter'=>false, 'enter_type'=>'fade', 'enter_start'=>'visible', 'enter_distance'=>60, 'enter_scale'=>80,
            'enter_duration'=>1, 'enter_delay'=>0, 'enter_easing'=>'ease-out');
    }

    private static function num($value, $fallback, $range) {
        return WPBN_Settings::clamp($value, $fallback, $range[0], $range[1], 1);
    }

    // Its settings, checked.
    public static function sanitize($raw, $l) {
        $d = self::defaults();
        $l['use_enter'] = !empty($raw['use_enter']);
        $l['enter_type'] = isset(self::TYPES[$raw['enter_type'] ?? '']) ? $raw['enter_type'] : $d['enter_type'];
        $l['enter_start'] = in_array($raw['enter_start'] ?? null, WPBN_Animation::STARTS, true) ? $raw['enter_start'] : $d['enter_start'];
        $l['enter_easing'] = in_array($raw['enter_easing'] ?? null, WPBN_Animation::EASINGS, true) ? $raw['enter_easing'] : $d['enter_easing'];
        $l['enter_distance'] = self::num($raw['enter_distance'] ?? null, $d['enter_distance'], self::DISTANCE);
        $l['enter_scale'] = self::num($raw['enter_scale'] ?? null, $d['enter_scale'], self::SCALE);
        $l['enter_duration'] = self::num($raw['enter_duration'] ?? null, $d['enter_duration'], self::DURATION);
        $l['enter_delay'] = self::num($raw['enter_delay'] ?? null, $d['enter_delay'], self::DELAY);
        return $l;
    }

    public static function active($l) {
        return !empty($l['use_enter']) && $l['type'] !== 'shape' && isset(self::TYPES[$l['enter_type']]);
    }

    // The wrapper's class and style: [class, css].
    public static function wrapper($l) {
        list($keyframes, $side) = self::TYPES[$l['enter_type']];
        $css = '--wpbn-ed:'.$l['enter_duration'].'s;'.($l['enter_delay'] > 0 ? '--wpbn-edl:'.$l['enter_delay'].'s;' : '').($l['enter_easing'] !== 'ease-out' ? '--wpbn-ee:'.$l['enter_easing'].';' : '');
        $edge = $keyframes === 'edge' ? ' wpbn-enter--'.$l['enter_type'] : '';
        if ($edge) { $css .= $side[0] ? '--wpbn-ex:'.($side[0] * 100).'vw;' : '--wpbn-ey:'.($side[1] * 100).'vh;'; }
        elseif ($side) { $css .= '--wpbn-ex:'.($side[0] * $l['enter_distance']).'px;--wpbn-ey:'.($side[1] * $l['enter_distance']).'px;'; }
        if ($keyframes === 'zoom') { $css .= '--wpbn-es:'.round($l['enter_scale'] / 100, 3).';'; }
        return array('wpbn-enter wpbn-enter--'.$keyframes.$edge.($l['enter_start'] === 'visible' ? ' wpbn-enter--visible' : ''), $css);
    }

    // A slide's distance added to the Loop animation's (WPBN_Animation::slack()), so a photo filling the scene grows enough that its edges stay out of view.
    public static function slack($l, $slack) {
        if (!self::active($l)) { return $slack; }
        list($keyframes, $side) = self::TYPES[$l['enter_type']];
        // From an edge: the photo comes all the way in (what is not yet covered shows), it is not grown for it.
        if (!$side || $keyframes === 'edge') { return $slack; }
        $axis = $side[0] ? 0 : 1;
        foreach ($slack[$axis] as $i=>$value) { $slack[$axis][$i] = max($value, round($l['enter_distance'] * 1.25)); }
        return $slack;
    }

    // The editor's choices (admin.js entranceCard()).
    public static function editor() {
        return array('types'=>array('fade'=>__('Fade in', 'wp-banner'), 'slide-up'=>__('Slide up (from below)', 'wp-banner'), 'slide-down'=>__('Slide down (from above)', 'wp-banner'),
            'slide-left'=>__('Slide left (from the right)', 'wp-banner'), 'slide-right'=>__('Slide right (from the left)', 'wp-banner'), 'zoom'=>__('Zoom', 'wp-banner'),
            'edge-left'=>__('From the left edge', 'wp-banner'), 'edge-right'=>__('From the right edge', 'wp-banner'), 'edge-top'=>__('From the top edge', 'wp-banner'), 'edge-bottom'=>__('From the bottom edge', 'wp-banner'),
            'flip-x-top'=>__('Flip X (from the top)', 'wp-banner'), 'flip-x-bottom'=>__('Flip X (from the bottom)', 'wp-banner'), 'flip-y-left'=>__('Flip Y (from the left)', 'wp-banner'), 'flip-y-right'=>__('Flip Y (from the right)', 'wp-banner'),
            'rotate-z'=>__('Rotate Z', 'wp-banner')),
            'duration'=>self::DURATION, 'delay'=>self::DELAY);
    }
}
