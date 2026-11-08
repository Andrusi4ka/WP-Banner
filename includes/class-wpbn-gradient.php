<?php
/**
 * A layer's Gradient, as WP Swiper's (its editor as WoodMart's, admin.js gradientField()):
 * kept as "linear;top;rgba(0,0,0,0)@0;rgba(0,0,0,0.6)@100": its type (linear, or radial:
 * circle / ellipse), where it starts (linear: left, right, top, bottom) or its middle
 * (radial: "left|center|right top|center|bottom"), then 2 to STOPS colours with their
 * positions (0–100). An overlay layer's fill (instead of its colour); only overlays have one.
 */
defined('ABSPATH') || exit;
class WPBN_Gradient {
    const STOPS = 10;
    // Clear at the top, darker at the bottom: a photo's lower part shaded, as under a title.
    const DEFAULT_VALUE = 'linear;top;rgba(0,0,0,0)@0;rgba(0,0,0,0.6)@100';
    const SIDES = array('left', 'right', 'top', 'bottom');
    // A stored gradient as [type, where, stops [[colour, position]]] in order of positions; null if it is not one.
    public static function parse($value) {
        $parts = explode(';', is_string($value) ? $value : '');
        if (count($parts) < 4) { return null; }
        $type = array_shift($parts);
        $where = array_shift($parts);
        if ($type === 'linear') {
            if (!in_array($where, self::SIDES, true)) { return null; }
        } elseif (in_array($type, array('circle', 'ellipse'), true)) {
            $at = explode(' ', $where);
            if (count($at) !== 2 || !in_array($at[0], array('left', 'center', 'right'), true) || !in_array($at[1], array('top', 'center', 'bottom'), true)) { return null; }
        } else {
            return null;
        }
        $stops = array();
        foreach ($parts as $part) {
            $point = explode('@', $part);
            if (count($point) !== 2 || !is_numeric($point[1])) { continue; }
            $color = WPBN_Settings::color($point[0], '');
            if ($color !== '') { $stops[] = array($color, round(max(0, min(100, (float) $point[1])), 1)); }
        }
        $stops = array_slice($stops, 0, self::STOPS);
        if (count($stops) < 2) { return null; }
        // In order of their positions (those at one place as they came).
        $order = array_keys($stops);
        usort($order, function ($a, $b) use ($stops) { return $stops[$a][1] === $stops[$b][1] ? $a - $b : ($stops[$a][1] < $stops[$b][1] ? -1 : 1); });
        return array('type'=>$type, 'where'=>$where, 'stops'=>array_map(function ($i) use ($stops) { return $stops[$i]; }, $order));
    }
    // A gradient (parse()) as stored.
    public static function value($gradient) {
        $points = array();
        foreach ($gradient['stops'] as $stop) { $points[] = $stop[0].'@'.(fmod($stop[1], 1) == 0 ? (int) $stop[1] : $stop[1]); }
        return $gradient['type'].';'.$gradient['where'].';'.implode(';', $points);
    }
    // What is kept: a gradient checked and in order, or the default.
    public static function sanitize($value) {
        $gradient = self::parse($value);
        return $gradient ? self::value($gradient) : self::DEFAULT_VALUE;
    }
    // A stored gradient as CSS (its start "left" as WoodMart's: towards the right); '' if it is not one.
    public static function css($value) {
        $gradient = self::parse($value);
        if (!$gradient) { return ''; }
        $points = array();
        foreach ($gradient['stops'] as $stop) { $points[] = $stop[0].' '.$stop[1].'%'; }
        if ($gradient['type'] === 'linear') {
            $towards = array('left'=>'right', 'right'=>'left', 'top'=>'bottom', 'bottom'=>'top');
            return 'linear-gradient(to '.$towards[$gradient['where']].', '.implode(', ', $points).')';
        }
        return 'radial-gradient('.$gradient['type'].' at '.$gradient['where'].', '.implode(', ', $points).')';
    }
}
