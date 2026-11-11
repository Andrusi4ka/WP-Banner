<?php
/**
 * A title's Text animation (2026-11-11, at the user's request, from the GSAP split-text titles on their own sites): the
 * title's letters (or words) come in one after another, once, as the page loads or once the banner is in view. Our own
 * CSS, no GSAP: the server splits the text (split()), each piece gets its place in the order (--o) and, for Scatter, a
 * height of its own (--r), and frontend.css runs one keyframes per kind with the delay delay + place × interval.
 * Apart from the layer's Entrance animation (which moves the whole title): the two add up. More kinds are to come at the
 * user's word: a kind is a row in KINDS, its keyframes in frontend.css and its name in editor().
 *
 * Kept in the layer: use_text_anim (Type None: off), text_anim_type (KINDS), text_anim_start (WPBN_Animation::STARTS),
 * text_anim_by (letters / words), text_anim_order (ORDERS), text_anim_duration (s, each piece's), text_anim_stagger (s,
 * between one piece and the next), text_anim_delay (s, before the first), text_anim_easing (EASINGS), text_anim_blur (px,
 * every kind's), text_anim_distance (px: Scatter's and Drop's) and text_anim_scale (%: Pop's start size). Only titles.
 */
defined('ABSPATH') || exit;
class WPBN_Text_Animation {
    // kind => the look it starts with, as the user's examples have it (the editor sets these when the kind is chosen).
    const KINDS = array(
        'fade'=>array('duration'=>1, 'stagger'=>0.1, 'order'=>'start', 'easing'=>'smooth', 'blur'=>0, 'distance'=>0, 'scale'=>100),
        'scatter'=>array('duration'=>1, 'stagger'=>0.05, 'order'=>'random', 'easing'=>'strong', 'blur'=>10, 'distance'=>100, 'scale'=>100),
        'unfold'=>array('duration'=>1.2, 'stagger'=>0.1, 'order'=>'start', 'easing'=>'smooth', 'blur'=>0, 'distance'=>0, 'scale'=>100),
        'pop'=>array('duration'=>0.8, 'stagger'=>0.05, 'order'=>'start', 'easing'=>'expo', 'blur'=>12, 'distance'=>0, 'scale'=>30),
        'drop'=>array('duration'=>0.8, 'stagger'=>0.12, 'order'=>'start', 'easing'=>'smooth', 'blur'=>12, 'distance'=>70, 'scale'=>100),
    );
    // Which pieces come first: left to right, right to left, from the middle out, from both ends in, in a random order.
    const ORDERS = array('start', 'end', 'center', 'edges', 'random');
    const BY = array('letters', 'words');
    // Easing => CSS. The strong ones as GSAP's: power2.out, power3.out, expo.out, back.out.
    const EASINGS = array('ease-out'=>'ease-out', 'ease-in-out'=>'ease-in-out', 'linear'=>'linear', 'smooth'=>'cubic-bezier(.215,.61,.355,1)',
        'strong'=>'cubic-bezier(.165,.84,.44,1)', 'expo'=>'cubic-bezier(.19,1,.22,1)', 'back'=>'cubic-bezier(.34,1.56,.64,1)');
    const DURATION = array(0.1, 5);
    const STAGGER = array(0, 1);
    const DELAY = array(0, 30);
    const BLUR = array(0, 40);
    const DISTANCE = array(0, 300);
    const SCALE = array(0, 100);

    // The layer's settings, as a new layer has them: off, the first kind's look.
    public static function defaults() {
        $k = self::KINDS['fade'];
        return array('use_text_anim'=>false, 'text_anim_type'=>'fade', 'text_anim_start'=>'visible', 'text_anim_by'=>'letters', 'text_anim_order'=>$k['order'],
            'text_anim_duration'=>$k['duration'], 'text_anim_stagger'=>$k['stagger'], 'text_anim_delay'=>0, 'text_anim_easing'=>$k['easing'],
            'text_anim_blur'=>$k['blur'], 'text_anim_distance'=>$k['distance'], 'text_anim_scale'=>$k['scale']);
    }

    private static function num($value, $fallback, $range, $digits = 1) {
        return is_scalar($value) && is_numeric($value) ? round(max($range[0], min($range[1], (float) $value)), $digits) : $fallback;
    }

    // Its settings, checked.
    public static function sanitize($raw, $l) {
        $d = self::defaults();
        $pick = function ($key, $list) use ($raw, $d) { return is_string($raw[$key] ?? null) && in_array($raw[$key], $list, true) ? $raw[$key] : $d[$key]; };
        $l['use_text_anim'] = !empty($raw['use_text_anim']);
        $l['text_anim_type'] = $pick('text_anim_type', array_keys(self::KINDS));
        $l['text_anim_start'] = $pick('text_anim_start', WPBN_Animation::STARTS);
        $l['text_anim_by'] = $pick('text_anim_by', self::BY);
        $l['text_anim_order'] = $pick('text_anim_order', self::ORDERS);
        $l['text_anim_easing'] = $pick('text_anim_easing', array_keys(self::EASINGS));
        $l['text_anim_duration'] = self::num($raw['text_anim_duration'] ?? null, $d['text_anim_duration'], self::DURATION);
        $l['text_anim_stagger'] = self::num($raw['text_anim_stagger'] ?? null, $d['text_anim_stagger'], self::STAGGER, 2);
        $l['text_anim_delay'] = self::num($raw['text_anim_delay'] ?? null, $d['text_anim_delay'], self::DELAY);
        $l['text_anim_blur'] = self::num($raw['text_anim_blur'] ?? null, $d['text_anim_blur'], self::BLUR, 0);
        $l['text_anim_distance'] = self::num($raw['text_anim_distance'] ?? null, $d['text_anim_distance'], self::DISTANCE, 0);
        $l['text_anim_scale'] = self::num($raw['text_anim_scale'] ?? null, $d['text_anim_scale'], self::SCALE, 0);
        return $l;
    }

    public static function active($l) {
        return ($l['type'] ?? '') === 'text' && !empty($l['use_text_anim']) && isset(self::KINDS[$l['text_anim_type'] ?? '']);
    }

    // The title's class and style (on its h1…div): [class, css].
    public static function wrapper($l) {
        $css = '--wpbn-tad:'.$l['text_anim_duration'].'s;--wpbn-tas:'.$l['text_anim_stagger'].'s;'
            .($l['text_anim_delay'] > 0 ? '--wpbn-tal:'.$l['text_anim_delay'].'s;' : '')
            .'--wpbn-tae:'.self::EASINGS[$l['text_anim_easing']].';'
            .($l['text_anim_blur'] > 0 ? '--wpbn-tab:'.$l['text_anim_blur'].'px;' : '');
        if (in_array($l['text_anim_type'], array('scatter', 'drop'), true)) { $css .= '--wpbn-tay:'.$l['text_anim_distance'].'px;'; }
        // Pop's start size, at least 1% (frontend.css draws a size s as translateZ(P - P / s)).
        if ($l['text_anim_type'] === 'pop') { $css .= '--wpbn-taz:'.round(max(1, $l['text_anim_scale']) / 100, 2).';'; }
        return array('wpbn-ta wpbn-ta--'.$l['text_anim_type'].($l['text_anim_start'] === 'visible' ? ' wpbn-ta--visible' : ''), $css);
    }

    /*
     * The title's text (WPBN_Settings::title_text(): plain text, bare <u>…</u> pairs, line breaks) as pieces: a word is
     * a span that does not break (.wpbn-ta-w), its letters spans of their own (.wpbn-ta-u, the piece that moves; By
     * words: the word is the piece). Spaces stay text, so the lines wrap between words as before; <u> is closed and
     * opened again around each word, so the spans nest. Readers get the whole title once (.wpbn-sr), the pieces are hidden
     * from them. The order and Scatter's heights come from the text itself: the same title is drawn the same every time.
     */
    public static function split($text, $l) {
        $text = WPBN_Settings::title_text($text);
        $by_words = $l['text_anim_by'] === 'words';
        // The words as lists of [character, accent?]; null: a line break; ' ': the spaces between words.
        $tokens = array();
        $word = array();
        $accent = false;
        foreach (preg_split('#(<u>|</u>|\r\n|\n|\r)#', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) as $part) {
            if ($part === '<u>' || $part === '</u>') { $accent = $part === '<u>'; continue; }
            if (in_array($part, array("\r\n", "\n", "\r"), true)) {
                if ($word) { $tokens[] = $word; $word = array(); }
                $tokens[] = null;
                continue;
            }
            foreach (preg_split('//u', $part, -1, PREG_SPLIT_NO_EMPTY) as $char) {
                if (preg_match('/^\s$/u', $char)) {
                    if ($word) { $tokens[] = $word; $word = array(); }
                    $tokens[] = ' ';
                } else {
                    $word[] = array($char, $accent);
                }
            }
        }
        if ($word) { $tokens[] = $word; }
        $count = 0;
        foreach ($tokens as $t) { if (is_array($t)) { $count += $by_words ? 1 : count($t); } }
        if ($count === 0) { return ''; }
        $places = self::places($count, $l['text_anim_order'], $text);
        $seed = self::seed($text.'|r');
        $piece = function ($html, $i) use ($places, $l, &$seed) {
            $style = '--o:'.$places[$i].';';
            if ($l['text_anim_type'] === 'scatter') { $seed = self::next($seed); $style .= '--r:'.round(($seed / 2147483647) * 2 - 1, 2).';'; }
            return '<span class="wpbn-ta-u" style="'.esc_attr($style).'">'.$html.'</span>';
        };
        $html = '';
        $i = 0;
        foreach ($tokens as $t) {
            if ($t === null) { $html .= '<br>'; continue; }
            if ($t === ' ') { $html .= ' '; continue; }
            // A word: its letters, the accent ones inside <u> (opened and closed within the word).
            $inner = '';
            $open = false;
            foreach ($t as $c) {
                if ($c[1] !== $open) { $inner .= $open ? '</u>' : '<u>'; $open = $c[1]; }
                $inner .= $by_words ? esc_html($c[0]) : $piece(esc_html($c[0]), $i++);
            }
            if ($open) { $inner .= '</u>'; }
            $html .= '<span class="wpbn-ta-w">'.($by_words ? $piece($inner, $i++) : $inner).'</span>';
        }
        $plain = trim(preg_replace('/\s+/u', ' ', str_replace(array('<u>', '</u>'), '', $text)));
        return '<span class="wpbn-sr">'.esc_html($plain).'</span><span class="wpbn-ta-text" aria-hidden="true">'.$html.'</span>';
    }

    // Each piece's place in the order (0 first; the middle ones share a place, so do both ends).
    private static function places($count, $order, $text) {
        $mid = ($count - 1) / 2;
        $places = array();
        for ($i = 0; $i < $count; $i++) {
            switch ($order) {
                case 'end': $places[] = $count - 1 - $i; break;
                case 'center': $places[] = (int) floor(abs($i - $mid)); break;
                case 'edges': $places[] = (int) floor($mid - abs($i - $mid)); break;
                default: $places[] = $i;
            }
        }
        if ($order === 'random') {
            // A shuffle of its own (Fisher–Yates on a number from the text), not PHP's random state.
            $seed = self::seed($text);
            for ($i = $count - 1; $i > 0; $i--) {
                $seed = self::next($seed);
                $j = $seed % ($i + 1);
                $tmp = $places[$i]; $places[$i] = $places[$j]; $places[$j] = $tmp;
            }
        }
        return $places;
    }
    private static function seed($text) { return (int) (sprintf('%u', crc32($text)) % 2147483646) + 1; }
    // Park and Miller's generator: the next number from 1 to 2147483646.
    private static function next($seed) { return (int) fmod(48271.0 * $seed, 2147483647.0); }

    // The editor's choices (admin.js textAnimationCard()).
    public static function editor() {
        $kinds = array('fade'=>__('Letters fade in', 'wp-banner'), 'scatter'=>__('Scatter (from random heights)', 'wp-banner'),
            'unfold'=>__('Unfold (from the middle line)', 'wp-banner'), 'pop'=>__('Pop (grow in)', 'wp-banner'), 'drop'=>__('Drop (from above)', 'wp-banner'));
        $types = array();
        foreach (self::KINDS as $key=>$look) { $types[$key] = array('name'=>$kinds[$key], 'def'=>$look); }
        return array('types'=>$types,
            'by'=>array('letters'=>__('Letters', 'wp-banner'), 'words'=>__('Words', 'wp-banner')),
            'orders'=>array('start'=>__('Left to right', 'wp-banner'), 'end'=>__('Right to left', 'wp-banner'), 'center'=>__('From the middle', 'wp-banner'),
                'edges'=>__('From both ends', 'wp-banner'), 'random'=>__('Random', 'wp-banner')),
            'easings'=>array('ease-out'=>__('Ease out', 'wp-banner'), 'ease-in-out'=>__('Ease in and out', 'wp-banner'), 'linear'=>__('Linear', 'wp-banner'),
                'smooth'=>__('Smooth', 'wp-banner'), 'strong'=>__('Strong', 'wp-banner'), 'expo'=>__('Sharp', 'wp-banner'), 'back'=>__('Overshoot', 'wp-banner')),
            'duration'=>self::DURATION, 'stagger'=>self::STAGGER, 'delay'=>self::DELAY, 'blur'=>self::BLUR, 'distance'=>self::DISTANCE, 'scale'=>self::SCALE);
    }
}
