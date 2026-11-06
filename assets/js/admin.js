(function () {
    'use strict';
    const app = document.getElementById('wplm-app');
    if (!app) return;
    const boot = JSON.parse(document.getElementById('wplm-boot').textContent);
    const scene = boot.scene;
    const images = boot.images;
    const icons = boot.icons;
    const imageInfo = boot.imageInfo || {};
    // The kinds of element "Add element" offers (a tile each in the settings column): icon, name, what it is for.
    const ELEMENTS = {
        image: ['format-image', 'Image', 'A photo, or a transparent cutout in front of the title.'],
        text: ['editor-textcolor', 'Text', 'A title between the image layers.']
    };
    // adding: the settings column shows the elements to add instead of a layer's settings.
    let selected = -1, dark = false, adding = false;
    const turned = {};
    const drawings = {
        desktop: {file:'desktop.svg',width:1000.2,height:793.1,screen:[22.89,23.39,954.91,537.91],radius:0},
        tablet: {file:'tablet.svg',width:1379.63,height:1789.88,screen:[78.02,84.23,1214.8,1631.04],radius:17.15},
        mobile: {file:'phone.svg',width:213.04,height:429.61,screen:[12.01,10.13,188.99,409.35],radius:24.05}
    };
    const DEVICES = {desktop:['desktop','Desktop'], tablet:['tablet','Tablet'], mobile:['smartphone','Mobile']};
    const $ = id => document.getElementById('wplm-' + id);
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const device = () => $('device').value;
    const current = () => selected < 0 ? scene : scene.layers[selected];
    function sync() { $('data').value = JSON.stringify(scene); }
    // Per-device layer settings, as in WP Swiper: desktop always has a value;
    // tablet and mobile null = the larger screen's (mobile → tablet → desktop).
    const UP = {tablet:'desktop', mobile:'tablet'};
    const dkey = (base, d) => d === 'desktop' ? base : base + '_' + d;
    function eff(l, base, d) {
        while (d !== 'desktop' && (l[dkey(base, d)] === null || l[dkey(base, d)] === undefined)) d = UP[d];
        return l[dkey(base, d)];
    }
    const ownValues = (l, base) => ({tablet: l[dkey(base, 'tablet')] != null, mobile: l[dkey(base, 'mobile')] != null});

    // Fields, as WP Swiper draws them: a label row (with the device icons for
    // per-device values), the control, a help text; grouped in grey cards.
    const card = (title, body) => '<div class="wplm-card"><p class="wplm-subheading">' + title + '</p>' + body + '</div>';
    const note = text => text ? '<p class="description">' + text + '</p>' : '';
    const head = (id, label, extra) => '<div class="wplm-field__head"><label for="' + id + '">' + label + '</label>' + (extra || '') + '</div>';
    // own: {tablet, mobile} true where that device has a value of its own (a green dot, as in WP Swiper).
    function devices(own) {
        return '<span class="wplm-devices" role="group" aria-label="Device">' + Object.entries(DEVICES).map(([d, [icon, name]]) =>
            '<button type="button" class="wplm-devices__btn' + (d === device() ? ' is-active' : '') + (own && own[d] ? ' has-value' : '') + '" data-field-device="' + d + '" aria-pressed="' + (d === device()) + '" aria-label="' + name + '" title="' + name + '"><span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span></button>').join('') + '</span>';
    }
    // A per-device slider and number. On tablet / mobile an empty number takes the larger screen's value (its placeholder).
    function respRange(base, label, o) {
        const l = current(), d = device(), key = dkey(base, d), own = l[key], value = escape(eff(l, base, d)), id = 'wplm-f-' + key;
        return '<div class="wplm-field" data-base="' + base + '">' + head(id, label, devices(ownValues(l, base))) + '<div class="wplm-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="1" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="1" value="' + (own == null ? '' : escape(own)) + '" placeholder="' + value + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '></div>' + note(o.note) + '</div>';
    }
    function respSelect(base, label, options) {
        const l = current(), d = device(), key = dkey(base, d), own = l[key], id = 'wplm-f-' + key;
        const inherit = d === 'desktop' ? '' : '<option value="">Same as ' + DEVICES[UP[d]][1] + ' (' + options[eff(l, base, UP[d])] + ')</option>';
        return '<div class="wplm-field" data-base="' + base + '">' + head(id, label, devices(ownValues(l, base))) + '<select id="' + id + '" data-key="' + key + '"' + (d === 'desktop' ? '' : ' data-inherit="' + base + '"') + '>' + inherit
            + Object.entries(options).map(([value, text]) => '<option value="' + value + '"' + (own === value ? ' selected' : '') + '>' + text + '</option>').join('') + '</select></div>';
    }
    function refreshDots(fieldEl) {
        if (!fieldEl || !fieldEl.dataset.base) return;
        const own = ownValues(current(), fieldEl.dataset.base);
        fieldEl.querySelectorAll('[data-field-device]').forEach(b => b.classList.toggle('has-value', !!own[b.dataset.fieldDevice]));
    }
    function field(key, label, type, help) {
        const id = 'wplm-f-' + key;
        return '<div class="wplm-field">' + head(id, label) + '<input id="' + id + '" data-key="' + key + '" type="' + (type || 'text') + '" value="' + escape(current()[key]) + '">' + note(help) + '</div>';
    }
    // A slider beside its number. keys: one key, or one per device ({desktop, tablet, mobile}).
    // The slider may cover a narrower span (from / to) than the number allows.
    function range(keys, label, o) {
        const perDevice = typeof keys !== 'string';
        const key = perDevice ? keys[device()] : keys, id = 'wplm-f-' + key, value = escape(current()[key]);
        return '<div class="wplm-field">' + head(id, label, perDevice ? devices() : '') + '<div class="wplm-field__row">'
            + '<input type="range" data-range-for="' + key + '" min="' + (o.from ?? o.min) + '" max="' + (o.to ?? o.max) + '" step="1" value="' + value + '" aria-label="' + label + '">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + o.min + '" max="' + o.max + '" step="1" value="' + value + '"></div>' + note(o.note) + '</div>';
    }
    function select(key, label, options) {
        const id = 'wplm-f-' + key;
        return '<div class="wplm-field">' + head(id, label) + '<select id="' + id + '" data-key="' + key + '">' + Object.entries(options).map(([value, text]) => '<option value="' + value + '"' + (current()[key] === value ? ' selected' : '') + '>' + text + '</option>').join('') + '</select></div>';
    }
    function picker(layer) {
        const url = images[layer.image];
        return '<div class="wplm-field"><div class="wplm-field__head"><span class="wplm-field__label">Image</span></div><div class="wplm-picker"><span class="wplm-picker__thumb">' + (url ? '<img src="' + escape(url) + '" alt="">' : '') + '</span>'
            + '<button type="button" class="button" data-action="image">' + (layer.image ? 'Change' : 'Choose') + '</button>'
            + (layer.image ? '<button type="button" class="button-link wplm-picker__remove" data-action="clear">Remove</button>' : '') + '</div>' + imageDetails(layer.image) + '</div>';
    }
    // The chosen image's file name, pixel size and weight.
    function imageDetails(id) {
        const i = imageInfo[id];
        if (!id || !i) return '';
        const size = [i.width && i.height ? i.width + ' × ' + i.height + ' px' : '', i.size || ''].filter(Boolean).join(' · ');
        return '<p class="wplm-picker__info"><span class="wplm-picker__name">' + escape(i.name || '') + '</span>' + (size ? '<span class="wplm-picker__size">' + escape(size) + '</span>' : '') + '</p>';
    }
    // Position: an outline button (its icon and name) and the value under it. For an image it is the
    // point kept in view (one for every device, as in WP Swiper); for text, where it stands on this device.
    function positionField(layer) {
        const d = device(), image = layer.type === 'image' && !!images[layer.image];
        const mine = !image && d !== 'desktop' && (layer[dkey('x', d)] != null || layer[dkey('y', d)] != null);
        const value = image ? 'Point in view: ' + escape(layer.focus_x) + '% ' + escape(layer.focus_y) + '%' : escape(eff(layer, 'x', d)) + '% ' + escape(eff(layer, 'y', d)) + '%';
        return '<div class="wplm-field wplm-position"><button type="button" class="button wplm-position-button" data-action="position">' + icons.position + '<span>Position</span></button>'
            + '<p class="wplm-position-value">' + value + (mine ? ' <button type="button" class="button-link wplm-position-reset" data-action="position-inherit">Use ' + DEVICES[UP[d]][1] + '\'s</button>' : '') + '</p></div>';
    }

    // Layers: the front one at the top, as in Photoshop. Each row selects its
    // layer; its icons hide, copy or remove it; drag (or Alt + arrows) reorders.
    function list() {
        const box = $('layers');
        box.replaceChildren();
        if (!scene.layers.length) { box.innerHTML = '<p class="wplm-empty">Add a background image, a title and a transparent front image.</p>'; return; }
        for (let i = scene.layers.length - 1; i >= 0; i--) {
            const l = scene.layers[i], name = escape(l.name);
            const thumb = l.type === 'text'
                ? '<span class="wplm-layer-thumb wplm-layer-thumb--text" style="color:' + escape(l.color) + '" aria-hidden="true">T</span>'
                : '<span class="wplm-layer-thumb" aria-hidden="true">' + (images[l.image] ? '<img src="' + escape(images[l.image]) + '" alt="">' : '<span class="dashicons dashicons-format-image"></span>') + '</span>';
            const row = document.createElement('div');
            row.className = 'wplm-layer-row' + (i === selected && !adding ? ' is-active' : '') + (l.hidden ? ' is-hidden' : '');
            row.setAttribute('role', 'listitem');
            row.dataset.index = i;
            row.innerHTML = '<span class="wplm-layer-grip" aria-hidden="true"></span><button type="button" class="wplm-layer-select" data-select="' + i + '" aria-current="' + (i === selected && !adding) + '" title="Drag, or Alt + ↑ / ↓, to change the depth">' + thumb
                + '<span class="wplm-layer-label">' + name + '<small>' + (l.type === 'text' ? 'Text' : 'Image') + (l.hidden ? ' · hidden' : '') + '</small></span></button>'
                + '<span class="wplm-layer-tools">'
                + '<button type="button" class="wplm-icon-button" data-row-action="hide" data-index="' + i + '" aria-pressed="' + l.hidden + '" aria-label="' + (l.hidden ? 'Show ' : 'Hide ') + name + '" title="' + (l.hidden ? 'Show' : 'Hide') + '"><span class="dashicons dashicons-' + (l.hidden ? 'hidden' : 'visibility') + '" aria-hidden="true"></span></button>'
                + '<button type="button" class="wplm-icon-button" data-row-action="duplicate" data-index="' + i + '" aria-label="Duplicate ' + name + '" title="Duplicate"' + (scene.layers.length >= 40 ? ' disabled' : '') + '>' + icons.clone + '</button>'
                + '<button type="button" class="wplm-icon-button wplm-icon-button--danger" data-row-action="delete" data-index="' + i + '" aria-label="Delete ' + name + '" title="Delete"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button>'
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
        auto: 'Fills the free height of the column around the scene (as WP Swiper\'s Auto); where there is none, 500px. In the preview: the screen height.'
    };
    function heightField() {
        const [key, unitKey] = HEIGHT[device()], unit = scene[unitKey], id = 'wplm-f-' + key, off = unit === 'auto';
        const [min, max] = unit === 'px' ? [160, 2400] : unit === 'auto' ? [1, 2400] : [1, 200];
        return '<div class="wplm-field wplm-field--height">' + head(id, 'Height', devices()) + '<div class="wplm-field__row">'
            + '<input id="' + id + '" data-key="' + key + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + escape(scene[key]) + '"' + (off ? ' disabled' : '') + '>'
            + '<select data-key="' + unitKey + '" aria-label="Height unit">' + ['px', 'vh', '%', 'auto'].map(u => '<option value="' + u + '"' + (u === unit ? ' selected' : '') + '>' + (u === 'auto' ? 'Auto' : u) + '</option>').join('') + '</select>'
            + '</div>' + note(UNIT_HELP[unit]) + '</div>';
    }
    // A new unit: a number that makes sense in it (720vh would be seven screens).
    function unitChanged(device) {
        const [key, unitKey, fallback] = HEIGHT[device], unit = scene[unitKey];
        if ((unit === 'vh' || unit === '%') && scene[key] > 200) scene[key] = 100;
        else if (unit === 'px' && scene[key] < 160) scene[key] = fallback;
        settings();
    }
    function settings() {
        let html;
        if (adding) {
            html = '<legend>Add element</legend><div class="wplm-card"><p class="wplm-subheading">Elements</p><div class="wplm-elements" role="group" aria-label="Elements">'
                + Object.entries(ELEMENTS).map(([type, [icon, name, about]]) => '<button type="button" class="wplm-element" data-add="' + type + '" title="' + escape(about) + '"><span class="dashicons dashicons-' + icon + '" aria-hidden="true"></span><span class="wplm-element__name">' + name + '</span></button>').join('')
                + '</div></div><p class="description wplm-after-cards">The new layer goes in front of the others; drag it in the list to change its depth.</p>';
        } else if (selected < 0) {
            html = '<legend>Scene settings</legend>'
                + card('Size', heightField())
                + '<p class="description wplm-after-cards">Layer order defines depth. Use the same image size and position for the background and its transparent foreground cutout.</p>';
        } else {
            const l = scene.layers[selected];
            let first = field('name', 'Layer name');
            if (l.type === 'image') first += picker(l);
            else first += field('text', 'Text') + field('color', 'Text color', 'color') + range({desktop:'font_size', tablet:'tablet_font_size', mobile:'mobile_font_size'}, 'Font size (px)', {min:8, max:device() === 'mobile' ? 250 : 500, to:300});
            const d = device();
            html = '<legend>Layer settings</legend>'
                + (d === 'desktop' ? '' : '<p class="wplm-device-note"><span class="dashicons dashicons-' + DEVICES[d][0] + '" aria-hidden="true"></span><span>' + DEVICES[d][1] + ' values. Settings without a green dot follow ' + DEVICES[UP[d]][1] + '; clear a number to follow it again.</span></p>')
                + card('Layer', first)
                + card('Position and size', (l.type === 'image' ? respSelect('fit', 'Image fit', {cover:'Cover', contain:'Contain'}) : '') + positionField(l) + respRange('width', 'Width (%)', {min:1, max:300, to:200}) + respRange('scale', 'Scale (%)', {min:10, max:300, to:200}) + respRange('opacity', 'Opacity (%)', {min:0, max:100}))
                + card('Motion', respRange('move_x', 'Horizontal travel (px)', {min:-1000, max:1000, from:-400, to:400})
                    + respRange('move_y', 'Vertical travel (px)', {min:-1000, max:1000, from:-400, to:400, note:'Negative values move the layer up.'}));
        }
        $('settings').innerHTML = '<fieldset class="wplm-section">' + html + '</fieldset>';
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
        const key = input.dataset.key || input.dataset.rangeFor;
        if (!key) return;
        const obj = current();
        // Tablet / mobile number emptied: back to the larger screen's value.
        if (input.dataset.inherit && input.type === 'number' && input.value === '') {
            obj[key] = null;
            const value = eff(obj, input.dataset.inherit, device());
            input.placeholder = value;
            const slider = input.closest('.wplm-field__row').querySelector('input[type=range]');
            if (slider) slider.value = value;
            refreshDots(input.closest('.wplm-field'));
            changed(); return;
        }
        if (input.type === 'number' || input.type === 'range') {
            if (!Number.isFinite(input.valueAsNumber)) return;
            const value = Math.min(Number(input.max), Math.max(Number(input.min), input.valueAsNumber));
            obj[key] = value;
            const row = input.closest('.wplm-field__row');
            if (row) row.querySelectorAll('input').forEach(other => { if (other !== input) other.value = value; });
        } else obj[key] = input.value;
        refreshDots(input.closest('.wplm-field'));
        if (key === 'name' || key === 'color') list();
        changed();
    });
    app.addEventListener('change', event => {
        if (!event.target.matches('select[data-key]')) return;
        const key = event.target.dataset.key;
        current()[key] = event.target.value === '' && event.target.dataset.inherit ? null : event.target.value;
        refreshDots(event.target.closest('.wplm-field'));
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
        if (button.id === 'wplm-add-toggle') { adding = true; list(); settings(); $('settings').querySelector('[data-add]').focus(); return; }
        if (button.dataset.add) {
            if (scene.layers.length >= 40) return;
            const layer = Object.assign({}, boot.layer, {type:button.dataset.add, name:(button.dataset.add === 'text' ? 'Title' : 'Image') + ' ' + (scene.layers.length + 1)});
            if (!scene.layers.length) layer.move_y = 0;
            scene.layers.push(layer); selected = scene.layers.length - 1; adding = false;
        } else if (button.dataset.action && selected >= 0) {
            const l = scene.layers[selected];
            switch (button.dataset.action) {
            case 'position': openPosition(l, button); return;
            case 'position-inherit': l[dkey('x', device())] = null; l[dkey('y', device())] = null; break;
            case 'image': {
                const index = selected;
                const media = wp.media({title:'Choose layer image', library:{type:'image'}, multiple:false});
                media.on('select', () => {
                    const image = media.state().get('selection').first().toJSON();
                    l.image = image.id; images[image.id] = (image.sizes && image.sizes.large || image).url;
                    imageInfo[image.id] = {name:image.filename || '', width:image.width || 0, height:image.height || 0, size:image.filesizeHumanReadable || ''};
                    if (scene.layers.includes(l)) { list(); if (selected === index) settings(); changed(); }
                }); media.open(); return;
            }
            case 'clear': l.image = 0; break;
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
        const rows = Array.from(layersBox.querySelectorAll('.wplm-layer-row')).filter(row => row !== dragged);
        if (!rows.length) return null;
        const row = rows.find(r => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
        return row ? {row, before:true} : {row:rows[rows.length - 1], before:false};
    }
    function endSort() {
        if (!sorting) return;
        if (sorting.active) { sorting.row.style.transform = ''; sorting.row.classList.remove('is-dragging'); document.body.classList.remove('wplm-sorting'); clearDrop(); }
        sorting = null;
    }
    layersBox.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.wplm-layer-tools')) return;
        const row = event.target.closest('.wplm-layer-row');
        if (row) sorting = {row, index:Number(row.dataset.index), y:event.clientY, active:false};
    });
    document.addEventListener('pointermove', event => {
        if (!sorting) return;
        const dy = event.clientY - sorting.y;
        if (!sorting.active) {
            if (Math.abs(dy) < 4) return;
            sorting.active = true;
            sorting.row.classList.add('is-dragging');
            document.body.classList.add('wplm-sorting');
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
        form.method='post'; form.action=boot.endpoint; form.target='wplm_preview_frame'; form.hidden=true;
        Object.entries({action:'wplm_preview',nonce:boot.nonce,post_id:boot.postId,scene:JSON.stringify(scene)}).forEach(([name,value]) => {
            const input=document.createElement('input'); input.type='hidden'; input.name=name; input.value=value; form.append(input);
        });
        document.body.append(form); form.submit(); form.remove();
    }
    function frameState() {
        try {
            const win=$('frame').contentWindow;
            win.document.body.classList.toggle('wplm-black',dark);
            win.document.body.style.background=dark?'#121212':'';
            if (win.wplmPreviewProgress) win.wplmPreviewProgress(Number($('progress').value)/100);
        } catch (error) { /* Frame navigation is in progress. */ }
    }
    function resize() {
        const device=$('device').value;
        const rotated=device!=='desktop' && !!turned[device];
        let [w,h]=({desktop:[1280,721],tablet:[820,1101],mobile:[390,844]})[device];
        if (rotated) [w,h]=[h,w];
        const stage=$('preview-stage'), frame=$('frame'), d=drawings[device];
        const unit=({desktop:1280,tablet:820,mobile:390})[device]/d.screen[2];
        const upright=[d.width*unit,d.height*unit];
        const outer=rotated?[upright[1],upright[0]]:upright;
        const offset=rotated?[(d.height-d.screen[1]-d.screen[3])*unit,d.screen[0]*unit]:[d.screen[0]*unit,d.screen[1]*unit];
        const scale=Math.min(1,stage.clientWidth/outer[0],Math.max(300,innerHeight-180)/outer[1]);
        const left=Math.max(0,(stage.clientWidth-outer[0]*scale)/2);
        Object.assign(frame.style,{width:w+'px',height:h+'px',left:(left+offset[0]*scale)+'px',top:(offset[1]*scale)+'px',transform:'scale('+scale+')',borderRadius:(d.radius*unit)+'px'});
        stage.querySelectorAll('.wplm-device-drawing').forEach(image=>{
            image.hidden=image.dataset.device!==device;
            if(!image.hidden)Object.assign(image.style,{left:(left+(rotated?outer[0]*scale:0))+'px',width:upright[0]*scale+'px',height:upright[1]*scale+'px',transform:rotated?'rotate(90deg)':''});
        });
        stage.style.height=Math.ceil(outer[1]*scale)+'px';
        $('rotate').disabled=device==='desktop';
        $('rotate').setAttribute('aria-pressed',String(rotated));
        document.querySelectorAll('[data-preview-device]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewDevice===device)));

        requestAnimationFrame(frameState);
    }
    Object.entries(drawings).forEach(([device,d])=>{
        const image=document.createElement('img');image.src=boot.assetBase+'assets/images/preview/'+d.file;
        image.alt='';image.className='wplm-device-drawing';image.dataset.device=device;image.hidden=true;$('device-shell').append(image);
    });
    let turnAnimation = null;
    $('rotate').onclick=()=>{
        const device=$('device').value;
        if(device==='desktop')return;
        const stage=$('preview-stage');
        const drawing=stage.querySelector('.wplm-device-drawing:not([hidden])');
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
    $('dark').onclick=()=>{dark=!dark;$('dark').setAttribute('aria-pressed',String(dark));$('frame').style.background=dark?'#121212':'';frameState();};
    // Scroll simulation played once after Update (0 → 100 → 0), and again with Play.
    const PLAY_TIME=2400;
    let playing=0, playAfterLoad=false;
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
    $('refresh').onclick=()=>{playAfterLoad=true;preview();};
    $('progress').oninput=()=>{stopPlay();frameState();};
    $('frame').onload=()=>{resize();frameState();if(playAfterLoad){playAfterLoad=false;play();}else $('frame').dataset.state='done';};
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
    function sceneHeight(d) { const [key, unitKey] = HEIGHT[d], v = scene[key], u = scene[unitKey]; return u === 'px' ? v : u === 'auto' ? SCREEN[d] : SCREEN[d] * v / 100; }
    const positionModal=document.createElement('div');
    positionModal.className='wplm-modal wplm-modal--position';positionModal.hidden=true;
    positionModal.setAttribute('role','dialog');positionModal.setAttribute('aria-modal','true');positionModal.setAttribute('aria-labelledby','wplm-position-title');
    positionModal.innerHTML='<div class="wplm-modal__backdrop"></div><div class="wplm-modal__box"><div class="wplm-modal__head"><h2 class="wplm-modal__title" id="wplm-position-title"><span class="wplm-modal__what">Position</span> <span class="wplm-modal__layer"></span></h2><button type="button" class="wplm-modal__close" aria-label="Close"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button></div>'
        +'<div class="wplm-modal__body"><p class="description wplm-position-help"></p>'
        +'<div class="wplm-focus"><div class="wplm-focus__main"><div class="wplm-focus__stage" tabindex="0" role="slider" aria-label="Layer position" aria-valuemin="0" aria-valuemax="100"><img class="wplm-focus__image" alt="" draggable="false"><div class="wplm-position-canvas"></div><span class="wplm-focus__point" aria-hidden="true"></span></div></div>'
        +'<div class="wplm-focus__frames" aria-hidden="true">'+Object.entries(DEVICES).map(([d,[icon,name]])=>'<figure class="wplm-focus__device" data-device="'+d+'"><span class="wplm-focus__frame"><span class="wplm-position-canvas"></span></span><figcaption><span class="dashicons dashicons-'+icon+'"></span>'+name+'</figcaption></figure>').join('')+'</div></div>'
        +'<p class="wplm-focus__value"></p><p class="wplm-position-warning" role="status" hidden><span class="dashicons dashicons-warning" aria-hidden="true"></span><span class="wplm-position-warning__text"></span></p></div>'
        +'<div class="wplm-modal__foot"><button type="button" class="button-link wplm-focus__reset">Reset to centre</button><button type="button" class="button wplm-modal__cancel">Cancel</button><button type="button" class="button button-primary wplm-modal__apply">Apply</button></div></div>';
    document.body.append(positionModal);
    const focusStage=positionModal.querySelector('.wplm-focus__stage');
    const focusPoint=positionModal.querySelector('.wplm-focus__point');
    let positionLayer=null, positionDraft=null, positionReturn=null, dragging=null;
    const canvasDevice=canvas=>canvas.parentElement===focusStage ? $('device').value : canvas.closest('.wplm-focus__device').dataset.device;
    const focusImage=positionModal.querySelector('.wplm-focus__image');
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
        canvas.querySelectorAll('.wplm-position-gap').forEach(gap=>gap.remove());
        if(positionLayer.type!=='image')return;
        const b=layerBox(withDraft(),canvasDevice(canvas),0);
        const pct=(v,of)=>Math.max(0,Math.min(100,v/of*100));
        const top=pct(b.top,b.h), bottom=pct(b.bottom,b.h), left=pct(b.left,b.w), right=pct(b.right,b.w);
        [[0,0,100,top],[0,bottom,100,100-bottom],[0,top,left,bottom-top],[right,top,100-right,bottom-top]].forEach(([x,y,width,height])=>{
            if(width<=0.05 || height<=0.05)return;
            const gap=document.createElement('span');gap.className='wplm-position-gap';
            Object.assign(gap.style,{left:x+'%',top:y+'%',width:width+'%',height:height+'%'});canvas.append(gap);
        });
    }
    function warn() {
        const box=positionModal.querySelector('.wplm-position-warning'), layer=withDraft();
        const found=positionLayer.type!=='image' ? [] : Object.keys(SIZES).map(d=>{
            const start=uncovered(layerBox(layer,d,0)), end=uncovered(layerBox(layer,d,1));
            return start ? DEVICES[d][1] : end ? DEVICES[d][1]+' (while scrolling)' : '';
        }).filter(Boolean);
        box.hidden=!found.length;
        box.querySelector('.wplm-position-warning__text').textContent=found.length ? 'This layer does not cover the whole scene on '+found.join(', ')+'. Hatched: not covered now; scrolling moves the layer by its travel. Raise the Scale or lower the travel to hide the edges.' : '';
    }
    function showPosition() {
        const [x,y]=positionDraft, layer=withDraft();
        focusPoint.style.left=x+'%';focusPoint.style.top=y+'%';
        positionModal.querySelector('.wplm-focus__value').textContent=x+'% '+y+'%';
        focusStage.setAttribute('aria-valuenow',x);focusStage.setAttribute('aria-valuetext','Horizontal '+x+'%, vertical '+y+'%');
        positionModal.querySelectorAll('.wplm-position-canvas').forEach(canvas=>{
            const target=canvas.querySelector('.wplm-position-target'), d=canvasDevice(canvas);
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
        positionModal.querySelectorAll('.wplm-focus__frame').forEach(frame=>{
            const d=frame.parentElement.dataset.device, w=SIZES[d][0], h=sceneHeight(d), r=w/h;
            Object.assign(frame.style,{aspectRatio:w+'/'+h,width:Math.min(150,84*r)+'px'});
        });
        positionModal.querySelectorAll('.wplm-position-canvas').forEach(canvas=>{
            canvas.replaceChildren();
            const device=canvasDevice(canvas), baseWidth=SIZES[device][0];
            const width=canvas.getBoundingClientRect().width;
            scene.layers.forEach(layer=>{
                if(layer.hidden && layer!==positionLayer)return;
                const v=key=>eff(layer,key,device);
                const item=document.createElement('span');item.className='wplm-position-item'+(layer===positionLayer?' wplm-position-target':' is-other');
                Object.assign(item.style,{left:v('x')+'%',top:v('y')+'%',width:v('width')+'%',opacity:v('opacity')/100,transform:'translate(-50%,-50%) scale('+v('scale')/100+')'});
                if(layer.type==='image') {
                    item.style.height='100%';
                    if(images[layer.image]){const image=document.createElement('img');image.src=images[layer.image];image.alt='';image.style.objectFit=v('fit');image.style.objectPosition=layer.focus_x+'% '+layer.focus_y+'%';item.append(image);}
                }else{item.textContent=layer.text;item.style.color=layer.color;item.style.fontSize=(device==='mobile'?layer.mobile_font_size:device==='tablet'?layer.tablet_font_size:layer.font_size)*width/baseWidth+'px';}
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
        positionModal.querySelector('.wplm-modal__what').textContent=image ? 'Image position' : 'Position';
        positionModal.querySelector('.wplm-modal__layer').textContent=image ? layer.name : layer.name+' · '+DEVICES[positionDevice][1];
        positionModal.querySelector('.wplm-position-help').textContent=image
            ? 'Click the part of the image to keep in view when its layer crops it. It applies on every device; the frames show each one. Arrow keys move the point by 1%; with Shift, by 10%.'
            : 'Drag the text to move it, or click to put its centre there. Arrow keys move it by 1%; with Shift, by 10%.';
        positionModal.hidden=false;document.body.classList.add('wplm-modal-open');
        drawPositionScenes();focusStage.focus();
    }
    function closePosition(apply) {
        if(!positionLayer)return;
        if(apply && focusMode()){positionLayer.focus_x=positionDraft[0];positionLayer.focus_y=positionDraft[1];settings();changed();}
        else if(apply){positionLayer[dkey('x',positionDevice)]=positionDraft[0];positionLayer[dkey('y',positionDevice)]=positionDraft[1];settings();changed();}
        positionModal.hidden=true;document.body.classList.remove('wplm-modal-open');dragging=null;positionLayer=null;
        const button=positionReturn && positionReturn.isConnected?positionReturn:$('settings').querySelector('[data-action="position"]');
        if(button)button.focus();
    }
    const percent=value=>Math.round(Math.max(0,Math.min(100,value))*10)/10;
    function onLayer(event) {
        const target=focusStage.querySelector('.wplm-position-target');
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
    positionModal.querySelector('.wplm-modal__apply').onclick=()=>closePosition(true);
    positionModal.querySelector('.wplm-modal__cancel').onclick=()=>closePosition(false);
    positionModal.querySelector('.wplm-modal__close').onclick=()=>closePosition(false);
    positionModal.querySelector('.wplm-modal__backdrop').onclick=()=>closePosition(false);
    positionModal.querySelector('.wplm-focus__reset').onclick=()=>{positionDraft=[50,50];showPosition();};
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
