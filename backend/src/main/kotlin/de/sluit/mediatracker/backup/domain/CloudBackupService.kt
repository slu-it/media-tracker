package de.sluit.mediatracker.backup.domain

import de.sluit.mediatracker.common.domain.CloudStorage
import de.sluit.mediatracker.common.domain.StoredFile
import org.slf4j.LoggerFactory

/**
 * Backs up the full export to cloud storage (MT-024, ADR 0027/0028): encodes [BackupService.export] with
 * [encoder] and uploads it to [BACKUP_PATH] via [storage]. [encoder] is the same [BackupEncoder]
 * `backup/api/BackupRoutes.kt`'s `GET /api/backup/export` uses, so the downloaded file and the Dropbox upload are
 * byte-for-byte identical. Not configured or not connected, and an upstream failure, surface as
 * [de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException] /
 * [de.sluit.mediatracker.common.domain.ExternalSourceException] straight from [storage]; mapped to a fixed HTTP
 * status in `plugins/StatusPages.kt`. Wired in `Application.module()` with `services.dropbox` as [storage].
 * `backup/api/BackupScheduler` calls [isEnabled] before [backupNow] so a scheduled run skips cheaply, without a
 * DB export, while the connection is missing.
 */
class CloudBackupService(
    private val backup: BackupService,
    private val encoder: BackupEncoder,
    private val storage: CloudStorage,
) {
    private val log = LoggerFactory.getLogger(CloudBackupService::class.java)

    /** Cheap, no HTTP call: whether [storage] is configured and connected right now. */
    suspend fun isEnabled(): Boolean = storage.isConnected()

    /** Exports, encodes and uploads the full backup, overwriting whatever was previously stored at [BACKUP_PATH]. */
    suspend fun backupNow(): StoredFile {
        val bytes = encoder.encode(backup.export())
        val stored = storage.upload(BACKUP_PATH, bytes)
        log.info("cloud backup uploaded to ${stored.path} (${stored.sizeBytes} bytes)")
        return stored
    }

    /** The most recently uploaded backup's metadata, or `null` when none exists yet. */
    suspend fun lastBackup(): StoredFile? = storage.find(BACKUP_PATH)

    companion object {
        const val BACKUP_PATH = "/backup/full-export.json"
    }
}
