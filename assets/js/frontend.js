(function () {
    'use strict';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const FILL_MIN = 120, FALLBACK = 500, MAX_BLEED = 3;
    const DEVICES = ['desktop', 'tablet', 'mobile'];
    // 0 desktop, 1 tablet, 2 mobile: the index into each [desktop, tablet, mobile] value.
    const device = () => innerWidth <= 767 ? 2 : innerWidth <= 1024 ? 1 : 0;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const parse = json => { try { return JSON.parse(json || '{}') || {}; } catch (e) { return {}; } };
    const scenes = [];
    let frame = 0, previewProgress = null;

    // Placed by class: a scene standing inside a block with its class (data-host) becomes that block's
    // background, as the short script after it already does while the page loads (WPBN_Render::HOST_SCRIPT);
    // here for scenes it did not move (added to the page later). No such block: it stays where it is.
    function place() {
        document.querySelectorAll('.wpbn-scene[data-host]:not(.wpbn-scene--fill)').forEach(function (scene) {
            const name = scene.dataset.host, parent = scene.parentElement;
            let host = null;
            try { host = parent && parent.closest('.' + (window.CSS && CSS.escape ? CSS.escape(name) : name)); } catch (e) { return; }
            if (!host) return;
            scene.classList.add('wpbn-scene--fill');
            host.classList.add('wpbn-host');
            if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
            host.insertBefore(scene, host.firstChild);
        });
    }

    // Each scene once: its layers and their motion, read from the markup.
    function bind() {
        document.querySelectorAll('.wpbn-scene:not([data-wpbn-ready])').forEach(function (el) {
            el.setAttribute('data-wpbn-ready', '');
            const s = {el, fill: el.classList.contains('wpbn-scene--fill'), layers: [], visible: true};
            el.querySelectorAll('.wpbn-layer').forEach(layer => s.layers.push({el: layer, m: parse(layer.dataset.motion)}));
            scenes.push(s);
            size(s);
            watch(s);
        });
    }

    // 0 → 1 from the moment the scene reaches the top of the screen until it has scrolled out of view.
    function progress(s) {
        const r = s.el.getBoundingClientRect();
        return clamp(-r.top / Math.max(1, r.height), 0, 1);
    }

    // Travel (dx, dy), zoom (z) and fade (f) at a progress.
    function draw(s, p) {
        const d = device(), t = reduced.matches ? 0 : p;
        s.layers.forEach(function (layer) {
            const m = layer.m, st = layer.el.style, at = key => Number((m[key] || [])[d]) || 0;
            st.setProperty('--wpbn-dx', (at('move_x') * t).toFixed(2) + 'px');
            st.setProperty('--wpbn-dy', (at('move_y') * t).toFixed(2) + 'px');
            st.setProperty('--wpbn-z', (1 + at('zoom') / 100 * t).toFixed(4));
            st.setProperty('--wpbn-f', (at('fade') / 100 * t).toFixed(4));
        });
    }

    // Edges kept out of view: the image layers that fill the scene at rest grow,
    // all by the same factor and around the scene's middle (so a photo and its
    // cutout stay aligned), just enough that their edges never show while they move.
    function bleed(s) {
        const W = s.el.clientWidth, H = s.el.clientHeight, d = device();
        const fills = [];
        let k = 1;
        s.layers.forEach(function (layer) {
            const m = layer.m, st = layer.el.style;
            ['--wpbn-k', '--wpbn-kx', '--wpbn-ky'].forEach(name => st.removeProperty(name));
            // m.fill: per device [desktop, tablet, mobile] (a single value in markup from before).
            if (!(Array.isArray(m.fill) ? m.fill[d] : m.fill) || reduced.matches || !W || !H || !layer.el.getClientRects().length) return;
            const at = key => Number((m[key] || [])[d]) || 0;
            const scale = at('box_scale') / 100, cx = at('box_x') / 100 * W, cy = at('box_y') / 100 * H;
            const hw = at('box_width') / 100 * W * scale / 2, hh = H * scale / 2;
            // Only a layer that covers the scene before it moves (a background, a cutout of it).
            if (cx - hw > 1 || cx + hw < W - 1 || cy - hh > 1 || cy + hh < H - 1) return;
            const need = (c, half, C, move) => {
                let want = 1;
                [0, 1].forEach(function (p) {
                    const h = half * Math.max(.05, 1 + at('zoom') / 100 * p), a = c - C, t = move * p;
                    want = Math.max(want, h - a > 0 ? (C + t) / (h - a) : MAX_BLEED, h + a > 0 ? (C - t) / (h + a) : MAX_BLEED);
                });
                return want;
            };
            k = Math.max(k, need(cx, hw, W / 2, at('move_x')), need(cy, hh, H / 2, at('move_y')));
            fills.push([st, cx - W / 2, cy - H / 2]);
        });
        k = Math.min(MAX_BLEED, k);
        if (k <= 1.0005) return;
        fills.forEach(function ([st, ax, ay]) {
            st.setProperty('--wpbn-k', k.toFixed(4));
            st.setProperty('--wpbn-kx', (ax * (k - 1)).toFixed(2) + 'px');
            st.setProperty('--wpbn-ky', (ay * (k - 1)).toFixed(2) + 'px');
        });
    }

    // Height "Auto": the free height of the parent column.
    // With the scene collapsed the column keeps the height its row gives it;
    // whatever else the column holds (padding, other content) is taken off.
    const fillBox = s => s.el.closest('.wpb_column, .vc_column_container') || s.el.parentElement;
    // Placed by class: the block's size. A block with no height of its own (empty) gets the
    // scene's height as its minimum, so the scene still shows.
    function fillSize(s) {
        const host = s.el.parentElement;
        if (s.minHeight) { host.style.minHeight = ''; s.minHeight = false; }
        if (host.getBoundingClientRect().height < FILL_MIN) {
            const value = getComputedStyle(s.el).getPropertyValue(['--wpbn-height', '--wpbn-tablet-height', '--wpbn-mobile-height'][device()]).trim();
            const n = parseFloat(value), own = /vh$/.test(value) ? innerHeight * n / 100 : /px$/.test(value) ? n : 0;
            host.style.minHeight = (own >= FILL_MIN ? own : FALLBACK) + 'px';
            s.minHeight = true;
        }
        bleed(s);
    }
    function size(s) {
        if (s.fill) { fillSize(s); return; }
        const scene = s.el;
        const auto = (scene.dataset.auto || '').split(' ').indexOf(DEVICES[device()]) !== -1;
        if (!auto) {
            scene.style.height = '';
            // A % height needs a parent with a height of its own; without one, the fallback.
            if (scene.getBoundingClientRect().height < 1) scene.style.height = FALLBACK + 'px';
        } else {
            const box = fillBox(s);
            scene.style.height = '0px';
            const collapsed = box.getBoundingClientRect().height;
            scene.style.height = collapsed + 'px';
            const free = Math.floor(collapsed - (box.getBoundingClientRect().height - collapsed));
            scene.style.height = (free >= FILL_MIN ? free : FALLBACK) + 'px';
        }
        bleed(s);
    }
    function sizeAll() { scenes.forEach(size); }

    // One frame: each scene near the screen drawn at its progress.
    function tick() {
        frame = 0;
        scenes.forEach(function (s) {
            if (!s.visible && previewProgress === null) return;
            draw(s, previewProgress === null ? progress(s) : previewProgress);
        });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(tick); }

    // Only scenes near the screen are worked on.
    const near = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            const s = scenes.find(item => item.el === entry.target);
            if (s) s.visible = entry.isIntersecting;
        });
        schedule();
    }, {rootMargin: '200px 0px'}) : null;
    // Neighbour columns change height as their images load or text wraps.
    // Watch their content too: once the scene is the tallest thing in the row,
    // a shrinking neighbour would not resize the row.
    function watch(s) {
        if (near) near.observe(s.el);
        if (!('ResizeObserver' in window)) return;
        // Placed by class: sized again whenever the block changes size.
        if (s.fill) { new ResizeObserver(function () { size(s); schedule(); }).observe(s.el.parentElement); return; }
        if (!s.el.dataset.auto) return;
        const box = fillBox(s), row = box.parentElement || box, outer = s.el;
        const observer = new ResizeObserver(function () { size(s); schedule(); });
        observer.observe(row);
        const add = node => { if (!node.contains(outer) && !outer.contains(node)) observer.observe(node); };
        row.querySelectorAll('.wpb_wrapper, .vc_column-inner > *').forEach(add);
        Array.prototype.forEach.call(row.children, column => { if (!column.contains(outer)) Array.prototype.forEach.call(column.children, add); });
        Array.prototype.forEach.call(box.children, add);
    }

    // The editor's scroll simulation: a fixed progress.
    window.wpbnPreviewProgress = function (p) { previewProgress = clamp(p, 0, 1); tick(); };
    // Scenes added to the page later (a page builder's live editor): bind them too.
    window.wpbnRefresh = function () { place(); bind(); sizeAll(); schedule(); };
    addEventListener('scroll', function () { previewProgress = null; schedule(); }, {passive: true});
    addEventListener('resize', function () { sizeAll(); schedule(); });
    const changed = () => { sizeAll(); schedule(); };
    if (reduced.addEventListener) reduced.addEventListener('change', changed);
    addEventListener('load', changed);
    place();
    bind();
    tick();
}());
