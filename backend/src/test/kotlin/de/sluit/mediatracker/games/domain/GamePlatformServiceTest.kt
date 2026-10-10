package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.games.Platforms
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Mocks only the repository; the outcome mapping is real. */
class GamePlatformServiceTest {
    private val repository = mockk<GamePlatformRepository>()
    private val service = GamePlatformService(repository)
    private val id = Platforms.XBOX.id
    private val label = PlatformLabel("Switch 2")
    private val color = HexColor("FF00FF")

    @Test
    fun `summaries are the repository's summaries`() = runBlocking {
        val summaries = listOf(GamePlatformSummary(Platforms.XBOX, 2))
        coEvery { repository.findSummaries() } returns summaries

        assertEquals(summaries, service.summaries())
    }

    @Test
    fun `create returns the created platform`() = runBlocking {
        coEvery { repository.create(label, color) } returns CreateOutcome.Created(Platforms.XBOX)

        assertEquals(Platforms.XBOX, service.create(label, color))
    }

    @Test
    fun `create with a taken label is a name taken error naming the holder`() {
        coEvery { repository.create(label, color) } returns CreateOutcome.Taken(Platforms.XBOX)

        val error = runBlocking { assertFailsWith<NameTakenException> { service.create(label, color) } }

        assertEquals(id.toString(), error.existingId)
        assertEquals("Xbox", error.existingName)
        assertEquals("game platform", error.resource)
    }

    @Test
    fun `update returns the updated platform`() = runBlocking {
        coEvery { repository.update(id, label, null) } returns RenameOutcome.Renamed(Platforms.XBOX)

        assertEquals(Platforms.XBOX, service.update(id, label, null))
    }

    @Test
    fun `update of an unknown id is a not found error`() {
        coEvery { repository.update(id, null, color) } returns RenameOutcome.NotFound

        runBlocking { assertFailsWith<NotFoundException> { service.update(id, null, color) } }
    }

    @Test
    fun `update onto a taken label is a name taken error naming the holder`() {
        coEvery { repository.update(id, label, color) } returns RenameOutcome.Taken(Platforms.NINTENDO)

        val error = runBlocking { assertFailsWith<NameTakenException> { service.update(id, label, color) } }

        assertEquals(Platforms.NINTENDO.id.toString(), error.existingId)
        assertEquals("Nintendo", error.existingName)
    }

    @Test
    fun `delete of an unused platform completes`() = runBlocking {
        coEvery { repository.delete(id) } returns DeleteOutcome.DELETED

        service.delete(id)
    }

    @Test
    fun `delete of an unknown id is a not found error`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.NOT_FOUND

        runBlocking { assertFailsWith<NotFoundException> { service.delete(id) } }
    }

    @Test
    fun `delete of a platform still in use is a conflict`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.IN_USE

        runBlocking { assertFailsWith<ConflictException> { service.delete(id) } }
    }
}
