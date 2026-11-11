// The banner on the page (frontend.js, frontend.css) in each browser engine: Chromium, Firefox and WebKit
// (Safari's engine). tests/motion.cjs checks the editor and the motion in detail, in Chrome only; this one
// checks what has broken before in one engine and not another: the scroll motion, an entrance, a slow loop
// that must move smoothly (not stand still and jump: Firefox and registered custom properties), and a
// Shape layer's masks and its whole-Shape animations.
// Playwright's own Firefox and WebKit: once, `npx playwright-core install firefox webkit`. An engine that
// is not installed is skipped with a note (WPBN_ENGINES=all makes that an error).
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const playwright=require('playwright-core');
const root=path.resolve(__dirname,'..');
const php=process.env.PHP_BIN || 'C:/OSPanel/modules/PHP-8.3/PHP/php.exe';
// A scene: a photo that travels and zooms, a title that slides in on load and zooms slowly for ever, and a
// Shape (attachment 900 in tests/settings.php: three strips) in colour that fades in and slides for ever.
const SCENE={height:600,height_unit:'px',layers:[
    {type:'image',image:1,move_y:200,zoom:20},
    {type:'text',text:'Engines',use_enter:true,enter_type:'slide-up',enter_start:'load',enter_duration:0.6,
        use_anim:true,anim_type:'zoom',anim_from:100,anim_to:130,anim_duration:4,anim_repeat:'alternate',anim_easing:'linear'},
    {type:'shape',shape:900,shape_objects:['o1','o2','o3'].map(key=>({key,fill:'color',color:'#cc3300'})),
        use_enter:true,enter_type:'fade',enter_start:'load',enter_duration:0.6,
        use_anim:true,anim_type:'slide-x',anim_duration:4,anim_repeat:'alternate',anim_easing:'linear'}
]};
const page=()=>execFileSync(php,[path.join(__dirname,'settings.php'),'--preview'],{encoding:'utf8',input:JSON.stringify(SCENE)});
const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/assets/')) {
        const file=path.join(root,url.pathname);
        if (!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.svg')?'image/svg+xml':'text/css');res.end(fs.readFileSync(file));return;
    }
    res.setHeader('Content-Type','text/html');res.end(page());
});
const ENGINES={
    chromium:()=>playwright.chromium.launch({executablePath:process.env.BROWSER_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),
    firefox:()=>playwright.firefox.launch({headless:true}),
    webkit:()=>playwright.webkit.launch({headless:true})
};
// What changes over time on an element and those inside it: their transforms and opacities, as the browser draws them now.
const looks=(p,selector)=>p.evaluate(sel=>Array.from(document.querySelectorAll(sel)).map(el=>{const s=getComputedStyle(el);return s.transform+'|'+s.opacity;}).join(';'),selector);
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const checked=[], skipped=[];
    try {
        for (const [name,launch] of Object.entries(ENGINES)) {
            let browser;
            try { browser=await launch(); }
            catch (e) {
                if (process.env.WPBN_ENGINES==='all' || name==='chromium') throw e;
                skipped.push(name);continue;
            }
            try {
                const p=await browser.newPage({viewport:{width:1200,height:800}});
                const errors=[];p.on('pageerror',e=>errors.push(e.message));
                await p.goto('http://127.0.0.1:'+server.address().port+'/');
                await p.waitForSelector('.wpbn-scene');
                const say=text=>name+': '+text;
                // The Shape: an item per object, each clipped by its own mask (WebKit may only have the prefixed one).
                assert.equal(await p.locator('.wpbn-shape-item').count(),3,say('a box per Shape object'));
                const masks=await p.evaluate(()=>Array.from(document.querySelectorAll('.wpbn-shape-clip')).map(el=>{const s=getComputedStyle(el);return s.maskImage||s.webkitMaskImage||'none';}));
                assert.ok(masks.length===3 && masks.every(m=>m && m!=='none' && m.indexOf('url(')!==-1),say('each Shape object masked: '+masks.map(m=>String(m).slice(0,30)).join(', ')));
                // The entrances end where they rest: the title and the Shape fully shown.
                await p.waitForTimeout(1200);
                const shown=await p.evaluate(()=>{const enter=document.querySelector('.wpbn-layer--text .wpbn-enter');return enter?Number(getComputedStyle(enter).opacity):-1;});
                assert.ok(shown>0.99,say('the title has come in (opacity '+shown+')'));
                // A slow loop moves a little all the time, not only at its end (Firefox once kept it still, then jumped):
                // sampled three times, every sample differs from the one before.
                for (const [what,selector] of [['the title\'s zoom','.wpbn-layer--text .wpbn-anim'],['the Shape\'s slide','.wpbn-layer--shape .wpbn-shape-fill, .wpbn-layer--shape .wpbn-shape-clip']]) {
                    const samples=[];
                    for (let i=0;i<3;i++) { samples.push(await looks(p,selector)); await p.waitForTimeout(300); }
                    assert.ok(samples[0]!=='' && samples[0]!==samples[1] && samples[1]!==samples[2],say(what+' runs smoothly: '+samples.map(s=>s.slice(0,60)).join(' / ')));
                }
                // The scroll: the photo travels as the scene passes (frontend.js sets --wpbn-dy on the layer).
                const travel=()=>p.evaluate(()=>getComputedStyle(document.querySelector('.wpbn-layer--image')).getPropertyValue('--wpbn-dy').trim());
                const before=await travel();
                await p.evaluate(()=>window.scrollTo(0,300));
                await p.waitForFunction(b=>getComputedStyle(document.querySelector('.wpbn-layer--image')).getPropertyValue('--wpbn-dy').trim()!==b,before,{timeout:3000}).catch(()=>{});
                const after=await travel();
                assert.ok(after!=='' && after!==before,say('the photo travels with the scroll ('+before+' -> '+after+')'));
                assert.deepEqual(errors,[],say('no script errors'));
                checked.push(name);
            } finally { await browser.close(); }
        }
        console.log('Engine checks passed: '+checked.join(', ')+(skipped.length?' (not installed, skipped: '+skipped.join(', ')+'; npx playwright-core install '+skipped.join(' ')+')':''));
    } finally { server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
