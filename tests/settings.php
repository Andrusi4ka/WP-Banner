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
function esc_attr($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function esc_html($s) { return esc_attr($s); }
function esc_url($s) { return esc_attr($s); }
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
require_once __DIR__.'/../includes/class-wpbn-settings.php';
require_once __DIR__.'/../includes/class-wpbn-render.php';
require_once __DIR__.'/../includes/class-wpbn-admin.php';
if (($argv[1] ?? '')==='--editor') {
    echo '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/admin.css"><style>body{font:13px Arial;margin:20px}.button{padding:6px;cursor:pointer}input,select{padding:5px;box-sizing:border-box}</style></head><body><form id="post"><div id="wpbn-editor"><div class="inside">';
    WPBN_Admin::editor((object)array('ID'=>7));
    echo '</div></div></form><script src="/assets/js/admin.js"></script></body></html>'; exit;
}
if (($argv[1] ?? '')==='--preview') {
    $s=WPBN_Settings::sanitize(json_decode(stream_get_contents(STDIN),true));
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/frontend.css"><style>'.WPBN_Admin::PAGE_CSS.'</style></head><body>'.WPBN_Admin::preview_markup($s).WPBN_Admin::PAGE.'<script src="/assets/js/frontend.js"></script></body></html>'; exit;
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
check(WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'overlay'))))['layers'][0]['type']==='image','Removed layer types (overlay) become image layers');
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
check(strpos($swm,'--wpbn-width:100%')!==false && strpos($swm,'--wpbn-width:0.6%')===false && strpos($swm,'--wpbn-width:60%')!==false,'Image layers as wide as the scene; text layers keep their width');
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
check(motion_of($em,0)['fade']===array(-60,-60,-60),'Opacity at the end: from 80% to 20%');
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
$old=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','move_y'=>-80,'mobile_motion'=>50))));
check($old['layers'][0]['move_y_mobile']===-40.0 && $old['layers'][0]['move_y_tablet']===null && $old['layers'][0]['use_move_y'],'Motion on mobile becomes the mobile travel');
check(WPBN_Settings::sanitize($old)==$old,'Migrated scenes stay as they are');
$r=WPBN_Settings::sanitize(array('layers'=>array(array('type'=>'image','x'=>30,'x_tablet'=>'','x_mobile'=>70,'scale_tablet'=>9999,'fit_mobile'=>'contain','fit_tablet'=>'bad'))));
check($r['layers'][0]['x_tablet']===null && $r['layers'][0]['scale_tablet']===300 && $r['layers'][0]['fit_tablet']===null,'Per-device values: empty inherits, numbers bounded, choices allow-listed');
check(WPBN_Settings::resolved($r['layers'][0],'x')===array('desktop'=>30.0,'tablet'=>30.0,'mobile'=>70.0),'Mobile → tablet → desktop');
$rm=WPBN_Render::markup($r);
check(strpos($rm,'--wpbn-left:30%;--wpbn-left-t:30%;--wpbn-left-m:70%')!==false && strpos($rm,'--wpbn-fit-m:contain')!==false,'Per-device values rendered as variables');
check(WPBN_Admin::image_info(5)===array('name'=>'mountains-cutout.png','width'=>1920,'height'=>1080,'size'=>'420 KB'),'Image name, pixel size and weight for the picker');
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
