package de.sluit.mediatracker.dropbox.domain

import de.sluit.mediatracker.common.domain.CloudStorage
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.StoredFile
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.slf4j.LoggerFactory
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

/**
 * Dropbox adapter for [CloudStorage] (MT-024, ADR 0028): the in-app, no-redirect authorization-code flow plus an
 * access-token cache shared by every call to [upload]/[find]. The cache is refreshed 5 minutes before it expires
 * ([REFRESH_MARGIN]) and, on top of that, a single 401 from Dropbox forces one more refresh and one retry of the
 * failing call. Everything that touches [cachedAccessToken]/[cachedExpiresAt] runs behind [mutex], since the
 * scheduled backup and a manual "back up now" can race.
 *
 * Not configured (no app key/secret, see [available]) or not connected is [ExternalSourceUnavailableException];
 * a call Dropbox itself rejected is [ExternalSourceException]. Both are mapped to a fixed HTTP status in
 * `plugins/StatusPages.kt`. `invalid_grant` on a refresh call means the connection was revoked on Dropbox's own
 * side: the stored connection is deleted so [status] reports "not connected" from then on, mirroring what
 * actually happened; a fresh [connect] is the only way back.
 */
class DropboxService(
    private val backend: Backend?,
    private val connections: DropboxConnectionRepository,
    private val clock: Clock,
) : CloudStorage {
    private val log = LoggerFactory.getLogger(DropboxService::class.java)
    private val mutex = Mutex()
    private var cachedAccessToken: String? = null
    private var cachedExpiresAt: Instant? = null

    /** Whether the app key and secret are configured; independent of whether a connection currently exists. */
    val available: Boolean get() = backend != null

    /** The URL to open in a new tab to start the no-redirect code flow; Dropbox then shows the user a code. */
    fun authorizeUrl(): String {
        val backend = backend ?: throw ExternalSourceUnavailableException(DROPBOX_SOURCE)
        return "https://www.dropbox.com/oauth2/authorize?client_id=${backend.appKey}" +
            "&response_type=code&token_access_type=offline"
    }

    suspend fun status(): DropboxStatus {
        val connection = connections.find()
        return DropboxStatus(
            available = available,
            connected = connection != null,
            connectedAt = connection?.connectedAt,
        )
    }

    override suspend fun isConnected(): Boolean = available && connections.find() != null

    /** Exchanges [code] for tokens and stores the connection. A code Dropbox itself rejects is a 400, not a 502. */
    suspend fun connect(code: AuthorizationCode): DropboxStatus {
        val backend = backend ?: throw ExternalSourceUnavailableException(DROPBOX_SOURCE)
        val grant = try {
            backend.api.exchangeCode(code)
        } catch (e: DropboxInvalidGrantException) {
            throw InvalidValueException(AuthorizationCode.FIELD, "was not accepted by dropbox")
        }
        val now = clock.now()
        connections.save(grant.refreshToken, now)
        mutex.withLock {
            cachedAccessToken = grant.accessToken
            cachedExpiresAt = now + grant.expiresIn
        }
        return status()
    }

    /** Best-effort revoke, then always deletes the stored connection; idempotent when there is none. */
    suspend fun disconnect() {
        val connection = connections.find()
        val backend = backend
        if (connection != null && backend != null) {
            val token = try {
                accessToken()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                log.warn("could not obtain an access token to revoke on disconnect", e)
                null
            }
            if (token != null) {
                try {
                    backend.api.revoke(token)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    log.warn("dropbox revoke on disconnect failed, disconnecting locally anyway", e)
                }
            }
        }
        mutex.withLock {
            connections.delete()
            cachedAccessToken = null
            cachedExpiresAt = null
        }
    }

    override suspend fun upload(path: String, content: ByteArray): StoredFile = withUnauthorizedRetry { token ->
        requireBackend().api.upload(token, path, content)
    }

    override suspend fun find(path: String): StoredFile? = withUnauthorizedRetry { token ->
        requireBackend().api.getMetadata(token, path)
    }

    private fun requireBackend(): Backend = backend ?: throw ExternalSourceUnavailableException(DROPBOX_SOURCE)

    /** Calls [call] with the cached access token; on a 401 forces one refresh and retries [call] exactly once. */
    private suspend fun <T> withUnauthorizedRetry(call: suspend (String) -> T): T {
        requireBackend()
        val token = accessToken()
        return try {
            call(token)
        } catch (e: DropboxUnauthorizedException) {
            val refreshed = accessToken(forceRefresh = true)
            try {
                call(refreshed)
            } catch (e2: DropboxUnauthorizedException) {
                throw ExternalSourceException(DROPBOX_SOURCE, "dropbox rejected the refreshed access token", e2)
            }
        }
    }

    /**
     * The cached access token, refreshed when [forceRefresh] is set or the cache is empty or within
     * [REFRESH_MARGIN] of expiry. Throws [ExternalSourceUnavailableException] when there is no stored connection
     * (never configured, or disconnected in the meantime) and deletes the connection on `invalid_grant`.
     */
    private suspend fun accessToken(forceRefresh: Boolean = false): String = mutex.withLock {
        val now = clock.now()
        val expiry = cachedExpiresAt
        val cached = cachedAccessToken
        if (!forceRefresh && cached != null && expiry != null && now < expiry - REFRESH_MARGIN) {
            return@withLock cached
        }
        val backend = requireBackend()
        val connection = connections.find() ?: throw ExternalSourceUnavailableException(DROPBOX_SOURCE)
        try {
            val grant = backend.api.refresh(connection.refreshToken)
            cachedAccessToken = grant.accessToken
            cachedExpiresAt = now + grant.expiresIn
            grant.accessToken
        } catch (e: DropboxInvalidGrantException) {
            cachedAccessToken = null
            cachedExpiresAt = null
            // Only if the stored connection is still the one dropbox just rejected: a reconnect that raced with
            // this refresh (a fresh save() from connect()) must not be wiped.
            connections.deleteIfRefreshTokenMatches(connection.refreshToken)
            throw ExternalSourceUnavailableException(DROPBOX_SOURCE)
        }
    }

    /** The configured app key and the port to call Dropbox through; both present or both absent, see [available]. */
    class Backend(val api: DropboxApi, val appKey: String)

    companion object {
        private val REFRESH_MARGIN = 5.minutes
    }
}

/** GET /api/dropbox's domain shape; [connectedAt] is `null` exactly when [connected] is false. */
data class DropboxStatus(val available: Boolean, val connected: Boolean, val connectedAt: Instant?)
