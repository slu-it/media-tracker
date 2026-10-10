package de.sluit.mediatracker.backup.api

import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/**
 * POST /api/backup/import: how many of a table's rows were inserted, already present unchanged (skipped) or
 * already present and overwritten from the backup ([updated], only the editable `game_platforms` and
 * `book_types` tables, 0 elsewhere). Each row is counted once.
 */
@Serializable
data class TableImportResultDto(val inserted: Int, val skipped: Int, val updated: Int)

/** Response of POST /api/backup/import, one entry per table the payload named. */
@Serializable
data class ImportResultResponse(val tables: Map<String, TableImportResultDto>)

/** GET/POST /api/backup/dropbox: the latest cloud backup, or `null` when none has been uploaded yet. */
@Serializable
data class CloudBackupResponse(val lastBackup: StoredFileDto?)

/** A single cloud-stored file's metadata; [modifiedAt] is ISO-8601, same shape as `DropboxStatusResponse.connectedAt`. */
@Serializable
data class StoredFileDto(val modifiedAt: String, val sizeBytes: Long)
