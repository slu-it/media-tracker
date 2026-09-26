package de.sluit.mediatracker.dropbox.domain

import kotlin.time.Instant

/** The one stored Dropbox connection this instance manages, keyed internally by provider ("dropbox"). */
interface DropboxConnectionRepository {
    suspend fun find(): DropboxConnection?

    /** Upsert: replaces any existing stored connection. */
    suspend fun save(refreshToken: RefreshToken, connectedAt: Instant)

    /** Idempotent: a no-op when there is no stored connection. */
    suspend fun delete()

    /**
     * Deletes the stored connection only if its current refresh token still equals [refreshToken]; a no-op
     * otherwise. Used when a refresh call comes back `invalid_grant`, so a reconnect that raced with it (a fresh
     * [save]) is not wiped by the delete for the token that was actually rejected.
     */
    suspend fun deleteIfRefreshTokenMatches(refreshToken: RefreshToken)
}

data class DropboxConnection(val refreshToken: RefreshToken, val connectedAt: Instant)
