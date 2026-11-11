/*
 * The "WP Banner" block (WPBN_Block): a scene chosen from the list, in the toolbar's sidebar and in the block
 * itself while none is; the scene drawn by the server as on the site (without its scroll motion). Plain
 * JavaScript on WordPress's scripts (wp.blocks, wp.element…): no build step. window.wpbnBlock: the scenes and
 * the links to edit or add one (for administrators).
 */
(function (wp) {
    'use strict';
    if (!wp || !wp.blocks || !wp.element) return;
    const el = wp.element.createElement, __ = wp.i18n.__;
    const {SelectControl, Placeholder, PanelBody, Button} = wp.components;
    const {InspectorControls, useBlockProps} = wp.blockEditor;
    const ServerSideRender = wp.serverSideRender;
    const data = window.wpbnBlock || {allowed: false, scenes: [], edit: '', add: ''};
    const options = [{value: 0, label: __('— Select scene —', 'wp-banner')}].concat(data.scenes.map(scene => ({value: scene.id, label: scene.label})));

    function choose(props) {
        // Without the right to put scenes on pages (WP Banner → Settings): no list, a word on why.
        if (!data.allowed) return el('p', null, __('Your role cannot choose WP Banner scenes (WP Banner → Settings).', 'wp-banner'));
        return el(SelectControl, {label: __('Scene', 'wp-banner'), value: props.attributes.id, options,
            onChange: value => props.setAttributes({id: Number(value) || 0}), __nextHasNoMarginBottom: true});
    }
    // Edit scene (the chosen one) and Add scene, in a new tab.
    function links(id) {
        const out = [];
        if (data.edit && id) out.push(el(Button, {key: 'edit', variant: 'secondary', href: data.edit + id, target: '_blank'}, __('Edit scene', 'wp-banner')));
        if (data.add) out.push(el(Button, {key: 'add', variant: 'tertiary', href: data.add, target: '_blank'}, __('Add scene', 'wp-banner')));
        return out.length ? el('div', {style: {display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap'}}, out) : null;
    }

    wp.blocks.registerBlockType('wp-banner/scene', {
        apiVersion: 2,
        edit: function (props) {
            const id = props.attributes.id, blockProps = useBlockProps();
            const sidebar = el(InspectorControls, null, el(PanelBody, {title: __('Scene', 'wp-banner')}, choose(props), links(id)));
            if (!id) {
                return el('div', blockProps, sidebar, el(Placeholder, {icon: 'images-alt2', label: __('WP Banner', 'wp-banner'),
                    instructions: !data.allowed || data.scenes.length ? __('Choose the scene to show.', 'wp-banner') : __('No published scenes yet: make one under WP Banner.', 'wp-banner')},
                    el('div', {style: {width: '100%'}}, !data.allowed || data.scenes.length ? choose(props) : null, links(0))));
            }
            return el('div', blockProps, sidebar, el(ServerSideRender, {block: 'wp-banner/scene', attributes: {id}}));
        },
        // Drawn by the server (WPBN_Block::render()).
        save: () => null
    });
}(window.wp));
