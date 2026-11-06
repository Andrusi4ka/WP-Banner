(function () {
    'use strict';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const FILL_MIN = 120, FALLBACK = 500;
    let pending = false, previewProgress = null;
    const device = () => innerWidth <= 767 ? 'mobile' : innerWidth <= 1024 ? 'tablet' : 'desktop';
    // The travel for the screen: "desktop tablet mobile" in each data attribute.
    const travel = (value, index) => Number(String(value || 0).split(' ')[index]) || 0;
    function draw(scene, progress) {
        const index = ['desktop', 'tablet', 'mobile'].indexOf(device()), factor = reduced.matches ? 0 : progress;
        scene.querySelectorAll('.wplm-layer').forEach(function (layer) {
            layer.style.setProperty('--wplm-dx', travel(layer.dataset.moveX, index) * factor + 'px');
            layer.style.setProperty('--wplm-dy', travel(layer.dataset.moveY, index) * factor + 'px');
        });
    }
    // Height "Auto" (as WP Swiper's): the free height of the parent column.
    // With the scene collapsed the column keeps the height its row gives it;
    // whatever else the column holds (padding, other content) is taken off.
    const fillBox = scene => scene.closest('.wpb_column, .vc_column_container') || scene.parentElement;
    function size(scene) {
        const auto = (scene.dataset.auto || '').split(' ').indexOf(device()) !== -1;
        if (!auto) {
            scene.style.height = '';
            // A % height needs a parent with a height of its own; without one, the fallback.
            if (scene.getBoundingClientRect().height < 1) scene.style.height = FALLBACK + 'px';
            return;
        }
        const box = fillBox(scene);
        scene.style.height = '0px';
        const collapsed = box.getBoundingClientRect().height;
        scene.style.height = collapsed + 'px';
        const free = Math.floor(collapsed - (box.getBoundingClientRect().height - collapsed));
        scene.style.height = (free >= FILL_MIN ? free : FALLBACK) + 'px';
    }
    function sizeAll() { document.querySelectorAll('.wplm-scene').forEach(size); }
    function update() {
        pending = false;
        document.querySelectorAll('.wplm-scene').forEach(function (scene) {
            const rect = scene.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > innerHeight) return;
            // Keep the photo and cutout aligned until the scene reaches the top.
            draw(scene, previewProgress === null ? Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height))) : previewProgress);
        });
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
    window.wplmPreviewProgress = function (p) { previewProgress = Math.max(0, Math.min(1, p)); document.querySelectorAll('.wplm-scene').forEach(s => draw(s, previewProgress)); };
    addEventListener('scroll', function () { previewProgress = null; schedule(); }, {passive:true});
    addEventListener('resize', function () { sizeAll(); schedule(); });
    if (reduced.addEventListener) reduced.addEventListener('change', schedule);
    sizeAll();
    // Neighbour columns change height as their images load or text wraps.
    // Watch their content too (as WP Swiper does): once the scene is the
    // tallest thing in the row, a shrinking neighbour would not resize the row.
    if ('ResizeObserver' in window) {
        document.querySelectorAll('.wplm-scene[data-auto]').forEach(function (scene) {
            const box = fillBox(scene), row = box.parentElement || box;
            const observer = new ResizeObserver(function () { size(scene); schedule(); });
            observer.observe(row);
            const watch = node => { if (!node.contains(scene) && !scene.contains(node)) observer.observe(node); };
            row.querySelectorAll('.wpb_wrapper, .vc_column-inner > *').forEach(watch);
            Array.prototype.forEach.call(row.children, column => { if (!column.contains(scene)) Array.prototype.forEach.call(column.children, watch); });
            Array.prototype.forEach.call(box.children, watch);
        });
    }
    addEventListener('load', function () { sizeAll(); schedule(); });
    update();
}());
