<?php
// Isolated checks and browser fixtures: no WordPress installation or database is loaded.
define('ABSPATH', __DIR__);
define('WPBN_URL', '/');
define('WPBN_DIR', dirname(__DIR__).'/');
define('DAY_IN_SECONDS', 86400);
define('HOUR_IN_SECONDS', 3600);
define('WEEK_IN_SECONDS', 604800);
// Transients in memory (WPBN_Shape::cleanup()'s hourly mark).
function get_transient($k) { return $GLOBALS['wpbn_test_transients'][$k] ?? false; }
function set_transient($k, $v, $t = 0) { $GLOBALS['wpbn_test_transients'][$k] = $v; return true; }
function sanitize_text_field($s) { return trim(preg_replace('/[\r\n\t ]+/', ' ', strip_tags($s))); }
function sanitize_textarea_field($s) { return trim(strip_tags($s)); }
function sanitize_hex_color($s) { return preg_match('/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i', $s) ? $s : null; }
function sanitize_html_class($s) { return preg_replace('/[^A-Za-z0-9_-]/', '', preg_replace('|%[a-fA-F0-9][a-fA-F0-9]|', '', $s)); }
function absint($n) { return abs((int)$n); }
// Translations: the text as written (the plugin's strings are English).
function __($s, $d = '') { return $s; }
function esc_html__($s, $d = '') { return esc_html($s); }
function esc_attr__($s, $d = '') { return esc_attr($s); }
function _n($one, $many, $n, $d = '') { return $n == 1 ? $one : $many; }
function esc_attr($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function esc_html($s) { return esc_attr($s); }
function esc_url($s) { return esc_attr($s); }
// A post's HTML (no scripts); a shortcode as another plugin's would show it (a box with its text), a banner inside drawn too.
function wp_kses_post($s) { return preg_replace('#<(script|style)\b.*?</\1>#is', '', (string) $s); }
function do_shortcode($s) { return preg_replace_callback('/\[([a-z_]+)([^\]]*)\]/', function ($m) { return $m[1] === 'inner_banner' ? WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shortcode','shortcode'=>'[demo]'))))) : '<div class="demo-slider" data-shortcode="'.esc_attr($m[1]).'" style="height:120px">'.esc_html(trim($m[0])).'</div>'; }, $s); }
// As WordPress's: '' for a link in another protocol (javascript:); a path, #anchor or one of those protocols kept.
function esc_url_raw($s, $protocols = null) { $s = trim((string) $s); return preg_match('/^([a-z][a-z0-9+.-]*):/i', $s, $m) && !in_array(strtolower($m[1]), $protocols ?: array('http', 'https'), true) ? '' : str_replace(array('"', "'", '<', '>', ' '), '', $s); }
function wp_json_encode($s, $flags=0) { return json_encode($s,$flags); }
function wp_get_attachment_image_url($id, $size) { return $id ? '/assets/images/preview/desktop.svg' : false; }
function wp_get_attachment_image_srcset($id, $size) { return false; }
// WPBN_TEST_IMAGE: the editor opens a scene with one photo layer (tests/motion.cjs, Image position).
// A Shape layer's SVG: the objects WPBN_Shape keeps for an attachment ($GLOBALS['wpbn_shapes'], set below).
function get_post_meta($id,$key='',$single=false) { if ($key === '_wpbn_shape') { return $GLOBALS['wpbn_shapes'][(int) $id] ?? ''; } if ($key === '_wp_attachment_image_alt') { return ''; } return getenv('WPBN_TEST_IMAGE') ? array('layers'=>array(array('type'=>'image','image'=>3,'name'=>'Mountains'))) : array(); }
// The posts a check set (WPBN_Shape::cleanup()), else none.
function get_posts($args) { return $GLOBALS['wpbn_test_posts'] ?? array(); }
function wp_nonce_field($a,$b) { echo '<input name="'.esc_attr($b).'" value="test">'; }
function wp_create_nonce($a) { return 'test'; }
function admin_url($path='') { return '/preview'; }
function wp_get_attachment_metadata($id) { return array('width'=>1920,'height'=>1080,'filesize'=>430080); }
function get_attached_file($id) { return '/uploads/mountains-cutout.png'; }
function wp_basename($p) { return basename($p); }
function size_format($b,$d=0) { return round($b/1024).' KB'; }
function wpbn_asset($file) { return '1'; }
// Filters, and wp_kses() as WordPress keeps markup: the allowed tags with their allowed attributes, a style only with
// the properties safe_style_css lets through (the Text layer's HTML, WPBN_Settings::rich_text()).
$GLOBALS['wpbn_filters'] = array();
function add_filter($name, $cb, $priority = 10) { $GLOBALS['wpbn_filters'][$name][] = $cb; }
function remove_filter($name, $cb, $priority = 10) { $GLOBALS['wpbn_filters'][$name] = array_values(array_filter($GLOBALS['wpbn_filters'][$name] ?? array(), function ($c) use ($cb) { return $c !== $cb; })); }
function apply_filters($name, $value) { foreach ($GLOBALS['wpbn_filters'][$name] ?? array() as $cb) { $value = $cb($value); } return $value; }
function wp_strip_all_tags($s) { return trim(strip_tags(preg_replace('#<(script|style)\b.*?</\1>#is', '', $s))); }
function wp_kses($html, $tags) {
    $html = preg_replace('#<(script|style)\b.*?</\1>#is', '', $html);
    return preg_replace_callback('#<(/?)([a-z0-9]+)([^>]*)>#i', function ($m) use ($tags) {
        $tag = strtolower($m[2]);
        if (!isset($tags[$tag])) { return ''; }
        if ($m[1]) { return '</'.$tag.'>'; }
        $attrs = '';
        if (!empty($tags[$tag]['style']) && preg_match('/style\s*=\s*"([^"]*)"/i', $m[3], $style)) {
            $safe = apply_filters('safe_style_css', array());
            $keep = array();
            foreach (explode(';', $style[1]) as $decl) { $prop = strtolower(trim(explode(':', $decl)[0])); if ($prop !== '' && in_array($prop, $safe, true)) { $keep[] = trim($decl); } }
            if ($keep) { $attrs = ' style="'.esc_attr(implode('; ', $keep)).'"'; }
        }
        foreach ($tags[$tag] as $name => $on) {
            if ($name === 'style' || !preg_match('/\b'.$name.'\s*=\s*"([^"]*)"/i', $m[3], $v)) { continue; }
            if ($name === 'href' && preg_match('/^\s*(javascript|data|vbscript):/i', $v[1])) { continue; }
            $attrs .= ' '.$name.'="'.esc_attr($v[1]).'"';
        }
        return '<'.$tag.$attrs.'>';
    }, $html);
}
require_once __DIR__.'/../includes/class-wpbn-settings.php';
require_once __DIR__.'/../includes/class-wpbn-gradient.php';
require_once __DIR__.'/../includes/class-wpbn-animation.php';
require_once __DIR__.'/../includes/class-wpbn-entrance.php';
require_once __DIR__.'/../includes/class-wpbn-text-animation.php';

// Shapes (2026-11-10): posts of their own type (WPBN_Shape::POST_TYPE), no longer attachments.
function get_post_type($id) { return $GLOBALS['wpbn_test_types'][(int) $id] ?? (isset($GLOBALS['wpbn_shapes'][(int) $id]) ? 'wpbn_shape' : 'attachment'); }
function get_the_title($id) { return 'Image '.(int) $id; }
function get_post_mime_type($id) { return isset($GLOBALS['wpbn_shapes'][(int) $id]) ? 'image/svg+xml' : ((int) $id === 2 ? 'image/png' : 'image/jpeg'); }
require_once __DIR__.'/../includes/class-wpbn-render.php';
require_once __DIR__.'/../includes/class-wpbn-container.php';
class WP_Error { private $message; public function __construct($code, $message) { $this->message = $message; } public function get_error_message() { return $this->message; } }
function is_wp_error($x) { return $x instanceof WP_Error; }
require_once __DIR__.'/../includes/class-wpbn-shape.php';
require_once __DIR__.'/../includes/class-wpbn-icons.php';
require_once __DIR__.'/../includes/class-wpbn-access.php';
// A Shape layer's SVG as attachment 900 holds it: three strips, the middle one first (as a drawing program may write them).
$GLOBALS['wpbn_shapes'][900] = WPBN_Shape::parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect x="400" y="200" width="200" height="600"/><rect x="700" y="200" width="200" height="600"/><rect data-name="Left strip" x="100" y="200" width="200" height="600"/></svg>');
// The color palette: a Woodmart site with its colors set (WPBN_Palette).
function get_template() { return 'woodmart'; }
function get_option($name, $default=false) { return $name === 'xts-woodmart-options' ? array('primary-color'=>array('idle'=>'#83B735'), 'secondary-color'=>'#FBBC34', 'link-color'=>array('idle'=>'')) : $default; }
// The fonts: Woodmart's options, its system fonts and its Google fonts (a few), and the <link> it prints
// for a Google font, once a page (WPBN_Fonts).
function woodmart_get_opt($name) {
    // A theme update that changed its internal API (WPBN_Fonts::guarded()).
    if (!empty($GLOBALS['wpbn_woodmart_broken'])) { throw new Error('woodmart_get_opt() changed'); }
    $opts = array('primary-font'=>array(array('font-family'=>'Playfair Display')), 'text-font'=>array(array('font-family'=>'System font stack')),
        'secondary-font'=>array(array('font-family'=>'var(--wd-text-font)')), 'multi_custom_fonts'=>array('{{index}}'=>array('font-name'=>''), array('font-name'=>'Brand Sans')), 'typekit_fonts'=>'');
    return $opts[$name] ?? '';
}
function woodmart_get_config($name) { return $name === 'standard-fonts' ? array('-apple-system,sans-serif'=>'System font stack', 'Georgia, serif'=>'Georgia, serif') : array(); }
eval('namespace XTS\Admin\Modules\Options\Google_Fonts; class Google_Fonts {
    public static $all_google_fonts = array();
    private static $loaded = array();
    public static function get_instance() { return new self(); }
    public function enqueue_inline_fonts($fonts, $id) { if (!empty($GLOBALS["wpbn_woodmart_broken"])) { ob_start(); echo "half"; throw new \Error("enqueue_inline_fonts() changed"); } foreach ($fonts as $f) { $key = $f["font-family"]."@".$f["font-weight"].$f["font-style"]; if (isset(self::$loaded[$key])) { continue; } self::$loaded[$key] = true; echo "<link rel=\"stylesheet\" id=\"xts-google-fonts-inline-".$id."-css\" href=\"https://fonts.googleapis.com/css2?family=".str_replace(" ", "+", $f["font-family"]).($f["font-style"] === "italic" ? ":ital,wght@1," : ":wght@").$f["font-weight"]."\">"; } }
}');
$variants = function ($ids) { return array('variants'=>array_map(function ($id) { return array('id'=>$id); }, $ids)); };
XTS\Admin\Modules\Options\Google_Fonts\Google_Fonts::$all_google_fonts = array('Playfair Display'=>$variants(array('400','700','900','400italic')), 'Exo 2'=>$variants(array('100','300','500')), 'Roboto'=>$variants(array('300','400','700')));
require_once __DIR__.'/../includes/class-wpbn-palette.php';
require_once __DIR__.'/../includes/class-wpbn-fonts.php';
require_once __DIR__.'/../includes/class-wpbn-admin.php';
if (($argv[1] ?? '')==='--editor') {
    echo '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/vendor/pickr/classic.min.css"><link rel="stylesheet" href="/assets/css/admin.css"><style id="wpbn-test-all-blocks">.wpbn-block[hidden]{display:block!important}</style><style>body{font:13px Arial;margin:20px}.button{padding:6px;cursor:pointer}input,select{padding:5px;box-sizing:border-box}</style></head><body><form id="post"><div id="wpbn-editor"><div class="inside">';
    WPBN_Admin::editor((object)array('ID'=>7));
    echo '</div></div></form><script src="/assets/vendor/pickr/pickr.min.js"></script><script src="/assets/js/admin-color.js"></script><script src="/assets/js/admin.js"></script></body></html>'; exit;
}
if (($argv[1] ?? '')==='--preview') {
    $s=WPBN_Settings::sanitize(json_decode(stream_get_contents(STDIN),true));
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/frontend.css"><link rel="stylesheet" href="/assets/css/preview-dev.css"><style>'.WPBN_Admin::PAGE_CSS.WPBN_Admin::theme_css().'</style></head>'.WPBN_Admin::preview_body(WPBN_Admin::preview_markup($s), getenv('WPBN_TEST_STILL')==='1').'<script src="/assets/js/frontend.js"></script><script src="/assets/js/preview-dev.js"></script></body></html>'; exit;
}
// The answer to an SVG uploaded in the editor (admin-ajax wpbn_shape_upload): attachment 900 (tests/motion.cjs).
if (($argv[1] ?? '')==='--shape') { echo wp_json_encode(array('success'=>true, 'data'=>WPBN_Shape::editor(900))); exit; }
function check($condition,$message) { if (!$condition) { throw new RuntimeException($message); } }
// The motion data frontend.js reads from a layer's markup.
function motion_of($markup, $index) { preg_match_all('/data-motion="([^"]+)"/', $markup, $m); return json_decode(html_entity_decode($m[1][$index]), true); }

// Bounds and allow-lists.
$bad=WPBN_Settings::sanitize(array('height'=>99999,'background'=>'red;position:fixed','label'=>'<b>Mountains</b>','layers'=>array(array('type'=>'script','name'=>'<b>name</b>','text'=>'<script>alert(1)</script>','x'=>-9999,'opacity'=>500,'image'=>array(1),'color'=>array('bad'),'move_y'=>array(1),'hidden'=>true))));
check($bad['height']===2400, 'Height must be bounded');
check(!isset($bad['background']) && strpos(WPBN_Render::markup($bad),'background')===false, 'No scene background: the preview has its own page');
check($bad['height_unit']==='auto' && WPBN_Settings::defaults()['mobile_height_unit']===null,'Height unit defaults to Auto; tablet and mobile follow');
$follow=WPBN_Settings::sanitize(array('height'=>400,'height_unit'=>'px','tablet_height_unit'=>'','mobile_height_unit'=>'vh','mobile_height'=>60));
check($follow['tablet_height']===null && WPBN_Settings::heights($follow)['tablet']===array(400.0,'px'),'Tablet without a unit of its own follows desktop, number and unit');
check(WPBN_Settings::heights($follow)['mobile']===array(60.0,'vh'),'Mobile with its own unit keeps it');
check(WPBN_Settings::css_heights(WPBN_Settings::sanitize(array('height'=>400,'height_unit'=>'px')))===array('desktop'=>'400px','tablet'=>'400px','mobile'=>'400px'),'Heights inherited down to mobile');
check(WPBN_Settings::sanitize(array('tablet_height_unit'=>'px'))['tablet_height']===600.0,'A unit of its own without a number: the device\'s usual height');
$units=WPBN_Settings::sanitize(array('height_unit'=>'em;x','tablet_height_unit'=>'vh','tablet_height'=>500,'mobile_height_unit'=>'auto'));
check($units['height_unit']==='auto' && $units['tablet_height']===200,'Units allow-listed (unknown: Auto), shares bounded');
$unitMarkup=WPBN_Render::markup($units);
check(strpos($unitMarkup,'--wpbn-tablet-height:200vh')!==false && strpos($unitMarkup,'--wpbn-mobile-height:500px')!==false && strpos($unitMarkup,'data-auto="desktop mobile"')!==false,'Units rendered, Auto marked for frontend.js');
check(!isset($bad['label']) && strpos(WPBN_Render::markup($bad),'aria-label')===false,'No scene label: scenes are decoration');
check($bad['layers'][0]['type']==='image' && $bad['layers'][0]['image']===0,'Unexpected layer types and attachment arrays rejected');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'video'))))['layers'][0]['type']==='image','Unknown layer types become image layers');
check($bad['layers'][0]['x']===-100 && $bad['layers'][0]['opacity']===100,'Geometry bounded');
check(count(WPBN_Settings::sanitize(array('layers'=>array_fill(0,100,array())))['layers'])===40,'Layer count bounded');

// Rendering: order, hidden layers, text.
$s=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','image'=>1,'name'=>'Back'),array('type'=>'text','text'=>"\"<b>Title</b> & more\nsecond line",'tag'=>'script','font_family'=>'"Playfair Display", serif; } body{x'),array('type'=>'image','image'=>1,'hidden'=>true))));
$markup=WPBN_Render::markup($s);
check(substr_count($markup,'class="wpbn-layer ')===2,'Hidden layers not rendered');
check(strpos($markup,'z-index:1')<strpos($markup,'z-index:2'),'Back-to-front order preserved');
check(strpos($markup,'<b>')===false && strpos($markup,'&amp; more')!==false && strpos($markup,'<br>')!==false,'Text escaped, line breaks kept');
check($s['layers'][1]['tag']==='h2' && strpos($markup,'<h2 style="font-family:')!==false,'Title tag allow-listed: h2 by default');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','tag'=>'div'),array('type'=>'text','tag'=>'p'))))['layers'][1]['tag']==='h2','Titles saved as div or p become h2');
check(strpos($s['layers'][1]['font_family'],';')===false && strpos($s['layers'][1]['font_family'],'{')===false,'Font family cannot break out of its CSS');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','tag'=>'h1'))))['layers'][0]['tag']==='h1','A banner title may be the h1');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','tag'=>'h5'),array('type'=>'text','tag'=>'h6'))))['layers'][0]['tag']==='h5','Headings h1 to h5');
check(WPBN_Settings::sanitize($s)==$s,'Sanitization idempotent');

// Switches: off, a setting has its value at rest; on, its own. An image layer's width is always the scene's.
$sw=WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'image','image'=>1,'width'=>60,'scale'=>130,'use_scale'=>false,'move_y'=>-80,'use_move_y'=>true,'zoom'=>20,'use_zoom'=>false),
    array('type'=>'text','width'=>60,'move_y'=>150,'use_move_y'=>false),
)));
$swm=WPBN_Render::markup($sw);
check(substr_count($swm,'--wpbn-width:100%;')===2 && strpos($swm,'--wpbn-width:60%')===false,'Every layer as wide as its container (the scene here): no Width setting, a stored one not used');
check(strpos($swm,'--wpbn-scale:1;')!==false && $sw['layers'][0]['scale']==100 && $sw['layers'][0]['use_scale']===true,'Scale saved switched off: at rest, 100% (no switch since 2026-11-09)');
check(motion_of($swm,0)['move_y']===array(-80,-80,-80) && motion_of($swm,0)['zoom']===array(0,0,0),'Motion applies only with its switch on');
check(motion_of($swm,1)['move_y']===array(0,0,0),'Text motion switched off: none');

// Opacity at the end: frontend.js gets what is added by the end; scenes saved with Fade keep their look.
$end=WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'text','opacity'=>80,'end_opacity'=>20,'use_end_opacity'=>true),
    array('type'=>'text','end_opacity'=>0,'use_end_opacity'=>false),
    array('type'=>'text','fade'=>-100),
    array('type'=>'image','image'=>1,'opacity'=>40,'fade'=>60,'fade_mobile'=>0),
)));
$em=WPBN_Render::markup($end);
check(motion_of($em,0)['fade']===array(-80,-80,-80),'Opacity at the end: a title from 100% (it has no Opacity; 80 stored is not used) to 20%');
check(strpos($em,'--wpbn-opacity:1;')!==false && strpos($em,'--wpbn-opacity:0.8')===false && strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','scale'=>150,'scale_mobile'=>50))))),'--wpbn-scale:1;--wpbn-scale-t:1;--wpbn-scale-m:1;')!==false,'A title: no Scale, no Opacity');
check(motion_of($em,1)['fade']===array(0,0,0),'Opacity at the end switched off: no change');
check($end['layers'][2]['use_end_opacity'] && $end['layers'][2]['end_opacity']===0.0,'Fade -100 becomes Opacity at the end 0');
check($end['layers'][3]['end_opacity']===100.0 && $end['layers'][3]['end_opacity_mobile']===40.0 && $end['layers'][3]['use_opacity'],'Fade +60 from 40% becomes 100%; mobile without fade keeps 40%');

// Image fit: Cover layers fill the scene (frontend.js keeps their edges hidden); Contain ones do not.
$fit=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','image'=>1,'fit_mobile'=>'contain'),array('type'=>'text'))));
$fm=WPBN_Render::markup($fit);
check(motion_of($fm,0)['fill']===array(true,true,false) && motion_of($fm,1)['fill']===array(false,false,false),'Edges kept hidden for Cover images only, per device');

// Placement by class.
$pc=WPBN_Settings::sanitize(array('target'=>'.hero row<script>','height_unit'=>'auto'));
check($pc['target']==='herorowscript' && !isset($pc['by_class']),'One class, no dot, nothing else; no switch');
check(!WPBN_Settings::placed_by_class(WPBN_Settings::sanitize(array('target'=>'','height_unit'=>'auto'))),'No class, no placement by class');
check(WPBN_Settings::sanitize(array('by_class'=>false,'target'=>'old'))['target']==='','A scene saved with the former switch off has no class');
check(WPBN_Settings::sanitize(array('by_class'=>true,'target'=>'old'))['target']==='old','A scene saved with it on keeps its class');
$hm=WPBN_Render::markup($pc, array('host'=>$pc['target']));
check(strpos($hm,'data-host="herorowscript"')!==false && strpos($hm,'<script>(function(s){')!==false,'A scene placed by class carries its class and the script that makes it the background');
check(strpos(WPBN_Render::markup($pc),'data-host')===false,'Without a host, no placement script');
check(WPBN_Settings::placed_by_class($pc) && $pc['as_background']===true && $pc['as_background_tablet']===null,'Placed by class: Background of the block on, tablet and mobile following');
// Background of the block per device (2026-11-13): scenes saved before it as then (only with the desktop Height on Auto, every device).
$oldPx=WPBN_Settings::sanitize(array('target'=>'hero','height_unit'=>'px','height'=>600));
check(!WPBN_Settings::placed_by_class($oldPx) && $oldPx['as_background']===false && $oldPx['target']==='hero','Saved before, with a fixed Height: not placed, as then (the class kept)');
check(WPBN_Settings::placed_on(WPBN_Settings::sanitize(array('target'=>'hero','height_unit'=>'auto')))===array('desktop'=>true,'tablet'=>true,'mobile'=>true),'Saved before, with Height Auto: on every device, as then');
$perDev=WPBN_Settings::sanitize(array('target'=>'hero','height_unit'=>'px','height'=>600,'as_background'=>true,'as_background_tablet'=>'','as_background_mobile'=>false,'mobile_height'=>400,'mobile_height_unit'=>'px'));
check(WPBN_Settings::placed_on($perDev)===array('desktop'=>true,'tablet'=>true,'mobile'=>false) && $perDev['as_background_tablet']===null,'Per device: the background on desktop and tablet, a block of its own on mobile; any Height');
check(WPBN_Settings::placed_on(array_merge($perDev,array('target'=>'')))===array('desktop'=>false,'tablet'=>false,'mobile'=>false),'No class: nowhere');
$pdHtml=WPBN_Render::markup($perDev, array('host'=>$perDev['target'],'host_on'=>WPBN_Settings::placed_on($perDev)));
check(strpos($pdHtml,'data-host="hero" data-host-on="desktop tablet"')!==false && strpos($pdHtml,'data-host-on')!==false && strpos($pdHtml,'wpbnSpot')!==false,'Its markup: the devices it is the background on; the script leaves its place marked');
$pdPrev=WPBN_Admin::preview_markup($perDev);
check(strpos($pdPrev,'class="wpbn-preview-host hero"')!==false && strpos($pdPrev,'data-host-on="desktop tablet"')!==false && strpos($pdPrev,'class="wpbn-scene wpbn-scene--fill')===false,'The preview: in a block with its class, placed by frontend.js per screen');
check(strpos(WPBN_Admin::preview_markup($pc),'<div class="wpbn-host" style="position:relative;height:100vh">')!==false,'The preview, placed on every device: as before');
$fjs=file_get_contents(__DIR__.'/../assets/js/frontend.js');
check(strpos($fjs,'data-host-on')!==false && strpos($fjs,'scene.wpbnSpot.parentNode.insertBefore(scene, scene.wpbnSpot)')!==false,'frontend.js puts it back where it stood on a screen it is not placed on');
check(WPBN_Settings::sanitize(array_merge($pc,array('height_unit'=>'px')))['target']==='herorowscript','With another height the class is kept, just not used');

// Per-device values and older scenes.
$old=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_size'=>96))));
check($old['layers'][0]['tablet_font_size']===null && WPBN_Settings::fonts($old['layers'][0])===array('desktop'=>96.0,'tablet'=>96.0,'mobile'=>96.0),'Tablet and mobile follow the desktop size until given their own');
check(WPBN_Settings::fonts(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_size'=>96,'mobile_font_size'=>40))))['layers'][0])['mobile']===40.0,'Mobile with a size of its own keeps it');
check(strpos(WPBN_Render::markup($old),'--wpbn-tablet-font:96px')!==false,'Tablet font size rendered');
check(!array_key_exists('line_height',$old['layers'][0]) && strpos(WPBN_Render::markup($old),'-lh:')===false,'No line height setting');
// Container, each layer's: layers from before it keep the whole scene; titles saved with the scene's take it; bounded width.
$lay=function ($l) { return WPBN_Settings::sanitize(array('layers'=>array($l)))['layers'][0]; };
check($old['layers'][0]['container']==='full' && WPBN_Settings::layer()['container']==='full','A layer from before Container: Full width, as it was drawn');
check($lay(array('container'=>'nope'))['container']==='full' && $lay(array('container'=>'custom'))['container']==='custom','Container allow-listed');
check($lay(array('container_width'=>99))['container_width']===320 && $lay(array('container_width'=>'1000.6'))['container_width']===1001,'Container width bounded, whole px');
$fromScene=WPBN_Settings::sanitize(array('container'=>'custom','container_width'=>900,'layers'=>array(array('type'=>'text'),array('type'=>'image'),array('type'=>'text','container'=>'full'))));
check($fromScene['layers'][0]['container']==='custom' && $fromScene['layers'][0]['container_width']===900 && $fromScene['layers'][1]['container']==='full' && $fromScene['layers'][2]['container']==='full' && !isset($fromScene['container']),'Titles saved with the Container of the scene take it; the scene keeps none');
$titled=array('type'=>'text','x'=>25,'width'=>60);
$full=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($titled+array('container'=>'full')))));
check(strpos($full,'--wpbn-cw')===false && strpos($full,'--wpbn-left:25%;')!==false && strpos($full,'--wpbn-width:100%;')!==false,'Full width: shares of the scene, as wide as it');
$inTheme=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($titled+array('container'=>'theme'),array('type'=>'image','image'=>1)))));
check(strpos($inTheme,'--wpbn-cw:calc(min(100%, var(--wd-container-w, 1222px)) - 30px);')!==false,'Theme container: Woodmart, less its padding, its width behind its variable');
check(strpos($inTheme,'--wpbn-left:calc((100% - var(--wpbn-cw)) / 2 + var(--wpbn-cw) * 0.25);')!==false && strpos($inTheme,'--wpbn-width:calc(var(--wpbn-cw) * 1);')!==false,'X: a share of the container, centred in the scene; as wide as it');
check(substr_count($inTheme,'--wpbn-cw:')===1 && substr_count($inTheme,'--wpbn-left:50%;')===1 && motion_of($inTheme,1)['fill']===array(true,true,true),'An image on Full width fills the scene');
$boxed=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','image'=>1,'container'=>'custom','container_width'=>900)))));
check(strpos($boxed,'--wpbn-cw:min(100% - 30px, 900px);')!==false && strpos($boxed,'--wpbn-width:calc(var(--wpbn-cw) * 1);')!==false && motion_of($boxed,0)['fill']===array(false,false,false),'An image in a container: its width; it does not fill the scene (edges not grown)');
$placed=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','x'=>0,'y'=>150,'x_mobile'=>100),array('type'=>'image','image'=>1)))));
check(strpos($placed,'--wpbn-anx:0;--wpbn-anx-t:0;--wpbn-anx-m:1;--wpbn-any:1;')!==false && strpos($placed,'--wpbn-top:100%')!==false && substr_count($placed,'--wpbn-anx:')===1,'A title: its Position is also its own point placed there, within 0-100% (an image: its centre)');
check(WPBN_Container::of($lay(array('container'=>'theme')))===array('width'=>1222,'side'=>0,'inner'=>30) && WPBN_Container::of($lay(array()))===null,'The container for the editor');
$old=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','move_y'=>-80,'mobile_motion'=>50))));
check($old['layers'][0]['move_y_mobile']===-40.0 && $old['layers'][0]['move_y_tablet']===null && $old['layers'][0]['use_move_y'],'Motion on mobile becomes the mobile travel');
check(WPBN_Settings::sanitize($old)==$old,'Migrated scenes stay as they are');
$r=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','x'=>30,'x_tablet'=>'','x_mobile'=>70,'scale_tablet'=>9999,'fit_mobile'=>'contain','fit_tablet'=>'bad'))));
check($r['layers'][0]['x_tablet']===null && $r['layers'][0]['scale_tablet']===300 && $r['layers'][0]['fit_tablet']===null,'Per-device values: empty inherits, numbers bounded, choices allow-listed');
check(WPBN_Settings::resolved($r['layers'][0],'x')===array('desktop'=>30.0,'tablet'=>30.0,'mobile'=>70.0),'Mobile → tablet → desktop');
$rm=WPBN_Render::markup($r);
check(strpos($rm,'--wpbn-left:30%;--wpbn-left-t:30%;--wpbn-left-m:70%')!==false && strpos($rm,'--wpbn-fit-m:contain')!==false,'Per-device values rendered as variables');
check(WPBN_Admin::image_info(5)===array('name'=>'mountains-cutout.png','width'=>1920,'height'=>1080,'size'=>'420 KB'),'Image name, pixel size and weight for the picker');
// Colors: as the color fields keep them (#rrggbb, or rgba() below full opacity); anything else: the default.
foreach (array('#ABC'=>'#aabbcc', '#1D2327'=>'#1d2327', 'rgba(255, 0, 10, 0.5)'=>'rgba(255,0,10,0.5)', 'rgba(300,0,0,.257)'=>'rgba(255,0,0,0.26)', 'rgba(1,2,3,1)'=>'#010203',
    'red'=>'#ffffff', 'rgba(1,2,3,0.5);background:url(x)'=>'#ffffff', '#12345'=>'#ffffff') as $in=>$out) {
    check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','color'=>$in))))['layers'][0]['color']===$out, 'Color '.$in.' kept as '.$out);
}
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','color'=>'rgba(0,0,0,0.4)'))))),'color:rgba(0,0,0,0.4);')!==false,'A see-through title color rendered');
// The palette: the theme's colors (Woodmart's; an empty one left out), then black, white and greys, each once.
$palette=WPBN_Palette::colors();
check(array_slice(array_column($palette,'color'),0,3)===array('#83b735','#fbbc34','#000000') && count($palette)===7 && $palette[0]['name']==='Primary color','Palette: theme colors, then the basic ones');
// Accent words: only bare <u> pairs stay in a title (as Woodmart's), never nested; the rest is text.
foreach (array('Discover <u>Norway</u>'=>'Discover <u>Norway</u>', 'A <U >b</u >'=>'A <u>b</u>', 'a <u>b'=>'a <u>b</u>', 'a</u> b'=>'a b', '<u>a <u>b</u> c</u>'=>'<u>a b</u> c',
    '<u class="x">a</u>'=>'a', '<b>a</b> <script>x</script>'=>'a x', "a\n<u>b</u>"=>"a\n<u>b</u>") as $in=>$out) {
    check(WPBN_Settings::title_text($in)===$out, 'Title text '.$in.' kept as '.$out);
}
$accent=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','text'=>"Discover <u>Norway</u> & <i>more</i>\n<u>now",'accent_color'=>'rgba(255,0,0,0.5)')))));
check(strpos($accent,'Discover <u>Norway</u> &amp; more<br>'."\n".'<u>now</u>')!==false,'Accent words rendered as <u>, the rest escaped');
check(strpos($accent,'--wpbn-accent:rgba(255,0,0,0.5);')!==false,'Accent color rendered');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','accent_color'=>'red'))))),'--wpbn-accent')===false && WPBN_Settings::layer()['accent_color']==='','No accent color of its own: the theme\'s');
check(WPBN_Palette::primary()==='#83b735' && strpos(WPBN_Admin::theme_css(),':root{--wd-primary-color:#83b735}')===0,'The preview page gets the theme\'s primary color');
// Fonts (Woodmart's, as its elements list them): the theme's as its variables, custom, system and Google fonts, each with its weights.
$fonts=WPBN_Fonts::groups();
check(array_column($fonts['groups'],0)===array('Theme fonts','Custom fonts','System fonts'),'Font groups as Woodmart\'s (empty ones left out)');
check($fonts['groups'][0][1][0]===array('var(--wd-title-font)','Title font · Playfair Display','479'),'A theme font: its variable, its name, its weights');
check($fonts['groups'][0][1][2][1]==='Secondary font · System font stack' && $fonts['groups'][0][1][2][2]==='123456789','A theme font that is another one\'s variable: followed; a system font has every weight');
check($fonts['groups'][1][1]===array(array('Brand Sans','Brand Sans','123456789')),'Custom fonts (the template row left out)');
check($fonts['google']===array('Playfair Display'=>'479','Exo 2'=>'135','Roboto'=>'347'),'Google fonts with their upright weights');
check(strpos(WPBN_Fonts::theme_css(),'--wd-title-font:"Playfair Display";--wd-text-font:-apple-system,sans-serif;--wd-alternative-font:-apple-system,sans-serif;')!==false,'The preview page gets the theme\'s fonts');
// Woodmart's internal API changed by a theme update (it throws): no fatal error, the editor's text field, no font links.
$GLOBALS['wpbn_woodmart_broken']=true;
$obLevel=ob_get_level();
check(WPBN_Fonts::groups()===null && WPBN_Fonts::faces()===array() && WPBN_Fonts::theme_css()==='' && WPBN_Fonts::resolve('var(--wd-title-font)')==='','A changed Woodmart API: no font list, no theme fonts');
check(WPBN_Fonts::link('Exo 2',300,5)==='' && ob_get_level()===$obLevel,'A changed Woodmart API: no font link, no output buffer left open');
$GLOBALS['wpbn_woodmart_broken']=false;
foreach (array('var(--wd-title-font)'=>'var(--wd-title-font)', 'var(--wd-other)'=>'var--wd-other', 'Exo 2'=>'Exo 2', '"Playfair Display", serif'=>'"Playfair Display", serif', 'a;b:url(x)'=>'aburlx') as $in=>$out) {
    check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_family'=>$in))))['layers'][0]['font_family']===$out,'Font '.$in.' kept as '.$out);
}
$withFont=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_family'=>'Exo 2','font_weight'=>300),array('type'=>'text','font_family'=>'Exo 2','font_weight'=>300)))),array('id'=>9));
check(strpos($withFont,'font-family:&quot;Exo 2&quot;')!==false,'A Google font\'s name quoted');
check(substr_count($withFont,'family=Exo+2:wght@300')===1 && strpos($withFont,'<link')===0 && strpos($withFont,'inline-9-css')!==false,'A Google font loaded once, before the scene');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_weight'=>900))))),'family=Playfair+Display:wght@900')!==false,'No font of its own: the theme\'s title font, loaded at the title\'s weight');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_family'=>'Georgia, serif'))))),'<link')===false,'A system font: nothing to load');
// Gradient (as WP Swiper's): checked and kept in order; an overlay's fill.
check(WPBN_Gradient::sanitize('circle;left top;#F00@100;rgba(0, 0, 255, 0.5)@20;bad@50;#0f0@x')==='circle;left top;rgba(0,0,255,0.5)@20;#ff0000@100','A gradient: colours checked, bad points left out, in order');
foreach (array('', 'linear;middle;#000@0;#fff@100', 'conic;left;#000@0;#fff@100', 'linear;left;#000@0', 'linear;left;#000@0;#fff@100;x</style>') as $bad) {
    check(WPBN_Gradient::sanitize($bad)===($bad==='linear;left;#000@0;#fff@100;x</style>' ? 'linear;left;#000000@0;#ffffff@100' : WPBN_Gradient::DEFAULT_VALUE),'Not a gradient (or its junk left out): '.$bad);
}
check(count(WPBN_Gradient::parse('linear;left;'.implode(';', array_fill(0, 14, '#000@50')))['stops'])===10,'Ten colours at most');
check(WPBN_Gradient::css('linear;left;#000@0;#fff@100')==='linear-gradient(to right, #000000 0%, #ffffff 100%)' && WPBN_Gradient::css('ellipse;center bottom;#000@0;#fff@100')==='radial-gradient(ellipse at center bottom, #000000 0%, #ffffff 100%)','Its CSS: linear starting at the left goes to the right; radial at its middle');
$lay=function ($l) { return WPBN_Settings::sanitize(array('layers'=>array($l)))['layers'][0]; };
check($lay(array())['use_gradient']===false && $lay(array())['gradient']===WPBN_Gradient::DEFAULT_VALUE,'Off, with its default colours');
// A title's Letter spacing (per device), Case, Style and Shadow.
$styled=$lay(array('type'=>'text','letter_spacing'=>'2.46','tablet_letter_spacing'=>'','mobile_letter_spacing'=>-50,'text_transform'=>'uppercase','font_style'=>'italic','use_shadow'=>1,'shadow_color'=>'rgba(0,0,0,0.25)','shadow_x'=>3,'shadow_y'=>'4','shadow_blur'=>500));
check($styled['letter_spacing']===2.5 && $styled['tablet_letter_spacing']===null && $styled['mobile_letter_spacing']===-20.0 && WPBN_Settings::spacings($styled)===array('desktop'=>2.5,'tablet'=>2.5,'mobile'=>-20.0),'Letter spacing: to 0.1px, bounded, tablet following desktop');
check($styled['text_transform']==='uppercase' && $styled['font_style']==='italic' && WPBN_Settings::shadow($styled)==='3px 4px 200px rgba(0,0,0,0.25)','Case, Style and Shadow kept (Blur bounded)');
$plain=$lay(array('type'=>'text','text_transform'=>'small-caps','font_style'=>'oblique','shadow_color'=>'red','shadow_x'=>9));
check($plain['letter_spacing']==0 && $plain['text_transform']==='none' && $plain['font_style']==='normal' && $plain['shadow_color']===WPBN_Settings::SHADOW_COLOR && WPBN_Settings::shadow($plain)==='','Defaults: no spacing, as typed, upright, no shadow (its values kept)');
$html=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_family'=>'Playfair Display','font_weight'=>900)+$styled))), array('id'=>7));
check(strpos($html,'--wpbn-ls:2.5px;--wpbn-tablet-ls:2.5px;--wpbn-mobile-ls:-20px;text-transform:uppercase;font-style:italic;text-shadow:3px 4px 200px rgba(0,0,0,0.25);')!==false,'Rendered: spacing per device, case, style, shadow');
check(strpos($html,'family=Playfair+Display:ital,wght@1,900')!==false,'An italic Google font loaded in italic');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text'))))),'text-transform')===false,'None of them by default');
// Only overlays have a Gradient (2026-11-08): an image's or a title's, saved before, is kept but not drawn.
$graded=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'image','image'=>2,'use_gradient'=>true,'gradient'=>'linear;top;#000@0;#fff@100'),
    array('type'=>'text','use_gradient'=>true,'gradient'=>'linear;left;#ff0000@0;#0000ff@100','font_family'=>'Exo 2'),
))));
check($lay(array('type'=>'image','use_gradient'=>true,'gradient'=>'linear;left;#000@0;#fff@100'))['gradient']==='linear;left;#000000@0;#ffffff@100','An image\'s gradient kept');
check(strpos($graded,'gradient')===false && strpos($graded,'mask')===false && strpos($graded,'background-clip')===false,'Not drawn over an image or in a title\'s letters');
// Overlay: a colour or its Gradient over the whole scene; no Scale or Opacity; since 2026-11-10 its travel and zoom with the scroll.
$over=$lay(array('type'=>'overlay','x'=>10,'y_mobile'=>80,'move_y'=>-200,'use_move_y'=>true,'zoom'=>50,'use_zoom'=>true,'scale'=>200,'use_scale'=>true,'container'=>'theme','end_opacity'=>0,'use_end_opacity'=>true));
check($over['type']==='overlay' && $over['color']===WPBN_Settings::OVERLAY_COLOR && $over['move_y']==-200,'An overlay: its default colour, its values kept');
$fixed=WPBN_Settings::effective($over);
check($fixed['x']==10 && $fixed['y']==50 && $fixed['y_mobile']==80 && $fixed['move_y']==-200 && $fixed['zoom']==50 && $fixed['scale']==100 && $fixed['opacity']==100 && $fixed['container']==='theme','It keeps its Container and Position; it travels and zooms with the scroll, no Scale');
check($lay(array('type'=>'overlay','x'=>-40,'y'=>150))['x']==-40 && WPBN_Settings::effective($lay(array('type'=>'overlay','x'=>-40,'y'=>150)))['x']==0 && WPBN_Settings::effective($lay(array('type'=>'overlay','y'=>150)))['y']==100,'Its Position within its container (0–100%)');
// Its Height per device, as the scene's: 100% of the scene by default; px, vh or %; tablet and mobile follow.
check(WPBN_Settings::heights($over)==array('desktop'=>array(100.0,'%'),'tablet'=>array(100.0,'%'),'mobile'=>array(100.0,'%')),'Its Height: the whole scene to start with');
$tall=$lay(array('type'=>'overlay','height'=>'240','height_unit'=>'px','tablet_height'=>500,'tablet_height_unit'=>'%','mobile_height'=>5000,'mobile_height_unit'=>'vh','tablet_height_x'=>1));
check(WPBN_Settings::heights($tall)==array('desktop'=>array(240.0,'px'),'tablet'=>array(100.0,'%'),'mobile'=>array(200.0,'vh')),'px, % (at most the scene) and vh, bounded');
check($lay(array('type'=>'overlay','height_unit'=>'auto','tablet_height'=>40))['height_unit']==='%' && $lay(array('type'=>'overlay','tablet_height'=>40))['tablet_height']===null,'No Auto; a number without a unit follows the larger screen');
check(WPBN_Settings::fade($fixed)==array(-100,-100,-100),'Its Opacity at the end applies');
check($lay(array('type'=>'overlay','color'=>'nope'))['color']===WPBN_Settings::OVERLAY_COLOR && $lay(array('type'=>'text','color'=>'nope'))['color']==='#ffffff','A bad colour: an overlay\'s default, a title\'s white');
$shaded=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'overlay','color'=>'rgba(0,0,0,0.5)'),
    array('type'=>'overlay','color'=>'#ff0000','use_gradient'=>true,'gradient'=>'linear;top;#000@0;#fff@100'),
    array('type'=>'overlay','color'=>'#00ff00','gradient'=>'linear;top;#000@0;#fff@100'),
))));
check(substr_count($shaded,'wpbn-layer--overlay')===3 && strpos($shaded,'background:rgba(0,0,0,0.5);')!==false && strpos($shaded,'background:linear-gradient(to bottom, #000000 0%, #ffffff 100%);')!==false && strpos($shaded,'background:#00ff00;')!==false,'Its colour, or its gradient with the switch on');
check(strpos($shaded,'wpbn-layer--gradient')===false && strpos($shaded,'&quot;fill&quot;:[false,false,false]')!==false && strpos($shaded,'--wpbn-left:50%;')!==false && strpos($shaded,'--wpbn-oh:100%;--wpbn-oh-t:100%;--wpbn-oh-m:100%;')!==false,'No masked gradient, not grown at the edges, centred, the scene\'s height');
$band=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($tall,array('container'=>'custom','container_width'=>900,'y'=>100))))));
check(strpos($band,'--wpbn-cw:min(100% - 30px, 900px);')!==false && strpos($band,'--wpbn-anx:0.5;')!==false && strpos($band,'--wpbn-any:1;')!==false && strpos($band,'--wpbn-oh:240px;--wpbn-oh-t:100%;--wpbn-oh-m:200vh;')!==false,'In a container, at the bottom (Y 100%), its height per device');
// Container width per device (Custom): tablet and mobile empty follow the larger screen; X and Width use each device's.
$wide=$lay(array('type'=>'text','container'=>'custom','container_width'=>1400,'container_width_tablet'=>'','container_width_mobile'=>100));
check($wide['container_width_tablet']===null && $wide['container_width_mobile']===320 && WPBN_Settings::resolved($wide,'container_width')===array('desktop'=>1400,'tablet'=>1400,'mobile'=>320),'Container width: its own on mobile (at least 320px), tablet following');
$cwHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($wide))));
check(strpos($cwHtml,'--wpbn-cw:min(100% - 30px, 1400px);--wpbn-cw-m:min(100% - 30px, 320px);')!==false && strpos($cwHtml,'--wpbn-cw-t:')===false,'Its own width on mobile only where it differs');
check(strpos($cwHtml,'--wpbn-left-m:calc((100% - var(--wpbn-cw-m, var(--wpbn-cw-t, var(--wpbn-cw)))) / 2 + var(--wpbn-cw-m, var(--wpbn-cw-t, var(--wpbn-cw))) * 0.5);')!==false,'Mobile X: a share of the mobile container');
// An overlay's Blur per device (backdrop-filter): none by default; tablet and mobile follow the larger screen.
$blurred=$lay(array('type'=>'overlay','backdrop_blur'=>'12.4','backdrop_blur_tablet'=>'','backdrop_blur_mobile'=>500));
check($blurred['backdrop_blur']===12 && $blurred['backdrop_blur_tablet']===null && $blurred['backdrop_blur_mobile']===100 && WPBN_Settings::blurs($blurred)===array('desktop'=>12,'tablet'=>12,'mobile'=>100),'Blur: whole px, bounded, tablet following');
// Saved before 2026-11-10 as tablet_backdrop_blur, mobile_backdrop_blur: read as the new keys.
$oldBlur=$lay(array('type'=>'overlay','backdrop_blur'=>8,'mobile_backdrop_blur'=>3));
check($oldBlur['backdrop_blur_mobile']===3 && $oldBlur['backdrop_blur_tablet']===null && !isset($oldBlur['mobile_backdrop_blur']),'The old Blur keys moved');
$blurHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($blurred, array('type'=>'overlay')))));
check(substr_count($blurHtml,'wpbn-layer--blur')===1 && strpos($blurHtml,'--wpbn-blur:12px;--wpbn-blur-t:12px;--wpbn-blur-m:100px;')!==false,'Rendered per device; none at 0');
// Text (richtext): paragraphs, headings, line breaks, bold, italic, underline, a colour, links, lists, alignment; no scripts.
check(WPBN_Settings::rich_text('<p style="text-align: center; font-size: 90px" class="x">Hi <strong>you</strong><br><span style="color: #ff0000; position: fixed">red</span></p><h2 class="z" style="text-align:right;font-size:9px">Big</h2><h7>No</h7><ul><li style="text-align:right">One</li></ul><a href="https://x.test" onclick="y()">link</a><a href="javascript:alert(1)">bad</a><script>alert(1)</script>')==='<p style="text-align: center">Hi <strong>you</strong><br><span style="color: #ff0000">red</span></p><h2 style="text-align: right">Big</h2>No<ul><li style="text-align: right">One</li></ul><a href="https://x.test">link</a><a>bad</a>','Text: only its tags and styles kept (headings, links; no script links)');
check(WPBN_Settings::rich_text('<p><a href="/x" target="_blank">a</a> <a href="/y" target="_blank" rel="nofollow">b</a></p>')==='<p><a href="/x" target="_blank" rel="noopener">a</a> <a href="/y" target="_blank" rel="nofollow noopener">b</a></p>','A link to another tab: noopener');
check(WPBN_Settings::rich_text('<p>&nbsp;</p>')==='' && WPBN_Settings::rich_text('<p> </p><ul><li></li></ul>')==='','Only the editor\'s empty paragraph: nothing');
$txt=$lay(array('type'=>'richtext','content'=>'<p>Hello <em>there</em></p>','x'=>140,'scale'=>200,'use_scale'=>true,'font_size'=>18,'color'=>'#222222','use_shadow'=>true));
check($txt['type']==='richtext' && $txt['content']==='<p>Hello <em>there</em></p>' && WPBN_Settings::effective($txt)['x']==100 && WPBN_Settings::effective($txt)['scale']==100,'A text: placed within its container, at 100% scale');
$txtHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($txt))));
check(strpos($txtHtml,'class="wpbn-layer wpbn-layer--richtext"')!==false && strpos($txtHtml,'><p>Hello <em>there</em></p></div>')!==false && strpos($txtHtml,'--wpbn-font:18px;')!==false && strpos($txtHtml,'color:#222222;')!==false && strpos($txtHtml,'text-shadow:0px 2px 10px rgba(0,0,0,0.5);')!==false && strpos($txtHtml,'--wpbn-anx:1;')!==false,'Rendered: its HTML, size, colour, shadow, placed as a title');
check(strpos(WPBN_Admin::theme_css(),'.wpbn-layer--richtext{font-family:var(--wd-text-font)}')!==false,'The preview: Text in the theme\'s text font');
check(strpos(WPBN_Admin::theme_css(),'body{font-family:var(--wd-text-font)}')!==false,'The preview page in the theme\'s text font, as Woodmart\'s body (a Button takes it)');
check(count(WPBN_Palette::tinymce_map())===2*count(WPBN_Palette::colors()) && WPBN_Palette::tinymce_map()[1]===WPBN_Palette::colors()[0]['name'] && strpos(WPBN_Palette::tinymce_map()[0],'#')===false,'The editor\'s Text color palette: the plugin\'s');
// An image layer: Fill the scene (on by default, and for layers saved before); off: an object with its Width and Height (Auto).
$img=$lay(array('type'=>'image','image'=>3));
check($img['fill_scene']===true && $img['height_unit']==='auto' && WPBN_Settings::fills($img) && !WPBN_Settings::anchored($img),'An image fills the scene by default');
$objL=$lay(array('type'=>'image','image'=>3,'fill_scene'=>false,'overlay_width'=>40,'tablet_overlay_width'=>300,'tablet_overlay_width_unit'=>'px','height_unit'=>'auto','mobile_height'=>50,'mobile_height_unit'=>'vh','x'=>120,'y'=>-10,'container'=>'theme'));
check(WPBN_Settings::object($objL) && WPBN_Settings::anchored($objL) && WPBN_Settings::sized($objL) && WPBN_Settings::effective($objL)['x']==100 && WPBN_Settings::effective($objL)['y']==0,'Off: an object, placed within its container');
$objHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($objL))));
check(strpos($objHtml,'class="wpbn-layer wpbn-layer--image wpbn-layer--object"')!==false && strpos($objHtml,'--wpbn-oh:auto;--wpbn-oh-t:auto;--wpbn-oh-m:50vh;')!==false && strpos($objHtml,'--wpbn-width:calc(var(--wpbn-cw) * 0.4);')!==false && strpos($objHtml,'--wpbn-width-t:300px;')!==false && strpos($objHtml,'--wpbn-anx:1;')!==false,'Rendered: its Height (Auto), Width per device, placed as a title');
check(strpos($objHtml,'&quot;fill&quot;:[false,false,false]')!==false,'Not grown to hide edges (it does not fill the scene)');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($img)))),'wpbn-layer--object')===false,'Filling: as before');
check($lay(array('type'=>'overlay','height_unit'=>'auto'))['height_unit']==='%','An overlay has no Auto height');
check(strpos(file_get_contents(__DIR__.'/../assets/css/frontend.css'),'.wpbn-scene .wpbn-layer--object{height:var(--wpbn-oh,auto)}')!==false,'Its height on the site');
// An image object's Width Auto (2026-11-13): as wide as the image at its Height, e.g. the scene's whole height.
$autoW=$lay(array('type'=>'image','image'=>3,'fill_scene'=>false,'overlay_width_unit'=>'auto','height'=>100,'height_unit'=>'%','mobile_overlay_width'=>80,'mobile_overlay_width_unit'=>'%','mobile_height_unit'=>'auto'));
check($autoW['overlay_width_unit']==='auto' && $lay(array('type'=>'overlay','overlay_width_unit'=>'auto'))['overlay_width_unit']==='%','Width Auto: an image object\'s only');
$autoHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($autoW))));
check(strpos($autoHtml,'--wpbn-width:max-content;--wpbn-width-t:max-content;--wpbn-width-m:80%;')!==false && strpos($autoHtml,'--wpbn-oh:100%;--wpbn-oh-t:100%;--wpbn-oh-m:auto;')!==false && strpos($autoHtml,'--wpbn-iw:auto;--wpbn-mw:100%;--wpbn-fit:contain;--wpbn-iw-t:auto;--wpbn-mw-t:100%;--wpbn-fit-t:contain;--wpbn-iw-m:100%;--wpbn-mw-m:none;')!==false,'Rendered: its image as wide as its height makes it, never wider than its container (then contained), per device');
check(WPBN_Settings::object_sizes($lay(array('type'=>'image','fill_scene'=>false,'overlay_width_unit'=>'auto','height_unit'=>'auto')))['desktop'][1]===array(100,'%'),'Both Auto: the scene\'s height');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($objL)))),'--wpbn-iw')===false,'No Width Auto: as before');
check(strpos(file_get_contents(__DIR__.'/../assets/css/frontend.css'),'.wpbn-scene .wpbn-layer--object{max-width:var(--wpbn-mw,none)}'."\n".'.wpbn-scene .wpbn-layer--object img{width:var(--wpbn-iw,100%);max-width:100%}')!==false,'Its image\'s width on the site, never wider than its container');
// Attached to another layer (2026-11-13): its place per device chosen by the editor, kept to another layer of the scene, no circles.
$tA=array('type'=>'text','text'=>'Title','uid'=>'ttl1');
$bA=array('type'=>'button','button_text'=>'Go','uid'=>'btn1','anchor'=>'ttl1','anchor_desktop'=>array(50,100,50,0,0,24),'anchor_tablet'=>array(7,100,50,0,'x',2),'anchor_mobile'=>array(0,100,0,0,10,9000));
$att=WPBN_Settings::sanitize(array('layers'=>array($tA,$bA)));
$bS=$att['layers'][1];
check($bS['anchor']==='ttl1' && $bS['anchor_desktop']===array(50,100,50,0,0.0,24.0,0,0) && $bS['anchor_tablet']===null && $bS['anchor_mobile']===array(0,100,0,0,10.0,3000.0,0,0),'Attached: its place per device (edges 0 / 50 / 100, the offset within ±3000px; six numbers, as first saved: px; a broken one: none)');
check(WPBN_Settings::anchor_place(array(0,0,50,50,41.333,87.5,1,'1'))===array(0,0,50,50,41.33,87.5,1,1) && WPBN_Settings::anchor_place(array(0,0,50,50,1,2,5,0))===array(0,0,50,50,1.0,2.0,0,0),'On a picture: its spot as shares of it, per axis');
check(WPBN_Settings::sanitize(array('layers'=>array($bA)))['layers'][0]['anchor']==='','Attached to a layer not in the scene: not');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','uid'=>'shp1'),array_merge($bA,array('anchor'=>'shp1')))))['layers'][1]['anchor']==='','Not to a Shape');
$circle=WPBN_Settings::sanitize(array('layers'=>array(array_merge($tA,array('anchor'=>'btn1')),$bA)))['layers'];
check(($circle[0]['anchor']==='') !== ($circle[1]['anchor']===''),'A circle broken: one of them placed by its own Position again');
// A layer only leading into a circle (C on A, A on B, B on A) keeps its attachment; one of the circle is broken.
$into=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'text','uid'=>'aaaa','anchor'=>'bbbb'),array('type'=>'text','uid'=>'bbbb','anchor'=>'aaaa'),array('type'=>'button','uid'=>'cccc','anchor'=>'aaaa'))))['layers'];
check($into[2]['anchor']==='aaaa' && (($into[0]['anchor']==='') !== ($into[1]['anchor']==='')),'Leading into a circle: kept; the circle itself broken once');
// The layer attached to hidden on mobile (Show on): there it stands at its own Position, by its own point.
$hidM=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($tA,array('hide_mobile'=>true)),array_merge($bA,array('x'=>30,'y'=>70))))));
check(strpos($hidM,'&quot;at&quot;:[[0.5,1,0,24,0,0],null,null]')!==false && strpos($hidM,'--wpbn-anx-m:0.3;')!==false,'Its layer hidden on mobile: its own Position there');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','uid'=>'img1','fill_scene'=>true,'anchor'=>'ttl1'),$tA)))['layers'][0]['anchor']==='','A photo filling the scene on every device: not attachable');
$attHtml=WPBN_Render::markup($att);
check(strpos($attHtml,'data-uid="ttl1"')!==false && substr_count($attHtml,'data-uid=')===1,'The layer it is attached to carries its uid');
check(strpos($attHtml,'&quot;anchor&quot;:{&quot;to&quot;:&quot;ttl1&quot;,&quot;at&quot;:[[0.5,1,0,24,0,0],null,[0,1,10,3000,0,0]]}')!==false,'Its place per device for frontend.js (none on tablet: its Position there)');
check(strpos($attHtml,'--wpbn-anx:0.5;--wpbn-anx-t:0.5;--wpbn-anx-m:0;')!==false && strpos($attHtml,'--wpbn-any:0;--wpbn-any-t:0.5;--wpbn-any-m:0;')!==false,'Its own point per device (tablet: from its Position)');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($tA,array('hidden'=>true)),$bA)))),'anchor')===false,'Its layer hidden: at its own Position');
check(strpos(file_get_contents(__DIR__.'/../assets/css/frontend.css'),'var(--wpbn-mx,0px) + var(--wpbn-gx,0px)')!==false,'It takes its layer\'s motion on the site');
// A copy of it seen through a Shape object's window is placed by its layer too (lined up with it).
$copyHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($tA,array_merge($bA,array('type'=>'image','image'=>3,'fill_scene'=>false,'uid'=>'img9')),array('type'=>'shape','shape'=>900,'uid'=>'shp9','shape_objects'=>array(array('key'=>'o1','fill'=>'layer','source'=>'img9')))))));
check(substr_count($copyHtml,'&quot;anchor&quot;:{&quot;to&quot;:&quot;ttl1&quot;')===2,'A copy of it in a Shape object\'s window: placed by its layer too');
// Show on (2026-11-13): a layer hidden on some devices only.
check($img['hide_desktop']===false && $img['hide_tablet']===false && $img['hide_mobile']===false,'Show on: every device by default');
$hideM=$lay(array('type'=>'text','text'=>'Hi','hide_mobile'=>1,'hide_tablet'=>'false'));
check($hideM['hide_mobile']===true && $hideM['hide_tablet']===false,'Show on: kept per device');
$hideHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($hideM))));
check(strpos($hideHtml,'class="wpbn-layer wpbn-layer--text wpbn-layer--hide-m"')!==false,'Hidden on mobile: its class');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','text'=>'Hi','hide_desktop'=>1,'hide_tablet'=>1,'hide_mobile'=>1)))))),'wpbn-layer--text')===false,'Hidden on every device: not drawn');
check(strpos(file_get_contents(__DIR__.'/../assets/css/frontend.css'),'@media(max-width:767px){.wpbn-scene .wpbn-layer.wpbn-layer--hide-m{display:none!important}}')!==false,'Hidden there on the site');
// Fill the scene per device (2026-11-13): tablet and mobile null follow the larger screen.
check($img['fill_scene_tablet']===null && $img['fill_scene_mobile']===null && WPBN_Settings::fills_on($img)===array('desktop'=>true,'tablet'=>true,'mobile'=>true) && !WPBN_Settings::object($img),'Per device: inherited by default');
check($lay(array('type'=>'image','fill_scene_tablet'=>'','fill_scene_mobile'=>'0'))['fill_scene_mobile']===false && $lay(array('type'=>'image','fill_scene_tablet'=>''))['fill_scene_tablet']===null && $lay(array('type'=>'image','fill_scene_mobile'=>true))['fill_scene_mobile']===true,'Per device: saved as on, off or empty (inherit)');
$mix=$lay(array('type'=>'image','image'=>3,'fill_scene_mobile'=>false,'overlay_width'=>60,'height_unit'=>'auto','x'=>50,'y'=>50,'x_mobile'=>130,'y_mobile'=>20,'use_padding'=>1,'padding_top'=>8));
check(WPBN_Settings::fills_on($mix)===array('desktop'=>true,'tablet'=>true,'mobile'=>false) && WPBN_Settings::object($mix) && !WPBN_Settings::object($mix,'desktop') && WPBN_Settings::object($mix,'mobile') && WPBN_Settings::anchored($mix),'Mixed: fills on desktop and tablet, an object on mobile');
$mixE=WPBN_Settings::effective($mix);
check($mixE['x']==50 && $mixE['x_mobile']==100 && $mixE['y_mobile']==20,'Mixed: its Position within its container only where it is an object');
check(WPBN_Settings::paddings($mix)===array('desktop'=>'0px 0px 0px 0px','tablet'=>'0px 0px 0px 0px','mobile'=>'8px 0px 0px 0px'),'Mixed: Padding only where it is an object');
$mixHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($mix))));
check(strpos($mixHtml,'wpbn-layer--object')!==false && strpos($mixHtml,'--wpbn-oh:100%;--wpbn-oh-t:100%;--wpbn-oh-m:auto;')!==false && strpos($mixHtml,'--wpbn-width:100%;--wpbn-width-t:100%;--wpbn-width-m:60%;')!==false,'Mixed: the scene\'s size where it fills it, its own on mobile');
check(strpos($mixHtml,'--wpbn-anx:0.5;--wpbn-anx-t:0.5;--wpbn-anx-m:1;')!==false,'Mixed: centred where it fills, placed as a title on mobile');
check(strpos($mixHtml,'&quot;fill&quot;:[true,true,false]')!==false && strpos($mixHtml,'&quot;object&quot;:[false,false,true]')!==false,'Mixed: grown to hide its edges only where it fills the scene; where it is an object (Dev mode)');
$flip=WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'fill_scene'=>false,'fill_scene_tablet'=>true)))));
check(WPBN_Settings::fills_on($flip['layers'][0])===array('desktop'=>false,'tablet'=>true,'mobile'=>true),'An object on desktop, filling the scene on tablet and mobile (they follow tablet)');
// Scene settings, Attributes: its own id and classes on its block.
$attr=WPBN_Settings::sanitize(array('css_id'=>' #offer-1 ','css_class'=>'.hero  big-banner, hero bad"class <x>'));
check($attr['css_id']==='offer-1' && $attr['css_class']==='hero big-banner badclass x','Element ID and Extra class name cleaned ('.$attr['css_class'].')');
check(WPBN_Settings::sanitize(array('css_id'=>'1abc'))['css_id']==='' && WPBN_Settings::sanitize(array('css_id'=>'a b'))['css_id']==='' && WPBN_Settings::sanitize(array())['css_id']==='','An id must start with a letter, without spaces');
$attrHtml=WPBN_Render::markup($attr);
check(strpos($attrHtml,'<section id="offer-1" class="wpbn-scene hero big-banner badclass x"')!==false,'Rendered on the scene\'s block');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array())),'<section class="wpbn-scene"')!==false,'None: no id, no extra class');
// Shortcode: another plugin's element in the layer's place, its Width per device, placed as a title; not this plugin's own.
$sc=$lay(array('type'=>'shortcode','shortcode'=>' [wp_swiper id="12"]<script>x()</script>[wp_banner id="3"] ','overlay_width'=>80,'mobile_overlay_width'=>360,'mobile_overlay_width_unit'=>'px','x'=>130,'scale'=>200,'use_scale'=>true,'container'=>'theme'));
check($sc['shortcode']==='[wp_swiper id="12"]' && WPBN_Settings::effective($sc)['x']==100 && WPBN_Settings::effective($sc)['scale']==100,'A shortcode: kept without scripts or a banner in itself; placed within its container at 100% scale');
$scHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($sc))));
check(strpos($scHtml,'class="wpbn-layer wpbn-layer--shortcode"')!==false && strpos($scHtml,'<div class="demo-slider" data-shortcode="wp_swiper" style="height:120px">[wp_swiper id=&quot;12&quot;]</div></div>')!==false,'Rendered: the shortcode\'s output in the layer');
check(strpos($scHtml,'--wpbn-width:calc(var(--wpbn-cw) * 0.8);')!==false && strpos($scHtml,'--wpbn-width-m:360px;')!==false && strpos($scHtml,'--wpbn-anx:1;')!==false,'Its Width per device (% of its container, px), placed as a title');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shortcode','shortcode'=>'  '))))),'wpbn-layer--shortcode')===false,'Without a shortcode: not drawn');
$nested=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shortcode','shortcode'=>'[inner_banner]')))));
check(substr_count($nested,'wpbn-layer--shortcode')===1 && strpos($nested,'demo-slider')===false,'A banner its shortcode shows: no Shortcode layers of its own (no endless nesting)');
check(strpos($fcss=file_get_contents(__DIR__.'/../assets/css/frontend.css'),'.wpbn-scene .wpbn-layer--shortcode{height:auto;pointer-events:auto}')!==false,'It can be clicked and swiped');
// Button (as WP Top Info Bar's): text, link, a new window, Background, Corners, Size per device, colours; placed as a title.
$btn=$lay(array('type'=>'button','button_text'=>' Book <b>now</b> ','button_url'=>'https://x.test/book','button_new_tab'=>1,'button_style'=>'bordered','button_shape'=>'round','button_size'=>'large','button_size_tablet'=>'nope','button_size_mobile'=>'small','button_color'=>'#ff0000','button_text_color'=>'rgba(0,0,0,0.5)','x'=>150,'scale'=>200,'use_scale'=>true));
check($btn['type']==='button' && $btn['button_text']==='Book now' && $btn['button_url']==='https://x.test/book' && $btn['button_new_tab']===true && $btn['button_style']==='bordered' && $btn['button_shape']==='round' && $btn['button_size']==='large' && $btn['button_size_tablet']===null && $btn['button_size_mobile']==='small' && $btn['button_color']==='#ff0000' && $btn['button_text_color']==='rgba(0,0,0,0.5)','A button: its settings kept (a size not on the list: follows the larger screen)');
check(WPBN_Settings::effective($btn)['x']==100 && WPBN_Settings::effective($btn)['scale']==100 && WPBN_Settings::textual($btn),'A button: placed within its container, at 100% scale');
$plain=$lay(array('type'=>'button'));
check($plain['button_text']==='Learn more' && $plain['button_url']==='' && $plain['button_style']==='filled' && $plain['button_shape']==='square' && $plain['button_size']==='default' && $plain['button_color']==='#2271b1' && $plain['button_text_color']==='#ffffff','A new button: Learn more, filled, square, Default size, WP Top Info Bar\'s colours');
check($lay(array('type'=>'button','button_url'=>'javascript:alert(1)'))['button_url']==='' && $lay(array('type'=>'button','button_url'=>'/contact/'))['button_url']==='/contact/' && $lay(array('type'=>'button','button_url'=>'tel:+380501234567'))['button_url']==='tel:+380501234567','Its link: no javascript:; paths, mailto: and tel: kept');
$btnHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($btn))));
check(strpos($btnHtml,'class="wpbn-layer wpbn-layer--button"')!==false && strpos($btnHtml,'<a class="wpbn-button wpbn-button--bordered wpbn-button--round" href="https://x.test/book" target="_blank" rel="noopener noreferrer">Book now</a>')!==false,'Rendered: a link in a new window, its Background and Corners');
check(strpos($btnHtml,'--wpbn-bc:#ff0000;--wpbn-bt:rgba(0,0,0,0.5);')!==false && strpos($btnHtml,'--wpbn-bp:5px 28px;--wpbn-bh:48px;--wpbn-bf:14px;--wpbn-bp-t:5px 28px;')!==false && strpos($btnHtml,'--wpbn-bp-m:5px 14px;--wpbn-bh-m:36px;--wpbn-bf-m:12px;')!==false && strpos($btnHtml,'--wpbn-anx:1;')!==false,'Its colours, its Size per device (tablet following desktop), placed as a title');
$noLink=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'button','button_text'=>'Hi')))));
check(strpos($noLink,'<span class="wpbn-button wpbn-button--filled wpbn-button--square">Hi</span>')!==false,'Without a link: a span');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'button','button_text'=>'  ','button_url'=>'/x'))))),'wpbn-layer--button')===false,'Without text: not drawn');
$fcss=file_get_contents(__DIR__.'/../assets/css/frontend.css');
check(strpos($fcss,'.wpbn-scene a.wpbn-button{pointer-events:auto')!==false && strpos($fcss,'--wpbn-bp-m,var(--wpbn-bp')!==false,'A link button can be clicked; its size per device');
// No Width (%) setting: titles and images as wide as their container. An overlay: its own Width per device
// (as its Height: % of its container, px or vw).
check(WPBN_Settings::effective($lay(array('type'=>'text','width'=>60)))['width']==100 && WPBN_Settings::effective($lay(array('type'=>'image','width'=>60)))['width']==100,'Titles and images as wide as their container');
$ow=$lay(array('type'=>'overlay','overlay_width'=>50,'overlay_width_unit'=>'%','tablet_overlay_width'=>9000,'tablet_overlay_width_unit'=>'px','mobile_overlay_width'=>150,'mobile_overlay_width_unit'=>'vw'));
check(WPBN_Settings::heights($ow, WPBN_Settings::OVERLAY_WIDTHS)==array('desktop'=>array(50,'%'),'tablet'=>array(3000,'px'),'mobile'=>array(100,'vw')),'An overlay\'s Width: %, px or vw per device, bounded');
check(WPBN_Settings::heights($lay(array('type'=>'overlay','overlay_width_unit'=>'vh','tablet_overlay_width'=>40)), WPBN_Settings::OVERLAY_WIDTHS)==array('desktop'=>array(100,'%'),'tablet'=>array(100,'%'),'mobile'=>array(100,'%')),'All of its container by default; a number without a unit follows');
$owHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($ow,array('container'=>'custom','container_width'=>900))))));
check(strpos($owHtml,'--wpbn-width:calc(var(--wpbn-cw) * 0.5);--wpbn-width-t:3000px;--wpbn-width-m:100vw;')!==false && substr_count($owHtml,'--wpbn-width:')===1,'Rendered: a share of its container, px, vw');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'overlay','overlay_width'=>30))))),'--wpbn-width:30%;')!==false,'Full width: a share of the scene');
// Animation (WPBN_Animation): off by default; its kind, start / end and duration per device, Starts, Repeat, Easing, Delay, Direction.
$plainLayer=$lay(array('type'=>'image','image'=>3));
check($plainLayer['use_anim']===false && $plainLayer['anim_type']==='zoom' && $plainLayer['anim_start']==='load' && strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($plainLayer)))),'wpbn-anim')===false,'No Animation by default: no wrapper');
$an=$lay(array('type'=>'text','use_anim'=>1,'anim_type'=>'zoom','anim_from'=>80,'anim_to'=>100,'anim_to_mobile'=>95,'anim_duration'=>3,'anim_start'=>'visible','anim_repeat'=>'once','anim_easing'=>'ease-out','anim_delay'=>0.55,'anim_origin'=>'bottom'));
check($an['anim_to_mobile']==95 && $an['anim_delay']==0.6 && $an['anim_origin']==='bottom','Its values kept (Delay to 0.1 s)');
$anHtml=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($an))));
check(strpos($anHtml,'<div class="wpbn-anim wpbn-anim--zoom wpbn-anim--once wpbn-anim--visible" style="--wpbn-a0-d:0.8;--wpbn-a1-d:1;--wpbn-ad-d:3s;--wpbn-a0-t:0.8;--wpbn-a1-t:1;--wpbn-ad-t:3s;--wpbn-a0-m:0.8;--wpbn-a1-m:0.95;--wpbn-ad-m:3s;animation-delay:0.6s;transform-origin:center bottom;animation-timing-function:ease-out;"><h2>')!==false,'Rendered: the content wrapped, its values per device, Direction, Delay, Easing ('.$anHtml.')');
$bad=$lay(array('type'=>'image','image'=>3,'use_anim'=>1,'anim_type'=>'spin','anim_start'=>'x','anim_repeat'=>'x','anim_easing'=>'x','anim_origin'=>'x','anim_from'=>50,'anim_to'=>120));
check($bad['anim_type']==='zoom' && $bad['anim_start']==='load' && $bad['anim_repeat']==='alternate' && $bad['anim_easing']==='ease-in-out' && $bad['anim_origin']==='center','Unknown choices: the defaults');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($bad)))),'--wpbn-a0-d:1;--wpbn-a1-d:1.2;')!==false,'An image filling the scene zooms from 100% at least (its edges never show)');
$fade=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','use_anim'=>1,'anim_type'=>'fade','anim_from'=>-20,'anim_to'=>150))))));
check(strpos($fade,'wpbn-anim--fade')!==false && strpos($fade,'--wpbn-a0-d:0;--wpbn-a1-d:1;')!==false,'Fade: an opacity, 0–100%');
$slide=WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'use_anim'=>1,'anim_type'=>'slide-x','anim_from'=>-60,'anim_to'=>0)))));
$slideHtml=WPBN_Render::markup($slide);
check(strpos($slideHtml,'--wpbn-a0-d:-60px;--wpbn-a1-d:0px;')!==false && motion_of($slideHtml,0)['slack']===array(array(75,75,75),array(0,0,0)),'Slide: px, and room for it so a photo\'s edges stay hidden');
// An overlay (2026-11-10): Zoom and the slides around its box, not Fade (it would cut its blur off).
$overAnim=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','use_anim'=>1,'anim_type'=>'slide-x','backdrop_blur'=>6))))));
check(preg_match('/class="wpbn-anim wpbn-anim--slide-x[^"]*"[^>]*><div class="wpbn-overlay wpbn-layer--blur/',$overAnim)===1,'An overlay slides, its blurring box inside');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','use_anim'=>1,'anim_type'=>'fade')))))),'wpbn-anim')===false,'No Fade for an overlay');
$animCss=file_get_contents(__DIR__.'/../assets/css/frontend.css');
foreach (array('zoom','fade','slide-x','slide-y') as $kind) { check(strpos($animCss,'.wpbn-scene .wpbn-anim--'.$kind.'{animation-name:wpbn-'.$kind.'}')!==false && strpos($animCss,'@keyframes wpbn-'.$kind.'{')!==false,'Keyframes for '.$kind); }
check(strpos($animCss,"@supports (-moz-appearance:none){
@keyframes wpbn-zoom{from{transform:perspective(1000px) translateZ(calc(1000px - 1000px / var(--wpbn-a0,1)))}")!==false && strpos($animCss,'will-change:')===false && strpos($animCss,'rotate(.01deg)')===false,'Smooth slow zooms in Firefox: drawn in perspective (no snapping to whole pixels), no layer hints');
check(strpos($animCss,'.wpbn-scene:not(.wpbn-scene--seen) .wpbn-anim--visible,.wpbn-scene.wpbn-scene--away .wpbn-anim{animation-play-state:paused}')!==false && strpos($animCss,'.wpbn-scene .wpbn-anim{animation:none}')!==false,'Waits until in view, paused off the screen, none with reduced motion');
// Follow the mouse: per layer, an overlay never. No Decorative switch (removed at the user's request, 2026-11-09).
// Follow the mouse: no switch since 2026-11-09 (always on, 0 by default); saved with it off: 0.
$m=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','use_mouse'=>1,'mouse'=>500)),$lay(array('type'=>'overlay','use_mouse'=>1,'mouse'=>30)),$lay(array('type'=>'text','use_mouse'=>0,'mouse'=>30)),$lay(array('type'=>'text','mouse'=>30))))));
check(motion_of($m,0)['mouse']==200 && motion_of($m,1)['mouse']==0 && motion_of($m,2)['mouse']==0 && motion_of($m,3)['mouse']==30 && WPBN_Settings::layer()['mouse']===0,'Follow the mouse: bounded, not for an overlay, 0 where it was switched off, 0 for a new layer');
check(strpos($animCss,'+ var(--wpbn-mx,0px) + var(--wpbn-gx,0px)),calc(var(--wpbn-dy,0px) + var(--wpbn-ky,0px) + var(--wpbn-my,0px) + var(--wpbn-gy,0px))')!==false,'The pointer\'s offset in the layer\'s place (and an attached layer\'s, its layer\'s motion)');
check(!array_key_exists('decorative',$lay(array('type'=>'image','decorative'=>1))),'No Decorative switch: an image\'s alt text is the media library\'s');
// Rotation (per device, degrees; 2026-11-09): bounded, its CSS per device, in the layer's transform; a Shape layer is not turned.
$rot=WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','rotate'=>-400,'rotate_mobile'=>15)),$lay(array('type'=>'shape','rotate'=>30)))));
check($rot['layers'][0]['rotate']==-180 && $rot['layers'][0]['rotate_tablet']===null && $rot['layers'][0]['rotate_mobile']==15,'Rotation bounded, per device');
$rotm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'rotate'=>10,'rotate_mobile'=>-5))))));
check(strpos($rotm,'--wpbn-rot:10deg;--wpbn-rot-t:10deg;--wpbn-rot-m:-5deg;')!==false && motion_of($rotm,0)['box_rotate']==array(10,10,-5),'Rotation rendered per device, and for frontend.js (a turned photo grows to hide its corners)');
check($lay(array('type'=>'text','rotate'=>30,'use_rotate'=>0))['rotate']==0 && $lay(array('type'=>'text','rotate'=>30))['rotate']==30 && $lay(array('type'=>'text'))['use_rotate']===true && WPBN_Settings::layer()['use_scale']===true,'Rotation without a switch: one saved switched off at rest; a turn saved before the switch kept');
check(WPBN_Settings::effective($rot['layers'][1])['rotate']===0 && strpos($animCss,',0) rotate(var(--wpbn-r)) scale(')!==false && strpos($animCss,'--wpbn-r:var(--wpbn-rot-m,var(--wpbn-rot,0deg))')!==false,'A Shape layer not turned; the turn in the layer\'s transform, per device');
// An image's Shadow (the title's keys): drop-shadow along its outline, only with its switch on.
$sh=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'use_shadow'=>1,'shadow_x'=>4,'shadow_y'=>12,'shadow_blur'=>24,'shadow_color'=>'rgba(0,0,0,0.4)')),$lay(array('type'=>'image','image'=>3,'shadow_y'=>12))))));
check(substr_count($sh,'wpbn-layer--shadow')===1 && strpos($sh,'--wpbn-ds:4px 12px 24px rgba(0,0,0,0.4);')!==false,'Image Shadow: its values, only with its switch on');
check(strpos($animCss,'.wpbn-scene .wpbn-layer--shadow img{filter:drop-shadow(var(--wpbn-ds))}')!==false,'Drawn along the outline of the image');
// An overlay's Shadow: around its box, or Inside it (a vignette); only with its switch on.
$osh=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','use_shadow'=>1,'shadow_y'=>8,'shadow_blur'=>30)),$lay(array('type'=>'overlay','use_shadow'=>1,'shadow_inset'=>1,'shadow_blur'=>120,'shadow_color'=>'rgba(0,0,0,0.6)')),$lay(array('type'=>'overlay','shadow_inset'=>1))))));
check(strpos($osh,'box-shadow:0px 8px 30px rgba(0,0,0,0.5);')!==false && strpos($osh,'box-shadow:inset 0px 2px 120px rgba(0,0,0,0.6);')!==false && substr_count($osh,'box-shadow')===2,'Overlay Shadow: around it or Inside, only with its switch on');
// An overlay's fill in a box of its own (2026-11-09), so its Entrance animation brings it in.
$oen=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','color'=>'#ff0000','backdrop_blur'=>8,'use_enter'=>1,'enter_type'=>'fade','enter_delay'=>2,'enter_start'=>'load'))))));
check(strpos($oen,'<div class="wpbn-overlay wpbn-layer--blur wpbn-enter wpbn-enter--fade" style="background:#ff0000;--wpbn-ed:1s;--wpbn-edl:2s;"></div>')!==false && substr_count($oen,'wpbn-enter')===2,'An overlay: its fill in a box that its Entrance animation brings in (no wrapper: its blur would see nothing)');
// Border (Effect, 2026-11-09): behind its switch; a width per side and device (bounded, tablet / mobile following), its line and colour.
$bd=$lay(array('type'=>'image','image'=>3,'use_border'=>1,'border_top'=>4,'border_right'=>500,'border_bottom'=>0,'border_left'=>-3,'border_left_tablet'=>8,'border_style'=>'groove','border_color'=>'#ff0000'));
check($bd['border_right']===100 && $bd['border_left']===0 && $bd['border_style']==='solid' && $bd['border_linked']===true && $bd['border_top_mobile']===null && WPBN_Settings::layer()['use_border']===false,'Border: widths bounded, unknown line solid, linked by default, off for a new layer');
check(WPBN_Settings::borders($bd)===array('desktop'=>'4px 100px 0px 0px','tablet'=>'4px 100px 0px 8px','mobile'=>'4px 100px 0px 8px') && WPBN_Settings::borders($lay(array('use_border'=>0)))==='' && WPBN_Settings::borders($lay(array('use_border'=>1,'border_top'=>0,'border_right'=>0,'border_bottom'=>0,'border_left'=>0)))==='','Its widths per device (following the larger screen); off or none: no border');
$bdm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($bd))));
check(strpos($bdm,'wpbn-layer--border')!==false && strpos($bdm,'--wpbn-brw:4px 100px 0px 0px;--wpbn-brw-t:4px 100px 0px 8px;--wpbn-brw-m:4px 100px 0px 8px;--wpbn-brs:solid;--wpbn-brc:#ff0000;')!==false && strpos($animCss,'.wpbn-scene .wpbn-layer--border.wpbn-layer--image img')!==false,'Rendered: on the picture, per device');
// Radius (Effect, 2026-11-09): behind its switch; per corner and device, px or % (one unit per corner), bounded by its unit.
$rd=$lay(array('type'=>'image','image'=>3,'use_radius'=>1,'radius_tl'=>24,'radius_tr'=>5000,'radius_br'=>80,'radius_br_unit'=>'%','radius_bl'=>0,'radius_bl_unit'=>'em','radius_tl_mobile'=>8));
check($rd['radius_tr']===1000 && $rd['radius_br']===50 && $rd['radius_bl_unit']==='px' && $rd['radius_linked']===true && WPBN_Settings::layer()['use_radius']===false,'Radius: bounded by its unit (px 1000, % 50), unknown unit px, linked by default, off for a new layer');
check(WPBN_Settings::radii($rd)===array('desktop'=>'24px 1000px 50% 0px','tablet'=>'24px 1000px 50% 0px','mobile'=>'8px 1000px 50% 0px') && WPBN_Settings::radii($lay(array('use_radius'=>0)))==='','Its corners per device (following the larger screen); off: none');
$rdm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($rd))));
check(strpos($rdm,'wpbn-layer--radius')!==false && strpos($rdm,'--wpbn-brr:24px 1000px 50% 0px;--wpbn-brr-t:24px 1000px 50% 0px;--wpbn-brr-m:8px 1000px 50% 0px;')!==false && strpos($animCss,'.wpbn-scene .wpbn-layer--radius.wpbn-layer--image img')!==false,'Rendered: on the picture, per device');
// Padding (Size, 2026-11-09): a title, a text, a button, a shortcode or an image object; per side and device, px or % (bounded).
$pd=$lay(array('type'=>'text','use_padding'=>1,'padding_top'=>20,'padding_right'=>9000,'padding_left'=>80,'padding_left_unit'=>'%','padding_bottom_unit'=>'em','padding_top_mobile'=>8));
check($pd['padding_right']===500 && $pd['padding_left']===50 && $pd['padding_bottom_unit']==='px' && $pd['padding_linked']===true && WPBN_Settings::layer()['padding_top']===0 && WPBN_Settings::layer()['use_padding']===false,'Padding: bounded by its unit (px 500, % 50), unknown unit px, linked, off and 0 by default');
check($lay(array('type'=>'text','padding_left'=>10))['use_padding']===true && $lay(array('type'=>'text'))['use_padding']===false && WPBN_Settings::paddings($lay(array('type'=>'text','use_padding'=>0,'padding_top'=>20)))==='','Its switch: saved before it, on where a side has space; off: none');
check(WPBN_Settings::paddings($pd)===array('desktop'=>'20px 500px 0px 50%','tablet'=>'20px 500px 0px 50%','mobile'=>'8px 500px 0px 50%') && WPBN_Settings::paddings($lay(array('type'=>'image','image'=>3,'padding_top'=>20)))==='' && WPBN_Settings::paddings($lay(array('type'=>'overlay','padding_top'=>20)))==='' && WPBN_Settings::paddings($lay(array('type'=>'text')))==='','Its sides per device; none for a photo filling the scene, an overlay, or at 0');
check(WPBN_Settings::paddings($lay(array('type'=>'image','image'=>3,'fill_scene'=>0,'use_padding'=>1,'padding_top'=>6)))['desktop']==='6px 0px 0px 0px','An image object has one');
$pdm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($pd))));
check(strpos($pdm,'wpbn-layer--padding')!==false && strpos($pdm,'--wpbn-pad:20px 500px 0px 50%;--wpbn-pad-t:20px 500px 0px 50%;--wpbn-pad-m:8px 500px 0px 50%;')!==false && strpos($animCss,'.wpbn-scene .wpbn-layer--padding{box-sizing:border-box;padding:var(--wpbn-pad)}')!==false,'Rendered per device');
// A title's or a Text layer's Width: Auto (as before), % of its container, px or vw, per device.
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text')))))),'--wpbn-tw')===false,'Width Auto by default: nothing set');
$tw=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'richtext','content'=>'<p>a</p>','container'=>'custom','text_width'=>60,'text_width_unit'=>'%','mobile_text_width_unit'=>'auto'))))));
check(strpos($tw,'--wpbn-tw:calc(var(--wpbn-cw) * 0.6);--wpbn-tw-t:calc(var(--wpbn-cw-t, var(--wpbn-cw)) * 0.6);--wpbn-tw-m:max-content;')!==false,'Its Width per device ('.$tw.')');
check($lay(array('type'=>'text','text_width_unit'=>'em'))['text_width_unit']==='auto' && strpos($animCss,'.wpbn-scene .wpbn-layer--text{width:var(--wpbn-tw,max-content)')!==false,'An unknown unit: Auto');
// Scroll animation: no switch since 2026-11-09 (user's request): always on. A layer saved before the switches: what was off at rest;
// one saved with it off: all of it at rest (each moves as it did).
$sc=WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'text','move_y'=>-50,'use_move_y'=>1,'zoom'=>40,'use_zoom'=>0,'end_opacity'=>0,'use_end_opacity'=>0),
    array('type'=>'text','use_scroll'=>0,'move_y'=>-50,'use_move_y'=>1),
    array('type'=>'text','use_scroll'=>1,'move_x'=>30,'end_opacity'=>20))));
check($sc['layers'][0]['use_scroll'] && $sc['layers'][0]['use_zoom'] && $sc['layers'][0]['zoom']==0 && $sc['layers'][0]['move_y']==-50 && $sc['layers'][0]['end_opacity']==100,'Scroll animation: a layer from before on, what was off at rest');
check($sc['layers'][1]['use_move_y'] && $sc['layers'][1]['move_y']==0 && $sc['layers'][2]['use_move_x'] && $sc['layers'][2]['use_end_opacity'] && WPBN_Settings::layer()['use_scroll']===true && WPBN_Settings::layer()['end_opacity']===100,'Scroll animation: always on; switched off before: at rest; "as it is" for a new layer');
$scm=WPBN_Render::markup($sc);
check(motion_of($scm,1)['move_y']==array(0,0,0) && motion_of($scm,2)['move_x']==array(30,30,30) && motion_of($scm,2)['fade']==array(-80,-80,-80) && WPBN_Settings::sanitize($sc)==$sc,'Scroll animation rendered as set (at rest where it was switched off); idempotent');
// Entrance animation (WPBN_Entrance, 2026-11-09): once, around the Loop animation; off by default; not for a Shape layer.
$en=$lay(array('type'=>'text','use_enter'=>1,'enter_type'=>'slide-up','enter_distance'=>2000,'enter_duration'=>0,'enter_delay'=>1.25,'enter_start'=>'never','enter_easing'=>'bounce','use_anim'=>1,'anim_type'=>'fade'));
check($en['enter_distance']==1000 && $en['enter_duration']==0.1 && $en['enter_delay']==1.3 && $en['enter_start']==='visible' && $en['enter_easing']==='ease-out' && $lay(array('type'=>'text'))['use_enter']===false && $lay(array('enter_type'=>'spin'))['enter_type']==='fade','Entrance: bounded, allow-listed, off by default');
$enm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($en))));
check(preg_match('/<div class="wpbn-enter wpbn-enter--slide wpbn-enter--visible" style="--wpbn-ed:0.1s;--wpbn-edl:1.3s;--wpbn-ex:0px;--wpbn-ey:1000px;"><div class="wpbn-anim wpbn-anim--fade/',$enm)===1,'Entrance: a slide up, from below, around the Loop animation ('.$enm.')');
$enz=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'use_enter'=>1,'enter_type'=>'slide-left','enter_distance'=>80)),$lay(array('type'=>'image','image'=>3,'use_enter'=>1,'enter_type'=>'zoom','enter_scale'=>120,'enter_start'=>'load'))))));
check(motion_of($enz,0)['slack'][0]==array(100,100,100) && strpos($enz,'class="wpbn-enter wpbn-enter--zoom" style="--wpbn-ed:1s;--wpbn-es:1.2;"')!==false,'Entrance: a photo filling the scene grows by a slide\'s distance; a zoom from its start size');
// More kinds (2026-11-09, user's request; Woodmart's choices in our own CSS): from an edge (a screen away until frontend.js
// measures; a photo is not grown for it), flips, Rotate Z.
$ee=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'use_enter'=>1,'enter_type'=>'edge-left','enter_start'=>'load')),$lay(array('type'=>'text','use_enter'=>1,'enter_type'=>'flip-y-right','enter_start'=>'load')),$lay(array('type'=>'text','use_enter'=>1,'enter_type'=>'edge-bottom','enter_start'=>'load'))))));
$eePlain=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3))))));
check(strpos($ee,'class="wpbn-enter wpbn-enter--edge wpbn-enter--edge-left" style="--wpbn-ed:1s;--wpbn-ex:-100vw;"')!==false && strpos($ee,'class="wpbn-enter wpbn-enter--flip-y-right"')!==false && strpos($ee,'wpbn-enter--edge-bottom" style="--wpbn-ed:1s;--wpbn-ey:100vh;"')!==false,'Entrance: from an edge (a screen away until measured), a flip');
check(motion_of($ee,0)['slack']==motion_of($eePlain,0)['slack'] && count(WPBN_Entrance::editor()['types'])===15 && !array_diff_key(WPBN_Entrance::TYPES,WPBN_Entrance::editor()['types']),'From an edge: the photo not grown for it; every kind named in the editor');
check(strpos($animCss,'@keyframes wpbn-enter-edge{from{transform:translate(var(--wpbn-ex,0px),var(--wpbn-ey,0px))}}')!==false && strpos($animCss,'@keyframes wpbn-enter-rotate-z{')!==false && strpos($animCss,'@keyframes wpbn-enter-flip-x-bottom{')!==false,'Their keyframes');
check(WPBN_Settings::effective($lay(array('type'=>'shape','use_enter'=>1)))['use_enter']===true && strpos($animCss,'@keyframes wpbn-enter-slide{from{opacity:0;transform:translate(var(--wpbn-ex,0px),var(--wpbn-ey,0px))}}')!==false && strpos($animCss,'.wpbn-scene:not(.wpbn-scene--seen) .wpbn-enter--visible')!==false,'Entrance: a Shape layer keeps it (its objects\' windows: WPBN_Shape::layer_entrance()); its keyframes; In view waits');
// Text animation (WPBN_Text_Animation, 2026-11-11): a title's letters or words one after another; off by default; only titles.
$ta=$lay(array('type'=>'text','use_text_anim'=>1,'text_anim_type'=>'drop','text_anim_duration'=>9,'text_anim_stagger'=>0.123,'text_anim_delay'=>-2,'text_anim_easing'=>'bounce','text_anim_order'=>'spiral','text_anim_by'=>'lines','text_anim_blur'=>99,'text_anim_distance'=>70,'text_anim_start'=>'load'));
check($ta['text_anim_duration']==5 && $ta['text_anim_stagger']==0.12 && $ta['text_anim_delay']==0 && $ta['text_anim_easing']==='smooth' && $ta['text_anim_order']==='start' && $ta['text_anim_by']==='letters' && $ta['text_anim_blur']==40
    && $lay(array('type'=>'text'))['use_text_anim']===false && $lay(array('type'=>'text','text_anim_type'=>'spin'))['text_anim_type']==='fade','Text animation: bounded, allow-listed, off by default');
$tam=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($ta,array('text'=>"Big <u>sk</u>y\nA&B"))))));
check(strpos($tam,'class="wpbn-ta wpbn-ta--drop" style="--wpbn-tad:5s;--wpbn-tas:0.12s;--wpbn-tae:cubic-bezier(.215,.61,.355,1);--wpbn-tab:40px;--wpbn-tay:70px;')!==false,'Text animation: the kind and its look on the title ('.$tam.')');
check(strpos($tam,'<span class="wpbn-sr">Big sky A&amp;B</span><span class="wpbn-ta-text" aria-hidden="true">')!==false && substr_count($tam,'class="wpbn-ta-u"')===9 && strpos($tam,'">&amp;</span>')!==false,'Text animation: readers get the whole title; each letter a piece; the text escaped');
check(strpos($tam,'<span class="wpbn-ta-w"><u><span class="wpbn-ta-u" style="--o:3;">s</span><span class="wpbn-ta-u" style="--o:4;">k</span></u><span class="wpbn-ta-u" style="--o:5;">y</span></span><br>')!==false,'Text animation: an accent inside a word nests; a line break kept');
$taw=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($ta,array('text'=>'One two three four five','text_anim_by'=>'words','text_anim_order'=>'end')),array_merge($ta,array('text'=>'abcdefghij','text_anim_type'=>'scatter','text_anim_order'=>'random')),array_merge($ta,array('type'=>'image','image'=>3)),array_merge($ta,array('text'=>'abcde','text_anim_order'=>'center'))))));
preg_match_all('/--o:(\d+);/',$taw,$orders);
check(array_slice($orders[1],0,5)===array('4','3','2','1','0') && strpos($taw,'<span class="wpbn-ta-w"><span class="wpbn-ta-u" style="--o:4;">One</span></span>')!==false,'Text animation by words, right to left');
$random=array_map('intval',array_slice($orders[1],5,10)); $sorted=$random; sort($sorted);
check($sorted===range(0,9) && $random!==range(0,9) && preg_match_all('/--r:-?[01](\.\d+)?;/',$taw)===10,'Random order: each place once, shuffled; Scatter: a height for each letter');
check(array_slice($orders[1],15,5)===array('2','1','0','1','2'),'From the middle: the middle letter first');
$scatterAgain=WPBN_Text_Animation::split('abcdefghij',WPBN_Settings::sanitize(array('layers'=>array(array_merge($ta,array('text_anim_type'=>'scatter','text_anim_order'=>'random')))))['layers'][0]);
check(strpos($taw,$scatterAgain)!==false && strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($ta,array('type'=>'image','image'=>3)))))),'class="wpbn-ta')===false,'The same title drawn the same every time; not for images');
check(strpos($animCss,'@keyframes wpbn-ta-unfold{from{opacity:0;clip-path:inset(50% 0 50% 0)')!==false && strpos($animCss,'.wpbn-scene:not(.wpbn-scene--seen) .wpbn-ta--visible .wpbn-ta-u{animation-play-state:paused}')!==false && strpos($animCss,'@media(prefers-reduced-motion:reduce){.wpbn-scene .wpbn-ta-u{animation:none}')!==false,'Text animation: keyframes, In view, reduced motion');
// No flicker (2026-11-11): moves in perspective (Chrome stepped a flat one by whole pixels), Pop's size so only in Firefox; the end kept.
check(strpos($animCss,'@keyframes wpbn-ta-drop{from{opacity:0;transform:perspective(1000px) translate3d(0,calc(-1 * var(--wpbn-tay,70px)),0)')!==false && strpos($animCss,'to{opacity:1;transform:perspective(1000px) translate3d(0,0,0);filter:blur(0px)}}')!==false
    && strpos($animCss,'@keyframes wpbn-ta-scatter{from{opacity:0;transform:perspective(1000px) translate3d(')!==false && strpos($animCss,'@supports (-moz-appearance:none){@keyframes wpbn-ta-pop{from{opacity:0;transform:perspective(1000px) translateZ(calc(1000px - 1000px / var(--wpbn-taz,.3)))')!==false
    && strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array_merge($ta,array('text'=>'A','text_anim_type'=>'pop','text_anim_scale'=>0)))))),'--wpbn-taz:0.01;')!==false,'Text animation: moves in perspective, Pop\'s in Firefox; its start size at least 1%');
foreach (array_keys(WPBN_Text_Animation::KINDS) as $kind) { check(strpos($animCss,'.wpbn-ta--'.$kind.' .wpbn-ta-u{animation-name:wpbn-ta-'.$kind.'}')!==false && isset(WPBN_Text_Animation::editor()['types'][$kind]),'Text animation '.$kind.': its keyframes and its name in the editor'); }
// Shape layers (WPBN_Shape): an SVG read as objects, only their shapes kept; each object a window onto its fill.
$sp=WPBN_Shape::parse('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><style>.st0{fill:#878787}.h{fill-rule:evenodd}</style></defs><rect class="st0" x="400" y="275" width="200" height="450"/><rect class="st0" x="700" y="275" width="200" height="450"/><path class="h" data-name="Ring" d="M0 0H100V100H0Z M25 25H75V75H25Z"/></svg>');
check(array_column($sp['objects'],'key')===array('o1','o2','o3') && $sp['objects'][2]['name']==='Ring' && $sp['viewbox']===array(0.0,0.0,1000.0,1000.0),'Shape: its objects in the file\'s order, with their names');
check(strpos($sp['objects'][2]['markup'],'clip-rule="evenodd"')!==false && strpos(WPBN_Shape::svg($sp),'class=')===false && strpos(WPBN_Shape::svg($sp),'878787')===false,'Shape: holes kept, colours and classes left out');
$se=WPBN_Shape::parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><g transform="translate(1,1)"><rect width="5" height="5" onclick="alert(3)" style="fill:url(javascript:alert(4))"/><text>Hi</text><use href="#a"/><rect width="2" height="2" transform="rotate(1) url(x)"/></g></svg>');
check(!preg_match('/script|on\w+=|javascript|href|style|url\(/i',WPBN_Shape::svg($se)) && count($se['objects'])===1 && $se['skipped']===array('text'=>1,'use'=>1,'other'=>1),'Shape: no scripts, events, links or styles; text, <use> and an unreadable transform left out and counted ('.json_encode($se['skipped']).')');
check(strpos($se['objects'][0]['markup'],'<g transform="translate(1,1)"><rect')===0,'Shape: a group around everything looked into, its transform kept');
check(is_wp_error(WPBN_Shape::parse('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="&x;" height="1"/></svg>')) && is_wp_error(WPBN_Shape::parse('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')) && is_wp_error(WPBN_Shape::parse('nope')),'Shape: no DOCTYPE; a size and an SVG needed');
$sr=WPBN_Shape::parse(WPBN_Shape::svg($sp),true);
check(array_column($sr['objects'],'key')===array_column($sp['objects'],'key') && array_column($sr['objects'],'markup')===array_column($sp['objects'],'markup') && $sr['objects'][2]['name']==='Ring','Shape: an exported SVG read back as it was (scene export / import)');
// A black and white photo; a Shape layer whose middle strip shows the photo in colour, with an edge and a shadow.
$ss=WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'image','image'=>3,'uid'=>'lphoto01','f_grayscale'=>100,'use_move_y'=>1,'move_y'=>-80),
    array('type'=>'shape','shape'=>900,'shape_fit'=>'contain','shape_fit_mobile'=>'stretch','use_move_y'=>1,'move_y'=>-50,'use_anim'=>1,'uid'=>'BAD UID','shape_objects'=>array(
        array('key'=>'o1','name'=>'Middle','fill'=>'layer','source'=>'lphoto01','f_brightness'=>110,'stroke'=>6,'use_shadow'=>1,'use_scroll'=>1,'move_y'=>-40,'bogus'=>'<b>'),
        array('key'=>'o2','fill'=>'glass','glass_blur'=>99,'stroke'=>5,'use_shadow'=>1,'use_scroll'=>0,'move_x'=>70),
        array('key'=>'o3','fill'=>'color','color'=>'red;}','invert'=>1,'opacity'=>50,'hidden'=>1),
        array('key'=>'zz'),array('key'=>'o1','fill'=>'none'))))));
$so=$ss['layers'][1]['shape_objects'];
check(array_column($so,'key')===array('o1','o2','o3') && !isset($so[0]['bogus']) && $so[1]['glass_blur']===60.0 && $so[2]['color']==='#ffffff' && $so[2]['name']==='Left strip','Shape objects: only the file\'s, each once, values checked, names from the file');
check($ss['layers'][0]['uid']==='lphoto01' && $ss['layers'][1]['uid']==='' && $ss['layers'][1]['shape_fit_mobile']==='stretch' && $ss['layers'][1]['shape_fit_tablet']===null,'A layer uid allow-listed; Fit per device');
check(WPBN_Settings::sanitize($ss)==$ss,'Shape layers: sanitization idempotent');
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>5,'shape_objects'=>array(array('key'=>'o1'))))))['layers'][0]['shape']===0,'A Shape layer without this site\'s SVG: none');
$sm=WPBN_Render::markup($ss);
check(substr_count($sm,'class="wpbn-shape-item"')===2 && strpos($sm,'wpbn-shape-clip--invert')===false,'Shape: hidden objects not drawn');
// The whole Shape's motion (2026-11-10): its travel for frontend.js, its Loop animation around its objects, the layer itself in place.
check(motion_of($sm,1)['move_y']===array(-50,-50,-50) && strpos($sm,'><div class="wpbn-shape-all wpbn-anim wpbn-anim--zoom wpbn-anim--alternate" style="--wpbn-a0-d:1;--wpbn-a1-d:1.1;')!==false && strpos($sm,'--wpbn-left:50%;')!==false,'The Shape layer: its travel and Loop animation move its objects\' windows, the layer stays in place');
check(motion_of($sm,2)['move_y']===array(-80,-80,-80) && preg_match('/wpbn-shape-clip"><div class="wpbn-shape-fill"><div class="wpbn-layer wpbn-layer--image wpbn-layer--filter"[^>]*--wpbn-filter:brightness\(110%\);/',$sm)===1,'Fill Photo: a copy of the layer, moving as it does, with the object\'s filters instead of its own');
check(strpos($sm,'--wpbn-filter:grayscale(100%);')!==false,'An image layer\'s Filters');
check(strpos($sm,'--wpbn-dw:min(100cqw, 100cqh);--wpbn-dh:min(100cqh, 100cqw);--wpbn-dl:calc((100cqw - min(100cqw, 100cqh)) * 50 / 100);--wpbn-dt:calc((100cqh - min(100cqh, 100cqw)) * 50 / 100);')!==false
    && strpos($sm,'--wpbn-dw-m:100cqw;--wpbn-dh-m:100cqh;--wpbn-dl-m:0px;--wpbn-dt-m:0px;')!==false,'Fit per device as the drawing\'s box in the scene (Contain, Stretch)');
// Effect (2026-11-10): Border instead of Edge (saved Edges: a Border Outside, as wide), on glass too; Shadow not on glass.
check($so[0]['use_border']===true && $so[0]['border_width']===6.0 && $so[0]['border_position']==='outside' && $so[1]['use_border']===true && !isset($so[0]['stroke']),'A saved Edge: a Border Outside');
check(substr_count($sm,'drop-shadow(')===1 && strpos($sm,'filter:drop-shadow(0px 10px 25px rgba(0,0,0,0.5));')!==false && substr_count($sm,'<div class="wpbn-shape-line" style="background:#ffffff"></div>')===2 && strpos($sm,'--wpbn-line:url(&quot;data:image/svg+xml,')!==false,'Border: a line of its colour masked by the outline (on glass too); Shadow not on glass');
$rr=array('use_radius'=>1,'radius_tl'=>10,'radius_tr'=>100,'radius_tr_unit'=>'%','radius_br'=>0,'radius_bl'=>0,'radius_bl_mobile'=>5);
check(WPBN_Shape::rounded('<rect x="0" y="0" width="100" height="50"/>',$rr,'desktop')==='<path d="M10 0H75A25 25 0 0 1 100 25V50A0 0 0 0 1 100 50H0A0 0 0 0 1 0 50V10A10 10 0 0 1 10 0Z"/>'
    && WPBN_Shape::rounded('<circle r="5"/>',$rr,'desktop')==='<circle r="5"/>' && WPBN_Shape::rounded('<rect width="9" height="9"/>',array('use_radius'=>0),'desktop')==='<rect width="9" height="9"/>','Radius: a rectangle\'s corners (at most half its shorter side; % of it), not other shapes');
check(strpos(WPBN_Shape::rounded('<g transform="translate(1,1)"><rect width="10" height="10" fill-rule="evenodd"/></g>',$rr,'mobile'),'<g transform="translate(1,1)"><path d="M5 0H5A5 5 0 0 1 10 5V10A0 0 0 0 1 10 10H5A5 5 0 0 1 0 5V5A5 5 0 0 1 5 0Z" fill-rule="evenodd"/></g>')===0,'Its groups and fill rule kept; per device');
$rl=array('use_border'=>1,'border_width'=>4,'border_position'=>'inside','border_style'=>'dashed');
check(WPBN_Shape::line('<rect width="9" height="9"/>',$rl,'desktop',array(0,0,10,10))==='<mask id="b" maskUnits="userSpaceOnUse" x="-8" y="-8" width="26" height="26"><g fill="#fff"><rect width="9" height="9"/></g></mask><g mask="url(#b)"><g fill="none" stroke="#000" stroke-width="8" stroke-dasharray="12 8"><rect width="9" height="9"/></g></g>'
    && WPBN_Shape::line('<rect width="9" height="9"/>',array('border_position'=>'center')+$rl,'desktop',array(0,0,10,10))==='<g fill="none" stroke="#000" stroke-width="4" stroke-dasharray="12 8"><rect width="9" height="9"/></g>' && WPBN_Shape::line('<rect/>',array('use_border'=>0)+$rl,'desktop',array(0,0,1,1))==='','Border: Inside (half of a line twice as wide, the outside hidden), Center, none');
$rs=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'shape_objects'=>array(array('key'=>'o1','fill'=>'color','use_radius'=>1,'radius_tl_mobile'=>40,'use_border'=>1,'border_width_tablet'=>0)))))));
// An object's Entrance animation (2026-11-10): its own kinds, a layer's settings; on its item, its box for Reveal and Zoom.
$oe=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'shape_objects'=>array(
    array('key'=>'o1','fill'=>'color','use_enter'=>1,'enter_type'=>'reveal-left','enter_delay'=>0.5,'box'=>array(400,200,200,600)),
    array('key'=>'o2','fill'=>'glass','use_enter'=>1,'enter_type'=>'slide-up','enter_distance'=>80,'enter_start'=>'load','box'=>array('x',1,2,3)),
    array('key'=>'o3','fill'=>'color','use_enter'=>1,'enter_type'=>'flip-x-top'))))));
$oo=$oe['layers'][0]['shape_objects'];
check($oo[0]['box']===array(400.0,200.0,200.0,600.0) && $oo[1]['box']===array() && $oo[2]['enter_type']==='fade' && WPBN_Settings::sanitize($oe)==$oe,'Object entrance: its kinds only, its box checked, idempotent');
$oeh=WPBN_Render::markup($oe);
check(strpos($oeh,'class="wpbn-shape-item wpbn-oenter wpbn-oenter--reveal wpbn-oenter--reveal-left wpbn-oenter--visible"')!==false && strpos($oeh,'data-box="400 200 200 600" data-vb="0 0 1000 1000"')!==false && strpos($oeh,'--wpbn-edl:0.5s;')!==false,'Reveal: on its item, with its box');
check(strpos($oeh,'class="wpbn-shape-item wpbn-oenter wpbn-oenter--slide wpbn-oenter--glass"')!==false && strpos($oeh,'--wpbn-ex:0px;--wpbn-ey:80px;')!==false,'A slide on glass: its window moves, its blur comes in');
// Fit (2026-11-10): Trim empty space (the objects' box, as the editor measured it); Custom size by height or width at its Position.
$fitL=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'shape_trim'=>1,'shape_fit'=>'custom','shape_fit_mobile'=>'cover','shape_size'=>300,'shape_size_tablet'=>'','x'=>30,'y'=>40,'shape_objects'=>array(
    array('key'=>'o1','fill'=>'color','box'=>array(400,200,200,600)),array('key'=>'o2','fill'=>'color','box'=>array(700,200,200,600)),array('key'=>'o3','fill'=>'color','box'=>array(100,200,200,600)))))));
check($fitL['layers'][0]['shape_trim']===true && $fitL['layers'][0]['shape_fit']==='custom' && $fitL['layers'][0]['shape_size_tablet']===null && $fitL['layers'][0]['x']==30 && WPBN_Settings::sanitize($fitL)==$fitL,'Fit: Trim and a Custom size kept, its Position too');
$fitH=WPBN_Render::markup($fitL);
check(WPBN_Shape::area($fitL['layers'][0],WPBN_Shape::meta(900))===array(99.0,199.0,802.0,602.0) && strpos($fitH,'viewBox=&#039;99 199 802 602&#039;')!==false,'Trim: the objects\' box, a little room');
check(strpos($fitH,'--wpbn-dw:399.67px;--wpbn-dh:300px;--wpbn-dl:calc(30cqw - 199.83px);--wpbn-dt:calc(40cqh - 150px);--wpbn-dw-t:399.67px;')!==false && strpos($fitH,'--wpbn-dw-m:max(100cqw, 133.22cqh);--wpbn-dh-m:max(100cqh, 75.06cqw);')!==false,'Custom size: its height, its width from its proportions, its middle at its Position; another Fit on mobile');
check(strpos($fitH,'&quot;fit&quot;:[[&quot;custom&quot;,30,40,300,&quot;px&quot;,&quot;height&quot;],[&quot;custom&quot;,30,40,300,&quot;px&quot;,&quot;height&quot;],[&quot;cover&quot;,30,40]]')!==false && strpos($fitH,'--wpbn-left:50%;')!==false,'For frontend.js; the layer itself stays over the scene');
// Cover and Contain at the layer's Position too (2026-11-10, user's request), as background-position: 0% flush left, 100% right.
check(strpos($fitH,'--wpbn-dl-m:calc((100cqw - max(100cqw, 133.22cqh)) * 30 / 100);--wpbn-dt-m:calc((100cqh - max(100cqh, 75.06cqw)) * 40 / 100);')!==false,'Cover on mobile: the drawing at X 30%, Y 40%');
$fitW=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'shape_fit'=>'custom','shape_size_by'=>'width','shape_size_unit'=>'%','shape_size'=>50,'shape_objects'=>array(array('key'=>'o1')))))));
check(strpos($fitW,'--wpbn-dw:50cqw;--wpbn-dh:50cqw;--wpbn-dl:calc(50cqw - 25cqw);')!==false,'By width in % of the scene');
check(strpos($animCss,'.wpbn-scene .wpbn-layer.wpbn-layer--shape{container-type:size;transform:translate(-50%,-50%);opacity:1;')!==false && strpos($animCss,'mask-size:var(--wpbn-w0) var(--wpbn-h0);')!==false,'The masks placed in the scene\'s units; the layer itself never moved');
// Moved by transform, not by the masks (2026-11-10, user's report: a slow Slide or Zoom trembled), what they show moved back by as
// much; an Invert box over the scene stays and its hole's mask moves. In perspective in every browser (2026-11-10: Chrome put
// the user's glass window, a flat move, on whole pixels).
check(strpos($animCss,'transform-origin:var(--wpbn-to);transform:translate(var(--wpbn-tx),var(--wpbn-ty)) perspective(1000px) translateZ(calc(1000px - 1000px / var(--wpbn-zz)));')!==false
    && strpos($animCss,'.wpbn-scene .wpbn-shape-fill{position:absolute;inset:0;transform-origin:var(--wpbn-to);transform:perspective(1000px) translateZ(calc(1000px - 1000px * var(--wpbn-zz))) translate(calc(-1 * var(--wpbn-tx)),calc(-1 * var(--wpbn-ty)))}')!==false
    && strpos($animCss,'.wpbn-scene .wpbn-shape-clip--invert{transform:none;')!==false,'Shape windows moved by transform in perspective (glass, on a layer of its own, is not put on whole pixels), what they show moved back');
// The whole Shape's Entrance animation (2026-11-10): its objects' kinds (a flip is not one: Fade), around its objects, moving
// nothing itself; Follow the mouse and Opacity at the end for frontend.js, as a layer's.
$wsL=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'use_enter'=>1,'enter_type'=>'reveal-left','enter_start'=>'load','enter_delay'=>0.5,'mouse'=>30,'use_end_opacity'=>1,'end_opacity'=>40,'shape_objects'=>array(array('key'=>'o1','fill'=>'color','opacity'=>50))))));
$wsH=WPBN_Render::markup($wsL);
check($wsL['layers'][0]['enter_type']==='reveal-left' && WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','enter_type'=>'flip-y-left'))))['layers'][0]['enter_type']==='fade','A Shape layer\'s Entrance: its objects\' kinds');
check(strpos($wsH,'<div class="wpbn-shape-in wpbn-shape-in--reveal wpbn-shape-in--reveal-left" style="animation-duration:1s;animation-delay:0.5s;"><div class="wpbn-shape-item"')!==false && strpos($wsH,'--wpbn-oo:0.5;')!==false,'Around all its objects; an object\'s Opacity on its fill');
check(motion_of($wsH,0)['mouse']==30.0 && motion_of($wsH,0)['fade']==array(-60,-60,-60),'The mouse and Opacity at the end, as a layer\'s');
$wsZ=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'use_enter'=>1,'enter_type'=>'slide-up','use_anim'=>1,'anim_type'=>'zoom','anim_origin'=>'bottom','shape_objects'=>array(array('key'=>'o1')))))));
check(strpos($wsZ,'<div class="wpbn-shape-in wpbn-shape-in--slide wpbn-shape-in--visible" style="animation-duration:1s;--wpbn-sx0:0px;--wpbn-sy0:60px;"><div class="wpbn-shape-all wpbn-anim wpbn-anim--zoom')!==false
    && strpos($wsZ,'--wpbn-fx0:0.5;--wpbn-fy0:1;')!==false && strpos($wsZ,'transform-origin')===false,'Slide, then a Zoom from the drawing\'s bottom (its windows scaled, not the box)');
// Firefox animates a registered value only from plain keyframe values (2026-11-10, user's report: it stood still, then jumped):
// each animation runs a progress, its values worked out from it; no var() in their keyframes.
check(strpos($animCss,'@keyframes wpbn-se-p{from{--wpbn-sep:0}to{--wpbn-sep:1}}')!==false && strpos($animCss,'--wpbn-sex:calc(var(--wpbn-sx0,0px) * max(0,1 - var(--wpbn-sep)))')!==false
    && strpos($animCss,'@keyframes wpbn-sl-p{from{--wpbn-slp:0}to{--wpbn-slp:1}}')!==false && strpos($animCss,'--wpbn-slz:calc(var(--wpbn-a0,1) + (var(--wpbn-a1,1) - var(--wpbn-a0,1)) * var(--wpbn-slp))')!==false
    && preg_match('/@keyframes wpbn-(se|sl|ol|oe)-[a-z-]+\{[^}]*--wpbn-[a-z0-9]+:var\(/',$animCss)===0
    && strpos($animCss,'opacity:calc(var(--wpbn-oo,1) * var(--wpbn-sea,1) * var(--wpbn-sla,1) * (1 + var(--wpbn-f,0)))')!==false && strpos($animCss,'.wpbn-scene .wpbn-shape-in,.wpbn-scene .wpbn-oenter,')!==false,'Their keyframes; the fade on the fills themselves; none with reduced motion');
// An object's Loop animation (2026-11-10): a layer's kinds, on a box around its fill and line; the window slides; Zoom around its box.
$ol=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shape','shape'=>900,'shape_objects'=>array(
    array('key'=>'o1','fill'=>'color','use_anim'=>1,'anim_type'=>'slide-x','anim_from'=>-40,'anim_to'=>40,'anim_to_mobile'=>20,'anim_duration'=>4,'anim_delay'=>1,'box'=>array(400,200,200,600)),
    array('key'=>'o2','fill'=>'glass','use_anim'=>1,'anim_type'=>'fade','anim_from'=>50,'anim_to'=>100,'anim_repeat'=>'loop'),
    array('key'=>'o3','fill'=>'color','use_anim'=>1,'anim_type'=>'zoom','anim_origin'=>'bottom','anim_duration_tablet'=>0.01,'box'=>array(100,200,200,600)))))));
$lo=$ol['layers'][0]['shape_objects'];
check($lo[0]['anim_to_mobile']===20.0 && $lo[0]['anim_to_tablet']===null && $lo[2]['anim_duration_tablet']===0.3 && WPBN_Settings::sanitize($ol)==$ol,'Object loop: per device, checked, idempotent');
$olh=WPBN_Render::markup($ol);
check(strpos($olh,'<div class="wpbn-shape-loop wpbn-anim wpbn-anim--slide-x wpbn-anim--alternate" style="--wpbn-a0-d:-40px;--wpbn-a1-d:40px;--wpbn-ad-d:4s;--wpbn-a0-t:-40px;--wpbn-a1-t:40px;--wpbn-ad-t:4s;--wpbn-a0-m:-40px;--wpbn-a1-m:20px;--wpbn-ad-m:4s;animation-delay:1s;--wpbn-ald:1s;"><div class="wpbn-shape-clip"')!==false,'A slide: around its fill and line, its values per device');
check(strpos($olh,'wpbn-anim--fade wpbn-anim--loop wpbn-oloop--glass" style="--wpbn-a0-d:0.5;')!==false && strpos($olh,'--wpbn-alc:infinite;--wpbn-alr:normal;')!==false && strpos($olh,'--wpbn-gb:12px;')!==false,'Fade on glass: its blur and tint');
check(strpos($olh,'--wpbn-fx:0.5;--wpbn-fy:1;')!==false && substr_count($olh,'data-box=')===1,'Zoom: from a point of its box, measured');
check(strpos($animCss,'@keyframes wpbn-ol-p{from{--wpbn-olp:0}to{--wpbn-olp:1}}')!==false && strpos($animCss,'--wpbn-lox:calc(var(--wpbn-a0,0px) + (var(--wpbn-a1,0px) - var(--wpbn-a0,0px)) * var(--wpbn-olp))')!==false && strpos($animCss,'.wpbn-scene .wpbn-shape-loop *{animation:none}')!==false,'The window slides; none with reduced motion');
check(strpos($animCss,'@keyframes wpbn-oe-glass{from{-webkit-backdrop-filter:blur(0px);backdrop-filter:blur(0px);background-color:transparent}}')!==false && strpos($animCss,'.wpbn-scene .wpbn-oenter,.wpbn-scene .wpbn-oenter *,.wpbn-scene .wpbn-shape-loop *{animation:none}')!==false,'Glass comes in by its blur; none with reduced motion');
check(strpos($rs,'--wpbn-mask-m:')!==false && strpos($rs,'--wpbn-mask-t:')===false && strpos($rs,'--wpbn-line-t:linear-gradient(transparent,transparent);')!==false && strpos($rs,'--wpbn-line-m:')===false,'Per device: a mask where its corners differ, no line where its width is 0');
check(strpos($sm,'backdrop-filter:blur(60px)')!==false && strpos($sm,'data-move="{&quot;x&quot;:0,&quot;y&quot;:-40}"')!==false,'Glass blurs what is behind it; an object\'s travel for frontend.js');
check(substr_count($sm,'data-move=')===1,'An object\'s travel: none where its Scroll animation was switched off');
check(preg_match('/--wpbn-mask:url\(&quot;data:image\/svg\+xml,%3Csvg[^)]*%3Crect x=&#039;400&#039;/',$sm)===1,'Each object\'s mask: the object alone, as an SVG');
check(strpos($animCss,'.wpbn-scene .wpbn-shape-clip{-webkit-mask-image:var(--wpbn-mk)')!==false && strpos($animCss,'--wpbn-mk:var(--wpbn-mask-m,var(--wpbn-mask-t,var(--wpbn-mask)))')!==false && strpos($animCss,'mask-composite:exclude')!==false,'Masks and Invert in the stylesheet');

// Filters per device (2026-11-10): tablet and mobile follow the larger screen; each device's own as CSS variables.
$fd=$lay(array('type'=>'image','image'=>3,'f_grayscale'=>100,'f_grayscale_tablet'=>0,'f_blur_mobile'=>4,'f_brightness_tablet'=>''));
check($fd['f_grayscale_tablet']==0 && $fd['f_grayscale_mobile']===null && $fd['f_brightness_tablet']===null && WPBN_Settings::filter_css($fd,'mobile')==='blur(4px)','Filters: per device, inherited');
$fdm=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($fd))));
check(strpos($fdm,'--wpbn-filter:grayscale(100%);--wpbn-filter-t:brightness(100%);--wpbn-filter-m:blur(4px);')!==false,'Rendered per device, a device without any: a filter that changes nothing');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3)))))),'--wpbn-filter')===false,'No filters: nothing');
// An overlay's Filters: of the layers under it (backdrop-filter), its Blur and the others.
$ot=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','f_saturate'=>150,'f_saturate_mobile'=>100,'f_blur'=>10))))));
check(strpos($ot,'--wpbn-bdf:saturate(150%);--wpbn-bdf-t:saturate(150%);--wpbn-bdf-m:brightness(100%);')!==false && strpos($ot,'wpbn-layer--blur')!==false && strpos($ot,'blur(10px)')===false,'An overlay: its tones per device, an image\'s Blur not');
// A title's Gradient (its own switch): the letters only, the accent words keep their colour; its shadow along them.
$tgr=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','text'=>'Go <u>far</u>','use_text_gradient'=>1,'use_shadow'=>1,'gradient'=>'linear;left;#ff0000@0;#0000ff@100'))))));
check(strpos($tgr,'class="wpbn-text-gradient" style="background-image:linear-gradient(to right, #ff0000 0%, #0000ff 100%);filter:drop-shadow(')!==false && strpos($tgr,'text-shadow')===false,'A title in a gradient, its shadow a drop-shadow');
check(strpos($animCss,'.wpbn-scene .wpbn-layer--text .wpbn-text-gradient u{-webkit-text-fill-color:currentColor}')!==false,'Its accent words in their own colour');
// A button: Gradient, Shadow (Underline: along its text and line), Blur, Icon.
$bt=function ($l) { return WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'button','button_text'=>'Go')+$l)))); };
check(strpos($bt(array('use_button_gradient'=>1,'gradient'=>'linear;left;#ff0000@0;#0000ff@100')),'wpbn-button--gradient')!==false && strpos($bt(array('use_button_gradient'=>1)),'--wpbn-bg:')!==false,'A button\'s Gradient');
check(strpos($bt(array('use_shadow'=>1,'shadow_inset'=>1)),'--wpbn-bsh:inset 0px 2px 10px')!==false && strpos($bt(array('use_shadow'=>1,'button_style'=>'underline','shadow_inset'=>1)),'--wpbn-bds:drop-shadow(0px 2px 10px')!==false,'Its Shadow: around it (Inside), an Underline\'s along it');
check(preg_match('/class="wpbn-button[^"]* wpbn-layer--blur"/',$bt(array('backdrop_blur'=>10,'backdrop_blur_mobile'=>4)))===1 && strpos($bt(array('backdrop_blur'=>10,'backdrop_blur_mobile'=>4)),'--wpbn-blur-m:4px;')!==false,'Its Blur per device');
$svgIcon='512 512|M0 0L512 256L0 512Z';
check(WPBN_Icons::parse($svgIcon)===array(512,512,'M0 0L512 256L0 512Z') && WPBN_Icons::parse('512 512|M0 0"/><script>')===null && WPBN_Icons::parse('x|M0 0')===null,'An icon\'s SVG: its numbers and path commands only');
$withIcon=$bt(array('button_icon_type'=>'icon','button_icon'=>'solid/arrow-right','button_icon_svg'=>$svgIcon,'button_icon_position'=>'left','button_icon_size_mobile'=>12));
check(strpos($withIcon,'><span class="wpbn-button__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" focusable="false"><path fill="currentColor" d="M0 0L512 256L0 512Z"/></svg></span>Go</span>')!==false && strpos($withIcon,'--wpbn-is:16px;--wpbn-is-t:16px;--wpbn-is-m:12px;--wpbn-ig:8px;')!==false,'An icon left of the text, its Size per device');
$badIcon=$lay(array('type'=>'button','button_icon'=>'solid/<x>','button_icon_svg'=>'1 1|M0 0"','button_icon_type'=>'emoji','button_icon_position'=>'top'));
check($badIcon['button_icon']==='' && $badIcon['button_icon_svg']==='' && $badIcon['button_icon_type']==='none' && $badIcon['button_icon_position']==='right','A bad icon: none');
check(strpos($bt(array('button_icon_type'=>'image','button_icon_image'=>3,'button_icon_tint'=>1)),'wpbn-button__icon--tint')!==false && strpos($bt(array('button_icon_type'=>'image','button_icon_image'=>3)),'<img src=')!==false,'An image icon: tinted (a mask) or in its own colours');
// A button without text: drawn with an Icon (its name for screen readers), not without.
$alone=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'button','button_text'=>'','button_url'=>'/shop/','button_icon_type'=>'icon','button_icon'=>'solid/cart-shopping','button_icon_svg'=>$svgIcon), array('type'=>'button','button_text'=>'')))));
check(substr_count($alone,'class="wpbn-button ')===1 && strpos($alone,'aria-label="cart shopping"')!==false,'An icon alone: drawn, named; nothing at all: not drawn');
// The icon list (WPBN_Icons::build()): Font Awesome's icon-families.json, classic Free styles, names as 0–9 too.
$built=WPBN_Icons::build(array('house'=>array('label'=>'House','search'=>array('terms'=>array('home')),'svgs'=>array('classic'=>array('solid'=>array('width'=>512,'height'=>512,'path'=>'M0 0Z'),'regular'=>array('width'=>512,'height'=>512,'path'=>'bad"path')))),0=>array('label'=>'0','svgs'=>array('classic'=>array('solid'=>array('width'=>320,'height'=>512,'path'=>'M1 1Z'))))),'9.9.9');
check($built['version']==='9.9.9' && count($built['icons'])===2 && $built['icons'][0][0]==='0' && $built['icons'][1]===array('house','House','home',array('s'=>array(512,512,'M0 0Z'))),'The icon list: its styles, a bad path left out');
$bundled=json_decode(file_get_contents(__DIR__.'/../assets/icons/fontawesome.json'),true);
check($bundled['version']===WPBN_Icons::BUNDLED_VERSION && count($bundled['icons'])>1500,'The plugin\'s own list, of the version it says');
function wp_roles() { return (object) array('roles'=>array('administrator'=>array('name'=>'Administrator'),'editor'=>array('name'=>'Editor'),'author'=>array('name'=>'Author'))); }
function get_role($r) { return new class($r) { private $r; public function __construct($r) { $this->r = $r; } public function has_cap($c) { return $this->r === 'administrator'; } }; }
// Roles (WP Banner → Settings, as WP Swiper's): Add and clone, Delete, WPBakery element only with Edit scenes; known roles only.
check(WPBN_Access::sanitize(array('editor'=>array('edit'=>1,'create'=>1,'x'=>1),'author'=>array('create'=>1,'delete'=>1),'ghost'=>array('edit'=>1),'administrator'=>array('edit'=>1)))===array('editor'=>array('edit'=>true,'create'=>true)),'Roles: the dependent rights only with Edit, unknown roles and administrators left out');
// A shortcode (2026-11-10): Shadow around its box and Filters per device, on the box its Border is on (an animation's, if any).
$scBox=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shortcode','shortcode'=>'[demo]','use_shadow'=>1,'shadow_inset'=>1,'f_grayscale'=>100,'f_grayscale_mobile'=>0)))));
check(strpos($scBox,'wpbn-layer--shortcode wpbn-layer--boxshadow wpbn-layer--cfilter')!==false && strpos($scBox,'--wpbn-lsh:inset 0px 2px 10px rgba(0,0,0,0.5);')!==false && strpos($scBox,'--wpbn-cf:grayscale(100%);--wpbn-cf-t:grayscale(100%);--wpbn-cf-m:brightness(100%);')!==false,'A shortcode\'s Shadow and Filters');
check(preg_match('/class="wpbn-anim [^"]*wpbn-layer--boxshadow"/',WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'shortcode','shortcode'=>'[demo]','use_shadow'=>1,'use_anim'=>1,'anim_type'=>'zoom'))))))===1,'With an animation: on its wrapper, moving with it');
// The 2026-11-10 review's fixes, with WordPress's page functions as a page has them.
$GLOBALS['wpbn_test_done']=array(); $GLOBALS['wpbn_test_head']=false; $GLOBALS['wpbn_test_enqueued']=array();
function did_action($a) { return $a === 'wp_head' && $GLOBALS['wpbn_test_head'] ? 1 : 0; }
function doing_action($a = null) { return false; }
function wp_doing_ajax() { return false; }
function wp_enqueue_style($h) { $GLOBALS['wpbn_test_enqueued'][$h]=true; }
function wp_enqueue_script($h) { $GLOBALS['wpbn_test_enqueued'][$h]=true; }
function wp_style_is($h, $list = 'enqueued') { return $list === 'done' ? !empty($GLOBALS['wpbn_test_done'][$h]) : !empty($GLOBALS['wpbn_test_enqueued'][$h]); }
function wp_print_styles($h) { if (empty($GLOBALS['wpbn_test_done'][$h])) { $GLOBALS['wpbn_test_done'][$h]=true; echo "<link rel='stylesheet' id='".$h."-css' href='/frontend.css'>"; } }
// A banner drawn after <head> (a widget, a template): its stylesheet just before it, once a page; in <head>: none of its own.
$late1=WPBN_Render::scene(5); $GLOBALS['wpbn_test_head']=true; $late2=WPBN_Render::scene(5); $late3=WPBN_Render::scene(5);
check(strpos($late1,'<link')===false && strpos($late2,"<link rel='stylesheet' id='wpbn-frontend-css'")===0 && strpos($late2,'<section')!==false && strpos($late3,'<link')===false,'A banner after <head> brings its stylesheet, once');
// An archive's posts with a banner: the styles in <head> too, not only on a post's own page.
class WP_Post { public $post_content; public function __construct($c) { $this->post_content=$c; } }
function is_singular() { return false; }
function has_block($b, $p) { return false; }
function has_shortcode($content, $tag) { return strpos($content, '['.$tag) !== false; }
$GLOBALS['wpbn_test_enqueued']=array(); $GLOBALS['wp_query']=(object) array('posts'=>array(new WP_Post('plain'), new WP_Post('Intro [wp_banner id="5"]')));
WPBN_Render::early_assets(); $archive=!empty($GLOBALS['wpbn_test_enqueued']['wpbn-frontend']);
$GLOBALS['wpbn_test_enqueued']=array(); $GLOBALS['wp_query']->posts=array(new WP_Post('plain'));
WPBN_Render::early_assets();
check($archive && empty($GLOBALS['wpbn_test_enqueued']),'An archive with a banner in one of its posts: its styles in <head>; without: none');
// Shapes no scene uses: removed (a day after their upload: get_posts() picks those); one a scene or revision uses: kept.
class WPBN_Test_DB { public $postmeta='wp_postmeta'; public $used=array(); public function esc_like($s) { return $s; }
    public function prepare($q, ...$a) { return array($q, $a); } public function get_var($p) { foreach ($this->used as $id) { if (strpos($p[1][1], 's:5:"shape";i:'.$id.';') !== false) { return '1'; } } return null; } }
$GLOBALS['wpdb']=new WPBN_Test_DB(); $GLOBALS['wpdb']->used=array(901); $GLOBALS['wpbn_test_posts']=array(900, 901, 9012); $GLOBALS['wpbn_test_deleted']=array();
function wp_delete_post($id, $force=false) { $GLOBALS['wpbn_test_deleted'][]=$id; }
WPBN_Shape::cleanup();
check($GLOBALS['wpbn_test_deleted']===array(900, 9012),'Shapes no scene uses removed; the one used kept (id 901, not mistaken for 9012)');
// Once an hour at most (a query per shape: not on every save); a scene deleted for good looks again at once.
$GLOBALS['wpbn_test_deleted']=array(); WPBN_Shape::cleanup();
$throttled=$GLOBALS['wpbn_test_deleted']===array(); WPBN_Shape::cleanup(true); unset($GLOBALS['wpbn_test_posts']);
check($throttled && $GLOBALS['wpbn_test_deleted']===array(900, 9012) && WPBN_Shape::KEEP===WEEK_IN_SECONDS,'Shape cleanup: once an hour, at once when forced; unused shapes kept a week');
// The one clamp and pick every class uses (2026-11-11 review: four copies before).
check(WPBN_Settings::clamp('12.345',0,0,10)==10 && WPBN_Settings::clamp('-5',0,0,10)==0 && WPBN_Settings::clamp('3.456',0,0,10,1)===3.5 && WPBN_Settings::clamp('x',7,0,10,1)===7 && WPBN_Settings::clamp(array(1),null,0,10)===null
    && WPBN_Settings::pick('a',array('a','b'),'b')==='a' && WPBN_Settings::pick(1,array('1'),'z')==='z','clamp(): within its range, rounded, a fallback for what is not a number; pick(): strict');
// A Shortcode layer: this plugin's own shortcodes out, also one put back together from pieces (2026-11-11 review).
check(WPBN_Settings::shortcode('[wp_bann[wp_banner]er id="1"] [demo a="1"] [WP_BANNER_MOTION id=2]')==='[demo a="1"]','Shortcode layer: own shortcodes removed, also nested ones');
// SVGs only in UTF-8 (2026-11-11 review: a UTF-16 one got past the DOCTYPE check and its entities were expanded); a UTF-8 BOM is fine.
$svg16='<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE svg [<!ENTITY w "9">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><rect width="&w;" height="9"/></svg>';
check(is_wp_error(WPBN_Shape::parse("\xFF\xFE".mb_convert_encoding($svg16,'UTF-16LE','UTF-8'))) && is_wp_error(WPBN_Shape::parse("\xFE\xFF".mb_convert_encoding($svg16,'UTF-16BE','UTF-8')))
    && is_wp_error(WPBN_Shape::parse('<?xml version="1.0" encoding="ISO-8859-1"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><rect width="9" height="9"/></svg>'))
    && !is_wp_error(WPBN_Shape::parse("\xEF\xBB\xBF".'<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><rect width="9" height="9"/></svg>')),'Shape: UTF-8 only (UTF-16 and other encodings refused, a BOM fine)');
echo "Settings and rendering checks passed.\n";

// Release: one version everywhere, the author, and a Changelog "What's new" can read.
require_once __DIR__.'/../includes/class-wpbn-whats-new.php';
$main=file_get_contents(__DIR__.'/../wp-banner.php');$readme=file_get_contents(__DIR__.'/../readme.txt');
preg_match('/^\s*\*\s*Version:\s*(\S+)/m',$main,$header);preg_match("/define\('WPBN_VERSION', '([^']+)'\)/",$main,$constant);preg_match('/^Stable tag:\s*(\S+)/m',$readme,$stable);
check($header[1]===$constant[1] && $header[1]===$stable[1],'Version header, WPBN_VERSION and Stable tag match');
check(preg_match('/^\s*\*\s*Author:\s*Relevant AS$/m',$main) && preg_match('#^\s*\*\s*Author URI:\s*https://relevant\.no/$#m',$main),'Author is Relevant AS');
$log=WPBN_Whats_New::parse_changelog($readme);
check(isset($log[$header[1]]) && count($log[$header[1]])>0,'The current version has Changelog items for What\'s new');
// Translations (2026-11-10 review): languages/wp-banner.pot has every translatable string of the PHP (npm run pot).
$root=dirname(__DIR__);$pot=(string) @file_get_contents($root.'/languages/wp-banner.pot');
$missing=array();
foreach (array_merge(array('wp-banner.php','uninstall.php'),array_map(function($f){return 'includes/'.basename($f);},glob($root.'/includes/*.php'))) as $f) {
    preg_match_all("/\\b(?:__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e)\\(\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*,\\s*'wp-banner'/", file_get_contents($root.'/'.$f), $mm);
    foreach ($mm[1] as $text) { $text=str_replace(array("\\'","\\\\"),array("'","\\"),$text); if (strpos($pot,'msgid "'.addcslashes($text,"\"\\\n").'"')===false) { $missing[]=$text; } }
}
check($pot!=='' && !$missing,'languages/wp-banner.pot is up to date (npm run pot); missing: '.implode(' | ',array_slice($missing,0,3)));
check(array_keys(WPBN_Whats_New::between(array('0.2.0'=>array('b'),'0.1.0'=>array('a')),'0.1.0','0.2.0'))===array('0.2.0'),'Only the versions after the one seen');
// The block: on the site only a published scene; in the block editor's preview (REST, edit context) a draft too, with a note,
// and a deleted one as a note alone (2026-11-10 review).
require_once __DIR__.'/../includes/class-wpbn-block.php';
function get_post_status($id) { return $GLOBALS['wpbn_test_status'][(int) $id] ?? false; }
function current_user_can($cap, $id = 0) { return true; }
function sanitize_key($s) { return strtolower(preg_replace('/[^a-z0-9_\-]/i', '', $s)); }
function wp_unslash($s) { return $s; }
function shortcode_atts($pairs, $atts) { return array_merge($pairs, array_intersect_key((array) $atts, $pairs)); }
$GLOBALS['wpbn_test_types']=array(70=>'wpbn_scene', 71=>'wpbn_scene'); $GLOBALS['wpbn_test_status']=array(70=>'publish', 71=>'draft');
$siteDraft=WPBN_Block::render(array('id'=>71));
define('REST_REQUEST', true); $_GET['context']='edit';
$edPub=WPBN_Block::render(array('id'=>70)); $edDraft=WPBN_Block::render(array('id'=>71)); $edGone=WPBN_Block::render(array('id'=>72));
check($siteDraft==='' && strpos($edPub,'wpbn-block-note')===false && strpos($edPub,'<section')!==false
    && strpos($edDraft,'This scene is not published: it shows here, not on the site.')!==false && strpos($edDraft,'<section')!==false
    && strpos($edGone,'This scene no longer exists.')!==false && strpos($edGone,'<section')===false,'Block: a draft shows in the editor with a note, not on the site; a deleted scene: a note');
echo "Release checks passed.\n";
