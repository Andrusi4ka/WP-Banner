<?php
// Isolated checks and browser fixtures: no WordPress installation or database is loaded.
define('ABSPATH', __DIR__);
define('WPLM_URL', '/');
define('WPLM_DIR', dirname(__DIR__).'/');
function sanitize_text_field($s) { return trim(strip_tags($s)); }
function sanitize_hex_color($s) { return preg_match('/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i', $s) ? $s : null; }
function absint($n) { return abs((int)$n); }
function esc_attr($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function esc_html($s) { return esc_attr($s); }
function esc_url($s) { return esc_attr($s); }
function wp_json_encode($s, $flags=0) { return json_encode($s,$flags); }
function wp_get_attachment_image_url($id, $size) { return $id ? '/assets/images/preview/desktop.svg' : false; }
// WPLM_TEST_IMAGE: the editor opens a scene with one photo layer (tests/motion.cjs, Image position).
function get_post_meta($id,$key,$single) { return getenv('WPLM_TEST_IMAGE') ? array('layers'=>array(array('type'=>'image','image'=>3,'name'=>'Mountains','move_y'=>0))) : array(); }
function wp_nonce_field($a,$b) { echo '<input name="'.esc_attr($b).'" value="test">'; }
function wp_create_nonce($a) { return 'test'; }
function admin_url($path) { return '/preview'; }
function wp_get_attachment_metadata($id) { return array('width'=>1920,'height'=>1080,'filesize'=>430080); }
function get_attached_file($id) { return '/uploads/mountains-cutout.png'; }
function wp_basename($p) { return basename($p); }
function size_format($b,$d=0) { return round($b/1024).' KB'; }
require_once __DIR__.'/../includes/class-wplm-settings.php';
require_once __DIR__.'/../includes/class-wplm-render.php';
require_once __DIR__.'/../includes/class-wplm-admin.php';
if (($argv[1] ?? '')==='--editor') {
    echo '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/admin.css"><style>body{font:13px Arial;margin:20px}.button{padding:6px;cursor:pointer}input,select{padding:5px;box-sizing:border-box}</style></head><body><form id="post"><div id="wplm-editor"><div class="inside">';
    WPLM_Admin::editor((object)array('ID'=>7));
    echo '</div></div></form><script src="/assets/js/admin.js"></script></body></html>'; exit;
}
if (($argv[1] ?? '')==='--preview') {
    $s=WPLM_Settings::sanitize(json_decode(stream_get_contents(STDIN),true));
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/frontend.css"><style>body{margin:0}body:after{content:"";display:block;height:100vh}</style></head><body>'.WPLM_Admin::preview_markup($s).'<script src="/assets/js/frontend.js"></script></body></html>'; exit;
}
function check($condition,$message) { if (!$condition) { throw new RuntimeException($message); } }
$bad=WPLM_Settings::sanitize(array('height'=>99999,'background'=>'red;position:fixed','label'=>'<b>Mountains</b>','layers'=>array(array('type'=>'script','name'=>'<b>name</b>','text'=>'<script>alert(1)</script>','x'=>-9999,'opacity'=>500,'image'=>array(1),'color'=>array('bad'),'move_y'=>array(1),'hidden'=>true))));
check($bad['height']===2400, 'Height must be bounded');
check(!isset($bad['background']) && strpos(WPLM_Render::markup($bad),'background')===false, 'No scene background: the preview has its dark screen');
check($bad['height_unit']==='px','Height unit defaults to px');
$units=WPLM_Settings::sanitize(array('height_unit'=>'em;x','tablet_height_unit'=>'vh','tablet_height'=>500,'mobile_height_unit'=>'auto'));
check($units['height_unit']==='px' && $units['tablet_height']===200,'Units allow-listed, shares bounded');
$unitMarkup=WPLM_Render::markup($units);
check(strpos($unitMarkup,'--wplm-tablet-height:200vh')!==false && strpos($unitMarkup,'--wplm-mobile-height:500px')!==false && strpos($unitMarkup,'data-auto="mobile"')!==false,'Units rendered, Auto marked for frontend.js');
check(!isset($bad['label']) && strpos(WPLM_Render::markup($bad),'aria-label')===false,'No scene label: scenes are decoration');
check($bad['layers'][0]['type']==='image' && $bad['layers'][0]['image']===0,'Unexpected layer types and attachment arrays rejected');
check($bad['layers'][0]['x']===-100 && $bad['layers'][0]['opacity']===100,'Geometry bounded');
check($bad['layers'][0]['move_y']===-60,'Malformed numeric input falls back');
check(count(WPLM_Settings::sanitize(array('layers'=>array_fill(0,100,array())))['layers'])===40,'Layer count bounded');
$s=WPLM_Settings::sanitize(array('layers'=>array(array('type'=>'image','image'=>1,'name'=>'Back','move_y'=>0),array('type'=>'text','text'=>'"<b>Title</b> & more'),array('type'=>'image','image'=>1,'hidden'=>true))));
$markup=WPLM_Render::markup($s);
check(substr_count($markup,'class="wplm-layer ')===2,'Hidden layers not rendered');
check(strpos($markup,'z-index:1')<strpos($markup,'z-index:2'),'Back-to-front order preserved');
check(strpos($markup,'<b>')===false && strpos($markup,'&amp; more')!==false,'Text escaped');
check(strpos($markup,'data-move-y="0 0 0"')!==false,'Static layer retains zero motion on every device');
check(WPLM_Settings::sanitize($s)==$s,'Sanitization idempotent');
$old=WPLM_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_size'=>96))));
check($old['layers'][0]['tablet_font_size']===96.0,'Older scenes keep the desktop size on tablets');
$own=WPLM_Settings::sanitize(array('layers'=>array(array('type'=>'text','font_size'=>96,'tablet_font_size'=>9999))));
check($own['layers'][0]['tablet_font_size']===500,'Tablet font size bounded');
check(strpos(WPLM_Render::markup($old),'--wplm-tablet-font:96px')!==false,'Tablet font size rendered');
$old=WPLM_Settings::sanitize(array('layers'=>array(array('type'=>'image','move_y'=>-80,'mobile_motion'=>50))));
check($old['layers'][0]['move_y_mobile']===-40.0 && $old['layers'][0]['move_y_tablet']===null && !isset($old['layers'][0]['mobile_motion']),'Motion on mobile becomes the mobile travel');
check(WPLM_Settings::sanitize($old)==$old,'Migrated scenes stay as they are');
$r=WPLM_Settings::sanitize(array('layers'=>array(array('type'=>'image','x'=>30,'x_tablet'=>'','x_mobile'=>70,'width_tablet'=>9999,'fit_mobile'=>'contain','fit_tablet'=>'bad'))));
check($r['layers'][0]['x_tablet']===null && $r['layers'][0]['width_tablet']===300 && $r['layers'][0]['fit_tablet']===null,'Per-device values: empty inherits, numbers bounded, choices allow-listed');
check(WPLM_Settings::resolved($r['layers'][0],'x')===array('desktop'=>30.0,'tablet'=>30.0,'mobile'=>70.0),'Mobile → tablet → desktop');
$rm=WPLM_Render::markup($r);
check(strpos($rm,'--wplm-left:30%;--wplm-left-t:30%;--wplm-left-m:70%')!==false && strpos($rm,'--wplm-fit-m:contain')!==false,'Per-device values rendered as variables');
check(WPLM_Admin::image_info(5)===array('name'=>'mountains-cutout.png','width'=>1920,'height'=>1080,'size'=>'420 KB'),'Image name, pixel size and weight for the picker');
echo "Settings and rendering checks passed.\n";
// Release: one version everywhere, the author, and a Changelog "What's new" can read.
require_once __DIR__.'/../includes/class-wplm-whats-new.php';
$main=file_get_contents(__DIR__.'/../wp-layer-motion.php');$readme=file_get_contents(__DIR__.'/../readme.txt');
preg_match('/^\s*\*\s*Version:\s*(\S+)/m',$main,$header);preg_match("/define\('WPLM_VERSION', '([^']+)'\)/",$main,$constant);preg_match('/^Stable tag:\s*(\S+)/m',$readme,$stable);
check($header[1]===$constant[1] && $header[1]===$stable[1],'Version header, WPLM_VERSION and Stable tag match');
check(preg_match('/^\s*\*\s*Author:\s*Relevant AS$/m',$main) && preg_match('#^\s*\*\s*Author URI:\s*https://relevant\.no/$#m',$main),'Author is Relevant AS');
$log=WPLM_Whats_New::parse_changelog($readme);
check(isset($log[$header[1]]) && count($log[$header[1]])>0,'The current version has Changelog items for What\'s new');
check(array_keys(WPLM_Whats_New::between(array('0.2.0'=>array('b'),'0.1.0'=>array('a')),'0.1.0','0.2.0'))===array('0.2.0'),'Only the versions after the one seen');
echo "Release checks passed.\n";
