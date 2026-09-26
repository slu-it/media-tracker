package de.sluit.mediatracker.common.domain

import kotlin.time.Instant

/**
 * Outward cloud storage the `backup` domain uses to keep a copy of the export off the device (MT-024, ADR 0028).
 * Implemented by `dropbox/domain/DropboxService`, so `backup` never imports `dropbox` and could gain another
 * provider later without changing its own code (mirrors how `games` never imports `games/integration` directly,
 * ADR 0024). Not configured or not connected is [ExternalSourceUnavailableException]; a call the provider itself
 * rejected is [ExternalSourceException]. Both are mapped to a fixed HTTP status in `plugins/StatusPages.kt`.
 */
interface CloudStorage {
    suspend fun upload(path: String, content: ByteArray): StoredFile

    suspend fun find(path: String): StoredFile?

    /** Cheap, no HTTP call: whether the provider is configured and a connection is currently stored. */
    suspend fun isConnected(): Boolean
}

/** One remote file's metadata (MT-024). [path] is provider-relative; [modifiedAt] and [sizeBytes] come from the provider. */
data class StoredFile(val path: String, val modifiedAt: Instant, val sizeBytes: Long)
