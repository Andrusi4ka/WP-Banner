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
        text: ['editor-textcolor', 'Title', 'The banner\'s title, between the image layers (behind a cutout, for the mountain effect).']
    };
    const TYPE_NAMES = {image:'Image', text:'Title'};
    // A field with its help behind an "i" beside the label (the dark tooltip), instead of under it.
    const withTip = (html, text) => html.replace('</label>', '</label>' + tip(text));
    // adding: the settings column shows the elements to add instead of a layer's settings.
    let selected = -1, dark = false, adding = false;
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
        if (l.type === 'image' && base === 'width') return 100;
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
        font_size:boot.layer.font_size, tablet_font_size:boot.layer.tablet_font_size, mobile_font_size:boot.layer.mobile_font_size};
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
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="1" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="1" value="' + (own == null ? '' : escape(own)) + '" placeholder="' + value + '" aria-label="' + label + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '>'
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
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="1" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="1" value="' + value + '">'
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
    // A switch (as WP Swiper's checkboxes). checked: for a switch that is not a stored key of its own.
    function check(key, label, help, checked) {
        const id = 'wpbn-f-' + key, on = checked === undefined ? !!current()[key] : checked;
        return '<div class="wpbn-field wpbn-field--check"><label class="wpbn-switch" for="' + id + '"><input id="' + id + '" type="checkbox" data-key="' + key + '"' + (on ? ' checked' : '') + '><span class="wpbn-switch__track" aria-hidden="true"></span><span>' + label + '</span></label>' + note(help) + '</div>';
    }
    // A field that only applies in some settings: greyed (not hidden) otherwise, its value kept.
    // A title's font size on a device: tablet and mobile empty follow the larger screen (as WPBN_Settings::fonts()).
    const FONT_KEYS = {desktop:'font_size', tablet:'tablet_font_size', mobile:'mobile_font_size'};
    function fontFor(l, d) { return d === 'desktop' || l[FONT_KEYS[d]] != null ? l[FONT_KEYS[d]] : fontFor(l, UP[d]); }
    // Font size as WP Swiper's "Custom size": Desktop, the arrow, then Tablet and Mobile once it is
    // pressed (or while one of them has a size of its own); each a number with "px" after it.
    let fontsOpen = false;
    function fontSizeField(l) {
        const open = fontsOpen || l.tablet_font_size != null || l.mobile_font_size != null;
        const item = d => {
            const key = FONT_KEYS[d], id = 'wpbn-f-' + key, own = l[key] != null, max = d === 'mobile' ? 250 : 500;
            return '<div class="wpbn-inline-devices__item" data-device="' + d + '"><label for="' + id + '" title="' + DEVICES[d][1] + '"><span class="dashicons dashicons-' + DEVICES[d][0] + '" aria-hidden="true"></span>' + DEVICES[d][1] + '</label>'
                + '<span class="wpbn-inline-devices__box"><input id="' + id + '" data-font="' + d + '" type="number" min="8" max="' + max + '" step="1" value="' + (own ? escape(l[key]) : '') + '" placeholder="' + escape(fontFor(l, d)) + '" aria-label="Font size — ' + DEVICES[d][1] + '"><span class="wpbn-inline-devices__unit" aria-hidden="true">px</span></span></div>';
        };
        return '<div class="wpbn-field wpbn-field--inline-devices"><div class="wpbn-field__head"><span class="wpbn-field__label">Font size</span>' + tip('Tablet and mobile: empty takes the larger screen\'s size (shown in grey); the arrow shows them.') + '</div>'
            + '<div class="wpbn-inline-devices' + (open ? ' is-open' : '') + '">' + item('desktop')
            + '<button type="button" class="wpbn-inline-devices__toggle" aria-expanded="' + open + '" aria-label="Tablet and mobile sizes" title="Tablet and mobile sizes"><span class="dashicons dashicons-arrow-right-alt2" aria-hidden="true"></span></button>'
            + item('tablet') + item('mobile') + '</div></div>';
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
    // Placed by class: the scene fills its block.
    // Placement by class only with the desktop Height on Auto (as WPBN_Settings::placed_by_class()).
    const autoHeight = () => scene.height_unit === 'auto';
    const filling = () => !!String(scene.target || '').trim() && autoHeight();
    const NEEDS = {autoheight: autoHeight};
    // A help text behind an "i" icon, shown on a dark tooltip on hover and keyboard focus (as WP Swiper's).
    const tip = text => '<span class="wpbn-tip" tabindex="0" role="img" aria-label="' + escape(text) + '" data-tip="' + escape(text) + '"><span class="dashicons dashicons-info-outline" aria-hidden="true"></span></span>';
    const needs = (html, when) => html.replace('<div class="wpbn-field', '<div data-needs="' + when + '" class="wpbn-field');
    function applyStates() {
        $('settings').querySelectorAll('[data-needs]').forEach(el => {
            const on = !!(NEEDS[el.dataset.needs] && NEEDS[el.dataset.needs]());
            el.classList.toggle('is-disabled', !on);
            el.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = !on; });
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
    function positionParts(layer) {
        const d = device(), image = layer.type === 'image' && !!images[layer.image];
        const mine = !image && d !== 'desktop' && (layer[dkey('x', d)] != null || layer[dkey('y', d)] != null);
        const value = image ? escape(layer.focus_x) + '% ' + escape(layer.focus_y) + '%' : escape(eff(layer, 'x', d)) + '% ' + escape(eff(layer, 'y', d)) + '%';
        return {
            button: '<button type="button" class="button wpbn-position-button" data-action="position">' + icons.position + '<span>Position</span></button>',
            value: '<p class="wpbn-position-value">' + value + (mine ? ' <button type="button" class="button-link wpbn-position-reset" data-action="position-inherit">Use ' + DEVICES[UP[d]][1] + '\'s</button>' : '') + '</p>'
        };
    }
    function positionField(layer) {
        const p = positionParts(layer);
        return '<div class="wpbn-field wpbn-position">' + p.button + p.value + '</div>';
    }
    // An image layer: Image fit (its label and device icons over the select) and Position beside it,
    // Position's value under its button (laid out by a grid in admin.css).
    function fitPositionField(layer) {
        const p = positionParts(layer);
        return respSelect('fit', 'Image fit', {cover:'Cover', contain:'Contain'}, p.button + p.value).replace('<div class="wpbn-field"', '<div class="wpbn-field wpbn-position wpbn-fit-position"');
    }

    // Layers: the front one at the top, as in Photoshop. Each row selects its
    // layer; its icons hide, copy or remove it; drag (or Alt + arrows) reorders.
    function list() {
        const box = $('layers');
        box.replaceChildren();
        if (!scene.layers.length) { box.innerHTML = '<p class="wpbn-empty">Add a background image, a title and a transparent front image.</p>'; return; }
        for (let i = scene.layers.length - 1; i >= 0; i--) {
            const l = scene.layers[i], name = escape(l.name);
            const thumb = l.type === 'text'
                ? '<span class="wpbn-layer-thumb wpbn-layer-thumb--text" style="color:' + escape(l.color) + '" aria-hidden="true">T</span>'
                : '<span class="wpbn-layer-thumb" aria-hidden="true">' + (images[l.image] ? '<img src="' + escape(images[l.image]) + '" alt="">' : '<span class="dashicons dashicons-format-image"></span>') + '</span>';
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
    function effHeight(d) {
        const [key, unitKey] = HEIGHT[d];
        return scene[unitKey] == null && d !== 'desktop' ? effHeight(UP[d]) : [scene[key], scene[unitKey]];
    }
    const UNIT_NAMES = {auto:'Auto', px:'px', vh:'vh', '%':'%'};
    function heightField() {
        const d = device(), [key, unitKey] = HEIGHT[d], own = scene[unitKey] != null, [number, unit] = effHeight(d), id = 'wpbn-f-' + key, off = unit === 'auto';
        const [min, max] = unit === 'px' ? [160, 2400] : unit === 'auto' ? [1, 2400] : [1, 200];
        const inherit = d === 'desktop' ? '' : '<option value=""' + (own ? '' : ' selected') + '>Inherit</option>';
        const dots = {tablet:scene.tablet_height_unit != null, mobile:scene.mobile_height_unit != null};
        return '<div class="wpbn-field wpbn-field--height">' + head(id, 'Height', heightTip() + devices(dots)) + '<div class="wpbn-field__row">'
            + '<input id="' + id + '" data-height="' + d + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + (own ? escape(number) : '') + '" placeholder="' + escape(number) + '"' + (off ? ' disabled' : '') + '>'
            + '<select data-key="' + unitKey + '"' + (d === 'desktop' ? '' : ' data-inherit="height"') + ' aria-label="Height unit">' + inherit + ['auto', 'px', 'vh', '%'].map(u => '<option value="' + u + '"' + (own && u === unit ? ' selected' : '') + '>' + UNIT_NAMES[u] + '</option>').join('') + '</select>'
            + '</div><p class="description" id="wpbn-height-note"' + (filling() ? ' hidden' : '') + '>' + UNIT_HELP[unit] + '</p></div>';
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
    function unitChanged(device) {
        const [key, unitKey, fallback] = HEIGHT[device], unit = scene[unitKey];
        if (unit == null) scene[key] = null;
        else {
            if (scene[key] == null) scene[key] = device === 'desktop' ? fallback : effHeight(UP[device])[0];
            if ((unit === 'vh' || unit === '%') && scene[key] > 200) scene[key] = 100;
            else if (unit === 'px' && scene[key] < 160) scene[key] = fallback;
        }
        settings();
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
                + card('Placement', targetField());
        } else {
            const l = scene.layers[selected];
            const d = device();
            let first = field('name', 'Layer name'), cards = '';
            if (l.type === 'image') first += picker(l);
            else {
                first += withTip(textarea('text', 'Title'), 'Enter starts a new line.')
                    + withTip(select('tag', 'Heading', {h1:'h1', h2:'h2', h3:'h3', h4:'h4', h5:'h5'}), 'h1 if the banner\'s title is the page\'s title (one h1 per page); otherwise h2, or a lower one (h3–h5) under other headings. The title takes the theme\'s heading font unless a font is set below.');
                cards += card('Title style', fontSizeField(l) + field('color', 'Color', 'color')
                    + withTip(field('font_family', 'Font', 'text'), 'Empty: the theme\'s heading font. As CSS takes it, e.g. "Playfair Display", serif; the font must be loaded on the site.')
                    + select('font_weight', 'Weight', {100:'100 Thin', 200:'200', 300:'300 Light', 400:'400 Regular', 500:'500 Medium', 600:'600 Semi-bold', 700:'700 Bold', 800:'800 Extra-bold', 900:'900 Black'}));
            }
            html = '<legend>Layer settings</legend>'
                + (d === 'desktop' ? '' : '<p class="wpbn-device-note"><span class="dashicons dashicons-' + DEVICES[d][0] + '" aria-hidden="true"></span><span>' + DEVICES[d][1] + ' values. Settings without a green dot follow ' + DEVICES[UP[d]][1] + '; clear a number to follow it again.</span></p>')
                + card('Layer', first) + cards
                + card('Position and size', (l.type === 'image' ? fitPositionField(l) : positionField(l))
                    + (l.type === 'image' ? '' : respRange('width', 'Width (%)', {min:1, max:300, to:200})) + optionalRange(l, 'scale', 'Scale (%)', {min:10, max:300, to:200, note:l.type !== 'image' ? '' : eff(l, 'fit', d) === 'contain' ? 'The image\'s size: 100% is as tall (or wide) as the scene, 30% a third of it.' : 'Zoom: the image fills the scene and grows by this much (the edges are cropped).'}) + optionalRange(l, 'opacity', 'Opacity (%)', {min:0, max:100}))
                + card('Motion', optionalRange(l, 'move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400})
                    + optionalRange(l, 'move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, note:'Negative values move the layer up.'})
                    + optionalRange(l, 'zoom', 'Zoom (%)', {min:-90, max:300, from:-50, to:100, note:'Size added by the end of the scroll; negative shrinks the layer.'})
                    + optionalRange(l, 'end_opacity', 'Opacity at the end (%)', {min:0, max:100, note:'The layer goes from its Opacity to this one as the page scrolls: 0 fades it out.'}));
        }
        $('settings').innerHTML = '<fieldset class="wpbn-section">' + html + '</fieldset>';
        applyStates();
        targetWarning();
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
    function changed() { sync(); $('refresh').classList.add('is-stale'); }
    app.addEventListener('input', event => {
        const input = event.target;
        if (input.dataset.font) {
            const l = current(), key = FONT_KEYS[input.dataset.font];
            if (input.value === '' && input.dataset.font !== 'desktop') l[key] = null;
            else if (Number.isFinite(input.valueAsNumber)) l[key] = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber));
            else return;
            input.closest('.wpbn-inline-devices').querySelectorAll('[data-font]').forEach(other => { other.placeholder = fontFor(l, other.dataset.font); });
            changed(); return;
        }
        // Height: a number typed on tablet / mobile gives it a unit of its own too (the one it followed);
        // emptied there, it follows the larger screen again.
        if (input.dataset.height) {
            const d = input.dataset.height, [hk, uk] = HEIGHT[d];
            if (input.value === '' && d !== 'desktop') { scene[uk] = null; scene[hk] = null; settings(); const again = $('f-' + hk); if (again) again.focus(); changed(); return; }
            if (!Number.isFinite(input.valueAsNumber)) return;
            if (scene[uk] == null) scene[uk] = effHeight(d)[1];
            scene[hk] = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber));
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
            if (/^use_/.test(key)) {
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
        refreshDots(input.closest('.wpbn-field')); refreshReset(input.closest('.wpbn-field'));
        if (key === 'name' || key === 'color') list();
        if (key === 'target') { targetWarning(); heightHelp(); }
        changed();
    });
    app.addEventListener('change', event => {
        if (!event.target.matches('select[data-key]')) return;
        const key = event.target.dataset.key;
        current()[key] = event.target.value === '' && event.target.dataset.inherit ? null : event.target.value;
        refreshDots(event.target.closest('.wpbn-field'));
        // Image fit: Scale's help follows it.
        if (selected >= 0 && /^fit/.test(key)) { settings(); $('settings').querySelector('[data-key="' + key + '"]').focus(); }
        if (selected < 0 && /height_unit$/.test(key)) { unitChanged(device()); $('settings').querySelector('[data-key="' + key + '"]').focus(); }
        changed();
    });
    app.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !app.contains(button)) return;
        if (button.dataset.previewDevice) { setDevice(button.dataset.previewDevice); return; }
        if (button.dataset.fieldDevice) { setDevice(button.dataset.fieldDevice, true); return; }
        if (button.dataset.select !== undefined) { adding = false; selected = Number(button.dataset.select); list(); settings(); focusRow(selected); return; }
        if (button.dataset.rowAction) { rowAction(button.dataset.rowAction, Number(button.dataset.index)); return; }
        if (button.classList.contains('wpbn-inline-devices__toggle')) {
            const box = button.closest('.wpbn-inline-devices'), open = !box.classList.contains('is-open');
            box.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); fontsOpen = open;
            if (open) { const tablet = box.querySelector('[data-font="tablet"]'); if (tablet) tablet.focus(); }
            return;
        }
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
            const layer = Object.assign({}, boot.layer, {type, name:(type === 'text' ? 'Title' : 'Image') + ' ' + (scene.layers.length + 1)});
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
    // POST to the isolated frame: no draft content is stored by preview.
    function preview() {
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
    function sizeFields() {
        const d = $('device').value, own = draftSizes[d], [w, h] = SCREENS[d];
        $('res-w').placeholder = w; $('res-h').placeholder = h;
        $('res-w').value = own && own[0] !== null ? own[0] : ''; $('res-h').value = own && own[1] !== null ? own[1] : '';
        sizeHint();
    }
    function sizeHint() {
        const d = $('device').value, own = sizeOf(draftSizes, d), width = own ? own[0] : SCREENS[d][0], shows = valuesFor(width);
        $('res-hint').textContent = DEVICES[d][1] + ': ' + (own ? 'own size' : 'usual size') + ' · ' + DEVICES[shows][1] + ' values' + (shows !== d ? ' (by its width)' : '');
    }
    function sizeInput() {
        const d = $('device').value, read = (input, [min, max]) => input.value === '' || !Number.isFinite(input.valueAsNumber) ? null : Math.round(Math.min(max, Math.max(min, input.valueAsNumber)));
        const w = read($('res-w'), SIZE_LIMITS.w), h = read($('res-h'), SIZE_LIMITS.h);
        if (w === null && h === null) delete draftSizes[d]; else draftSizes[d] = [w, h];
        sizeHint(); $('refresh').classList.add('is-stale');
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
    $('frame').onload=()=>{resize();frameState();$('frame').dataset.state='done';};
    new ResizeObserver(resize).observe($('preview-stage'));
    addEventListener('resize',resize);
    document.getElementById('post').addEventListener('submit',sync);
    // Position. An image layer: the point of the photo kept in view where its box crops it
    // (object-position), the whole photo shown, as WP Swiper's Image position; one for every
    // device, the frames show each device's crop. A text layer: where it stands on the device
    // being edited (drag it, or click to put its centre there). The layer is outlined, the
    // others dimmed; what an image layer leaves uncovered is hatched.
    const SIZES = {desktop:[1280], tablet:[820], mobile:[390]};
    // The scene's height on a device in pixels; % and Auto as in the preview (a block as tall as the screen).
    const SCREEN = {desktop:721, tablet:1101, mobile:844};
    function sceneHeight(d) { const [v, u] = effHeight(d); return u === 'px' ? v : u === 'auto' ? SCREEN[d] : SCREEN[d] * v / 100; }
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
    const focusImage=positionModal.querySelector('.wpbn-focus__image');
    // The layer as it would be with the draft applied: an image's point in view, or the text's place on the device being edited.
    let positionDevice='desktop';
    // An image layer with its photo: the point in view. Without a photo there is nothing to crop: placed as text is.
    const focusMode=()=>!!positionLayer && positionLayer.type==='image' && !!images[positionLayer.image];
    const withDraft=()=>Object.assign({},positionLayer,focusMode() ? {focus_x:positionDraft[0],focus_y:positionDraft[1]} : {[dkey('x',positionDevice)]:positionDraft[0],[dkey('y',positionDevice)]:positionDraft[1]});
    // The layer's box in scene pixels at a scroll progress (0 start, 1 end), as frontend.css draws it.
    function layerBox(layer, d, progress) {
        const w=SIZES[d][0], h=sceneHeight(d), s=eff(layer,'scale',d)/100;
        const bw=eff(layer,'width',d)/100*w*s, bh=h*s, cx=eff(layer,'x',d)/100*w+eff(layer,'move_x',d)*progress, cy=eff(layer,'y',d)/100*h+eff(layer,'move_y',d)*progress;
        return {w, h, left:cx-bw/2, right:cx+bw/2, top:cy-bh/2, bottom:cy+bh/2};
    }
    const uncovered=b=>b.left>.5 || b.top>.5 || b.right<b.w-.5 || b.bottom<b.h-.5;
    // Hatched bands where the layer does not reach (images only: text never fills the scene).
    function drawGaps(canvas) {
        canvas.querySelectorAll('.wpbn-position-gap').forEach(gap=>gap.remove());
        if(positionLayer.type==='text')return;
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
        const found=positionLayer.type==='text' ? [] : Object.keys(SIZES).filter(d=>uncovered(layerBox(layer,d,0))).map(d=>DEVICES[d][1]);
        box.hidden=!found.length;
        box.querySelector('.wpbn-position-warning__text').textContent=found.length ? 'This layer does not cover the whole scene on '+found.join(', ')+' (hatched). Raise the Scale or the Width to cover it.' : '';
    }
    function showPosition() {
        const [x,y]=positionDraft, layer=withDraft();
        focusPoint.style.left=x+'%';focusPoint.style.top=y+'%';
        positionModal.querySelector('.wpbn-focus__value').textContent=x+'% '+y+'%';
        focusStage.setAttribute('aria-valuenow',x);focusStage.setAttribute('aria-valuetext','Horizontal '+x+'%, vertical '+y+'%');
        positionModal.querySelectorAll('.wpbn-position-canvas').forEach(canvas=>{
            const target=canvas.querySelector('.wpbn-position-target'), d=canvasDevice(canvas);
            if(target && focusMode()){const img=target.querySelector('img');if(img)img.style.objectPosition=x+'% '+y+'%';}
            else if(target){target.style.left=eff(layer,'x',d)+'%';target.style.top=eff(layer,'y',d)+'%';}
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
            const mainDevice=$('device').value, mainWidth=SIZES[mainDevice][0], mainHeight=sceneHeight(mainDevice), ratio=mainWidth/mainHeight;
            focusStage.style.aspectRatio=mainWidth+'/'+mainHeight;
            focusStage.style.width='min(100%, calc(min(60vh, 560px) * '+ratio+'))';
        }
        positionModal.querySelectorAll('.wpbn-focus__frame').forEach(frame=>{
            const d=frame.parentElement.dataset.device, w=SIZES[d][0], h=sceneHeight(d), r=w/h;
            Object.assign(frame.style,{aspectRatio:w+'/'+h,width:Math.min(150,84*r)+'px'});
        });
        positionModal.querySelectorAll('.wpbn-position-canvas').forEach(canvas=>{
            canvas.replaceChildren();
            const device=canvasDevice(canvas), baseWidth=SIZES[device][0];
            const width=canvas.getBoundingClientRect().width;
            scene.layers.forEach(layer=>{
                if(layer.hidden && layer!==positionLayer)return;
                const v=key=>eff(layer,key,device);
                const item=document.createElement('span');item.className='wpbn-position-item'+(layer===positionLayer?' wpbn-position-target':' is-other');
                Object.assign(item.style,{left:v('x')+'%',top:v('y')+'%',width:v('width')+'%',opacity:v('opacity')/100,transform:'translate(-50%,-50%) scale('+v('scale')/100+')'});
                if(layer.type==='image') {
                    item.style.height='100%';
                    if(images[layer.image]){const image=document.createElement('img');image.src=images[layer.image];image.alt='';image.style.objectFit=v('fit');image.style.objectPosition=layer.focus_x+'% '+layer.focus_y+'%';item.append(image);}
                }else{item.textContent=layer.text;item.style.color=layer.color;item.style.fontSize=fontFor(layer,device)*width/baseWidth+'px';}
                canvas.append(item);
            });
        });
        showPosition();
    }
    function openPosition(layer,button) {
        positionDevice=device();positionLayer=layer;positionReturn=button;
        const image=focusMode();
        positionDraft=image ? [layer.focus_x,layer.focus_y] : [eff(layer,'x',positionDevice),eff(layer,'y',positionDevice)];
        positionModal.classList.toggle('is-focus',image);
        focusImage.src=image && images[layer.image] ? images[layer.image] : '';
        positionModal.querySelector('.wpbn-modal__what').textContent=image ? 'Image position' : 'Position';
        positionModal.querySelector('.wpbn-modal__layer').textContent=image ? layer.name : layer.name+' · '+DEVICES[positionDevice][1];
        positionModal.querySelector('.wpbn-position-help').textContent=image
            ? 'Click the part of the image to keep in view when its layer crops it. It applies on every device; the frames show each one. Arrow keys move the point by 1%; with Shift, by 10%.'
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
        positionDraft=dragging && dragging.move
            ? [percent(dragging.from[0]+(event.clientX-dragging.x)/r.width*100),percent(dragging.from[1]+(event.clientY-dragging.y)/r.height*100)]
            : [percent((event.clientX-r.left)/r.width*100),percent((event.clientY-r.top)/r.height*100)];
        showPosition();
    }
    focusStage.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();focusStage.focus();focusStage.setPointerCapture(event.pointerId);
        // On the layer: it moves with the pointer. Elsewhere: its centre jumps there.
        dragging={move:onLayer(event),x:event.clientX,y:event.clientY,from:positionDraft.slice()};
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
