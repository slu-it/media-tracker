package de.sluit.mediatracker.backup.domain

import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.CloudStorage
import de.sluit.mediatracker.common.domain.StoredFile
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

/**
 * [BackupService] and [BackupEncoder] are MockK mocks (strict); pins the path [CloudBackupService.backupNow]
 * uploads to and that the encoded bytes reach [CloudStorage] unchanged. The HTTP contract lives in
 * `backup/api/BackupRoutesTest`.
 */
class CloudBackupServiceTest {
    private val backup = mockk<BackupService>()
    private val encoder = mockk<BackupEncoder>()
    private val storage = mockk<CloudStorage>()
    private val service = CloudBackupService(backup, encoder, storage)

    private val snapshot: Map<String, List<BackupRow>> = mapOf("games" to listOf(mapOf("id" to "1")))
    private val encoded = "encoded-json".toByteArray()
    private val stored = StoredFile(
        path = CloudBackupService.BACKUP_PATH,
        modifiedAt = Instant.parse("2024-01-01T00:00:00Z"),
        sizeBytes = encoded.size.toLong(),
    )

    @Test
    fun `backupNow uploads the encoder's bytes unchanged to the fixed path`() = runBlocking {
        coEvery { backup.export() } returns snapshot
        coEvery { encoder.encode(snapshot) } returns encoded
        coEvery { storage.upload(CloudBackupService.BACKUP_PATH, encoded) } returns stored

        val result = service.backupNow()

        assertEquals(stored, result)
        coVerify { storage.upload(CloudBackupService.BACKUP_PATH, encoded) }
    }

    @Test
    fun `lastBackup finds the fixed path in storage`() = runBlocking {
        coEvery { storage.find(CloudBackupService.BACKUP_PATH) } returns stored

        val result = service.lastBackup()

        assertEquals(stored, result)
    }

    @Test
    fun `lastBackup is null when storage has nothing stored yet`() = runBlocking {
        coEvery { storage.find(CloudBackupService.BACKUP_PATH) } returns null

        val result = service.lastBackup()

        assertNull(result)
    }

    @Test
    fun `isEnabled delegates to storage being connected`() = runBlocking {
        coEvery { storage.isConnected() } returns true

        assertTrue(service.isEnabled())
    }

    @Test
    fun `isEnabled is false when storage is not connected`() = runBlocking {
        coEvery { storage.isConnected() } returns false

        assertFalse(service.isEnabled())
    }
}
