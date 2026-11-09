<?php
// Isolated checks and browser fixtures: no WordPress installation or database is loaded.
define('ABSPATH', __DIR__);
define('WPBN_URL', '/');
define('WPBN_DIR', dirname(__DIR__).'/');
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
function get_post_meta($id,$key='',$single=false) { if ($key === '_wp_attachment_image_alt') { return ''; } return getenv('WPBN_TEST_IMAGE') ? array('layers'=>array(array('type'=>'image','image'=>3,'name'=>'Mountains'))) : array(); }
function get_posts($args) { return array(); }
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

function get_post_mime_type($id) { return (int) $id === 2 ? 'image/png' : 'image/jpeg'; }
require_once __DIR__.'/../includes/class-wpbn-render.php';
require_once __DIR__.'/../includes/class-wpbn-container.php';
// The color palette: a Woodmart site with its colors set (WPBN_Palette).
function get_template() { return 'woodmart'; }
function get_option($name, $default=false) { return $name === 'xts-woodmart-options' ? array('primary-color'=>array('idle'=>'#83B735'), 'secondary-color'=>'#FBBC34', 'link-color'=>array('idle'=>'')) : $default; }
// The fonts: Woodmart's options, its system fonts and its Google fonts (a few), and the <link> it prints
// for a Google font, once a page (WPBN_Fonts).
function woodmart_get_opt($name) {
    $opts = array('primary-font'=>array(array('font-family'=>'Playfair Display')), 'text-font'=>array(array('font-family'=>'System font stack')),
        'secondary-font'=>array(array('font-family'=>'var(--wd-text-font)')), 'multi_custom_fonts'=>array('{{index}}'=>array('font-name'=>''), array('font-name'=>'Brand Sans')), 'typekit_fonts'=>'');
    return $opts[$name] ?? '';
}
function woodmart_get_config($name) { return $name === 'standard-fonts' ? array('-apple-system,sans-serif'=>'System font stack', 'Georgia, serif'=>'Georgia, serif') : array(); }
eval('namespace XTS\Admin\Modules\Options\Google_Fonts; class Google_Fonts {
    public static $all_google_fonts = array();
    private static $loaded = array();
    public static function get_instance() { return new self(); }
    public function enqueue_inline_fonts($fonts, $id) { foreach ($fonts as $f) { $key = $f["font-family"]."@".$f["font-weight"].$f["font-style"]; if (isset(self::$loaded[$key])) { continue; } self::$loaded[$key] = true; echo "<link rel=\"stylesheet\" id=\"xts-google-fonts-inline-".$id."-css\" href=\"https://fonts.googleapis.com/css2?family=".str_replace(" ", "+", $f["font-family"]).($f["font-style"] === "italic" ? ":ital,wght@1," : ":wght@").$f["font-weight"]."\">"; } }
}');
$variants = function ($ids) { return array('variants'=>array_map(function ($id) { return array('id'=>$id); }, $ids)); };
XTS\Admin\Modules\Options\Google_Fonts\Google_Fonts::$all_google_fonts = array('Playfair Display'=>$variants(array('400','700','900','400italic')), 'Exo 2'=>$variants(array('100','300','500')), 'Roboto'=>$variants(array('300','400','700')));
require_once __DIR__.'/../includes/class-wpbn-palette.php';
require_once __DIR__.'/../includes/class-wpbn-fonts.php';
require_once __DIR__.'/../includes/class-wpbn-admin.php';
if (($argv[1] ?? '')==='--editor') {
    echo '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/vendor/pickr/classic.min.css"><link rel="stylesheet" href="/assets/css/admin.css"><style>body{font:13px Arial;margin:20px}.button{padding:6px;cursor:pointer}input,select{padding:5px;box-sizing:border-box}</style></head><body><form id="post"><div id="wpbn-editor"><div class="inside">';
    WPBN_Admin::editor((object)array('ID'=>7));
    echo '</div></div></form><script src="/assets/vendor/pickr/pickr.min.js"></script><script src="/assets/js/admin.js"></script></body></html>'; exit;
}
if (($argv[1] ?? '')==='--preview') {
    $s=WPBN_Settings::sanitize(json_decode(stream_get_contents(STDIN),true));
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/frontend.css"><style>'.WPBN_Admin::PAGE_CSS.WPBN_Admin::theme_css().'</style></head><body>'.WPBN_Admin::preview_markup($s).WPBN_Admin::PAGE.'<script src="/assets/js/frontend.js"></script></body></html>'; exit;
}
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
check(strpos($swm,'--wpbn-scale:1;')!==false && $sw['layers'][0]['scale']===130.0,'Scale switched off: 100%, its value kept');
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
check(WPBN_Settings::placed_by_class($pc) && !WPBN_Settings::placed_by_class(array_merge($pc,array('height_unit'=>'px'))),'Placement by class only with the desktop Height on Auto');
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
// Overlay: a colour or its Gradient over the whole scene; it does not move, only its Opacity at the end.
$over=$lay(array('type'=>'overlay','x'=>10,'y_mobile'=>80,'move_y'=>-200,'use_move_y'=>true,'zoom'=>50,'use_zoom'=>true,'scale'=>200,'use_scale'=>true,'container'=>'theme','end_opacity'=>0,'use_end_opacity'=>true));
check($over['type']==='overlay' && $over['color']===WPBN_Settings::OVERLAY_COLOR && $over['move_y']==-200,'An overlay: its default colour, its values kept');
$fixed=WPBN_Settings::effective($over);
check($fixed['x']==10 && $fixed['y']==50 && $fixed['y_mobile']==80 && $fixed['move_y']==0 && $fixed['zoom']==0 && $fixed['scale']==100 && $fixed['opacity']==100 && $fixed['container']==='theme','It keeps its Container and Position, does not move');
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
$blurred=$lay(array('type'=>'overlay','backdrop_blur'=>'12.4','tablet_backdrop_blur'=>'','mobile_backdrop_blur'=>500));
check($blurred['backdrop_blur']===12 && $blurred['tablet_backdrop_blur']===null && $blurred['mobile_backdrop_blur']===100 && WPBN_Settings::blurs($blurred)===array('desktop'=>12,'tablet'=>12,'mobile'=>100),'Blur: whole px, bounded, tablet following');
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
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','use_anim'=>1)))))),'wpbn-anim')===false,'An overlay is never animated');
$animCss=file_get_contents(__DIR__.'/../assets/css/frontend.css');
foreach (array('zoom','fade','slide-x','slide-y') as $kind) { check(strpos($animCss,'.wpbn-scene .wpbn-anim--'.$kind.'{animation-name:wpbn-'.$kind.'}')!==false && strpos($animCss,'@keyframes wpbn-'.$kind.'{')!==false,'Keyframes for '.$kind); }
check(strpos($animCss,"@supports (-moz-appearance:none){
@keyframes wpbn-zoom{from{transform:perspective(1000px) translateZ(calc(1000px - 1000px / var(--wpbn-a0,1)))}")!==false && strpos($animCss,'will-change:')===false && strpos($animCss,'rotate(.01deg)')===false,'Smooth slow zooms in Firefox: drawn in perspective (no snapping to whole pixels), no layer hints');
check(strpos($animCss,'.wpbn-scene:not(.wpbn-scene--seen) .wpbn-anim--visible,.wpbn-scene.wpbn-scene--away .wpbn-anim{animation-play-state:paused}')!==false && strpos($animCss,'.wpbn-scene .wpbn-anim{animation:none}')!==false,'Waits until in view, paused off the screen, none with reduced motion');
// Follow the mouse: per layer, an overlay never; Decorative: no alt text.
$m=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text','use_mouse'=>1,'mouse'=>500)),$lay(array('type'=>'overlay','use_mouse'=>1,'mouse'=>30)),$lay(array('type'=>'text','mouse'=>30))))));
check(motion_of($m,0)['mouse']==200 && motion_of($m,1)['mouse']==0 && motion_of($m,2)['mouse']==0,'Follow the mouse: bounded, not for an overlay, only with its switch');
check(strpos($animCss,'+ var(--wpbn-mx,0px)),calc(var(--wpbn-dy,0px) + var(--wpbn-ky,0px) + var(--wpbn-my,0px))')!==false,'The pointer\'s offset in the layer\'s place');
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'decorative'=>1)))))),'alt=""')!==false && $lay(array('type'=>'image'))['decorative']===false,'Decorative: an empty alt; off by default');
// An image's Shadow (the title's keys): drop-shadow along its outline, only with its switch on.
$sh=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'image','image'=>3,'use_shadow'=>1,'shadow_x'=>4,'shadow_y'=>12,'shadow_blur'=>24,'shadow_color'=>'rgba(0,0,0,0.4)')),$lay(array('type'=>'image','image'=>3,'shadow_y'=>12))))));
check(substr_count($sh,'wpbn-layer--shadow')===1 && strpos($sh,'--wpbn-ds:4px 12px 24px rgba(0,0,0,0.4);')!==false,'Image Shadow: its values, only with its switch on');
check(strpos($animCss,'.wpbn-scene .wpbn-layer--shadow img{filter:drop-shadow(var(--wpbn-ds))}')!==false,'Drawn along the outline of the image');
// An overlay's Shadow: around its box, or Inside it (a vignette); only with its switch on.
$osh=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'overlay','use_shadow'=>1,'shadow_y'=>8,'shadow_blur'=>30)),$lay(array('type'=>'overlay','use_shadow'=>1,'shadow_inset'=>1,'shadow_blur'=>120,'shadow_color'=>'rgba(0,0,0,0.6)')),$lay(array('type'=>'overlay','shadow_inset'=>1))))));
check(strpos($osh,'box-shadow:0px 8px 30px rgba(0,0,0,0.5);')!==false && strpos($osh,'box-shadow:inset 0px 2px 120px rgba(0,0,0,0.6);')!==false && substr_count($osh,'box-shadow')===2,'Overlay Shadow: around it or Inside, only with its switch on');
// A title's or a Text layer's Width: Auto (as before), % of its container, px or vw, per device.
check(strpos(WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'text')))))),'--wpbn-tw')===false,'Width Auto by default: nothing set');
$tw=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array($lay(array('type'=>'richtext','content'=>'<p>a</p>','container'=>'custom','text_width'=>60,'text_width_unit'=>'%','mobile_text_width_unit'=>'auto'))))));
check(strpos($tw,'--wpbn-tw:calc(var(--wpbn-cw) * 0.6);--wpbn-tw-t:calc(var(--wpbn-cw-t, var(--wpbn-cw)) * 0.6);--wpbn-tw-m:max-content;')!==false,'Its Width per device ('.$tw.')');
check($lay(array('type'=>'text','text_width_unit'=>'em'))['text_width_unit']==='auto' && strpos($animCss,'.wpbn-scene .wpbn-layer--text{width:var(--wpbn-tw,max-content)')!==false,'An unknown unit: Auto');
echo "Settings and rendering checks passed.\n";

// Release: one version everywhere, the author, and a Changelog "What's new" can read.
require_once __DIR__.'/../includes/class-wpbn-whats-new.php';
$main=file_get_contents(__DIR__.'/../wp-banner.php');$readme=file_get_contents(__DIR__.'/../readme.txt');
preg_match('/^\s*\*\s*Version:\s*(\S+)/m',$main,$header);preg_match("/define\('WPBN_VERSION', '([^']+)'\)/",$main,$constant);preg_match('/^Stable tag:\s*(\S+)/m',$readme,$stable);
check($header[1]===$constant[1] && $header[1]===$stable[1],'Version header, WPBN_VERSION and Stable tag match');
check(preg_match('/^\s*\*\s*Author:\s*Relevant AS$/m',$main) && preg_match('#^\s*\*\s*Author URI:\s*https://relevant\.no/$#m',$main),'Author is Relevant AS');
$log=WPBN_Whats_New::parse_changelog($readme);
check(isset($log[$header[1]]) && count($log[$header[1]])>0,'The current version has Changelog items for What\'s new');
check(array_keys(WPBN_Whats_New::between(array('0.2.0'=>array('b'),'0.1.0'=>array('a')),'0.1.0','0.2.0'))===array('0.2.0'),'Only the versions after the one seen');
echo "Release checks passed.\n";
