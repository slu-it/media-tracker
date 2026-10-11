package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.games.series
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Mocks only the repository; the outcome mapping of `delete` is real. */
class GameSeriesServiceTest {
    private val repository = mockk<GameSeriesRepository>()
    private val service = GameSeriesService(repository)
    private val id = GameSeriesId.new()

    @Test
    fun `delete of an unused entry completes`() = runBlocking {
        coEvery { repository.delete(id) } returns DeleteOutcome.DELETED

        service.delete(id)
    }

    @Test
    fun `delete of an unknown id is a not found error`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.NOT_FOUND

        runBlocking { assertFailsWith<NotFoundException> { service.delete(id) } }
    }

    @Test
    fun `delete of an entry still in use is a conflict`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.IN_USE

        runBlocking { assertFailsWith<ConflictException> { service.delete(id) } }
    }

    private val name = VocabularyName("Renamed")

    @Test
    fun `rename returns the renamed entry`() = runBlocking {
        val entry = series("Renamed", id)
        coEvery { repository.rename(id, name) } returns RenameOutcome.Renamed(entry)

        assertEquals(entry, service.rename(id, name))
    }

    @Test
    fun `rename of an unknown id is a not found error`() {
        coEvery { repository.rename(id, name) } returns RenameOutcome.NotFound

        runBlocking { assertFailsWith<NotFoundException> { service.rename(id, name) } }
    }

    @Test
    fun `rename onto a taken name is a name taken error naming the holder`() {
        val holder = series("Renamed")
        coEvery { repository.rename(id, name) } returns RenameOutcome.Taken(holder)

        val error = runBlocking { assertFailsWith<NameTakenException> { service.rename(id, name) } }

        assertEquals(holder.id.toString(), error.existingId)
        assertEquals("Renamed", error.existingName)
    }

    @Test
    fun `merge returns the target`() = runBlocking {
        val targetId = GameSeriesId.new()
        val target = series("Target", targetId)
        coEvery { repository.merge(id, targetId) } returns MergeOutcome.Merged(target)

        assertEquals(target, service.merge(id, targetId))
    }

    @Test
    fun `merge with an unknown source is a not found error naming the source`() {
        val targetId = GameSeriesId.new()
        coEvery { repository.merge(id, targetId) } returns MergeOutcome.SourceNotFound

        val error = runBlocking { assertFailsWith<NotFoundException> { service.merge(id, targetId) } }

        assertTrue(error.message!!.contains(id.toString()), error.message)
    }

    @Test
    fun `merge with an unknown target is a not found error naming the target`() {
        val targetId = GameSeriesId.new()
        coEvery { repository.merge(id, targetId) } returns MergeOutcome.TargetNotFound

        val error = runBlocking { assertFailsWith<NotFoundException> { service.merge(id, targetId) } }

        assertTrue(error.message!!.contains(targetId.toString()), error.message)
    }

    @Test
    fun `merge into itself is a validation error and never reaches the repository`() {
        val error = runBlocking { assertFailsWith<InvalidValueException> { service.merge(id, id) } }

        assertEquals("targetId", error.field)
        coVerify(exactly = 0) { repository.merge(id, id) }
    }
}
