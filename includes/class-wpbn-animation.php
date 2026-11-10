<?php
/**
 * A layer's Animation: motion of its own that runs by itself (not with the scroll), from the moment the page
 * loads or once the banner comes into view: e.g. a photo slowly zooming in and out, a title fading or sliding
 * into place. Its content is wrapped in .wpbn-anim (WPBN_Render), which the animation moves (frontend.css),
 * so it adds up with the scroll motion on the layer itself.
 *
 * Kept in the layer: use_anim (its switch), anim_type (types()), anim_from and anim_to (where it starts and
 * ends, in the type's unit), anim_duration (s) — these three per device (tablet and mobile null: the larger
 * screen's) — and anim_start (STARTS), anim_delay (s), anim_repeat (REPEATS), anim_easing (EASINGS) and
 * anim_origin (ORIGINS, a zoom's Direction).
 *
 * A new kind of animation: an entry in types() and its @keyframes in frontend.css (named wpbn-<type>, from
 * var(--wpbn-a0) to var(--wpbn-a1)); the editor's fields follow types() (admin.js animationCard()).
 */
defined('ABSPATH') || exit;
class WPBN_Animation {
    /*
     * type => label: its name; switch: its switch's label while it is the only kind; origin: whether it has a
     * Direction (ORIGINS); from / to: its fields' labels; unit: the CSS unit its values become ('' a plain number);
     * div: what a value is divided by for CSS (zoom 110% → scale 1.1); min / max: what it may be; span: the slider's
     * span; def: [from, to] for a new animation of the kind; repeat: its Repeat to start with; fill_min: the least it
     * may be on an image filling the scene (null: any), so the photo's edges never show; axis: x or y for a slide
     * (frontend.js keeps a photo's edges out of view while it slides); note: the help under its fields.
     */
    public static function types() {
        return array(
            'zoom'=>array('label'=>__('Zoom', 'wp-banner'), 'switch'=>__('Auto zoom', 'wp-banner'), 'origin'=>true,
                'from'=>__('Start size (%)', 'wp-banner'), 'to'=>__('End size (%)', 'wp-banner'),
                'unit'=>'', 'div'=>100, 'min'=>10, 'max'=>300, 'span'=>array(50, 200), 'def'=>array(100, 110), 'repeat'=>'alternate', 'fill_min'=>100,
                'note'=>__('100%: its size as set above. An image that fills the scene stays at 100% or more, so its edges never show.', 'wp-banner')),
            'fade'=>array('label'=>__('Fade', 'wp-banner'), 'switch'=>__('Auto fade', 'wp-banner'),
                'from'=>__('Start opacity (%)', 'wp-banner'), 'to'=>__('End opacity (%)', 'wp-banner'),
                'unit'=>'', 'div'=>100, 'min'=>0, 'max'=>100, 'span'=>array(0, 100), 'def'=>array(0, 100), 'repeat'=>'once', 'fill_min'=>null,
                'note'=>__('0%: hidden, 100%: as visible as its Opacity above. 0 → 100 once: it fades in.', 'wp-banner')),
            'slide-x'=>array('label'=>__('Slide sideways', 'wp-banner'), 'switch'=>__('Auto slide', 'wp-banner'), 'axis'=>'x',
                'from'=>__('Start offset (px)', 'wp-banner'), 'to'=>__('End offset (px)', 'wp-banner'),
                'unit'=>'px', 'div'=>1, 'min'=>-1000, 'max'=>1000, 'span'=>array(-300, 300), 'def'=>array(-60, 0), 'repeat'=>'once', 'fill_min'=>null,
                'note'=>__('From its place; negative: to the left. −60 → 0 once: it slides in from the left.', 'wp-banner')),
            'slide-y'=>array('label'=>__('Slide up or down', 'wp-banner'), 'switch'=>__('Auto slide', 'wp-banner'), 'axis'=>'y',
                'from'=>__('Start offset (px)', 'wp-banner'), 'to'=>__('End offset (px)', 'wp-banner'),
                'unit'=>'px', 'div'=>1, 'min'=>-1000, 'max'=>1000, 'span'=>array(-300, 300), 'def'=>array(60, 0), 'repeat'=>'once', 'fill_min'=>null,
                'note'=>__('From its place; negative: up. 60 → 0 once: it rises into place.', 'wp-banner')),
        );
    }
    // Direction: the point of the layer it grows from (and shrinks towards), as CSS transform-origin takes it;
    // bottom: it grows upwards, its bottom edge staying put. On an image filling the scene its edges still never show.
    const ORIGINS = array('center'=>'center', 'top'=>'center top', 'bottom'=>'center bottom', 'left'=>'left center', 'right'=>'right center',
        'top-left'=>'left top', 'top-right'=>'right top', 'bottom-left'=>'left bottom', 'bottom-right'=>'right bottom');
    // Starts: as the page loads, or once the banner is in view (frontend.js; before then it waits at its start).
    const STARTS = array('load', 'visible');
    const REPEATS = array('alternate', 'loop', 'once');
    const EASINGS = array('ease-in-out', 'ease', 'linear', 'ease-in', 'ease-out');
    // Seconds: how long one run takes, and the wait before the first.
    const DURATION = array(0.3, 60);
    const DELAY = array(0, 30);
    // Values kept for any type (each type's own range is applied where it is drawn: values()).
    const RANGE = array(-1000, 1000);

    // The layer's settings, as a new layer has them.
    public static function defaults() {
        $zoom = self::types()['zoom'];
        return array('use_anim'=>false, 'anim_type'=>'zoom', 'anim_from'=>$zoom['def'][0], 'anim_to'=>$zoom['def'][1], 'anim_duration'=>8,
            'anim_start'=>'load', 'anim_delay'=>0, 'anim_repeat'=>'alternate', 'anim_easing'=>'ease-in-out', 'anim_origin'=>'center');
    }
    // The per-device ones (WPBN_Settings::RESPONSIVE: key, key_tablet, key_mobile).
    const RESPONSIVE = array('anim_from'=>self::RANGE, 'anim_to'=>self::RANGE, 'anim_duration'=>self::DURATION);

    // The rest, checked (the per-device ones are, with the others, in WPBN_Settings::sanitize()).
    public static function sanitize($raw, $l) {
        $pick = function ($key, $allowed, $fallback) use ($raw) { return in_array($raw[$key] ?? null, $allowed, true) ? $raw[$key] : $fallback; };
        $l['use_anim'] = !empty($raw['use_anim']);
        $l['anim_type'] = $pick('anim_type', array_keys(self::types()), 'zoom');
        $l['anim_start'] = $pick('anim_start', self::STARTS, 'load');
        $l['anim_repeat'] = $pick('anim_repeat', self::REPEATS, 'alternate');
        $l['anim_easing'] = $pick('anim_easing', self::EASINGS, 'ease-in-out');
        $l['anim_origin'] = $pick('anim_origin', array_keys(self::ORIGINS), 'center');
        $delay = $raw['anim_delay'] ?? 0;
        $l['anim_delay'] = is_scalar($delay) && is_numeric($delay) ? round(max(self::DELAY[0], min(self::DELAY[1], (float) $delay)), 1) : 0;
        return $l;
    }

    // An overlay's kinds (2026-11-10, user's request): those that move its box, for an overlay smaller than the scene. Not
    // Fade: a fading box around it would cut its Filters (backdrop-filter) off from the layers behind.
    const OVERLAY = array('zoom', 'slide-x', 'slide-y');

    // Whether the layer is animated: its switch on, a kind it may have.
    public static function active($l) {
        return !empty($l['use_anim']) && isset(self::types()[$l['anim_type']]) && ($l['type'] !== 'overlay' || in_array($l['anim_type'], self::OVERLAY, true));
    }

    // The most the layer grows by (1: not at all), on a device: the image's sizes (WPBN_Render::size_for()) allow for it.
    public static function grow($l, $device) {
        if (!self::active($l) || $l['anim_type'] !== 'zoom') { return 1; }
        $v = self::values($l, $device);
        return max(1, $v[0], $v[1]);
    }

    /*
     * How far a slide takes the layer from its place, per device [desktop, tablet, mobile], as [x, y] (px; 0: no
     * slide that way): frontend.js grows an image that fills the scene by enough that its edges stay out of view.
     * A little more than the slide itself: the slide is inside the layer, which that growing scales too.
     */
    public static function slack($l) {
        $out = array(array(0, 0, 0), array(0, 0, 0));
        if (!self::active($l)) { return $out; }
        $type = self::types()[$l['anim_type']];
        if (empty($type['axis'])) { return $out; }
        $axis = $type['axis'] === 'x' ? 0 : 1;
        foreach (array('desktop', 'tablet', 'mobile') as $i=>$device) {
            $v = self::values($l, $device);
            $out[$axis][$i] = round(max(abs($v[0]), abs($v[1])) * 1.25);
        }
        return $out;
    }

    // [from, to] on a device as CSS takes them (zoom: a scale, fade: an opacity, slide: px), within the type's range.
    private static function values($l, $device) {
        $type = self::types()[$l['anim_type']];
        $min = WPBN_Settings::fills($l) && $type['fill_min'] !== null ? max($type['min'], $type['fill_min']) : $type['min'];
        $out = array();
        foreach (array('anim_from', 'anim_to') as $key) {
            $value = max($min, min($type['max'], (float) WPBN_Settings::resolved($l, $key)[$device]));
            $out[] = round($value / $type['div'], 4);
        }
        return $out;
    }

    // The wrapper's class and style: [class, css] (frontend.css picks the device's values by breakpoint).
    public static function wrapper($l) {
        $type = self::types()[$l['anim_type']];
        $css = '';
        $duration = WPBN_Settings::resolved($l, 'anim_duration');
        foreach (array('desktop'=>'-d', 'tablet'=>'-t', 'mobile'=>'-m') as $device=>$suffix) {
            list($from, $to) = self::values($l, $device);
            $seconds = max(self::DURATION[0], min(self::DURATION[1], (float) $duration[$device]));
            $css .= '--wpbn-a0'.$suffix.':'.$from.$type['unit'].';--wpbn-a1'.$suffix.':'.$to.$type['unit'].';--wpbn-ad'.$suffix.':'.$seconds.'s;';
        }
        if ($l['anim_delay'] > 0) { $css .= 'animation-delay:'.$l['anim_delay'].'s;'; }
        if (!empty($type['origin']) && $l['anim_origin'] !== 'center') { $css .= 'transform-origin:'.self::ORIGINS[$l['anim_origin']].';'; }
        if ($l['anim_easing'] !== 'ease-in-out') { $css .= 'animation-timing-function:'.$l['anim_easing'].';'; }
        $class = 'wpbn-anim wpbn-anim--'.$l['anim_type'].' wpbn-anim--'.$l['anim_repeat'].($l['anim_start'] === 'visible' ? ' wpbn-anim--visible' : '');
        return array($class, $css);
    }

    // The editor's fields (admin.js animationCard()): the types with their labels and ranges, the choices.
    public static function editor() {
        $types = array();
        foreach (self::types() as $key=>$type) {
            $types[$key] = array('label'=>$type['label'], 'switch'=>$type['switch'], 'origin'=>!empty($type['origin']), 'from'=>$type['from'], 'to'=>$type['to'], 'min'=>$type['min'], 'max'=>$type['max'],
                'span'=>$type['span'], 'def'=>$type['def'], 'repeat'=>$type['repeat'], 'fillMin'=>$type['fill_min'], 'note'=>$type['note']);
        }
        return array('types'=>$types, 'duration'=>self::DURATION, 'delay'=>self::DELAY,
            // Short: they fit the select (the point it grows from, and which way).
            'origins'=>array('center'=>__('Center (all ways)', 'wp-banner'), 'bottom'=>__('Bottom (grows up)', 'wp-banner'), 'top'=>__('Top (grows down)', 'wp-banner'),
                'left'=>__('Left (grows right)', 'wp-banner'), 'right'=>__('Right (grows left)', 'wp-banner'),
                'bottom-left'=>__('Bottom left corner', 'wp-banner'), 'bottom-right'=>__('Bottom right corner', 'wp-banner'),
                'top-left'=>__('Top left corner', 'wp-banner'), 'top-right'=>__('Top right corner', 'wp-banner')),
            'starts'=>array('load'=>__('On load', 'wp-banner'), 'visible'=>__('In view', 'wp-banner')),
            'repeats'=>array('alternate'=>__('Back & forth', 'wp-banner'), 'loop'=>__('Loop', 'wp-banner'), 'once'=>__('Once', 'wp-banner')),
            'easings'=>array('ease-in-out'=>__('Smooth', 'wp-banner'), 'ease'=>__('Ease', 'wp-banner'), 'linear'=>__('Linear (even)', 'wp-banner'), 'ease-in'=>__('Speeding up', 'wp-banner'), 'ease-out'=>__('Slowing down', 'wp-banner')));
    }
}
