package de.sluit.mediatracker.backup.api

import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** POST /api/backup/import: how many of a table's rows were inserted versus already present (skipped). */
@Serializable
data class TableImportResultDto(val inserted: Int, val skipped: Int)

/** Response of POST /api/backup/import, one entry per table the payload named. */
@Serializable
data class ImportResultResponse(val tables: Map<String, TableImportResultDto>)
