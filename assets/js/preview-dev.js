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
 *
 * A Shape layer (user's request, 2026-11-10): the layer covers the scene, so its drawing's box is drawn instead (its area as
 * fitted on this device: WPBN_Shape::fit_data() and area() in its data-motion, as frontend.js boxes()), with its size; with a
 * Custom size it is placed, so its distances and Position too.
 *
 * Only the chosen one's data (user's request, 2026-11-23): Scene settings open (no layer chosen): the scene's size, Margin and safe
 * area, the layers as boxes with their names only; a layer chosen: its box, Padding, Margin, distances and container, the others
 * faded boxes, the scene its size only.
 *
 * Padding and Margin (user's request, 2026-11-23, as Signatur's Developer mode): each layer's Padding shaded in the widget's green inside its
 * box, its Margin in its orange outside it, their px on them (the chosen layer's, or every layer's when none is); the scene's Padding
 * (the safe area the placed layers keep from its edges) shaded between it and the scene's edges, its Margin shaded around the
 * scene on the page, as a browser's inspector draws them (the user's drawing: Margin #F9CEA2, Padding #A9CE99), and in its label. An overlay's distances too.
 */
(function () {
    'use strict';
    let on = false, info = {selected:-1, layers:{}};
    // The kinds as the editor names them (admin.js TYPE_NAMES); an image object is an image of its own size.
    const KINDS = {image:'Image', text:'Title', richtext:'Text', button:'Button', shortcode:'Shortcode', overlay:'Overlay', shape:'Shape'};
    // Placed in the scene by their Position: their distances to its edges are shown.
    const PLACED = ['text', 'richtext', 'button', 'shortcode', 'overlay'];
    const SFX = ['', '-t', '-m'];
    const round = v => Math.round(v * 10) / 10;
    const device = () => innerWidth <= 767 ? 2 : innerWidth <= 1024 ? 1 : 0;
    function motionOf(el) { try { return JSON.parse(el.dataset.motion || '{}'); } catch (error) { return {}; } }
    // A Shape layer's drawing on the screen (as frontend.js boxes()): {rect, custom}; null without its area.
    function drawing(el) {
        const m = motionOf(el), vb = (m.area || []).map(Number), fit = (m.fit || [])[device()] || ['cover'], r = el.getBoundingClientRect(), W = r.width, H = r.height;
        if (vb.length !== 4 || !vb[2] || !vb[3] || !W || !H) return null;
        let w, h, x, y;
        if (fit[0] === 'custom') {
            const ratio = vb[2] / vb[3], by = fit[5] === 'width', size = fit[4] === '%' ? fit[3] / 100 * (by ? W : H) : fit[3];
            w = by ? size : size * ratio; h = by ? size / ratio : size; x = fit[1] / 100 * W - w / 2; y = fit[2] / 100 * H - h / 2;
        } else {
            let sx = W / vb[2], sy = H / vb[3];
            if (fit[0] === 'cover') sx = sy = Math.max(sx, sy);
            else if (fit[0] === 'contain') sx = sy = Math.min(sx, sy);
            const px = Number.isFinite(Number(fit[1])) ? Number(fit[1]) / 100 : .5, py = Number.isFinite(Number(fit[2])) ? Number(fit[2]) / 100 : .5;
            w = vb[2] * sx; h = vb[3] * sy; x = (W - w) * px; y = (H - h) * py;
        }
        return {rect:{left:r.left + x, top:r.top + y, width:w, height:h, right:r.left + x + w, bottom:r.top + y + h}, custom:fit[0] === 'custom'};
    }

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

    // A length in px on this screen (% of the scene's width, var(--wpbn-cw) as the layer has it), measured by a probe in the scene.
    function lengths(layer, from, exprs) {
        const probe = node(layer, 'probe', null), css = from && getComputedStyle(from);
        if (css) ['--wpbn-cw', '--wpbn-cw-t', '--wpbn-cw-m'].forEach(v => { const x = css.getPropertyValue(v).trim(); if (x) probe.style.setProperty(v, x); });
        const out = exprs.map(e => { if (!e) return 0; probe.style.width = 'calc(' + e + ')'; return Math.max(0, probe.getBoundingClientRect().width); });
        probe.remove();
        return out;
    }
    // A per-device value of an element's variable on this screen (its -t / -m, else the larger screen's).
    function onDevice(css, name) {
        for (let d = device(); d >= 0; d--) { const v = css.getPropertyValue(name + SFX[d]).trim(); if (v) return v; }
        return '';
    }
    // A layer's Margin [top, right, bottom, left] in px (WPBN_Render: its own, or the scene's safe area when larger); none attached
    // (frontend.js attach() sets its margin 0) or without one.
    function marginsOf(layer, el) {
        if (!el.classList.contains('wpbn-layer--margin') || el.style.margin === '0px' || el.style.marginLeft === '0px') return null;
        const css = getComputedStyle(el), m = lengths(layer, el, ['t', 'r', 'b', 'l'].map(s => onDevice(css, '--wpbn-mg' + s)));
        return m.some(v => v >= 0.5) ? m : null;
    }
    // Its Padding: on the layer or its innermost animation wrapper (WPBN_Render $box), in px as drawn (its scale counted).
    function paddingOf(el) {
        const p = el.classList.contains('wpbn-layer--padding') ? el : el.querySelector('.wpbn-layer--padding');
        if (!p) return null;
        const c = getComputedStyle(p), r = p.getBoundingClientRect(), f = p.offsetWidth ? r.width / p.offsetWidth : 1;
        const sides = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(v => (parseFloat(v) || 0) * f);
        return sides.some(v => v >= 0.5) ? {rect:r, sides} : null;
    }
    // Bands along a box's sides, inside it (Padding) or outside it (Margin), their px on them when asked.
    function bands(layer, b, sides, kind, numbers) {
        const [t, r, bt, l] = sides, out = kind === 'margin';
        [[t, out ? {left:b.left, top:b.top - t, width:b.width, height:t} : {left:b.left, top:b.top, width:b.width, height:t}],
            [r, out ? {left:b.right, top:b.top, width:r, height:b.height} : {left:b.right - r, top:b.top, width:r, height:b.height}],
            [bt, out ? {left:b.left, top:b.bottom, width:b.width, height:bt} : {left:b.left, top:b.bottom - bt, width:b.width, height:bt}],
            [l, out ? {left:b.left - l, top:b.top, width:l, height:b.height} : {left:b.left, top:b.top, width:l, height:b.height}]]
            .forEach(function ([v, rect]) {
                if (v < 0.5) return;
                node(layer, 'band band--' + kind, rect);
                if (numbers) label(layer, rect.left + rect.width / 2, rect.top + rect.height / 2, String(round(v)), 'space space--' + kind);
            });
    }

    // The scene's Margin, as a browser's inspector draws margin: bands around its block on the page, its px on them. Kept in
    // a box of its own in the page (scene.wpbnDevOuter), placed over the scene's margin box.
    function outside(scene, r, m, k) {
        let box = scene.wpbnDevOuter;
        if (!m.some(v => v >= 0.5)) { if (box) box.remove(); scene.wpbnDevOuter = null; return; }
        if (!box || !box.isConnected) {
            box = scene.wpbnDevOuter = document.createElement('div');
            box.className = 'wpbn-dev wpbn-dev--outer';
            box.setAttribute('aria-hidden', 'true');
            document.body.appendChild(box);
        }
        const [t, rt, b, l] = m;
        box.textContent = '';
        box.style.setProperty('--k', k);
        Object.assign(box.style, {left:(r.left + scrollX - l) + 'px', top:(r.top + scrollY - t) + 'px', width:(r.width + l + rt) + 'px', height:(r.height + t + b) + 'px'});
        bands(box, {left:l, top:t, width:r.width, height:r.height, right:l + r.width, bottom:t + r.height}, m, 'margin', true);
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
            .map(function (el) {
                const kind = kindOf(el), shape = kind === 'shape' ? drawing(el) : null;
                // An image an object on some devices only (Fill the scene per device): on this one?
                const own = motionOf(el).object, object = Array.isArray(own) ? !!own[device()] : el.classList.contains('wpbn-layer--object');
                return {el, index:indexOf(el), kind, object:object || !!(shape && shape.custom), box:within(shape ? shape.rect : shown(el).getBoundingClientRect(), origin)};
            });
        const chosen = items.find(i => i.index === info.selected) || null;
        // Nothing moved since the last frame (nor the scale, the layer chosen, the names): the boxes drawn stand.
        const sceneCss = getComputedStyle(scene), safeVar = onDevice(sceneCss, '--wpbn-spd'), sceneMargin = [sceneCss.marginTop, sceneCss.marginRight, sceneCss.marginBottom, sceneCss.marginLeft].map(v => round(parseFloat(v) || 0));
        const key = [W, H, round(origin.left + scrollX), round(origin.top + scrollY), round(k), JSON.stringify(info), safeVar, sceneMargin.join(' ')].concat(items.map(i => [i.box.left, i.box.top, i.box.width, i.box.height].map(round).join(','))).join(';');
        if (layer.getAttribute('data-key') === key) return;
        layer.setAttribute('data-key', key);
        layer.textContent = '';
        layer.style.setProperty('--k', k);
        layer.classList.toggle('wpbn-dev--chosen', !!chosen);

        node(layer, 'scene', {left:0, top:0, width:W, height:H});
        // The scene's Padding: the safe area the placed layers keep from its edges: the bands between them and the scene's edges
        // shaded as a browser's inspector draws padding (the user's drawing, 2026-11-23: #A9CE99), its px on them, its edge dashed.
        if (safeVar && !chosen) {
            const [st, sr, sb, sl] = lengths(layer, null, safeVar.split(/\s+/));
            if (st + sr + sb + sl >= 0.5) {
                bands(layer, {left:0, top:0, width:W, height:H, right:W, bottom:H}, [st, sr, sb, sl], 'padding', true);
                node(layer, 'safe', {left:sl, top:st, width:Math.max(0, W - sl - sr), height:Math.max(0, H - st - sb)});
                label(layer, sl + 4 * k, st + 4 * k, 'Safe area · ' + [st, sr, sb, sl].map(round).join(' '), 'safe-size');
            }
        }
        // Its Margin: around it on the page (#F9CEA2), drawn outside the scene (which cuts what is past its edges).
        outside(scene, origin, chosen ? [0, 0, 0, 0] : sceneMargin, k);
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
            // Its Padding (green, inside) and Margin (orange, outside); their px on the chosen layer's, or on all when none is chosen.
            if (mine) {
                const pad = paddingOf(item.el), mar = marginsOf(layer, item.el);
                if (pad) bands(layer, within(pad.rect, origin), pad.sides, 'padding', true);
                if (mar) bands(layer, b, mar, 'margin', true);
            }
            // Its label where it shows (a box larger than the scene is cut by it), moved down past another one there; over a low
            // box (a button) above it, so its content shows.
            let x = Math.max(0, b.left) + 4 * k, y = b.height < 3 * step && b.top >= step ? b.top - step : Math.max(0, b.top) + 4 * k;
            while (used.some(([ux, uy]) => Math.abs(ux - x) < 90 * k && Math.abs(uy - y) < step - 1)) y += step;
            used.push([x, y]);
            const name = about.name || KINDS[item.kind];
            label(layer, x, y, (item.index + 1) + ' · ' + name + ' · ' + round(b.width) + ' × ' + round(b.height) + (mine && about.position ? ' · ' + about.position : ''),
                'name name--' + item.kind + (mine ? ' name--chosen' : ''));
            // Its distances to the scene's edges (the chosen layer's only, when one is): a line to each edge from its middle, the distance on it.
            if (!mine || !(PLACED.includes(item.kind) || item.object)) return;
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
        label(layer, W / 2, 6 * k, 'Scene · ' + round(W) + ' × ' + round(H) + (!chosen && sceneMargin.some(v => v) ? ' · Margin ' + sceneMargin.join(' ') : ''), 'size');
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
        if (!on) document.querySelectorAll('.wpbn-scene > .wpbn-dev, .wpbn-dev--outer').forEach(layer => layer.remove());
    };
}());
