package de.sluit.mediatracker.backup.domain

import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.BackupSource
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.TableImportResult
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Mocks only [BackupSource] (the persistence port each domain implements): duplicate/unknown table name
 * rejection and the per-source slicing are [BackupService]'s own logic, no database involved.
 */
class BackupServiceTest {

    @Test
    fun `constructing with a table name owned by two sources throws`() {
        val a = mockk<BackupSource> { every { tableNames } returns listOf("games") }
        val b = mockk<BackupSource> { every { tableNames } returns listOf("games") }

        val exception = assertFailsWith<IllegalArgumentException> { BackupService(listOf(a, b)) }
        assertEquals(true, exception.message?.contains("games"))
    }

    @Test
    fun `export merges every source's tables in source order`() = runBlocking {
        val platforms = mockk<BackupSource> {
            every { tableNames } returns listOf("game_platforms")
            coEvery { export() } returns mapOf("game_platforms" to listOf(mapOf("id" to "1")))
        }
        val games = mockk<BackupSource> {
            every { tableNames } returns listOf("games")
            coEvery { export() } returns mapOf("games" to listOf(mapOf("id" to "2")))
        }
        val service = BackupService(listOf(platforms, games))

        val exported = service.export()

        assertEquals(listOf("game_platforms", "games"), exported.keys.toList())
        assertEquals(listOf(mapOf("id" to "1")), exported["game_platforms"])
        assertEquals(listOf(mapOf("id" to "2")), exported["games"])
    }

    @Test
    fun `import rejects an unknown table name and dispatches nothing`() = runBlocking {
        val games = mockk<BackupSource> { every { tableNames } returns listOf("games") }
        val service = BackupService(listOf(games))

        val exception = assertFailsWith<InvalidValueException> {
            service.import(mapOf("not_a_table" to emptyList()))
        }

        assertEquals("tables", exception.field)
        coVerify(exactly = 0) { games.import(any()) }
    }

    @Test
    fun `import hands each source only its own slice, defaulting a table it owns but the payload omits to empty`() =
        runBlocking {
            val platforms = mockk<BackupSource>()
            val games = mockk<BackupSource>()
            every { platforms.tableNames } returns listOf("game_platforms")
            every { games.tableNames } returns listOf("games", "game_to_platform")
            every { platforms.validate(any()) } just Runs
            every { games.validate(any()) } just Runs
            val platformsSlice = slot<Map<String, List<BackupRow>>>()
            val gamesSlice = slot<Map<String, List<BackupRow>>>()
            coEvery { platforms.import(capture(platformsSlice)) } returns
                mapOf("game_platforms" to TableImportResult(inserted = 1, skipped = 0))
            coEvery { games.import(capture(gamesSlice)) } returns mapOf(
                "games" to TableImportResult(inserted = 1, skipped = 0),
                "game_to_platform" to TableImportResult(inserted = 0, skipped = 0),
            )
            val service = BackupService(listOf(platforms, games))
            val payload = mapOf(
                "game_platforms" to listOf(mapOf("id" to "1")),
                "games" to listOf(mapOf("id" to "2")),
            )

            val result = service.import(payload)

            assertEquals(listOf(mapOf("id" to "1")), platformsSlice.captured.getValue("game_platforms"))
            assertEquals(listOf(mapOf("id" to "2")), gamesSlice.captured.getValue("games"))
            assertEquals(emptyList(), gamesSlice.captured.getValue("game_to_platform"))
            assertEquals(setOf("game_platforms", "games", "game_to_platform"), result.keys)
        }

    @Test
    fun `import validates every source before importing any, so a later source's failure stops all of them`() =
        runBlocking {
            val platforms = mockk<BackupSource>()
            val games = mockk<BackupSource>()
            every { platforms.tableNames } returns listOf("game_platforms")
            every { games.tableNames } returns listOf("games")
            every { platforms.validate(any()) } just Runs
            every { games.validate(any()) } throws InvalidValueException("games", "bad row")
            val service = BackupService(listOf(platforms, games))
            val payload = mapOf(
                "game_platforms" to listOf(mapOf("id" to "1")),
                "games" to listOf(mapOf("id" to "2")),
            )

            val exception = assertFailsWith<InvalidValueException> { service.import(payload) }

            assertEquals("games", exception.field)
            coVerify(exactly = 0) { platforms.import(any()) }
            coVerify(exactly = 0) { games.import(any()) }
        }
}
