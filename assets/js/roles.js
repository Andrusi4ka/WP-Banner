/**
 * WP Banner → Settings (class-wpbn-access.php): a role's "Add and clone", "Delete" and "WPBakery element" only with its
 * "Edit scenes" (greyed and off without it, as the saved settings keep them: WPBN_Access::sanitize()). As WP Swiper's roles.js.
 */
( function () {
	'use strict';

	function sync( row ) {
		var edit = row.querySelector( 'input[data-action="edit"]' );
		if ( ! edit || edit.disabled ) {
			return;
		}
		[ 'create', 'delete', 'wpbakery' ].forEach( function ( action ) {
			var box = row.querySelector( 'input[data-action="' + action + '"]' );
			if ( ! box ) {
				return;
			}
			box.disabled = ! edit.checked;
			if ( ! edit.checked ) {
				box.checked = false;
			}
		} );
	}

	document.querySelectorAll( '.wpbn-roles__table tbody tr' ).forEach( function ( row ) {
		sync( row );
		row.addEventListener( 'change', function ( e ) {
			if ( e.target.matches( 'input[data-action="edit"]' ) ) {
				sync( row );
			}
		} );
	} );
}() );
