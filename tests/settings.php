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
require_once __DIR__.'/../includes/class-wpbn-gradient.php';
// A see-through photo (a cutout, PNG): attachment 2; any other: JPEG (the Gradient's mask).
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
    public function enqueue_inline_fonts($fonts, $id) { foreach ($fonts as $f) { $key = $f["font-family"]."@".$f["font-weight"]; if (isset(self::$loaded[$key])) { continue; } self::$loaded[$key] = true; echo "<link rel=\"stylesheet\" id=\"xts-google-fonts-inline-".$id."-css\" href=\"https://fonts.googleapis.com/css2?family=".str_replace(" ", "+", $f["font-family"]).":wght@".$f["font-weight"]."\">"; } }
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
// Gradient (as WP Swiper's): checked and kept in order; over an image (on a cutout, masked by it); a title's letters filled.
check(WPBN_Gradient::sanitize('circle;left top;#F00@100;rgba(0, 0, 255, 0.5)@20;bad@50;#0f0@x')==='circle;left top;rgba(0,0,255,0.5)@20;#ff0000@100','A gradient: colours checked, bad points left out, in order');
foreach (array('', 'linear;middle;#000@0;#fff@100', 'conic;left;#000@0;#fff@100', 'linear;left;#000@0', 'linear;left;#000@0;#fff@100;x</style>') as $bad) {
    check(WPBN_Gradient::sanitize($bad)===($bad==='linear;left;#000@0;#fff@100;x</style>' ? 'linear;left;#000000@0;#ffffff@100' : WPBN_Gradient::DEFAULT_VALUE),'Not a gradient (or its junk left out): '.$bad);
}
check(count(WPBN_Gradient::parse('linear;left;'.implode(';', array_fill(0, 14, '#000@50')))['stops'])===10,'Ten colours at most');
check(WPBN_Gradient::css('linear;left;#000@0;#fff@100')==='linear-gradient(to right, #000000 0%, #ffffff 100%)' && WPBN_Gradient::css('ellipse;center bottom;#000@0;#fff@100')==='radial-gradient(ellipse at center bottom, #000000 0%, #ffffff 100%)','Its CSS: linear starting at the left goes to the right; radial at its middle');
$lay=function ($l) { return WPBN_Settings::sanitize(array('layers'=>array($l)))['layers'][0]; };
check($lay(array())['use_gradient']===false && $lay(array())['gradient']===WPBN_Gradient::DEFAULT_VALUE,'Off, with its default colours');
$graded=WPBN_Render::markup(WPBN_Settings::sanitize(array('layers'=>array(
    array('type'=>'image','image'=>1,'use_gradient'=>true,'gradient'=>'linear;top;#000@0;#fff@100'),
    array('type'=>'image','image'=>2,'image_mobile'=>1,'use_gradient'=>true),
    array('type'=>'text','use_gradient'=>true,'gradient'=>'linear;left;#ff0000@0;#0000ff@100','font_family'=>'Exo 2'),
    array('type'=>'image','image'=>1,'gradient'=>'linear;top;#000@0;#fff@100'),
))));
check(substr_count($graded,'wpbn-layer--gradient')===2 && strpos($graded,'--wpbn-gradient:linear-gradient(to bottom, #000000 0%, #ffffff 100%);--wpbn-mask:none;--wpbn-mask-t:none;--wpbn-mask-m:none;')!==false,'Over a photo: its gradient, no mask');
check(strpos($graded,'--wpbn-mask:url(&quot;/assets/images/preview/desktop.svg&quot;);--wpbn-mask-t:url(&quot;/assets/images/preview/desktop.svg&quot;);--wpbn-mask-m:none;')!==false,'Over a cutout: masked by it on each device where it is one');
check(strpos($graded,'font-family:&quot;Exo 2&quot;;background-image:linear-gradient(to right, #ff0000 0%, #0000ff 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;')!==false,'A title: its letters filled with the gradient');
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
