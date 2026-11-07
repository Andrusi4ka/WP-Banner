<?php
/**
 * "What's new" after an update: the changes of the versions since the one
 * a user last saw, from the plugin's own readme.txt (its Changelog), in a
 * window on the plugin's screens and, on the Dashboard, a notice that opens
 * it. Once for each user who can edit scenes; not after a first install.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBN_Whats_New {

	// The version the site ran last (an update shows when it changes).
	const OPTION_VERSION = 'wpbn_version';
	// The version updated from: the changes after it are new. '' unknown (an
	// update from before this option): the current version's only.
	const OPTION_FROM = 'wpbn_updated_from';
	// Per user: the version whose changes they have seen.
	const META_SEEN = 'wpbn_seen_version';
	const AJAX      = 'wpbn_whats_new_seen';

	/** @var array Versions to show (entries()), per user ID, once worked out. */
	private static $entries = array();

	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'track_version' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notice' ) );
		add_action( 'admin_footer', array( __CLASS__, 'render_modal' ) );
		add_action( 'wp_ajax_' . self::AJAX, array( __CLASS__, 'ajax_seen' ) );
	}

	/**
	 * A new version: remember it and the one before. A first install (no
	 * version stored, no scenes yet) has nothing new to show; a site that
	 * has scenes but no version stored was updated from a version before
	 * this option, which one is unknown.
	 */
	public static function track_version() {
		$stored = get_option( self::OPTION_VERSION );
		if ( WPBN_VERSION === $stored ) {
			return;
		}
		if ( false === $stored ) {
			$from = self::has_scenes() ? '' : WPBN_VERSION;
		} else {
			$from = (string) $stored;
		}
		update_option( self::OPTION_VERSION, WPBN_VERSION );
		update_option( self::OPTION_FROM, $from );
		self::$entries = array();
	}

	private static function has_scenes() {
		$found = get_posts(
			array(
				'post_type'      => 'wpbn_scene',
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		return ! empty( $found );
	}

	/**
	 * The Changelog of a readme.txt: version => its items (text), newest first.
	 *
	 * @param string $readme The readme's text.
	 * @return array
	 */
	public static function parse_changelog( $readme ) {
		$readme = str_replace( "\r\n", "\n", (string) $readme );
		if ( ! preg_match( '/^==\s*Changelog\s*==\s*$(.*?)(?=^==[^=]|\z)/ims', $readme, $section ) ) {
			return array();
		}
		$versions = array();
		$current  = null;
		foreach ( explode( "\n", $section[1] ) as $line ) {
			if ( preg_match( '/^=\s*v?(\d+(?:\.\d+)*)\s*=\s*$/', trim( $line ), $match ) ) {
				$current              = $match[1];
				$versions[ $current ] = array();
			} elseif ( null !== $current && preg_match( '/^\s*[*-]\s+(.+)$/', $line, $match ) ) {
				$versions[ $current ][] = trim( $match[1] );
			} elseif ( null !== $current && '' !== trim( $line ) && $versions[ $current ] ) {
				// A wrapped item: its next line.
				$last                           = count( $versions[ $current ] ) - 1;
				$versions[ $current ][ $last ] .= ' ' . trim( $line );
			}
		}
		return array_filter( $versions );
	}

	/**
	 * The versions after `from` up to `to` (both included when from is ''),
	 * newest first. '' from: `to` only.
	 *
	 * @param array  $changelog parse_changelog().
	 * @param string $from      Version seen, or ''.
	 * @param string $to        Current version.
	 * @return array version => items
	 */
	public static function between( $changelog, $from, $to ) {
		$out = array();
		foreach ( $changelog as $version => $items ) {
			$version = (string) $version;
			$newer   = '' === $from ? version_compare( $version, $to, '==' ) : version_compare( $version, $from, '>' );
			if ( $newer && version_compare( $version, $to, '<=' ) ) {
				$out[ $version ] = $items;
			}
		}
		uksort( $out, function ( $a, $b ) {
			return version_compare( $b, $a );
		} );
		return $out;
	}

	/**
	 * What to show the current user: the versions since the one they saw
	 * (else the one the site was updated from). None for those who cannot
	 * edit scenes, after a first install or once seen.
	 *
	 * @return array version => items
	 */
	public static function entries() {
		$user = get_current_user_id();
		if ( ! isset( self::$entries[ $user ] ) ) {
			self::$entries[ $user ] = self::work_out();
		}
		return self::$entries[ $user ];
	}

	/**
	 * @return array See entries().
	 */
	private static function work_out() {
		$type = get_post_type_object( 'wpbn_scene' );
		if ( ! $type || ! current_user_can( $type->cap->edit_posts ) ) {
			return array();
		}
		$seen = (string) get_user_meta( get_current_user_id(), self::META_SEEN, true );
		$from = '' !== $seen ? $seen : (string) get_option( self::OPTION_FROM, WPBN_VERSION );
		if ( '' !== $from && version_compare( $from, WPBN_VERSION, '>=' ) ) {
			return array();
		}

		$readme = WPBN_DIR . 'readme.txt';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin file.
		$text = is_readable( $readme ) ? (string) file_get_contents( $readme ) : '';
		return self::between( self::parse_changelog( $text ), $from, WPBN_VERSION );
	}

	/**
	 * The window opens by itself on the plugin's screens; the Dashboard has
	 * the notice that opens it.
	 *
	 * @return string 'plugin', 'dashboard' or ''.
	 */
	private static function place() {
		$screen = get_current_screen();
		if ( ! $screen ) {
			return '';
		}
		if ( 'wpbn_scene' === $screen->post_type ) {
			return 'plugin';
		}
		return 'dashboard' === $screen->id ? 'dashboard' : '';
	}

	public static function enqueue() {
		if ( ! self::place() || ! self::entries() ) {
			return;
		}
		wp_enqueue_style( 'wpbn-whats-new', WPBN_URL . 'assets/css/whats-new.css', array(), wpbn_asset( 'assets/css/whats-new.css' ) );
		wp_enqueue_script( 'wpbn-whats-new', WPBN_URL . 'assets/js/whats-new.js', array( 'jquery' ), wpbn_asset( 'assets/js/whats-new.js' ), true );
		wp_localize_script(
			'wpbn-whats-new',
			'wpbnWhatsNew',
			array(
				'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
				'action'   => self::AJAX,
				'nonce'    => wp_create_nonce( self::AJAX ),
				'autoOpen' => 'plugin' === self::place(),
			)
		);
	}

	public static function notice() {
		if ( 'dashboard' !== self::place() || ! self::entries() ) {
			return;
		}
		printf(
			'<div class="notice notice-info is-dismissible wpbn-news-notice"><p>%s <button type="button" class="button-link wpbn-news-open">%s</button></p></div>',
			/* translators: %s: plugin version. */
			esc_html( sprintf( __( 'WP Banner has been updated to %s.', 'wp-banner' ), WPBN_VERSION ) ),
			esc_html__( 'See what\'s new', 'wp-banner' )
		);
	}

	public static function render_modal() {
		$entries = self::place() ? self::entries() : array();
		if ( ! $entries ) {
			return;
		}
		?>
		<div class="wpbn-news" role="dialog" aria-modal="true" aria-labelledby="wpbn-news-title" hidden>
			<div class="wpbn-news__backdrop"></div>
			<div class="wpbn-news__box">
				<div class="wpbn-news__head">
					<h2 class="wpbn-news__title" id="wpbn-news-title">
						<?php
						/* translators: %s: plugin version. */
						echo esc_html( sprintf( __( 'What\'s new in WP Banner %s', 'wp-banner' ), WPBN_VERSION ) );
						?>
					</h2>
					<button type="button" class="wpbn-news__close" aria-label="<?php esc_attr_e( 'Close', 'wp-banner' ); ?>"><span class="dashicons dashicons-no-alt" aria-hidden="true"></span></button>
				</div>
				<div class="wpbn-news__body">
					<?php foreach ( $entries as $version => $items ) : ?>
						<?php // The version's heading only when there are several. ?>
						<?php if ( count( $entries ) > 1 ) : ?>
							<h3 class="wpbn-news__version"><?php echo esc_html( $version ); ?></h3>
						<?php endif; ?>
						<ul class="wpbn-news__list">
							<?php foreach ( $items as $item ) : ?>
								<li><?php echo esc_html( $item ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endforeach; ?>
				</div>
				<div class="wpbn-news__foot">
					<a class="wpbn-news__all" href="<?php echo esc_url( WPBN_REPOSITORY . 'releases' ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'All releases', 'wp-banner' ); ?></a>
					<button type="button" class="button button-primary wpbn-news__done"><?php esc_html_e( 'Got it', 'wp-banner' ); ?></button>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Seen: not again for this user until the next version.
	 */
	public static function mark_seen() {
		update_user_meta( get_current_user_id(), self::META_SEEN, WPBN_VERSION );
		unset( self::$entries[ get_current_user_id() ] );
	}

	public static function ajax_seen() {
		check_ajax_referer( self::AJAX );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( null, 403 );
		}
		self::mark_seen();
		wp_send_json_success();
	}
}
