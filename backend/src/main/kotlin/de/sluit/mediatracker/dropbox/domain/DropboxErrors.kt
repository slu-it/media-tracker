package de.sluit.mediatracker.dropbox.domain

/**
 * [de.sluit.mediatracker.common.domain.ExternalSourceException] / `ExternalSourceUnavailableException` source
 * name for Dropbox (MT-024): `dropbox_error` / `dropbox_unavailable` over HTTP, see `plugins/StatusPages.kt`.
 */
const val DROPBOX_SOURCE = "dropbox"

/**
 * Dropbox rejected the authorization code or refresh token itself (`"error": "invalid_grant"`), thrown by
 * [DropboxApi.exchangeCode] and [DropboxApi.refresh]. On [DropboxApi.exchangeCode] this means the pasted code was
 * bad or expired, a 400 the user can retry ([DropboxService.connect] turns it into
 * [de.sluit.mediatracker.common.domain.InvalidValueException]). On [DropboxApi.refresh] it means the connection
 * was revoked on Dropbox's side; [DropboxService] deletes the stored connection and answers `dropbox_unavailable`.
 */
class DropboxInvalidGrantException(message: String) : RuntimeException(message)

/**
 * The access token presented to Dropbox was rejected (401) by [DropboxApi.upload] or [DropboxApi.getMetadata];
 * [DropboxService] retries once after forcing a token refresh.
 */
class DropboxUnauthorizedException(message: String) : RuntimeException(message)
