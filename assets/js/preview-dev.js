/*
 * Developer mode of the editor's preview (WPBN_Admin::preview(), its frame only; user's request, 2026-11-09, as WP Swiper's
 * preview-dev.js): over each scene, its box with its size at its top; each layer's box as it is at that moment (moved by the
 * scroll, the mouse, an animation), in its kind's colour, with its kind and size; for a title, a text, a button, a shortcode
 * or an image object, its distances to the scene's edges. Checked every frame while it is on, redrawn when something moved.
 * Never on the site: admin.js turns it on and off with wpbnDev(true | false).
 */
(function () {
    'use strict';
    let on = false;
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
    // What shows of a layer: its Loop / Entrance animation's wrapper where it has one (they move inside it), else itself.
    const shown = layer => layer.querySelector(':scope > .wpbn-enter > .wpbn-anim, :scope > .wpbn-anim, :scope > .wpbn-enter') || layer;
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
        const origin = scene.getBoundingClientRect(), W = origin.width, H = origin.height;
        // Front first, as the editor's tiles (the markup has the back one first).
        const items = [...scene.querySelectorAll(':scope > .wpbn-layer')].reverse()
            .filter(el => el.getClientRects().length)
            .map(el => ({kind:kindOf(el), object:el.classList.contains('wpbn-layer--object'), box:within(shown(el).getBoundingClientRect(), origin)}));
        // Nothing moved since the last frame: the boxes drawn stand.
        const key = [W, H].concat(items.map(i => [i.box.left, i.box.top, i.box.width, i.box.height].map(round).join(','))).join(';');
        if (layer.getAttribute('data-key') === key) return;
        layer.setAttribute('data-key', key);
        layer.textContent = '';

        node(layer, 'scene', {left:0, top:0, width:W, height:H});
        const used = [];
        items.forEach(function (item) {
            const b = item.box;
            node(layer, 'box box--' + item.kind, b);
            // Its label where it shows (a box larger than the scene is cut by it), moved down past another one there; over a low
            // box (a button) above it, so its content shows.
            let x = Math.max(0, b.left) + 4, y = b.height < 60 && b.top >= 20 ? b.top - 19 : Math.max(0, b.top) + 4;
            while (used.some(([ux, uy]) => Math.abs(ux - x) < 60 && Math.abs(uy - y) < 18)) y += 20;
            used.push([x, y]);
            label(layer, x, y, KINDS[item.kind] + ' · ' + round(b.width) + ' × ' + round(b.height), 'name name--' + item.kind);
            if (!(PLACED.includes(item.kind) || item.object)) return;
            // Its distances to the scene's edges: a line to each edge from its middle, the distance on it.
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
        label(layer, W / 2, 6, round(W) + ' × ' + round(H), 'size');
    }

    function frame() {
        if (!on) return;
        document.querySelectorAll('.wpbn-scene').forEach(draw);
        requestAnimationFrame(frame);
    }
    window.wpbnDev = function (state) {
        const was = on;
        on = !!state;
        document.documentElement.classList.toggle('wpbn-dev-on', on);
        if (on && !was) requestAnimationFrame(frame);
        if (!on) document.querySelectorAll('.wpbn-scene > .wpbn-dev').forEach(layer => layer.remove());
    };
}());
