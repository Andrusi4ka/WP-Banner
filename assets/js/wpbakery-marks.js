/**
 * WPBakery's Backend editor (2026-11-23, user's request): a WP Banner element whose scene is placed by class
 * (Scene settings → Placement) and stands in a row, column or block with that class in its "Extra class name"
 * is marked on its box: yellow, "background of .class". Anywhere else it stays a plain element (the user's choice:
 * no warning). class-wpbn-wpbakery.php marks() gives wpbnVcMarks.
 *
 * WPBakery's own JS: vc.shortcodes (a Backbone collection of the page's elements: shortcode, params, parent_id)
 * and each model's view.$el. Everything is guarded: if a WPBakery update changes them, there are no marks, and
 * the editor is left alone.
 */
( function ( $ ) {
	'use strict';

	var D = window.wpbnVcMarks;
	if ( ! D ) {
		return;
	}

	var scenes = {};
	var timer = null;

	function setScenes( list ) {
		scenes = {};
		( list || [] ).forEach( function ( s ) {
			if ( s && s.host ) {
				scenes[ String( s.id ) ] = s;
			}
		} );
	}

	function classesOf( model ) {
		var params = model.get( 'params' ) || {};
		return String( params.el_class || '' ).split( /\s+/ ).filter( Boolean );
	}

	// Whether a row, column or block around the element has the class (as the page's HOST_SCRIPT finds it: the nearest one).
	function hosted( model, cls ) {
		var id = model.get( 'parent_id' ), guard = 0, parent;
		while ( id && guard++ < 50 ) {
			parent = vc.shortcodes.get( id );
			if ( ! parent ) {
				return false;
			}
			if ( classesOf( parent ).indexOf( cls ) >= 0 ) {
				return true;
			}
			id = parent.get( 'parent_id' );
		}
		return false;
	}

	function mark() {
		try {
			vc.shortcodes.each( function ( model ) {
				if ( model.get( 'shortcode' ) !== D.shortcode || ! model.view || ! model.view.$el ) {
					return;
				}
				var $el = model.view.$el;
				$el.removeClass( 'wpbn-vc--bg' ).find( '.wpbn-vc-mark' ).remove();
				var scene = scenes[ String( ( model.get( 'params' ) || {} ).id || '' ) ];
				if ( ! scene || ! hosted( model, scene.host ) ) {
					return;
				}
				var $box = $el.children( '.wpb_element_wrapper' ).first();
				$el.addClass( 'wpbn-vc--bg' );
				$( '<div class="wpbn-vc-mark"></div>' ).text( D.i18n.background.replace( '%s', '.' + scene.host ) ).appendTo( $box.length ? $box : $el );
			} );
		} catch ( e ) {
			// WPBakery changed: no marks.
		}
	}

	// After WPBakery has drawn the change (a box redrawn loses its mark).
	function schedule() {
		clearTimeout( timer );
		timer = setTimeout( mark, 80 );
	}

	// A scene changed in another tab ("Edit scene" opens one): its placement again.
	function refresh() {
		$.getJSON( D.list ).done( function ( response ) {
			if ( response && response.success ) {
				setScenes( response.data );
				schedule();
			}
		} );
	}

	var tries = 0;
	function start() {
		if ( ! window.vc || ! vc.shortcodes || 'function' !== typeof vc.shortcodes.on ) {
			if ( tries++ < 100 ) {
				setTimeout( start, 200 );
			}
			return;
		}
		vc.shortcodes.on( 'add remove change reset sort sync', schedule );
		$( window ).on( 'focus', refresh );
		schedule();
	}

	setScenes( D.scenes );
	$( start );
} )( jQuery );
