package de.sluit.mediatracker.dropbox.domain

import de.sluit.mediatracker.common.domain.StoredFile
import kotlin.time.Duration

/**
 * The HTTP calls [DropboxService] needs from Dropbox's API (MT-024, ADR 0028), implemented by
 * `dropbox/integration/DropboxHttpApi`. A 5xx response, malformed payload or I/O failure becomes
 * [de.sluit.mediatracker.common.domain.ExternalSourceException]; [DropboxInvalidGrantException] and
 * [DropboxUnauthorizedException] are the two failures [DropboxService] reacts to specifically.
 */
interface DropboxApi {
    /** Exchanges a freshly pasted [AuthorizationCode] for an access token and a long-lived [RefreshToken]. */
    suspend fun exchangeCode(code: AuthorizationCode): ExchangeGrant

    /** Renews the access token; Dropbox does not rotate the refresh token on this call. */
    suspend fun refresh(refreshToken: RefreshToken): AccessGrant

    /** Best-effort revocation of [accessToken] on Dropbox's side. */
    suspend fun revoke(accessToken: String)

    /** Uploads [content] to [path] (app-folder relative), overwriting any existing file at that path. */
    suspend fun upload(accessToken: String, path: String, content: ByteArray): StoredFile

    /** The metadata of the file at [path], or `null` if Dropbox reports no such file. */
    suspend fun getMetadata(accessToken: String, path: String): StoredFile?
}

/**
 * One access-token grant, before [DropboxService] turns [expiresIn] into an absolute expiry through its injected
 * clock.
 */
data class AccessGrant(val accessToken: String, val expiresIn: Duration)

/** The result of the initial code exchange: an access grant plus the [RefreshToken] to keep it renewed. */
data class ExchangeGrant(val accessToken: String, val refreshToken: RefreshToken, val expiresIn: Duration)
