(function () {
    'use strict';
    const app = document.getElementById('wpbn-app');
    if (!app) return;
    const boot = JSON.parse(document.getElementById('wpbn-boot').textContent);
    const scene = boot.scene;
    // A layer's own name for others to point to (a Shape object showing its photo: WPBN_Shape): a letter, then 7 more.
    const newUid = () => 'l' + (Math.random().toString(36) + '0000000').slice(2, 9);
    // Layers from before it (or copied from elsewhere): one each, unique.
    const uids = new Set();
    scene.layers.forEach(l => { if (!l.uid || uids.has(l.uid)) l.uid = newUid(); uids.add(l.uid); });
    const images = boot.images;
    const icons = boot.icons;
    const imageInfo = boot.imageInfo || {};
    // The kinds of element "Add element" offers (a tile each in the settings column): icon, name, what it is for.
    const ELEMENTS = {
        image: ['format-image', 'Image', 'A photo, or a transparent cutout in front of the title.'],
        text: ['editor-textcolor', 'Title', 'The banner\'s title, between the image layers (behind a cutout, for the mountain effect).'],
        richtext: ['editor-paragraph', 'Text', 'Paragraphs and headings under or beside the title: bold, italic, underline, colors, alignment, lists and links.'],
        shortcode: ['shortcode', 'Shortcode', 'Another plugin\'s element by its shortcode, e.g. a slider: [wp_swiper id="12"]. It takes its place among the layers.'],
        button: ['button', 'Button', 'A button with a link, e.g. "Learn more" under the title.'],
        overlay: ['image-filter', 'Overlay', 'A color or gradient over the scene (or a band of it), over the layers under it: e.g. the photo shaded under the title.'],
        shape: ['art', 'Shape', 'An SVG with several objects (strips, a torn edge, a heart…): each object becomes a window onto a photo, a color or frosted glass.']
    };
    // richtext: the Text element (text is the Title's key).
    const TYPE_NAMES = {image:'Image', text:'Title', overlay:'Overlay', richtext:'Text', button:'Button', shortcode:'Shortcode', shape:'Shape'};
    // Title, Text and Button (WPBN_Settings::textual()): as wide as their content, at 100% scale and opacity.
    const textual = l => l.type === 'text' || l.type === 'richtext' || l.type === 'button' || l.type === 'shortcode';
    // A button's Size: WoodMart's presets (WPBN_Settings::BUTTON_SIZES): side padding, height, font size (px).
    const BUTTON_SIZES = {'extra-small':['Extra Small', 10, 28, 11], small:['Small', 14, 36, 12], default:['Default', 20, 42, 13], large:['Large', 28, 48, 14], 'extra-large':['Extra Large', 40, 56, 16]};
    // An overlay has no Scale or Opacity (WPBN_Settings::effective()); since 2026-11-10 it travels and zooms with the scroll
    // (an overlay smaller than the scene). Its Container, Position and Height are its own.
    const OVERLAY_FIXED = {scale:100, opacity:100};
    // Placed as a title is: its Position also its own point there (0% flush left / top, 100% right / bottom), within its container.
    // An image layer with Fill the scene off (WPBN_Settings::object()): an object with its own Width and Height, placed as a title.
    const imageObject = l => l.type === 'image' && l.fill_scene === false;
    const anchored = l => textual(l) || l.type === 'overlay' || imageObject(l);
    // A field with its help behind an "i" beside the label (the dark tooltip), instead of under it.
    const withTip = (html, text) => html.replace('</label>', '</label>' + tip(text));
    // dev: Developer mode in the preview (preview-dev.js), kept as the preview is redrawn.
    let selected = -1, dark = false, dev = false;
    // A Shape layer's SVGs by attachment id (WPBN_Shape::editor()); the object chosen in the selected Shape layer
    // (-1: none); an upload under way and why the last one failed.
    const shapes = boot.shapes || {};
    let selectedObject = -1, shapeBusy = false, shapeError = '';
    // Undo and Redo (remember(), below): the scene after each change, the changes undone, the pause before a change is kept.
    const HISTORY_MAX = 100, HISTORY_PAUSE = 400;
    let history = [JSON.stringify(scene)], future = [], historyTimer = 0;
    const turned = {};
    const drawings = {
        desktop: {file:'desktop.svg',width:1000.2,height:793.1,screen:[22.89,23.39,954.91,537.91],radius:0},
        tablet: {file:'tablet.svg',width:1379.63,height:1789.88,screen:[78.02,84.23,1214.8,1631.04],radius:17.15},
        mobile: {file:'phone.svg',width:213.04,height:429.61,screen:[12.01,10.13,188.99,409.35],radius:24.05}
    };
    const DEVICES = {desktop:['desktop','Desktop'], tablet:['tablet','Tablet'], mobile:['smartphone','Mobile']};
    const $ = id => document.getElementById('wpbn-' + id);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const device = () => $('device').value;
    // What the fields edit: the scene, the selected layer or, in a Shape layer, its chosen object (its fields use the
    // same helpers: their keys are the object's).
    const current = () => {
        if (selected < 0) return scene;
        const l = scene.layers[selected], o = l && l.type === 'shape' && selectedObject >= 0 ? (l.shape_objects || [])[selectedObject] : null;
        return o || l;
    };
    function sync() { $('data').value = JSON.stringify(scene); }
    // Per-device layer settings, as in WP Swiper: desktop always has a value;
    // tablet and mobile null = the larger screen's (mobile → tablet → desktop).
    const UP = {tablet:'desktop', mobile:'tablet'};
    const dkey = (base, d) => d === 'desktop' ? base : base + '_' + d;
    // Settings with a switch (as WPBN_Settings::OPTIONAL): they apply only with it on; off, they have their value at rest.
    // base: [switch, value when off, image layers only].
    // An image layer's Width is always the scene's (100%), as WPBN_Settings::effective().
    const OPTIONAL = {scale:['use_scale', 100, true], opacity:['use_opacity', 100, true], rotate:['use_rotate', 0, false],
        move_x:['use_move_x', 0, false], move_y:['use_move_y', 0, false], zoom:['use_zoom', 0, false],
        // Off: the layer keeps its Opacity to the end.
        end_opacity:['use_end_opacity', null, false]};
    const switched = (l, base) => !!OPTIONAL[base] && (l.type === 'image' || !OPTIONAL[base][2]);
    function eff(l, base, d) {
        // Every layer is as wide as its container (WPBN_Settings::effective()).
        if (base === 'width') return 100;
        // A title or a text has no Scale and no Opacity (WPBN_Settings::effective()).
        if (textual(l) && (base === 'scale' || base === 'opacity')) return 100;
        if (l.type === 'overlay' && base in OVERLAY_FIXED) return OVERLAY_FIXED[base];
        if (switched(l, base) && !l[OPTIONAL[base][0]]) return OPTIONAL[base][1] === null ? eff(l, 'opacity', d) : OPTIONAL[base][1];
        while (d !== 'desktop' && (l[dkey(base, d)] === null || l[dkey(base, d)] === undefined)) d = UP[d];
        return l[dkey(base, d)];
    }
    /*
     * The standard settings (user's request, 2026-11-09: a green dot on the desktop icon where the desktop value is not one of
     * them): a layer's as a new one of its kind has them (addLayer() takes them from here), the scene's as a new scene's; a Loop
     * animation's start and end its kind's own.
     */
    const TYPE_NEW = {text:{container:'theme'}, button:{container:'theme'}, shortcode:{container:'theme'}, overlay:{color:boot.overlayColor || 'rgba(0,0,0,0.4)'},
        richtext:{content:'<p>Your text here.</p>', font_size:18, font_weight:400, container:'theme'}};
    const standard = o => o === scene ? (boot.sceneDefaults || {}) : Object.assign({}, boot.layer, {container:'full', move_y:0}, TYPE_NEW[o.type] || {});
    function isStandard(o, key) {
        let def = standard(o)[key];
        if ((key === 'anim_from' || key === 'anim_to') && ANIM && ANIM.types[o.anim_type]) def = ANIM.types[o.anim_type].def[key === 'anim_from' ? 0 : 1];
        return String(o[key] ?? '') === String(def ?? '');
    }
    const ownValues = (l, base) => ({desktop: !isStandard(l, base), tablet: l[dkey(base, 'tablet')] != null, mobile: l[dkey(base, 'mobile')] != null});

    // Fields, as WP Swiper draws them: a label row (with the device icons for
    // per-device values), the control, a help text; grouped in grey cards.
    const card = (title, body) => '<div class="wpbn-card"><p class="wpbn-subheading">' + title + '</p>' + body + '</div>';
    const note = text => text ? '<p class="description">' + text + '</p>' : '';
    const head = (id, label, extra) => '<div class="wpbn-field__head"><label for="' + id + '">' + label + '</label>' + (extra || '') + '</div>';
    // own: {tablet, mobile} true where that device has a value of its own (a green dot, as in WP Swiper).
    function devices(own) {
        return '<span class="wpbn-devices" role="group" aria-label="Device">' + Object.entries(DEVICES).map(([d, [icon, name]]) =>
            '<button type="button" class="wpbn-devices__btn' + (d === device() ? ' is-active' : '') + (own && own[d] ? ' has-value' : '') + '" data-field-device="' + d + '" aria-pressed="' + (d === device()) + '" aria-label="' + name + '" title="' + name + '"><span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span></button>').join('') + '</span>';
    }
    // Reset, beside each slider, for the device being edited only. Desktop: back to the
    // default below. Tablet / mobile: its own value cleared, so it follows the larger screen again.
    const DEFAULTS = {width:100, scale:100, opacity:100, move_x:0, move_y:0, zoom:0, end_opacity:100,
        font_size:boot.layer.font_size, tablet_font_size:boot.layer.tablet_font_size, mobile_font_size:boot.layer.mobile_font_size,
        anim_from:boot.layer.anim_from, anim_to:boot.layer.anim_to, anim_duration:boot.layer.anim_duration, anim_delay:boot.layer.anim_delay, mouse:boot.layer.mouse,
        // Filters (an image layer's, a Shape object's) at rest, and a Shape object's Edge and frosted glass.
        rotate:0, enter_distance:60, enter_scale:80, enter_duration:1, enter_delay:0, f_grayscale:0, f_blur:0, f_brightness:100, f_contrast:100, f_saturate:100, backdrop_blur:0, button_icon_size:16, button_icon_gap:8, stroke:0, glass_blur:12};
    // Is there something to reset? key: the stored key on this device; base: a per-device setting's name (null for a key of its own).
    function canReset(l, key, base) {
        if (base && key !== base) return l[key] != null;
        return Number(l[key]) !== Number(DEFAULTS[base || key]);
    }
    function resetButton(l, key, base, label) {
        const d = device(), follows = base && d !== 'desktop';
        const title = follows ? 'Reset: follow ' + DEVICES[UP[d]][1] : 'Reset to default (' + DEFAULTS[base || key] + ')';
        return '<button type="button" class="wpbn-icon-button wpbn-reset" data-reset="' + key + '"' + (base ? ' data-reset-base="' + base + '"' : '') + ' title="' + title + '" aria-label="' + escape(label) + ' — ' + title + '"' + (canReset(l, key, base) ? '' : ' disabled') + '>' + icons.reset + '</button>';
    }
    function refreshReset(fieldEl) {
        const button = fieldEl && fieldEl.querySelector('[data-reset]');
        if (button) button.disabled = !canReset(current(), button.dataset.reset, button.dataset.resetBase || null);
    }
    // A per-device slider and number. On tablet / mobile an empty number takes the larger screen's value (its placeholder).
    function respRange(base, label, o) {
        const l = current(), d = device(), key = dkey(base, d), own = l[key], value = escape(eff(l, base, d)), id = 'wpbn-f-' + key;
        // o.note: a help text under it; o.tip: behind an "i" beside its label.
        const html = '<div class="wpbn-field" data-base="' + base + '">' + head(id, label, devices(ownValues(l, base))) + '<div class="wpbn-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="' + (o.step || 1) + '" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" value="' + (own == null ? '' : escape(own)) + '" placeholder="' + value + '" aria-label="' + label + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '>'
            + resetButton(l, key, base, label) + '</div>' + note(o.note) + '</div>';
        return o.tip ? withTip(html, o.tip) : html;
    }
    // A per-device select. extra: more of the field after the select (as its own children).
    function respSelect(base, label, options, extra) {
        const l = current(), d = device(), key = dkey(base, d), own = l[key], id = 'wpbn-f-' + key;
        const inherit = d === 'desktop' ? '' : '<option value="">Same as ' + DEVICES[UP[d]][1] + ' (' + options[eff(l, base, UP[d])] + ')</option>';
        return '<div class="wpbn-field" data-base="' + base + '">' + head(id, label, devices(ownValues(l, base))) + '<select id="' + id + '" data-key="' + key + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '>' + inherit
            + Object.entries(options).map(([value, text]) => '<option value="' + value + '"' + (own === value ? ' selected' : '') + '>' + text + '</option>').join('') + '</select>' + (extra || '') + '</div>';
    }
    function refreshDots(fieldEl) {
        if (!fieldEl || !fieldEl.dataset.base) return;
        const own = ownValues(current(), fieldEl.dataset.base);
        fieldEl.querySelectorAll('[data-field-device]').forEach(b => b.classList.toggle('has-value', !!own[b.dataset.fieldDevice]));
    }
    function field(key, label, type, help) {
        const id = 'wpbn-f-' + key;
        return '<div class="wpbn-field">' + head(id, label) + '<input id="' + id + '" data-key="' + key + '" type="' + (type || 'text') + '" value="' + escape(current()[key]) + '">' + note(help) + '</div>';
    }
    // A slider beside its number. keys: one key, or one per device ({desktop, tablet, mobile}).
    // The slider may cover a narrower span (from / to) than the number allows.
    function range(keys, label, o) {
        const perDevice = typeof keys !== 'string';
        const key = perDevice ? keys[device()] : keys, id = 'wpbn-f-' + key, value = escape(current()[key]);
        const html = '<div class="wpbn-field">' + head(id, label, perDevice ? devices() : '') + '<div class="wpbn-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="' + (o.step || 1) + '" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" value="' + value + '">'
            + (key in DEFAULTS ? resetButton(current(), key, null, label) : '') + '</div>' + note(o.note) + '</div>';
        return o.tip ? withTip(html, o.tip) : html;
    }
    function select(key, label, options, help) {
        const id = 'wpbn-f-' + key;
        return '<div class="wpbn-field">' + head(id, label) + '<select id="' + id + '" data-key="' + key + '">' + Object.entries(options).map(([value, text]) => '<option value="' + value + '"' + (String(current()[key]) === value ? ' selected' : '') + '>' + text + '</option>').join('') + '</select>' + note(help) + '</div>';
    }
    function textarea(key, label, help) {
        const id = 'wpbn-f-' + key;
        return '<div class="wpbn-field">' + head(id, label) + '<textarea id="' + id + '" data-key="' + key + '" rows="2">' + escape(current()[key]) + '</textarea>' + note(help) + '</div>';
    }
    /*
     * Every color field, as WP Swiper's: a swatch (the color over a checkerboard, so a see-through
     * one shows as such) that opens Pickr: the color, hue, opacity (o.alpha), the palette (the
     * theme's colors, black, white and greys: WPBN_Palette), HEX / RGB / HSL, Cancel (back to the
     * color it had when opened) and Default (o.def). Kept in its hidden input (data-key) as
     * "#rrggbb", or "rgba(r,g,b,a)" below full opacity (WPBN_Settings::color() checks it again).
     * o.def may be '' (a color that comes from elsewhere, as the theme's): the field is then empty
     * and its swatch shows o.fallback, the color it stands for.
     */
    function colorField(key, label, o) {
        const id = 'wpbn-f-' + key, value = current()[key] || '', color = parseColor(value) || parseColor(o.fallback) || parseColor(o.def) || {hex:'#000000', alpha:100};
        return '<div class="wpbn-field">' + head(id, label) + '<span class="wpbn-color" data-alpha="' + (o.alpha ? 1 : 0) + '" data-default="' + escape(o.def) + '" data-fallback="' + escape(o.fallback || '') + '">'
            + '<input type="hidden" data-key="' + key + '" value="' + escape(value) + '">'
            + '<button type="button" class="wpbn-color__swatch" id="' + id + '" aria-expanded="false"><span class="wpbn-color__chip" aria-hidden="true" style="box-shadow:inset 0 0 0 60px ' + escape(colorValue(color.hex, color.alpha)) + '"></span></button></span>' + note(o.note) + '</div>';
    }
    // "#rgb", "#rrggbb" or "rgba(r,g,b,a)" as {hex, alpha 0–100}; null for anything else.
    function parseColor(value) {
        value = String(value || '').replace(/\s+/g, '').toLowerCase();
        const m = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d*\.?\d+)\)$/.exec(value);
        if (m) return {hex:'#' + [m[1], m[2], m[3]].map(c => ('0' + Math.min(255, parseInt(c, 10)).toString(16)).slice(-2)).join(''), alpha:Math.round(Math.min(1, parseFloat(m[4])) * 100)};
        if (/^#[0-9a-f]{3}$/.test(value)) value = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
        return /^#[0-9a-f]{6}$/.test(value) ? {hex:value, alpha:100} : null;
    }
    function colorValue(hex, alpha) {
        return alpha >= 100 ? hex : 'rgba(' + [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)).join(',') + ',' + (alpha / 100) + ')';
    }
    // The picker: one at a time, made on the first click of a swatch (in the body, as Pickr puts it).
    const PALETTE = (boot.palette || []).filter(entry => /^#[0-9a-f]{6}$/.test(entry.color));
    let colorPicker = null;
    function closePicker() {
        if (!colorPicker) return;
        const root = colorPicker.getRoot();
        colorPicker.destroy();
        if (root && root.app) root.app.remove();
        if (colorPicker.wpbnButton) colorPicker.wpbnButton.setAttribute('aria-expanded', 'false');
        colorPicker = null;
    }
    // The eyedropper's icon: a pipette (pipette.svg, in the button's colour; the viewBox cropped to the drawing).
    const EYEDROPPER = '<svg viewBox="314 314 380 380" aria-hidden="true" focusable="false" fill="currentColor">'
        + '<rect x="480.78" y="406.64" width="177.31" height="63.87" rx="31.93" ry="31.93" transform="translate(476.9 -274.19) rotate(45)"/>'
        + '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="20" d="M621.5,373.23c7.35-7.35,19.25-7.35,26.6,0"/>'
        + '<path d="M653.93,354.08c13.82,13.82,13.82,36.32,0,50.15l-194.31,194.31c-8.98,8.98-22.19,12.47-34.48,9.11l-11.21-3.06-57.7,57.7c-2.72,2.72-7.13,2.72-9.84,0-3.08-3.08-3.08-8.1,0-11.17l57.04-57.04-3.06-11.21c-3.37-12.29.13-25.5,9.11-34.48l194.31-194.31c13.82-13.82,36.32-13.82,50.15,0M668.07,339.94h0c-21.66-21.66-56.77-21.66-78.43,0l-194.31,194.31c-14.6,14.6-19.35,35.31-14.26,53.9l-48.82,48.82c-10.9,10.9-10.9,28.56,0,39.46h0c10.53,10.53,27.6,10.53,38.13,0l49.48-49.48c18.59,5.08,39.3.34,53.9-14.26l194.31-194.31c21.66-21.66,21.66-56.77,0-78.43h0Z"/>'
        + '</svg>';
    function openPicker(button) {
        if (!window.Pickr) return;
        if (colorPicker && colorPicker.wpbnButton === button) return;
        closePicker();
        const box = button.closest('.wpbn-color'), input = box.querySelector('input'), alpha = box.dataset.alpha === '1';
        let syncing = false;
        let opened = input.value;
        // The color shown: the field's, or (empty) the one it stands for.
        const now = () => parseColor(input.value) || parseColor(box.dataset.fallback) || parseColor(box.dataset.default) || {hex:'#000000', alpha:100};
        // What is chosen ('' for an empty field): into the swatch and its input (the preview's Update and saving take it as any other change).
        const store = value => {
            if (input.value === value) return;
            input.value = value;
            const c = now();
            button.firstChild.style.boxShadow = 'inset 0 0 0 60px ' + colorValue(c.hex, c.alpha);
            input.dispatchEvent(new Event('input', {bubbles:true}));
        };
        // Into Pickr (no event of its own), in the format it shows; Cancel goes back to it.
        const show = () => {
            const c = now(), shown = colorPicker.getColorRepresentation() || 'HEXA';
            syncing = true; colorPicker.setColor(colorValue(c.hex, c.alpha), true); colorPicker.setColorRepresentation(shown); syncing = false;
            colorPicker.applyColor(true);
        };
        // From Pickr: only a new color counts (its format buttons say "change" too).
        const fromPickr = color => {
            if (!color || syncing) return;
            const rgba = color.toRGBA();
            const hex = '#' + [0, 1, 2].map(i => ('0' + Math.max(0, Math.min(255, Math.round(rgba[i]))).toString(16)).slice(-2)).join('');
            const value = colorValue(hex, alpha ? Math.max(0, Math.min(100, Math.round(rgba[3] * 100))) : 100), c = now();
            // The color already shown (an empty field's too): nothing new.
            if (value !== colorValue(c.hex, c.alpha)) store(value);
        };
        const c = now();
        colorPicker = window.Pickr.create({
            el: button, useAsButton: true, theme: 'classic', appClass: 'wpbn-pcr', position: 'bottom-start',
            default: colorValue(c.hex, c.alpha), defaultRepresentation: 'HEXA', lockOpacity: !alpha,
            swatches: PALETTE.map(entry => entry.color),
            i18n: {'ui:dialog':'Color picker', 'btn:toggle':'Choose a color', 'btn:swatch':'Color', 'btn:cancel':'Cancel', 'aria:btn:cancel':'Back to the color it had when opened',
                'aria:input':'Color value', 'aria:palette':'Color and brightness', 'aria:hue':'Hue', 'aria:opacity':'Opacity'},
            components: {preview:false, opacity:alpha, hue:true, interaction:{hex:true, rgba:true, hsla:true, input:true, cancel:true}}
        });
        colorPicker.wpbnButton = button;
        // Pickr fits its window into the page, not the screen: near the bottom of the screen it would open
        // below it, cut off (its window does not scroll). Then above the swatch, where there is room.
        const place = colorPicker._rePositioningPicker;
        if (typeof place === 'function') colorPicker._rePositioningPicker = function () {
            place.apply(this, arguments);
            const box = this._root && this._root.app;
            if (!box) return;
            const r = box.getBoundingClientRect(), b = button.getBoundingClientRect();
            if (r.bottom > innerHeight - 8 && b.top - r.height - 8 >= 8) box.style.top = (b.top - r.height - 8) + 'px';
        };
        colorPicker.on('init', instance => {
            const root = instance.getRoot().app;
            // The palette's names on hover.
            root.querySelectorAll('.pcr-swatches > button').forEach((swatch, i) => { if (PALETTE[i]) { swatch.title = PALETTE[i].name; swatch.setAttribute('aria-label', PALETTE[i].name); } });
            // Default, after Cancel: red, as Pickr's own Clear (classic theme).
            const reset = document.createElement('input');
            reset.type = 'button'; reset.className = 'pcr-clear wpbn-pcr__default'; reset.value = 'Default'; reset.setAttribute('aria-label', 'Back to the default color');
            reset.addEventListener('click', () => { store(box.dataset.default); show(); });
            root.querySelector('.pcr-interaction').append(reset);
            // The eyedropper (2026-11-09): beside the colour's value, where the browser has one (Chrome, Edge, Opera; not Firefox or
            // Safari): a colour from anywhere on the screen, e.g. the photo in the preview; the field's opacity kept; Esc: no change.
            if (window.EyeDropper) {
                const drop = document.createElement('button'), result = root.querySelector('.pcr-result'), line = document.createElement('span');
                drop.type = 'button'; drop.className = 'wpbn-pcr__dropper'; drop.title = 'Pick a color from the screen'; drop.setAttribute('aria-label', 'Pick a color from the screen');
                drop.innerHTML = EYEDROPPER;
                line.className = 'wpbn-pcr__break';
                drop.addEventListener('click', () => {
                    new window.EyeDropper().open().then(picked => {
                        const v = String(picked && picked.sRGBHex || ''), m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
                        const c = m ? {hex:'#' + [m[1], m[2], m[3]].map(x => ('0' + Math.min(255, Number(x)).toString(16)).slice(-2)).join('')} : parseColor(v);
                        if (!c) return;
                        store(colorValue(c.hex, alpha ? now().alpha : 100)); show();
                    }).catch(() => { /* Esc, or the page left: nothing changes. */ });
                });
                result.after(drop, line);
            }
            instance.show();
        });
        colorPicker.on('show', () => { opened = input.value; show(); button.setAttribute('aria-expanded', 'true'); });
        colorPicker.on('hide', () => button.setAttribute('aria-expanded', 'false'));
        colorPicker.on('change', fromPickr);
        // Cancel: the field as it was when opened (an empty one empty again).
        colorPicker.on('cancel', instance => { store(opened); instance.hide(); });
    }
    app.addEventListener('click', event => {
        const button = event.target.closest('.wpbn-color__swatch');
        if (button) openPicker(button);
    });

    /*
     * An overlay's Gradient, as WP Swiper's (its editor as WoodMart's; WPBN_Gradient checks it again): its
     * type and where it starts (or its middle); the gradient as a bar, its colours' points under it: a
     * click on the bar adds one (the colour there), a point is dragged along it (or moved with the arrow
     * keys; Delete removes it); the chosen one's colour (the colour block, with opacity) and Delete.
     * Kept in the layer as "type;where;colour@position;…", in order of the positions.
     */
    const GRADIENT_STOPS = 10;
    const GRADIENT_DEFAULT = boot.layer.gradient;
    const OVERLAY_COLOR = boot.overlayColor || 'rgba(0,0,0,0.4)';
    let gradientChosen = 0;
    function parseGradient(value) {
        const parts = String(value || '').split(';');
        if (parts.length < 4) return null;
        const type = parts.shift(), where = parts.shift(), at = where.split(' ');
        if (type === 'linear' ? ['left', 'right', 'top', 'bottom'].indexOf(where) === -1
            : (['circle', 'ellipse'].indexOf(type) === -1 || at.length !== 2 || ['left', 'center', 'right'].indexOf(at[0]) === -1 || ['top', 'center', 'bottom'].indexOf(at[1]) === -1)) return null;
        const stops = [];
        parts.forEach(part => {
            const point = part.split('@'), color = point.length === 2 ? parseColor(point[0]) : null, position = point.length === 2 ? parseFloat(point[1]) : NaN;
            if (color && !isNaN(position)) stops.push({color:colorValue(color.hex, color.alpha), at:Math.max(0, Math.min(100, position))});
        });
        return stops.length < 2 ? null : {type, where, stops:stops.slice(0, GRADIENT_STOPS)};
    }
    // Its points in order of their positions (those at one place as they are).
    const gradientSorted = g => g.stops.map((stop, i) => ({stop, i})).sort((a, b) => a.stop.at - b.stop.at || a.i - b.i).map(item => item.stop);
    const gradientPosition = at => Math.round(at * 10) / 10;
    const gradientValue = g => g.type + ';' + g.where + ';' + gradientSorted(g).map(stop => stop.color + '@' + gradientPosition(stop.at)).join(';');
    // The bar: the colours left to right, whatever the type.
    const gradientBar = g => 'linear-gradient(to right, ' + gradientSorted(g).map(stop => stop.color + ' ' + gradientPosition(stop.at) + '%').join(', ') + ')';
    // As CSS (WPBN_Gradient::css(): "left" starts on the left, towards the right); '' if it is not one.
    function gradientCss(value) {
        const g = parseGradient(value);
        if (!g) return '';
        const points = gradientSorted(g).map(stop => stop.color + ' ' + gradientPosition(stop.at) + '%').join(', ');
        return g.type === 'linear' ? 'linear-gradient(to ' + {left:'right', right:'left', top:'bottom', bottom:'top'}[g.where] + ', ' + points + ')' : 'radial-gradient(' + g.type + ' at ' + g.where + ', ' + points + ')';
    }
    // The colour the gradient has at a position (a new point's).
    function gradientColorAt(g, at) {
        const stops = gradientSorted(g);
        let before = stops[0], after = stops[stops.length - 1];
        stops.forEach(stop => { if (stop.at <= at) before = stop; });
        for (let i = stops.length - 1; i >= 0; i--) if (stops[i].at >= at) after = stops[i];
        const a = parseColor(before.color), b = parseColor(after.color), share = after.at > before.at ? (at - before.at) / (after.at - before.at) : 0;
        const mix = (x, y) => Math.round(x + (y - x) * share);
        return colorValue('#' + [1, 3, 5].map(i => ('0' + mix(parseInt(a.hex.substr(i, 2), 16), parseInt(b.hex.substr(i, 2), 16)).toString(16)).slice(-2)).join(''), mix(a.alpha, b.alpha));
    }
    // An overlay's fill: Color or Gradient, two buttons across the card (as the preview's devices); only the chosen
    // one's settings show under them (use_gradient; the other's values are kept).
    function fillChoice(l) {
        return '<div class="wpbn-fill-choice" role="group" aria-label="Fill">' + [['color', 'Color'], ['gradient', 'Gradient']].map(([fill, name]) =>
            '<button type="button" class="wpbn-device-button" data-fill="' + fill + '" aria-pressed="' + (!!l.use_gradient === (fill === 'gradient')) + '">' + name + '</button>').join('') + '</div>';
    }
    const SIDES = {left:'Left', right:'Right', top:'Top', bottom:'Bottom'};
    const options = (list, chosen) => Object.entries(list).map(([value, text]) => '<option value="' + value + '"' + (value === chosen ? ' selected' : '') + '>' + text + '</option>').join('');
    function gradientField(l) {
        const g = parseGradient(l.gradient) || parseGradient(GRADIENT_DEFAULT), linear = g.type === 'linear', at = linear ? ['center', 'center'] : g.where.split(' ');
        gradientChosen = Math.min(gradientChosen, g.stops.length - 1);
        const chosen = parseColor(g.stops[gradientChosen].color);
        return '<div class="wpbn-field wpbn-gradient">' + head('wpbn-f-gradient', 'Gradient colors', tip('Click the bar to add a color, drag a color along it, pick one to change or delete it.')) + '<div class="wpbn-gradient__selects">'
            // The gradient as the overlay shows it (its direction, or its middle): the bar below always runs left to right, as its points' positions do.
            + '<span class="wpbn-gradient__preview" role="img" aria-label="Gradient preview" title="As the layer shows it"><span class="wpbn-gradient__fill"></span></span>'
            + '<select class="wpbn-gradient__type" id="wpbn-f-gradient" aria-label="Gradient type">' + options({linear:'Linear', circle:'Radial - Circle', ellipse:'Radial - Ellipse'}, g.type) + '</select>'
            + '<select class="wpbn-gradient__direction" aria-label="Starts at"' + (linear ? '' : ' hidden') + '>' + options(SIDES, linear ? g.where : 'left') + '</select>'
            + '<select class="wpbn-gradient__x" aria-label="Middle across"' + (linear ? ' hidden' : '') + '>' + options({center:'Center', left:'Left', right:'Right'}, at[0]) + '</select>'
            + '<select class="wpbn-gradient__y" aria-label="Middle down"' + (linear ? ' hidden' : '') + '>' + options({center:'Center', top:'Top', bottom:'Bottom'}, at[1]) + '</select></div>'
            + '<div class="wpbn-gradient__bar" title="Click to add a color"><span class="wpbn-gradient__fill"></span></div>'
            + '<div class="wpbn-gradient__stops" role="listbox" aria-label="Gradient colors"></div>'
            + '<div class="wpbn-gradient__stop"><span class="wpbn-color" data-alpha="1" data-default="#000000"><input type="hidden" data-gradient-stop value="' + escape(colorValue(chosen.hex, chosen.alpha)) + '">'
            + '<button type="button" class="wpbn-color__swatch" aria-label="Color" title="Color" aria-expanded="false"><span class="wpbn-color__chip" aria-hidden="true"></span></button></span>'
            + '<button type="button" class="button-link wpbn-gradient__delete">Delete</button></div></div>';
    }
    // The bar, the points and the chosen one's colour as the layer's gradient is now.
    function drawGradient(full) {
        const box = $('settings').querySelector('.wpbn-gradient');
        if (!box) return;
        const g = parseGradient(current().gradient) || parseGradient(GRADIENT_DEFAULT);
        gradientChosen = Math.min(gradientChosen, g.stops.length - 1);
        box.querySelector('.wpbn-gradient__bar .wpbn-gradient__fill').style.backgroundImage = gradientBar(g);
        box.querySelector('.wpbn-gradient__preview .wpbn-gradient__fill').style.backgroundImage = gradientCss(gradientValue(g));
        if (full !== false) {
            box.querySelector('.wpbn-gradient__stops').innerHTML = g.stops.map((stop, i) => '<button type="button" class="wpbn-gradient__handle' + (i === gradientChosen ? ' is-chosen' : '') + '" role="option" aria-selected="' + (i === gradientChosen) + '" data-stop="' + i + '" aria-label="' + escape(stop.color + ', ' + gradientPosition(stop.at) + '%') + '" style="left:' + stop.at + '%"><span class="wpbn-gradient__chip" style="background-color:' + escape(stop.color) + '"></span></button>').join('');
            const input = box.querySelector('[data-gradient-stop]'), color = g.stops[gradientChosen].color;
            input.value = color;
            box.querySelector('.wpbn-gradient .wpbn-color__chip').style.boxShadow = 'inset 0 0 0 60px ' + color;
            box.querySelector('.wpbn-gradient__delete').disabled = g.stops.length <= 2;
        } else {
            box.querySelectorAll('.wpbn-gradient__handle').forEach(handle => { const stop = g.stops[Number(handle.dataset.stop)]; handle.style.left = stop.at + '%'; handle.setAttribute('aria-label', stop.color + ', ' + gradientPosition(stop.at) + '%'); });
        }
    }
    // Kept in its order; the chosen point stays chosen.
    function saveGradient(g) {
        const chosen = g.stops[gradientChosen], sorted = gradientSorted(g);
        gradientChosen = Math.max(0, sorted.indexOf(chosen));
        current().gradient = gradientValue({type:g.type, where:g.where, stops:sorted});
        if (current().type === 'overlay') list();
        changed();
    }
    const gradientNow = () => parseGradient(current().gradient) || parseGradient(GRADIENT_DEFAULT);
    function chooseStop(i) { if (i !== gradientChosen) closePicker(); gradientChosen = i; drawGradient(); }
    function deleteStop() {
        const g = gradientNow();
        if (g.stops.length <= 2) return;
        g.stops.splice(gradientChosen, 1); gradientChosen = 0; closePicker();
        saveGradient(g); drawGradient();
    }
    const gradientAt = (box, clientX) => { const r = box.querySelector('.wpbn-gradient__bar').getBoundingClientRect(); return r.width ? Math.max(0, Math.min(100, Math.round((clientX - r.left) / r.width * 100))) : 0; };
    app.addEventListener('change', event => {
        const box = event.target.closest('.wpbn-gradient');
        if (!box || event.target.tagName !== 'SELECT') return;
        const g = gradientNow(), type = box.querySelector('.wpbn-gradient__type').value;
        if (type === 'linear') g.where = g.type === 'linear' ? box.querySelector('.wpbn-gradient__direction').value : 'left';
        else g.where = g.type === 'linear' ? 'center center' : box.querySelector('.wpbn-gradient__x').value + ' ' + box.querySelector('.wpbn-gradient__y').value;
        g.type = type;
        saveGradient(g);
        settings(); $('settings').querySelector('.wpbn-gradient__type').focus();
    });
    app.addEventListener('click', event => {
        const box = event.target.closest('.wpbn-gradient');
        if (!box) return;
        // A new colour where the bar is clicked, the gradient's colour there.
        if (event.target.closest('.wpbn-gradient__bar')) {
            const g = gradientNow();
            if (g.stops.length >= GRADIENT_STOPS) return;
            const at = gradientAt(box, event.clientX);
            g.stops.push({color:gradientColorAt(g, at), at});
            gradientChosen = g.stops.length - 1; closePicker();
            saveGradient(g); drawGradient();
        } else if (event.target.closest('.wpbn-gradient__delete')) deleteStop();
    });
    // A point: chosen, and dragged along the bar while held.
    app.addEventListener('pointerdown', event => {
        const handle = event.target.closest('.wpbn-gradient__handle');
        if (!handle) return;
        const box = handle.closest('.wpbn-gradient');
        chooseStop(Number(handle.dataset.stop));
        const held = box.querySelector('.wpbn-gradient__handle.is-chosen');
        if (held) held.focus();
        if (event.button !== 0) return;
        event.preventDefault();
        let moved = false;
        const g = gradientNow(), stop = g.stops[gradientChosen];
        const move = e => { const at = gradientAt(box, e.clientX); if (at !== stop.at) { stop.at = at; moved = true; current().gradient = gradientValue(g); drawGradient(false); } };
        const end = () => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
            if (moved) { saveGradient(g); drawGradient(); const again = box.querySelector('.wpbn-gradient__handle.is-chosen'); if (again) again.focus(); }
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    });
    app.addEventListener('keydown', event => {
        const handle = event.target.closest('.wpbn-gradient__handle');
        if (!handle) return;
        const step = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1}[event.key];
        if (step) {
            event.preventDefault();
            const g = gradientNow(), stop = g.stops[gradientChosen];
            stop.at = Math.max(0, Math.min(100, Math.round(stop.at) + step * (event.shiftKey ? 10 : 1)));
            saveGradient(g); drawGradient();
        } else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteStop(); }
        else return;
        const again = $('settings').querySelector('.wpbn-gradient__handle.is-chosen');
        if (again) again.focus();
    });
    // The chosen point's colour (the colour block): into the gradient.
    app.addEventListener('input', event => {
        if (!event.target.matches('[data-gradient-stop]')) return;
        const g = gradientNow();
        g.stops[gradientChosen].color = event.target.value;
        saveGradient(g); drawGradient(false);
        const handle = $('settings').querySelector('.wpbn-gradient__handle.is-chosen .wpbn-gradient__chip');
        if (handle) handle.style.backgroundColor = event.target.value;
    });
    /*
     * A title's Font (WPBN_Fonts::groups(), with Woodmart): a list with a search box, in the groups
     * Woodmart's own elements have (theme, custom, Adobe, system, Google fonts), each font with the
     * weights it has: Weight offers only those. Without Woodmart (FONTS null): a text field.
     */
    const FONTS = boot.fonts && Array.isArray(boot.fonts.groups) ? boot.fonts : null;
    const WEIGHT_NAMES = {100:'100 Thin', 200:'200 Extra-light', 300:'300 Light', 400:'400 Regular', 500:'500 Medium', 600:'600 Semi-bold', 700:'700 Bold', 800:'800 Extra-bold', 900:'900 Black'};
    // Empty Font: the theme's title font (h1–h6 take it).
    // A layer without a font of its own: a title the theme's title font, a text the theme's text font (as on the site).
    const defaultFont = () => current() && current().type === 'richtext' ? 'var(--wd-text-font)' : 'var(--wd-title-font)';
    // value => [name, weights as digits ("4" = 400)].
    const FONT_INDEX = {};
    if (FONTS) {
        FONTS.groups.forEach(([, items]) => items.forEach(([value, name, weights]) => { FONT_INDEX[value] = [name, weights]; }));
        Object.entries(FONTS.google || {}).forEach(([name, weights]) => { if (!FONT_INDEX[name]) FONT_INDEX[name] = [name, weights]; });
    }
    function fontName(value) {
        if (value === '') return 'Default' + (FONT_INDEX[defaultFont()] ? ' · ' + FONT_INDEX[defaultFont()][0].replace(/^[^·]*· /, '') : '');
        return FONT_INDEX[value] ? FONT_INDEX[value][0] : value;
    }
    // The weights a font has (100–900); all for one not in the list (typed before there was a list).
    function fontWeights(value) {
        const entry = FONT_INDEX[value === '' ? defaultFont() : value];
        return (entry ? entry[1] : '123456789').split('').map(d => Number(d) * 100);
    }
    const nearestWeight = (weights, w) => weights.reduce((best, x) => Math.abs(x - w) < Math.abs(best - w) || (Math.abs(x - w) === Math.abs(best - w) && x > best) ? x : best, weights[0]);
    function weightField(l) {
        const weights = FONTS ? fontWeights(l.font_family) : Object.keys(WEIGHT_NAMES).map(Number);
        // A weight the font does not have (a scene from before the list): the nearest it has.
        if (weights.indexOf(Number(l.font_weight)) === -1) { l.font_weight = nearestWeight(weights, Number(l.font_weight)); sync(); }
        const options = {};
        weights.forEach(w => { options[w] = WEIGHT_NAMES[w]; });
        return select('font_weight', 'Weight', options);
    }
    function fontField(l) {
        const id = 'wpbn-f-font_family';
        return '<div class="wpbn-field">' + head(id, 'Font') + '<div class="wpbn-font">'
            + '<button type="button" class="wpbn-font__toggle" id="' + id + '" aria-haspopup="listbox" aria-expanded="false"><span class="wpbn-font__name">' + escape(fontName(l.font_family)) + '</span><span class="dashicons dashicons-arrow-down-alt2" aria-hidden="true"></span></button>'
            + '<div class="wpbn-font__panel" hidden><input type="search" class="wpbn-font__search" placeholder="Search fonts" aria-label="Search fonts" autocomplete="off">'
            + '<div class="wpbn-font__list" role="listbox" aria-label="Fonts"></div></div></div></div>';
    }
    // The list, in its groups, the fonts whose name has what is typed.
    function fontOptions(query) {
        const q = query.trim().toLowerCase(), chosen = current().font_family || '';
        const match = name => !q || name.toLowerCase().indexOf(q) !== -1;
        const option = (value, name) => '<div class="wpbn-font__option' + (value === chosen ? ' is-chosen' : '') + '" role="option" data-family="' + escape(value) + '" aria-selected="' + (value === chosen) + '">' + escape(name) + '</div>';
        let html = match(fontName('')) ? option('', fontName('')) : '';
        // A font typed before there was a list: kept, at the top.
        if (chosen && !FONT_INDEX[chosen] && match(chosen)) html += option(chosen, chosen);
        FONTS.groups.forEach(([label, items]) => {
            const rows = items.filter(([, name]) => match(name)).map(([value, name]) => option(value, name)).join('');
            if (rows) html += '<div class="wpbn-font__group" role="presentation">' + escape(label) + '</div>' + rows;
        });
        const google = Object.keys(FONTS.google || {}).filter(match).map(name => option(name, name)).join('');
        if (google) html += '<div class="wpbn-font__group" role="presentation">Google fonts</div>' + google;
        return html || '<p class="wpbn-font__empty">No fonts found.</p>';
    }
    /*
     * Under Font and Weight: the title's text in that font and weight, at once (not by Update).
     * The editor has none of the theme's styles: a theme font is its family (boot.fontFaces), and a
     * Google font is loaded here (custom and Adobe fonts only where the page has them).
     */
    const FONT_FACES = boot.fontFaces || {};
    function sampleFace(value) {
        const v = value === '' ? defaultFont() : value;
        if (FONT_FACES[v]) return FONT_FACES[v];
        if (FONTS && FONTS.google && FONTS.google[v] !== undefined) return {css:'"' + v + '"', google:v};
        return {css:v, google:''};
    }
    function loadGoogleFont(family, weight) {
        const href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@' + weight + '&display=swap';
        if (Array.from(document.querySelectorAll('link[data-wpbn-font]')).some(link => link.href === href)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href; link.dataset.wpbnFont = '';
        document.head.append(link);
    }
    // The title's text as the site shows it: no tags (only <u> stays there, as a colour).
    const sampleText = l => String((l.type === 'richtext' ? String(l.content || '').replace(/<\/(p|h[1-6]|li)>/gi, ' ') : l.text) || '').replace(/<[^>]*>/g, '').replace(/\s*\n\s*/g, ' ').trim() || 'Aa Bb Cc 123';
    // family: a font from the list being looked at (hovered, or reached with the arrow keys), at the
    // weight nearest the title's that it has; none: the title's own.
    function refreshFontSample(family) {
        const el = $('font-sample'), l = current();
        if (!el || selected < 0) return;
        const value = family === undefined ? l.font_family || '' : family;
        const weight = family === undefined ? l.font_weight : nearestWeight(fontWeights(value), Number(l.font_weight));
        const face = sampleFace(value);
        if (face.google) loadGoogleFont(face.google, weight);
        el.style.fontFamily = face.css;
        el.style.fontWeight = weight;
        // As the title has them: Case, Style and Letter spacing (in proportion to its size).
        el.style.textTransform = l.text_transform || 'none';
        el.style.fontStyle = l.font_style || 'normal';
        const size = fontFor(l, device());
        el.style.letterSpacing = size ? (inlineFor(l, 'spacing', device()) / size) + 'em' : '';
        el.textContent = sampleText(l);
    }
    let fontBox = null;
    function listFonts() {
        fontBox.querySelector('.wpbn-font__list').innerHTML = fontOptions(fontBox.querySelector('.wpbn-font__search').value);
        const first = fontBox.querySelector('.wpbn-font__option');
        if (first) first.classList.add('is-active');
    }
    function openFonts(box) {
        closeFonts(); closePicker();
        fontBox = box;
        const search = box.querySelector('.wpbn-font__search');
        const panel = box.querySelector('.wpbn-font__panel'), sample = $('font-sample');
        panel.hidden = false;
        // Under the font sample, which shows the fonts looked at.
        panel.style.top = sample ? (sample.getBoundingClientRect().bottom - box.getBoundingClientRect().top + 4) + 'px' : '';
        box.querySelector('.wpbn-font__toggle').setAttribute('aria-expanded', 'true');
        search.value = '';
        listFonts();
        // The chosen font in view.
        const chosen = box.querySelector('.wpbn-font__option.is-chosen');
        if (chosen) { box.querySelectorAll('.wpbn-font__option.is-active').forEach(o => o.classList.remove('is-active')); chosen.classList.add('is-active'); chosen.scrollIntoView({block:'nearest'}); }
        search.focus();
    }
    function closeFonts(focus) {
        if (!fontBox) return;
        const box = fontBox, toggle = box.querySelector('.wpbn-font__toggle');
        fontBox = null;
        box.querySelector('.wpbn-font__panel').hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        // Closed without a choice: the sample shows the title's font again.
        refreshFontSample();
        if (focus) toggle.focus();
    }
    // A font chosen: Weight offers its weights (the nearest one it has if the weight is not one of them).
    function chooseFont(value) {
        const l = current();
        closeFonts();
        l.font_family = value;
        const weights = fontWeights(value);
        if (weights.indexOf(Number(l.font_weight)) === -1) l.font_weight = nearestWeight(weights, Number(l.font_weight));
        changed(); settings();
        const toggle = $('f-font_family');
        if (toggle) toggle.focus();
    }
    app.addEventListener('click', event => {
        const toggle = event.target.closest('.wpbn-font__toggle');
        if (toggle) { const box = toggle.closest('.wpbn-font'); if (fontBox === box) closeFonts(true); else openFonts(box); return; }
        const option = event.target.closest('.wpbn-font__option');
        if (option) chooseFont(option.dataset.family);
    });
    app.addEventListener('input', event => { if (fontBox && event.target.classList.contains('wpbn-font__search')) listFonts(); });
    // A side's padding typed (all four while linked; tablet / mobile empty: the larger screen's), within its unit's largest.
    app.addEventListener('input', event => {
        const input = event.target.closest && event.target.closest('[data-pad-side]'), l = input && current();
        if (!l) return;
        const d = device(), s0 = input.dataset.padSide;
        let value = null;
        if (input.value === '') { if (d === 'desktop') return; }
        else { const n = Number(input.value); if (!Number.isFinite(n)) return; value = Math.max(0, Math.min(PADDING_MAX[l['padding_' + s0 + '_unit']] || 500, Math.round(n))); }
        (l.padding_linked ? BORDER_SIDES : [s0]).forEach(s => { l[dkey('padding_' + s, d)] = value; });
        refreshPadding(); changed();
    });
    // A corner's radius typed (all four while linked; tablet / mobile empty: the larger screen's), within its unit's largest.
    app.addEventListener('input', event => {
        const input = event.target.closest && event.target.closest('[data-radius-corner]'), l = input && current();
        if (!l) return;
        const d = device(), c0 = input.dataset.radiusCorner;
        let value = null;
        if (input.value === '') { if (d === 'desktop') return; }
        else { const n = Number(input.value); if (!Number.isFinite(n)) return; value = Math.max(0, Math.min(RADIUS_MAX[l['radius_' + c0 + '_unit']] || 1000, Math.round(n))); }
        (l.radius_linked ? RADIUS_CORNERS : [c0]).forEach(c => { l[dkey('radius_' + c, d)] = value; });
        refreshRadius(); changed();
    });
    app.addEventListener('input', event => {
        const input = event.target.closest && event.target.closest('[data-border-side]'), l = input && current();
        if (!l) return;
        const d = device();
        let value = null;
        if (input.value === '') { if (d === 'desktop') return; }
        else { const n = Number(input.value); if (!Number.isFinite(n)) return; value = Math.max(0, Math.min(100, Math.round(n))); }
        (l.border_linked ? BORDER_SIDES : [input.dataset.borderSide]).forEach(s => { l[dkey('border_' + s, d)] = value; });
        refreshBorder(); changed();
    });
    // A font under the pointer: the one looked at (the sample shows it).
    app.addEventListener('mouseover', event => {
        const option = fontBox && event.target.closest('.wpbn-font__option');
        if (!option || option.classList.contains('is-active')) return;
        fontBox.querySelectorAll('.wpbn-font__option.is-active').forEach(o => o.classList.remove('is-active'));
        option.classList.add('is-active');
        refreshFontSample(option.dataset.family);
    });
    app.addEventListener('keydown', event => {
        if (!fontBox || !event.target.classList.contains('wpbn-font__search')) return;
        const options = Array.from(fontBox.querySelectorAll('.wpbn-font__option')), active = fontBox.querySelector('.wpbn-font__option.is-active');
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = options[Math.max(0, Math.min(options.length - 1, options.indexOf(active) + (event.key === 'ArrowDown' ? 1 : -1)))];
            if (active) active.classList.remove('is-active');
            if (next) { next.classList.add('is-active'); next.scrollIntoView({block:'nearest'}); refreshFontSample(next.dataset.family); }
        } else if (event.key === 'Enter') {
            // Not the post form's submit.
            event.preventDefault();
            if (active) chooseFont(active.dataset.family);
        } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            closeFonts(true);
        }
    });
    document.addEventListener('pointerdown', event => { if (fontBox && !fontBox.contains(event.target)) closeFonts(); });
    // A switch (as WP Swiper's checkboxes). checked: for a switch that is not a stored key of its own.
    function check(key, label, help, checked) {
        const id = 'wpbn-f-' + key, on = checked === undefined ? !!current()[key] : checked;
        // The switch in the field's head row, so a tip (withTip()) sits right after its label, on its line.
        return '<div class="wpbn-field wpbn-field--check"><div class="wpbn-field__head"><label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="' + key + '"' + (on ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>' + label + '</span></label></div>' + note(help) + '</div>';
    }
    // A field that only applies in some settings: greyed (not hidden) otherwise, its value kept.
    // A title's Font size, a value per device: tablet and mobile empty follow the larger screen
    // (as WPBN_Settings::fonts()). kind => its keys, its field.
    const INLINE = {
        font: {keys:{desktop:'font_size', tablet:'tablet_font_size', mobile:'mobile_font_size'}, label:'Font size', unit:'px', min:8, max:{desktop:500, tablet:500, mobile:250}, step:1},
        spacing: {keys:{desktop:'letter_spacing', tablet:'tablet_letter_spacing', mobile:'mobile_letter_spacing'}, label:'Letter spacing', unit:'px', min:-20, max:{desktop:100, tablet:100, mobile:100}, step:0.1,
            tip:'Space added between the letters; negative brings them closer.'},
        // Container width (Custom, or Theme container in a theme without one), per device.
        cwidth: {keys:{desktop:'container_width', tablet:'container_width_tablet', mobile:'container_width_mobile'}, label:'Container width', unit:'px', min:320, max:{desktop:3000, tablet:3000, mobile:3000}, step:1,
            tip:'On a narrower screen it keeps 15px clear on each side. The icons choose the device. Tablet and mobile: empty follows the larger screen (shown in grey).'}
    };
    // A title's Shadow: its switch with an "i"; on, its color, offset (X right, Y down) and Blur in a row (WPBN_Settings::shadow()).
    /*
     * Border (Effect, 2026-11-09, user's request): its switch, as Shadow's; on, a box drawn as the four sides (refreshBorder()) with
     * each side's width beside it (px, per device: tablet / mobile empty follow the larger screen) and, in its middle, the link
     * that sets them together; under it, its line and its colour on one row. Its fields have their own handler (data-border-side).
     */
    const BORDER_SIDES = ['top', 'right', 'bottom', 'left'];
    const BORDER_STYLES = {solid:'Solid', dashed:'Dashed', dotted:'Dotted', double:'Double'};
    const borderOwn = (l, dv) => BORDER_SIDES.some(s => dv === 'desktop' ? !isStandard(l, 'border_' + s) : l['border_' + s + '_' + dv] != null);
    function borderField(l) {
        const toggle = check('use_border', 'Border');
        if (!l.use_border) return toggle;
        const d = device();
        const side = s => {
            const v = l[dkey('border_' + s, d)], name = s[0].toUpperCase() + s.slice(1);
            return '<span class="wpbn-number-unit wpbn-border-box__side wpbn-border-box__side--' + s + '"><input type="number" id="wpbn-f-border_' + s + '" data-border-side="' + s + '" min="0" max="100" step="1" value="' + (v == null ? '' : escape(v)) + '" placeholder="' + escape(eff(l, 'border_' + s, d)) + '" aria-label="' + name + ' border width (px)"><span class="wpbn-number-unit__unit" aria-hidden="true">px</span></span>';
        };
        const linked = !!l.border_linked, link = linked ? 'The sides are set together: click to set each on its own' : 'Each side on its own: click to set them together';
        return toggle + '<div class="wpbn-field wpbn-field--border"><div class="wpbn-field__head"><span class="wpbn-field__label">Width</span>' + devices({desktop:borderOwn(l, 'desktop'), tablet:borderOwn(l, 'tablet'), mobile:borderOwn(l, 'mobile')}) + '</div>'
            + '<div class="wpbn-border-box wpbn-border-box--border"><span class="wpbn-border-box__frame" aria-hidden="true"></span>' + BORDER_SIDES.map(side).join('')
            + '<button type="button" class="wpbn-border-box__link" data-border-link aria-pressed="' + linked + '" aria-label="' + link + '" title="' + link + '">' + icons.link + '</button></div></div>'
            + '<div class="wpbn-row wpbn-row--line">' + select('border_style', 'Line', BORDER_STYLES) + colorField('border_color', 'Color', {alpha:true, def:'#ffffff'}) + '</div>';
    }
    /*
     * Radius (Effect, 2026-11-09, user's request): its switch, under Border's; on, a box as Border's with each corner's radius at
     * that corner (per device: tablet / mobile empty follow the larger screen), px or % picked beside its number (both shown, one
     * above the other: the one in use dark and bold; one unit per corner for every device), the link in the middle.
     */
    const RADIUS_CORNERS = ['tl', 'tr', 'br', 'bl'];
    const RADIUS_NAMES = {tl:'Top left', tr:'Top right', br:'Bottom right', bl:'Bottom left'};
    const RADIUS_MAX = {px:1000, '%':50};
    const radiusOwn = (l, dv) => RADIUS_CORNERS.some(c => dv === 'desktop' ? !isStandard(l, 'radius_' + c) || !isStandard(l, 'radius_' + c + '_unit') : l['radius_' + c + '_' + dv] != null);
    function radiusField(l) {
        const toggle = check('use_radius', 'Radius');
        if (!l.use_radius) return toggle;
        const d = device();
        const corner = c => {
            const v = l[dkey('radius_' + c, d)], unit = l['radius_' + c + '_unit'] || 'px';
            return '<span class="wpbn-radius-input wpbn-border-box__corner wpbn-border-box__corner--' + c + '"><input type="number" id="wpbn-f-radius_' + c + '" data-radius-corner="' + c + '" min="0" max="' + RADIUS_MAX[unit] + '" step="1" value="' + (v == null ? '' : escape(v)) + '" placeholder="' + escape(eff(l, 'radius_' + c, d)) + '" aria-label="' + RADIUS_NAMES[c] + ' radius (' + unit + ')">'
                + '<span class="wpbn-unit-pick" role="group" aria-label="' + RADIUS_NAMES[c] + ' radius unit">' + Object.keys(RADIUS_MAX).map(u => '<button type="button" data-radius-unit="' + c + '" data-unit="' + u + '" aria-pressed="' + (u === unit) + '">' + u + '</button>').join('') + '</span></span>';
        };
        const linked = !!l.radius_linked, link = linked ? 'The corners are set together: click to set each on its own' : 'Each corner on its own: click to set them together';
        return toggle + '<div class="wpbn-field wpbn-field--radius"><div class="wpbn-field__head"><span class="wpbn-field__label">Corners</span>' + devices({desktop:radiusOwn(l, 'desktop'), tablet:radiusOwn(l, 'tablet'), mobile:radiusOwn(l, 'mobile')}) + '</div>'
            + '<div class="wpbn-border-box wpbn-radius-box"><span class="wpbn-border-box__frame wpbn-radius-box__frame" aria-hidden="true"></span>' + RADIUS_CORNERS.map(corner).join('')
            + '<button type="button" class="wpbn-border-box__link" data-radius-link aria-pressed="' + linked + '" aria-label="' + link + '" title="' + link + '">' + icons.link + '</button></div></div>';
    }
    /*
     * Padding (Size, 2026-11-09, user's request): its switch, as Border's; on, a box as Border's, each side's space beside it (per
     * device: tablet / mobile empty follow the larger screen), px or % (of the banner's width) picked beside its number, one
     * unit per side for every device; the link in the middle. The box shows the spaces green, as a browser's inspector does.
     */
    const PADDING_MAX = {px:500, '%':50};
    const SIDE_NAMES = {top:'Top', right:'Right', bottom:'Bottom', left:'Left'};
    const padOwn = (l, dv) => BORDER_SIDES.some(s => dv === 'desktop' ? !isStandard(l, 'padding_' + s) || !isStandard(l, 'padding_' + s + '_unit') : l['padding_' + s + '_' + dv] != null);
    function paddingField(l) {
        // Its switch (user's request, 2026-11-09), with the help beside it; on, its sides.
        const toggle = withTip(check('use_padding', 'Padding'), 'Space inside the layer\'s box: its content keeps away from its edges, e.g. a title from the edge of the screen on a phone (its lines wrap inside it). % is of the banner\'s width.');
        if (!l.use_padding) return toggle;
        const d = device();
        const side = s => {
            const v = l[dkey('padding_' + s, d)], unit = l['padding_' + s + '_unit'] || 'px';
            return '<span class="wpbn-radius-input wpbn-border-box__side wpbn-border-box__side--' + s + '"><input type="number" id="wpbn-f-padding_' + s + '" data-pad-side="' + s + '" min="0" max="' + PADDING_MAX[unit] + '" step="1" value="' + (v == null ? '' : escape(v)) + '" placeholder="' + escape(eff(l, 'padding_' + s, d)) + '" aria-label="' + SIDE_NAMES[s] + ' padding (' + unit + ')">'
                + '<span class="wpbn-unit-pick" role="group" aria-label="' + SIDE_NAMES[s] + ' padding unit">' + Object.keys(PADDING_MAX).map(u => '<button type="button" data-pad-unit="' + s + '" data-unit="' + u + '" aria-pressed="' + (u === unit) + '">' + u + '</button>').join('') + '</span></span>';
        };
        const linked = !!l.padding_linked, link = linked ? 'The sides are set together: click to set each on its own' : 'Each side on its own: click to set them together';
        return toggle + '<div class="wpbn-field wpbn-field--padding"><div class="wpbn-field__head"><span class="wpbn-field__label">Sides</span>' + devices({desktop:padOwn(l, 'desktop'), tablet:padOwn(l, 'tablet'), mobile:padOwn(l, 'mobile')}) + '</div>'
            + '<div class="wpbn-border-box wpbn-pad-box"><span class="wpbn-border-box__frame wpbn-pad-box__frame" aria-hidden="true"></span>' + BORDER_SIDES.map(side).join('')
            + '<button type="button" class="wpbn-border-box__link" data-pad-link aria-pressed="' + linked + '" aria-label="' + link + '" title="' + link + '">' + icons.link + '</button></div></div>';
    }
    // The box's spaces drawn green as they are (px scaled down, % of a 600px banner), the fields' values and the device dots.
    function refreshPadding() {
        const box = $('settings').querySelector('.wpbn-pad-box'), l = current();
        if (!box || !l) return;
        const d = device(), frame = box.querySelector('.wpbn-pad-box__frame');
        BORDER_SIDES.forEach(s => {
            const v = Number(eff(l, 'padding_' + s, d)) || 0, px = l['padding_' + s + '_unit'] === '%' ? v * 6 : v, input = box.querySelector('[data-pad-side="' + s + '"]'), own = l[dkey('padding_' + s, d)];
            frame.style['border' + s[0].toUpperCase() + s.slice(1) + 'Width'] = (px ? Math.min(s === 'top' || s === 'bottom' ? 10 : 24, Math.max(2, px / 4)) : 0) + 'px';
            if (input && document.activeElement !== input) input.value = own == null ? '' : own;
            if (input) input.placeholder = eff(l, 'padding_' + s, d);
        });
        const field = box.closest('.wpbn-field');
        Object.keys(DEVICES).forEach(dv => { const b = field.querySelector('[data-field-device="' + dv + '"]'); if (b) b.classList.toggle('has-value', padOwn(l, dv)); });
    }
    // The box's corners drawn as the radii are (px scaled down, % as they are), the fields' values and the device dots.
    function refreshRadius() {
        const box = $('settings').querySelector('.wpbn-radius-box'), l = current();
        if (!box || !l) return;
        const d = device(), frame = box.querySelector('.wpbn-radius-box__frame');
        frame.style.borderRadius = RADIUS_CORNERS.map(c => { const v = Number(eff(l, 'radius_' + c, d)) || 0; return (l['radius_' + c + '_unit'] === '%' ? v + '%' : Math.min(40, v / 2) + 'px'); }).join(' ');
        RADIUS_CORNERS.forEach(c => {
            const input = box.querySelector('[data-radius-corner="' + c + '"]'), own = l[dkey('radius_' + c, d)];
            if (input && document.activeElement !== input) input.value = own == null ? '' : own;
            if (input) input.placeholder = eff(l, 'radius_' + c, d);
        });
        const field = box.closest('.wpbn-field');
        Object.keys(DEVICES).forEach(dv => { const b = field.querySelector('[data-field-device="' + dv + '"]'); if (b) b.classList.toggle('has-value', radiusOwn(l, dv)); });
    }
    // The box's sides drawn as the widths are (1–6px, its line; none: a light dashed line), the fields' values and the device dots.
    function refreshBorder() {
        // Its own box (Padding's and Radius's are drawn as it is too).
        const box = $('settings').querySelector('.wpbn-border-box--border'), l = current();
        if (!box || !l) return;
        const d = device(), frame = box.querySelector('.wpbn-border-box__frame');
        BORDER_SIDES.forEach(s => {
            const v = Number(eff(l, 'border_' + s, d)) || 0, input = box.querySelector('[data-border-side="' + s + '"]'), own = l[dkey('border_' + s, d)];
            frame.style['border' + s[0].toUpperCase() + s.slice(1)] = v ? Math.min(6, Math.max(1, v)) + 'px ' + (l.border_style || 'solid') + ' #8c8f94' : '1px dashed #c3c4c7';
            if (input && document.activeElement !== input) input.value = own == null ? '' : own;
            if (input) input.placeholder = eff(l, 'border_' + s, d);
        });
        const field = box.closest('.wpbn-field');
        Object.keys(DEVICES).forEach(dv => { const b = field.querySelector('[data-field-device="' + dv + '"]'); if (b) b.classList.toggle('has-value', borderOwn(l, dv)); });
    }
    function shadowField(l) {
        const id = 'wpbn-f-use_shadow';
        const toggle = '<div class="wpbn-field wpbn-field--check"><div class="wpbn-field__head"><label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="use_shadow"' + (l.use_shadow ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>Shadow</span></label>'
            // No tip (user's request, 2026-11-09).
            + '</div></div>';
        if (!l.use_shadow) return toggle;
        const px = (key, label, min, max) => '<div class="wpbn-field">' + head('wpbn-f-' + key, label) + '<span class="wpbn-number-unit"><input id="wpbn-f-' + key + '" data-key="' + key + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + escape(l[key]) + '"><span class="wpbn-number-unit__unit" aria-hidden="true">px</span></span></div>';
        return toggle + '<div class="wpbn-row wpbn-shadow">' + colorField('shadow_color', 'Color', {alpha:true, def:boot.layer.shadow_color})
            + px('shadow_x', 'X', -100, 100) + px('shadow_y', 'Y', -100, 100) + px('shadow_blur', 'Blur', 0, 200) + '</div>'
            // An overlay's shadow can fall Inside its edges (a vignette); a button's (not an Underline's: no box) too.
            + (l.type === 'overlay' || (l.type === 'button' && l.button_style !== 'underline') ? check('shadow_inset', 'Inside') : '');
    }
    function inlineFor(l, kind, d) { const key = INLINE[kind].keys[d]; return d === 'desktop' || l[key] != null ? l[key] : inlineFor(l, kind, UP[d]); }
    const fontFor = (l, d) => inlineFor(l, 'font', d);
    // One number for the device being edited, its unit after it (px for sizes); the device icons at the
    // right of its label, as the other per-device fields have them (a green dot where tablet or mobile has its own).
    // o.slider [from, to]: a slider before it (it moves the value the device shows: on tablet / mobile, the larger screen's until moved).
    function deviceNumberField(l, kind) {
        const o = INLINE[kind], d = device(), key = o.keys[d], id = 'wpbn-f-' + key;
        const slider = o.slider ? '<input type="range" data-inline-range="' + kind + '" min="' + o.slider[0] + '" max="' + o.slider[1] + '" step="' + o.step + '" value="' + escape(inlineFor(l, kind, d)) + '" aria-label="' + o.label + ' — ' + DEVICES[d][1] + '">' : '';
        return '<div class="wpbn-field wpbn-field--device-number"><div class="wpbn-field__head"><label for="' + id + '">' + o.label + '</label>' + (o.tip ? tip(o.tip) : '')
            + devices({desktop:!isStandard(l, o.keys.desktop), tablet:l[o.keys.tablet] != null, mobile:l[o.keys.mobile] != null}) + '</div>'
            + (slider ? '<div class="wpbn-field__row">' + slider : '') + '<span class="wpbn-number-unit"><input id="' + id + '" data-inline="' + kind + '" data-' + kind + '="' + d + '" type="number" min="' + o.min + '" max="' + o.max[d] + '" step="' + o.step + '"'
            + ' value="' + (l[key] != null ? escape(l[key]) : '') + '" placeholder="' + escape(inlineFor(l, kind, d)) + '" aria-label="' + o.label + ' — ' + DEVICES[d][1] + '">'
            + (o.unit ? '<span class="wpbn-number-unit__unit" aria-hidden="true">' + o.unit + '</span>' : '') + '</span>' + (slider ? '</div>' : '') + '</div>';
    }
    /*
     * Animation (WPBN_Animation): motion of the layer's own, running by itself from the moment the page loads,
     * on top of its scroll motion. Its switch; on: its kind, where it starts and ends and how long a run takes
     * (per device), then its delay, repeat and easing. The kinds and their fields come from boot.animations.
     * An overlay (2026-11-10): Zoom and the slides only (OVERLAY_ANIMS; WPBN_Animation::active()).
     */
    const ANIM = boot.animations || null;
    // An overlay's kinds: those that move its box. Not Fade: a fading box around it would cut its Filters off from the layers behind.
    const OVERLAY_ANIMS = ['zoom', 'slide-x', 'slide-y'];
    // Follow the mouse (Motion): its switch; on, how far the layer moves with the pointer at the scene's edge. One value for every
    // device: only devices with a mouse have it. Layers in front moving further than those behind gives depth.
    // Follow the mouse: no switch (user's request, 2026-11-09): 0 does not move. Its help: the tip beside the section's title.
    const MOUSE_TIP = 'On computers: the layer moves a little as the pointer moves over the banner. Give front layers more than back ones for depth; negative moves against the pointer.';
    const mouseField = () => range('mouse', 'Distance (px)', {min:-200, max:200, from:-80, to:80, tip:'How far it moves with the pointer at the banner\'s edge; 0: it stays.'});
    /*
     * Entrance animation (WPBN_Entrance): how the layer comes in, once: its switch; on: its kind, when it starts, a slide's
     * distance or a zoom's start size, its duration, delay and easing. Not for a Shape layer.
     */
    const ENTER = boot.entrance || null;
    /*
     * Entrance and Loop animation have no switch (user's request, 2026-11-09): their Type, None first, is it (use_enter / use_anim
     * off with None; the type chosen before is kept). Its own change handler (data-anim-kind, not data-key).
     */
    function kindSelect(which, l, types, help) {
        const flag = which === 'enter' ? 'use_enter' : 'use_anim', key = which + '_type', id = 'wpbn-f-' + key, value = l[flag] ? l[key] : 'none';
        return withTip('<div class="wpbn-field">' + head(id, 'Type') + '<select id="' + id + '" data-anim-kind="' + which + '">'
            + Object.entries(Object.assign({none:'None'}, types)).map(([v, t]) => '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + escape(t) + '</option>').join('') + '</select></div>', help);
    }
    function entranceCard(l) {
        if (!ENTER || l.type === 'shape') return '';
        const toggle = kindSelect('enter', l, ENTER.types, 'How the layer comes into the banner, once: fading in, sliding in or zooming into place, as the page loads or once the banner is in view. Then the Loop animation, if any, runs on.');
        const starts = ANIM ? ANIM.starts : {load:'On load', visible:'In view'};
        // Its fields always active (user's request, 2026-11-09): with None they do nothing, their values kept.
        return card('Entrance animation', toggle + (withTip(select('enter_start', 'Starts', starts), 'On load: as the page opens. In view: once the banner is on the screen, for banners lower on the page.')
            + (/^slide/.test(l.enter_type) ? range('enter_distance', 'Distance (px)', {min:0, max:1000, to:300, tip:'How far away it starts.'}) : '')
            + (l.enter_type === 'zoom' ? range('enter_scale', 'Start size (%)', {min:10, max:300, from:50, to:150, tip:'Under 100: it grows into place; over 100: it shrinks into place.'}) : '')
            + range('enter_duration', 'Duration (s)', {min:ENTER.duration[0], max:ENTER.duration[1], step:0.1, to:3})
            + range('enter_delay', 'Delay (s)', {min:ENTER.delay[0], max:ENTER.delay[1], to:5, step:0.1, tip:'E.g. the title a moment after the photo.'})
            + (ANIM ? select('enter_easing', 'Easing', ANIM.easings) : '')));
    }
    function animationCard(l) {
        if (!ANIM) return '';
        const types = l.type === 'overlay' ? Object.fromEntries(Object.entries(ANIM.types).filter(([k]) => OVERLAY_ANIMS.includes(k))) : ANIM.types;
        const kinds = Object.keys(types), type = types[l.anim_type] || types[kinds[0]];
        // Its Type, None first (no switch: user's request, 2026-11-09), the help behind an "i" beside it.
        const toggle = kindSelect('anim', l, Object.fromEntries(Object.entries(types).map(([k, t]) => [k, t.label])), l.type === 'overlay'
            ? 'Runs by itself, on top of the scroll animation: the overlay slowly zooming, or sliding to and fro. For an overlay smaller than the scene (Size); one that fills it would show its edges. How it comes in: Entrance animation.'
            : 'Runs by itself, on top of the scroll animation, e.g. a photo slowly zooming in and out. How a layer comes in: Entrance animation.');
        // Reset takes the kind's own start and end.
        [DEFAULTS.anim_from, DEFAULTS.anim_to] = type.def;
        const min = l.type === 'image' && l.fill_scene && type.fillMin != null ? Math.max(type.min, type.fillMin) : type.min;
        const span = {min, max:type.max, from:Math.max(min, type.span[0]), to:type.span[1]};
        // What and when; then the kind's own fields; then how it runs.
        // Its fields always active (user's request, 2026-11-09): with None they do nothing, their values kept; Type and Starts each on a row.
        return card('Loop animation', toggle + (withTip(select('anim_start', 'Starts', ANIM.starts), 'On load: as the page opens. In view: once the banner is on the screen, for banners lower on the page.')
            + (type.origin ? select('anim_origin', 'Direction', ANIM.origins) : '')
            + respRange('anim_from', type.from, span)
            + respRange('anim_to', type.to, Object.assign({tip:type.note}, span))
            + respRange('anim_duration', 'Duration (s)', {min:ANIM.duration[0], max:ANIM.duration[1], from:1, to:30, step:0.1, tip:'One run, from start to end.'})
            + '<div class="wpbn-row">' + withTip(select('anim_repeat', 'Repeat', ANIM.repeats), 'Back & forth: to the end and back again, endlessly. Loop: from the start again each time. Once: it plays and stays at its end.') + select('anim_easing', 'Easing', ANIM.easings) + '</div>'
            + range('anim_delay', 'Delay (s)', {min:ANIM.delay[0], max:ANIM.delay[1], to:10, step:0.1, tip:'Before the first run, on every device: e.g. the title a moment after the photo.'})));
    }
    // Placed by class: the scene fills its block.
    // Placement by class only with the desktop Height on Auto (as WPBN_Settings::placed_by_class()).
    const autoHeight = () => scene.height_unit === 'auto';
    const filling = () => !!String(scene.target || '').trim() && autoHeight();
    // A layer's Container (as WPBN_Container::of()): the box its Position X and Width are shares of, centred
    // in the scene, at a scene width w; null: the whole scene. Theme container: the theme's (boot.themeContainer);
    // without one, or Custom: the width set (container_width), 15px kept clear on each side of a narrower scene.
    function container(w, l, d) {
        if (!l || !l.container || l.container === 'full') return null;
        const t = l.container === 'theme' && boot.themeContainer ? boot.themeContainer : {width:inlineFor(l, 'cwidth', d || 'desktop'), side:30, inner:0};
        const cw = Math.max(1, Math.min(w - t.side, t.width) - t.inner);
        return {left:(w - cw) / 2, width:cw};
    }
    const customWidth = () => current().container === 'custom' || (current().container === 'theme' && !boot.themeContainer);
    function containerSelect(l) {
        const t = boot.themeContainer;
        const help = 'The area the layer is placed and sized in, centred in the scene. Theme container: the page\'s content width'
            + (t ? ' (' + t.name + ', ' + t.width + 'px' + (t.inner ? ' less ' + t.inner / 2 + 'px padding on each side' : '') + ')' : ' (this theme has none: the width below is used)')
            + ', so the layer lines up with the content below the banner. Full width: the whole scene. Custom: a width of your own'
            + (l.type === 'image' ? '. Keep a photo and its cutout both on Full width.' : '.');
        return withTip(select('container', 'Container', {theme:'Theme container', full:'Full width', custom:'Custom'}), help);
    }
    // Container (and Position beside it, for a title or an overlay), then its width for Custom.
    function containerField(l) {
        return (anchored(l) ? containerPositionField(l) : containerSelect(l))
            // Container width: only for Custom (or Theme container in a theme without one, which uses it).
            + (customWidth() ? deviceNumberField(l, 'cwidth') : '');
    }
    // A button: Open in a new window with a link only; Corners not for Underline.
    // An image object: Image fit and its photo's point in view only where its box can crop it (not with Height Auto).
    const NEEDS = {cropbox: () => effSize('height', device(), current())[1] !== 'auto', autoheight: autoHeight, link: () => !!String(current().button_url || '').trim(), corners: () => current().button_style !== 'underline',
        // A Shape object's Edge color: with an Edge (not on glass); its Filters: on a photo or an image; Edge and Shadow: not on glass.
        stroke: () => Number(current().stroke) > 0 && current().fill !== 'glass',
        pictured: () => current().fill === 'layer' || current().fill === 'image',
        edged: () => current().fill !== 'glass'};
    // A button's Background or Corners: a sample of each, the chosen one pressed (as WP Top Info Bar's).
    function buttonChoice(l, key, label, list) {
        return '<div class="wpbn-field">' + head('wpbn-f-' + key, label) + '<div class="wpbn-button-choices" role="group" aria-label="' + label + '">'
            + Object.entries(list).map(([value, name], i) => '<button type="button" class="wpbn-button-choice"' + (i ? '' : ' id="wpbn-f-' + key + '"') + ' data-choice="' + key + '" data-value="' + value + '" aria-pressed="' + (l[key] === value) + '"><span class="wpbn-button-choice__sample wpbn-button-choice__sample--' + value + '">' + name + '</span></button>').join('') + '</div></div>';
    }
    /*
     * A button's Icon (user's request, 2026-11-10, as Woodmart's; WPBN_Icons): a block of its own. None, an icon from Font
     * Awesome Free (the picker below) or an image; then where it is, its Size and its Gap from the text (per device).
     */
    const segmented = (l, key, label, list) => '<div class="wpbn-field">' + head('wpbn-f-' + key, label) + '<div class="wpbn-fill-choice" role="group" aria-label="' + label + '">'
        + Object.entries(list).map(([value, name], i) => '<button type="button" class="wpbn-device-button"' + (i ? '' : ' id="wpbn-f-' + key + '"') + ' data-choice="' + key + '" data-value="' + value + '" aria-pressed="' + (l[key] === value) + '">' + name + '</button>').join('') + '</div></div>';
    // A kept icon ("width height|path") as SVG; '' for none.
    function iconSvg(value) {
        const m = /^(\d+) (\d+)\|([MmZzLlHhVvCcSsQqTtAa0-9eE.,\s+-]+)$/.exec(String(value || ''));
        return m ? '<svg viewBox="0 0 ' + m[1] + ' ' + m[2] + '" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + m[3] + '"/></svg>' : '';
    }
    const ICON_STYLES = {s:'solid', r:'regular', b:'brands'};
    const iconName = value => String(value || '').replace(/^[a-z]+\//, '').replace(/-/g, ' ');
    function iconCard(l) {
        const type = l.button_icon_type || 'none';
        let html = segmented(Object.assign({}, l, {button_icon_type:type}), 'button_icon_type', 'Type', {none:'None', icon:'Icon', image:'Image'});
        if (type === 'icon') {
            const svg = iconSvg(l.button_icon_svg);
            html += '<div class="wpbn-field"><div class="wpbn-field__head"><span class="wpbn-field__label">Icon</span></div><div class="wpbn-picker"><span class="wpbn-picker__thumb wpbn-icon-thumb">' + svg + '</span>'
                + (svg ? '<p class="wpbn-picker__info"><span class="wpbn-picker__name">' + escape(iconName(l.button_icon)) + '</span><span class="wpbn-picker__size">' + escape(String(l.button_icon || '').split('/')[0]) + '</span></p>' : '')
                + '<span class="wpbn-picker__actions"><button type="button" class="button" data-action="icon-pick">' + (svg ? 'Change' : 'Choose') + '</button></span></div>'
                + note('Font Awesome Free. It takes the button\'s Text color.') + '</div>';
        } else if (type === 'image') {
            const url = images[l.button_icon_image];
            html += '<div class="wpbn-field"><div class="wpbn-field__head"><span class="wpbn-field__label">Image</span></div><div class="wpbn-picker"><span class="wpbn-picker__thumb">' + (url ? '<img src="' + escape(url) + '" alt="">' : '') + '</span>'
                + imageDetails(l.button_icon_image) + '<span class="wpbn-picker__actions"><button type="button" class="button" data-action="icon-image">' + (l.button_icon_image ? 'Change' : 'Choose') + '</button></span></div></div>'
                + withTip(check('button_icon_tint', 'In the text color'), 'The image\'s shape in the button\'s Text color, e.g. a one-color SVG or PNG icon. Off: the image in its own colors.');
        }
        if (type !== 'none') {
            html += segmented(Object.assign({}, l, {button_icon_position:l.button_icon_position || 'right'}), 'button_icon_position', 'Position', {left:'Left', right:'Right'})
                + respRange('button_icon_size', 'Size (px)', {min:6, max:200, to:64, tip:'The icon\'s height; its width follows its proportions.'})
                + respRange('button_icon_gap', 'Gap (px)', {min:0, max:100, to:40, tip:'Between the icon and the text.'});
        }
        return card('Icon', html);
    }
    // The picker: a dialog of the icons (the list loaded once, when it first opens), searched by name and words, by style.
    let iconList = null, iconStyle = '', iconFor = null;
    const ICON_LIMIT = 300;
    function iconDialog() {
        let d = document.getElementById('wpbn-icon-picker');
        if (d) return d;
        d = document.createElement('dialog');
        d.id = 'wpbn-icon-picker'; d.className = 'wpbn-icon-picker'; d.setAttribute('aria-label', 'Choose an icon');
        d.innerHTML = '<div class="wpbn-icon-picker__head"><input type="search" class="wpbn-icon-picker__search" placeholder="Search icons, e.g. arrow, cart, phone" aria-label="Search icons">'
            + '<div class="wpbn-fill-choice wpbn-icon-picker__styles" role="group" aria-label="Style">' + [['', 'All'], ['s', 'Solid'], ['r', 'Regular'], ['b', 'Brands']].map(([v, t]) => '<button type="button" class="wpbn-device-button" data-icon-style="' + v + '" aria-pressed="' + (v === iconStyle) + '">' + t + '</button>').join('') + '</div>'
            + '<button type="button" class="wpbn-icon-button wpbn-icon-picker__close" aria-label="Close"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button></div>'
            + '<div class="wpbn-icon-picker__grid" role="listbox" aria-label="Icons"></div><p class="wpbn-icon-picker__note"></p>';
        document.body.append(d);
        d.querySelector('.wpbn-icon-picker__search').addEventListener('input', drawIcons);
        d.addEventListener('click', e => {
            if (e.target === d || e.target.closest('.wpbn-icon-picker__close')) { d.close(); return; }
            const style = e.target.closest('[data-icon-style]');
            if (style) { iconStyle = style.dataset.iconStyle; d.querySelectorAll('[data-icon-style]').forEach(b => b.setAttribute('aria-pressed', String(b === style))); drawIcons(); return; }
            const pick = e.target.closest('[data-icon]');
            if (pick && iconFor) {
                const [i, letter] = pick.dataset.icon.split(':'), icon = iconList.icons[Number(i)], svg = icon && icon[3][letter];
                if (svg) { iconFor.button_icon = ICON_STYLES[letter] + '/' + icon[0]; iconFor.button_icon_svg = svg[0] + ' ' + svg[1] + '|' + svg[2]; }
                d.close();
                if (scene.layers.includes(iconFor)) { settings(); changed(); const again = $('settings').querySelector('[data-action="icon-pick"]'); if (again) again.focus(); }
            }
        });
        return d;
    }
    function drawIcons() {
        const d = iconDialog(), grid = d.querySelector('.wpbn-icon-picker__grid'), noteEl = d.querySelector('.wpbn-icon-picker__note');
        if (!iconList) { grid.innerHTML = ''; noteEl.textContent = 'Loading the icons…'; return; }
        const words = d.querySelector('.wpbn-icon-picker__search').value.toLowerCase().split(/\s+/).filter(Boolean);
        const found = [];
        iconList.icons.forEach((icon, i) => {
            const text = (icon[0] + ' ' + icon[1] + ' ' + icon[2]).toLowerCase();
            if (!words.every(w => text.includes(w))) return;
            Object.keys(icon[3]).forEach(letter => { if (!iconStyle || iconStyle === letter) found.push([i, letter]); });
        });
        grid.innerHTML = found.slice(0, ICON_LIMIT).map(([i, letter]) => {
            const icon = iconList.icons[i], svg = icon[3][letter], value = ICON_STYLES[letter] + '/' + icon[0], chosen = iconFor && iconFor.button_icon === value;
            return '<button type="button" class="wpbn-icon-picker__icon' + (chosen ? ' is-chosen' : '') + '" role="option" aria-selected="' + chosen + '" data-icon="' + i + ':' + letter + '" title="' + escape(icon[1] + ' (' + ICON_STYLES[letter] + ')') + '">'
                + iconSvg(svg[0] + ' ' + svg[1] + '|' + svg[2]) + '<span class="wpbn-icon-picker__label">' + escape(icon[1]) + '</span></button>';
        }).join('');
        noteEl.textContent = (found.length > ICON_LIMIT ? 'The first ' + ICON_LIMIT + ' of ' + found.length + ' icons: search to find others. ' : found.length ? '' : 'No icons found. ') + 'Font Awesome Free ' + iconList.version + '.';
    }
    function openIcons(l) {
        iconFor = l;
        const d = iconDialog();
        d.querySelector('.wpbn-icon-picker__search').value = '';
        drawIcons();
        d.showModal();
        d.querySelector('.wpbn-icon-picker__search').focus();
        if (!iconList && boot.iconList) {
            fetch(boot.iconList.url).then(r => r.json()).then(list => { iconList = list; drawIcons(); })
                .catch(() => { d.querySelector('.wpbn-icon-picker__note').textContent = 'The icons could not be loaded. Reload the page and try again.'; });
        }
    }
    // A help text behind an "i" icon, shown on a dark tooltip on hover and keyboard focus (as WP Swiper's).
    const tip = text => '<span class="wpbn-tip" tabindex="0" role="img" aria-label="' + escape(text) + '" data-tip="' + escape(text) + '"><span class="dashicons dashicons-info-outline" aria-hidden="true"></span></span>';
    const needs = (html, when) => html.replace('<div class="wpbn-field', '<div data-needs="' + when + '" class="wpbn-field');
    // Every field in html greyed together (a card's worth: a Shape object's Filters, its Shadow block).
    const needsAll = (html, when) => html.replace(/<div class="wpbn-field(?=[ "])/g, '<div data-needs="' + when + '" class="wpbn-field');
    function applyStates() {
        $('settings').querySelectorAll('[data-needs]').forEach(el => {
            const on = !!(NEEDS[el.dataset.needs] && NEEDS[el.dataset.needs]());
            el.classList.toggle('is-disabled', !on);
            el.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = !on; });
        });
    }
    // The image on a device: tablet and mobile 0 = the larger screen's.
    const imageKey = d => d === 'desktop' ? 'image' : 'image_' + d;
    function imageFor(l, d) {
        if (d === 'mobile' && l.image_mobile) return l.image_mobile;
        if (d !== 'desktop' && l.image_tablet) return l.image_tablet;
        return l.image;
    }
    // Which device's values the fields show: desktop's are followed by the smaller screens; tablet's and mobile's without a green dot follow the larger screen.
    const deviceNote = d => d === 'desktop' ? 'Desktop values. Tablet and mobile follow them, except settings given their own values there (a green dot on the device).'
        : DEVICES[d][1] + ' values. Settings without a green dot follow ' + DEVICES[UP[d]][1] + '; clear a number to follow it again.';
    function picker(layer) {
        const d = device(), own = layer[imageKey(d)], id = imageFor(layer, d), url = images[id];
        const inherit = d !== 'desktop' && !own;
        // One row: the thumbnail, the file's name and size, then Change at the right end. No Remove on
        // desktop (an image layer has an image); tablet / mobile can go back to the larger screen's.
        // The device note is an "i" beside Image on every device (user's request), not the note above the blocks.
        return '<div class="wpbn-field" data-base="image"><div class="wpbn-field__head"><span class="wpbn-field__label">Image</span>' + tip(deviceNote(d)) + devices({tablet:!!layer.image_tablet, mobile:!!layer.image_mobile}) + '</div><div class="wpbn-picker"><span class="wpbn-picker__thumb">' + (url ? '<img src="' + escape(url) + '" alt="">' : '') + '</span>'
            + imageDetails(id)
            + '<span class="wpbn-picker__actions"><button type="button" class="button" data-action="image">' + (own ? 'Change' : inherit ? 'Choose its own' : 'Choose') + '</button>'
            + (own && d !== 'desktop' ? '<button type="button" class="button-link wpbn-picker__remove" data-action="clear">Use ' + DEVICES[UP[d]][1] + '\'s</button>' : '') + '</span></div>'
            + note(d === 'desktop' ? '' : inherit ? 'Same as ' + DEVICES[UP[d]][1] + '. Choose a photo of its own for this device, such as a taller crop.' : 'A photo of its own on this device; it should match the other image layers\' crops.') + '</div>';
    }
    // The chosen image's file name, pixel size and weight.
    function imageDetails(id) {
        const i = imageInfo[id];
        if (!id || !i) return '';
        const size = [i.width && i.height ? i.width + ' × ' + i.height + ' px' : '', i.size || ''].filter(Boolean).join(' · ');
        return '<p class="wpbn-picker__info"><span class="wpbn-picker__name">' + escape(i.name || '') + '</span>' + (size ? '<span class="wpbn-picker__size">' + escape(size) + '</span>' : '') + '</p>';
    }
    // Position: an outline button (its icon and name) and the value under it. For an image it is the
    // point kept in view (one for every device, as in WP Swiper); for text, where it stands on this device.
    // Position's button, and its value for under it (an image: the point in view; text: where it stands on this device).
    // place: where the layer stands (an image object's box), not the point of its photo in view.
    function positionParts(layer, place) {
        const d = device(), image = layer.type === 'image' && !!images[layer.image] && !place;
        const mine = !image && d !== 'desktop' && (layer[dkey('x', d)] != null || layer[dkey('y', d)] != null);
        const value = image ? escape(layer.focus_x) + '% ' + escape(layer.focus_y) + '%' : escape(eff(layer, 'x', d)) + '% ' + escape(eff(layer, 'y', d)) + '%';
        return {
            button: '<button type="button" class="button wpbn-position-button" data-action="position" data-kind="' + (place ? 'place' : 'focus') + '">' + icons.position + '<span>' + (image && imageObject(layer) ? 'Image position' : 'Position') + '</span></button>',
            value: '<p class="wpbn-position-value">' + value + (mine ? ' <button type="button" class="button-link wpbn-position-reset" data-action="position-inherit">Use ' + DEVICES[UP[d]][1] + '\'s</button>' : '') + '</p>'
        };
    }
    // A placed layer (a title, a text, a button, an overlay, an image object): its Container; its Position is the button on its
    // tile (user's request, 2026-11-09). On tablet / mobile with a Position of its own: the value and a link back to the larger screen's.
    function containerPositionField(layer) {
        const d = device(), mine = d !== 'desktop' && (layer[dkey('x', d)] != null || layer[dkey('y', d)] != null);
        return containerSelect(layer) + (mine ? '<p class="wpbn-position-value wpbn-position-own">Position of its own on ' + DEVICES[d][1] + ': ' + escape(eff(layer, 'x', d)) + '% ' + escape(eff(layer, 'y', d)) + '%. <button type="button" class="button-link wpbn-position-reset" data-action="position-inherit">Use ' + DEVICES[UP[d]][1] + '\'s</button></p>' : '');
    }
    // An image layer: Image fit. An image object also has Image position beside it (the point of its photo in view; its
    // Position, where it stands, is the tile's), its value under the button (laid out by a grid in admin.css).
    function fitPositionField(layer) {
        if (!imageObject(layer)) return respSelect('fit', 'Image fit', {cover:'Cover', contain:'Contain'});
        const p = positionParts(layer);
        return respSelect('fit', 'Image fit', {cover:'Cover', contain:'Contain'}, p.button + p.value).replace('<div class="wpbn-field"', '<div class="wpbn-field wpbn-position wpbn-fit-position"');
    }

    // An overlay's fill as CSS: its gradient (with its switch on) or its colour.
    const overlayFill = l => (l.use_gradient && gradientCss(l.gradient)) || l.color || 'transparent';

    /*
     * Shape layers (WPBN_Shape): an SVG whose objects are listed under the layer's row and drawn in its card,
     * where a click chooses one. The SVG comes from the server already cleaned (only shapes' geometry).
     */
    // Each object's markup by its key, read once from the SVG.
    function shapeParts(data) {
        if (!data.parts) {
            data.parts = {};
            const doc = new DOMParser().parseFromString(data.svg, 'image/svg+xml');
            doc.querySelectorAll('g[data-key]').forEach(g => { data.parts[g.getAttribute('data-key')] = new XMLSerializer().serializeToString(g).replace(/^<g[^>]*>|<\/g>$/g, ''); });
        }
        return data.parts;
    }
    // The layer's SVG, its objects in the layer's order (the back one first), the chosen one lit, hidden ones as outlines.
    // only: that object alone, framed by its own box (an object's thumbnail in the list).
    function shapeSvg(l, active, className, only) {
        const data = shapes[l.shape];
        if (!data) return '';
        const parts = shapeParts(data);
        let vb = data.viewbox.map(Number);
        const own = only != null && l.shape_objects[only] ? shapeBoxes(data)[l.shape_objects[only].key] : null;
        if (own && own.width > 0 && own.height > 0) { const pad = Math.max(own.width, own.height) * 0.06; vb = [own.x - pad, own.y - pad, own.width + pad * 2, own.height + pad * 2]; }
        return '<svg' + (className ? ' class="' + className + '"' : '') + ' viewBox="' + vb.map(n => Math.round(n * 100) / 100).join(' ') + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'
            + (l.shape_objects || []).map((o, j) => parts[o.key] == null || (only != null && only !== j) ? '' : '<g data-object="' + j + '" class="wpbn-shape-object' + (j === active ? ' is-active' : '') + (o.hidden ? ' is-hidden' : '') + '">' + parts[o.key] + '</g>').join('')
            + '</svg>';
    }
    // Objects without a name of their own: numbered in reading order (rows from the top, left to right in a row),
    // not in the file's order (a drawing program writes them as they were drawn).
    // Each object's box in the drawing's units, by its key (measured once, in an SVG drawn out of sight).
    function shapeBoxes(data) {
        if (!data.boxes) {
            data.boxes = {};
            const box = document.createElement('div');
            box.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:400px;visibility:hidden';
            box.innerHTML = data.svg;
            document.body.append(box);
            data.objects.forEach(o => {
                let b = {x:0, y:0, width:0, height:0};
                try { const r = box.querySelector('[data-key="' + o.key + '"]').getBBox(); b = {x:r.x, y:r.y, width:r.width, height:r.height}; } catch (error) { /* Not drawn: no box. */ }
                data.boxes[o.key] = b;
            });
            box.remove();
        }
        return data.boxes;
    }
    function shapeNumbers(data) {
        const boxes = shapeBoxes(data);
        const items = data.objects.map((o, i) => { const b = boxes[o.key]; return {i, x:b.x + b.width / 2, y:b.y + b.height / 2, h:b.height}; });
        const numbers = {};
        items.slice().sort((a, b) => Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2 ? a.y - b.y : a.x - b.x).forEach((item, n) => { numbers[item.i] = n + 1; });
        return numbers;
    }
    const SKIPPED_NAMES = {text:'text not turned into outlines', image:'embedded pictures', use:'references to other objects (<use>)', line:'lines', other:'other elements'};
    function shapeField(l) {
        const data = shapes[l.shape], vb = data ? data.viewbox : null;
        const skipped = data ? Object.entries(data.skipped || {}).map(([kind, n]) => n + ' × ' + (SKIPPED_NAMES[kind] || kind)).join(', ') : '';
        let html = '<div class="wpbn-field"><div class="wpbn-picker"><span class="wpbn-picker__thumb">' + (data ? shapeSvg(l, -1) : '<span class="dashicons dashicons-art" aria-hidden="true"></span>') + '</span>'
            + (data ? '<p class="wpbn-picker__info"><span class="wpbn-picker__name">' + escape(data.name) + '</span><span class="wpbn-picker__size">' + l.shape_objects.length + (l.shape_objects.length === 1 ? ' object' : ' objects') + ' · ' + Math.round(vb[2]) + ' × ' + Math.round(vb[3]) + '</span></p>'
                : '<p class="wpbn-picker__info">An SVG with several objects, e.g. three strips or a torn edge.</p>')
            + '<span class="wpbn-picker__actions"><button type="button" class="button" data-action="shape-upload"' + (shapeBusy ? ' disabled' : '') + '>' + (shapeBusy ? 'Uploading…' : data ? 'Replace' : 'Upload SVG') + '</button></span></div>'
            + (shapeError ? '<p class="wpbn-shape-error" role="alert">' + escape(shapeError) + '</p>' : '')
            + (skipped ? note('Left out: ' + escape(skipped) + '. Only filled shapes become objects.') : '') + '</div>';
        if (data) {
            html += '<div class="wpbn-shape-canvas" style="aspect-ratio:' + Number(vb[2]) + '/' + Number(vb[3]) + '">' + shapeSvg(l, selectedObject, 'wpbn-shape-svg') + '</div>'
                + note('Click an object to choose it (or choose it under the layer in the list). Objects further down the list are behind the others.');
        }
        return html;
    }
    /*
     * A layer's (or the scene's) settings as blocks (2026-11-09, user's request: as WP Swiper's settings box): the menu in
     * the left column (#wpbn-menu) names them, the chosen one shows beside it. Each block: [key, title, dashicon, html, on, tip];
     * one without html is left out; on: something in it switched on (a green dot), e.g. an animation. The block chosen
     * stays as another layer is chosen (setting one thing on every layer in turn); a layer without it opens on its first.
     * Every block is in the page, the others hidden: choosing one shows it (showBlock()), nothing is drawn again.
     */
    let block = 'content', menuHtml = '', blockTitles = {}, blockTips = {}, shownBlock = '';
    // The section's title: the block shown (user's request, 2026-11-09: not "Layer settings" over a card of the same name).
    const legend = '<legend id="wpbn-block-title"></legend>';
    function blocks(list) {
        list = list.filter(b => b && b[3]);
        const shown = list.some(b => b[0] === block) ? block : list.length ? list[0][0] : '';
        blockTitles = Object.fromEntries(list.map(b => [b[0], b[1]])); blockTips = Object.fromEntries(list.map(b => [b[0], b[5] || ''])); shownBlock = shown;
        menuHtml = list.map(([key, title, icon, , on]) => '<button type="button" class="wpbn-menu-item" data-block="' + key + '" aria-controls="wpbn-block-' + key + '" aria-current="' + (key === shown) + '">'
            + '<span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span><span class="wpbn-menu-item__title">' + title + '</span>'
            + (on ? '<span class="wpbn-menu-item__dot" aria-hidden="true"></span><span class="screen-reader-text"> (on)</span>' : '') + '</button>').join('');
        return list.map(([key, , , html]) => '<div class="wpbn-block" id="wpbn-block-' + key + '" data-block-pane="' + key + '"' + (key === shown ? '' : ' hidden') + '>' + html.replace(/^<div class="wpbn-card"><p class="wpbn-subheading">[^<]*<\/p>/, '<div class="wpbn-card">') + '</div>').join('');
    }
    // The section's title: the block's name, with its help behind an "i" where it has one (Scroll animation, Follow the mouse).
    function blockTitle(k) { $('block-title').innerHTML = escape(blockTitles[k] || '') + (blockTips[k] ? tip(blockTips[k]) : ''); }
    function showBlock(k) {
        block = k; shownBlock = k;
        blockTitle(k);
        $('menu').querySelectorAll('[data-block]').forEach(b => b.setAttribute('aria-current', String(b.dataset.block === k)));
        $('settings').querySelectorAll('.wpbn-block').forEach(p => { p.hidden = p.dataset.blockPane !== k; });
        // The pickers belong to the block left; the text editor starts once its block shows.
        closePicker(); closeFonts(); startEditor(); refreshFontSample(); drawGradient();
    }
    // A layer's name (the layer list shows it), the top field of its settings.
    const nameField = () => '<div class="wpbn-field">' + head('wpbn-f-name', 'Name') + '<input id="wpbn-f-name" class="widefat" data-key="name" type="text" maxlength="80" value="' + escape(current().name || '') + '"></div>';
    // A layer's turn around its middle, per device (degrees, clockwise; WPBN_Settings::RESPONSIVE rotate).
    /*
     * Scroll animation: no switch (user's request, 2026-11-09): its values apply as set, at rest (0 travel, 0 zoom, Opacity at
     * the end as its Opacity) nothing moves (WPBN_Settings::sanitize()). Its help: the tip beside the section's title (SCROLL_TIP).
     */
    const SCROLL_TIP = 'Moves the layer as the page scrolls: from where it is at the top of the page to these values once the banner has scrolled out of view.';
    const scrollCard = (o, fields) => card('Scroll animation', fields);
    // Something moves as the page scrolls (the green dot on Scroll animation): a travel or zoom on some device, or an Opacity at the end
    // other than its Opacity (100% without its switch).
    function scrolls(o) {
        const own = k => [o[k], o[k + '_tablet'], o[k + '_mobile']].some(v => v != null && Number(v) !== 0);
        if (['move_x', 'move_y', 'zoom'].some(own)) return true;
        if (o.end_opacity == null) return false;
        return Object.keys(DEVICES).some(d => Number(eff(o, 'end_opacity', d)) !== (o.use_opacity && o.type === 'image' ? Number(eff(o, 'opacity', d)) : 100));
    }
    // Behind its switch (as Scale): off, the switch alone; on, the slider per device. No tip (user's request, 2026-11-09).
    const rotateField = () => respRange('rotate', 'Rotation (°)', {min:-180, max:180, from:-180, to:180});
    // Filters (an image layer's, a Shape object's): WPBN_Settings::FILTERS; per device since 2026-11-10 (user's request).
    const FILTER_FIELDS = [['f_grayscale', 'Black and white (%)', 0, 100], ['f_blur', 'Blur (px)', 0, 40], ['f_brightness', 'Brightness (%)', 0, 200], ['f_contrast', 'Contrast (%)', 0, 200], ['f_saturate', 'Saturation (%)', 0, 300]];
    const filterFields = () => FILTER_FIELDS.map(([key, label, min, max]) => respRange(key, label, {min, max})).join('');
    // An overlay's Filters (user's request, 2026-11-10, as an image's): of the layers under it, where it covers them
    // (backdrop-filter). Its Blur per device, then the image's others.
    const TONE_FIELDS = FILTER_FIELDS.filter(([key]) => key !== 'f_blur');
    // Its Blur as the Filters' fields (user's request, 2026-11-10): the slider 0–50px, the number up to 100.
    const overlayFilterFields = () => respRange('backdrop_blur', 'Blur (px)', {min:0, max:100, to:50,
        tip:'Blurs the layers under this one where it covers them, like frosted glass; 0: none. Every filter here changes the layers under the overlay (not its own color); they show through a see-through color or gradient.'})
        + TONE_FIELDS.map(([key, label, min, max]) => respRange(key, label, {min, max})).join('');
    // Its backdrop-filter on a device (WPBN_Render), its Blur in px given; '' for none.
    function backdropCss(l, blur, d) {
        const parts = blur ? ['blur(' + blur + 'px)'] : [];
        TONE_FIELDS.forEach(([key]) => { const v = Number(eff(l, key, d || 'desktop') ?? DEFAULTS[key]); if (v !== DEFAULTS[key]) parts.push(key.slice(2) + '(' + v + '%)'); });
        return parts.join(' ');
    }
    // What fills an object (WPBN_Shape::FILLS).
    const FILL_NAMES = {layer:'Photo', image:'Image', color:'Color', glass:'Glass', none:'None'};
    // A Shape layer's settings: its SVG and how it fits the scene; with an object chosen, that object's.
    function shapeSettings(l) {
        const o = selectedObject >= 0 ? (l.shape_objects || [])[selectedObject] : null;
        const svg = card('Shape', (o ? '' : nameField()) + withTip(shapeField(l).replace('<div class="wpbn-field">', '<div class="wpbn-field"><div class="wpbn-field__head"><label>SVG</label></div>'), 'Draw the objects in Illustrator, Figma or Inkscape and export as SVG: filled shapes, text turned into outlines, no embedded pictures. Groups count as one object; name them in the Layers panel to find them here.'));
        if (!o) {
            return legend + blocks([['content', 'Shape', 'art', svg
                + '<p class="description wpbn-after-cards">Choose an object (in the drawing or under the layer\'s tile) to set what fills it, its edge, shadow and motion. The layer itself stays in place.</p>'],
                ['fit', 'Fit', 'editor-contract', shapes[l.shape] ? card('Fit', withTip(respSelect('shape_fit', 'Fit in the scene', {cover:'Cover', contain:'Contain', stretch:'Stretch'}),
                    'Cover: the drawing fills the scene, its edges cropped where the scene is narrower or wider. Contain: all of it shows, inside the scene. Stretch: as wide and tall as the scene, out of its proportions. Choose a device to give it its own.')) : '']]);
        }
        let fill = '';
        if (o.fill === 'layer') {
            const sources = scene.layers.filter(x => x.type === 'image' && x.uid);
            const list = {'':'— Choose a layer —'};
            sources.forEach(x => { list[x.uid] = escape(x.name); });
            fill = sources.length ? withTip(select('source', 'Photo of the layer', list), 'The object shows this image layer exactly where it is, and as it moves: a window onto it. Give it Filters other than the layer\'s, e.g. the layer in black and white and the object in color. A hidden layer shows only through its objects.')
                : note('Add an image layer first: the object will show its photo, lined up with it.');
        } else if (o.fill === 'image') {
            const url = images[o.image];
            fill = '<div class="wpbn-field"><div class="wpbn-field__head"><span class="wpbn-field__label">Image</span></div><div class="wpbn-picker"><span class="wpbn-picker__thumb">' + (url ? '<img src="' + escape(url) + '" alt="">' : '') + '</span>'
                + imageDetails(o.image) + '<span class="wpbn-picker__actions"><button type="button" class="button" data-action="object-image">' + (o.image ? 'Change' : 'Choose') + '</button></span></div>'
                + note('A picture of its own, covering the scene: the object shows the part of it under its shape.') + '</div>';
        } else if (o.fill === 'color') {
            fill = fillChoice(o) + (o.use_gradient ? gradientField(o) : colorField('color', 'Color', {alpha:true, def:'#ffffff'}));
        } else if (o.fill === 'glass') {
            fill = range('glass_blur', 'Blur (px)', {min:0, max:60, note:'How strongly the layers behind it are blurred, as frosted glass.'})
                + colorField('glass_color', 'Tint', {alpha:true, def:'rgba(255,255,255,0.15)', note:'A see-through color over the blur; fully transparent: none.'});
        } else {
            fill = note('Nothing inside it: only its Edge and Shadow show, e.g. a frame.');
        }
        const choice = '<div class="wpbn-field">' + head('wpbn-f-fill', 'Fill') + '<div class="wpbn-fill-choice wpbn-fill-choice--wrap" role="group" aria-label="Fill">'
            + Object.entries(FILL_NAMES).map(([value, name], i) => '<button type="button" class="wpbn-device-button"' + (i ? '' : ' id="wpbn-f-fill"') + ' data-choice="fill" data-value="' + value + '" aria-pressed="' + (o.fill === value) + '">' + name + '</button>').join('') + '</div></div>';
        // The drawing stays above the object's blocks: a click in it chooses another object.
        return legend + svg + blocks([['content', 'Object', 'marker', card('Object', '<div class="wpbn-field">' + head('wpbn-f-object-name', 'Name') + '<input type="text" id="wpbn-f-object-name" class="widefat" data-object-name value="' + escape(o.name) + '"></div>'
                + range('opacity', 'Opacity (%)', {min:0, max:100})
                + withTip(check('invert', 'Invert'), 'The object becomes a hole: its fill covers the whole scene except the object\'s shape, e.g. a panel with a window cut in it.')
                + '<p><button type="button" class="button" data-object-hide="' + selectedObject + '" data-layer="' + selected + '">' + (o.hidden ? 'Show the object' : 'Hide the object') + '</button> <button type="button" class="button-link" data-action="object-none">Layer settings</button></p>')],
            ['fill', 'Fill', 'art', card('Fill', choice + fill)],
            // Greyed where they do not apply (the values kept): Filters change a picture (Photo, Image); glass has no Edge or
            // Shadow (a filter around it would leave it nothing to blur: an object with Fill None and an Edge over it instead).
            ['filters', 'Filters', 'image-filter', card('Filters', needsAll(filterFields(), 'pictured'))],
            ['edge', 'Edge and shadow', 'admin-appearance', card('Edge and shadow', withTip(needs(range('stroke', 'Edge (px)', {min:0, max:30}), 'edged'), 'A solid line around it, e.g. the white edge of torn paper; 0: none. Glass has none, nor a Shadow: put an object with Fill None and an Edge over it instead.')
                + needs(colorField('stroke_color', 'Edge color', {alpha:true, def:'#ffffff'}), 'stroke') + needsAll(shadowField(o), 'edged'))],
            ['scroll', 'Scroll animation', 'sort', scrollCard(o, range('move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'How far the object moves by the end of the scroll; negative: to the left. What it shows stays in place.'})
                + range('move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'Negative: up.'})), scrolls(o), SCROLL_TIP]]);
    }
    // An SVG chosen on this computer: sent to the server, which cleans it and keeps it as the plugin's own record (WPBN_Shape: not in the media library).
    function uploadShape(l) {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.svg,image/svg+xml';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const body = new FormData();
            body.append('action', 'wpbn_shape_upload'); body.append('nonce', boot.shapeNonce || ''); body.append('file', file);
            shapeBusy = true; shapeError = ''; settings();
            const failed = message => Object.assign(new Error(message), {shown:true});
            fetch(boot.endpoint, {method:'POST', body, credentials:'same-origin'})
                .then(response => response.json())
                .then(result => {
                    if (!result || !result.success || !result.data) throw failed(result && result.data && result.data.message || 'The SVG could not be uploaded.');
                    const data = result.data, numbers = shapeNumbers(data);
                    shapes[data.id] = data;
                    // A new object shows the back image layer's photo (a window onto it), or white without one.
                    // A file replaced: its objects keep their settings by their place in it (o1, o2…), their names are the new file's.
                    const source = scene.layers.find(x => x.type === 'image' && x.uid), before = {};
                    (l.shape_objects || []).forEach(o => { before[o.key] = o; });
                    l.shape = data.id;
                    l.shape_objects = data.objects.map((o, i) => Object.assign({}, data.defaults || {}, {fill:source ? 'layer' : 'color', source:source ? source.uid : ''}, before[o.key] || {},
                        {key:o.key, name:o.name || 'Object ' + numbers[i], hidden:before[o.key] ? !!before[o.key].hidden : false}));
                    if (scene.layers.includes(l)) changed();
                })
                .catch(error => { shapeError = error && error.shown ? error.message : 'The SVG could not be uploaded. Reload the page and try again.'; })
                .finally(() => {
                    shapeBusy = false;
                    if (scene.layers[selected] === l) { selectedObject = -1; list(); settings(); } else list();
                });
        };
        input.click();
    }
    /*
     * An overlay's thumbnail (user's requests, 2026-11-09): the layer alone, not the scene: its box in its proportions (its desktop
     * Width and Height in the scene), as large as fits, over the checkerboard, in its fill, with its blur (of the checkerboard
     * behind it) and its shadow made as small as the box is.
     */
    function overlayThumb(l) {
        const d = 'desktop', sw = sceneWidth(d), sh = sceneHeight(d);
        const pw = Math.max(1, Math.min(100, overlayWidth(l, d)) / 100 * sw), ph = Math.max(1, overlayHeight(l, d) / 100 * sh), ratio = pw / ph;
        // In % of the thumbnail (4:3), 86% of it at most on its long side.
        const w = ratio > 4 / 3 ? 86 : 86 * ratio * 3 / 4, h = ratio > 4 / 3 ? 86 * 4 / 3 / ratio : 86;
        const k = 132 * w / 100 / pw, blur = Number(eff(l, 'backdrop_blur', d)) || 0, backdrop = backdropCss(l, blur ? Math.max(1.5, blur * k) : 0);
        const shadow = l.use_shadow ? (l.shadow_inset ? 'inset ' : '') + l.shadow_x * k + 'px ' + l.shadow_y * k + 'px ' + l.shadow_blur * k + 'px ' + l.shadow_color : '';
        const style = 'left:' + (100 - w) / 2 + '%;top:' + (100 - h) / 2 + '%;width:' + w + '%;height:' + h + '%;background:' + overlayFill(l) + ';'
            + (backdrop ? 'backdrop-filter:' + backdrop + ';' : '') + (shadow ? 'box-shadow:' + shadow + ';' : '');
        return '<span class="wpbn-layer-thumb wpbn-layer-thumb--overlay" aria-hidden="true"><span class="wpbn-overlay-thumb" style="' + escape(style) + '"></span></span>';
    }
    // Layers: tiles from the back one (1) to the front one, so a new layer, put in front, is the last tile, beside Add element
    // (user's request, 2026-11-09). Each tile selects its layer; its icons hide, place, copy or remove it; drag (or Alt + arrows) reorders.
    function list() {
        devSync();
        const box = $('layers');
        box.replaceChildren();
        // No layers yet: only Add element beside the strip, no hint (user's request, 2026-11-10).
        if (!scene.layers.length) return;
        for (let i = 0; i < scene.layers.length; i++) {
            const l = scene.layers[i], name = escape(l.name || TYPE_NAMES[l.type] || 'Layer');
            // Not draggable: the browser's own image drag would stop the row's.
            const thumb = l.type === 'overlay'
                ? overlayThumb(l)
                : l.type === 'shortcode'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--shortcode" aria-hidden="true"><span class="dashicons dashicons-shortcode"></span></span>'
                : l.type === 'button'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--button" aria-hidden="true"><span class="dashicons dashicons-button"></span></span>'
                : l.type === 'richtext'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--richtext" aria-hidden="true"><span class="wpbn-thumb-word">Text</span></span>'
                : l.type === 'text'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--text" aria-hidden="true"><span class="wpbn-thumb-word">Title</span></span>'
                : l.type === 'shape'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--shape" aria-hidden="true">' + (shapes[l.shape] ? shapeSvg(l, -1) : '<span class="dashicons dashicons-art"></span>') + '</span>'
                : '<span class="wpbn-layer-thumb" aria-hidden="true">' + (images[l.image] ? '<img src="' + escape(images[l.image]) + '" alt="" draggable="false">' : '<span class="dashicons dashicons-format-image"></span>') + '</span>';
            // Its number (1: the back layer) in the thumbnail's corner.
            const numbered = thumb.replace(/<\/span>$/, '<span class="wpbn-tile__number">' + (i + 1) + '</span></span>');
            const row = document.createElement('div');
            row.className = 'wpbn-layer-row wpbn-tile' + (i === selected ? ' is-active' : '') + (l.hidden ? ' is-hidden' : '');
            row.setAttribute('role', 'listitem');
            row.dataset.index = i;
            // Its thumbnail, name and kind; between the thumbnail and the name (admin.css): hide and duplicate at the left, delete at the right.
            row.innerHTML = '<button type="button" class="wpbn-layer-select" data-select="' + i + '" aria-current="' + (i === selected) + '" title="Drag, or Alt + ← / →, to change the depth">' + numbered
                + '<span class="wpbn-layer-label">' + name + '<small>' + (TYPE_NAMES[l.type] || 'Image') + (l.hidden ? ' · hidden' : '') + '</small></span></button>'
                + '<span class="wpbn-layer-tools">'
                + '<button type="button" class="wpbn-icon-button" data-row-action="hide" data-index="' + i + '" aria-pressed="' + l.hidden + '" aria-label="' + (l.hidden ? 'Show ' : 'Hide ') + name + '" title="' + (l.hidden ? 'Show' : 'Hide') + '"><span class="dashicons dashicons-' + (l.hidden ? 'hidden' : 'visibility') + '" aria-hidden="true"></span></button>'
                // Position (not a Shape layer's): where it stands, or a photo filling the scene its point in view; its value in its title
                // (the browser's tooltip on hover, as Hide's and Duplicate's).
                + (l.type === 'shape' ? '' : '<button type="button" class="wpbn-icon-button wpbn-tile-position" data-row-action="position" data-index="' + i + '" data-kind="' + (anchored(l) ? 'place' : 'focus') + '" aria-label="' + escape(positionTip(l)) + ' (' + name + ')" title="' + escape(positionTip(l)) + '">' + icons.position + '</button>')
                + '<button type="button" class="wpbn-icon-button" data-row-action="duplicate" data-index="' + i + '" aria-label="Duplicate ' + name + '" title="Duplicate"' + (scene.layers.length >= 40 ? ' disabled' : '') + '>' + icons.clone + '</button>'
                + '</span><span class="wpbn-layer-tools wpbn-layer-tools--end">'
                + '<button type="button" class="wpbn-icon-button wpbn-icon-button--danger" data-row-action="delete" data-index="' + i + '" aria-label="Delete ' + name + '" title="Delete"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button>'
                + '</span>';
            // A Shape layer's objects in its tile, under its name, the front one at the top.
            if (l.type === 'shape' && shapes[l.shape]) {
                const objects = document.createElement('div');
                objects.className = 'wpbn-objects';
                objects.setAttribute('role', 'list');
                for (let j = l.shape_objects.length - 1; j >= 0; j--) {
                    const o = l.shape_objects[j], label = escape(o.name || 'Object'), active = i === selected && j === selectedObject;
                    const sub = document.createElement('div');
                    sub.className = 'wpbn-object-row' + (active ? ' is-active' : '') + (o.hidden || l.hidden ? ' is-hidden' : '');
                    sub.setAttribute('role', 'listitem');
                    sub.innerHTML = '<button type="button" class="wpbn-object-select" data-object="' + j + '" data-layer="' + i + '" aria-current="' + active + '"><span class="wpbn-object-thumb" aria-hidden="true">' + shapeSvg(l, j, '', j) + '</span><span class="wpbn-layer-label">' + label + '</span></button>'
                        + '<button type="button" class="wpbn-icon-button" data-object-hide="' + j + '" data-layer="' + i + '" aria-pressed="' + !!o.hidden + '" aria-label="' + (o.hidden ? 'Show ' : 'Hide ') + label + '" title="' + (o.hidden ? 'Show' : 'Hide') + '"><span class="dashicons dashicons-' + (o.hidden ? 'hidden' : 'visibility') + '" aria-hidden="true"></span></button>';
                    objects.append(sub);
                }
                row.append(objects);
            }
            box.append(row);
        }
    }
    function focusRow(index, action) {
        const el = $('layers').querySelector(action ? '[data-row-action="' + action + '"][data-index="' + index + '"]' : '[data-select="' + index + '"]');
        if (el) el.focus(); else $('scene-settings').focus();
    }
    function move(from, to) {
        if (from === to || to < 0 || to >= scene.layers.length) return false;
        const keep = scene.layers[selected];
        const [layer] = scene.layers.splice(from, 1);
        scene.layers.splice(to, 0, layer);
        selected = keep ? scene.layers.indexOf(keep) : -1;
        list(); changed();
        return true;
    }
    // The value the tile's Position button shows on hover: where the layer stands on the device being edited, or, for a photo
    // filling the scene, the point of it kept in view (on every device).
    function positionTip(l) {
        const d = device();
        if (!anchored(l) && l.type === 'image' && images[l.image]) return 'Image position: ' + l.focus_x + '% ' + l.focus_y + '%';
        return 'Position' + (d === 'desktop' ? '' : ' on ' + DEVICES[d][1]) + ': ' + eff(l, 'x', d) + '% ' + eff(l, 'y', d) + '%';
    }
    function rowAction(action, index) {
        const l = scene.layers[index];
        if (!l) return;
        const keep = scene.layers[selected];
        // Position: the layer chosen (its settings shown), then its Position window.
        if (action === 'position') {
            if (index !== selected || selectedObject >= 0) { selected = index; selectedObject = -1; list(); settings(); }
            openPosition(l, $('layers').querySelector('[data-row-action="position"][data-index="' + index + '"]'));
            return;
        }
        if (action === 'hide') {
            l.hidden = !l.hidden;
            list(); changed(); focusRow(index, 'hide');
        } else if (action === 'duplicate') {
            if (scene.layers.length >= 40) return;
            // A deep copy: a Shape layer's objects are its own, not shared with the original.
            scene.layers.splice(index + 1, 0, Object.assign(JSON.parse(JSON.stringify(l)), {name: l.name + ' copy', uid: newUid()}));
            selected = index + 1; selectedObject = -1;
            list(); settings(); changed(); focusRow(selected);
        } else if (action === 'delete') {
            scene.layers.splice(index, 1);
            selected = l === keep ? Math.min(index, scene.layers.length - 1) : keep ? scene.layers.indexOf(keep) : -1;
            list(); settings(); changed(); focusRow(selected);
        }
    }

    // Height per device as in WP Swiper: the number and its unit on one row.
    const HEIGHT = {desktop:['height','height_unit',720], tablet:['tablet_height','tablet_height_unit',600], mobile:['mobile_height','mobile_height_unit',540]};
    const UNIT_HELP = {
        px: 'A fixed height.',
        vh: 'A share of the screen height: 100 is the whole screen.',
        '%': 'A share of the height of the block around the scene; that block needs a height of its own (otherwise 500px).',
        auto: 'Fills the free height of the column around the scene; where there is none, 500px. In the preview: the screen height.'
    };
    // A device's height as [number, unit]: tablet and mobile without a unit of their own take the larger screen's (as WPBN_Settings::heights()).
    // An overlay's Width per device, kept as its Height is (WPBN_Settings::OVERLAY_WIDTHS): % of its container, px or vw.
    const WIDTH = {desktop:['overlay_width','overlay_width_unit',100], tablet:['tablet_overlay_width','tablet_overlay_width_unit',100], mobile:['mobile_overlay_width','mobile_overlay_width_unit',100]};
    // A title's or a Text layer's Width per device (WPBN_Settings::TEXT_WIDTHS): Auto (its text's), % of its container, px or vw.
    const TEXT_WIDTH = {desktop:['text_width','text_width_unit',600], tablet:['tablet_text_width','tablet_text_width_unit',600], mobile:['mobile_text_width','mobile_text_width_unit',600]};
    const SIZE = {height:HEIGHT, width:WIDTH, textwidth:TEXT_WIDTH};
    // A device's size as [number, unit]: tablet and mobile without a unit of their own take the larger screen's (as WPBN_Settings::heights()).
    function effSize(kind, d, obj) {
        const [key, unitKey] = SIZE[kind][d];
        return obj[unitKey] == null && d !== 'desktop' ? effSize(kind, UP[d], obj) : [obj[key], obj[unitKey]];
    }
    const effHeight = (d, obj) => effSize('height', d, obj || scene);
    const UNIT_NAMES = {auto:'Auto', px:'px', vh:'vh', vw:'vw', '%':'%'};
    // An overlay's Height and Width (WPBN_Settings::LAYER_UNITS, WIDTH_UNITS): no Auto; in %, at most all of the scene / its container.
    const LAYER_UNITS = {height:['%', 'px', 'vh'], width:['%', 'px', 'vw'], textwidth:['auto', '%', 'px', 'vw']};
    const LAYER_UNIT_HELP = {
        height:{'%':'A share of the scene\'s height: 100 is all of it.', px:'A fixed height.', vh:'A share of the screen height: 100 is the whole screen.'},
        width:{'%':'A share of its container: 100 is all of it.', px:'A fixed width.', vw:'A share of the screen width: 100 is the whole screen.'},
        // A title's or a Text layer's: its lines wrap at it, and it is never wider than its container.
        textwidth:{auto:'As wide as its text: lines break only at the edge of its container.', '%':'A share of its container: the lines wrap there; 100 is all of it.',
            px:'A fixed width: the lines wrap there (never wider than its container).', vw:'A share of the screen width: the lines wrap there (never wider than its container).'},
        // An image object's Height: Auto, the image's own proportions at its Width.
        image:{auto:'As tall as the image at its width (its own proportions): nothing is cropped.', '%':'A share of the scene\'s height: 100 is all of it.', px:'A fixed height.', vh:'A share of the screen height: 100 is the whole screen.'}
    };
    // The scene's Height, or (obj: an overlay) the layer's Height or Width (kind), as the scene's Height: the number,
    // its unit, Inherit on tablet / mobile.
    // Its green dots: desktop with a height (or width) and unit other than the standard ones, tablet / mobile with a unit of their own.
    const heightDots = (o, k) => ({desktop:!isStandard(o, SIZE[k].desktop[0]) || !isStandard(o, SIZE[k].desktop[1]), tablet:o[SIZE[k].tablet[1]] != null, mobile:o[SIZE[k].mobile[1]] != null});
    function heightField(obj, kind) {
        const layer = !!obj, o = obj || scene, k = kind || 'height', wide = k !== 'height', label = wide ? 'Width' : 'Height';
        const d = device(), [key, unitKey] = SIZE[k][d], own = o[unitKey] != null, [number, unit] = effSize(k, d, o), id = 'wpbn-f-' + key, off = unit === 'auto';
        const [min, max] = unit === 'px' ? [layer ? 1 : 160, wide ? 3000 : 2400] : unit === 'auto' ? [1, wide ? 3000 : 2400] : [1, layer && (unit === '%' || wide) ? 100 : 200];
        const inherit = d === 'desktop' ? '' : '<option value=""' + (own ? '' : ' selected') + '>Inherit</option>';
        const dots = heightDots(o, k);
        return '<div class="wpbn-field wpbn-field--height">' + head(id, label, (layer ? '' : heightTip()) + devices(dots)) + '<div class="wpbn-field__row">'
            + '<input id="' + id + '" data-height="' + d + '" data-size="' + k + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + (own ? escape(number) : '') + '" placeholder="' + escape(number) + '"' + (off ? ' disabled' : '') + '>'
            + '<select data-key="' + unitKey + '"' + (d === 'desktop' ? '' : ' data-inherit="' + k + '"') + ' aria-label="' + label + ' unit">' + inherit + (layer ? (o.type === 'image' && k === 'height' ? ['auto'].concat(LAYER_UNITS.height) : LAYER_UNITS[k]) : ['auto', 'px', 'vh', '%']).map(u => '<option value="' + u + '"' + (own && u === unit ? ' selected' : '') + '>' + UNIT_NAMES[u] + '</option>').join('') + '</select>'
            + '</div>' + (layer ? '<p class="description">' + LAYER_UNIT_HELP[o.type === 'image' && k === 'height' ? 'image' : k][unit] + '</p>' : '<p class="description" id="wpbn-height-note"' + (filling() ? ' hidden' : '') + '>' + UNIT_HELP[unit] + '</p>') + '</div>';
    }
    // With a class to fill blocks by: where this height is used, behind an "i" beside Height (its unit's help, under it, gives way).
    function heightTip() {
        return tip('Inside a block with the class, the scene takes the block\'s height; this one is used elsewhere, and where the block has no height of its own.').replace('<span class="wpbn-tip"', '<span class="wpbn-tip" id="wpbn-height-tip"' + (filling() ? '' : ' hidden'));
    }
    function heightHelp() {
        const tipEl = $('height-tip'), note = $('height-note');
        if (tipEl) tipEl.hidden = !filling();
        if (note) note.hidden = filling();
    }
    // The class to add to a block; a warning when another scene uses it too.
    // Shown only while "Insert into blocks by class" is on (its value is kept while off).
    function targetField() {
        const id = 'wpbn-f-target', help = 'Only with Height on Auto. Add this class to a row, column or block (in WPBakery: its "Extra class name") and put the WP Banner element inside it: the scene becomes that block\'s background, as wide and tall as the block, behind its content. One class, without the dot. Empty: not used.';
        return needs('<div class="wpbn-field">' + head(id, 'Insert into blocks by class', tip(help)) + '<input id="' + id + '" data-key="target" type="text" value="' + escape(scene.target || '') + '" placeholder="wpbn-scene-' + boot.postId + '"></div>', 'autoheight')
            + '<p class="wpbn-target-warning" id="wpbn-target-warning" role="status" hidden><span class="dashicons dashicons-warning" aria-hidden="true"></span><span></span></p>';
    }
    function targetWarning() {
        const box = $('target-warning');
        if (!box) return;
        const name = String(scene.target || '').trim().replace(/^\./, ''), other = name && boot.classes && boot.classes[name];
        box.hidden = !other;
        box.lastChild.textContent = other ? 'The scene "' + other + '" uses this class too: both would go into its blocks.' : '';
    }
    // A new unit: a number that makes sense in it (720vh would be seven screens).
    // Tablet / mobile back to the larger screen: no number either; a unit of its own: a number from the larger screen's.
    function unitChanged(device, kind) {
        // The scene's Height, or an overlay's Height or Width (no minimum in px; in % and vw, at most all of it).
        const o = current(), layer = o !== scene, k = kind || 'height';
        const [key, unitKey, fallback] = SIZE[k][device], unit = o[unitKey];
        if (unit == null) o[key] = null;
        else {
            if (o[key] == null) o[key] = device === 'desktop' ? (layer ? 100 : fallback) : effSize(k, UP[device], o)[0];
            if ((unit === 'vh' || unit === '%' || unit === 'vw') && o[key] > (layer && (unit === '%' || unit === 'vw') ? 100 : 200)) o[key] = 100;
            else if (unit === 'px' && o[key] < 160 && !layer) o[key] = fallback;
        }
        settings();
    }
    /*
     * The Text layer's editor: WordPress's (wp.editor, TinyMCE and its Text tab), as WP Swiper's slide descriptions:
     * the tag (Paragraph, Heading 1–6), bold, italic, underline, Text color (the palette: WPBN_Palette::tinymce_map()),
     * alignment, lists, Link / Unlink, Clear formatting, Undo, Redo (WPBN_Settings::rich_text() keeps the same). Started each time the fields are
     * drawn, removed before they are drawn again. Without it (or the visual editor), the plain box (data-key content).
     */
    const EDITOR_ID = 'wpbn-f-content';
    const wpEditor = () => window.wp && window.wp.editor && window.wp.editor.initialize ? window.wp.editor : null;
    let editorOn = false;
    function stopEditor() {
        editorOn = false;
        if (!wpEditor() || !document.getElementById(EDITOR_ID)) return;
        try { wpEditor().remove(EDITOR_ID); } catch (e) { /* not started */ }
    }
    function storeContent(html) {
        const l = current();
        if (!l || l.type !== 'richtext' || l.content === html) return;
        l.content = html; refreshFontSample(); changed();
    }
    function startEditor() {
        const box = document.getElementById(EDITOR_ID);
        if (!wpEditor() || !box || editorOn || box.closest('[hidden]')) return;
        editorOn = true;
        const map = Array.isArray(boot.textColors) ? boot.textColors : [];
        wpEditor().initialize(EDITOR_ID, {
            tinymce: window.tinymce ? Object.assign(map.length ? {forecolor_map:map, forecolor_cols:8, forecolor_rows:Math.ceil((map.length / 2 + 1) / 8)} : {}, {
                toolbar1: 'formatselect,bold,italic,underline,forecolor,alignleft,aligncenter,alignright,bullist,numlist,link,unlink,removeformat,undo,redo',
                toolbar2: '', height: 160,
                block_formats: 'Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4;Heading 5=h5;Heading 6=h6',
                setup: editor => editor.on('input change keyup undo redo ExecCommand', () => storeContent(editor.getContent()))
            }) : false,
            quicktags: {buttons: 'strong,em,link,ul,ol,li'},
            mediaButtons: false
        });
    }
    /*
     * Add element (user's request, 2026-11-09): a window with the kinds of element (ELEMENTS); choosing one adds that
     * layer in front of the others and selects it; Close, the backdrop or Esc leave the scene as it was. In the page's
     * body, as the Position window (the editor box is a size container: it would hold a fixed window inside it).
     */
    const addModal = document.createElement('div');
    addModal.className = 'wpbn-modal wpbn-modal--add'; addModal.hidden = true;
    addModal.setAttribute('role', 'dialog'); addModal.setAttribute('aria-modal', 'true'); addModal.setAttribute('aria-labelledby', 'wpbn-add-title');
    addModal.innerHTML = '<div class="wpbn-modal__backdrop"></div><div class="wpbn-modal__box"><div class="wpbn-modal__head"><h2 class="wpbn-modal__title" id="wpbn-add-title">Add element</h2>'
        + '<button type="button" class="wpbn-modal__close" aria-label="Close"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button></div>'
        + '<div class="wpbn-modal__body"><div class="wpbn-elements" role="group" aria-label="Elements">'
        + Object.entries(ELEMENTS).map(([type, [icon, name, about]]) => '<button type="button" class="wpbn-element" data-add="' + type + '"><span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span><span class="wpbn-element__name">' + name + '</span><span class="wpbn-element__about">' + escape(about) + '</span></button>').join('')
        + '</div><p class="description wpbn-add-note">The new layer goes in front of the others: the last tile. Drag it to change its depth.</p></div></div>';
    document.body.append(addModal);
    function openAdd() {
        addModal.hidden = false; document.body.classList.add('wpbn-modal-open');
        $('add-toggle').setAttribute('aria-expanded', 'true');
        addModal.querySelectorAll('[data-add]').forEach(b => { b.disabled = scene.layers.length >= 40; });
        const first = addModal.querySelector('[data-add]:not(:disabled)') || addModal.querySelector('.wpbn-modal__close');
        first.focus();
    }
    function closeAdd(focusBack) {
        if (addModal.hidden) return;
        addModal.hidden = true; document.body.classList.remove('wpbn-modal-open');
        $('add-toggle').setAttribute('aria-expanded', 'false');
        if (focusBack) $('add-toggle').focus();
    }
    function addLayer(type) {
        if (scene.layers.length >= 40) return;
        // A new title in the theme's container (it lines up with the page); a new image fills the whole scene.
        // Its kind's standard settings (standard(), TYPE_NEW): a title, a button or a shortcode in the theme's container (it lines up
        // with the page), an image the whole scene; an overlay a see-through black; a text a paragraph at a reading size; none moves.
        const layer = Object.assign(standard({type}), {type, name:TYPE_NAMES[type] + ' ' + (scene.layers.length + 1)});
        // Its own list of objects (boot.layer's one would be shared by every new layer).
        layer.shape_objects = []; layer.uid = newUid(); selectedObject = -1; shapeError = ''; block = 'content';
        scene.layers.push(layer); selected = scene.layers.length - 1;
        list(); settings(); changed(); focusRow(selected);
    }
    addModal.addEventListener('click', event => {
        const button = event.target.closest('[data-add]');
        if (button) { closeAdd(false); addLayer(button.dataset.add); return; }
        if (event.target.closest('.wpbn-modal__close, .wpbn-modal__backdrop')) closeAdd(true);
    });
    // Esc closes it; Tab stays inside it.
    document.addEventListener('keydown', event => {
        if (addModal.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAdd(true); return; }
        if (event.key !== 'Tab') return;
        const controls = [...addModal.querySelectorAll('button:not(:disabled)')], first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    function settings() {
        let html;
        if (selected < 0) {
            html = legend + blocks([
                ['size', 'Size', 'editor-expand', card('Size', heightField())],
                ['placement', 'Placement', 'layout', card('Placement', targetField())],
                // The scene's own id and classes, on its block (as WPBakery's Element ID and Extra class name), one under the other.
                ['attributes', 'Attributes', 'tag', card('Attributes', withTip(field('css_id', 'Element ID'), 'An id for the banner\'s block, e.g. to link to it (#offer) or to style it. Unique on the page; a letter first, without the #.')
                    + withTip(field('css_class', 'Extra class name'), 'Classes for the banner\'s block, to style it in your CSS; several separated by spaces, without dots. Not the class in Placement, which places the banner in a block.'))]]);
        } else if (scene.layers[selected].type === 'shape') {
            html = shapeSettings(scene.layers[selected]);
        } else {
            const l = scene.layers[selected];
            const d = device();
            // first: what it shows (in Content, an overlay's in Fill); cards: a title's, a text's or a button's style, a block of its own.
            let first = '';
            const cards = [];
            // An image: its picture here; its Shadow (along its outline: the title's block, its keys) in Size.
            if (l.type === 'image') first += picker(l);
            else if (l.type === 'overlay') {
                // Its fill: Color or Gradient (the buttons), then the chosen one's settings.
                first += fillChoice(l) + (l.use_gradient ? gradientField(l)
                    : withTip(colorField('color', 'Color', {alpha:true, def:OVERLAY_COLOR}), 'Shades the layers below it in the list; those above it stay clear. Use a see-through color so they show through. Its size: Size; its place: Position on its tile.'));
            } else if (l.type === 'shortcode') {
                first += withTip(textarea('shortcode', 'Shortcode'), 'Another plugin\'s shortcode, as on a page, e.g. [wp_swiper id="12"]. It shows in this layer\'s place (layers above it cover it) and can be clicked and swiped. Its height is its own. Press Update to see it in the preview.');
            } else if (l.type === 'button') {
                // As WP Top Info Bar's: its text and link, then its look.
                first += field('button_text', 'Text', 'text')
                    + withTip(field('button_url', 'Link', 'text'), 'A page address (https://…), a path on this site (/contact/), an anchor (#form), mailto: or tel:. Empty: a button that is not a link.')
                    + needs(check('button_new_tab', 'Open in a new window'), 'link');
                const sizes = {};
                Object.entries(BUTTON_SIZES).forEach(([value, [name]]) => { sizes[value] = name; });
                cards.push(['style', 'Button style', 'admin-appearance', card('Button style', buttonChoice(l, 'button_style', 'Background', {filled:'Filled', bordered:'Border', underline:'Underline'})
                    + needs(buttonChoice(l, 'button_shape', 'Corners', {square:'Square', rounded:'Rounded', round:'Round'}), 'corners')
                    + withTip(respSelect('button_size', 'Size', sizes), 'Preset sizes: padding, height and font size together.')
                    + '<div class="wpbn-colors">' + withTip(colorField('button_color', 'Fill / border color', {alpha:true, def:'#2271b1'}), 'Filled: the button\'s color; Border and Underline: their line\'s.')
                    + colorField('button_text_color', 'Text color', {alpha:true, def:'#ffffff'}) + '</div>'
                    // Gradient (user's request, 2026-11-10): the fill, border or line in it.
                    + withTip(check('use_button_gradient', 'Gradient'), 'Filled: the button\'s fill in a gradient; Border: its border; Underline: its line. The text keeps its Text color; the Fill / border color stays for browsers that cannot show it.')
                    + (l.use_button_gradient ? gradientField(l) : ''))]);
                cards.push(['icon', 'Icon', 'star-filled', iconCard(l), (l.button_icon_type || 'none') !== 'none']);
            } else if (l.type === 'richtext') {
                // WordPress's editor, as WP Swiper's slide texts (startEditor() after the fields are drawn); a plain box without it.
                first += withTip('<div class="wpbn-field wpbn-richtext">' + head(EDITOR_ID, 'Text') + '<textarea id="' + EDITOR_ID + '" data-key="content" rows="6">' + escape(l.content || '') + '</textarea></div>',
                    'Choose Paragraph or a heading in the first menu of the toolbar. Enter starts a new paragraph, Shift + Enter a new line. Headings keep the theme\'s font and size; links can be clicked on the banner.');
                cards.push(['style', 'Text style', 'editor-textcolor', card('Text style', '<div class="wpbn-row">' + (FONTS ? withTip(fontField(l), 'Woodmart\'s fonts: theme fonts (they follow Theme Settings), custom, Adobe, system and Google fonts; a Google font loads with the banner. Empty: the theme\'s text font.')
                        : withTip(field('font_family', 'Font', 'text'), 'Empty: the page\'s text font. As CSS takes it, e.g. "Open Sans", sans-serif; the font must be loaded on the site.'))
                    + weightField(l) + '</div>' + (FONTS ? '<p class="wpbn-font-sample" id="wpbn-font-sample" aria-hidden="true"></p>' : '')
                    + deviceNumberField(l, 'font')
                    + withTip(colorField('color', 'Color', {alpha:true, def:boot.layer.color}), 'The text\'s color; words colored in the editor keep theirs.')
                    )]);
            } else {
                first += withTip(textarea('text', 'Title'), 'Enter starts a new line. Wrap words in <u></u> to show them in the Accent color, e.g. Discover <u>Norway</u>.')
                    + withTip(select('tag', 'Heading', {h1:'h1', h2:'h2', h3:'h3', h4:'h4', h5:'h5'}), 'h1 only if this title is the page\'s main title (one h1 per page); otherwise h2, or h3–h5 under other headings. It matters for SEO and screen readers; the size and weight come from the settings below.');
                // Font and Weight on one row with the font sample under them, then Font size, then Color and Accent color.
                cards.push(['style', 'Title style', 'editor-textcolor', card('Title style', '<div class="wpbn-row">' + (FONTS ? withTip(fontField(l), 'Woodmart\'s fonts: theme fonts (they follow Theme Settings), custom, Adobe, system and Google fonts; a Google font loads with the banner. Empty: the theme\'s heading font.')
                        : withTip(field('font_family', 'Font', 'text'), 'Empty: the theme\'s heading font. As CSS takes it, e.g. "Playfair Display", serif; the font must be loaded on the site.'))
                    + weightField(l) + '</div>' + (FONTS ? '<p class="wpbn-font-sample" id="wpbn-font-sample" aria-hidden="true"></p>' : '')
                    // Font size and Letter spacing (per device; each a row of its own: the device icons beside the label), Case and Style, the colours, then Shadow.
                    + deviceNumberField(l, 'font') + deviceNumberField(l, 'spacing')
                    + '<div class="wpbn-row">' + select('text_transform', 'Case', {none:'Normal', uppercase:'UPPERCASE', lowercase:'lowercase', capitalize:'Capitalize'}) + select('font_style', 'Style', {normal:'Normal', italic:'Italic'}) + '</div>'
                    + '<div class="wpbn-colors">' + colorField('color', 'Color', {alpha:true, def:boot.layer.color})
                    + withTip(colorField('accent_color', 'Accent color', {alpha:true, def:'', fallback:boot.primary || l.color}), 'The words wrapped in <u></u> in the title. Default: the theme\'s primary color' + (boot.primary ? '' : ' (none here: the title\'s color)') + '.') + '</div>'
                    // Gradient (user's request, 2026-11-10): the letters filled with it instead of the Color; the accent words keep theirs.
                    + withTip(check('use_text_gradient', 'Gradient'), 'Fills the title\'s letters with a gradient instead of its Color. The accent words (<u></u>) keep the Accent color. The Color stays for browsers that cannot show it.')
                    + (l.use_text_gradient ? gradientField(l) : '')
                    )]);
            }
            html = legend
                // On tablet / mobile: which values these are (an image layer: an "i" beside its Image instead, picker()).
                + (d === 'desktop' || l.type === 'image' ? '' : '<p class="wpbn-device-note"><span class="dashicons dashicons-' + DEVICES[d][0] + '" aria-hidden="true"></span><span>' + deviceNote(d) + '</span></p>')
                + blocks([
                    // Content: its name first (shown on its tile; given when it is added: "Title 2", a copy adds "copy"), what it shows;
                    // an overlay's Fill a block of its own. Then its style, Size, Effect, an image's Filters (WPBN_Settings::FILTERS), the
                    // animations coming in and running on, then the scroll's and the mouse's (the order: user's choice, 2026-11-09).
                    ['content', 'Content', 'edit', card('Content', nameField() + (l.type === 'overlay' ? '' : first))],
                    l.type === 'overlay' ? ['fill', 'Fill', 'art', card('Fill', first)] : null,
                    ...cards,
                    // Where and how large.
                    ['position', 'Size', 'image-crop', l.type === 'overlay' ? card('Size', containerField(l) + heightField(l, 'width') + heightField(l)) : card('Size', (l.type === 'image' ? withTip(check('fill_scene', 'Fill the scene'), 'On: the image fills the scene (a photo and its cutout for the mountain effect; its edges never show while it moves). Off: an object of its own size (Width and Height), placed where you put it, e.g. a picture beside the title.') : '')
                        + containerField(l)
                        // An image object: its Width and Height, then Image fit and the point of its photo in view (greyed with Height Auto).
                        + (imageObject(l) ? heightField(l, 'width') + heightField(l) + needs(fitPositionField(l), 'cropbox') : l.type === 'image' ? fitPositionField(l) : '') + (l.type === 'shortcode' ? heightField(l, 'width') : '')
                        // A title or a Text layer: its Width (Auto: its text's), where its lines wrap.
                        + (l.type === 'text' || l.type === 'richtext' ? heightField(l, 'textwidth') : '')
                        // Padding (2026-11-09): a title's, a text's, a button's, a shortcode's or an image object's.
                        + (textual(l) || imageObject(l) ? paddingField(l) : '')
                        )],
                    // Effect (user's request, 2026-11-09): an image's Scale and Opacity, every layer's Rotation, a Shadow (an image's along its
                    // outline, a title's or a text's behind its letters, an overlay's around its box or Inside it).
                    ['effect', 'Effect', 'admin-customizer', card('Effect', (l.type !== 'image' ? '' : respRange('scale', 'Scale (%)', {min:10, max:300, to:200, tip:imageObject(l) ? 'The image\'s size within its box: 100% is as set by its Width and Height.' : eff(l, 'fit', d) === 'contain' ? 'The image\'s size: 100% is as tall (or wide) as the scene, 30% a third of it.' : '100%: the image just fills the scene; more enlarges it (its edges are cropped).'}) + respRange('opacity', 'Opacity (%)', {min:0, max:100}))
                        + rotateField() + (['image', 'text', 'richtext', 'overlay', 'button'].includes(l.type) ? shadowField(l) : '') + borderField(l) + radiusField(l))],
                    // A button's (2026-11-10): its Blur alone, of what is under it (frosted glass).
                    ['image', 'overlay', 'button'].includes(l.type) ? ['filters', 'Filters', 'image-filter', card('Filters', l.type === 'image' ? filterFields() : l.type === 'overlay' ? overlayFilterFields(l)
                        : respRange('backdrop_blur', 'Blur (px)', {min:0, max:100, to:50, tip:'Blurs what is under the button, like frosted glass; 0: none. Shows through a see-through fill: Border, Underline, or Filled with a see-through color.'}))] : null,
                    ['entrance', 'Entrance animation', 'migrate', entranceCard(l), !!l.use_enter],
                    ['loop', 'Loop animation', 'controls-repeat', animationCard(l), !!l.use_anim],
                    // As the page scrolls (an overlay, 2026-11-10: its travel and zoom too, for one smaller than the scene), with the
                    // mouse (not an overlay), coming in, running on.
                    ['scroll', 'Scroll animation', 'sort', l.type === 'overlay' ? scrollCard(l, respRange('move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'How far it moves by the end of the scroll; negative: to the left. For an overlay smaller than the scene: one that fills it would show its edges.'})
                        + respRange('move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'How far it moves by the end of the scroll; negative: up.'})
                        + respRange('zoom', 'Zoom (%)', {min:-90, max:300, from:-50, to:100, tip:'Size added by the end of the scroll; negative shrinks it.'})
                        + respRange('end_opacity', 'Opacity at the end (%)', {min:0, max:100, tip:'The overlay goes from full to this opacity as the page scrolls: 0 fades it out.'}))
                        : scrollCard(l, respRange('move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'How far it moves by the end of the scroll; negative: to the left.'})
                        + respRange('move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, tip:'How far it moves by the end of the scroll; negative: up.'})
                        + respRange('zoom', 'Zoom (%)', {min:-90, max:300, from:-50, to:100, tip:'Size added by the end of the scroll; negative shrinks the layer.'})
                        + respRange('end_opacity', 'Opacity at the end (%)', {min:0, max:100, tip:'The layer goes from its Opacity to this one as the page scrolls: 0 fades it out, 100 leaves it as it is.'})), scrolls(l), SCROLL_TIP],
                    // Follow the mouse: a block of its own (it is not the scroll's; user's choice, 2026-11-09).
                    l.type === 'overlay' ? null : ['mouse', 'Follow the mouse', 'move', card('Follow the mouse', mouseField(l)), Number(l.mouse) !== 0, MOUSE_TIP]
                ]);
        }
        // The picker and the Font list belong to fields about to be redrawn.
        closePicker(); closeFonts(); stopEditor();
        $('menu').innerHTML = menuHtml;
        $('settings').innerHTML = '<fieldset class="wpbn-section">' + html + '</fieldset>';
        blockTitle(shownBlock);
        applyStates();
        refreshBorder(); refreshRadius(); refreshPadding();
        targetWarning();
        refreshFontSample();
        drawGradient();
        startEditor();
        $('scene-settings').setAttribute('aria-current', String(selected < 0));
    }
    // One device for the preview and for the fields' device icons.
    function setDevice(value, focusField) {
        $('device').value = value;
        resize(); settings();
        if (focusField) { const button = $('settings').querySelector('[data-field-device="' + value + '"]'); if (button) button.focus(); }
    }
    // The preview is redrawn only by Update; until then the button is lit (as WP Swiper's).
    function changed() { sync(); $('refresh').classList.add('is-stale'); clearTimeout(historyTimer); historyTimer = setTimeout(remember, HISTORY_PAUSE); motionDots(); overlayTile(); devSync(); }
    // An overlay's thumbnail follows its settings as they change (its tile's thumbnail only: the tiles are not drawn again).
    function overlayTile() {
        const l = selected >= 0 && scene.layers[selected], thumb = l && l.type === 'overlay' && $('layers').querySelector('[data-select="' + selected + '"] .wpbn-layer-thumb');
        if (!thumb) return;
        const number = thumb.querySelector('.wpbn-tile__number');
        thumb.outerHTML = overlayThumb(l).replace(/<\/span>$/, number ? number.outerHTML + '</span>' : '</span>');
    }
    // Scroll animation and Follow the mouse have no switch: their green dot in the menu follows their values as they are typed.
    function menuDot(key, on) {
        const b = $('menu').querySelector('[data-block="' + key + '"]');
        if (!b) return;
        const dot = b.querySelector('.wpbn-menu-item__dot');
        if (on && !dot) b.querySelector('.wpbn-menu-item__title').insertAdjacentHTML('afterend', '<span class="wpbn-menu-item__dot" aria-hidden="true"></span><span class="screen-reader-text"> (on)</span>');
        if (!on && dot) { if (dot.nextElementSibling) dot.nextElementSibling.remove(); dot.remove(); }
    }
    function motionDots() {
        if (selected < 0) return;
        const o = current();
        if (!o) return;
        menuDot('scroll', scrolls(o));
        menuDot('mouse', Number(o.mouse) !== 0);
    }
    /*
     * Undo and Redo: the scene as it was after each change since the page opened (the last HISTORY_MAX). Changes close
     * together (a slider dragged, a number typed) are one step: the scene is kept once nothing has changed for HISTORY_PAUSE ms.
     */
    function remember() {
        clearTimeout(historyTimer); historyTimer = 0;
        const now = JSON.stringify(scene);
        if (now !== history[history.length - 1]) { history.push(now); if (history.length > HISTORY_MAX) history.shift(); future = []; }
        historyButtons();
    }
    function historyButtons() { $('undo').disabled = history.length < 2; $('redo').disabled = !future.length; }
    // The scene as it was: its fields drawn again, the same layer chosen where there still is one.
    function restore(json) {
        closePicker(); closeFonts();
        const data = JSON.parse(json);
        Object.keys(scene).forEach(key => { delete scene[key]; });
        Object.assign(scene, data);
        if (selected >= scene.layers.length) selected = scene.layers.length - 1;
        const shape = scene.layers[selected];
        if (!shape || shape.type !== 'shape' || selectedObject >= (shape.shape_objects || []).length) selectedObject = -1;
        list(); settings(); sync(); $('refresh').classList.add('is-stale');
        historyButtons();
    }
    function undo() { remember(); if (history.length < 2) return; future.push(history.pop()); restore(history[history.length - 1]); }
    function redo() { remember(); if (!future.length) return; const next = future.pop(); history.push(next); restore(next); }
    $('undo').onclick = undo;
    $('redo').onclick = redo;
    // Ctrl (⌘) + Z, Ctrl + Shift + Z or Ctrl + Y: not while typing in a text box (its own undo), nor with the Position window open.
    document.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || positionLayer) return;
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        const t = event.target;
        if (t && t.closest && (t.closest('textarea, [contenteditable="true"], .wp-editor-wrap') || (t.matches('input') && !t.matches('[type=range], [type=checkbox], [type=number], [type=button]')))) return;
        event.preventDefault();
        if (key === 'y' || event.shiftKey) redo(); else undo();
    });
    app.addEventListener('input', event => {
        const input = event.target;
        // A per-device number's slider (deviceNumberField()): its number takes the value, and is handled as typed.
        if (input.dataset.inlineRange) {
            const number = input.closest('.wpbn-field').querySelector('[data-inline]');
            if (number) { number.value = input.value; number.dispatchEvent(new Event('input', {bubbles:true})); }
            return;
        }
        // A Shape layer's object: its name (shown in the list under the layer).
        if (input.dataset.objectName !== undefined) {
            const o = selected >= 0 ? (scene.layers[selected].shape_objects || [])[selectedObject] : null;
            if (o) { o.name = input.value; list(); changed(); }
            return;
        }
        if (input.dataset.inline) {
            const kind = input.dataset.inline, d = input.dataset[kind], l = current(), key = INLINE[kind].keys[d];
            if (input.value === '' && d !== 'desktop') { l[key] = null; input.placeholder = inlineFor(l, kind, d); }
            else if (Number.isFinite(input.valueAsNumber)) l[key] = Math.round(Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber)) * 100) / 100;
            else return;
            // The green dots: tablet / mobile with a value of their own.
            input.closest('.wpbn-field').querySelectorAll('[data-field-device]').forEach(b => b.classList.toggle('has-value', b.dataset.fieldDevice === 'desktop' ? !isStandard(l, INLINE[kind].keys.desktop) : l[INLINE[kind].keys[b.dataset.fieldDevice]] != null));
            const slider = input.closest('.wpbn-field').querySelector('[data-inline-range]');
            if (slider && document.activeElement !== slider) slider.value = inlineFor(l, kind, d);
            refreshFontSample();
            changed(); return;
        }
        // Height: a number typed on tablet / mobile gives it a unit of its own too (the one it followed);
        // emptied there, it follows the larger screen again.
        if (input.dataset.height) {
            // The scene's, or an overlay's.
            const d = input.dataset.height, kind = input.dataset.size || 'height', [hk, uk] = SIZE[kind][d], o = current();
            if (input.value === '' && d !== 'desktop') { o[uk] = null; o[hk] = null; settings(); const again = $('f-' + hk); if (again) again.focus(); changed(); return; }
            if (!Number.isFinite(input.valueAsNumber)) return;
            if (o[uk] == null) o[uk] = effSize(kind, d, o)[1];
            o[hk] = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber));
            const own = heightDots(o, kind);
            input.closest('.wpbn-field').querySelectorAll('[data-field-device]').forEach(b => b.classList.toggle('has-value', !!own[b.dataset.fieldDevice]));
            changed(); return;
        }
        const key = input.dataset.key || input.dataset.rangeFor;
        if (!key) return;
        const obj = current();
        if (input.type === 'checkbox') {
            obj[key] = input.checked;
            // Scroll animation: a layer's travel, zoom and opacity at the end on or off together (WPBN_Settings::sanitize()).
            // Placement: a class ready to copy; the height note follows it.
            // Fill the scene off for the first time (its size still as it starts): half its container, as tall as the image.
            if (key === 'fill_scene' && !input.checked && obj.overlay_width === 100 && obj.overlay_width_unit === '%' && (obj.height_unit === 'auto' || (obj.height_unit === '%' && Number(obj.height) === 100))
                && ['tablet', 'mobile'].every(dv => obj[WIDTH[dv][1]] == null && obj[HEIGHT[dv][1]] == null)) { obj.overlay_width = 50; obj.height_unit = 'auto'; }
            if (/^use_/.test(key) || key === 'fill_scene') {
                settings(); const again = $('settings').querySelector('[data-key="' + key + '"]'); if (again) again.focus();
                list(); changed(); return;
            }
            applyStates(); list(); changed(); return;
        }
        // Tablet / mobile number emptied: back to the larger screen's value.
        if (input.dataset.inherit && input.type === 'number' && input.value === '') {
            obj[key] = null;
            const value = eff(obj, input.dataset.inherit, device());
            input.placeholder = value;
            const slider = input.closest('.wpbn-field__row').querySelector('input[type=range]');
            if (slider) slider.value = value;
            refreshDots(input.closest('.wpbn-field')); refreshReset(input.closest('.wpbn-field'));
            changed(); return;
        }
        if (input.type === 'number' || input.type === 'range') {
            if (!Number.isFinite(input.valueAsNumber)) return;
            const value = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber));
            obj[key] = value;
            const row = input.closest('.wpbn-field__row');
            if (row) row.querySelectorAll('input').forEach(other => { if (other !== input) other.value = value; });
        } else obj[key] = input.value;
        // Another kind of animation: its own start and end (their units differ), the same on every device.
        if (key === 'anim_type' && ANIM && ANIM.types[obj.anim_type]) {
            [obj.anim_from, obj.anim_to] = ANIM.types[obj.anim_type].def;
            // And its usual Repeat: a fade or a slide plays once (it comes in), a zoom goes back and forth.
            obj.anim_repeat = ANIM.types[obj.anim_type].repeat || obj.anim_repeat;
            ['tablet', 'mobile'].forEach(dv => { obj[dkey('anim_from', dv)] = null; obj[dkey('anim_to', dv)] = null; });
            settings(); changed(); return;
        }
        refreshDots(input.closest('.wpbn-field')); refreshReset(input.closest('.wpbn-field'));
        if (key === 'target') { targetWarning(); heightHelp(); }
        // The font sample shows the title's text.
        if (key === 'text' || key === 'content') refreshFontSample();
        // A button's link: Open in a new window applies with one; a Shape object's Edge color, with an Edge.
        if (key === 'button_url' || key === 'stroke') applyStates();
        // An overlay's thumbnail shows its fill; a layer's name shows in the list.
        if ((key === 'color' && obj.type === 'overlay') || key === 'name') list();
        changed();
    });
    // Entrance / Loop animation's Type: None switches it off; another type switches it on (a Loop animation's kind: its own start, end and Repeat).
    app.addEventListener('change', event => {
        const sel = event.target.closest && event.target.closest('[data-anim-kind]');
        if (!sel) return;
        const o = current(), which = sel.dataset.animKind, value = sel.value;
        if (which === 'enter') { o.use_enter = value !== 'none'; if (value !== 'none') o.enter_type = value; }
        else {
            o.use_anim = value !== 'none';
            if (value !== 'none' && o.anim_type !== value && ANIM && ANIM.types[value]) {
                o.anim_type = value; [o.anim_from, o.anim_to] = ANIM.types[value].def;
                o.anim_repeat = ANIM.types[value].repeat || o.anim_repeat;
                ['tablet', 'mobile'].forEach(dv => { o[dkey('anim_from', dv)] = null; o[dkey('anim_to', dv)] = null; });
            }
        }
        settings(); changed();
        const again = $('settings').querySelector('[data-anim-kind="' + which + '"]'); if (again) again.focus();
    });
    app.addEventListener('change', event => {
        if (!event.target.matches('select[data-key]')) return;
        const key = event.target.dataset.key;
        current()[key] = event.target.value === '' && event.target.dataset.inherit ? null : event.target.value;
        if (key === 'font_weight' || key === 'text_transform' || key === 'font_style') refreshFontSample();
        if (key === 'border_style') refreshBorder();
        // Container: its width field shows for Custom only.
        if (key === 'container') { settings(); $('settings').querySelector('[data-key="container"]').focus(); }
        // An Entrance animation's Type: its own fields (a slide's Distance, a zoom's Start size).
        if (key === 'enter_type') { settings(); $('settings').querySelector('[data-key="enter_type"]').focus(); }
        refreshDots(event.target.closest('.wpbn-field'));
        // Image fit: Scale's help follows it.
        if (selected >= 0 && /^fit/.test(key)) { settings(); $('settings').querySelector('[data-key="' + key + '"]').focus(); }
        if (/(height|overlay_width|text_width)_unit$/.test(key)) { unitChanged(device(), /text_width/.test(key) ? 'textwidth' : /width/.test(key) ? 'width' : 'height'); $('settings').querySelector('[data-key="' + key + '"]').focus(); }
        changed();
    });
    app.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !app.contains(button)) return;
        if (button.dataset.previewDevice) { setDevice(button.dataset.previewDevice); return; }
        // Border: the sides set together (from then on; the top's width on every side of this device) or each on its own.
        // Radius: a corner's unit (every corner's while linked; values over 50% brought down to it), and the link (from then on;
        // the top left's radius and unit on every corner of this device).
        // Padding: a side's unit (every side's while linked; values over 50% brought down to it), and the link (from then on; the
        // top's space and unit on every side of this device).
        if (button.dataset.padUnit) {
            const l = current(), unit = button.dataset.unit;
            (l.padding_linked ? BORDER_SIDES : [button.dataset.padUnit]).forEach(s => {
                l['padding_' + s + '_unit'] = unit;
                Object.keys(DEVICES).forEach(dv => { const k = dkey('padding_' + s, dv); if (l[k] != null) l[k] = Math.min(PADDING_MAX[unit], l[k]); });
            });
            settings(); changed();
            const again = $('settings').querySelector('[data-pad-unit="' + button.dataset.padUnit + '"][data-unit="' + unit + '"]'); if (again) again.focus();
            return;
        }
        if (button.dataset.padLink !== undefined) {
            const l = current(), d = device();
            l.padding_linked = !l.padding_linked;
            if (l.padding_linked) { const v = l[dkey('padding_top', d)], u = l.padding_top_unit; BORDER_SIDES.forEach(s => { l[dkey('padding_' + s, d)] = v; l['padding_' + s + '_unit'] = u; }); }
            settings(); changed();
            const again = $('settings').querySelector('[data-pad-link]'); if (again) again.focus();
            return;
        }
        if (button.dataset.radiusUnit) {
            const l = current(), unit = button.dataset.unit;
            (l.radius_linked ? RADIUS_CORNERS : [button.dataset.radiusUnit]).forEach(c => {
                l['radius_' + c + '_unit'] = unit;
                Object.keys(DEVICES).forEach(dv => { const k = dkey('radius_' + c, dv); if (l[k] != null) l[k] = Math.min(RADIUS_MAX[unit], l[k]); });
            });
            settings(); changed();
            const again = $('settings').querySelector('[data-radius-unit="' + button.dataset.radiusUnit + '"][data-unit="' + unit + '"]'); if (again) again.focus();
            return;
        }
        if (button.dataset.radiusLink !== undefined) {
            const l = current(), d = device();
            l.radius_linked = !l.radius_linked;
            if (l.radius_linked) { const v = l[dkey('radius_tl', d)], u = l.radius_tl_unit; RADIUS_CORNERS.forEach(c => { l[dkey('radius_' + c, d)] = v; l['radius_' + c + '_unit'] = u; }); }
            settings(); changed();
            const again = $('settings').querySelector('[data-radius-link]'); if (again) again.focus();
            return;
        }
        if (button.dataset.borderLink !== undefined) {
            const l = current(), d = device();
            l.border_linked = !l.border_linked;
            if (l.border_linked) { const top = l[dkey('border_top', d)]; BORDER_SIDES.forEach(s => { l[dkey('border_' + s, d)] = top; }); }
            settings(); changed();
            const again = $('settings').querySelector('[data-border-link]'); if (again) again.focus();
            return;
        }
        if (button.dataset.block) { showBlock(button.dataset.block); button.focus(); return; }
        // An overlay's fill: Color or Gradient.
        if (button.dataset.fill) {
            const l = current(), gradient = button.dataset.fill === 'gradient';
            if (!!l.use_gradient !== gradient) { l.use_gradient = gradient; closePicker(); settings(); list(); changed(); }
            const again = $('settings').querySelector('[data-fill="' + button.dataset.fill + '"]'); if (again) again.focus();
            return;
        }
        // A button's Background or Corners.
        if (button.dataset.choice) {
            const l = current();
            if (l[button.dataset.choice] !== button.dataset.value) { l[button.dataset.choice] = button.dataset.value; settings(); changed(); }
            const again = $('settings').querySelector('[data-choice="' + button.dataset.choice + '"][data-value="' + button.dataset.value + '"]'); if (again) again.focus();
            return;
        }
        if (button.dataset.fieldDevice) { setDevice(button.dataset.fieldDevice, true); return; }
        if (button.dataset.select !== undefined) { selected = Number(button.dataset.select); selectedObject = -1; list(); settings(); focusRow(selected); return; }
        // A Shape layer's object: chosen from its row under the layer, or hidden / shown.
        if (button.dataset.object !== undefined && button.dataset.layer !== undefined) {
            selected = Number(button.dataset.layer); selectedObject = Number(button.dataset.object);
            list(); settings();
            const again = $('layers').querySelector('[data-object="' + selectedObject + '"][data-layer="' + selected + '"]'); if (again) again.focus();
            return;
        }
        if (button.dataset.objectHide !== undefined) {
            const l = scene.layers[Number(button.dataset.layer)], j = Number(button.dataset.objectHide), o = l && (l.shape_objects || [])[j];
            if (!o) return;
            o.hidden = !o.hidden;
            list(); settings(); changed();
            const again = (button.closest('#wpbn-layers') ? $('layers') : $('settings')).querySelector('[data-object-hide="' + j + '"][data-layer="' + button.dataset.layer + '"]'); if (again) again.focus();
            return;
        }
        if (button.dataset.rowAction) { rowAction(button.dataset.rowAction, Number(button.dataset.index)); return; }
        if (button.dataset.reset) {
            const obj = current(), key = button.dataset.reset, base = button.dataset.resetBase || null;
            obj[key] = base && key !== base ? null : DEFAULTS[base || key];
            settings(); changed();
            // Focus stays on the field: its number, as the reset button is now greyed.
            const number = $('settings').querySelector('[data-key="' + key + '"]');
            if (number) number.focus();
            return;
        }
        if (button.id === 'wpbn-add-toggle') { openAdd(); return; }
        if (button.dataset.action && selected >= 0) {
            const l = scene.layers[selected];
            switch (button.dataset.action) {
            case 'position': openPosition(l, button); return;
            case 'shape-upload': uploadShape(l); return;
            // A button's Icon: Font Awesome's (the picker), or an image of its own.
            case 'icon-pick': openIcons(l); return;
            case 'icon-image': {
                const media = wp.media({title:'Choose the icon\'s image', library:{type:'image'}, multiple:false});
                media.on('select', () => {
                    const image = media.state().get('selection').first().toJSON();
                    l.button_icon_image = image.id; images[image.id] = (image.sizes && image.sizes.medium || image).url;
                    imageInfo[image.id] = {name:image.filename || '', width:image.width || 0, height:image.height || 0, size:image.filesizeHumanReadable || ''};
                    if (scene.layers.includes(l)) { settings(); changed(); }
                }); media.open(); return;
            }
            // A Shape object's own image (Fill: Image).
            case 'object-image': {
                const o = (l.shape_objects || [])[selectedObject];
                if (!o) return;
                const media = wp.media({title:'Choose the object\'s image', library:{type:'image'}, multiple:false});
                media.on('select', () => {
                    const image = media.state().get('selection').first().toJSON();
                    o.image = image.id; images[image.id] = (image.sizes && image.sizes.large || image).url;
                    imageInfo[image.id] = {name:image.filename || '', width:image.width || 0, height:image.height || 0, size:image.filesizeHumanReadable || ''};
                    if (scene.layers.includes(l)) { list(); settings(); changed(); }
                }); media.open(); return;
            }
            // Back to the Shape layer's own settings (its SVG and Fit).
            case 'object-none': selectedObject = -1; list(); settings(); return;
            case 'position-inherit': l[dkey('x', device())] = null; l[dkey('y', device())] = null; break;
            case 'image': {
                const index = selected, key = imageKey(device());
                const media = wp.media({title:'Choose layer image', library:{type:'image'}, multiple:false});
                media.on('select', () => {
                    const image = media.state().get('selection').first().toJSON();
                    l[key] = image.id; images[image.id] = (image.sizes && image.sizes.large || image).url;
                    imageInfo[image.id] = {name:image.filename || '', width:image.width || 0, height:image.height || 0, size:image.filesizeHumanReadable || ''};
                    if (scene.layers.includes(l)) { list(); if (selected === index) settings(); changed(); }
                }); media.open(); return;
            }
            case 'clear': l[imageKey(device())] = 0; break;
            default: return;
            }
        } else return;
        list(); settings(); changed();
    });
    // The menu: ↑ / ↓ (Home, End) to the next block.
    $('menu').addEventListener('keydown', event => {
        const current = event.target.closest && event.target.closest('[data-block]');
        if (!current || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const all = [...$('menu').querySelectorAll('[data-block]')], i = all.indexOf(current);
        const next = event.key === 'Home' ? all[0] : event.key === 'End' ? all[all.length - 1] : all[(i + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
        event.preventDefault(); next.click();
    });
    $('scene-settings').onclick = () => { selected = -1; selectedObject = -1; list(); settings(); };
    // A Shape layer's drawing in its card: a click on an object chooses it, beside them none.
    $('settings').addEventListener('click', event => {
        const canvas = event.target.closest && event.target.closest('.wpbn-shape-canvas');
        if (!canvas || selected < 0) return;
        const g = event.target.closest('[data-object]');
        const j = g ? Number(g.getAttribute('data-object')) : -1;
        if (j === selectedObject) return;
        selectedObject = j; list(); settings();
    });
    const layersBox = $('layers');
    const freshTip = event => {
        const b = event.target.closest && event.target.closest('[data-row-action="position"]'), l = b && scene.layers[Number(b.dataset.index)];
        if (!l) return;
        b.title = positionTip(l); b.setAttribute('aria-label', positionTip(l) + ' (' + (l.name || TYPE_NAMES[l.type] || 'Layer') + ')');
    };
    layersBox.addEventListener('pointerover', freshTip);
    layersBox.addEventListener('focusin', freshTip);
    layersBox.addEventListener('keydown', event => {
        const button = event.target.closest('[data-select]');
        if (!button || !event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        // The back layer is first (left): → / ↑ brings it forward (a higher index), ← / ↓ sends it back.
        const index = Number(button.dataset.select), to = index + (event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1);
        focusRow(move(index, to) ? to : index);
    });
    /*
     * Reordering by dragging a tile (pointer events, so the cursor stays a grabbing hand): the tile follows the pointer and the
     * others make room as it goes, sliding to where they will stand once it is dropped (user's request, 2026-11-09); dropped,
     * the order is the one shown. Over the left half of another tile it goes before it (behind it), over its right half after it.
     */
    let sorting = null, skipClick = false;
    // The strip (positioned): the tiles' offsets are from it, as laid out (not moved by a transform).
    const strip = layersBox.parentElement;
    const slot = row => ({left:row.offsetLeft, top:row.offsetTop, width:row.offsetWidth, height:row.offsetHeight});
    function dropTarget(x, y, dragged) {
        const o = strip.getBoundingClientRect();
        x -= o.left; y -= o.top;
        let best = null, far = Infinity;
        layersBox.querySelectorAll('.wpbn-layer-row').forEach(row => {
            if (row === dragged) return;
            const b = slot(row), dx = Math.max(b.left - x, 0, x - b.left - b.width), dy = Math.max(b.top - y, 0, y - b.top - b.height), d = dx * dx + 4 * dy * dy;
            if (d < far) { far = d; best = {row, before:x < b.left + b.width / 2}; }
        });
        return best;
    }
    // The dragged tile under the pointer, where it was taken, wherever its place in the strip now is.
    function follow(event) {
        const o = strip.getBoundingClientRect(), s = slot(sorting.row);
        sorting.row.style.transform = 'translate(' + (event.clientX - o.left - sorting.offX - s.left) + 'px,' + (event.clientY - o.top - sorting.offY - s.top) + 'px)';
    }
    // The dragged tile moved among the others; they slide from where they stood to their new places.
    function makeRoom(row, target) {
        const ref = target.before ? target.row : target.row.nextElementSibling;
        if (ref === row || row.nextElementSibling === ref) return;
        const others = [...layersBox.querySelectorAll('.wpbn-layer-row')].filter(r => r !== row), from = new Map(others.map(r => [r, slot(r)]));
        layersBox.insertBefore(row, ref);
        others.forEach(r => {
            const a = from.get(r), b = slot(r);
            if (a.left === b.left && a.top === b.top) return;
            r.style.transition = 'none';
            r.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)';
            r.getBoundingClientRect();
            r.style.transition = 'transform .18s ease';
            r.style.transform = '';
        });
    }
    function endSort() {
        if (!sorting) return;
        if (sorting.active) {
            layersBox.querySelectorAll('.wpbn-layer-row').forEach(r => { r.style.transform = ''; r.style.transition = ''; });
            sorting.row.classList.remove('is-dragging'); document.body.classList.remove('wpbn-sorting');
        }
        sorting = null;
    }
    layersBox.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.wpbn-layer-tools, .wpbn-objects')) return;
        const row = event.target.closest('.wpbn-layer-row');
        if (!row) return;
        const r = row.getBoundingClientRect();
        sorting = {row, x:event.clientX, y:event.clientY, offX:event.clientX - r.left, offY:event.clientY - r.top, active:false};
    });
    document.addEventListener('pointermove', event => {
        if (!sorting) return;
        if (!sorting.active) {
            if (Math.hypot(event.clientX - sorting.x, event.clientY - sorting.y) < 4) return;
            sorting.active = true;
            sorting.row.classList.add('is-dragging');
            document.body.classList.add('wpbn-sorting');
        }
        event.preventDefault();
        const target = dropTarget(event.clientX, event.clientY, sorting.row);
        if (target) makeRoom(sorting.row, target);
        follow(event);
    });
    document.addEventListener('pointerup', () => {
        if (!sorting) return;
        const active = sorting.active;
        endSort();
        if (!active) return;
        // The click that ends a drag does not select the tile.
        skipClick = true; setTimeout(() => { skipClick = false; }, 0);
        // The order shown (the back layer first) is the new depth.
        const order = [...layersBox.querySelectorAll('.wpbn-layer-row')].map(r => scene.layers[Number(r.dataset.index)]);
        if (order.every((l, i) => l === scene.layers[i])) return;
        const keep = scene.layers[selected];
        scene.layers.splice(0, scene.layers.length, ...order);
        selected = keep ? scene.layers.indexOf(keep) : -1;
        list(); changed();
    });
    // Cancelled: the tiles back in their order.
    document.addEventListener('pointercancel', () => { if (sorting) { const active = sorting.active; endSort(); if (active) list(); } });
    layersBox.addEventListener('click', event => { if (skipClick) { event.stopPropagation(); event.preventDefault(); } }, true);
    /*
     * A Shortcode layer's real height, as the preview draws it (the editor cannot draw another plugin's element):
     * a share of the scene's height, per device, for the Position window's box. Measured when the preview has loaded
     * and when the Position window opens (the element may have grown since: its images, its script). Not saved.
     * The preview's layers by their order when it was asked for (WPBN_Render: z-index = place in the list + 1).
     */
    const measured = new WeakMap();
    let previewLayers = [], previewDevice = 'desktop';
    function measureShortcodes() {
        let doc = null;
        try { doc = $('frame').contentDocument; } catch (e) { return; }
        if (!doc) return;
        doc.querySelectorAll('.wpbn-layer--shortcode').forEach(el => {
            const layer = previewLayers[Number(el.style.zIndex) - 1], sceneEl = el.closest('.wpbn-scene');
            if (!layer || layer.type !== 'shortcode' || !sceneEl || !sceneEl.offsetHeight) return;
            const sizes = measured.get(layer) || {};
            sizes[previewDevice] = el.offsetHeight / sceneEl.offsetHeight;
            measured.set(layer, sizes);
        });
    }
    // Its height (% of the scene) on a device: measured there, else on another device; none yet: null.
    function shortcodeHeight(layer, d) {
        const sizes = measured.get(layer);
        if (!sizes) return null;
        const share = sizes[d] != null ? sizes[d] : sizes.desktop != null ? sizes.desktop : sizes.tablet != null ? sizes.tablet : sizes.mobile;
        // Taller than the scene: as tall (the Position window cuts it as the scene does).
        return share == null ? null : {height:share * 100, own:sizes[d] != null};
    }
    // POST to the isolated frame: no draft content is stored by preview.
    function preview() {
        previewLayers = scene.layers.slice(); previewDevice = device();
        sync(); $('refresh').classList.remove('is-stale'); stopPlay(); $('frame').dataset.state='loading';
        const form = document.createElement('form');
        form.method='post'; form.action=boot.endpoint; form.target='wpbn_preview_frame'; form.hidden=true;
        Object.entries({action:'wpbn_preview',nonce:boot.nonce,post_id:boot.postId,scene:JSON.stringify(scene)}).forEach(([name,value]) => {
            const input=document.createElement('input'); input.type='hidden'; input.name=name; input.value=value; form.append(input);
        });
        document.body.append(form); form.submit(); form.remove();
    }
    function frameState() {
        try {
            const win=$('frame').contentWindow;
            win.document.body.classList.toggle('wpbn-black',dark);
            win.document.body.style.background=dark?'#121212':'';
            if (win.wpbnPreviewProgress) win.wpbnPreviewProgress(Number($('progress').value)/100);
            if (win.wpbnDev) win.wpbnDev(dev, devInfo());
        } catch (error) { /* Frame navigation is in progress. */ }
    }
    // What Developer mode labels (preview-dev.js): the layer chosen, each layer's name, and the chosen one's Position on the
    // device shown (a placed layer's: a photo filling the scene has none).
    function devInfo() {
        const layers = {}, d = device();
        scene.layers.forEach((l, i) => { layers[i] = {name:l.name || TYPE_NAMES[l.type] || 'Layer'}; if (i === selected && anchored(l)) layers[i].position = 'X ' + eff(l, 'x', d) + '% · Y ' + eff(l, 'y', d) + '%'; });
        return {selected, layers};
    }
    // Developer mode told of the layer chosen and of names and places changed (its boxes follow at once, without an Update).
    function devSync() {
        if (!dev) return;
        try { const win = $('frame').contentWindow; if (win.wpbnDev) win.wpbnDev(true, devInfo()); } catch (error) { /* Frame navigation is in progress. */ }
    }
    // A screen size of one's own per device (the fields above the preview). Typed sizes apply with
    // Update, as the other preview changes; empty fields: the device's usual size and drawing.
    // A size of one's own is shown in a plain frame: the device drawings have fixed proportions.
    // For this visit only (user's request, 2026-11-10): the editor always opens with the usual screens (until then they were
    // kept in the browser, wpbn-preview-sizes, removed here once).
    // TODO: once the plugin is done, offer screen presets, each with a drawing of its own.
    const SCREENS = {desktop:[1280,721], tablet:[820,1101], mobile:[390,844]};
    const SIZE_LIMITS = {w:[240,3840], h:[240,2160]};
    const draftSizes = {}, sizes = {};
    try { localStorage.removeItem('wpbn-preview-sizes'); } catch (error) { /* No storage: nothing kept. */ }
    // Which device's values a width shows (frontend.js's breakpoints).
    const valuesFor = w => w <= 767 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';
    // What was typed is kept as typed ([width or null, height or null]); an empty one is the device's usual value.
    const sizeOf = (list, d) => list[d] ? [list[d][0] ?? SCREENS[d][0], list[d][1] ?? SCREENS[d][1]] : null;
    // A tablet or phone turned sideways: the fields show its screen as turned (width × height swapped); the size is
    // kept upright ([width, height] of the device held upright), so turning it back shows it as typed.
    const sideways = d => d !== 'desktop' && !!turned[d];
    function sizeFields() {
        const d = $('device').value, own = draftSizes[d], [w, h] = SCREENS[d], turn = sideways(d);
        const shown = [own && own[0] !== null ? own[0] : '', own && own[1] !== null ? own[1] : ''], hints = [w, h], limits = [SIZE_LIMITS.w, SIZE_LIMITS.h];
        if (turn) { shown.reverse(); hints.reverse(); limits.reverse(); }
        [$('res-w'), $('res-h')].forEach((input, i) => { input.placeholder = hints[i]; input.value = shown[i]; input.min = limits[i][0]; input.max = limits[i][1]; });
    }
    function sizeInput() {
        const d = $('device').value, read = (input, [min, max]) => input.value === '' || !Number.isFinite(input.valueAsNumber) ? null : Math.round(Math.min(max, Math.max(min, input.valueAsNumber)));
        const turn = sideways(d), wide = turn ? $('res-h') : $('res-w'), tall = turn ? $('res-w') : $('res-h');
        const w = read(wide, SIZE_LIMITS.w), h = read(tall, SIZE_LIMITS.h);
        if (w === null && h === null) delete draftSizes[d]; else draftSizes[d] = [w, h];
        $('refresh').classList.add('is-stale');
    }
    ['res-w', 'res-h'].forEach(id => { $(id).addEventListener('input', sizeInput); $(id).addEventListener('change', () => { sizeInput(); sizeFields(); }); });
    function applySizes() {
        Object.keys(sizes).forEach(d => delete sizes[d]); Object.assign(sizes, draftSizes);
    }
    function resize() {
        const device=$('device').value;
        const rotated=device!=='desktop' && !!turned[device];
        const own=sizeOf(sizes,device);
        let [w,h]=own || SCREENS[device];
        if (rotated) [w,h]=[h,w];
        const stage=$('preview-stage'), frame=$('frame'), d=drawings[device];
        stage.classList.toggle('is-custom',!!own);
        if (own) {
            // A plain frame around the screen, scaled down to fit like the drawings.
            const pad=10, scale=Math.min(1,(stage.clientWidth-2*pad)/w,Math.max(300,innerHeight-180)/h);
            const left=Math.max(0,(stage.clientWidth-w*scale)/2);
            Object.assign(frame.style,{width:w+'px',height:h+'px',left:left+'px',top:pad+'px',transform:'scale('+scale+')',borderRadius:'0'});
            Object.assign($('plain-frame').style,{left:(left-pad)+'px',top:'0',width:(w*scale+2*pad)+'px',height:(h*scale+2*pad)+'px'});
            stage.querySelectorAll('.wpbn-device-drawing').forEach(image=>{image.hidden=true;});
            stage.style.height=Math.ceil(h*scale+2*pad)+'px';
            $('rotate').disabled=device==='desktop';
            $('rotate').setAttribute('aria-pressed',String(rotated));
            document.querySelectorAll('[data-preview-device]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewDevice===device)));
            sizeFields();
            requestAnimationFrame(frameState);
            return;
        }
        const unit=({desktop:1280,tablet:820,mobile:390})[device]/d.screen[2];
        const upright=[d.width*unit,d.height*unit];
        const outer=rotated?[upright[1],upright[0]]:upright;
        const offset=rotated?[(d.height-d.screen[1]-d.screen[3])*unit,d.screen[0]*unit]:[d.screen[0]*unit,d.screen[1]*unit];
        const scale=Math.min(1,stage.clientWidth/outer[0],Math.max(300,innerHeight-180)/outer[1]);
        const left=Math.max(0,(stage.clientWidth-outer[0]*scale)/2);
        Object.assign(frame.style,{width:w+'px',height:h+'px',left:(left+offset[0]*scale)+'px',top:(offset[1]*scale)+'px',transform:'scale('+scale+')',borderRadius:(d.radius*unit)+'px'});
        stage.querySelectorAll('.wpbn-device-drawing').forEach(image=>{
            image.hidden=image.dataset.device!==device;
            if(!image.hidden)Object.assign(image.style,{left:(left+(rotated?outer[0]*scale:0))+'px',width:upright[0]*scale+'px',height:upright[1]*scale+'px',transform:rotated?'rotate(90deg)':''});
        });
        stage.style.height=Math.ceil(outer[1]*scale)+'px';
        $('rotate').disabled=device==='desktop';
        $('rotate').setAttribute('aria-pressed',String(rotated));
        document.querySelectorAll('[data-preview-device]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewDevice===device)));
        sizeFields();
        requestAnimationFrame(frameState);
    }
    Object.entries(drawings).forEach(([device,d])=>{
        const image=document.createElement('img');image.src=boot.assetBase+'assets/images/preview/'+d.file;
        image.alt='';image.className='wpbn-device-drawing';image.dataset.device=device;image.hidden=true;$('device-shell').append(image);
    });
    const plainFrame=document.createElement('span');plainFrame.id='wpbn-plain-frame';plainFrame.setAttribute('aria-hidden','true');$('device-shell').append(plainFrame);
    let turnAnimation = null;
    $('rotate').onclick=()=>{
        const device=$('device').value;
        if(device==='desktop')return;
        const stage=$('preview-stage');
        const drawing=stage.querySelector('.wpbn-device-drawing:not([hidden])');
        const from=(drawing || $('frame')).getBoundingClientRect();
        if(turnAnimation){turnAnimation.cancel();turnAnimation=null;}
        turned[device]=!turned[device];
        resize();
        if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        const to=(drawing || $('frame')).getBoundingClientRect();
        const origin=stage.getBoundingClientRect();
        const middle=[to.left+to.width/2-origin.left,to.top+to.height/2-origin.top];
        const shift=[from.left+from.width/2-to.left-to.width/2,from.top+from.height/2-to.top-to.height/2];
        const scale=to.width ? from.height/to.width : 1;
        stage.classList.add('is-turning');
        // Same quarter-turn and position/scale interpolation as WP Swiper.
        const animation=stage.animate([
            {transform:'translate('+shift[0]+'px,'+shift[1]+'px) rotate('+(turned[device]?-90:90)+'deg) scale('+scale+')',transformOrigin:middle[0]+'px '+middle[1]+'px'},
            {transform:'none',transformOrigin:middle[0]+'px '+middle[1]+'px'}
        ],{duration:500,easing:'ease'});
        turnAnimation=animation;
        const finish=()=>{if(turnAnimation===animation){stage.classList.remove('is-turning');turnAnimation=null;}};
        animation.finished.then(finish,finish);
    };
    $('dev').onclick=()=>{dev=!dev;$('dev').setAttribute('aria-pressed',String(dev));frameState();};
    $('dark').onclick=()=>{dark=!dark;$('dark').setAttribute('aria-pressed',String(dark));$('preview-stage').classList.toggle('is-dark',dark);$('frame').style.background=dark?'#121212':'';frameState();};
    // Scroll simulation played with Play (0 → 100 → 0).
    const PLAY_TIME=2400;
    let playing=0;
    const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    function playButton(on){const b=$('play');b.classList.toggle('is-playing',on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Stop':'Play the scroll');b.title=on?'Stop':'Play the scroll';b.querySelector('.dashicons').className='dashicons dashicons-controls-'+(on?'pause':'play');}
    function stopPlay(){if(playing){cancelAnimationFrame(playing);playing=0;}playButton(false);$('frame').dataset.state='done';}
    function play(){
        stopPlay();
        if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        const start=performance.now();playButton(true);$('frame').dataset.state='playing';
        const step=now=>{
            const t=Math.min(1,(now-start)/PLAY_TIME);
            $('progress').value=(ease(t<.5?t*2:(1-t)*2)*100).toFixed(1);frameState();
            if(t<1)playing=requestAnimationFrame(step);else stopPlay();
        };
        playing=requestAnimationFrame(step);
    }
    $('play').onclick=()=>{if(playing)stopPlay();else play();};
    // Update redraws the preview at the scroll simulation's current point; Play plays the scroll.
    $('refresh').onclick=()=>{applySizes();resize();preview();};
    $('progress').oninput=()=>{stopPlay();frameState();};
    $('frame').onload=()=>{resize();frameState();measureShortcodes();$('frame').dataset.state='done';};
    new ResizeObserver(resize).observe($('preview-stage'));
    addEventListener('resize',resize);
    // Settings too large to be saved (WPBN_Admin::MAX_DATA): the form is not sent, so nothing is lost.
    document.getElementById('post').addEventListener('submit',function(e){
        sync();
        if(boot.maxData&&new Blob([$('data').value]).size>boot.maxData){
            e.preventDefault();
            alert(boot.tooLarge);
        }
    });
    /*
     * Leaving with unsaved changes (user's request, 2026-11-10), as Woodmart's Theme settings and Header builder do: the
     * browser's own question (beforeunload) on any way out (a link, closing the tab, reloading). Unsaved: the scene and its
     * title as they were when the page opened against now, so undoing back to them is no change. Not when the form is sent.
     */
    const titleInput=document.getElementById('title');
    const pageState=()=>JSON.stringify(scene)+'\u0000'+(titleInput ? titleInput.value : '');
    let savedState='', sending=false;
    const unsaved=()=>!sending && savedState!=='' && pageState()!==savedState;
    document.getElementById('post').addEventListener('submit',e=>{if(!e.defaultPrevented)sending=true;});
    addEventListener('beforeunload',e=>{if(unsaved()){e.preventDefault();e.returnValue='';}});
    // Position. An image layer: the point of the photo kept in view where its box crops it
    // (object-position), the whole photo shown, as WP Swiper's Image position; one for every
    // device, the frames show each device's crop. A text layer: where it stands on the device
    // being edited (drag it, or click to put its centre there). The layer is outlined, the
    // others dimmed; what an image layer leaves uncovered is hatched.
    // Each device's screen as the preview has it: its own size if one is set (Screen), else the usual one;
    // a tablet or phone turned sideways, sideways. The window's scenes have its proportions.
    function screenOf(d) { const own = sizeOf(sizes, d), [w, h] = own || SCREENS[d]; return d !== 'desktop' && turned[d] ? [h, w] : [w, h]; }
    const sceneWidth = d => screenOf(d)[0];
    // The scene's height on a device in pixels; % and Auto as in the preview (a block as tall as the screen).
    // The height: the one of the device whose values the screen's width shows (as the preview: a desktop of
    // one's own 1000px wide shows the tablet's).
    // An overlay's Height on a device as a share of the scene's (its px and vh in the window's screen).
    // Its Width as a share of the scene's (% of its container; px and vw in the window's screen).
    function overlayWidth(layer, d) { const [v, u] = effSize('width', d, layer); return u === '%' ? v * boxOf(d, layer).width / 100 : u === 'vw' ? v : v / sceneWidth(d) * 100; }
    // A title's or a Text layer's own Width as a share of the scene, at most its container's (frontend.css max-width); Auto: null (its text's).
    function textWidth(layer, d) {
        if (layer.type !== 'text' && layer.type !== 'richtext') return null;
        const [v, u] = effSize('textwidth', d, layer);
        if (u === 'auto' || u == null) return null;
        const box = boxOf(d, layer).width;
        return Math.min(box, u === '%' ? v * box / 100 : u === 'vw' ? v : v / sceneWidth(d) * 100);
    }
    function overlayHeight(layer, d) { const [v, u] = effHeight(d, layer), h = sceneHeight(d); return Math.min(100, u === '%' ? v : (u === 'vh' ? screenOf(d)[1] * v / 100 : v) / h * 100); }
    // An image object's Height as a share of the scene's; Auto: the image's proportions at its Width.
    function imageObjectHeight(layer, d) {
        const [v, u] = effHeight(d, layer), h = sceneHeight(d);
        if (u === 'auto') { const info = imageInfo[imageFor(layer, d)] || {}, ratio = info.width && info.height ? info.height / info.width : 2 / 3; return overlayWidth(layer, d) / 100 * sceneWidth(d) * ratio / h * 100; }
        return (u === '%' ? v / 100 * h : u === 'vh' ? screenOf(d)[1] * v / 100 : v) / h * 100;
    }
    function sceneHeight(d) { const [w, screen] = screenOf(d), [v, u] = effHeight(valuesFor(w)); return u === 'px' ? v : u === 'auto' ? screen : screen * v / 100; }
    const positionModal=document.createElement('div');
    positionModal.className='wpbn-modal wpbn-modal--position';positionModal.hidden=true;
    positionModal.setAttribute('role','dialog');positionModal.setAttribute('aria-modal','true');positionModal.setAttribute('aria-labelledby','wpbn-position-title');
    positionModal.innerHTML='<div class="wpbn-modal__backdrop"></div><div class="wpbn-modal__box"><div class="wpbn-modal__head"><h2 class="wpbn-modal__title" id="wpbn-position-title"><span class="wpbn-modal__what">Position</span> <span class="wpbn-modal__layer"></span></h2><button type="button" class="wpbn-modal__close" aria-label="Close"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button></div>'
        +'<div class="wpbn-modal__body"><p class="description wpbn-position-help"></p>'
        +'<div class="wpbn-focus"><div class="wpbn-focus__main"><div class="wpbn-focus__stage" tabindex="0" role="slider" aria-label="Layer position" aria-valuemin="0" aria-valuemax="100"><img class="wpbn-focus__image" alt="" draggable="false"><div class="wpbn-position-canvas"></div><span class="wpbn-focus__point" aria-hidden="true"></span></div></div>'
        // The devices' frames: buttons that switch the window to that device (user's request, 2026-11-10); an image's point is one for all, they only show it.
        +'<div class="wpbn-focus__frames" role="group" aria-label="Device">'+Object.entries(DEVICES).map(([d,[icon,name]])=>'<button type="button" class="wpbn-focus__device" data-device="'+d+'" aria-pressed="false" title="Position on '+name+'"><span class="wpbn-focus__frame"><span class="wpbn-position-canvas"></span></span><span class="wpbn-focus__caption"><span class="dashicons dashicons-'+icon+'" aria-hidden="true"></span>'+name+'</span></button>').join('')+'</div></div>'
        // Its X and Y: shown as it is dragged, and typed (user's request, 2026-11-09); Enter applies.
        +'<p class="wpbn-focus__value">'+[['x','X','Horizontal position'],['y','Y','Vertical position']].map(([k,name,full])=>'<span class="wpbn-axis"><label class="wpbn-axis__name" for="wpbn-pos-'+k+'" title="'+full+' (%)">'+name+'</label><input type="number" id="wpbn-pos-'+k+'" min="0" max="100" step="0.1" inputmode="decimal"><span class="wpbn-axis__unit" aria-hidden="true">%</span></span>').join('')+'</p><p class="wpbn-position-warning" role="status" hidden><span class="dashicons dashicons-warning" aria-hidden="true"></span><span class="wpbn-position-warning__text"></span></p></div>'
        +'<div class="wpbn-modal__foot"><button type="button" class="button-link wpbn-focus__reset">Reset to centre</button><button type="button" class="button wpbn-modal__cancel">Cancel</button><button type="button" class="button button-primary wpbn-modal__apply">Apply</button></div></div>';
    document.body.append(positionModal);
    const focusStage=positionModal.querySelector('.wpbn-focus__stage');
    const focusPoint=positionModal.querySelector('.wpbn-focus__point');
    let positionLayer=null, positionDraft=null, positionReturn=null, dragging=null;
    // The big stage: the device the window is set to (positionDevice); a frame: its own.
    const canvasDevice=canvas=>canvas.parentElement===focusStage ? positionDevice : canvas.closest('.wpbn-focus__device').dataset.device;
    // A title's X and Width (shares of its container) as shares of the scene, on a device; and back.
    const boxOf=(d,layer)=>{const w=sceneWidth(d), c=container(w,layer,d);return c ? {left:c.left/w*100, width:c.width/w*100} : {left:0, width:100};};
    const inScene=(layer,d,x)=>boxOf(d,layer).left+x*boxOf(d,layer).width/100;
    const fromScene=(layer,d,x)=>(x-boxOf(d,layer).left)/boxOf(d,layer).width*100;
    // A layer's point placed at its Position (as frontend.css ax, ay): an image's centre; a title's own Position
    // (0% its left / top edge, 100% its right / bottom), so it stays within its container.
    const anchorAt=(layer,x,y,scale)=>'translate('+(anchored(layer) ? -x : -50)+'%,'+(anchored(layer) ? -y : -50)+'%) scale('+scale+')';
    const focusImage=positionModal.querySelector('.wpbn-focus__image');
    // The layer as it would be with the draft applied: an image's point in view, or the text's place on the device being edited.
    let positionDevice='desktop';
    // Each device's place as changed in the window ({device: [x, y]}; the one shown: positionDraft) and where it was when shown
    // (positionStart): a device not changed keeps its value (or the larger screen's it takes).
    let positionDrafts={}, positionStart=null;
    // An image layer with its photo: the point in view. Without a photo there is nothing to crop: placed as text is.
    // positionKind: 'place' (an image object's box: where it stands) or 'focus' (the point of the photo in view).
    let positionKind='focus';
    const focusMode=()=>!!positionLayer && positionLayer.type==='image' && !!images[positionLayer.image] && positionKind!=='place';
    const placeDrafts=()=>{const all=Object.assign({},positionDrafts);if(positionDraft[0]!==positionStart[0]||positionDraft[1]!==positionStart[1]||all[positionDevice])all[positionDevice]=positionDraft.slice();return all;};
    const withDraft=()=>{
        if(focusMode())return Object.assign({},positionLayer,{focus_x:positionDraft[0],focus_y:positionDraft[1]});
        const out=Object.assign({},positionLayer), all=placeDrafts();
        Object.keys(DEVICES).forEach(d=>{if(all[d]){out[dkey('x',d)]=all[d][0];out[dkey('y',d)]=all[d][1];}});
        return out;
    };
    // Switched to a device: its place (as the drafts so far make it) on the stage and in the fields.
    function positionSwitch(d) {
        if(focusMode() || d===positionDevice)return;
        positionDrafts=placeDrafts();
        positionDevice=d;
        const layer=withDraft();
        positionDraft=[eff(layer,'x',d),eff(layer,'y',d)];positionStart=positionDraft.slice();
        positionModal.querySelector('.wpbn-modal__layer').textContent=positionLayer.name+' · '+DEVICES[d][1];
        positionDevices();drawPositionScenes();
    }
    function positionDevices() {
        const image=focusMode();
        positionModal.querySelectorAll('.wpbn-focus__device').forEach(b=>{const on=!image && b.dataset.device===positionDevice;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));b.disabled=image;});
    }
    // The layer's box in scene pixels at a scroll progress (0 start, 1 end), as frontend.css draws it.
    function layerBox(layer, d, progress) {
        const w=sceneWidth(d), h=sceneHeight(d), s=eff(layer,'scale',d)/100;
        const box=boxOf(d,layer), bw=eff(layer,'width',d)/100*box.width/100*w*s, bh=h*s, cx=inScene(layer,d,eff(layer,'x',d))/100*w+eff(layer,'move_x',d)*progress, cy=eff(layer,'y',d)/100*h+eff(layer,'move_y',d)*progress;
        return {w, h, left:cx-bw/2, right:cx+bw/2, top:cy-bh/2, bottom:cy+bh/2};
    }
    const uncovered=b=>b.left>.5 || b.top>.5 || b.right<b.w-.5 || b.bottom<b.h-.5;
    // Hatched bands where the layer does not reach (images only: text never fills the scene).
    function drawGaps(canvas) {
        canvas.querySelectorAll('.wpbn-position-gap').forEach(gap=>gap.remove());
        if(anchored(positionLayer))return;
        const b=layerBox(withDraft(),canvasDevice(canvas),0);
        const pct=(v,of)=>Math.max(0,Math.min(100,v/of*100));
        const top=pct(b.top,b.h), bottom=pct(b.bottom,b.h), left=pct(b.left,b.w), right=pct(b.right,b.w);
        [[0,0,100,top],[0,bottom,100,100-bottom],[0,top,left,bottom-top],[right,top,100-right,bottom-top]].forEach(([x,y,width,height])=>{
            if(width<=0.05 || height<=0.05)return;
            const gap=document.createElement('span');gap.className='wpbn-position-gap';
            Object.assign(gap.style,{left:x+'%',top:y+'%',width:width+'%',height:height+'%'});canvas.append(gap);
        });
    }
    function warn() {
        const box=positionModal.querySelector('.wpbn-position-warning'), layer=withDraft();
        // Edges uncovered at rest. While scrolling the site grows the layers that fill the scene, so their edges never show.
        const found=anchored(positionLayer) ? [] : Object.keys(DEVICES).filter(d=>uncovered(layerBox(layer,d,0))).map(d=>DEVICES[d][1]);
        // A shortcode's element taller than the scene (as the preview drew it): the scene cuts it.
        const tall=positionLayer.type==='shortcode' ? Object.keys(DEVICES).filter(d=>{const real=shortcodeHeight(positionLayer,d);return real&&real.own&&real.height>100.5;}).map(d=>DEVICES[d][1]) : [];
        box.hidden=!found.length&&!tall.length;
        box.querySelector('.wpbn-position-warning__text').textContent=found.length ? 'This layer does not cover the whole scene on '+found.join(', ')+' (hatched). Raise the Scale or the Width to cover it.'
            : tall.length ? 'The element is taller than the scene on '+tall.join(', ')+' (as the preview drew it): the scene cuts it. Lower its Width, or its height in its own plugin\'s settings.' : '';
    }
    // A shortcode's label in the middle of the part of its box inside the scene (a box taller than the scene shows
    // only a part of it). y: its Position Y (its own point there, as a title's).
    function placeLabel(item,y) {
        const label=item.querySelector('.wpbn-position-item__label'), h=Number(item.dataset.share);
        if(!label||!h)return;
        const top=y-y/100*h, middle=(Math.max(0,top)+Math.min(100,top+h))/2;
        label.style.top=((middle-top)/h*100)+'%';
    }
    function showPosition() {
        const [x,y]=positionDraft, layer=withDraft();
        focusPoint.style.left=(focusMode() ? x : inScene(positionLayer,positionDevice,x))+'%';focusPoint.style.top=y+'%';
        // The fields: the one being typed in is left as it is.
        [x,y].forEach((value,i)=>{const input=positionInputs[i];if(document.activeElement!==input)input.value=value;});
        focusStage.setAttribute('aria-valuenow',x);focusStage.setAttribute('aria-valuetext','Horizontal '+x+'%, vertical '+y+'%');
        positionModal.querySelectorAll('.wpbn-position-canvas').forEach(canvas=>{
            const target=canvas.querySelector('.wpbn-position-target'), d=canvasDevice(canvas);
            if(target && focusMode()){const img=target.querySelector('img');if(img)img.style.objectPosition=x+'% '+y+'%';}
            else if(target){target.style.left=inScene(layer,d,eff(layer,'x',d))+'%';target.style.top=eff(layer,'y',d)+'%';target.style.transform=anchorAt(layer,eff(layer,'x',d),eff(layer,'y',d),eff(layer,'scale',d)/100);placeLabel(target,eff(layer,'y',d));}
            drawGaps(canvas);
        });
        warn();
    }
    function drawPositionScenes() {
        // The big stage. An image: the whole photo at its own proportions (the CSS sizes it).
        // Text: the preview's device, in the scene's own proportions, as large as fits.
        if(focusMode()){
            // Sized from the photo's proportions (an SVG may have no size of its own); again once it has loaded.
            const info=imageInfo[positionLayer.image]||{}, ratio=focusImage.naturalWidth && focusImage.naturalHeight ? focusImage.naturalWidth/focusImage.naturalHeight : info.width && info.height ? info.width/info.height : 0;
            if(!focusImage.complete)focusImage.onload=()=>{focusImage.onload=null;if(positionLayer)drawPositionScenes();};
            focusStage.style.aspectRatio=ratio ? String(ratio) : '';
            focusStage.style.width=ratio ? 'min(100%, calc(min(60vh, 560px) * '+ratio+'))' : '';
        }else{
            const mainDevice=positionDevice, mainWidth=sceneWidth(mainDevice), mainHeight=sceneHeight(mainDevice), ratio=mainWidth/mainHeight;
            focusStage.style.aspectRatio=mainWidth+'/'+mainHeight;
            focusStage.style.width='min(100%, calc(min(60vh, 560px) * '+ratio+'))';
        }
        positionModal.querySelectorAll('.wpbn-focus__frame').forEach(frame=>{
            const d=frame.parentElement.dataset.device, w=sceneWidth(d), h=sceneHeight(d), r=w/h;
            Object.assign(frame.style,{aspectRatio:w+'/'+h,width:Math.min(150,84*r)+'px'});
        });
        positionModal.querySelectorAll('.wpbn-position-canvas').forEach(canvas=>{
            canvas.replaceChildren();
            const device=canvasDevice(canvas), baseWidth=sceneWidth(device);
            const width=canvas.getBoundingClientRect().width;
            const edges=boxOf(device,positionLayer);
            if(!focusMode() && edges.width<100){const guide=document.createElement('span');guide.className='wpbn-position-container';Object.assign(guide.style,{left:edges.left+'%',width:edges.width+'%'});canvas.append(guide);}
            scene.layers.forEach(layer=>{
                if(layer.hidden && layer!==positionLayer)return;
                // A Shape layer: not drawn on the site yet, so not here either.
                if(layer.type==='shape')return;
                const v=key=>eff(layer,key,device);
                const item=document.createElement('span');item.className='wpbn-position-item'+(layer===positionLayer?' wpbn-position-target':' is-other');
                const box=boxOf(device,layer);
                Object.assign(item.style,{left:(box.left+v('x')*box.width/100)+'%',top:v('y')+'%',width:(v('width')*box.width/100)+'%',opacity:v('opacity')/100,transform:anchorAt(layer,v('x'),v('y'),v('scale')/100)+' rotate('+(Number(v('rotate'))||0)+'deg)'});
                // A title: as wide as its text, at most its container (frontend.css).
                if(textual(layer))Object.assign(item.style,{width:'max-content',maxWidth:box.width+'%'});
                // Its own Width: as wide as set, its lines wrapping there; aligned within it as on the site (a title centred).
                const own=textWidth(layer,device);
                if(own!==null)Object.assign(item.style,{width:own+'%',textAlign:layer.type==='text'?'center':'left'});
                // A text: its words (paragraphs on lines of their own), at its size, as wide as on the site.
                if(layer.type==='richtext'){const doc=new DOMParser().parseFromString(String(layer.content||''),'text/html');doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,br').forEach(el=>el.after('\n'));Object.assign(item.style,{whiteSpace:'pre-line',color:layer.color,fontSize:fontFor(layer,device)*width/baseWidth+'px',lineHeight:'1.5'});item.textContent=doc.body.textContent.trim();canvas.append(item);return;}
                // A shortcode: a dashed box as wide as its Width, its shortcode in it (its element is not drawn here).
                if(layer.type==='shortcode'){const real=shortcodeHeight(layer,device);item.classList.add('is-shortcode');item.classList.toggle('is-guess',!real||!real.own);Object.assign(item.style,{width:overlayWidth(layer,device)+'%',maxWidth:'',height:(real?real.height:30)+'%'});
                    item.dataset.share=real?real.height:30;const label=document.createElement('span');label.className='wpbn-position-item__label';label.textContent=layer.shortcode||'Shortcode';item.append(label);placeLabel(item,v('y'));
                    // Its height on this device: as the preview drew it, or a guess until Update shows it there.
                    item.title=real&&real.own?'Its height as in the preview':'Its height is a guess: show this device in the preview and press Update';canvas.append(item);return;}
                // A button: its text at its Size, in its Background, Corners and colours (scaled to the frame).
                if(layer.type==='button'){const p=BUTTON_SIZES[v('button_size')]||BUTTON_SIZES.default,k=width/baseWidth,style=layer.button_style,line=layer.button_color;
                    Object.assign(item.style,{display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',padding:'0 '+p[1]*k+'px',minHeight:p[2]*k+'px',fontSize:p[3]*k+'px',fontWeight:'600',textTransform:'uppercase',whiteSpace:'nowrap',color:layer.button_text_color,
                        background:style==='filled'?line:'transparent',border:style==='underline'?'0':Math.max(1,2*k)+'px solid '+line,borderBottom:Math.max(1,(style==='underline'?3:2)*k)+'px solid '+line,borderRadius:style==='underline'?'0':{square:'0',rounded:5*k+'px',round:35*k+'px'}[layer.button_shape]});
                    {const g=layer.use_button_gradient&&gradientCss(layer.gradient);if(g){if(style==='filled')Object.assign(item.style,{background:g,borderColor:'transparent'});else item.style.borderImage=g+' 1';}}item.textContent=layer.button_text;canvas.append(item);return;}
                // An overlay: the whole scene in its fill.
                if(layer.type==='overlay'){const blur=(Number(eff(layer,'backdrop_blur',device))||0)*width/baseWidth;Object.assign(item.style,{backdropFilter:backdropCss(layer, blur, device),width:overlayWidth(layer,device)+'%',height:overlayHeight(layer,device)+'%',background:overlayFill(layer)});canvas.append(item);return;}
                if(layer.type==='image') {
                    // An image object: its own box (Width, Height; Auto: the image's proportions); else the whole scene's height.
                    if(imageObject(layer))Object.assign(item.style,{width:overlayWidth(layer,device)+'%',height:imageObjectHeight(layer,device)+'%'});
                    else item.style.height='100%';
                    if(images[layer.image]){const image=document.createElement('img');image.src=images[layer.image];image.alt='';image.style.objectFit=v('fit');image.style.objectPosition=layer.focus_x+'% '+layer.focus_y+'%';item.append(image);}
                }else{item.textContent=layer.text;item.style.color=layer.color;item.style.fontSize=fontFor(layer,device)*width/baseWidth+'px';item.style.lineHeight='1.05';
                    // As wide as on the site: its Letter spacing (scaled), Case and Style.
                    Object.assign(item.style,{letterSpacing:inlineFor(layer,'spacing',device)*width/baseWidth+'px',textTransform:layer.text_transform||'none',fontStyle:layer.font_style||'normal'});}
                canvas.append(item);
            });
        });
        showPosition();
    }
    function openPosition(layer,button) {
        positionKind=button && button.dataset.kind==='place' ? 'place' : 'focus';
        // A shortcode's height as the preview shows it now.
        if(layer.type==='shortcode')measureShortcodes();
        positionDevice=device();positionLayer=layer;positionReturn=button;
        const image=focusMode();
        positionDraft=image ? [layer.focus_x,layer.focus_y] : [eff(layer,'x',positionDevice),eff(layer,'y',positionDevice)];
        positionDrafts={};positionStart=positionDraft.slice();positionDevices();
        positionModal.classList.toggle('is-focus',image);
        focusImage.src=image && images[layer.image] ? images[layer.image] : '';
        positionModal.querySelector('.wpbn-modal__what').textContent=image ? 'Image position' : 'Position';
        positionModal.querySelector('.wpbn-modal__layer').textContent=image ? layer.name : layer.name+' · '+DEVICES[positionDevice][1];
        positionModal.querySelector('.wpbn-position-help').textContent=image
            ? 'Click the part of the image to keep in view when its layer crops it. It applies on every device; the frames show each one. Arrow keys move the point by 1%; with Shift, by 10%.'
            : anchored(layer)
            ? 'Drag the '+(layer.type==='text' ? 'title' : layer.type==='richtext' ? 'text' : layer.type==='button' ? 'button' : layer.type==='shortcode' ? 'element' : layer.type==='image' ? 'image' : 'overlay')+' to move it within its container (dashed), or click to put it there. 0% and 100% put it at the edges. Arrow keys move it by 1%; with Shift, by 10%.'
            : 'Drag the layer to move it, or click to put its centre there. Arrow keys move it by 1%; with Shift, by 10%.';
        positionModal.hidden=false;document.body.classList.add('wpbn-modal-open');
        drawPositionScenes();focusStage.focus();
    }
    function closePosition(apply) {
        if(!positionLayer)return;
        if(apply && focusMode()){positionLayer.focus_x=positionDraft[0];positionLayer.focus_y=positionDraft[1];settings();changed();}
        else if(apply){const all=placeDrafts();Object.keys(all).forEach(d=>{positionLayer[dkey('x',d)]=all[d][0];positionLayer[dkey('y',d)]=all[d][1];});if(Object.keys(all).length){settings();changed();}}
        positionModal.hidden=true;document.body.classList.remove('wpbn-modal-open');dragging=null;positionLayer=null;
        const button=positionReturn && positionReturn.isConnected?positionReturn:positionReturn && positionReturn.dataset.rowAction?$('layers').querySelector('[data-row-action="position"][data-index="'+positionReturn.dataset.index+'"]'):$('settings').querySelector('[data-action="position"]');
        if(button)button.focus();
    }
    const percent=value=>Math.round(Math.max(0,Math.min(100,value))*10)/10;
    function onLayer(event) {
        const target=focusStage.querySelector('.wpbn-position-target');
        if(!target || focusMode())return false;
        const r=target.getBoundingClientRect();
        return event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom;
    }
    function positionAt(event){
        const r=focusStage.getBoundingClientRect();if(!r.width || !r.height)return;
        const d=positionDevice, text=!focusMode(), share=text ? boxOf(d,positionLayer).width/100 : 1;
        const title=text && anchored(positionLayer) && dragging && dragging.size;
        // The room a title moves in: its container (its height: the scene) less its own size. Larger than that (a slider
        // taller than the scene): less than none, so it follows the pointer the other way round in its values (0% shows its
        // top, 100% its bottom). As large (Width 100% of its container): no room: that way it stays as it is.
        const roomX=title ? share*r.width-dragging.size[0] : r.width*share, roomY=title ? r.height-dragging.size[1] : r.height;
        const along=(from,moved,room)=>Math.abs(room)<2 ? from : percent(from+moved/room*100);
        positionDraft=dragging && dragging.move
            ? [along(dragging.from[0],event.clientX-dragging.x,roomX),along(dragging.from[1],event.clientY-dragging.y,roomY)]
            : [percent(text ? fromScene(positionLayer,d,(event.clientX-r.left)/r.width*100) : (event.clientX-r.left)/r.width*100),percent((event.clientY-r.top)/r.height*100)];
        showPosition();
    }
    focusStage.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();focusStage.focus();focusStage.setPointerCapture(event.pointerId);
        // On the layer: it moves with the pointer. Elsewhere: its centre jumps there.
        const held=focusStage.querySelector('.wpbn-position-target'), size=held ? held.getBoundingClientRect() : null;
        dragging={move:onLayer(event),x:event.clientX,y:event.clientY,from:positionDraft.slice(),size:size ? [size.width,size.height] : null};
        if(!dragging.move)positionAt(event);
    });
    focusStage.addEventListener('pointermove',event=>{
        if(dragging)positionAt(event);
        else focusStage.classList.toggle('is-over-layer',onLayer(event));
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(name=>focusStage.addEventListener(name,()=>{dragging=null;}));
    focusStage.addEventListener('pointerleave',()=>{if(!dragging)focusStage.classList.remove('is-over-layer');});
    focusStage.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();closePosition(true);return;}
        const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
        if(!steps[event.key])return;event.preventDefault();const by=event.shiftKey?10:1;
        positionDraft=positionDraft.map((value,i)=>percent(value+steps[event.key][i]*by));showPosition();
    });
    positionModal.querySelectorAll('.wpbn-focus__device').forEach(b=>b.addEventListener('click',()=>positionSwitch(b.dataset.device)));
    positionModal.querySelector('.wpbn-modal__apply').onclick=()=>closePosition(true);
    positionModal.querySelector('.wpbn-modal__cancel').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-modal__close').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-modal__backdrop').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-focus__reset').onclick=()=>{positionDraft=[50,50];showPosition();};
    // Typed X / Y: the layer goes there as it is typed (0–100); Enter applies, a field left shows the value used.
    const positionInputs=[positionModal.querySelector('#wpbn-pos-x'),positionModal.querySelector('#wpbn-pos-y')];
    positionInputs.forEach((input,i)=>{
        input.addEventListener('input',()=>{if(input.value===''||!isFinite(Number(input.value)))return;positionDraft[i]=percent(Number(input.value));showPosition();});
        input.addEventListener('change',()=>{input.value=positionDraft[i];});
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();positionDraft[i]=input.value===''?positionDraft[i]:percent(Number(input.value));closePosition(true);}});
    });
    document.addEventListener('keydown',event=>{
        if(positionModal.hidden)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePosition(false);}
        if(event.key==='Tab'){
            const controls=Array.from(positionModal.querySelectorAll('button,input,[tabindex="0"]'));
            const first=controls[0],last=controls[controls.length-1];
            if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
            else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
        }
    },true);
    // Redrawn when the stage changes size (text sizes follow its width), not while dragging.
    let lastStageWidth=0;
    new ResizeObserver(()=>{const w=focusStage.getBoundingClientRect().width;if(positionLayer && Math.abs(w-lastStageWidth)>.5){lastStageWidth=w;drawPositionScenes();}}).observe(focusStage);
    list();settings();resize();preview();
    // The state to compare with when leaving, once the editor has drawn it (settings() may fill in defaults).
    savedState=pageState();
}());
