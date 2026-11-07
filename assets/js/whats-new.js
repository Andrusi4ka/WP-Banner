/**
 * WP Banner "What's new" window (class-wpbn-whats-new.php): opens by
 * itself on the plugin's screens, from the notice on the Dashboard. Closing
 * it, or dismissing the notice, marks the version as seen for this user.
 */
( function ( $ ) {
	'use strict';

	var settings = window.wpbnWhatsNew || {};

	$( function () {
		var $modal = $( '.wpbn-news' ).appendTo( document.body );
		var $notice = $( '.wpbn-news-notice' );
		var opener = null;
		var told = false;

		if ( ! $modal.length ) {
			return;
		}

		// Once: the server remembers it for this user.
		function seen() {
			if ( told ) {
				return;
			}
			told = true;
			$.post( settings.ajaxUrl, { action: settings.action, _ajax_nonce: settings.nonce } );
		}

		function open() {
			opener = document.activeElement;
			$modal.prop( 'hidden', false );
			$( document.body ).addClass( 'wpbn-news-open' );
			$modal.find( '.wpbn-news__done' ).trigger( 'focus' );
		}

		function close() {
			$modal.prop( 'hidden', true );
			$( document.body ).removeClass( 'wpbn-news-open' );
			$notice.remove();
			seen();
			if ( opener && opener.focus && document.body.contains( opener ) ) {
				opener.focus();
			}
		}

		$modal.on( 'click', '.wpbn-news__done, .wpbn-news__close, .wpbn-news__backdrop', close );
		$( document ).on( 'keydown', function ( e ) {
			if ( e.key === 'Escape' && ! $modal.prop( 'hidden' ) ) {
				close();
			}
		} );

		$notice.on( 'click', '.wpbn-news-open', open );
		// The notice's own close button (WordPress adds it to .is-dismissible).
		$notice.on( 'click', '.notice-dismiss', seen );

		if ( settings.autoOpen ) {
			open();
		}
	} );
}( jQuery ) );
