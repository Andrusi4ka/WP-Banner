(function () {
    'use strict';
    const app = document.getElementById('wpbn-app');
    if (!app) return;
    const boot = JSON.parse(document.getElementById('wpbn-boot').textContent);
    const scene = boot.scene;
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
        overlay: ['image-filter', 'Overlay', 'A color or gradient over the scene (or a band of it), over the layers under it: e.g. the photo shaded under the title.']
    };
    // richtext: the Text element (text is the Title's key).
    const TYPE_NAMES = {image:'Image', text:'Title', overlay:'Overlay', richtext:'Text', button:'Button', shortcode:'Shortcode'};
    // Title, Text and Button (WPBN_Settings::textual()): as wide as their content, at 100% scale and opacity.
    const textual = l => l.type === 'text' || l.type === 'richtext' || l.type === 'button' || l.type === 'shortcode';
    // A button's Size: WoodMart's presets (WPBN_Settings::BUTTON_SIZES): side padding, height, font size (px).
    const BUTTON_SIZES = {'extra-small':['Extra Small', 10, 28, 11], small:['Small', 14, 36, 12], default:['Default', 20, 42, 13], large:['Large', 28, 48, 14], 'extra-large':['Extra Large', 40, 56, 16]};
    // An overlay does not move (WPBN_Settings::effective()): only its Opacity at the end. Its Container, Position and Height are its own.
    const OVERLAY_FIXED = {scale:100, opacity:100, move_x:0, move_y:0, zoom:0};
    // Placed as a title is: its Position also its own point there (0% flush left / top, 100% right / bottom), within its container.
    // An image layer with Fill the scene off (WPBN_Settings::object()): an object with its own Width and Height, placed as a title.
    const imageObject = l => l.type === 'image' && l.fill_scene === false;
    const anchored = l => textual(l) || l.type === 'overlay' || imageObject(l);
    // A field with its help behind an "i" beside the label (the dark tooltip), instead of under it.
    const withTip = (html, text) => html.replace('</label>', '</label>' + tip(text));
    // adding: the settings column shows the elements to add instead of a layer's settings.
    let selected = -1, dark = false, adding = false;
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
    const current = () => selected < 0 ? scene : scene.layers[selected];
    function sync() { $('data').value = JSON.stringify(scene); }
    // Per-device layer settings, as in WP Swiper: desktop always has a value;
    // tablet and mobile null = the larger screen's (mobile → tablet → desktop).
    const UP = {tablet:'desktop', mobile:'tablet'};
    const dkey = (base, d) => d === 'desktop' ? base : base + '_' + d;
    // Settings with a switch (as WPBN_Settings::OPTIONAL): they apply only with it on; off, they have their value at rest.
    // base: [switch, value when off, image layers only].
    // An image layer's Width is always the scene's (100%), as WPBN_Settings::effective().
    const OPTIONAL = {scale:['use_scale', 100, true], opacity:['use_opacity', 100, true],
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
    const ownValues = (l, base) => ({tablet: l[dkey(base, 'tablet')] != null, mobile: l[dkey(base, 'mobile')] != null});

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
    const DEFAULTS = {width:100, scale:100, opacity:100, move_x:0, move_y:0, zoom:0, end_opacity:0,
        font_size:boot.layer.font_size, tablet_font_size:boot.layer.tablet_font_size, mobile_font_size:boot.layer.mobile_font_size,
        anim_from:boot.layer.anim_from, anim_to:boot.layer.anim_to, anim_duration:boot.layer.anim_duration, anim_delay:boot.layer.anim_delay, mouse:boot.layer.mouse};
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
        return '<div class="wpbn-field" data-base="' + base + '">' + head(id, label, devices(ownValues(l, base))) + '<div class="wpbn-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="' + (o.step || 1) + '" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" value="' + (own == null ? '' : escape(own)) + '" placeholder="' + value + '" aria-label="' + label + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '>'
            + resetButton(l, key, base, label) + '</div>' + note(o.note) + '</div>';
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
        return '<div class="wpbn-field">' + head(id, label, perDevice ? devices() : '') + '<div class="wpbn-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="' + (o.step || 1) + '" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" value="' + value + '">'
            + (key in DEFAULTS ? resetButton(current(), key, null, label) : '') + '</div>' + note(o.note) + '</div>';
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
            + '<span class="wpbn-gradient__preview" role="img" aria-label="Gradient preview" title="As the overlay shows it"><span class="wpbn-gradient__fill"></span></span>'
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
        // An overlay's Blur: the layers under it blurred (backdrop-filter), per device.
        blur: {keys:{desktop:'backdrop_blur', tablet:'tablet_backdrop_blur', mobile:'mobile_backdrop_blur'}, label:'Blur', unit:'px', min:0, max:{desktop:100, tablet:100, mobile:100}, step:1,
            tip:'Blurs the layers under this one where it covers them, like frosted glass; 0: none. Works with a see-through color or gradient.'},
        // Container width (Custom, or Theme container in a theme without one), per device.
        cwidth: {keys:{desktop:'container_width', tablet:'container_width_tablet', mobile:'container_width_mobile'}, label:'Container width', unit:'px', min:320, max:{desktop:3000, tablet:3000, mobile:3000}, step:1,
            tip:'On a narrower screen it keeps 15px clear on each side. The icons choose the device. Tablet and mobile: empty follows the larger screen (shown in grey).'}
    };
    // A title's Shadow: its switch with an "i"; on, its color, offset (X right, Y down) and Blur in a row (WPBN_Settings::shadow()).
    function shadowField(l) {
        const id = 'wpbn-f-use_shadow';
        const toggle = '<div class="wpbn-field wpbn-field--check"><div class="wpbn-field__head"><label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="use_shadow"' + (l.use_shadow ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>Shadow</span></label>'
            + tip('A shadow behind the letters: its color, how far it falls right (X) and down (Y; negative: left, up) and how soft it is (Blur).') + '</div></div>';
        if (!l.use_shadow) return toggle;
        const px = (key, label, min, max) => '<div class="wpbn-field">' + head('wpbn-f-' + key, label) + '<span class="wpbn-number-unit"><input id="wpbn-f-' + key + '" data-key="' + key + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + escape(l[key]) + '"><span class="wpbn-number-unit__unit" aria-hidden="true">px</span></span></div>';
        return toggle + '<div class="wpbn-row wpbn-shadow">' + colorField('shadow_color', 'Color', {alpha:true, def:boot.layer.shadow_color})
            + px('shadow_x', 'X', -100, 100) + px('shadow_y', 'Y', -100, 100) + px('shadow_blur', 'Blur', 0, 200) + '</div>';
    }
    function inlineFor(l, kind, d) { const key = INLINE[kind].keys[d]; return d === 'desktop' || l[key] != null ? l[key] : inlineFor(l, kind, UP[d]); }
    const fontFor = (l, d) => inlineFor(l, 'font', d);
    // One number for the device being edited, its unit after it (px for sizes); the device icons at the
    // right of its label, as the other per-device fields have them (a green dot where tablet or mobile has its own).
    function deviceNumberField(l, kind) {
        const o = INLINE[kind], d = device(), key = o.keys[d], id = 'wpbn-f-' + key;
        return '<div class="wpbn-field wpbn-field--device-number"><div class="wpbn-field__head"><label for="' + id + '">' + o.label + '</label>' + (o.tip ? tip(o.tip) : '')
            + devices({tablet:l[o.keys.tablet] != null, mobile:l[o.keys.mobile] != null}) + '</div>'
            + '<span class="wpbn-number-unit"><input id="' + id + '" data-inline="' + kind + '" data-' + kind + '="' + d + '" type="number" min="' + o.min + '" max="' + o.max[d] + '" step="' + o.step + '"'
            + ' value="' + (l[key] != null ? escape(l[key]) : '') + '" placeholder="' + escape(inlineFor(l, kind, d)) + '" aria-label="' + o.label + ' — ' + DEVICES[d][1] + '">'
            + (o.unit ? '<span class="wpbn-number-unit__unit" aria-hidden="true">' + o.unit + '</span>' : '') + '</span></div>';
    }
    // A setting with a switch (OPTIONAL): the switch with the setting's name; on, the slider (per device)
    // under it, the device icons beside the switch. Width, Scale and Opacity of a text layer: the slider alone.
    function optionalRange(l, base, label, o) {
        if (!switched(l, base)) return respRange(base, label, o);
        const flag = OPTIONAL[base][0], on = !!l[flag], id = 'wpbn-f-' + flag;
        const toggle = '<label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="' + flag + '"' + (on ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>' + label + '</span></label>';
        if (!on) return '<div class="wpbn-field wpbn-field--check">' + toggle + '</div>';
        return respRange(base, label, o).replace(/<div class="wpbn-field__head"><label for="[^"]*">[^<]*<\/label>/, '<div class="wpbn-field__head">' + toggle);
    }
    /*
     * Animation (WPBN_Animation): motion of the layer's own, running by itself from the moment the page loads,
     * on top of its scroll motion. Its switch; on: its kind, where it starts and ends and how long a run takes
     * (per device), then its delay, repeat and easing. The kinds and their fields come from boot.animations.
     * An overlay has none (it stays put, as with the scroll).
     */
    const ANIM = boot.animations || null;
    // Follow the mouse (Motion): its switch; on, how far the layer moves with the pointer at the scene's edge. One value for every
    // device: only devices with a mouse have it. Layers in front moving further than those behind gives depth.
    function mouseField(l) {
        const toggle = withTip(check('use_mouse', 'Follow the mouse'), 'On computers: the layer moves a little as the pointer moves over the banner. Give front layers more than back ones for depth; negative moves against the pointer.');
        return l.use_mouse ? toggle + range('mouse', 'Distance (px)', {min:-200, max:200, from:-80, to:80, note:'How far it moves with the pointer at the banner\'s edge.'}) : toggle;
    }
    function animationCard(l) {
        if (!ANIM || l.type === 'overlay') return '';
        const kinds = Object.keys(ANIM.types), type = ANIM.types[l.anim_type] || ANIM.types[kinds[0]];
        // Its switch with the help behind an "i" beside it, as Shadow's; named after the kind while there is only one.
        const id = 'wpbn-f-use_anim', name = kinds.length > 1 ? 'Animation' : type.switch;
        const toggle = '<div class="wpbn-field wpbn-field--check"><div class="wpbn-field__head"><label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="use_anim"' + (l.use_anim ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>' + escape(name) + '</span></label>'
            + tip('Runs by itself, on top of the scroll motion: e.g. a photo slowly zooming in and out, or a title fading in.') + '</div></div>';
        if (!l.use_anim) return card('Animation', toggle);
        // Reset takes the kind's own start and end.
        [DEFAULTS.anim_from, DEFAULTS.anim_to] = type.def;
        const min = l.type === 'image' && l.fill_scene && type.fillMin != null ? Math.max(type.min, type.fillMin) : type.min;
        const span = {min, max:type.max, from:Math.max(min, type.span[0]), to:type.span[1]};
        // What and when; then the kind's own fields; then how it runs.
        return card('Animation', toggle
            + '<div class="wpbn-row">' + (kinds.length > 1 ? select('anim_type', 'Type', Object.fromEntries(Object.entries(ANIM.types).map(([k, t]) => [k, t.label]))) : '') + withTip(select('anim_start', 'Starts', ANIM.starts), 'On load: as the page opens. In view: once the banner is on the screen, for banners lower on the page.') + '</div>'
            + (type.origin ? select('anim_origin', 'Direction', ANIM.origins) : '')
            + respRange('anim_from', type.from, span)
            + respRange('anim_to', type.to, Object.assign({note:type.note}, span))
            + respRange('anim_duration', 'Duration (s)', {min:ANIM.duration[0], max:ANIM.duration[1], from:1, to:30, step:0.1, note:'One run, from start to end.'})
            + '<div class="wpbn-row">' + withTip(select('anim_repeat', 'Repeat', ANIM.repeats), 'Back & forth: to the end and back again, endlessly. Loop: from the start again each time. Once: it plays and stays at its end.') + select('anim_easing', 'Easing', ANIM.easings) + '</div>'
            + range('anim_delay', 'Delay (s)', {min:ANIM.delay[0], max:ANIM.delay[1], to:10, step:0.1, note:'Before the first run, on every device: e.g. the title a moment after the photo.'}));
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
    const NEEDS = {cropbox: () => effSize('height', device(), current())[1] !== 'auto', autoheight: autoHeight, link: () => !!String(current().button_url || '').trim(), corners: () => current().button_style !== 'underline'};
    // A button's Background or Corners: a sample of each, the chosen one pressed (as WP Top Info Bar's).
    function buttonChoice(l, key, label, list) {
        return '<div class="wpbn-field">' + head('wpbn-f-' + key, label) + '<div class="wpbn-button-choices" role="group" aria-label="' + label + '">'
            + Object.entries(list).map(([value, name], i) => '<button type="button" class="wpbn-button-choice"' + (i ? '' : ' id="wpbn-f-' + key + '"') + ' data-choice="' + key + '" data-value="' + value + '" aria-pressed="' + (l[key] === value) + '"><span class="wpbn-button-choice__sample wpbn-button-choice__sample--' + value + '">' + name + '</span></button>').join('') + '</div></div>';
    }
    // A help text behind an "i" icon, shown on a dark tooltip on hover and keyboard focus (as WP Swiper's).
    const tip = text => '<span class="wpbn-tip" tabindex="0" role="img" aria-label="' + escape(text) + '" data-tip="' + escape(text) + '"><span class="dashicons dashicons-info-outline" aria-hidden="true"></span></span>';
    const needs = (html, when) => html.replace('<div class="wpbn-field', '<div data-needs="' + when + '" class="wpbn-field');
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
    function picker(layer) {
        const d = device(), own = layer[imageKey(d)], id = imageFor(layer, d), url = images[id];
        const inherit = d !== 'desktop' && !own;
        // One row: the thumbnail, the file's name and size, then Change at the right end. No Remove on
        // desktop (an image layer has an image); tablet / mobile can go back to the larger screen's.
        return '<div class="wpbn-field" data-base="image"><div class="wpbn-field__head"><span class="wpbn-field__label">Image</span>' + devices({tablet:!!layer.image_tablet, mobile:!!layer.image_mobile}) + '</div><div class="wpbn-picker"><span class="wpbn-picker__thumb">' + (url ? '<img src="' + escape(url) + '" alt="">' : '') + '</span>'
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
    // A title: Container with Position at its right, as tall, Position's value over the button (the same
    // grid as Image fit's, in admin.css).
    function containerPositionField(layer) {
        const p = positionParts(layer, true), html = containerSelect(layer);
        return html.slice(0, html.lastIndexOf('</div>')).replace('<div class="wpbn-field"', '<div class="wpbn-field wpbn-position wpbn-fit-position"') + p.button + p.value + '</div>';
    }
    // An image layer: Image fit (its label and device icons over the select) and Position beside it,
    // Position's value under its button (laid out by a grid in admin.css).
    function fitPositionField(layer) {
        const p = positionParts(layer);
        return respSelect('fit', 'Image fit', {cover:'Cover', contain:'Contain'}, p.button + p.value).replace('<div class="wpbn-field"', '<div class="wpbn-field wpbn-position wpbn-fit-position"');
    }

    // An overlay's fill as CSS: its gradient (with its switch on) or its colour.
    const overlayFill = l => (l.use_gradient && gradientCss(l.gradient)) || l.color || 'transparent';
    // Layers: the front one at the top, as in Photoshop. Each row selects its
    // layer; its icons hide, copy or remove it; drag (or Alt + arrows) reorders.
    function list() {
        const box = $('layers');
        box.replaceChildren();
        if (!scene.layers.length) { box.innerHTML = '<p class="wpbn-empty">Add a background image, a title and a transparent front image.</p>'; return; }
        for (let i = scene.layers.length - 1; i >= 0; i--) {
            const l = scene.layers[i], name = escape(l.name);
            // Not draggable: the browser's own image drag would stop the row's.
            const thumb = l.type === 'overlay'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--overlay" aria-hidden="true"><span style="background:' + escape(overlayFill(l)) + '"></span></span>'
                : l.type === 'shortcode'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--shortcode" aria-hidden="true"><span class="dashicons dashicons-shortcode"></span></span>'
                : l.type === 'button'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--button" aria-hidden="true"><span class="dashicons dashicons-button"></span></span>'
                : l.type === 'richtext'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--richtext" aria-hidden="true"><span class="dashicons dashicons-editor-paragraph"></span></span>'
                : l.type === 'text'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--text" aria-hidden="true"><span class="dashicons dashicons-editor-textcolor"></span></span>'
                : '<span class="wpbn-layer-thumb" aria-hidden="true">' + (images[l.image] ? '<img src="' + escape(images[l.image]) + '" alt="" draggable="false">' : '<span class="dashicons dashicons-format-image"></span>') + '</span>';
            const row = document.createElement('div');
            row.className = 'wpbn-layer-row' + (i === selected && !adding ? ' is-active' : '') + (l.hidden ? ' is-hidden' : '');
            row.setAttribute('role', 'listitem');
            row.dataset.index = i;
            row.innerHTML = '<span class="wpbn-layer-grip" aria-hidden="true"></span><button type="button" class="wpbn-layer-select" data-select="' + i + '" aria-current="' + (i === selected && !adding) + '" title="Drag, or Alt + ↑ / ↓, to change the depth">' + thumb
                + '<span class="wpbn-layer-label">' + name + '<small>' + (TYPE_NAMES[l.type] || 'Image') + (l.hidden ? ' · hidden' : '') + '</small></span></button>'
                + '<span class="wpbn-layer-tools">'
                + '<button type="button" class="wpbn-icon-button" data-row-action="hide" data-index="' + i + '" aria-pressed="' + l.hidden + '" aria-label="' + (l.hidden ? 'Show ' : 'Hide ') + name + '" title="' + (l.hidden ? 'Show' : 'Hide') + '"><span class="dashicons dashicons-' + (l.hidden ? 'hidden' : 'visibility') + '" aria-hidden="true"></span></button>'
                + '<button type="button" class="wpbn-icon-button" data-row-action="duplicate" data-index="' + i + '" aria-label="Duplicate ' + name + '" title="Duplicate"' + (scene.layers.length >= 40 ? ' disabled' : '') + '>' + icons.clone + '</button>'
                + '<button type="button" class="wpbn-icon-button wpbn-icon-button--danger" data-row-action="delete" data-index="' + i + '" aria-label="Delete ' + name + '" title="Delete"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button>'
                + '</span>';
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
    function rowAction(action, index) {
        const l = scene.layers[index];
        if (!l) return;
        const keep = scene.layers[selected];
        if (action === 'hide') {
            l.hidden = !l.hidden;
            list(); changed(); focusRow(index, 'hide');
        } else if (action === 'duplicate') {
            if (scene.layers.length >= 40) return;
            scene.layers.splice(index + 1, 0, Object.assign({}, l, {name: l.name + ' copy'}));
            selected = index + 1; adding = false;
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
    function heightField(obj, kind) {
        const layer = !!obj, o = obj || scene, k = kind || 'height', wide = k !== 'height', label = wide ? 'Width' : 'Height';
        const d = device(), [key, unitKey] = SIZE[k][d], own = o[unitKey] != null, [number, unit] = effSize(k, d, o), id = 'wpbn-f-' + key, off = unit === 'auto';
        const [min, max] = unit === 'px' ? [layer ? 1 : 160, wide ? 3000 : 2400] : unit === 'auto' ? [1, wide ? 3000 : 2400] : [1, layer && (unit === '%' || wide) ? 100 : 200];
        const inherit = d === 'desktop' ? '' : '<option value=""' + (own ? '' : ' selected') + '>Inherit</option>';
        const dots = {tablet:o[SIZE[k].tablet[1]] != null, mobile:o[SIZE[k].mobile[1]] != null};
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
    function stopEditor() {
        if (!wpEditor() || !document.getElementById(EDITOR_ID)) return;
        try { wpEditor().remove(EDITOR_ID); } catch (e) { /* not started */ }
    }
    function storeContent(html) {
        const l = current();
        if (!l || l.type !== 'richtext' || l.content === html) return;
        l.content = html; refreshFontSample(); changed();
    }
    function startEditor() {
        if (!wpEditor() || !document.getElementById(EDITOR_ID)) return;
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
    function settings() {
        let html;
        if (adding) {
            html = '<legend>Add element</legend><div class="wpbn-card"><p class="wpbn-subheading">Elements</p><div class="wpbn-elements" role="group" aria-label="Elements">'
                + Object.entries(ELEMENTS).map(([type, [icon, name, about]]) => '<button type="button" class="wpbn-element" data-add="' + type + '" title="' + escape(about) + '"><span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span><span class="wpbn-element__name">' + name + '</span></button>').join('')
                + '</div></div><p class="description wpbn-after-cards">The new layer goes in front of the others; drag it in the list to change its depth.</p>';
        } else if (selected < 0) {
            html = '<legend>Scene settings</legend>'
                + card('Size', heightField())
                + card('Placement', targetField())
                // The scene's own id and classes, on its block (as WPBakery's Element ID and Extra class name).
                + card('Attributes', '<div class="wpbn-row">' + withTip(field('css_id', 'Element ID'), 'An id for the banner\'s block, e.g. to link to it (#offer) or to style it. Unique on the page; a letter first, without the #.')
                    + withTip(field('css_class', 'Extra class name'), 'Classes for the banner\'s block, to style it in your CSS; several separated by spaces, without dots. Not the class above, which places the banner in a block.') + '</div>');
        } else {
            const l = scene.layers[selected];
            const d = device();
            // No name field: a layer's name is given when it is added ("Title 2", "Image 3"; a copy adds "copy") and shows in the layer list.
            let first = '', cards = '';
            if (l.type === 'image') first += picker(l)
                // Decorative: no alt text read out (a cutout of the photo behind it would be described twice).
                + withTip(check('decorative', 'Decorative image'), 'Screen readers skip it. Turn on for a cutout or a second copy of a photo, so it is not described twice. Off: the alt text from the media library.');
            else if (l.type === 'overlay') {
                // Its fill: Color or Gradient (the buttons), then the chosen one's settings.
                first += fillChoice(l) + (l.use_gradient ? gradientField(l)
                    : withTip(colorField('color', 'Color', {alpha:true, def:OVERLAY_COLOR}), 'Shades the layers below it in the list; those above it stay clear. Use a see-through color so they show through. Its size and place: Position and size.'))
                    // Blur, for Color and Gradient alike.
                    + deviceNumberField(l, 'blur');
            } else if (l.type === 'shortcode') {
                first += withTip(textarea('shortcode', 'Shortcode'), 'Another plugin\'s shortcode, as on a page, e.g. [wp_swiper id="12"]. It shows in this layer\'s place (layers above it cover it) and can be clicked and swiped. Its height is its own. Press Update to see it in the preview.');
            } else if (l.type === 'button') {
                // As WP Top Info Bar's: its text and link, then its look.
                first += field('button_text', 'Text', 'text')
                    + withTip(field('button_url', 'Link', 'text'), 'A page address (https://…), a path on this site (/contact/), an anchor (#form), mailto: or tel:. Empty: a button that is not a link.')
                    + needs(check('button_new_tab', 'Open in a new window'), 'link');
                const sizes = {};
                Object.entries(BUTTON_SIZES).forEach(([value, [name]]) => { sizes[value] = name; });
                cards += card('Button style', buttonChoice(l, 'button_style', 'Background', {filled:'Filled', bordered:'Border', underline:'Underline'})
                    + needs(buttonChoice(l, 'button_shape', 'Corners', {square:'Square', rounded:'Rounded', round:'Round'}), 'corners')
                    + withTip(respSelect('button_size', 'Size', sizes), 'Preset sizes: padding, height and font size together.')
                    + '<div class="wpbn-colors">' + withTip(colorField('button_color', 'Fill / border color', {alpha:true, def:'#2271b1'}), 'Filled: the button\'s color; Border and Underline: their line\'s.')
                    + colorField('button_text_color', 'Text color', {alpha:true, def:'#ffffff'}) + '</div>');
            } else if (l.type === 'richtext') {
                // WordPress's editor, as WP Swiper's slide texts (startEditor() after the fields are drawn); a plain box without it.
                first += withTip('<div class="wpbn-field wpbn-richtext">' + head(EDITOR_ID, 'Text') + '<textarea id="' + EDITOR_ID + '" data-key="content" rows="6">' + escape(l.content || '') + '</textarea></div>',
                    'Choose Paragraph or a heading in the first menu of the toolbar. Enter starts a new paragraph, Shift + Enter a new line. Headings keep the theme\'s font and size; links can be clicked on the banner.');
                cards += card('Text style', '<div class="wpbn-row">' + (FONTS ? withTip(fontField(l), 'Woodmart\'s fonts: theme fonts (they follow Theme Settings), custom, Adobe, system and Google fonts; a Google font loads with the banner. Empty: the theme\'s text font.')
                        : withTip(field('font_family', 'Font', 'text'), 'Empty: the page\'s text font. As CSS takes it, e.g. "Open Sans", sans-serif; the font must be loaded on the site.'))
                    + weightField(l) + '</div>' + (FONTS ? '<p class="wpbn-font-sample" id="wpbn-font-sample" aria-hidden="true"></p>' : '')
                    + deviceNumberField(l, 'font')
                    + withTip(colorField('color', 'Color', {alpha:true, def:boot.layer.color}), 'The text\'s color; words colored in the editor keep theirs.')
                    + shadowField(l));
            } else {
                first += withTip(textarea('text', 'Title'), 'Enter starts a new line. Wrap words in <u></u> to show them in the Accent color, e.g. Discover <u>Norway</u>.')
                    + withTip(select('tag', 'Heading', {h1:'h1', h2:'h2', h3:'h3', h4:'h4', h5:'h5'}), 'h1 only if this title is the page\'s main title (one h1 per page); otherwise h2, or h3–h5 under other headings. It matters for SEO and screen readers; the size and weight come from the settings below.');
                // Font and Weight on one row with the font sample under them, then Font size, then Color and Accent color.
                cards += card('Title style', '<div class="wpbn-row">' + (FONTS ? withTip(fontField(l), 'Woodmart\'s fonts: theme fonts (they follow Theme Settings), custom, Adobe, system and Google fonts; a Google font loads with the banner. Empty: the theme\'s heading font.')
                        : withTip(field('font_family', 'Font', 'text'), 'Empty: the theme\'s heading font. As CSS takes it, e.g. "Playfair Display", serif; the font must be loaded on the site.'))
                    + weightField(l) + '</div>' + (FONTS ? '<p class="wpbn-font-sample" id="wpbn-font-sample" aria-hidden="true"></p>' : '')
                    // Font size and Letter spacing (per device; each a row of its own: the device icons beside the label), Case and Style, the colours, then Shadow.
                    + deviceNumberField(l, 'font') + deviceNumberField(l, 'spacing')
                    + '<div class="wpbn-row">' + select('text_transform', 'Case', {none:'Normal', uppercase:'UPPERCASE', lowercase:'lowercase', capitalize:'Capitalize'}) + select('font_style', 'Style', {normal:'Normal', italic:'Italic'}) + '</div>'
                    + '<div class="wpbn-colors">' + colorField('color', 'Color', {alpha:true, def:boot.layer.color})
                    + withTip(colorField('accent_color', 'Accent color', {alpha:true, def:'', fallback:boot.primary || l.color}), 'The words wrapped in <u></u> in the title. Default: the theme\'s primary color' + (boot.primary ? '' : ' (none here: the title\'s color)') + '.') + '</div>'
                    + shadowField(l));
            }
            html = '<legend>Layer settings</legend>'
                + (d === 'desktop' ? '' : '<p class="wpbn-device-note"><span class="dashicons dashicons-' + DEVICES[d][0] + '" aria-hidden="true"></span><span>' + DEVICES[d][1] + ' values. Settings without a green dot follow ' + DEVICES[UP[d]][1] + '; clear a number to follow it again.</span></p>')
                + card(l.type === 'overlay' ? 'Fill' : 'Layer', first) + cards
                + (l.type === 'overlay' ? card('Position and size', containerField(l) + heightField(l, 'width') + heightField(l)) + card('Motion', optionalRange(l, 'end_opacity', 'Opacity at the end (%)', {min:0, max:100, note:'The overlay goes from full to this opacity as the page scrolls: 0 fades it out. It does not move.'})) : card('Position and size', (l.type === 'image' ? withTip(check('fill_scene', 'Fill the scene'), 'On: the image fills the scene (a photo and its cutout for the mountain effect; its edges never show while it moves). Off: an object of its own size (Width and Height), placed where you put it, e.g. a picture beside the title.') : '')
                    + containerField(l)
                    // An image object: its Width and Height, then Image fit and the point of its photo in view (greyed with Height Auto).
                    + (imageObject(l) ? heightField(l, 'width') + heightField(l) + needs(fitPositionField(l), 'cropbox') : l.type === 'image' ? fitPositionField(l) : '') + (l.type === 'shortcode' ? heightField(l, 'width') : '')
                    // A title or a Text layer: its Width (Auto: its text's), where its lines wrap.
                    + (l.type === 'text' || l.type === 'richtext' ? heightField(l, 'textwidth') : '')
                    // Scale and Opacity: image layers only (a title has neither).
                    + (l.type !== 'image' ? '' : optionalRange(l, 'scale', 'Scale (%)', {min:10, max:300, to:200, note:imageObject(l) ? 'The image\'s size within its box: 100% is as set by its Width and Height.' : eff(l, 'fit', d) === 'contain' ? 'The image\'s size: 100% is as tall (or wide) as the scene, 30% a third of it.' : '100%: the image just fills the scene; more enlarges it (its edges are cropped).'}) + optionalRange(l, 'opacity', 'Opacity (%)', {min:0, max:100})))
                + card('Motion', optionalRange(l, 'move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400, note:'How far it moves by the end of the scroll; negative: to the left.'})
                    + optionalRange(l, 'move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, note:'How far it moves by the end of the scroll; negative: up.'})
                    + optionalRange(l, 'zoom', 'Zoom (%)', {min:-90, max:300, from:-50, to:100, note:'Size added by the end of the scroll; negative shrinks the layer.'})
                    + optionalRange(l, 'end_opacity', 'Opacity at the end (%)', {min:0, max:100, note:'The layer goes from its Opacity to this one as the page scrolls: 0 fades it out.'})
                    + mouseField(l)))
                + animationCard(l);
        }
        // The picker and the Font list belong to fields about to be redrawn.
        closePicker(); closeFonts(); stopEditor();
        $('settings').innerHTML = '<fieldset class="wpbn-section">' + html + '</fieldset>';
        applyStates();
        targetWarning();
        refreshFontSample();
        drawGradient();
        startEditor();
        $('scene-settings').setAttribute('aria-current', String(!adding && selected < 0));
        $('add-toggle').setAttribute('aria-current', String(adding));
    }
    // One device for the preview and for the fields' device icons.
    function setDevice(value, focusField) {
        $('device').value = value;
        resize(); settings();
        if (focusField) { const button = $('settings').querySelector('[data-field-device="' + value + '"]'); if (button) button.focus(); }
    }
    // The preview is redrawn only by Update; until then the button is lit (as WP Swiper's).
    function changed() { sync(); $('refresh').classList.add('is-stale'); clearTimeout(historyTimer); historyTimer = setTimeout(remember, HISTORY_PAUSE); }
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
        adding = false;
        if (selected >= scene.layers.length) selected = scene.layers.length - 1;
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
        if (input.dataset.inline) {
            const kind = input.dataset.inline, d = input.dataset[kind], l = current(), key = INLINE[kind].keys[d];
            if (input.value === '' && d !== 'desktop') { l[key] = null; input.placeholder = inlineFor(l, kind, d); }
            else if (Number.isFinite(input.valueAsNumber)) l[key] = Math.round(Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber)) * 100) / 100;
            else return;
            // The green dots: tablet / mobile with a value of their own.
            input.closest('.wpbn-field').querySelectorAll('[data-field-device]').forEach(b => b.classList.toggle('has-value', b.dataset.fieldDevice !== 'desktop' && l[INLINE[kind].keys[b.dataset.fieldDevice]] != null));
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
            refreshDots(input.closest('.wpbn-field'));
            const dot = input.closest('.wpbn-field').querySelector('[data-field-device="' + d + '"]'); if (dot && d !== 'desktop') dot.classList.add('has-value');
            changed(); return;
        }
        const key = input.dataset.key || input.dataset.rangeFor;
        if (!key) return;
        const obj = current();
        if (input.type === 'checkbox') {
            obj[key] = input.checked;
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
        // A button's link: Open in a new window applies with one.
        if (key === 'button_url') applyStates();
        // An overlay's thumbnail shows its fill.
        if (key === 'color' && obj.type === 'overlay') list();
        changed();
    });
    app.addEventListener('change', event => {
        if (!event.target.matches('select[data-key]')) return;
        const key = event.target.dataset.key;
        current()[key] = event.target.value === '' && event.target.dataset.inherit ? null : event.target.value;
        if (key === 'font_weight' || key === 'text_transform' || key === 'font_style') refreshFontSample();
        // Container: its width field shows for Custom only.
        if (key === 'container') { settings(); $('settings').querySelector('[data-key="container"]').focus(); }
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
        if (button.dataset.select !== undefined) { adding = false; selected = Number(button.dataset.select); list(); settings(); focusRow(selected); return; }
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
        if (button.id === 'wpbn-add-toggle') { adding = true; list(); settings(); $('settings').querySelector('[data-add]').focus(); return; }
        if (button.dataset.add) {
            const type = button.dataset.add;
            if (scene.layers.length >= 40) return;
            // A new title in the theme's container (it lines up with the page); a new image fills the whole scene.
            const layer = Object.assign({}, boot.layer, {type, name:TYPE_NAMES[type] + ' ' + (scene.layers.length + 1), container:type === 'text' || type === 'button' || type === 'shortcode' ? 'theme' : 'full'});
            // A new overlay: a see-through black (the photo under it shaded) or, with its Gradient, darker towards the bottom.
            if (type === 'overlay') layer.color = OVERLAY_COLOR;
            // A new text: a paragraph to start from, at a reading size and weight, in the theme's container.
            if (type === 'richtext') Object.assign(layer, {content:'<p>Your text here.</p>', font_size:18, font_weight:400, container:'theme'});
            // A new layer does not move; turning a motion on starts it from 0.
            layer.move_y = 0;
            scene.layers.push(layer); selected = scene.layers.length - 1;
            adding = false;
        } else if (button.dataset.action && selected >= 0) {
            const l = scene.layers[selected];
            switch (button.dataset.action) {
            case 'position': openPosition(l, button); return;
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
    $('scene-settings').onclick = () => { adding = false; selected = -1; list(); settings(); };
    const layersBox = $('layers');
    layersBox.addEventListener('keydown', event => {
        const button = event.target.closest('[data-select]');
        if (!button || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        const index = Number(button.dataset.select), to = index + (event.key === 'ArrowUp' ? 1 : -1);
        focusRow(move(index, to) ? to : index);
    });
    // Reordering by dragging a row (pointer events, so the cursor stays a
    // grabbing hand): the row follows the pointer, a line shows where it lands.
    let sorting = null, skipClick = false;
    function clearDrop() { layersBox.querySelectorAll('.is-drop-before,.is-drop-after').forEach(row => row.classList.remove('is-drop-before', 'is-drop-after')); }
    // The first other row whose middle is below the pointer: the dragged one lands above it; none: below the last.
    function dropTarget(y, dragged) {
        const rows = Array.from(layersBox.querySelectorAll('.wpbn-layer-row')).filter(row => row !== dragged);
        if (!rows.length) return null;
        const row = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
        return row ? {row, before:true} : {row:rows[rows.length - 1], before:false};
    }
    function endSort() {
        if (!sorting) return;
        if (sorting.active) { sorting.row.style.transform = ''; sorting.row.classList.remove('is-dragging'); document.body.classList.remove('wpbn-sorting'); clearDrop(); }
        sorting = null;
    }
    layersBox.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.wpbn-layer-tools')) return;
        const row = event.target.closest('.wpbn-layer-row');
        if (row) sorting = {row, index:Number(row.dataset.index), y:event.clientY, active:false};
    });
    document.addEventListener('pointermove', event => {
        if (!sorting) return;
        const dy = event.clientY - sorting.y;
        if (!sorting.active) {
            if (Math.abs(dy) < 4) return;
            sorting.active = true;
            sorting.row.classList.add('is-dragging');
            document.body.classList.add('wpbn-sorting');
        }
        event.preventDefault();
        sorting.row.style.transform = 'translateY(' + dy + 'px)';
        const target = dropTarget(event.clientY, sorting.row);
        clearDrop();
        if (target) target.row.classList.add(target.before ? 'is-drop-before' : 'is-drop-after');
    });
    document.addEventListener('pointerup', event => {
        if (!sorting) return;
        const {active, row, index} = sorting;
        const target = active ? dropTarget(event.clientY, row) : null;
        endSort();
        if (!active) return;
        // The click that ends a drag does not select the row.
        skipClick = true; setTimeout(() => { skipClick = false; }, 0);
        if (!target) return;
        // Above a row means in front of it: a higher index.
        let to = Number(target.row.dataset.index) + (target.before ? 1 : 0);
        if (index < to) to--;
        move(index, to);
    });
    document.addEventListener('pointercancel', endSort);
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
        } catch (error) { /* Frame navigation is in progress. */ }
    }
    // A screen size of one's own per device (the fields above the preview). Typed sizes apply with
    // Update, as the other preview changes; empty fields: the device's usual size and drawing.
    // A size of one's own is shown in a plain frame: the device drawings have fixed proportions.
    // TODO: once the plugin is done, offer screen presets, each with a drawing of its own.
    const SCREENS = {desktop:[1280,721], tablet:[820,1101], mobile:[390,844]};
    const SIZE_LIMITS = {w:[240,3840], h:[240,2160]};
    const draftSizes = {}, sizes = {};
    try { Object.assign(sizes, JSON.parse(localStorage.getItem('wpbn-preview-sizes') || '{}')); Object.assign(draftSizes, sizes); } catch (error) { /* No storage: usual sizes. */ }
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
        try { localStorage.setItem('wpbn-preview-sizes', JSON.stringify(sizes)); } catch (error) { /* Kept for this visit only. */ }
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
        +'<div class="wpbn-focus__frames" aria-hidden="true">'+Object.entries(DEVICES).map(([d,[icon,name]])=>'<figure class="wpbn-focus__device" data-device="'+d+'"><span class="wpbn-focus__frame"><span class="wpbn-position-canvas"></span></span><figcaption><span class="dashicons dashicons-'+icon+'"></span>'+name+'</figcaption></figure>').join('')+'</div></div>'
        +'<p class="wpbn-focus__value"></p><p class="wpbn-position-warning" role="status" hidden><span class="dashicons dashicons-warning" aria-hidden="true"></span><span class="wpbn-position-warning__text"></span></p></div>'
        +'<div class="wpbn-modal__foot"><button type="button" class="button-link wpbn-focus__reset">Reset to centre</button><button type="button" class="button wpbn-modal__cancel">Cancel</button><button type="button" class="button button-primary wpbn-modal__apply">Apply</button></div></div>';
    document.body.append(positionModal);
    const focusStage=positionModal.querySelector('.wpbn-focus__stage');
    const focusPoint=positionModal.querySelector('.wpbn-focus__point');
    let positionLayer=null, positionDraft=null, positionReturn=null, dragging=null;
    const canvasDevice=canvas=>canvas.parentElement===focusStage ? $('device').value : canvas.closest('.wpbn-focus__device').dataset.device;
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
    // An image layer with its photo: the point in view. Without a photo there is nothing to crop: placed as text is.
    // positionKind: 'place' (an image object's box: where it stands) or 'focus' (the point of the photo in view).
    let positionKind='focus';
    const focusMode=()=>!!positionLayer && positionLayer.type==='image' && !!images[positionLayer.image] && positionKind!=='place';
    const withDraft=()=>Object.assign({},positionLayer,focusMode() ? {focus_x:positionDraft[0],focus_y:positionDraft[1]} : {[dkey('x',positionDevice)]:positionDraft[0],[dkey('y',positionDevice)]:positionDraft[1]});
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
        focusPoint.style.left=(focusMode() ? x : inScene(positionLayer,$('device').value,x))+'%';focusPoint.style.top=y+'%';
        positionModal.querySelector('.wpbn-focus__value').textContent=x+'% '+y+'%';
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
            const mainDevice=$('device').value, mainWidth=sceneWidth(mainDevice), mainHeight=sceneHeight(mainDevice), ratio=mainWidth/mainHeight;
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
                const v=key=>eff(layer,key,device);
                const item=document.createElement('span');item.className='wpbn-position-item'+(layer===positionLayer?' wpbn-position-target':' is-other');
                const box=boxOf(device,layer);
                Object.assign(item.style,{left:(box.left+v('x')*box.width/100)+'%',top:v('y')+'%',width:(v('width')*box.width/100)+'%',opacity:v('opacity')/100,transform:anchorAt(layer,v('x'),v('y'),v('scale')/100)});
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
                    item.textContent=layer.button_text;canvas.append(item);return;}
                // An overlay: the whole scene in its fill.
                if(layer.type==='overlay'){const blur=inlineFor(layer,'blur',device)*width/baseWidth;Object.assign(item.style,{backdropFilter:blur ? 'blur('+blur+'px)' : '',width:overlayWidth(layer,device)+'%',height:overlayHeight(layer,device)+'%',background:overlayFill(layer)});canvas.append(item);return;}
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
        else if(apply){positionLayer[dkey('x',positionDevice)]=positionDraft[0];positionLayer[dkey('y',positionDevice)]=positionDraft[1];settings();changed();}
        positionModal.hidden=true;document.body.classList.remove('wpbn-modal-open');dragging=null;positionLayer=null;
        const button=positionReturn && positionReturn.isConnected?positionReturn:$('settings').querySelector('[data-action="position"]');
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
        const d=$('device').value, text=!focusMode(), share=text ? boxOf(d,positionLayer).width/100 : 1;
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
    positionModal.querySelector('.wpbn-modal__apply').onclick=()=>closePosition(true);
    positionModal.querySelector('.wpbn-modal__cancel').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-modal__close').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-modal__backdrop').onclick=()=>closePosition(false);
    positionModal.querySelector('.wpbn-focus__reset').onclick=()=>{positionDraft=[50,50];showPosition();};
    document.addEventListener('keydown',event=>{
        if(positionModal.hidden)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePosition(false);}
        if(event.key==='Tab'){
            const controls=Array.from(positionModal.querySelectorAll('button,[tabindex="0"]'));
            const first=controls[0],last=controls[controls.length-1];
            if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
            else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
        }
    },true);
    // Redrawn when the stage changes size (text sizes follow its width), not while dragging.
    let lastStageWidth=0;
    new ResizeObserver(()=>{const w=focusStage.getBoundingClientRect().width;if(positionLayer && Math.abs(w-lastStageWidth)>.5){lastStageWidth=w;drawPositionScenes();}}).observe(focusStage);
    list();settings();resize();preview();
}());
