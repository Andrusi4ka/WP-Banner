/**
 * WP Banner element in WPBakery (as WP Swiper's): under the Scene list, "Edit scene"
 * (class-wpbn-wpbakery.php edit_param()) opens the chosen scene's
 * edit screen in a new tab, hidden while none is chosen; "Add scene" opens
 * the new scene screen in a new tab. Back on this tab after that, the list
 * is asked for again (admin-ajax.php) and the scene added there, the
 * newest of those not in the list before, is chosen.
 *
 * WPBakery attaches this file at the end of the element's settings form,
 * possibly each time a form opens: the handlers are bound once, the buttons
 * of the forms in view are set on every run.
 */
( function ( $ ) {
	'use strict';

	// The settings form a box is in.
	function formOf( node ) {
		var $form = $( node ).closest( '.vc_edit_form_elements, .vc_ui-panel-content, form' );
		return $form.length ? $form : $( document );
	}

	// The Scene list of the same settings form.
	function sceneSelect( box ) {
		return formOf( box ).find( 'select.wpb_vc_param_value[name="id"]' ).first();
	}

	function sync( box ) {
		var $box = $( box );
		var id = parseInt( sceneSelect( box ).val(), 10 );
		var $link = $box.find( '.wpbn-vc-edit__link' );
		if ( id > 0 ) {
			$link.attr( 'href', $box.attr( 'data-url' ) + id ).prop( 'hidden', false );
		} else {
			$link.attr( 'href', '#' ).prop( 'hidden', true );
		}
		// "Opens in a new tab", while there is a button.
		$box.find( '.wpbn-vc-edit__note' ).prop( 'hidden', ! ( id > 0 ) && ! $box.find( '.wpbn-vc-edit__add' ).length );
	}

	function syncAll() {
		$( '.wpbn-vc-edit' ).each( function () {
			sync( this );
		} );
	}

	/**
	 * The Scene list as the site has it now: its options again (the first,
	 * "Select scene", kept), the scene chosen kept; with `choose`, the
	 * newest of those not there before is chosen.
	 *
	 * @param {Element} box    The buttons' box.
	 * @param {boolean} choose Choose a scene added meanwhile.
	 */
	function refresh( box, choose ) {
		var $select = sceneSelect( box );
		var url = $( box ).attr( 'data-list' );
		if ( ! $select.length || ! url ) {
			return;
		}
		$.getJSON( url ).done( function ( response ) {
			if ( ! response || ! response.success || ! Array.isArray( response.data ) ) {
				return;
			}
			var known = {};
			$select.find( 'option' ).each( function () {
				known[ this.value ] = true;
			} );
			var chosen = $select.val();
			var added = 0;
			$select.find( 'option' ).slice( 1 ).remove();
			response.data.forEach( function ( scene ) {
				var id = String( scene.id );
				$( '<option>' ).val( id ).text( scene.label ).addClass( id ).appendTo( $select );
				if ( ! known[ id ] ) {
					added = Math.max( added, scene.id );
				}
			} );
			if ( choose && added ) {
				chosen = String( added );
			}
			$select.val( $select.find( 'option[value="' + chosen + '"]' ).length ? chosen : '' );
			// WPBakery and the buttons take the choice as one made by hand.
			$select.trigger( 'change' );
		} );
	}

	if ( ! window.wpBannerVcEdit ) {
		window.wpBannerVcEdit = true;

		// Another scene chosen.
		$( document ).on( 'change', 'select.wpb_vc_param_value[name="id"]', function () {
			formOf( this ).find( '.wpbn-vc-edit' ).each( function () {
				sync( this );
			} );
		} );

		// "Add scene": the form waits for this tab to be back in view.
		$( document ).on( 'click', '.wpbn-vc-edit__add', function () {
			$( this ).closest( '.wpbn-vc-edit' ).addClass( 'is-adding' );
		} );

		// Back on this tab: the lists of the forms open, the new scene chosen
		// where it was added from.
		var back = function () {
			if ( document.hidden ) {
				return;
			}
			$( '.wpbn-vc-edit' ).each( function () {
				var adding = $( this ).hasClass( 'is-adding' );
				$( this ).removeClass( 'is-adding' );
				refresh( this, adding );
			} );
		};
		document.addEventListener( 'visibilitychange', back );
		window.addEventListener( 'focus', function () {
			// Focus also comes back from the page's own fields: only after a new tab.
			if ( $( '.wpbn-vc-edit.is-adding' ).length ) {
				back();
			}
		} );

		// A settings form shown later (WPBakery renders them as they open).
		if ( 'MutationObserver' in window ) {
			new MutationObserver( function ( records ) {
				for ( var i = 0; i < records.length; i++ ) {
					for ( var j = 0; j < records[ i ].addedNodes.length; j++ ) {
						var node = records[ i ].addedNodes[ j ];
						if ( node.nodeType === 1 && ( node.matches( '.wpbn-vc-edit' ) || node.querySelector( '.wpbn-vc-edit' ) ) ) {
							syncAll();
							return;
						}
					}
				}
			} ).observe( document.body, { childList: true, subtree: true } );
		}
	}

	$( syncAll );
}( window.jQuery ) );
