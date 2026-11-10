/*
 * Developer mode of the editor's preview (WPBN_Admin::preview(), its frame only; user's request, 2026-11-09, as WP Swiper's
 * preview-dev.js): over each scene, its box with its size at its top; each layer's box as it is at that moment (moved by the
 * scroll, the mouse, an animation), in its kind's colour, with its tile's number, its name and its size; for a title, a text,
 * a button, a shortcode or an image object, its distances to the scene's edges. Checked every frame while it is on, redrawn
 * when something moved. Never on the site: admin.js turns it on and off with wpbnDev(true | false, info).
 *
 * Made easier to read (user's request, 2026-11-10): the editor shows the frame scaled down to fit (a 1440px desktop at 0.4…), so
 * the labels and lines are drawn larger by as much (--k) and read at about 12px whatever the scale. The layer chosen in the
 * editor (info.selected) stands out, the others dimmed; only its distances are drawn, with its Position, and its container's
 * edges (Theme / Custom: what its X and Width are shares of). Nothing chosen: every placed layer's distances, as before.
 */
(function () {
    'use strict';
    let on = false, info = {selected:-1, layers:{}};
    // The kinds as the editor names them (admin.js TYPE_NAMES); an image object is an image of its own size.
    const KINDS = {image:'Image', text:'Title', richtext:'Text', button:'Button', shortcode:'Shortcode', overlay:'Overlay', shape:'Shape'};
    // Placed in the scene by their Position: their distances to its edges are shown.
    const PLACED = ['text', 'richtext', 'button', 'shortcode'];
    const round = v => Math.round(v * 10) / 10;

    function kindOf(layer) {
        for (const name of layer.classList) {
            const m = /^wpbn-layer--(\w+)$/.exec(name);
            if (m && KINDS[m[1]]) return m[1];
        }
        return 'image';
    }
    // How much the editor shrinks the frame: its width on the editor's screen against the page's own.
    function shrink() {
        try {
            const el = window.frameElement, w = el && el.getBoundingClientRect().width;
            return w && innerWidth ? Math.max(1, Math.min(4, innerWidth / w)) : 1;
        } catch (error) { return 1; }
    }
    // The layer's index in the editor (its tile's number less one): its z-index less one (WPBN_Render: hidden layers skipped, not renumbered).
    const indexOf = el => (parseInt(el.style.zIndex, 10) || 0) - 1;
    // What shows of a layer: its Loop / Entrance animation's wrapper where it has one (they move inside it), else itself.
    const shown = layer => layer.querySelector(':scope > .wpbn-enter > .wpbn-anim, :scope > .wpbn-anim, :scope > .wpbn-enter') || layer;
    // Its container's width on this screen (frontend.css: --wpbn-cw and the tablet / mobile ones); '' none (the whole scene).
    function containerOf(el) {
        const css = getComputedStyle(el), get = name => css.getPropertyValue(name).trim();
        const base = get('--wpbn-cw');
        if (!base) return '';
        const t = get('--wpbn-cw-t') || base, m = get('--wpbn-cw-m') || t;
        return innerWidth <= 767 ? m : innerWidth <= 1024 ? t : base;
    }
    function within(rect, origin) {
        return {left:rect.left - origin.left, top:rect.top - origin.top, width:rect.width, height:rect.height, right:rect.right - origin.left, bottom:rect.bottom - origin.top};
    }
    // className: its parts without the prefix ('box box--image' is wpbn-dev__box wpbn-dev__box--image).
    function node(layer, className, rect, text) {
        const el = document.createElement(text === undefined ? 'div' : 'span');
        el.className = 'wpbn-dev__' + className.split(' ').join(' wpbn-dev__');
        if (rect) Object.assign(el.style, {left:rect.left + 'px', top:rect.top + 'px', width:rect.width + 'px', height:rect.height + 'px'});
        if (text !== undefined) el.textContent = text;
        layer.appendChild(el);
        return el;
    }
    function label(layer, x, y, text, className) {
        const el = node(layer, 'label' + (className ? ' ' + className : ''), null, text);
        el.style.left = x + 'px'; el.style.top = y + 'px';
        return el;
    }

    function draw(scene) {
        let layer = scene.querySelector(':scope > .wpbn-dev');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'wpbn-dev';
            layer.setAttribute('aria-hidden', 'true');
            scene.appendChild(layer);
        }
        const origin = scene.getBoundingClientRect(), W = origin.width, H = origin.height, k = shrink();
        // Front first, as the editor's tiles (the markup has the back one first).
        const items = [...scene.querySelectorAll(':scope > .wpbn-layer')].reverse()
            .filter(el => el.getClientRects().length)
            .map(el => ({el, index:indexOf(el), kind:kindOf(el), object:el.classList.contains('wpbn-layer--object'), box:within(shown(el).getBoundingClientRect(), origin)}));
        const chosen = items.find(i => i.index === info.selected) || null;
        // Nothing moved since the last frame (nor the scale, the layer chosen, the names): the boxes drawn stand.
        const key = [W, H, round(k), JSON.stringify(info)].concat(items.map(i => [i.box.left, i.box.top, i.box.width, i.box.height].map(round).join(','))).join(';');
        if (layer.getAttribute('data-key') === key) return;
        layer.setAttribute('data-key', key);
        layer.textContent = '';
        layer.style.setProperty('--k', k);
        layer.classList.toggle('wpbn-dev--chosen', !!chosen);

        node(layer, 'scene', {left:0, top:0, width:W, height:H});
        // The chosen layer's container: its edges dashed, its width at its foot (a probe as wide, in the scene, measures it).
        const cw = chosen ? containerOf(chosen.el) : '';
        if (cw) {
            const probe = node(layer, 'probe', null);
            probe.style.width = cw;
            const width = probe.getBoundingClientRect().width;
            probe.remove();
            if (width > 0 && width < W - 0.5) {
                const left = (W - width) / 2;
                node(layer, 'container', {left:left, top:0, width:width, height:H});
                label(layer, W / 2, H - 6, 'Container · ' + round(width), 'container-size');
            }
        }
        const used = [], step = 20 * k;
        items.forEach(function (item) {
            const b = item.box, mine = chosen === item, about = info.layers[item.index] || {};
            node(layer, 'box box--' + item.kind + (mine ? ' box--chosen' : ''), b);
            // Its label where it shows (a box larger than the scene is cut by it), moved down past another one there; over a low
            // box (a button) above it, so its content shows.
            let x = Math.max(0, b.left) + 4 * k, y = b.height < 3 * step && b.top >= step ? b.top - step : Math.max(0, b.top) + 4 * k;
            while (used.some(([ux, uy]) => Math.abs(ux - x) < 90 * k && Math.abs(uy - y) < step - 1)) y += step;
            used.push([x, y]);
            const name = about.name || KINDS[item.kind];
            label(layer, x, y, (item.index + 1) + ' · ' + name + ' · ' + round(b.width) + ' × ' + round(b.height) + (mine && about.position ? ' · ' + about.position : ''),
                'name name--' + item.kind + (mine ? ' name--chosen' : ''));
            // Its distances to the scene's edges (the chosen layer's only, when one is): a line to each edge from its middle, the distance on it.
            if (!(PLACED.includes(item.kind) || item.object) || (chosen && !mine)) return;
            const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
            [['left', b.left, {left:0, top:cy, width:b.left, height:0}, [b.left / 2, cy]],
                ['right', W - b.right, {left:b.right, top:cy, width:W - b.right, height:0}, [b.right + (W - b.right) / 2, cy]],
                ['top', b.top, {left:cx, top:0, width:0, height:b.top}, [cx, b.top / 2]],
                ['bottom', H - b.bottom, {left:cx, top:b.bottom, width:0, height:H - b.bottom}, [cx, b.bottom + (H - b.bottom) / 2]]]
                .forEach(function ([side, space, line, at]) {
                    if (space < 0.5) return;
                    node(layer, 'line line--' + (side === 'left' || side === 'right' ? 'across' : 'down'), line);
                    label(layer, at[0], at[1], String(round(space)), 'dimension');
                });
        });
        // The scene's size, at its top in the middle.
        label(layer, W / 2, 6 * k, 'Scene · ' + round(W) + ' × ' + round(H), 'size');
    }

    function frame() {
        if (!on) return;
        document.querySelectorAll('.wpbn-scene').forEach(draw);
        requestAnimationFrame(frame);
    }
    // state: on or off; about: {selected: the editor's chosen layer (-1 none), layers: {index: {name, position}}}.
    window.wpbnDev = function (state, about) {
        const was = on;
        on = !!state;
        if (about) info = {selected:Number(about.selected), layers:about.layers || {}};
        document.documentElement.classList.toggle('wpbn-dev-on', on);
        if (on && !was) requestAnimationFrame(frame);
        if (!on) document.querySelectorAll('.wpbn-scene > .wpbn-dev').forEach(layer => layer.remove());
    };
}());
