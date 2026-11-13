const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
// Playwright (npm install: package.json devDependencies) drives the Chrome already on the machine (BROWSER_BIN).
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
// Position: the button on the chosen layer's tile (2026-11-09); its value is its title (the browser's tooltip), refreshed as it is pointed at.
const POS='.wpbn-layer-row.is-active [data-row-action="position"]';
const posTip=async p=>{await p.hover(POS);return p.locator(POS).getAttribute('title');};
// The Position window's X and Y (typed or set by dragging, 2026-11-09), as "X% Y%".
const focusValue=p=>p.evaluate(()=>document.getElementById('wpbn-pos-x').value+'% '+document.getElementById('wpbn-pos-y').value+'%');
const php=process.env.PHP_BIN || 'C:/OSPanel/modules/PHP-8.3/PHP/php.exe';
const fixture=(mode,input='',image=false,still=false)=>execFileSync(php,[path.join(__dirname,'settings.php'),mode],{encoding:'utf8',input,env:Object.assign({},process.env,image?{WPBN_TEST_IMAGE:'1'}:{},still?{WPBN_TEST_STILL:'1'}:{})});
const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/assets/')) {
        const file=path.join(root,url.pathname);
        if (!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.svg')?'image/svg+xml':'text/css');res.end(fs.readFileSync(file));return;
    }
    // An SVG uploaded in a Shape layer's card (multipart, as admin-ajax wpbn_shape_upload gets it): the attachment tests/settings.php keeps.
    if(req.method==='POST' && /^multipart\//.test(req.headers['content-type']||'')){req.resume();req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(fixture('--shape'));});return;}
    if(req.method==='POST'){
        let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.setHeader('Content-Type','text/html');const q=new URLSearchParams(body);res.end(fixture('--preview',q.get('scene'),false,q.get('still')==='1'));});return;
    }
    res.setHeader('Content-Type','text/html');res.end(fixture('--editor','',url.searchParams.has('image')));
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await chromium.launch({executablePath:process.env.BROWSER_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
        const page=await browser.newPage({viewport:{width:1600,height:1000}});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto('http://127.0.0.1:'+server.address().port);
        // Update redraws the preview (frame data-state: loading, then done); it does not play the scroll.
        const update=async()=>{await page.click('#wpbn-refresh');await page.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');};
        // A switch (motion, Scale, Opacity): its label, as a person clicks it.
        const toggle=async key=>{await page.click('label[for="wpbn-f-'+key+'"]');};
        const data=async()=>JSON.parse(await page.locator('#wpbn-data').inputValue());
        // Add element: the block opens on its tiles; a tile adds that element and closes it.
        const addElement=async type=>{await page.click('#wpbn-add-toggle');assert.equal(await page.locator('#wpbn-add-toggle').getAttribute('aria-expanded'),'true');assert.ok(await page.locator('.wpbn-modal--add').isVisible(),'The elements open in a window');await page.click('.wpbn-modal--add [data-add="'+type+'"]');assert.equal(await page.locator('#wpbn-layers > .wpbn-layer-row:last-child.is-active').count(),1,'The new layer: the last tile, chosen');assert.ok(await page.locator('.wpbn-modal--add').isHidden() && await page.locator('#wpbn-add-toggle').getAttribute('aria-expanded')==='false','The window closes');assert.equal(await page.locator('#wpbn-settings legend').textContent(),'Content','The new layer is selected, on Content (the title: its block\'s name)');};
        assert.ok(await page.locator('.wpbn-modal--add').isHidden(),'No elements shown before Add element');
        // Esc, Close and the backdrop close the window without adding anything.
        for (const how of ['Escape','.wpbn-modal--add .wpbn-modal__close','.wpbn-modal--add .wpbn-modal__backdrop']) {
            await page.click('#wpbn-add-toggle');
            assert.ok(await page.locator('.wpbn-modal--add [data-add="image"]').evaluate(el=>el===document.activeElement),'The first element focused');
            if (how==='Escape') await page.keyboard.press('Escape'); else await page.locator(how).click({position:{x:5,y:5}});
            assert.ok(await page.locator('.wpbn-modal--add').isHidden() && JSON.parse(await page.locator('#wpbn-data').inputValue()).layers.length===0,how+' closes it, nothing added');
        }
        await addElement('text');
        await page.fill('[data-key="text"]','SLOVAKIA');
        assert.equal(await page.locator('[data-key="x"],[data-key="y"]').count(),0,'Numeric position fields replaced');
        // Position (2026-11-09): a button on the layer's tile between Hide and Duplicate, its value on hover; none in its settings. No Width.
        assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.wpbn-layer-row.is-active .wpbn-layer-tools button')].map(x=>x.dataset.rowAction).join()==='hide,position,duplicate,delete') && await page.locator('#wpbn-settings [data-action="position"]').count()===0,'Position on the tile between Hide and Duplicate, not in the settings');
        assert.ok(await page.evaluate(()=>{const b=document.querySelector('.wpbn-layer-row.is-active [data-row-action="position"]'),r=b.querySelector('svg').getBoundingClientRect();return r.width===16 && getComputedStyle(b.querySelector('svg path')).strokeWidth==='2.2px' && !!document.querySelector('.wpbn-layer-row.is-active [data-row-action="hide"]').title;}),'Its icon 16px, bolder; a title as Hide has');
        assert.equal(await page.locator('[data-key="width"]').count(),0,'No Width');
        assert.equal(await page.locator('[data-key^="scale"],[data-key^="opacity"],[data-key="use_scale"],[data-key="use_opacity"]').count(),0,'A title: no Scale, no Opacity');
        await page.click(POS);
        const positionStage=page.locator('.wpbn-focus__stage');
        await positionStage.press('ArrowRight');await positionStage.press('Shift+ArrowUp');
        assert.equal(await focusValue(page),'51% 40%');
        await page.click('.wpbn-modal__cancel');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].x,50,'Cancel preserves saved coordinates');
        await page.click(POS);
        const bounds=await positionStage.boundingBox();
        await page.mouse.move(bounds.x+bounds.width*.25,bounds.y+bounds.height*.75);await page.mouse.down();
        await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.25);await page.mouse.up();
        // A new scene: titles in the theme container (Woodmart's 1222px less 30px, centred in the 1280px desktop): its edges dashed;
        // a point at 75% of the scene is 76.8% of the container.
        assert.deepEqual(await page.locator('.wpbn-focus__stage .wpbn-position-container').evaluate(el=>[el.style.left,el.style.width]),['3.4375%','93.125%'],'The container edges in the window');
        assert.equal(await focusValue(page),'76.8% 25%','Dragging places layer centre, as a share of the container');
        assert.ok(Math.abs((await page.locator('.wpbn-focus__point').boundingBox()).x+(await page.locator('.wpbn-focus__point').boundingBox()).width/2-(bounds.x+bounds.width*.75))<2,'Where it was dropped');
        await page.screenshot({path:path.join(__dirname,'position-modal.png'),fullPage:true});
        await page.click('.wpbn-modal__apply');
        let positioned=JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0];
        assert.equal(positioned.x,76.8);assert.equal(positioned.y,25);
        assert.equal(await posTip(page),'Position: 76.8% 25%','Its value on hover');
        // The device chosen in the window's head (2026-11-13), as the frames do: a place of its own there, a green dot on it.
        await page.click(POS);
        assert.ok(await page.locator('[data-pos-device="desktop"]').getAttribute('aria-pressed')==='true' && await page.locator('[data-pos-device].has-value').count()===0,'Opened on the device edited, no place of its own elsewhere');
        await page.click('[data-pos-device="tablet"]');
        assert.ok(await page.locator('[data-pos-device="tablet"]').getAttribute('aria-pressed')==='true' && await page.locator('.wpbn-focus__device[data-device="tablet"]').evaluate(b=>b.classList.contains('is-active')) && (await page.locator('.wpbn-modal__layer').textContent()).endsWith('Tablet'),'Tablet chosen: its frame and the title follow');
        await page.fill('#wpbn-pos-x','20');
        assert.ok(await page.locator('[data-pos-device="tablet"]').evaluate(b=>b.classList.contains('has-value')),'Moved on Tablet: a green dot');
        await page.locator('.wpbn-modal--position .wpbn-modal__head').screenshot({path:path.join(__dirname,'position-devices.png')});
        await page.click('[data-pos-device="desktop"]');
        assert.equal(await focusValue(page),'76.8% 25%','Desktop keeps its own place');
        await page.click('.wpbn-modal__cancel');
        assert.equal((await data()).layers[0].x_tablet,null,'Cancel: nothing kept for Tablet');
        assert.equal(await page.locator(POS).evaluate(el=>el===document.activeElement),true,'Focus restored after apply');
        await page.click(POS);
        await positionStage.press('ArrowLeft');await positionStage.press('Escape');
        assert.equal(await posTip(page),'Position: 76.8% 25%','Escape discards draft');
        await page.click(POS);await page.click('.wpbn-focus__reset');await page.click('.wpbn-modal__apply');
        assert.equal(await posTip(page),'Position: 50% 50%','Reset centres the layer');
        // X and Y typed (2026-11-09): the layer goes there as it is typed; Enter applies.
        await page.click(POS);
        await page.fill('#wpbn-pos-x','30');
        assert.equal(await page.locator('.wpbn-focus__stage').getAttribute('aria-valuenow'),'30','Typed: the layer moves there');
        await page.press('#wpbn-pos-x','Enter');
        assert.ok(await page.locator('.wpbn-modal--position').isHidden() && JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].x===30,'Enter applies the typed X');
        await page.click(POS);await page.click('.wpbn-focus__reset');await page.click('.wpbn-modal__apply');
        // Scroll animation: no switch (2026-11-09, user's request): its fields at once, at rest; it is always on.
        assert.ok(await page.locator('[data-key="move_y"]').count()===1 && await page.locator('#wpbn-f-use_scroll').count()===0,'Scroll animation: no switch, its fields at once');
        assert.ok((await data()).layers[0].use_scroll===true && (await data()).layers[0].use_move_y===true && (await data()).layers[0].use_zoom===true && (await data()).layers[0].move_y===0,'Always on, at rest');
        // Its fields' help in tips beside their labels, not under them.
        assert.ok(await page.locator('[data-base="move_y"] .wpbn-field__head .wpbn-tip').count()===1 && await page.locator('[data-base="move_y"] > .description').count()===0,'Travel: its help in a tip');
        assert.equal(await page.locator('label[for="wpbn-f-use_move_x"],label[for="wpbn-f-use_move_y"],label[for="wpbn-f-use_zoom"],label[for="wpbn-f-use_end_opacity"]').count(),0,'No switches inside it');
        assert.equal(await page.locator('[data-key="end_opacity"]').inputValue(),'100','Opacity at the end: as it is, to start with');
        assert.equal(await page.locator('[data-key="move_y"]').inputValue(),'0','A new layer does not move');
        await page.fill('[data-key="move_y"]','-80');
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelectorAll('.wpbn-layer').length),0,'Changes reach the preview only through Update');
        assert.equal(await page.locator('#wpbn-refresh').evaluate(el=>el.classList.contains('is-stale')),true,'Update is lit while the preview is behind');
        await update();
        const frame=()=>page.frames().find(f=>f.name()==='wpbn_preview_frame');
        await page.waitForFunction(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-layer')?.textContent==='SLOVAKIA');
        assert.equal(await page.locator('#wpbn-refresh').evaluate(el=>el.classList.contains('is-stale')),false,'Update is plain again once pressed');
        await frame().waitForFunction(()=>typeof window.wpbnPreviewProgress==='function');
        await page.locator('#wpbn-progress').evaluate(el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.equal(await frame().locator('.wpbn-layer').evaluate(el=>parseFloat(el.style.getPropertyValue('--wpbn-dy'))),-80);
        // Move (2026-11-13): the chosen layer dragged right in the preview, wherever the pointer is on the scene, on the device it
        // shows; the preview at rest meanwhile.
        assert.ok(!(await page.locator('#wpbn-move').isDisabled()),'Move: active for the chosen title');
        await page.click('#wpbn-move');
        await frame().locator('#wpbn-move').waitFor();
        assert.ok(await frame().evaluate(()=>document.body.classList.contains('wpbn-moving') && getComputedStyle(document.querySelector('.wpbn-layer')).getPropertyValue('--wpbn-dy').trim()==='0px'),'The preview at rest while moving');
        const veilBox=await frame().locator('#wpbn-move').boundingBox(), textBefore=await frame().locator('.wpbn-layer').boundingBox();
        await page.mouse.move(veilBox.x+veilBox.width*.8,veilBox.y+veilBox.height*.2);await page.mouse.down();
        await page.mouse.move(veilBox.x+veilBox.width*.6,veilBox.y+veilBox.height*.4,{steps:5});await page.mouse.up();
        const dropped=(await data()).layers[0];
        assert.ok(dropped.x<50 && dropped.y>50 && dropped.x_tablet==null && dropped.x_mobile==null,'Dragged: the chosen layer, its X / Y for Desktop only ('+dropped.x+' '+dropped.y+')');
        const textAfter=await frame().locator('.wpbn-layer').boundingBox();
        assert.ok(textAfter.x<textBefore.x-5 && textAfter.y>textBefore.y+5,'Moved in the preview at once');
        await page.locator('#wpbn-preview-stage').screenshot({path:path.join(__dirname,'preview-move.png')});
        await update();
        await frame().locator('#wpbn-move').waitFor();
        const textAgain=await frame().locator('.wpbn-layer').boundingBox();
        assert.ok(Math.abs(textAgain.x-textAfter.x)<2 && Math.abs(textAgain.y-textAfter.y)<2,'Update draws it where it was dropped');
        await page.click('#wpbn-scene-settings');
        assert.ok(await page.locator('#wpbn-move').isDisabled() && await frame().locator('#wpbn-move').count()===0 && !(await frame().evaluate(()=>document.body.classList.contains('wpbn-moving'))),'Scene settings: nothing to move, the preview runs again');
        await page.click('[data-select="0"]');
        await page.click('#wpbn-undo');
        assert.ok((await data()).layers[0].x===50 && (await data()).layers[0].y===50,'Undo puts it back');
        await update();
        await page.click('[data-preview-device="mobile"]');
        await page.waitForTimeout(100);
        assert.equal(await frame().evaluate(()=>innerWidth),390);
        assert.equal(await frame().locator('.wpbn-layer').evaluate(el=>getComputedStyle(el).fontSize),'120px','Mobile follows the desktop font size');
        assert.equal(await frame().locator('.wpbn-layer').evaluate(el=>parseFloat(el.style.getPropertyValue('--wpbn-dy'))),-80,'Mobile follows the larger screen\'s travel');
        assert.equal(await page.locator('[data-key="move_y_mobile"]').inputValue(),'','An inherited value leaves the number empty');
        assert.equal(await page.locator('[data-key="move_y_mobile"]').getAttribute('placeholder'),'-80','The inherited value shows as its placeholder');
        await page.fill('[data-key="move_y_mobile"]','-40');
        assert.equal(await page.locator('.wpbn-field[data-base="move_y"] [data-field-device="mobile"]').evaluate(el=>el.classList.contains('has-value')),true,'Own value: green dot');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].move_y,-80,'The desktop value stays');
        await update();
        await page.locator('#wpbn-progress').evaluate(el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.equal(await frame().locator('.wpbn-layer').evaluate(el=>parseFloat(el.style.getPropertyValue('--wpbn-dy'))),-40,'Mobile uses its own travel');
        await page.fill('[data-key="move_y_mobile"]','');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].move_y_mobile,null,'Cleared: inherited again');
        assert.equal(await page.locator('.wpbn-field[data-base="move_y"] [data-field-device="mobile"]').evaluate(el=>el.classList.contains('has-value')),false);
        await page.fill('[data-key="move_y_mobile"]','-40');
        await page.click('#wpbn-rotate');await page.waitForTimeout(100);
        assert.ok(await page.locator('#wpbn-preview-stage').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),'Rotation animates rather than jumping');
        assert.equal(await frame().evaluate(()=>innerWidth),844);
        // Screen: the phone turned, its width and height swap places in the fields; typed so, it is kept upright.
        assert.deepEqual([await page.locator('#wpbn-res-w').getAttribute('placeholder'),await page.locator('#wpbn-res-h').getAttribute('placeholder')],['844','390'],'Turned: the fields show the screen sideways');
        await page.fill('#wpbn-res-w','900');await page.fill('#wpbn-res-h','400');
        await page.click('#wpbn-rotate');await page.waitForTimeout(50);
        assert.deepEqual([await page.locator('#wpbn-res-w').inputValue(),await page.locator('#wpbn-res-h').inputValue()],['400','900'],'Turned back: the same size, upright');
        await page.click('#wpbn-rotate');await page.waitForTimeout(50);
        assert.deepEqual([await page.locator('#wpbn-res-w').inputValue(),await page.locator('#wpbn-res-h').inputValue()],['900','400'],'Turned again: sideways');
        await page.fill('#wpbn-res-w','');await page.fill('#wpbn-res-h','');
        await page.click('#wpbn-dark');
        assert.equal(await frame().locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(18, 18, 18)');
        const names=async()=>JSON.parse(await page.locator('#wpbn-data').inputValue()).layers.map(l=>l.name);
        await page.click('[data-row-action="duplicate"]');
        assert.equal(await page.locator('.wpbn-layer-row').count(),2);
        assert.equal(await page.locator('.wpbn-layer-row.is-active [data-select="1"]').count(),1,'The copy is selected, in front');
        await page.locator('[data-select="1"]').press('Alt+ArrowDown');
        assert.deepEqual(await names(),['Title 1 copy','Title 1'],'Alt + Down sends the layer backward');
        assert.equal(await page.locator('[data-select="0"]').evaluate(el=>el===document.activeElement),true,'Focus follows the moved layer');
        // Tiles (2026-11-09): from the back layer to the front one, numbered on their thumbnails (1: the back one).
        const tileBox=async i=>page.locator('.wpbn-layer-row[data-index="'+i+'"]').boundingBox();
        assert.ok((await tileBox(0)).x<(await tileBox(1)).x && await page.locator('.wpbn-layer-row[data-index="1"] .wpbn-layer-thumb .wpbn-tile__number').textContent()==='2','The back layer\'s tile first; numbers on the thumbnails');
        // Dragged, the others make room as it goes (shown before it is dropped); over a tile's right half: after it (in front).
        const src=await tileBox(0), dst=await tileBox(1);
        await page.mouse.move(src.x+src.width/2,src.y+30);await page.mouse.down();await page.mouse.move(dst.x+dst.width-20,dst.y+30,{steps:4});
        assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#wpbn-layers .wpbn-layer-row')].map(r=>r.dataset.index)),['1','0'],'While it is dragged the other tile is already in its new place');
        await page.mouse.up();
        assert.deepEqual(await names(),['Title 1','Title 1 copy'],'Dropped on the right half of a tile: the layer in front of it');
        await page.locator('.wpbn-layer-row[data-index="1"]').dragTo(page.locator('.wpbn-layer-row[data-index="0"]'),{targetPosition:{x:20,y:30}});
        assert.deepEqual(await names(),['Title 1 copy','Title 1'],'Dropped on the left half: behind it');
        assert.equal(await page.locator('.wpbn-layer-row[data-index="0"] .wpbn-layer-select').evaluate(el=>getComputedStyle(el).cursor),'grab','Tiles show a grab cursor');
        // A tile's buttons on hover: the scheme's blue, Delete red.
        for (const [action,color] of [['hide','rgb(34, 113, 177)'],['duplicate','rgb(34, 113, 177)'],['delete','rgb(214, 54, 56)']]) { const el=page.locator('[data-row-action="'+action+'"][data-index="0"]');await el.hover();assert.equal(await el.evaluate(e=>getComputedStyle(e).color),color,action+': its hover colour'); }
        const rowBox=await page.locator('.wpbn-layer-row[data-index="0"]').boundingBox();
        await page.mouse.move(rowBox.x+40,rowBox.y+rowBox.height/2);await page.mouse.down();await page.mouse.move(rowBox.x+40,rowBox.y+rowBox.height/2+12);
        assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.wpbn-layer-row.is-dragging .wpbn-layer-select')).cursor),'grabbing','Dragging shows a grabbing hand');
        await page.mouse.move(rowBox.x+40,rowBox.y+rowBox.height/2);await page.mouse.up();
        assert.deepEqual(await names(),['Title 1 copy','Title 1'],'Dropped where it was: no change');
        await page.click('[data-row-action="hide"][data-index="0"]');
        assert.equal(await page.locator('.wpbn-layer-row[data-index="0"]').evaluate(el=>el.classList.contains('is-hidden')),true);
        await update();
        await page.waitForFunction(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelectorAll('.wpbn-layer').length===1);
        await page.click('[data-row-action="delete"][data-index="0"]');
        assert.equal(await page.locator('.wpbn-layer-row').count(),1);
        assert.deepEqual(await names(),['Title 1']);
        await page.click('#wpbn-scene-settings');
        assert.deepEqual(await page.locator('[data-key="mobile_height_unit"] option').evaluateAll(o=>o.map(x=>x.value)),['','auto','px','vh','%'],'Follow the larger screen, then Auto first');
        assert.equal(await page.locator('[data-key="mobile_height_unit"]').inputValue(),'','Mobile follows by default');
        assert.match(await page.locator('[data-key="mobile_height_unit"] option[value=""]').textContent(),/^Inherit$/,'Following the larger screen: Inherit');
        assert.equal(await page.locator('.wpbn-field--height [data-field-device="mobile"]').evaluate(el=>el.classList.contains('has-value')),false,'No green dot while following');
        await page.selectOption('[data-key="mobile_height_unit"]','px');
        assert.equal(await page.locator('.wpbn-field--height [data-field-device="mobile"]').evaluate(el=>el.classList.contains('has-value')),true,'A unit of its own: green dot');
        await page.fill('#wpbn-f-mobile_height','480');
        await page.click('[data-preview-device="mobile"]');await page.click('#wpbn-rotate');await update();
        await page.waitForFunction(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-scene')?.style.getPropertyValue('--wpbn-mobile-height')==='480px');
        await frame().waitForFunction(()=>typeof window.wpbnPreviewProgress==='function');
        await page.emulateMedia({reducedMotion:'reduce'});
        await frame().evaluate(()=>window.wpbnPreviewProgress(1));
        assert.equal(await frame().locator('.wpbn-layer').evaluate(el=>getComputedStyle(el).getPropertyValue('--wpbn-dy').trim()),'0px');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await frame().evaluate(()=>scrollTo(0,240));await page.waitForTimeout(100);
        const moved=await frame().locator('.wpbn-layer').evaluate(el=>parseFloat(el.style.getPropertyValue('--wpbn-dy')));
        await frame().evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);
        const reversed=await frame().locator('.wpbn-layer').evaluate(el=>parseFloat(el.style.getPropertyValue('--wpbn-dy')));
        assert.ok(moved<reversed,'Scroll reverses motion');
        await page.screenshot({path:path.join(__dirname,'editor-preview.png'),fullPage:true});
        await page.click('[data-preview-device="desktop"]');
        assert.equal(await page.locator('#wpbn-rotate').isDisabled(),true);
        const widths=await page.evaluate(()=>['.wpbn-sidebar','.wpbn-settings','.wpbn-preview'].map(s=>document.querySelector(s).getBoundingClientRect().width));
        assert.ok(Math.abs(widths[0]-widths[1])<1 && Math.abs(widths[0]/widths[2]-1/2)<.005,'Editor columns use a 1:1:2 ratio (the menu and the block as wide as each other, the preview; 2026-11-09)');
        // Developer mode (2026-11-09, as WP Swiper's): over the preview the scene's size, each layer's box with its kind and size,
        // a placed layer's distances to the edges; kept after Update; off, gone.
        await page.click('#wpbn-dev');
        assert.equal(await page.locator('#wpbn-dev').getAttribute('aria-pressed'),'true');
        await frame().waitForSelector('.wpbn-scene > .wpbn-dev .wpbn-dev__size');
        const devInfo=await frame().evaluate(()=>{const r=document.querySelector('.wpbn-scene').getBoundingClientRect(),n=v=>Math.round(v*10)/10;return {size:document.querySelector('.wpbn-dev__size').textContent,scene:n(r.width)+' × '+n(r.height),names:[...document.querySelectorAll('.wpbn-dev__name')].map(e=>e.textContent),dims:document.querySelectorAll('.wpbn-dev__dimension').length};});
        // Readable since 2026-11-10: "Scene · W × H", each layer "number · name · W × H".
        assert.ok(devInfo.size==='Scene · '+devInfo.scene && devInfo.names.length===1 && /^1 · Title 1 · \d/.test(devInfo.names[0]) && devInfo.dims>0,'Developer mode: the scene size, the title box and distances ('+JSON.stringify(devInfo)+')');
        await update();
        await frame().waitForSelector('.wpbn-scene > .wpbn-dev .wpbn-dev__name');
        await page.click('#wpbn-dev');
        assert.ok(await frame().locator('.wpbn-dev').count()===0 && await page.locator('#wpbn-dev').getAttribute('aria-pressed')==='false','Developer mode off: the boxes gone');
        for (const device of ['desktop','tablet','mobile']) {
            await page.click('[data-preview-device="'+device+'"]');
            const drawing=page.locator('.wpbn-device-drawing:not([hidden])');
            await drawing.evaluate(img=>img.decode());
            assert.ok(await drawing.evaluate(img=>img.naturalWidth>0),'Device SVG loads');
            if(device!=='desktop') {
                await page.click('#wpbn-rotate');
                assert.equal(await drawing.evaluate(img=>img.style.transform),'rotate(90deg)');
                await page.locator('#wpbn-preview-stage').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
                assert.equal(await page.locator('#wpbn-preview-stage').evaluate(el=>el.classList.contains('is-turning')),false);
                const boxes=await page.evaluate(()=>[document.querySelector('#wpbn-frame'),document.querySelector('.wpbn-device-drawing:not([hidden])')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
                assert.ok(boxes[0].left>=boxes[1].left-1 && boxes[0].right<=boxes[1].right+1 && boxes[0].top>=boxes[1].top-1 && boxes[0].bottom<=boxes[1].bottom+1,'Rotated screen stays inside device drawing');
            }
        }
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.click('#wpbn-rotate');
        assert.equal(await page.locator('#wpbn-preview-stage').evaluate(el=>el.getAnimations().length),0,'Reduced motion skips rotation animation');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.click('[data-field-device="tablet"]');
        assert.equal(await page.locator('[data-preview-device="tablet"]').getAttribute('aria-pressed'),'true','Field device icons switch the preview');
        assert.equal(await page.locator('#wpbn-f-height,#wpbn-f-mobile_height').count(),0,'Only the shown device\'s height is edited');
        assert.equal(await page.locator('[data-key="tablet_height_unit"]').inputValue(),'','Tablet follows desktop by default');
        await page.selectOption('[data-key="tablet_height_unit"]','px');
        await page.fill('#wpbn-f-tablet_height','700');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).tablet_height,700);
        await page.click('[data-select="0"]');
        // Font size: one number (px after it), the device icons at the right of its label;
        // the icons choose the device; tablet and mobile empty follow the larger screen (in grey), a green dot when their own.
        const deviceBefore=await page.locator('#wpbn-device').inputValue();
        const fieldDevice=async d=>{await page.click('.wpbn-field--device-number [data-field-device="'+d+'"] >> nth=0');};
        await fieldDevice('desktop');
        const box=async s=>page.locator(s).boundingBox();
        const sizeBox=await box('#wpbn-f-font_size');
        assert.equal(await page.locator('[id*="line_height"]').count(),0,'No Line height');
        assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.wpbn-field--device-number')].every(f=>{const icons=f.querySelector('.wpbn-devices').getBoundingClientRect(),label=f.querySelector('label').getBoundingClientRect(),input=f.querySelector('input').getBoundingClientRect(),field=f.getBoundingClientRect();return Math.abs(icons.right-field.right)<1 && icons.bottom<=input.top && icons.left>label.right && Math.abs((icons.top+icons.bottom)/2-(label.top+label.bottom)/2)<6;})),'The device icons at the right of the label, on its line, over the number');
        assert.equal(await page.locator('.wpbn-field--device-number .wpbn-number-unit__unit').allTextContents().then(t=>t.join()),'px,px','px after the size and the spacing');
        await fieldDevice('tablet');
        assert.equal(await page.locator('#wpbn-f-tablet_font_size').inputValue(),'','Tablet: no size of its own');
        assert.equal(await page.locator('#wpbn-f-tablet_font_size').getAttribute('placeholder'),'120','An empty size shows the one it follows');
        await page.fill('#wpbn-f-tablet_font_size','90');
        assert.equal(await page.locator('.wpbn-field--device-number >> nth=0').locator('[data-field-device="tablet"]').getAttribute('class').then(c=>/has-value/.test(c)),true,'A green dot: tablet has a size of its own');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].tablet_font_size,90);
        await fieldDevice('mobile');
        assert.equal(await page.locator('#wpbn-f-mobile_font_size').getAttribute('placeholder'),'90','Mobile follows tablet');
        await page.fill('#wpbn-f-mobile_font_size','60');
        await page.fill('#wpbn-f-mobile_font_size','');
        assert.ok(JSON.parse(await page.locator('#wpbn-data').inputValue()).layers[0].mobile_font_size===null && await page.locator('#wpbn-f-mobile_font_size').getAttribute('placeholder')==='90','Emptied: follows again');
        await fieldDevice(deviceBefore);
        if(await page.locator('#wpbn-rotate').getAttribute('aria-pressed')==='true') await page.click('#wpbn-rotate');
        await update();
        await page.waitForFunction(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-layer')?.style.getPropertyValue('--wpbn-tablet-font')==='90px');
        await frame().waitForFunction(()=>getComputedStyle(document.querySelector('.wpbn-layer')).fontSize==='90px');
        await page.click('#wpbn-scene-settings');
        await page.selectOption('[data-key="tablet_height_unit"]','vh');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).tablet_height,100,'A share replaces a pixel height');
        await update();
        await page.waitForFunction(()=>document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-scene')?.style.getPropertyValue('--wpbn-tablet-height')==='100vh');
        assert.equal(await frame().evaluate(()=>Math.round(document.querySelector('.wpbn-scene').getBoundingClientRect().height)===innerHeight),true,'100vh is the screen height');
        await page.selectOption('[data-key="tablet_height_unit"]','auto');
        assert.equal(await page.locator('#wpbn-f-tablet_height').isDisabled(),true,'Auto has no number');
        await update();
        await page.waitForFunction(()=>!!document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-preview-parent .wpbn-scene[data-auto~="tablet"]'));
        await frame().waitForFunction(()=>Math.round(document.querySelector('.wpbn-scene').getBoundingClientRect().height)===innerHeight);
        await page.selectOption('[data-key="tablet_height_unit"]','px');
        assert.equal(JSON.parse(await page.locator('#wpbn-data').inputValue()).tablet_height,600,'Back to px: a pixel height again');
        await page.click('[data-select="0"]');
        await page.click(POS);
        await page.click('.wpbn-focus__reset');
        const stageBox=await positionStage.boundingBox();
        const textBox=await page.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox();
        await page.mouse.move(textBox.x+textBox.width/2,textBox.y+textBox.height/2);await page.mouse.down();
        await page.mouse.move(textBox.x+textBox.width/2+stageBox.width*.1,textBox.y+textBox.height/2,{steps:5});await page.mouse.up();
        // A title moves within its container: dragged, it follows the pointer (its Position: a share of the room it has).
        const movedBox=await page.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox();
        assert.ok(Math.abs(movedBox.x-textBox.x-stageBox.width*.1)<2 && Math.abs(movedBox.y-textBox.y)<1,'Dragging the title moves it by the pointer travel');
        assert.ok(Number((await focusValue(page)).split('%')[0])>60,'Its X: a share of the room left in its container');
        // At 0% and 100% it stands at the container's edges (not past them).
        const edges=await page.locator('.wpbn-focus__stage .wpbn-position-container').boundingBox();
        for (const [key,side] of [['Home','left'],['End','right']]) {
            await positionStage.focus();for(let i=0;i<11;i++)await positionStage.press(key==='Home'?'Shift+ArrowLeft':'Shift+ArrowRight');
            const t=await page.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox();
            assert.ok(side==='left' ? Math.abs(t.x-edges.x)<1.5 : Math.abs(t.x+t.width-(edges.x+edges.width))<1.5,'X '+(side==='left'?'0%':'100%')+': the title at the container '+side+' edge');
        }
        assert.equal(await page.locator('.wpbn-position-warning').isHidden(),true,'Text layers are not expected to cover the scene');
        await page.click('.wpbn-modal__cancel');
        await addElement('image');
        assert.equal(await page.locator('[data-base="width"]').count(),0,"Image layers have no Width: always the scene's");
        assert.ok(await page.locator('[data-base="scale"]').count()===1 && await page.locator('#wpbn-f-use_scale, #wpbn-f-use_opacity, #wpbn-f-use_rotate').count()===0,'Scale, Opacity, Rotation: no switches (2026-11-09)');
        assert.equal(await page.locator('#wpbn-settings [data-action="clear"]').count(),0,'No Remove on desktop: an image layer has an image');
        assert.ok(await page.locator('#wpbn-settings [data-action="position"]').count()===0 && await page.locator(POS).getAttribute('data-kind')==='focus','A photo filling the scene: its Image position on the tile, none in its settings');
        await page.click(POS);
        assert.equal(await page.locator('.wpbn-focus__device').count(),3,'One frame per device');
        const mobileRatio=await page.locator('.wpbn-focus__device[data-device="mobile"] .wpbn-focus__frame').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});
        assert.ok(Math.abs(mobileRatio-390/JSON.parse(await page.locator("#wpbn-data").inputValue()).mobile_height)<.02,'Device frames use the scene heights');
        assert.equal(await page.locator('.wpbn-focus__stage .wpbn-position-gap').count(),0,'A centred full-size layer covers the scene');
        assert.equal(await page.locator('.wpbn-position-warning').isHidden(),true,'Covering at rest: no warning (edges are kept hidden while moving)');
        await positionStage.press('Shift+ArrowRight');
        assert.ok(await page.locator('.wpbn-focus__stage .wpbn-position-gap').count()>0,'Uncovered area hatched');
        assert.match(await page.locator('.wpbn-position-warning').textContent(),/on Tablet, Mobile \(hatched\)/,'Moved on tablet: mobile follows (inherited), desktop does not');
        await page.click('.wpbn-modal__cancel');
        await page.locator('#wpbn-progress').evaluate(el=>{el.value=30;el.dispatchEvent(new Event('input',{bubbles:true}));});
        await update();
        assert.equal(await page.locator('#wpbn-play').getAttribute('aria-pressed'),'false','Update does not play the scroll');
        assert.equal(Number(await page.locator('#wpbn-progress').inputValue()),30,'Update keeps the simulation where it is');
        await page.click('#wpbn-play');
        assert.equal(await page.locator('#wpbn-play').getAttribute('aria-pressed'),'true','Play replays it');
        await page.waitForFunction(()=>Number(document.querySelector('#wpbn-progress').value)>10);
        await page.locator('#wpbn-progress').evaluate(el=>{el.value=50;el.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#wpbn-play').getAttribute('aria-pressed'),'false','Moving the slider stops the play');
        assert.equal(Number(await page.locator('#wpbn-progress').inputValue()),50);
        await page.setViewportSize({width:900,height:1000});
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.wpbn-preview').evaluate(el=>getComputedStyle(el).gridColumn),'1 / -1');
        await page.setViewportSize({width:500,height:900});
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.wpbn-workspace').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
        await page.setViewportSize({width:1600,height:1000});
        // Reset beside a slider: desktop back to the default; tablet / mobile follow the larger screen again.
        await page.click('[data-preview-device="desktop"]');
        await page.click('[data-select="0"]');
        await page.fill('[data-key="move_x"]','120');
        const reset=base=>page.locator('.wpbn-field[data-base="'+base+'"] [data-reset]');
        assert.equal(await reset('move_x').isDisabled(),false,'Something to reset: the button is active');
        await reset('move_x').click();
        assert.equal((await data()).layers[0].move_x,0,'Desktop reset: back to the default');
        assert.equal(await reset('move_x').isDisabled(),true,'Nothing to reset: greyed');
        await page.click('[data-preview-device="tablet"]');
        await page.fill('[data-key="move_x_tablet"]','30');
        await reset('move_x').click();
        assert.equal((await data()).layers[0].move_x_tablet,null,'Tablet reset: follows desktop again');
        await page.click('[data-preview-device="desktop"]');
        // Its name (2026-11-09, user's request): the first field of its settings; given when it is added, shown in the list.
        assert.equal(await page.locator('#wpbn-settings [data-key="name"]').count(),1,'A layer name field');
        // Layer thumbnails are 4:3, as WP Swiper's slides; a title shows its element's icon, dark.
        for (const box of await page.locator('.wpbn-layer-thumb').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.width,r.height];}))) assert.ok(Math.abs(box[0]/box[1]-4/3)<.02,'A 4:3 thumbnail');
        assert.ok((await page.locator('.wpbn-layer-thumb--text .wpbn-thumb-word').first().textContent())==='Title' && (await page.locator('.wpbn-layer-thumb--richtext .wpbn-thumb-word').count()===0 || (await page.locator('.wpbn-layer-thumb--richtext .wpbn-thumb-word').first().textContent())==='Text') && await page.locator('.wpbn-layer-thumb--text img').count()===0 && await page.locator('.wpbn-layer-thumb--text').first().evaluate(el=>getComputedStyle(el).color)==='rgb(80, 87, 94)','A title: the word Title on its thumbnail, dark');
        // Opacity at the end: the layer goes from its Opacity to this one.
        await page.click('.wpbn-layer-row:has(.wpbn-layer-thumb--text) [data-select]');
        // The color field, as WP Swiper's: a swatch that opens Pickr with the palette (named), opacity, Cancel and Default.
        const layerColor=async()=>(await data()).layers.find(l=>l.type==='text').color;
        await page.click('#wpbn-f-color');
        await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'color-picker.png')});
        assert.equal(await page.locator('.wpbn-pcr .pcr-swatches > button').count(),7,'Palette: the theme colors (Woodmart in the test), black, white and greys');
        assert.equal(await page.locator('.wpbn-pcr .pcr-swatches > button').first().getAttribute('title'),'Primary color','Palette colors named on hover');
        assert.equal(await page.locator('.wpbn-pcr .pcr-color-opacity').isVisible(),true,'With opacity');
        assert.ok(await page.evaluate(()=>{const r=document.querySelector('.wpbn-pcr').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;}),'The picker on the screen (above the swatch near the bottom)');
        await page.locator('.wpbn-pcr .pcr-swatches > button').first().click();
        assert.equal(await layerColor(),'#83b735','A palette color chosen');
        await page.fill('.wpbn-pcr .pcr-result','rgba(255, 0, 0, 0.5)');await page.press('.wpbn-pcr .pcr-result','Enter');
        assert.equal(await layerColor(),'rgba(255,0,0,0.5)','A see-through color kept as rgba()');
        assert.match(await page.locator('#wpbn-f-color .wpbn-color__chip').getAttribute('style'),/rgba\(255,\s*0,\s*0,\s*0\.5\)/,'The swatch shows it');
        await page.click('.wpbn-pcr .pcr-cancel');
        assert.equal(await layerColor(),'#ffffff','Cancel: back to the color it had when opened');
        await page.click('#wpbn-f-color');await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.locator('.wpbn-pcr .pcr-swatches > button').first().click();
        await page.click('.wpbn-pcr .wpbn-pcr__default');
        assert.equal(await layerColor(),'#ffffff','Default: the layer\'s default color');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#wpbn-f-color').getAttribute('aria-expanded'),'false','Closed');
        // Accent color, beside Color: the words in <u> (as Woodmart's titles). Empty = the theme's primary color.
        const accent=async()=>(await data()).layers.find(l=>l.type==='text').accent_color;
        const colorsBox=await page.locator('#wpbn-f-color').boundingBox(), accentBox=await page.locator('#wpbn-f-accent_color').boundingBox();
        assert.ok(Math.abs(colorsBox.y-accentBox.y)<2 && accentBox.x>colorsBox.x,'Accent color beside Color');
        const fontBox=await page.locator('#wpbn-f-font_family').boundingBox(), weightBox=await page.locator('#wpbn-f-font_weight').boundingBox();
        assert.ok(Math.abs(fontBox.y-weightBox.y)<2 && weightBox.x>fontBox.x+fontBox.width,'Font and Weight on one row');
        // Title style: Font and Weight, the sample, Font size, then Color and Accent color.
        const ys=await Promise.all(['#wpbn-f-font_family','#wpbn-font-sample','[data-font="desktop"]','#wpbn-f-color'].map(async s=>(await page.locator(s).boundingBox()).y));
        assert.ok(ys[0]<ys[1] && ys[1]<ys[2] && ys[2]<ys[3],'Title style in its order: '+ys.join(', '));
        // As tall as WordPress's selects (wp-admin forms.css, which the test page does not load).
        await page.addStyleTag({content:'select{box-sizing:border-box;padding:0 24px 0 12px;font-size:14px;line-height:2.71428571;min-height:40px;border:1px solid #949494;border-radius:2px}'});
        const fontH=(await page.locator('#wpbn-f-font_family').boundingBox()).height, weightH=(await page.locator('#wpbn-f-font_weight').boundingBox()).height;
        assert.ok(Math.abs(fontH-weightH)<0.5 && Math.abs(fontH-40)<0.5,'Font as tall as Weight: '+fontH+' / '+weightH);
        // Font: Woodmart's fonts in a list with a search box; Weight shows only the weights the font has.
        const weightOptions=async()=>page.locator('#wpbn-f-font_weight option').evaluateAll(os=>os.map(o=>o.value));
        const textLayer=async()=>(await data()).layers.find(l=>l.type==='text');
        assert.equal(await page.locator('#wpbn-f-font_family').textContent(),'Default · Playfair Display','Default: the theme\'s title font');
        assert.deepEqual(await weightOptions(),['400','700','900'],'Weight: the title font\'s weights only');
        assert.equal(Number((await textLayer()).font_weight),900,'A weight the font does not have: the nearest it has');
        await page.click('#wpbn-f-font_family');
        assert.equal(await page.locator('.wpbn-font__search').evaluate(el=>el===document.activeElement),true,'The search box takes the typing');
        await page.screenshot({path:path.join(__dirname,'font-list.png')});
        assert.deepEqual(await page.locator('.wpbn-font__group').allTextContents(),['Theme fonts','Custom fonts','System fonts','Google fonts'],'Groups as Woodmart\'s');
        await page.fill('.wpbn-font__search','EXO');
        assert.deepEqual(await page.locator('.wpbn-font__option').allTextContents(),['Exo 2'],'Search by name, any case');
        await page.fill('.wpbn-font__search','zzz');
        assert.equal(await page.locator('.wpbn-font__empty').count(),1,'Nothing found');
        await page.fill('.wpbn-font__search','o');
        await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
        assert.equal((await textLayer()).font_family,'var(--wd-text-font)','Arrow keys and Enter choose (a theme font as its variable)');
        assert.equal(await page.locator('.wpbn-font__panel').isHidden(),true,'Closed once chosen');
        await page.click('#wpbn-f-font_family');await page.fill('.wpbn-font__search','Exo');
        await page.click('.wpbn-font__option:has-text("Exo 2")');
        assert.equal((await textLayer()).font_family,'Exo 2','A Google font chosen');
        assert.deepEqual(await weightOptions(),['100','300','500'],'Its weights only');
        assert.equal(Number((await textLayer()).font_weight),500,'The weight moved to the nearest it has');
        await page.selectOption('#wpbn-f-font_weight','300');
        // The font sample under them: the title's text in that font and weight, at once.
        const sample=page.locator('#wpbn-font-sample');
        assert.equal(await sample.evaluate(el=>el.style.fontFamily),'"Exo 2"','The sample in the chosen font');
        assert.equal(await sample.evaluate(el=>el.style.fontWeight),'300','In the chosen weight');
        assert.equal(await page.locator('link[data-wpbn-font][href*="family=Exo+2:wght@300"]').count(),1,'The Google font loaded in the editor');
        assert.equal(await sample.textContent(),'SLOVAKIA','The title text');
        await page.fill('[data-key="text"]','Discover <u>Norway</u>');
        assert.equal(await sample.textContent(),'Discover Norway','It follows the text as it is typed, without its tags');
        await page.waitForTimeout(800);await sample.screenshot({path:path.join(__dirname,'font-sample.png')});
        // Fonts looked at in the list show in the sample at once (the nearest weight they have); it stays in view.
        await page.click('#wpbn-f-font_family');
        assert.ok((await page.locator('.wpbn-font__panel').boundingBox()).y>=(await sample.boundingBox()).y+(await sample.boundingBox()).height,'The list opens under the sample');
        await page.fill('.wpbn-font__search','Playfair');
        await page.hover('.wpbn-font__option:has-text("Title font")');
        assert.equal(await sample.evaluate(el=>el.style.fontFamily),'"Playfair Display"','A hovered font shows in the sample');
        await page.waitForTimeout(800);await page.screenshot({path:path.join(__dirname,'font-browse.png'),clip:{x:430,y:0,width:380,height:1000}});
        assert.equal(await sample.evaluate(el=>el.style.fontWeight),'400','At the nearest weight it has');
        await page.fill('.wpbn-font__search','Roboto');await page.keyboard.press('ArrowDown');
        assert.equal(await sample.evaluate(el=>el.style.fontFamily),'Roboto','A font reached with the arrow keys too');
        assert.equal((await textLayer()).font_family,'Exo 2','Only looked at: nothing chosen');
        await page.keyboard.press('Escape');
        assert.equal(await sample.evaluate(el=>el.style.fontFamily),'"Exo 2"','Closed: the title\'s font again');
        assert.equal(await sample.evaluate(el=>el.style.fontWeight),'300','And its weight');
        await page.click('#wpbn-f-font_family');await page.keyboard.press('Escape');
        assert.equal(await page.locator('.wpbn-font__panel').isHidden(),true,'Escape closes the list');
        await update();
        assert.equal(await frame().locator('.wpbn-layer--text h2').evaluate(el=>getComputedStyle(el).fontFamily),'"Exo 2"','The title in its font');
        assert.equal(await frame().locator('link[href*="family=Exo+2:wght@300"]').count(),1,'The Google font loaded at its weight');
        await page.click('#wpbn-f-font_family');await page.click('.wpbn-font__option[data-family=""]');
        await update();
        assert.match(await frame().locator('.wpbn-layer--text h2').evaluate(el=>getComputedStyle(el).fontFamily),/Playfair Display/,'Default: the theme\'s title font in the preview too');
        assert.equal(await accent(),'','Accent: the theme\'s color at first');
        assert.match(await page.locator('#wpbn-f-accent_color .wpbn-color__chip').getAttribute('style'),/(#83b735|rgb\(131,\s*183,\s*53\))/,'Its swatch shows the theme\'s primary color');
        await page.click('#wpbn-f-accent_color');await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.click('.wpbn-pcr .pcr-type[data-type="RGBA"]');
        assert.equal(await accent(),'','A format button chooses nothing');
        await page.fill('.wpbn-pcr .pcr-result','#ff0000');await page.press('.wpbn-pcr .pcr-result','Enter');
        assert.equal(await accent(),'#ff0000','An accent color of its own');
        await page.click('.wpbn-pcr .pcr-cancel');
        assert.equal(await accent(),'','Cancel: the theme\'s color again');
        await page.click('#wpbn-f-accent_color');await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.fill('.wpbn-pcr .pcr-result','#ff0000');await page.press('.wpbn-pcr .pcr-result','Enter');
        await page.click('.wpbn-pcr .wpbn-pcr__default');
        assert.equal(await accent(),'','Default: the theme\'s color');
        await page.fill('.wpbn-pcr .pcr-result','#0000ff');await page.press('.wpbn-pcr .pcr-result','Enter');
        await page.keyboard.press('Escape');
        await page.fill('[data-key="text"]','Discover <u>Norway</u> <b>now</b>');
        await update();
        const word=frame().locator('.wpbn-layer--text u');
        assert.equal(await word.textContent(),'Norway','Words in <u> become the accent');
        assert.equal(await word.evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 255)','In the accent color');
        assert.equal(await word.evaluate(el=>getComputedStyle(el).textDecorationLine),'none','Not underlined');
        assert.equal(await frame().locator('.wpbn-layer--text b').count(),0,'Other tags are not kept');
        await page.click('#wpbn-f-accent_color');await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.click('.wpbn-pcr .wpbn-pcr__default');await page.keyboard.press('Escape');
        await update();
        assert.equal(await frame().locator('.wpbn-layer--text u').evaluate(el=>getComputedStyle(el).color),'rgb(131, 183, 53)','No accent of its own: the theme\'s primary color');
        // Container, each layer's (Size): its Position X and Width are shares of it, centred in the scene.
        const titleIndex=(await data()).layers.findIndex(l=>l.type==='text');
        const titleRow='[data-select="'+titleIndex+'"]';
        await page.click('#wpbn-scene-settings');
        assert.equal(await page.locator('#wpbn-f-container').count(),0,'Not a scene setting');
        await page.click(titleRow);
        assert.equal(await page.locator('#wpbn-f-container').inputValue(),'theme','A new title: Theme container');
        assert.equal(await page.locator('#wpbn-f-container option[value="theme"]').textContent(),'Theme container','Just its name (which and how wide: in the i)');
        assert.equal(await page.locator('#wpbn-f-container_width').count(),0,'No width field: the theme gives it');
        await page.locator('#wpbn-settings').screenshot({path:path.join(__dirname,'layer-container.png')});
        const imageLayer=(await data()).layers.find(l=>l.type==='image');
        assert.ok(!imageLayer || imageLayer.container==='full','A new image: Full width (it fills the scene)');
        await page.selectOption('#wpbn-f-container','custom');
        assert.equal(await page.locator('#wpbn-f-container_width').isVisible(),true,'Custom: a width field of its own');
        await page.fill('#wpbn-f-container_width','900');
        assert.ok((await textLayer()).container==='custom' && (await textLayer()).container_width===900,'Container kept on the layer');
        // A title as wide as its text: a short one narrower than its container; a long one wraps at its container's width.
        await page.fill('[data-key="text"]','Hi');
        await update();
        const shortTitle=await frame().locator('.wpbn-layer--text').evaluate(el=>el.getBoundingClientRect().width);
        assert.ok(shortTitle<800,'A short title: as wide as its text ('+shortTitle+')');
        await page.fill('[data-key="text"]','Discover the mountains of Norway in every season of the year');
        await update();
        const titleWidth=async()=>frame().locator('.wpbn-layer--text').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect(),scale=Number(getComputedStyle(el).getPropertyValue('--wpbn-s'))||1;return {scene:s.width,width:r.width/scale,centre:r.left+r.width/2-s.left};});
        let measured=await titleWidth();
        assert.ok(Math.abs(measured.width-Math.min(measured.scene-30,900))<1,'A long title wraps at the 900px container ('+JSON.stringify(measured)+')');
        await page.selectOption('#wpbn-f-container','full');
        assert.equal(await page.locator('#wpbn-f-container_width').count(),0,'Full width: no width field');
        await update();
        measured=await titleWidth();
        assert.ok(measured.width>measured.scene-60 && measured.width<=measured.scene+0.5,'Full width: at most the whole scene');
        await page.selectOption('#wpbn-f-container','theme');await update();
        measured=await titleWidth();
        assert.ok(Math.abs(measured.width-(Math.min(measured.scene,1222)-30))<1,'Theme container: Woodmart, less its padding');
        // On the site as in the window: X 0% puts the title at the container's left edge, 100% at its right.
        await page.fill('[data-key="text"]','Hi');
        for (const [key,edge] of [['Shift+ArrowLeft','left'],['Shift+ArrowRight','right']]) {
            await page.click(POS);for(let i=0;i<11;i++)await positionStage.press(key);await page.click('.wpbn-modal__apply');await update();
            const at=await frame().locator('.wpbn-layer--text').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect();return {left:r.left-s.left,right:s.right-r.right,cw:Math.min(s.width,1222)-30,w:s.width};});
            assert.ok(Math.abs((edge==='left'?at.left:at.right)-(at.w-at.cw)/2)<1,'X '+(edge==='left'?'0%':'100%')+' on the site: the title at the container '+edge+' edge ('+JSON.stringify(at)+')');
        }
        await page.fill('[data-key="text"]','Discover <u>Norway</u> <b>now</b>');
        // Gradient: only overlays have one (2026-11-08): no switch for a title or an image.
        assert.equal(await page.locator('[data-fill], .wpbn-gradient').count(),0,'No Gradient for a title');
        const imageIndex=(await data()).layers.findIndex(l=>l.type==='image');
        if (imageIndex>=0) { await page.click('[data-select="'+imageIndex+'"]');assert.equal(await page.locator('[data-fill], .wpbn-gradient').count(),0,'No Gradient for an image');await page.click(titleRow); }
        // Letter spacing (per device, beside Font size), Case, Style and Shadow (behind its switch).
        assert.ok(await page.evaluate(()=>{const a=document.querySelector('#wpbn-f-font_size').getBoundingClientRect(),b=document.querySelector('#wpbn-f-letter_spacing').getBoundingClientRect();return b.top>a.bottom && Math.abs(a.left-b.left)<1;}),'Letter spacing under Font size');
        await page.fill('#wpbn-f-letter_spacing','4');
        await page.selectOption('#wpbn-f-text_transform','uppercase');await page.selectOption('#wpbn-f-font_style','italic');
        assert.ok((await textLayer()).letter_spacing===4 && (await textLayer()).text_transform==='uppercase' && (await textLayer()).font_style==='italic','Kept in the layer');
        assert.deepEqual(await page.locator('#wpbn-font-sample').evaluate(el=>[el.style.textTransform,el.style.fontStyle,!!el.style.letterSpacing]),['uppercase','italic',true],'The font sample follows');
        assert.equal(await page.locator('#wpbn-f-shadow_x').count(),0,'Shadow: its values hidden while it is off');
        await toggle('use_shadow');
        assert.equal(await page.locator('.wpbn-shadow .wpbn-field').count(),4,'On: its color, X, Y and Blur in a row');
        await page.fill('#wpbn-f-shadow_x','3');await page.fill('#wpbn-f-shadow_y','5');await page.fill('#wpbn-f-shadow_blur','12');
        await page.locator('#wpbn-block-style .wpbn-card').screenshot({path:path.join(__dirname,'title-style.png')});
        await update();
        const styled=await frame().locator('.wpbn-layer--text h2').evaluate(el=>{const c=getComputedStyle(el);return [c.letterSpacing,c.textTransform,c.fontStyle,c.textShadow];});
        assert.ok(styled[0]==='4px' && styled[1]==='uppercase' && styled[2]==='italic' && /3px 5px 12px/.test(styled[3]),'On the site: spacing, case, style and shadow ('+styled.join(' | ')+')');
        await page.click('[data-field-device="mobile"]');await page.fill('#wpbn-f-mobile_letter_spacing','1');
        assert.ok((await textLayer()).mobile_letter_spacing===1 && (await textLayer()).tablet_letter_spacing==null,'Its own on mobile');
        await page.click('[data-field-device="desktop"]');
        await toggle('use_shadow');await page.selectOption('#wpbn-f-text_transform','none');await page.selectOption('#wpbn-f-font_style','normal');await page.fill('#wpbn-f-letter_spacing','0');
        await page.click('[data-field-device="mobile"]');await page.fill('#wpbn-f-mobile_letter_spacing','');await page.click('[data-field-device="desktop"]');
        // The title moves as the page scrolls already (its Scroll animation on, above): its Opacity at the end in the same card.
        assert.equal(await page.locator('[data-key="end_opacity"]').count(),1,'Opacity at the end, in the same block');
        await page.fill('[data-key="end_opacity"]','0');
        await update();
        await frame().waitForFunction(()=>typeof window.wpbnPreviewProgress==='function');
        await frame().evaluate(()=>window.wpbnPreviewProgress(1));
        assert.equal(await frame().locator('.wpbn-layer--text').evaluate(el=>getComputedStyle(el).opacity),'0','Faded out by the end');
        await frame().evaluate(()=>window.wpbnPreviewProgress(0));
        assert.equal(await frame().locator('.wpbn-layer--text').evaluate(el=>getComputedStyle(el).opacity),'1','Its own opacity at the start');
        // Overlay: a colour, or its Gradient instead, over the whole scene; it does not move, only its Opacity at the end.
        await addElement('overlay');
        const overlayIndex=(await data()).layers.length-1, overlay=async()=>(await data()).layers[overlayIndex];
        assert.ok((await overlay()).type==='overlay' && (await overlay()).color==='rgba(0,0,0,0.4)' && /^Overlay \d+$/.test((await overlay()).name),'A new overlay: a see-through black');
        assert.match(await page.locator('[data-select="'+overlayIndex+'"] small').textContent(),/^Overlay/,'Named in the layer list');
        assert.equal(await page.locator('[data-select="'+overlayIndex+'"] .wpbn-layer-thumb--overlay .wpbn-overlay-thumb').evaluate(el=>el.style.background),'rgba(0, 0, 0, 0.4)','Its thumbnail: its fill');
        // Since 2026-11-10: Filters (its Blur and tones), a Loop animation and travel and zoom with the scroll.
        assert.deepEqual(await page.locator('#wpbn-menu .wpbn-menu-item__title').allTextContents(),['Content','Fill','Size','Effect','Filters','Entrance animation','Loop animation','Scroll animation'],'Content (its name), Fill, Size, Effect, Filters, Entrance, Loop and Scroll animation');
        assert.ok(await page.locator('#wpbn-f-move_y, #wpbn-f-zoom, #wpbn-f-end_opacity').count()===3 && await page.locator('#wpbn-f-use_scroll').count()===0 && await page.locator(POS).count()===1,'Travel, zoom and Opacity at the end; Position');
        assert.ok(await page.locator('#wpbn-f-backdrop_blur, #wpbn-f-f_grayscale').count()===2 && await page.locator('#wpbn-f-anim_type option').allTextContents().then(t=>t.join()==='None,Zoom,Slide sideways,Slide up or down'),'Its Filters; its Loop animation without Fade');
        await update();
        const covers=async()=>frame().locator('.wpbn-layer--overlay').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect();return {same:Math.abs(r.left-s.left)<1&&Math.abs(r.top-s.top)<1&&Math.abs(r.width-s.width)<1&&Math.abs(r.height-s.height)<1,bg:getComputedStyle(el.querySelector(".wpbn-overlay")).backgroundColor,image:getComputedStyle(el.querySelector(".wpbn-overlay")).backgroundImage,z:Number(getComputedStyle(el).zIndex)};});
        let shade=await covers();
        assert.ok(shade.same && shade.bg==='rgba(0, 0, 0, 0.4)' && shade.z===overlayIndex+1,'On the site: the whole scene in its colour, in front of the layers under it ('+JSON.stringify(shade)+')');
        // Gradient (as WP Swiper's), in Fill, behind its switch: the bar adds a colour, a point is moved or deleted, its colour picked.
        const gradientOf=async()=>(await overlay()).gradient;
        assert.equal(await page.locator('.wpbn-gradient').count(),0,'Gradient: its colours hidden while it is off');
        // Fill: Color or Gradient, two buttons across the card, at its top; only the chosen one's settings under them.
        assert.deepEqual(await page.locator('#wpbn-block-fill .wpbn-fill-choice button').allTextContents(),['Color','Gradient'],'Color and Gradient buttons in Fill');
        assert.ok(await page.evaluate(()=>{const c=document.querySelector('.wpbn-fill-choice'),card=c.closest('.wpbn-card'),b=[...c.querySelectorAll('button')].map(x=>x.getBoundingClientRect()),r=c.getBoundingClientRect(),first=card.firstElementChild;return first===c && Math.abs(b[0].width-b[1].width)<1 && r.width>card.getBoundingClientRect().width-40;}),'At the top, across the card, the two alike');
        assert.equal(await page.locator('[data-fill="color"]').getAttribute('aria-pressed'),'true','Color chosen to start with');
        assert.equal(await page.locator('#wpbn-f-color').count(),1,'Color: its colour field');
        await page.click('[data-fill="gradient"]');
        assert.ok(await page.locator('[data-fill="gradient"]').getAttribute('aria-pressed')==='true' && await page.locator('#wpbn-f-color').count()===0 && (await overlay()).use_gradient===true,'Gradient: its editor instead of the colour');
        assert.equal(await page.locator('.wpbn-gradient__handle').count(),2,'Two colours to start with');
        const bar=await page.locator('.wpbn-gradient__bar').boundingBox();
        await page.mouse.click(bar.x+bar.width*.5,bar.y+bar.height/2);
        assert.equal((await gradientOf()).split(';').length,5,'A click on the bar adds a colour');
        assert.match(await gradientOf(),/;rgba\(0,0,0,0\.3\)@50;/,'The colour the gradient has there');
        assert.equal(await page.locator('.wpbn-gradient__handle.is-chosen').getAttribute('data-stop'),'1','The new colour chosen (in order)');
        await page.locator('.wpbn-gradient__handle.is-chosen').press('Shift+ArrowRight');
        assert.match(await gradientOf(),/@60;/,'Moved with the arrow keys');
        await page.click('.wpbn-gradient .wpbn-color__swatch');await page.waitForSelector('.pcr-app.wpbn-pcr.visible');
        await page.fill('.wpbn-pcr .pcr-result','#00ff00');await page.press('.wpbn-pcr .pcr-result','Enter');
        assert.match(await gradientOf(),/;#00ff00@60;/,'Its colour picked with the colour block');
        await page.keyboard.press('Escape');
        await page.selectOption('.wpbn-gradient__type','circle');
        assert.ok(/^circle;center center;/.test(await gradientOf()) && await page.locator('.wpbn-gradient__x').isVisible() && await page.locator('.wpbn-gradient__direction').isHidden(),'Radial: where its middle is');
        await page.click('.wpbn-gradient__handle[data-stop="1"]');await page.click('.wpbn-gradient__delete');
        assert.equal((await gradientOf()).split(';').length,4,'Delete removes the chosen colour');
        assert.equal(await page.locator('.wpbn-gradient__delete').isDisabled(),true,'Two colours at least');
        await update();
        shade=await covers();
        assert.ok(/radial-gradient/.test(shade.image),'Its gradient instead of the colour');
        await page.screenshot({path:path.join(__dirname,'overlay.png'),fullPage:true});
        assert.match(await page.locator('[data-select="'+overlayIndex+'"] .wpbn-layer-thumb--overlay .wpbn-overlay-thumb').evaluate(el=>el.style.background),/radial-gradient/,'The thumbnail follows');
        // In the Position window of another layer: drawn over the whole scene.
        await page.click(titleRow);await page.click(POS);
        assert.ok(await page.locator('.wpbn-focus__stage .wpbn-position-item.is-other').evaluateAll(items=>items.some(el=>/radial-gradient/.test(el.style.background) && el.style.width==='100%' && el.style.height==='100%')),'In the Position window: over the whole scene');
        await page.click('.wpbn-modal__cancel');
        await page.click('[data-select="'+overlayIndex+'"]');await page.click('[data-fill="color"]');
        assert.ok(await page.locator('.wpbn-gradient').count()===0 && /^circle;/.test(await gradientOf()) && await page.locator('#wpbn-f-color').count()===1 && (await overlay()).use_gradient===false,'Color again: its colours kept, the colour field back');
        // Its size: Container (as a title's, Position beside it) and Height per device (as the scene's: %, px, vh; Inherit).
        assert.equal(await page.locator('#wpbn-f-container').inputValue(),'full','A new overlay: Full width');
        assert.deepEqual(await page.locator('[data-key="height_unit"] option').allTextContents(),['%','px','vh'],'Height: %, px or vh (no Auto)');
        assert.equal(await page.locator('#wpbn-f-height').inputValue(),'100','100% of the scene to start with');
        await page.fill('#wpbn-f-height','40');await page.selectOption('#wpbn-f-container','theme');
        await page.click(POS);
        assert.ok(await page.locator('.wpbn-focus__stage .wpbn-position-target').evaluate(el=>el.style.height==='40%' && parseFloat(el.style.width)<100),'In the Position window: its height and container');
        for(let i=0;i<6;i++)await positionStage.press('Shift+ArrowDown');await page.click('.wpbn-modal__apply');
        assert.ok((await overlay()).height===40 && (await overlay()).y===100 && (await overlay()).container==='theme','Kept: 40%, at the bottom, in the theme container');
        await update();
        const band=await frame().locator('.wpbn-layer--overlay').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect();return {h:r.height/s.height,bottom:s.bottom-r.bottom,width:r.width,cw:Math.min(s.width,1222)-30,centre:(r.left+r.right)/2-(s.left+s.right)/2};});
        assert.ok(Math.abs(band.h-0.4)<0.01 && Math.abs(band.bottom)<1 && Math.abs(band.width-band.cw)<1 && Math.abs(band.centre)<1,'On the site: 40% high, at the bottom, as wide as the container ('+JSON.stringify(band)+')');
        await page.click('.wpbn-field--height [data-field-device="mobile"]');
        await page.selectOption('[data-key="mobile_height_unit"]','px');await page.fill('#wpbn-f-mobile_height','120');
        assert.ok((await overlay()).mobile_height===120 && (await overlay()).mobile_height_unit==='px' && (await overlay()).tablet_height_unit==null,'Its own on mobile, tablet following desktop');
        // Width per device, as its Height (% of its container, px, vw); Container width per device (Custom).
        await page.click('.wpbn-field--height [data-field-device="desktop"]');
        assert.equal(await page.locator('#wpbn-f-width').count(),0,'No Width (%) slider');
        assert.deepEqual(await page.locator('[data-key="overlay_width_unit"] option').allTextContents(),['%','px','vw'],'Width: %, px or vw');
        assert.equal(await page.locator('#wpbn-f-overlay_width').inputValue(),'100','All of its container to start with');
        await page.fill('#wpbn-f-overlay_width','50');await page.selectOption('#wpbn-f-container','custom');
        assert.ok(await page.locator('.wpbn-field--device-number #wpbn-f-container_width').count()===1,'Container width: per device, as Font size');
        await page.fill('#wpbn-f-container_width','800');
        await page.click(POS);for(let i=0;i<6;i++)await positionStage.press('Shift+ArrowLeft');await page.click('.wpbn-modal__apply');
        await update();
        const half=await frame().locator('.wpbn-layer--overlay').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect(),cw=Math.min(s.width-30,800);return {width:r.width,cw,left:r.left-s.left,edge:(s.width-cw)/2};});
        assert.ok(Math.abs(half.width-half.cw/2)<1 && Math.abs(half.left-half.edge)<1,'Half its 800px container wide, at its left edge (X 0%) ('+JSON.stringify(half)+')');
        await page.click('.wpbn-field--device-number [data-field-device="tablet"]');await page.fill('#wpbn-f-container_width_tablet','600');
        await page.selectOption('[data-key="tablet_overlay_width_unit"]','px');await page.fill('#wpbn-f-tablet_overlay_width','300');
        assert.ok((await overlay()).container_width_tablet===600 && (await overlay()).container_width_mobile==null && (await overlay()).tablet_overlay_width===300 && (await overlay()).tablet_overlay_width_unit==='px' && (await overlay()).mobile_overlay_width_unit==null,'Their own on tablet');
        await page.click('.wpbn-field--device-number [data-field-device="desktop"]');
        await page.locator('#wpbn-block-position .wpbn-card').screenshot({path:path.join(__dirname,'overlay-size.png')});
        // Blur (per device, in Filters since 2026-11-10, as the other filters' fields): the layers under it blurred.
        assert.ok(await page.locator('#wpbn-block-filters #wpbn-f-backdrop_blur').count()===1 && await page.locator('#wpbn-f-backdrop_blur').inputValue()==='0' && await page.locator('#wpbn-block-fill #wpbn-f-backdrop_blur').count()===0,'Blur in Filters, 0 to start with');
        await update();
        assert.equal(await frame().locator('.wpbn-layer--overlay .wpbn-overlay').evaluate(el=>getComputedStyle(el).backdropFilter),'none','0: no blur');
        await page.fill('#wpbn-f-backdrop_blur','12');
        await page.click('[data-fill="gradient"]');
        assert.equal(await page.locator('#wpbn-f-backdrop_blur').inputValue(),'12','With Gradient too');
        await page.click('[data-fill="color"]');
        await update();
        assert.equal(await frame().locator('.wpbn-layer--overlay .wpbn-overlay').evaluate(el=>getComputedStyle(el).backdropFilter),'blur(12px)','On the site: the layers under it blurred');
        await page.locator('#wpbn-block-fill .wpbn-card').screenshot({path:path.join(__dirname,'overlay-fill.png')});
        await page.click('.wpbn-field:has(#wpbn-f-backdrop_blur) [data-field-device="mobile"]');await page.fill('#wpbn-f-backdrop_blur_mobile','4');
        assert.ok((await overlay()).backdrop_blur_mobile===4 && (await overlay()).backdrop_blur_tablet==null,'Its own on mobile');
        // Its Shadow, in Fill: Inside only once on; Inside, a vignette in the preview.
        assert.equal(await page.locator('#wpbn-f-shadow_inset').count(),0,'Overlay Shadow off: no Inside');
        await page.click('label[for="wpbn-f-use_shadow"]');
        await page.click('label[for="wpbn-f-shadow_inset"]');
        assert.ok((await overlay()).use_shadow===true && (await overlay()).shadow_inset===true,'Overlay Shadow on, Inside');
        await update();
        assert.match(await frame().locator('.wpbn-layer--overlay .wpbn-overlay').evaluate(el=>getComputedStyle(el).boxShadow),/inset/,'In the preview: a shadow inside its edges');
        await page.click('.wpbn-field--height [data-field-device="desktop"]');
        await page.click('[data-row-action="delete"][data-index="'+overlayIndex+'"]');
        assert.equal((await data()).layers.some(l=>l.type==='overlay'),false,'Deleted');
        await page.click(titleRow);
        // Text: paragraphs and lists in WordPress's editor (here, without WordPress, its plain box), its style, placed as a title is.
        await addElement('richtext');
        const textIndex=(await data()).layers.length-1, textOf=async()=>(await data()).layers[textIndex];
        assert.ok((await textOf()).type==='richtext' && (await textOf()).content==='<p>Your text here.</p>' && (await textOf()).font_size===18 && (await textOf()).container==='theme' && /^Text \d+$/.test((await textOf()).name),'A new text: a paragraph, 18px, in the theme container');
        assert.ok(await page.locator('[data-select="'+textIndex+'"] .wpbn-layer-thumb--richtext').count()===1 && /^Text/.test(await page.locator('[data-select="'+textIndex+'"] small').textContent()),'In the layer list: Text');
        assert.deepEqual(await page.locator('#wpbn-menu .wpbn-menu-item__title').allTextContents(),['Content','Text style','Size','Effect','Entrance animation','Loop animation','Scroll animation','Follow the mouse'],'Its cards');
        assert.ok(await page.locator('#wpbn-f-content').count()===1 && await page.locator('#wpbn-f-font_size').inputValue()==='18' && await page.locator(POS).count()===1 && await page.locator('#wpbn-f-use_shadow').count()===1 && await page.locator('#wpbn-f-text_transform, #wpbn-f-accent_color, #wpbn-f-use_scale').count()===0,'Its text box, Font size, Shadow and Position; no Case, Accent color or Scale');
        assert.match(await page.locator('.wpbn-font__name').textContent(),/^Default/,'Default font: the theme\'s text font');
        await page.fill('#wpbn-f-content','<p style="text-align: center">Hello <strong>world</strong> <a href="#x">link</a></p><ul><li>One</li></ul><script>alert(1)</script>');
        assert.match((await textOf()).content,/<strong>world<\/strong>/,'Kept in the layer as typed');
        assert.match(await page.locator('#wpbn-font-sample').textContent(),/^Hello world link One/,'The font sample: its words');
        await update();
        const shown=await frame().locator('.wpbn-layer--richtext').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect(),c=getComputedStyle(el);return {html:el.innerHTML,size:c.fontSize,left:r.left-s.left,cw:Math.min(s.width,1222)-30,w:s.width,align:getComputedStyle(el.querySelector('p')).textAlign,list:getComputedStyle(el.querySelector('ul')).listStyleType};});
        assert.ok(/<strong>world<\/strong>/.test(shown.html) && /<a href="#x">link<\/a>/.test(shown.html) && !/script|alert/.test(shown.html) && /<li>One<\/li>/.test(shown.html),'On the site: bold, the link and the list kept; no script ('+shown.html+')');
        assert.ok(shown.size==='18px' && shown.align==='center' && shown.list==='disc','Its size, the paragraph centred, a bulleted list');
        await page.click('[data-row-action="delete"][data-index="'+textIndex+'"]');
        assert.equal((await data()).layers.some(l=>l.type==='richtext'),false,'Text deleted');
        await page.click(titleRow);
        // Shortcode: another plugin's element in its place among the layers, its Width per device.
        await addElement('shortcode');
        const scIndex=(await data()).layers.length-1, scOf=async()=>(await data()).layers[scIndex];
        assert.ok((await scOf()).type==='shortcode' && (await scOf()).container==='theme' && /^Shortcode \d+$/.test((await scOf()).name) && await page.locator('[data-select="'+scIndex+'"] .wpbn-layer-thumb--shortcode').count()===1,'A new shortcode layer, in the theme container, its icon in the list');
        assert.deepEqual(await page.locator('#wpbn-menu .wpbn-menu-item__title').allTextContents(),['Content','Size','Effect','Filters','Entrance animation','Loop animation','Scroll animation','Follow the mouse'],'Its cards (Filters: 2026-11-10)');
        assert.ok(await page.locator('#wpbn-block-effect #wpbn-f-use_shadow').count()===1 && await page.locator('#wpbn-block-filters #wpbn-f-f_grayscale').count()===1,'A shortcode: Shadow in Effect, the Filters');
        assert.ok(await page.locator('#wpbn-f-overlay_width').count()===1 && await page.locator('#wpbn-f-use_scale, #wpbn-f-height').count()===0,'Its Width; no Scale, no Height');
        await page.fill('#wpbn-f-shortcode','[wp_swiper id="12"]');
        await page.fill('#wpbn-f-overlay_width','60');
        assert.ok((await scOf()).shortcode==='[wp_swiper id="12"]' && (await scOf()).overlay_width===60,'Kept in the layer');
        await update();
        const sc=await frame().locator('.wpbn-layer--shortcode').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect();return {html:el.innerHTML,w:r.width,cw:Math.min(s.width,1222)-30,events:getComputedStyle(el).pointerEvents};});
        assert.ok(/class="demo-slider" data-shortcode="wp_swiper"/.test(sc.html) && Math.abs(sc.w-sc.cw*0.6)<2 && sc.events==='auto','On the site: the shortcode\'s element, 60% of the container, clickable ('+JSON.stringify(sc)+')');
        await page.click(POS);
        assert.equal(await page.locator('.wpbn-position-target').first().textContent(),'[wp_swiper id="12"]','The Position window: a box with its shortcode');
        assert.ok(await page.locator('.wpbn-position-warning').isHidden(),'Not taller than the scene: no warning');
        // Its height as the preview drew it (120px of the scene's), not a guess, on the device shown.
        const real=await frame().locator('.wpbn-layer--shortcode').evaluate(el=>el.offsetHeight/el.closest('.wpbn-scene').offsetHeight);
        const scBox=await page.locator('.wpbn-focus__stage .wpbn-position-target').evaluate(el=>({share:el.offsetHeight/el.parentElement.offsetHeight,guess:el.classList.contains('is-guess')}));
        assert.ok(Math.abs(scBox.share-real)<0.02 && !scBox.guess,'The box: the real height ('+JSON.stringify(scBox)+' vs '+real+')');
        assert.ok(await page.locator('.wpbn-focus__device[data-device="mobile"] .wpbn-position-target.is-guess').count()===1,'Another device: the height from the preview, marked as a guess');
        await page.keyboard.press('Escape');
        // An element taller than the scene (a portrait slider): the box as tall, cut by the scene, its label in sight, a warning.
        await page.fill('#wpbn-f-shortcode','[tall_slider]');
        await update();
        await frame().evaluate(()=>{const el=document.querySelector('.wpbn-layer--shortcode .demo-slider');el.style.height=(el.closest('.wpbn-scene').offsetHeight*2.5)+'px';});
        await page.click(POS);
        const tall=await page.locator('.wpbn-focus__stage .wpbn-position-target').evaluate(el=>{const c=el.parentElement.getBoundingClientRect(),l=el.querySelector('.wpbn-position-item__label').getBoundingClientRect();return {share:el.offsetHeight/el.parentElement.offsetHeight,labelIn:l.top>=c.top&&l.bottom<=c.bottom};});
        assert.ok(tall.share>2.4 && tall.labelIn,'Taller than the scene: as tall, its label inside the scene ('+JSON.stringify(tall)+')');
        assert.match(await page.locator('.wpbn-position-warning__text').textContent(),/taller than the scene on Desktop/,'A warning');
        await page.locator('.wpbn-modal--position .wpbn-modal__box').screenshot({path:path.join(__dirname,'shortcode-position.png')});
        await page.keyboard.press('ArrowUp');
        assert.ok(await page.locator('.wpbn-focus__stage .wpbn-position-target').evaluate(el=>{const c=el.parentElement.getBoundingClientRect(),l=el.querySelector('.wpbn-position-item__label').getBoundingClientRect();return l.top>=c.top&&l.bottom<=c.bottom;}),'Moved: its label stays in sight');
        // Dragged: it follows the pointer (taller than the scene: smoothly, not to an edge).
        const dragBy=async (dx,dy)=>{const t=await page.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox(),st=await page.locator('.wpbn-focus__stage').boundingBox();const x=st.x+st.width/2,y=st.y+st.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx/2,y+dy/2);await page.mouse.move(x+dx,y+dy);await page.mouse.up();return t;};
        const valueNow=async()=>(await focusValue(page)).split(' ').map(parseFloat);
        const [x0,y0]=await valueNow(), before=await dragBy(20,30), after=await page.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox(), [x1,y1]=await valueNow();
        assert.ok(y1>0 && y1<100 && Math.abs(y1-y0)>0.5 && Math.abs(y1-y0)<15 && Math.abs(after.y-before.y-30)<3,'Taller than the scene: dragged down, it moves down with the pointer, its Y not at an edge ('+[y0,y1,after.y-before.y]+')');
        assert.ok(x1>0 && x1<100 && Math.abs(after.x-before.x-20)<3,'Across: it follows the pointer ('+[x0,x1,after.x-before.x]+')');
        await page.keyboard.press('Escape');
        // As wide as its container (Width 100%): no room across: dragging leaves its X as it is.
        await page.fill('#wpbn-f-overlay_width','100');
        await page.click(POS);
        const [wx0]=await valueNow(); await dragBy(40,0); const [wx1]=await valueNow();
        assert.equal(wx1,wx0,'As wide as its container: X stays');
        await page.keyboard.press('Escape');
        await page.click('[data-row-action="delete"][data-index="'+scIndex+'"]');
        assert.equal((await data()).layers.some(l=>l.type==='shortcode'),false,'Shortcode deleted');
        await page.click(titleRow);
        // Button: as WP Top Info Bar's: text, link, a new window, Background and Corners samples, Size per device, colours.
        await addElement('button');
        const buttonIndex=(await data()).layers.length-1, buttonOf=async()=>(await data()).layers[buttonIndex];
        assert.ok((await buttonOf()).type==='button' && (await buttonOf()).button_text==='Learn more' && (await buttonOf()).container==='theme' && /^Button \d+$/.test((await buttonOf()).name),'A new button: Learn more, in the theme container');
        assert.ok(await page.locator('[data-select="'+buttonIndex+'"] .wpbn-layer-thumb--button').count()===1,'In the layer list: its icon');
        assert.deepEqual(await page.locator('#wpbn-menu .wpbn-menu-item__title').allTextContents(),['Content','Button style','Icon','Size','Effect','Filters','Entrance animation','Loop animation','Scroll animation','Follow the mouse'],'Its cards (Icon and Filters: 2026-11-10)');
        assert.ok(await page.locator('#wpbn-f-button_new_tab').isDisabled() && await page.locator('#wpbn-f-use_scale, #wpbn-f-font_size').count()===0,'Open in a new window greyed without a link; no Scale, no Font size');
        await page.fill('#wpbn-f-button_url','https://example.com/book');
        assert.ok(!(await page.locator('#wpbn-f-button_new_tab').isDisabled()),'With a link: Open in a new window');
        await toggle('button_new_tab');
        await page.fill('#wpbn-f-button_text','Book now');
        assert.deepEqual(await page.locator('[data-choice="button_style"]').allTextContents(),['Filled','Border','Underline'],'Background: three samples');
        await page.click('[data-choice="button_shape"][data-value="round"]');
        assert.equal(await page.locator('[data-choice="button_shape"][data-value="round"]').getAttribute('aria-pressed'),'true','Corners: Round chosen');
        await page.click('[data-choice="button_style"][data-value="underline"]');
        assert.ok(await page.locator('[data-choice="button_shape"]').first().isDisabled(),'Underline: Corners greyed');
        await page.click('[data-choice="button_style"][data-value="bordered"]');
        await page.selectOption('#wpbn-f-button_size','large');
        await page.click('[data-field-device="mobile"]');
        await page.selectOption('#wpbn-f-button_size_mobile','small');
        assert.ok((await buttonOf()).button_style==='bordered' && (await buttonOf()).button_shape==='round' && (await buttonOf()).button_size==='large' && (await buttonOf()).button_size_mobile==='small' && (await buttonOf()).button_size_tablet==null && (await buttonOf()).button_new_tab===true,'Kept in the layer');
        await page.click('[data-field-device="desktop"]');
        // Its Icon (2026-11-10): Font Awesome's, chosen in the picker (searched), in the text colour, right of the text.
        await page.click('[data-block="icon"]');
        await page.click('[data-choice="button_icon_type"][data-value="icon"]');
        await page.click('[data-action="icon-pick"]');
        await page.waitForSelector('#wpbn-icon-picker .wpbn-icon-picker__icon');
        await page.fill('.wpbn-icon-picker__search','arrow right');
        await page.click('#wpbn-icon-picker [data-icon][title^="Arrow Right ("]');
        const chosenIcon=await buttonOf();
        assert.ok(chosenIcon.button_icon==='solid/arrow-right' && /^\d+ \d+\|M/.test(chosenIcon.button_icon_svg) && !(await page.locator('#wpbn-icon-picker').evaluate(d=>d.open)),'An icon chosen; the picker closed ('+chosenIcon.button_icon+')');
        assert.ok(await page.locator('#wpbn-block-icon .wpbn-icon-thumb svg').count()===1 && await page.locator('#wpbn-f-button_icon_size, #wpbn-f-button_icon_gap, [data-choice="button_icon_position"]').count()===4,'Shown, its Position, Size and Gap');
        await update();
        assert.ok(await frame().locator('.wpbn-layer--button .wpbn-button > .wpbn-button__icon:last-child svg').count()===1,'On the site: the icon after the text');
        await page.click('[data-choice="button_icon_type"][data-value="none"]');
        await update();
        const btn=await frame().locator('.wpbn-layer--button a.wpbn-button').evaluate(el=>{const c=getComputedStyle(el);return {text:el.textContent,href:el.getAttribute('href'),target:el.target,rel:el.rel,radius:c.borderTopLeftRadius,bg:c.backgroundColor,border:c.borderTopWidth,h:el.getBoundingClientRect().height,font:c.fontSize,family:c.fontFamily,events:c.pointerEvents};});
        assert.equal(btn.family,'-apple-system, sans-serif','The button in the page\'s font: the theme\'s text font, as on the site');
        assert.ok(btn.text==='Book now' && btn.href==='https://example.com/book' && btn.target==='_blank' && /noopener/.test(btn.rel),'On the site: a link in a new window ('+JSON.stringify(btn)+')');
        await page.locator('#wpbn-settings').screenshot({path:path.join(__dirname,'button.png')});await page.locator('#wpbn-frame').screenshot({path:path.join(__dirname,'button-preview.png')});
        assert.ok(btn.radius==='35px' && btn.bg==='rgba(0, 0, 0, 0)' && btn.border==='2px' && btn.h>=48 && btn.font==='14px' && btn.events==='auto','Round, a border, Large, clickable ('+JSON.stringify(btn)+')');
        // On every device the button's layer is as wide as the button (the devices' .wpbn-layer width does not stretch it),
        // so its Position (X 50%) centres it, not flush left in its container.
        for (const device of ['tablet','mobile','desktop']) {
            await page.click('[data-preview-device="'+device+'"]');
            await frame().waitForFunction(d=>d==='mobile'?innerWidth<=767:d==='tablet'?innerWidth>767&&innerWidth<=1024:innerWidth>1024,device);
            const b=await frame().locator('.wpbn-layer--button').evaluate(el=>{const r=el.getBoundingClientRect(),a=el.querySelector('.wpbn-button').getBoundingClientRect(),s=el.closest('.wpbn-scene').getBoundingClientRect();return {layer:r.width,button:a.width,centre:a.left+a.width/2,scene:s.left+s.width/2};});
            assert.ok(Math.abs(b.layer-b.button)<1 && Math.abs(b.centre-b.scene)<2,device+': the button as wide as its text, centred at X 50% ('+JSON.stringify(b)+')');
        }
        await page.click(POS);
        assert.equal(await page.locator('.wpbn-position-target').first().textContent(),'Book now','The Position window draws the button');
        // Its backdrop (2026-11-10): the scene as the preview renders it, still, without the button (drawn over it to be
        // dragged), as wide as the stage; the drawing of the other layers hidden then, a light veil over it.
        await page.waitForSelector('.wpbn-modal--position.has-live');
        const live=await page.evaluate(()=>{const f=document.querySelector('.wpbn-focus__live iframe'),doc=f.contentDocument,stage=document.querySelector('.wpbn-focus__stage').getBoundingClientRect(),canvas=document.querySelector('.wpbn-focus__stage>.wpbn-position-canvas');
            return {still:doc.body.classList.contains('wpbn-still'),page:!!doc.querySelector('.wpbn-page'),button:doc.querySelectorAll('.wpbn-layer--button').length,layers:doc.querySelectorAll('.wpbn-layer').length,others:[...canvas.querySelectorAll('.is-other')].filter(x=>x.getClientRects().length).length,width:Math.abs(f.getBoundingClientRect().width-stage.width),veil:getComputedStyle(document.querySelector('.wpbn-focus__live'),'::after').backgroundColor,anim:[...doc.querySelectorAll('.wpbn-enter,.wpbn-anim')].map(x=>getComputedStyle(x).animationName).filter(n=>n!=='none').length};});
        assert.ok(live.still && !live.page && live.button===0 && live.layers>0 && live.others===0 && live.width<1 && live.veil==='rgba(0, 0, 0, 0.18)' && live.anim===0,'The Position window shows the scene as rendered, without the layer placed, still ('+JSON.stringify(live)+')');
        await page.keyboard.press('Escape');
        await page.click('[data-row-action="delete"][data-index="'+buttonIndex+'"]');
        assert.equal((await data()).layers.some(l=>l.type==='button'),false,'Button deleted');
        await page.click(titleRow);
        // The preview: a page under the banner, so it can scroll out of view.
        assert.ok(await frame().locator('.wpbn-page').count()===1 && await frame().evaluate(()=>document.documentElement.scrollHeight>innerHeight*1.5),'A placeholder page under the banner');
        // A screen size of one's own, applied with Update, in a plain frame.
        await page.fill('#wpbn-res-w','1000');await page.fill('#wpbn-res-h','700');
        assert.ok(await page.locator('#wpbn-res-hint').count()===0 && await page.locator('.wpbn-toolbar #wpbn-dark + #wpbn-dev + #wpbn-move + .wpbn-resolution').count()===1,'Screen: in the bar after the Dark, Developer mode and Move buttons, no hint');await page.locator('.wpbn-toolbar').screenshot({path:path.join(__dirname,'toolbar.png')});
        assert.ok(await page.evaluate(()=>{const a=document.getElementById('wpbn-dev').getBoundingClientRect(),b=document.getElementById('wpbn-move').getBoundingClientRect();return Math.abs(a.width-b.width)<0.5 && Math.abs(a.height-b.height)<0.5 && Math.abs(a.top-b.top)<0.5;}),'Move: as large as the buttons beside it');
        await update();
        assert.equal(await frame().evaluate(()=>innerWidth),1000);
        assert.equal(await page.locator('#wpbn-preview-stage').evaluate(el=>el.classList.contains('is-custom')),true,'Own size: a plain frame');
        assert.equal(await page.locator('.wpbn-device-drawing:not([hidden])').count(),0,"No device drawing for a size of one's own");
        // The Position window: the preview's screen (its own size here), in the same proportions as the preview's scene.
        await page.click(POS);
        const sceneRatio=await frame().locator('.wpbn-scene').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});
        const windowRatio=await page.locator('.wpbn-focus__stage').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});
        assert.match(await page.locator('.wpbn-focus__stage').evaluate(el=>el.style.aspectRatio),/^1000 ?\//,'The window: the preview\'s own width');
        assert.ok(Math.abs(sceneRatio-windowRatio)/sceneRatio<0.02,'The window in the preview scene\'s proportions ('+sceneRatio.toFixed(3)+' / '+windowRatio.toFixed(3)+')');
        await page.click('.wpbn-modal__cancel');
        await page.fill('#wpbn-res-w','');await page.fill('#wpbn-res-h','');
        await update();
        assert.equal(await frame().evaluate(()=>innerWidth),1280,'Empty fields: the usual size again');
        // Placement by class (2026-11-13: per device, with any Height): the class field always active; its Background of the
        // block switch greyed until there is a class.
        await page.click('#wpbn-scene-settings');
        await page.selectOption('[data-key="height_unit"]','px');
        assert.equal(await page.locator('#wpbn-f-by_class').count(),0,'No old switch: the class alone');
        assert.equal(await page.locator('#wpbn-f-target').isDisabled(),false,'Height in px: Insert into blocks by class still active');
        assert.equal(await page.locator('#wpbn-f-as_background').isDisabled(),true,'No class yet: Background of the block greyed');
        await page.selectOption('[data-key="height_unit"]','auto');
        assert.equal(await page.locator('#wpbn-f-target').getAttribute('placeholder'),'wpbn-scene-7','A class suggested');
        await page.fill('#wpbn-f-target','hero');
        assert.ok(!(await page.locator('#wpbn-f-as_background').isDisabled()) && await page.locator('#wpbn-f-as_background').isChecked(),'With a class: Background of the block on');
        assert.equal(await page.locator('#wpbn-height-note').isHidden(),true,'With a class, the unit help gives way');
        assert.match(await page.locator('#wpbn-height-tip').getAttribute('data-tip'),/Inside a block with the class/,'Height explains where it is used, on its tooltip');
        assert.equal(await page.locator('#wpbn-height-tip').isVisible(),true);
        const tip=page.locator('.wpbn-field:has(#wpbn-f-target) .wpbn-tip');
        assert.equal(await tip.evaluate(el=>getComputedStyle(el,'::after').visibility),'hidden','Help hidden until wanted');
        await tip.hover();await page.waitForTimeout(200);
        assert.equal(await tip.evaluate(el=>getComputedStyle(el,'::after').visibility),'visible','Help on a dark tooltip on hover');
        assert.equal(await tip.evaluate(el=>getComputedStyle(el,'::after').backgroundColor),'rgb(29, 35, 39)');
        // Per device: the block's background on Desktop, a block of its own on Mobile (in the preview: put back where it stood).
        const bgDevice=d=>page.click('.wpbn-field--resp-check [data-field-device="'+d+'"]');
        await bgDevice('mobile');
        await page.click('label[for="wpbn-f-as_background_mobile"]');
        const bg=await data();
        assert.ok(bg.as_background===true && bg.as_background_tablet==null && bg.as_background_mobile===false,'Off on Mobile only');
        assert.equal(await page.locator('#wpbn-height-note').isHidden(),false,'On Mobile its own Height applies: the unit help is back');
        await update();
        const placedNow=()=>frame().evaluate(()=>{const s=document.querySelector('.wpbn-scene');return s.classList.contains('wpbn-scene--fill')+' '+s.parentElement.classList.contains('wpbn-host');});
        assert.equal(await placedNow(),'false false','The preview on Mobile: a block of its own');
        await bgDevice('desktop');
        await frame().waitForFunction(()=>document.querySelector('.wpbn-scene').classList.contains('wpbn-scene--fill'));
        assert.equal(await placedNow(),'true true','The same page on Desktop: the block\'s background');
        assert.ok(await frame().evaluate(()=>{const s=document.querySelector('.wpbn-scene').getBoundingClientRect();return Math.abs(s.height-innerHeight)<2;}),'As tall as its block');
        await bgDevice('mobile');
        await frame().waitForFunction(()=>!document.querySelector('.wpbn-scene').classList.contains('wpbn-scene--fill'));
        assert.equal(await placedNow(),'false false','Narrowed again: put back where it stood');
        await page.click('.wpbn-field--resp-check [data-reset]');
        assert.equal((await data()).as_background_mobile,null,'Reset: Mobile follows the larger screen');
        await bgDevice('desktop');
        await page.selectOption('[data-key="height_unit"]','vh');
        assert.ok(!(await page.locator('#wpbn-f-target').isDisabled()) && (await data()).target==='hero','Another height: still placed by its class');
        // Attributes: the scene's own id and classes on its block.
        assert.ok(await page.locator('#wpbn-menu .wpbn-menu-item__title').allTextContents().then(t=>t.includes('Attributes')),'Scene settings: Attributes');
        await page.fill('#wpbn-f-css_id','offer');
        await page.fill('#wpbn-f-css_class','hero-banner dark');
        assert.ok((await data()).css_id==='offer' && (await data()).css_class==='hero-banner dark','Kept in the scene');
        await update();
        assert.ok(await frame().locator('section#offer.wpbn-scene.hero-banner.dark').count()===1,'On the site: the block with its id and classes');
        await page.selectOption('[data-key="height_unit"]','px');
        // Image position (as WP Swiper's): the whole photo, the point kept in view; the box is not moved.
        const photo=await browser.newPage({viewport:{width:1600,height:1000}});photo.on('pageerror',e=>errors.push(e.message));
        await photo.goto('http://127.0.0.1:'+server.address().port+'/?image=1');
        await photo.click('[data-select="0"]');
        assert.equal(await posTip(photo),'Image position: 50% 50%','The point in view, on hover');
        assert.equal(await photo.locator('.wpbn-picker__actions .button').textContent(),'Change','The image row ends with Change');
        await photo.click(POS);
        assert.equal(await photo.locator('.wpbn-modal--position').evaluate(el=>el.classList.contains('is-focus')),true);
        assert.equal(await photo.locator('.wpbn-modal__what').textContent(),'Image position');
        await photo.locator('.wpbn-focus__image').evaluate(img=>img.decode());
        const stageRatio=await photo.locator('.wpbn-focus__stage').evaluate(el=>{const r=el.getBoundingClientRect(),i=el.querySelector('.wpbn-focus__image');return [r.width/r.height,i.naturalWidth/i.naturalHeight];});
        assert.ok(Math.abs(stageRatio[0]-stageRatio[1])<.02,'The whole photo at its own proportions');
        const sb=await photo.locator('.wpbn-focus__stage').boundingBox();
        await photo.mouse.click(sb.x+sb.width*.25,sb.y+sb.height*.75);
        assert.equal(await focusValue(photo),'25% 75%');
        assert.equal(await photo.locator('.wpbn-focus__device[data-device="mobile"] .wpbn-position-target img').evaluate(i=>i.style.objectPosition),'25% 75%','Frames crop the photo around the point');
        assert.equal(await photo.locator('.wpbn-focus__device .wpbn-position-gap').count(),0,'A full-size layer leaves no gaps');
        await photo.click('.wpbn-modal__apply');
        const photoLayer=JSON.parse(await photo.locator('#wpbn-data').inputValue()).layers[0];
        assert.deepEqual([photoLayer.focus_x,photoLayer.focus_y,photoLayer.x,photoLayer.y],[25,75,50,50],'The point is saved; the layer stays where it was');
        await photo.click('#wpbn-refresh');
        await photo.waitForFunction(()=>getComputedStyle(document.querySelector('#wpbn-frame').contentDocument?.querySelector('.wpbn-layer img')||document.body).objectPosition==='25% 75%');
        // Fill the scene off: the image becomes an object: its Container, Width and Height (Auto: its proportions), Position as a title's.
        const photoData=async()=>JSON.parse(await photo.locator('#wpbn-data').inputValue()).layers[0];
        assert.ok(await photo.locator('#wpbn-f-fill_scene').isChecked() && await photo.locator('#wpbn-f-overlay_width').count()===0,'An image fills the scene by default: no Width or Height');
        await photo.click('label[for="wpbn-f-fill_scene"]');
        let obj=await photoData();
        assert.ok(obj.fill_scene===false && obj.overlay_width===50 && obj.height_unit==='auto','Off: half its container, Height Auto');
        assert.ok(await photo.locator('#wpbn-f-overlay_width').count()===1 && await photo.locator('#wpbn-f-height').isDisabled() && await photo.locator('[data-key="height_unit"] option[value="auto"]').count()===1,'Its Width; its Height on Auto (the number greyed)');
        assert.ok((await photo.locator('#wpbn-settings .wpbn-position-button').allTextContents()).join()==='Image position' && await photo.locator(POS).getAttribute('data-kind')==='place','Image position in its settings (the point of its photo in view); its Position (where it stands) on the tile');
        assert.ok(await photo.locator('[data-key="fit"]').isDisabled(),'Height Auto: Image fit greyed (nothing is cropped)');await photo.locator('#wpbn-settings .wpbn-card:has(#wpbn-f-fill_scene)').screenshot({path:path.join(__dirname,'image-object.png')});
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const objFrame=photo.frames().find(f=>f.name()==='wpbn_preview_frame');
        const ob=await objFrame.locator('.wpbn-layer--object').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect(),i=el.querySelector('img');return {w:r.width/s.width,h:r.height,ratio:i.naturalHeight/i.naturalWidth*r.width,left:(r.left-s.left+r.width/2)/s.width,top:(r.top-s.top+r.height/2)/s.height};});
        assert.ok(Math.abs(ob.w-0.5)<0.01 && Math.abs(ob.h-ob.ratio)<2 && Math.abs(ob.left-0.5)<0.01 && Math.abs(ob.top-0.5)<0.01,'On the site: half the scene wide, as tall as the image, centred ('+JSON.stringify(ob)+')');
        // Its Position: the box, placed as a title is (dragged within the scene).
        await photo.click(POS);
        assert.ok(!(await photo.locator('.wpbn-modal--position').evaluate(el=>el.classList.contains('is-focus'))) && await photo.locator('.wpbn-modal__what').textContent()==='Position','Position: where the image stands, not the point of its photo');
        const ps=await photo.locator('.wpbn-focus__stage').boundingBox();
        await photo.mouse.click(ps.x+2,ps.y+2);
        assert.ok((await focusValue(photo)).split(' ').every(v=>parseFloat(v)<1),'Clicked at the corner: flush top left');
        const tb=await photo.locator('.wpbn-focus__stage .wpbn-position-target').boundingBox();
        assert.ok(Math.abs(tb.x-ps.x)<2 && Math.abs(tb.y-ps.y)<2 && Math.abs(tb.width-ps.width/2)<2,'The box drawn at the corner, half as wide');
        await photo.click('.wpbn-modal__apply');
        obj=await photoData();
        assert.ok(obj.x<1 && obj.y<1,'Applied');
        // A fixed height: Image fit and Image position apply (the box crops the photo).
        await photo.selectOption('[data-key="height_unit"]','px');
        assert.ok(!(await photo.locator('[data-key="fit"]').isDisabled()),'A fixed height: Image fit active');
        await photo.fill('#wpbn-f-height','200');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        assert.equal(Math.round(await objFrame.locator('.wpbn-layer--object').evaluate(el=>el.getBoundingClientRect().height)),200,'Its height: 200px');
        // Width Auto (2026-11-13): as wide as the image at its Height; Height 100%: the whole height of the scene.
        await photo.selectOption('[data-key="overlay_width_unit"]','auto');
        assert.ok((await photoData()).height_unit==='px' && await photo.locator('#wpbn-f-overlay_width').isDisabled() && await photo.locator('[data-key="fit"]').isDisabled(),'Width Auto: its number and Image fit greyed, the Height kept');
        await photo.selectOption('[data-key="height_unit"]','%');await photo.fill('#wpbn-f-height','100');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const fullH=await objFrame.locator('.wpbn-layer--object').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect(),i=el.querySelector('img');return {h:r.height/s.height,w:r.width,img:i.getBoundingClientRect().width,ratio:i.naturalWidth/i.naturalHeight*r.height};});
        assert.ok(Math.abs(fullH.h-1)<0.01 && Math.abs(fullH.w-fullH.ratio)<2 && Math.abs(fullH.img-fullH.w)<1,'On the site: the scene\'s whole height, as wide as the image there ('+JSON.stringify(fullH)+')');
        // Its Position: as tall as the scene, so Y has no room (greyed, the arrows leave it); X still moves it.
        await photo.click(POS);
        const room=await photo.evaluate(()=>{const st=document.querySelector('.wpbn-focus__stage').getBoundingClientRect(),t=document.querySelector('.wpbn-focus__stage .wpbn-position-target').getBoundingClientRect();return {full:Math.abs(st.width-t.width)<1,wider:t.width>st.width+0.5};});
        assert.ok(await photo.locator('#wpbn-pos-y').isDisabled() && await photo.locator('.wpbn-axis:has(#wpbn-pos-y)').evaluate(a=>a.classList.contains('is-fixed')),'Height 100%: Y greyed');
        assert.ok(!room.wider && (await photo.locator('#wpbn-pos-x').isDisabled())===room.full,'A wide photo: never wider than its container; X greyed only where it takes all of it ('+JSON.stringify(room)+')');
        const yBefore=(await focusValue(photo)).split(' ')[1];
        await photo.locator('.wpbn-focus__stage').press('ArrowDown');
        assert.equal((await focusValue(photo)).split(' ')[1],yBefore,'The arrows leave Y as it is');
        await photo.click('.wpbn-modal__cancel');
        await photo.selectOption('[data-key="height_unit"]','auto');
        obj=await photoData();
        assert.ok(obj.height_unit==='auto' && obj.overlay_width_unit==='%' && obj.overlay_width===50,'Not both Auto: Height Auto gives its Width half its container');
        await photo.click('label[for="wpbn-f-fill_scene"]');
        assert.ok((await photoData()).fill_scene===true && await photo.locator('#wpbn-f-overlay_width').count()===0,'Back on: it fills the scene again (its object size kept)');
        // Fill the scene per device (2026-11-13, user's request): off on Mobile only, Desktop and Tablet still filling the scene.
        const fillDevice=d=>photo.click('#wpbn-settings .wpbn-field--resp-check [data-field-device="'+d+'"]');
        await fillDevice('mobile');
        assert.ok(await photo.locator('#wpbn-f-fill_scene_mobile').isChecked() && await photo.locator('.wpbn-field--resp-check [data-reset]').isDisabled(),'Mobile follows Desktop: on, nothing to reset');
        await photo.click('label[for="wpbn-f-fill_scene_mobile"]');
        obj=await photoData();
        assert.ok(obj.fill_scene===true && obj.fill_scene_tablet==null && obj.fill_scene_mobile===false && await photo.locator('#wpbn-f-mobile_overlay_width').count()===1,'Off on Mobile only: its Width there');
        assert.ok(await photo.locator('.wpbn-field--resp-check [data-field-device="mobile"]').evaluate(b=>b.classList.contains('has-value')) && await photo.locator(POS).getAttribute('title').then(t=>t.startsWith('Position on Mobile')),'A green dot on Mobile; its Position on the tile');
        const sceneShare=()=>objFrame.locator('.wpbn-layer--object').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.getBoundingClientRect();return {w:r.width/s.width,h:r.height/s.height};});
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const onMobile=await sceneShare();
        assert.ok(Math.abs(onMobile.w-0.5)<0.01 && onMobile.h<0.99,'On Mobile: an object, half the scene wide ('+JSON.stringify(onMobile)+')');
        await photo.click(POS);
        assert.ok(await photo.locator('.wpbn-focus__device[data-device="desktop"]').isDisabled() && !(await photo.locator('.wpbn-focus__device[data-device="mobile"]').isDisabled()),'Its Position window: only Mobile, where it is an object');
        await photo.click('.wpbn-modal__cancel');
        await fillDevice('desktop');
        assert.ok(await photo.locator('#wpbn-f-fill_scene').isChecked() && await photo.locator('#wpbn-f-overlay_width').count()===0,'Desktop still fills the scene');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const onDesktop=await sceneShare();
        assert.ok(onDesktop.w>0.99 && onDesktop.h>0.99,'On Desktop: the whole scene ('+JSON.stringify(onDesktop)+')');
        await fillDevice('mobile');
        await photo.click('.wpbn-field--resp-check [data-reset]');
        assert.ok((await photoData()).fill_scene_mobile===null && await photo.locator('#wpbn-f-fill_scene_mobile').isChecked(),'Reset: Mobile follows the larger screen again');
        await fillDevice('desktop');
        // Show on (2026-11-13): hidden on Mobile only; its tile dimmed there; the preview hides it there.
        assert.equal(await photo.locator('[data-show-on][aria-pressed="true"]').count(),3,'Show on: every device by default');
        await photo.click('[data-show-on="mobile"]');
        obj=await photoData();
        assert.ok(obj.hide_mobile===true && !obj.hide_desktop && !obj.hide_tablet && await photo.locator('[data-show-on="mobile"]').getAttribute('aria-pressed')==='false','Hidden on Mobile only');
        assert.ok(!(await photo.locator('.wpbn-layer-row.is-active').evaluate(r=>r.classList.contains('is-hidden'))),'Its tile as usual on Desktop');
        const layerShown=()=>objFrame.locator('.wpbn-layer--image').evaluate(el=>el.getClientRects().length>0);
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        assert.equal(await layerShown(),true,'Shown on Desktop');
        await fillDevice('mobile');
        assert.ok(await photo.locator('.wpbn-layer-row.is-active').evaluate(r=>r.classList.contains('is-hidden')),'Its tile dimmed on Mobile');
        await objFrame.waitForFunction(()=>innerWidth<=767);
        assert.equal(await layerShown(),false,'Hidden in the preview on Mobile');
        await photo.click('[data-show-on="mobile"]');
        assert.equal((await photoData()).hide_mobile,false,'Shown again');
        await fillDevice('desktop');
        // No Decorative switch (removed 2026-11-09). Its name, the first field; the layer list follows it.
        assert.equal(await photo.locator('#wpbn-f-decorative').count(),0,'No Decorative switch');
        assert.equal(await photo.locator('#wpbn-settings .wpbn-card').first().locator('input').first().getAttribute('id'),'wpbn-f-name','Name: the first field');
        await photo.fill('#wpbn-f-name','Mountains photo');
        assert.ok((await photoData()).name==='Mountains photo' && (await photo.locator('.wpbn-layer-row.is-active .wpbn-layer-label').textContent()).startsWith('Mountains photo'),'Renamed, in the list too');
        // Rotation (Effect, per device), no switch: 0° by default; turned in the preview.
        assert.ok(await photo.locator('#wpbn-f-use_rotate').count()===0 && await photo.locator('#wpbn-f-rotate').inputValue()==='0','Rotation: no switch, 0°');
        await photo.fill('#wpbn-f-rotate','12');
        assert.ok((await photoData()).use_rotate===true && (await photoData()).rotate===12,'Rotation: 12°');
        // Border (Effect, 2026-11-09): its switch; the four sides together while linked, one on its own once not; its line; on the picture.
        await photo.click('label[for="wpbn-f-use_border"]');
        assert.ok(await photo.locator('.wpbn-border-box [data-border-side]').count()===4 && await photo.locator('[data-border-link]').getAttribute('aria-pressed')==='true' && await photo.locator('#wpbn-f-border_style').count()===1,'Border on: four sides, linked, its line');
        await photo.fill('#wpbn-f-border_top','6');
        let bd=await photoData();
        assert.ok(bd.border_top===6 && bd.border_right===6 && bd.border_bottom===6 && bd.border_left===6 && await photo.locator('#wpbn-f-border_left').inputValue()==='6','Linked: one width sets all four');
        await photo.click('[data-border-link]');
        await photo.fill('#wpbn-f-border_left','0');
        bd=await photoData();
        assert.ok(bd.border_linked===false && bd.border_left===0 && bd.border_top===6 && await photo.locator('.wpbn-border-box--border .wpbn-border-box__frame').evaluate(el=>el.style.borderLeft.indexOf('dashed')!==-1 && el.style.borderTop.indexOf('6px')===0),'Unlinked: one side on its own; the box drawn so');
        await photo.selectOption('#wpbn-f-border_style','dashed');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const bdSite=await photo.frames().find(f=>f.name()==='wpbn_preview_frame').locator('.wpbn-layer--border img').first().evaluate(el=>{const c=getComputedStyle(el);return [c.borderTopWidth,c.borderLeftWidth,c.borderTopStyle].join(' ');});
        assert.equal(bdSite,'6px 0px dashed','On the site: on the picture, per side, its line');
        // Radius (Effect, 2026-11-09): its switch; four corners linked; px or % beside each (the one in use pressed); on the picture.
        await photo.click('label[for="wpbn-f-use_radius"]');
        await photo.fill('#wpbn-f-radius_tl','20');
        let rd=await photoData();
        assert.ok(['tl','tr','br','bl'].every(c=>rd['radius_'+c]===20) && await photo.locator('[data-radius-unit="tl"][data-unit="px"]').getAttribute('aria-pressed')==='true','Radius linked: one corner sets all four, in px');
        await photo.click('[data-radius-link]');
        await photo.click('[data-radius-unit="br"][data-unit="%"]');
        await photo.fill('#wpbn-f-radius_br','50');
        rd=await photoData();
        assert.ok(rd.radius_linked===false && rd.radius_br===50 && rd.radius_br_unit==='%' && rd.radius_tl_unit==='px' && await photo.locator('[data-radius-unit="br"][data-unit="%"]').getAttribute('aria-pressed')==='true','Unlinked: one corner in % on its own');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const rdSite=await photo.frames().find(f=>f.name()==='wpbn_preview_frame').locator('.wpbn-layer--radius img').first().evaluate(el=>{const c=getComputedStyle(el);return [c.borderTopLeftRadius,c.borderBottomRightRadius].join(' ');});
        assert.equal(rdSite,'20px 50%','On the site: the corners of the picture');
        await photo.click('label[for="wpbn-f-use_radius"]');
        await photo.click('label[for="wpbn-f-use_border"]');
        // Shadow (the title's block), in Size: on, along the image's outline in the preview.
        assert.equal(await photo.locator('#wpbn-block-effect .wpbn-card #wpbn-f-use_shadow').count(),1,'The image\'s Shadow in Effect');
        assert.equal(await photo.locator('#wpbn-f-use_shadow').isChecked(),false,'Image Shadow off by default');
        await photo.click('label[for="wpbn-f-use_shadow"]');
        assert.ok((await photoData()).use_shadow===true && await photo.locator('#wpbn-f-shadow_blur').count()===1,'Shadow on: its color, X, Y, Blur');
        await photo.click('#wpbn-refresh');await photo.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        assert.match(await photo.frameLocator('#wpbn-frame').locator('.wpbn-layer--shadow img').evaluate(el=>getComputedStyle(el).filter),/^drop-shadow/,'In the preview: a drop shadow');
        assert.match(await photo.frameLocator('#wpbn-frame').locator('.wpbn-layer--shadow').evaluate(el=>getComputedStyle(el).transform),/^matrix\(/,'In the preview: turned');
        assert.ok(Math.abs(await photo.frameLocator('#wpbn-frame').locator('.wpbn-layer--shadow').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return Math.atan2(m.b,m.a)*180/Math.PI;})-12)<0.5,'By 12°');
        await photo.close();
        // A new scene: Animation, Undo / Redo, Follow the mouse, a title's Width, the tips' places.
        const ed=await browser.newPage({viewport:{width:1600,height:1000}});ed.on('pageerror',e=>errors.push(e.message));
        await ed.goto('http://127.0.0.1:'+server.address().port);
        const edTitle=async()=>JSON.parse(await ed.locator('#wpbn-data').inputValue()).layers[0];
        await ed.click('#wpbn-add-toggle');await ed.click('.wpbn-modal--add [data-add="text"]');
        // Loop animation: no switch (2026-11-09): its Type, None first; None: its other fields greyed. A kind: Zoom with its Direction, On load.
        assert.ok(await ed.locator('#wpbn-f-use_anim').count()===0 && await ed.locator('#wpbn-f-anim_type').inputValue()==='none' && (await ed.locator('#wpbn-f-anim_type option').first().textContent())==='None' && !(await ed.locator('#wpbn-f-anim_type').isDisabled()) && !(await ed.locator('#wpbn-f-anim_start').isDisabled()),'Loop animation: None first, its fields active (2026-11-09)');
        // Type and Starts each on a row of its own; the help in tips.
        assert.ok(await ed.evaluate(()=>{const a=document.getElementById('wpbn-f-anim_type').getBoundingClientRect(),b=document.getElementById('wpbn-f-anim_start').getBoundingClientRect();return b.top>=a.bottom && Math.abs(a.width-b.width)<1;}) && await ed.locator('[data-base="anim_duration"] .wpbn-field__head .wpbn-tip').count()===1,'Type and Starts on rows of their own; tips');
        await ed.selectOption('#wpbn-f-anim_type','zoom');
        assert.ok((await edTitle()).use_anim===true && !(await ed.locator('#wpbn-f-anim_start').isDisabled()) && await ed.locator('#wpbn-f-anim_type').inputValue()==='zoom' && await ed.locator('#wpbn-f-anim_origin').count()===1 && await ed.locator('#wpbn-f-anim_start').inputValue()==='load','On: Zoom, its Direction, On load');
        // Undo keeps a step once nothing has changed for a moment.
        await ed.waitForTimeout(600);
        await ed.selectOption('#wpbn-f-anim_type','fade');
        let edT=await edTitle();
        assert.ok(edT.anim_type==='fade' && edT.anim_from===0 && edT.anim_to===100 && edT.anim_repeat==='once' && await ed.locator('#wpbn-f-anim_origin').count()===0,'Fade: 0 → 100, once, no Direction');
        assert.equal(await ed.locator('#wpbn-undo').isDisabled(),false,'Undo available');
        // The arrows centred in their buttons (WordPress's button line height does not reach them).
        assert.ok(await ed.evaluate(()=>['undo','redo'].every(id=>{const b=document.getElementById('wpbn-'+id).getBoundingClientRect(),i=document.querySelector('#wpbn-'+id+' .dashicons'),r=i.getBoundingClientRect();return Math.abs((r.top+r.height/2)-(b.top+b.height/2))<1 && Math.abs((r.left+r.width/2)-(b.left+b.width/2))<1 && getComputedStyle(i).lineHeight===getComputedStyle(i).height;})),'Undo and Redo arrows centred');
        await ed.click('#wpbn-undo');
        assert.ok(await ed.locator('#wpbn-f-anim_type').inputValue()==='zoom' && (await edTitle()).anim_type==='zoom','Undo: back to Zoom, the saved data too');
        await ed.click('#wpbn-redo');
        assert.equal(await ed.locator('#wpbn-f-anim_type').inputValue(),'fade','Redo: Fade again');
        await ed.locator('#wpbn-layers').focus();await ed.keyboard.press('Control+z');
        assert.equal(await ed.locator('#wpbn-f-anim_type').inputValue(),'zoom','Ctrl + Z');
        // Entrance animation: off; on, Fade in, In view; a slide's Distance; in the preview, around the Loop animation.
        assert.ok(await ed.locator('#wpbn-f-use_enter').count()===0 && await ed.locator('#wpbn-f-enter_type').inputValue()==='none' && (await ed.locator('#wpbn-f-enter_type option').first().textContent())==='None' && !(await ed.locator('#wpbn-f-enter_delay').isDisabled()),'Entrance animation: None first, its fields active (2026-11-09)');
        assert.ok(await ed.evaluate(()=>{const a=document.getElementById('wpbn-f-enter_type').getBoundingClientRect(),b=document.getElementById('wpbn-f-enter_start').getBoundingClientRect();return b.top>=a.bottom;}) && await ed.locator('#wpbn-f-enter_delay').evaluate(el=>!!el.closest('.wpbn-field').querySelector('.wpbn-field__head .wpbn-tip')),'Type and Starts on rows of their own; tips');
        await ed.selectOption('#wpbn-f-enter_type','fade');
        assert.ok((await edTitle()).use_enter===true && await ed.locator('#wpbn-f-enter_type').inputValue()==='fade' && await ed.locator('#wpbn-f-enter_start').inputValue()==='visible' && await ed.locator('#wpbn-f-enter_distance').count()===0,'On: Fade in, In view, no Distance');
        await ed.selectOption('#wpbn-f-enter_type','slide-up');
        assert.equal(await ed.locator('#wpbn-f-enter_distance').inputValue(),'60','A slide: its Distance');
        await ed.click('#wpbn-refresh');await ed.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        assert.equal(await ed.frameLocator('#wpbn-frame').locator('.wpbn-enter > .wpbn-anim').evaluate(el=>getComputedStyle(el.parentElement).animationName),'wpbn-enter-slide','In the preview: the slide, around the Loop animation');
        // From the left edge (2026-11-09): no Distance; in the preview it starts just outside the banner.
        await ed.selectOption('#wpbn-f-enter_type','edge-left');
        assert.equal(await ed.locator('#wpbn-f-enter_distance').count(),0,'From an edge: no Distance');
        await ed.click('#wpbn-refresh');await ed.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const edge=await ed.frameLocator('#wpbn-frame').locator('.wpbn-enter--edge-left').evaluate(el=>{const s=el.closest('.wpbn-scene').getBoundingClientRect(),r=el.parentElement.getBoundingClientRect();return {x:parseFloat(el.style.getPropertyValue('--wpbn-ex')),want:s.left-r.right,name:getComputedStyle(el).animationName};});
        assert.ok(Math.abs(edge.x-edge.want)<1 && edge.x<0 && edge.name==='wpbn-enter-edge','From the left edge: it starts just outside the banner ('+JSON.stringify(edge)+')');
        await ed.selectOption('#wpbn-f-enter_type','none');
        assert.ok((await edTitle()).use_enter===false && (await edTitle()).enter_type==='edge-left','None: off, the type kept');
        // Text animation (2026-11-11): a title's letters one after another. None to start with; a type sets its own look;
        // Distance only for Scatter and Drop, Start size only for Pop; in the preview each letter a piece, in its order.
        assert.ok(await ed.locator('#wpbn-f-text_anim_type').inputValue()==='none' && await ed.locator('#wpbn-f-text_anim_type').evaluate(el=>el.closest('.wpbn-block').id)==='wpbn-block-textanim','Text animation: its own block, None');
        await ed.selectOption('#wpbn-f-text_anim_type','scatter');
        let edTa=await edTitle();
        assert.ok(edTa.use_text_anim===true && edTa.text_anim_order==='random' && edTa.text_anim_stagger===0.05 && edTa.text_anim_blur===10 && edTa.text_anim_distance===100 && edTa.text_anim_easing==='strong','Scatter: its own look ('+JSON.stringify(edTa)+')');
        assert.ok(await ed.locator('#wpbn-f-text_anim_distance').count()===1 && await ed.locator('#wpbn-f-text_anim_scale').count()===0,'Scatter: a Distance, no Start size');
        await ed.selectOption('#wpbn-f-text_anim_type','pop');
        assert.ok((await edTitle()).text_anim_scale===30 && (await edTitle()).text_anim_order==='start' && await ed.locator('#wpbn-f-text_anim_distance').count()===0 && await ed.locator('#wpbn-f-text_anim_scale').inputValue()==='30','Pop: its Start size, no Distance');
        await ed.fill('#wpbn-f-text_anim_stagger','0.2');await ed.selectOption('#wpbn-f-text_anim_start','load');
        assert.ok((await edTitle()).text_anim_stagger===0.2 && await ed.locator('[data-block="textanim"] .wpbn-menu-item__dot').count()===1,'Its interval kept; a dot on its block');
        await ed.click('#wpbn-refresh');await ed.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const taFrame=await ed.frameLocator('#wpbn-frame').locator('.wpbn-layer--text .wpbn-ta').evaluate(el=>{const p=[...el.querySelectorAll('.wpbn-ta-u')];return {cls:el.className,n:p.length,text:el.querySelector('.wpbn-sr').textContent,anim:getComputedStyle(p[1]).animationName,delays:p.slice(0,3).map(x=>getComputedStyle(x).animationDelay)};});
        assert.ok(taFrame.cls==='wpbn-ta wpbn-ta--pop' && taFrame.n>3 && taFrame.text.length>0 && taFrame.anim==='wpbn-ta-pop' && JSON.stringify(taFrame.delays)===JSON.stringify(['0s','0.2s','0.4s']),'In the preview: each letter a piece, one interval after another ('+JSON.stringify(taFrame)+')');
        // Update again once the letters are in (2026-11-11, user's frames: the title showed whole until the new page came,
        // then vanished and came in again): the page shown hides them at once, back at their start.
        await ed.waitForFunction(()=>[...document.getElementById('wpbn-frame').contentDocument.querySelectorAll('.wpbn-ta-u')].every(el=>getComputedStyle(el).opacity==='1'),null,{timeout:10000});
        const rewound=await ed.evaluate(()=>{const doc=document.getElementById('wpbn-frame').contentDocument,first=doc.querySelector('.wpbn-ta-u');document.getElementById('wpbn-refresh').click();return getComputedStyle(first).opacity;});
        assert.equal(rewound,'0','Update: the letters shown go back to their start at once');
        await ed.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        await ed.selectOption('#wpbn-f-text_anim_type','none');
        assert.ok((await edTitle()).use_text_anim===false && (await edTitle()).text_anim_type==='pop' && await ed.locator('[data-block="textanim"] .wpbn-menu-item__dot').count()===0,'None: off, the type kept');
        // Follow the mouse: no switch (2026-11-09), its Distance 0 to start with.
        assert.ok(await ed.locator('#wpbn-f-use_mouse').count()===0 && (await edTitle()).use_mouse===true && await ed.locator('#wpbn-f-mouse').inputValue()==='0','Follow the mouse: no switch, 0px');
        await ed.fill('#wpbn-f-mouse','20');
        assert.equal(await ed.locator('[data-block="mouse"] .wpbn-menu-item__dot').count(),1,'A dot once it moves');
        // A title's Width: Auto; 50% of its container (93.125% of the scene here), drawn so in the Position window.
        assert.equal(await ed.locator('[data-key="text_width_unit"]').inputValue(),'auto','Width: Auto');
        await ed.selectOption('[data-key="text_width_unit"]','%');
        await ed.fill('#wpbn-f-text_width','50');
        assert.ok((await edTitle()).text_width_unit==='%' && (await edTitle()).text_width===50,'Width: 50%');
        await ed.click(POS);
        const edWidth=await ed.locator('.wpbn-focus__stage .wpbn-position-target').evaluate(el=>el.style.width);
        assert.ok(Math.abs(parseFloat(edWidth)-93.125/2)<0.1,'The Position window draws it at its Width ('+edWidth+')');
        await ed.click('.wpbn-modal__cancel');
        // Each "i" right after its label, on its line (switches too).
        const tipsOff=await ed.evaluate(()=>[...document.querySelectorAll('#wpbn-settings .wpbn-tip')].filter(t=>t.offsetParent).map(t=>{const label=(t.closest('.wpbn-field')||t.parentElement).querySelector('label, .wpbn-field__label'),a=t.getBoundingClientRect(),b=label.getBoundingClientRect();return Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2 && a.left>=b.right-1 && a.left-b.right<14 ? null : label.textContent.trim();}).filter(Boolean));
        assert.deepEqual(tipsOff,[],'Every tip beside its label');
        await ed.close();
        // Blocks (2026-11-09, as WP Swiper's settings box): the menu at the left names a layer's blocks, the chosen one shows (the fixture shows all; not here).
        const tp=await browser.newPage({viewport:{width:1600,height:1000}});tp.on('pageerror',e=>errors.push(e.message));
        await tp.goto('http://127.0.0.1:'+server.address().port+'/?image');
        await tp.evaluate(()=>document.getElementById('wpbn-test-all-blocks').remove());
        await tp.click('[data-select="0"]');
        const menuState=()=>tp.evaluate(()=>[...document.querySelectorAll('#wpbn-menu [data-block]')].map(b=>b.querySelector('.wpbn-menu-item__title').textContent+(b.getAttribute('aria-current')==='true'?'*':'')));
        assert.deepEqual(await menuState(),['Content*','Size','Effect','Filters','Entrance animation','Loop animation','Scroll animation','Follow the mouse'],'An image\'s blocks, Content first (2026-11-09: Effect after Size, the animations then)');
        assert.ok(await tp.evaluate(()=>['scale','opacity','rotate','use_shadow'].every(k=>document.getElementById('wpbn-f-'+k).closest('.wpbn-block').id==='wpbn-block-effect')),'Effect: Scale, Opacity, Rotation, Shadow');
        assert.ok(await tp.locator('#wpbn-f-name').isVisible() && !(await tp.locator('#wpbn-f-container').isVisible()),'Only the chosen block shows');
        await tp.click('[data-block="position"]');
        assert.ok(await tp.locator('#wpbn-f-container').isVisible() && !(await tp.locator('#wpbn-f-name').isVisible()),'Size: its fields');
        assert.ok(await tp.evaluate(()=>['rotate','use_shadow'].every(k=>!document.getElementById('wpbn-f-'+k).closest('.wpbn-field').querySelector('.wpbn-tip'))),'Rotation and Shadow without tips (2026-11-09)');
        // A green dot on the desktop icon too where its value is not the standard one (2026-11-09); none at the standard one.
        const dotOn=(base,dv)=>tp.locator('[data-base="'+base+'"] [data-field-device="'+dv+'"]').evaluate(el=>el.classList.contains('has-value'));
        assert.ok(await dotOn('move_y','desktop') && !(await dotOn('scale','desktop')),'Desktop: a dot for a travel of its own, none for Scale at 100%');
        await tp.click('[data-block="effect"]');
        await tp.fill('#wpbn-f-scale','120');
        assert.ok(await dotOn('scale','desktop'),'Scale changed: its desktop dot');
        await tp.fill('#wpbn-f-scale','100');
        assert.ok(!(await dotOn('scale','desktop')),'Back to the standard: no dot');
        await tp.click('[data-block="position"]');
        assert.ok(await tp.locator('#wpbn-settings legend').textContent()==='Size' && await tp.locator('#wpbn-block-position .wpbn-subheading').count()===0,'The section titled by its block, the card without a title of its own');
        await tp.keyboard.press('ArrowDown');
        assert.equal((await menuState())[2],'Effect*','Arrow keys along the menu: Effect after Size');
        await tp.keyboard.press('ArrowDown');
        assert.equal((await menuState())[3],'Filters*','Arrow keys along the menu');
        await tp.click('[data-block="scroll"]');
        // The photo moves as the page scrolls (a scene from before the switches, with a travel): a dot; at rest, none.
        assert.ok(await tp.locator('[data-block="scroll"] .wpbn-menu-item__dot').count()===1 && await tp.locator('#wpbn-block-title .wpbn-tip').count()===1,'A dot while it animates; its help beside the title');
        await tp.fill('#wpbn-f-move_y','0');
        assert.ok(await tp.locator('#wpbn-menu .wpbn-menu-item__dot').count()===0 && (await menuState())[6]==='Scroll animation*','No dot once nothing animates; the block kept');
        await tp.click('#wpbn-scene-settings');
        assert.deepEqual(await menuState(),['Size*','Placement','Attributes'],'The scene\'s blocks');
        await tp.click('#wpbn-add-toggle');await tp.click('.wpbn-modal--add [data-add="text"]');
        assert.deepEqual(await menuState(),['Content*','Title style','Size','Effect','Entrance animation','Text animation','Loop animation','Scroll animation','Follow the mouse'],'A new title opens on Content');
        await tp.click('[data-block="scroll"]');
        await tp.click('[data-select="0"]');
        assert.equal((await menuState())[6],'Scroll animation*','The block kept from layer to layer');
        // Padding (Size, 2026-11-09): a title has one, a photo filling the scene none; four sides linked; one side in % on its own; on the site.
        assert.equal(await tp.locator('#wpbn-block-position [data-pad-side]').count(),0,'A photo filling the scene: no Padding');
        await tp.click('[data-select="1"]');await tp.click('[data-block="position"]');
        assert.ok(await tp.locator('#wpbn-f-use_padding').count()===1 && await tp.locator('[data-pad-side]').count()===0,'Padding behind its switch: off, its sides hidden');
        await tp.click('label[for="wpbn-f-use_padding"]');
        await tp.fill('#wpbn-f-padding_top','20');
        const padOf=async()=>JSON.parse(await tp.locator('#wpbn-data').inputValue()).layers[1];
        let pd=await padOf();
        assert.ok(['top','right','bottom','left'].every(s=>pd['padding_'+s]===20) && await tp.locator('[data-pad-side="left"]').inputValue()==='20','Padding linked: one side sets all four');
        await tp.click('[data-pad-link]');await tp.click('[data-pad-unit="left"][data-unit="%"]');await tp.fill('#wpbn-f-padding_left','5');
        pd=await padOf();
        assert.ok(pd.padding_linked===false && pd.padding_left===5 && pd.padding_left_unit==='%' && pd.padding_top_unit==='px' && pd.padding_top===20,'Unlinked: the left side in % on its own');
        await tp.click('#wpbn-refresh');await tp.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const pdSite=await tp.frames().find(f=>f.name()==='wpbn_preview_frame').locator('.wpbn-layer--text').evaluate(el=>{const c=getComputedStyle(el),w=el.closest('.wpbn-scene').getBoundingClientRect().width;return c.paddingTop+' '+Math.round(parseFloat(c.paddingLeft)/w*100);});
        assert.equal(pdSite,'20px 5','On the site: 20px, the left 5 percent of the banner width');
        await tp.click('[data-select="0"]');
        // An image layer's device note is an "i" beside Image on every device, not the note above its blocks; a title keeps the note (not on desktop).
        assert.match(await tp.locator('[data-base="image"] .wpbn-field__head .wpbn-tip').getAttribute('data-tip'),/^Desktop values. Tablet and mobile follow them/,'Image on desktop: its tip too');
        await tp.click('[data-preview-device="tablet"]');await tp.click('[data-block="content"]');
        assert.ok(await tp.locator('#wpbn-settings .wpbn-device-note').count()===0 && /^Tablet values. Settings without a green dot follow Desktop/.test(await tp.locator('[data-base="image"] .wpbn-field__head .wpbn-tip').getAttribute('data-tip')),'Image: the device note in its tip');
        await tp.click('[data-select="1"]');
        assert.equal(await tp.locator('#wpbn-settings .wpbn-device-note').count(),1,'A title: the note above its blocks');
        await tp.click('[data-preview-device="desktop"]');
        await tp.close();
        // The eyedropper (2026-11-09): where the browser has one, beside the colour value; the colour picked, the opacity kept.
        const eye=await browser.newPage({viewport:{width:1600,height:1000}});eye.on('pageerror',e=>errors.push(e.message));
        await eye.addInitScript(()=>{window.EyeDropper=class{open(){return Promise.resolve({sRGBHex:'#ff8800'});}};});
        await eye.goto('http://127.0.0.1:'+server.address().port+'/');
        await eye.click('#wpbn-add-toggle');await eye.click('.wpbn-modal--add [data-add="overlay"]');
        await eye.click('#wpbn-f-color');
        await eye.waitForSelector('.wpbn-pcr.visible .wpbn-pcr__dropper');
        assert.ok(await eye.evaluate(()=>{const r=document.querySelector('.wpbn-pcr.visible .pcr-result').getBoundingClientRect(),d=document.querySelector('.wpbn-pcr.visible .wpbn-pcr__dropper').getBoundingClientRect();return Math.abs(r.top-d.top)<2 && d.left>=r.right;}),'The eyedropper beside the colour value');
        await eye.click('.wpbn-pcr.visible .wpbn-pcr__dropper');
        await eye.waitForFunction(()=>{const l=JSON.parse(document.getElementById('wpbn-data').value).layers;return l[l.length-1].color.replace(/s/g,'')==='rgba(255,136,0,0.4)';});
        await eye.close();
        // Without one (Firefox, Safari): no button.
        const noEye=await browser.newPage({viewport:{width:1600,height:1000}});noEye.on('pageerror',e=>errors.push(e.message));
        await noEye.addInitScript(()=>{delete window.EyeDropper;});
        await noEye.goto('http://127.0.0.1:'+server.address().port+'/');
        await noEye.click('#wpbn-add-toggle');await noEye.click('.wpbn-modal--add [data-add="overlay"]');
        await noEye.click('#wpbn-f-color');await noEye.waitForSelector('.wpbn-pcr.visible');
        assert.equal(await noEye.locator('.wpbn-pcr__dropper').count(),0,'No eyedropper where the browser has none');
        await noEye.close();
        // A Shape layer (WPBN_Shape): an SVG uploaded, its objects under the layer, one chosen in the drawing; Fill Photo shows
        // the photo through it, in colour over its black and white self; glass greys Edge and Filters (not hidden).
        const sh=await browser.newPage({viewport:{width:1600,height:1000}});sh.on('pageerror',e=>errors.push(e.message));
        await sh.goto('http://127.0.0.1:'+server.address().port+'/?image');
        const shData=async()=>JSON.parse(await sh.locator('#wpbn-data').inputValue());
        await sh.click('[data-select="0"]');
        await sh.fill('#wpbn-f-f_grayscale','100');
        await sh.click('#wpbn-add-toggle');await sh.click('.wpbn-modal--add [data-add="shape"]');
        const [chooser]=await Promise.all([sh.waitForEvent('filechooser'),sh.click('[data-action="shape-upload"]')]);
        await chooser.setFiles({name:'strips.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
        await sh.waitForSelector('.wpbn-object-row');
        let sd=await shData();
        assert.deepEqual(sd.layers[1].shape_objects.map(o=>o.name),['Object 2','Object 3','Left strip'],'Objects without a name numbered in reading order, the file\'s names kept');
        assert.ok(sd.layers[0].uid && sd.layers[1].shape_objects.every(o=>o.fill==='layer' && o.source===sd.layers[0].uid),'New objects show the photo layer');
        assert.equal(await sh.locator('.wpbn-object-row').count(),3,'Its objects under the layer');
        // The Shape block: its name and SVG only; the drawing above the menu (left), not in the settings.
        assert.equal(await sh.locator('#wpbn-settings .wpbn-shape-canvas').count(),0,'No drawing in the settings');
        assert.ok(await sh.locator('#wpbn-objects .wpbn-shape-canvas').isVisible(),'The drawing above the menu');
        await sh.click('#wpbn-menu [data-block="fit"]');
        await sh.locator('#wpbn-objects [data-object="0"] rect').click();
        assert.equal(await sh.locator('#wpbn-settings legend').textContent(),'Object','A click in the drawing opens the object\'s settings');
        assert.equal(await sh.locator('#wpbn-objects .wpbn-shape-object.is-active').getAttribute('data-object'),'0','The object being set marked in it');
        await sh.click('#wpbn-scene-settings');
        assert.ok(await sh.locator('#wpbn-objects').isHidden(),'No drawing for the scene or other layers');
        await sh.click('[data-select="1"]');await sh.locator('#wpbn-objects [data-object="0"] rect').click();
        await sh.click('[data-choice="fill"][data-value="glass"]');
        assert.ok(await sh.locator('#wpbn-f-use_shadow').isDisabled() && await sh.locator('#wpbn-f-f_grayscale').isDisabled() && !(await sh.locator('#wpbn-f-use_border').isDisabled()),'Glass: Shadow and Filters greyed, not hidden; a Border on it too');
        await sh.click('[data-choice="fill"][data-value="layer"]');
        // Effect (2026-11-10): Border (its Width beside its Color, as WP Swiper's Art SVG Shape), a rectangle's Radius.
        await sh.click('#wpbn-menu [data-block="effect"]');
        await sh.click('label[for="wpbn-f-use_border"]');
        await sh.fill('[data-shape-border]','6');
        assert.ok(await sh.locator('[data-shape-border]').evaluate(el=>document.querySelector('[data-key="border_style"]').closest('.wpbn-row').querySelector('[data-key="border_color"],.wpbn-color,[id="wpbn-f-border_color"]')!==null),'Line beside its Color');
        await sh.click('[data-choice="border_position"][data-value="outside"]');
        await sh.click('label[for="wpbn-f-use_radius"]');
        await sh.fill('#wpbn-f-radius_tl','30');
        assert.ok(await sh.locator('#wpbn-objects [data-object="0"] path').count()===1 && await sh.locator('#wpbn-objects [data-object="0"] rect').count()===0,'Its rounded corners in the drawing');
        // Its blocks in the layers' order; an Entrance animation of its own kinds; its box measured for it.
        assert.deepEqual(await sh.locator('#wpbn-menu [data-block]').evaluateAll(b=>b.map(x=>x.dataset.block)),['content','fill','effect','filters','entrance','loop','scroll'],'An object\'s blocks in the layers\' order');
        await sh.click('#wpbn-menu [data-block="loop"]');
        await sh.selectOption('#wpbn-f-anim_type','slide-x');
        assert.ok((await shData()).layers[1].shape_objects[0].use_anim && (await shData()).layers[1].shape_objects[0].anim_type==='slide-x','An object\'s Loop animation');
        await sh.click('#wpbn-menu [data-block="entrance"]');
        assert.ok((await sh.locator('#wpbn-f-enter_type option').allTextContents()).includes('Reveal from the left'),'Its own kinds');
        await sh.selectOption('#wpbn-f-enter_type','reveal-left');
        sd=await shData();
        assert.ok(sd.layers[1].shape_objects[0].use_enter && sd.layers[1].shape_objects[0].enter_type==='reveal-left' && sd.layers[1].shape_objects[0].box.join()==='400,200,200,600','Saved on the object, its box with it');
        const so0=sd.layers[1].shape_objects[0];
        assert.ok(so0.use_border && so0.border_width===6 && so0.border_position==='outside' && so0.radius_tl===30 && so0.radius_br===30 && sd.layers[1].border_width===undefined,'Border and Radius saved on the object, not the layer');
        // Fit (2026-11-10): Custom size shows its Size; a Position button on its tile at every Fit (Cover and Contain: which part shows, where it stands).
        await sh.click('[data-select="1"]');await sh.click('#wpbn-menu [data-block="fit"]');
        assert.equal(await sh.locator('[data-row-action="position"][data-index="1"]').count(),1,'Position for a Shape layer fitted to the scene too');
        // The whole Shape's motion (2026-11-10): its blocks in the layers' order; its Entrance the objects' kinds.
        assert.deepEqual(await sh.locator('#wpbn-menu [data-block]').evaluateAll(b=>b.map(x=>x.dataset.block)),['content','fit','entrance','loop','scroll','mouse'],'A Shape layer\'s blocks: its motion in the layers\' order');
        await sh.click('#wpbn-menu [data-block="entrance"]');
        assert.ok((await sh.locator('#wpbn-f-enter_type option').allTextContents()).includes('Reveal from the left'),'Its Entrance: the objects\' kinds');
        await sh.selectOption('#wpbn-f-enter_type','reveal-left');
        sd=await shData();
        assert.ok(sd.layers[1].use_enter && sd.layers[1].enter_type==='reveal-left','Saved on the layer');
        await sh.selectOption('#wpbn-f-enter_type','none');
        await sh.click('#wpbn-menu [data-block="fit"]');
        await sh.selectOption('#wpbn-f-shape_fit','custom');
        assert.ok(await sh.locator('#wpbn-f-shape_size').count()===1 && await sh.locator('[data-row-action="position"][data-index="1"]').count()===1,'Custom size: its Size, a Position button');
        // Its unit picked right after the number, before its reset; % keeps the size within 300.
        assert.equal(await sh.locator('.wpbn-field[data-base="shape_size"] .wpbn-number-pick + .wpbn-reset').count(),1,'px / % between the number and its reset');
        await sh.fill('#wpbn-f-shape_size','900');await sh.press('#wpbn-f-shape_size','Tab');
        await sh.click('.wpbn-number-pick [data-choice="shape_size_unit"][data-value="%"]');
        assert.ok(await sh.inputValue('#wpbn-f-shape_size')==='300' && await sh.getAttribute('.wpbn-number-pick [data-value="%"]','aria-pressed')==='true','In %: at most 300');
        await sh.click('.wpbn-number-pick [data-choice="shape_size_unit"][data-value="px"]');
        assert.equal(await sh.locator('#wpbn-f-shape-position').count(),0,'Placed only with the icon on its tile');
        await sh.click('[data-row-action="position"][data-index="1"]');
        assert.equal(await sh.locator('.wpbn-focus__stage .wpbn-position-shape svg').count(),1,'Placed in the Position window, drawn at its size');
        await sh.click('.wpbn-modal--position .wpbn-modal__cancel');
        // Dev mode (2026-11-10): the drawing's box, not the scene's; at a Custom size its distances and Position too.
        await sh.click('#wpbn-refresh');await sh.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        await sh.click('#wpbn-dev');await sh.frameLocator('#wpbn-frame').locator('.wpbn-dev__name--shape').waitFor();
        const shDev=await sh.frameLocator('#wpbn-frame').locator('.wpbn-scene').evaluate(s=>({name:s.querySelector('.wpbn-dev__name--shape').textContent,dims:s.querySelectorAll('.wpbn-dev__dimension').length}));
        assert.ok(/ · 300 × 300 · X 50% · Y 50%$/.test(shDev.name) && shDev.dims===4,'Dev mode: the Shape drawing at its size, its distances ('+JSON.stringify(shDev)+')');
        await sh.click('#wpbn-dev');
        await sh.selectOption('#wpbn-f-shape_fit','cover');
        await sh.click('#wpbn-refresh');await sh.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
        const shFrame=sh.frameLocator('#wpbn-frame');
        assert.equal(await shFrame.locator('.wpbn-shape-item').count(),3,'In the preview: an item per object');
        assert.match(await shFrame.locator('.wpbn-shape-clip').first().evaluate(el=>getComputedStyle(el).maskImage||getComputedStyle(el).webkitMaskImage),/^url\("data:image\/svg\+xml/,'Each clipped by its mask');
        assert.equal(await shFrame.locator('.wpbn-shape-clip .wpbn-layer--image img').first().evaluate(el=>getComputedStyle(el).filter),'none','The photo in colour through the object…');
        assert.match(await shFrame.locator('.wpbn-layer--image img').first().evaluate(el=>getComputedStyle(el).filter),/^grayscale/,'…over the photo in black and white');
        // Cover at its Position (2026-11-10): Y 0% shows the drawing's top, 100% its bottom (as background-position); the
        // Position window drags it so.
        const coverAt=async y=>{
            await sh.click('#wpbn-layers [data-row-action="position"][data-index="1"]');
            assert.match(await sh.locator('.wpbn-position-help').textContent(),/Cover/,'The Position window explains Cover');
            await sh.fill('#wpbn-pos-y',String(y));await sh.press('#wpbn-pos-y','Enter');
            await sh.click('#wpbn-refresh');await sh.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');
            await sh.click('#wpbn-dev');await shFrame.locator('.wpbn-dev__box--shape').waitFor();
            const box=await shFrame.locator('.wpbn-scene').evaluate(s=>{const b=s.querySelector('.wpbn-dev__box--shape');return {top:parseFloat(b.style.top),height:parseFloat(b.style.height),H:s.getBoundingClientRect().height};});
            await sh.click('#wpbn-dev');
            return box;
        };
        const top0=await coverAt(0), top100=await coverAt(100);
        assert.ok(top0.height>top0.H+10 && Math.abs(top0.top)<1 && Math.abs(top100.top-(top100.H-top100.height))<1 && (await shData()).layers[1].y===100,'Cover: Y 0% its top edge at the scene\'s, 100% its bottom ('+JSON.stringify([top0,top100])+')');
        await sh.close();
        // The preview's own size kept per scene in the browser (2026-11-11): typed, it is there after any reload or a save;
        // another scene (a new one: a post ID of its own) opens on the usual screens; emptied fields forget it.
        const ks=await browser.newPage({viewport:{width:1600,height:1000}});
        ks.on('pageerror',e=>errors.push(e.message));
        const ksReady=async()=>{await ks.waitForFunction(()=>document.querySelector('#wpbn-frame') && document.querySelector('#wpbn-frame').dataset.state==='done');};
        const ksWidth=()=>ks.locator('#wpbn-frame').evaluate(f=>f.contentWindow.innerWidth);
        await ks.goto('http://127.0.0.1:'+server.address().port);await ksReady();
        assert.equal(await ks.locator('#wpbn-res-w').inputValue(),'','A scene opened for the first time: the usual screen');
        await ks.fill('#wpbn-res-w','1000');await ks.fill('#wpbn-res-h','700');
        await ks.reload();await ksReady();
        assert.deepEqual([await ks.locator('#wpbn-res-w').inputValue(),await ks.locator('#wpbn-res-h').inputValue(),await ksWidth()],['1000','700',1000],'Reloaded: the preview keeps its own size');
        await ks.reload();await ksReady();
        assert.equal(await ksWidth(),1000,'And again');
        assert.deepEqual(await ks.evaluate(()=>Object.keys(localStorage).filter(k=>/^wpbn-preview-sizes/.test(k))),['wpbn-preview-sizes-7'],'Kept for this scene only');
        // Another scene (here: the stored size moved to another post ID, as a new scene would have none).
        await ks.evaluate(()=>{localStorage.setItem('wpbn-preview-sizes-8',localStorage.getItem('wpbn-preview-sizes-7'));localStorage.removeItem('wpbn-preview-sizes-7');});
        await ks.reload();await ksReady();
        assert.deepEqual([await ks.locator('#wpbn-res-w').inputValue(),await ksWidth()],['',1280],'Another scene\'s size not taken: the usual screen');
        await ks.fill('#wpbn-res-w','900');await ks.fill('#wpbn-res-w','');
        await ks.reload();await ksReady();
        assert.equal(await ks.evaluate(()=>localStorage.getItem('wpbn-preview-sizes-7')),null,'Emptied: forgotten');
        await ks.close();
        // Attached to another layer (2026-11-13): a button under a title, attached where it stands; it keeps its distance as the
        // title grows; dragged in the preview (Move), its distance changes.
        const at=await browser.newPage({viewport:{width:1600,height:1000}});at.on('pageerror',e=>errors.push(e.message));
        await at.goto('http://127.0.0.1:'+server.address().port);
        const atData=async()=>JSON.parse(await at.locator('#wpbn-data').inputValue());
        const atUpdate=async()=>{await at.click('#wpbn-refresh');await at.waitForFunction(()=>document.querySelector('#wpbn-frame').dataset.state==='done');};
        const atFrame=()=>at.frames().find(f=>f.name()==='wpbn_preview_frame');
        const atPlace=async(i,y)=>{await at.click('[data-select="'+i+'"]');await at.click(POS);await at.fill('#wpbn-pos-y',String(y));await at.press('#wpbn-pos-y','Enter');};
        for (const type of ['text','button']) { await at.click('#wpbn-add-toggle');await at.click('.wpbn-modal--add [data-add="'+type+'"]'); }
        await atPlace(0,30);await atPlace(1,70);
        await at.click('[data-select="1"]');
        const titleUid=(await atData()).layers[0].uid;
        assert.ok(await at.locator('#wpbn-f-anchor option[value="'+titleUid+'"]').count()===1 && await at.locator('#wpbn-f-anchor').inputValue()==='','Attached to: the other layers, None to start with');
        await atUpdate();
        const atBoxes=()=>atFrame().evaluate(()=>{const r=e=>e.getBoundingClientRect();const t=document.querySelector('.wpbn-layer--text'),b=document.querySelector('.wpbn-layer--button');return {t:[r(t).top,r(t).bottom],b:[r(b).left,r(b).top]};});
        const atBefore=await atBoxes();
        await at.selectOption('#wpbn-f-anchor',titleUid);
        await at.waitForFunction(()=>JSON.parse(document.getElementById('wpbn-data').value).layers[1].anchor!=='',null,{timeout:20000});
        const atBtn=(await atData()).layers[1];
        assert.ok(atBtn.anchor===titleUid && ['anchor_desktop','anchor_tablet','anchor_mobile'].every(k=>Array.isArray(atBtn[k]) && atBtn[k][0]===50 && atBtn[k][1]===100 && atBtn[k][2]===50 && atBtn[k][3]===0 && atBtn[k][5]>0),'Attached: under the title on every device, its top to the title\'s bottom, centred ('+JSON.stringify([atBtn.anchor_desktop,atBtn.anchor_tablet,atBtn.anchor_mobile])+')');
        assert.match(await at.locator('#wpbn-attach-note').textContent(),/follows/,'It says what it follows');
        await atUpdate();
        const atAttached=await atBoxes();
        assert.ok(Math.abs(atAttached.b[0]-atBefore.b[0])<1.5 && Math.abs(atAttached.b[1]-atBefore.b[1])<1.5,'It stays where it stood ('+JSON.stringify([atBefore.b,atAttached.b])+')');
        // The title on two lines: the button goes down with its bottom.
        await at.click('[data-select="0"]');await at.fill('[data-key="text"]','YOUR\nTITLE');
        await atUpdate();
        const atTaller=await atBoxes();
        assert.ok(atTaller.t[1]-atTaller.t[0]>(atAttached.t[1]-atAttached.t[0])*1.5 && Math.abs((atTaller.b[1]-atTaller.t[1])-(atAttached.b[1]-atAttached.t[1]))<1.5,'The title wraps: the button keeps its distance to its bottom');
        // The title travels as the page scrolls: the button goes with it.
        await at.click('[data-select="0"]');await at.fill('[data-key="move_y"]','-100');
        await atUpdate();
        const atRest=await atBoxes();
        await atFrame().waitForFunction(()=>typeof window.wpbnPreviewProgress==='function');
        await at.locator('#wpbn-progress').evaluate(el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true}));});
        const atScrolled=await atBoxes();
        assert.ok(atScrolled.t[0]<atRest.t[0]-50 && Math.abs((atScrolled.b[1]-atRest.b[1])-(atScrolled.t[0]-atRest.t[0]))<1.5,'The title travels: the button with it ('+JSON.stringify([atRest,atScrolled])+')');
        await at.locator('#wpbn-progress').evaluate(el=>{el.value=0;el.dispatchEvent(new Event('input',{bubbles:true}));});
        // Its tile's Position: Move in the preview; dragged, its distance there.
        await at.click('[data-select="1"]');
        assert.match(await posTip(at),/^Attached to /,'Its Position: says it moves in the preview');
        await at.click(POS);
        assert.equal(await at.locator('#wpbn-move').getAttribute('aria-pressed'),'true','Its Position turns Move on');
        await atFrame().locator('#wpbn-move').waitFor();
        const atVb=await atFrame().locator('#wpbn-move').boundingBox();
        await at.mouse.move(atVb.x+atVb.width/2,atVb.y+atVb.height/2);await at.mouse.down();await at.mouse.move(atVb.x+atVb.width/2,atVb.y+atVb.height/2+30,{steps:4});await at.mouse.up();
        const atMoved=(await atData()).layers[1];
        assert.ok(atMoved.anchor_desktop[5]>atBtn.anchor_desktop[5]+5 && atMoved.anchor_tablet[5]===atBtn.anchor_tablet[5],'Dragged down: its distance on Desktop only');
        await at.selectOption('#wpbn-f-anchor','');
        assert.ok((await atData()).layers[1].anchor==='' && (await atData()).layers[1].anchor_desktop===null,'None: placed by its own Position again');
        await at.close();
        assert.deepEqual(errors,[]);
        console.log('Browser checks passed: layer editing, order, hide/delete, switches, reset, preview (own size, page), rotation, responsive sizes, motion, opacity at the end, reduced motion and reverse scroll, animation, undo / redo, follow the mouse, text width, layer names, layer rotation, entrance animation, tips, settings tabs, shape layers.');
    } finally {if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
