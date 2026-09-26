package de.sluit.mediatracker.backup.domain

import de.sluit.mediatracker.common.domain.BackupRow

/**
 * Encodes a merged export snapshot to bytes (MT-024, ADR 0027/0028). The only implementation,
 * `backup/api/JsonBackupCodec`, is shared by `backup/api/BackupRoutes.kt`'s `GET /api/backup/export` and
 * [CloudBackupService], so the downloaded file and the Dropbox upload are byte-for-byte identical. This interface
 * sits in `domain` so [CloudBackupService] does not depend on `api`; the implementation lives in `api` (not
 * `domain`) because JSON is a serialization format the domain must stay free of.
 */
interface BackupEncoder {
    fun encode(snapshot: Map<String, List<BackupRow>>): ByteArray
}
