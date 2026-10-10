package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Mocks only the repository; the outcome mapping is real. */
class BookTypeServiceTest {
    private val repository = mockk<BookTypeRepository>()
    private val service = BookTypeService(repository)
    private val id = BookTypes.KINDLE.id
    private val label = BookTypeLabel("Comic")
    private val color = HexColor("FF00FF")

    @Test
    fun `summaries are the repository's summaries`() = runBlocking {
        val summaries = listOf(BookTypeSummary(BookTypes.KINDLE, 2))
        coEvery { repository.findSummaries() } returns summaries

        assertEquals(summaries, service.summaries())
    }

    @Test
    fun `create returns the created type`() = runBlocking {
        coEvery { repository.create(label, color) } returns CreateOutcome.Created(BookTypes.KINDLE)

        assertEquals(BookTypes.KINDLE, service.create(label, color))
    }

    @Test
    fun `create with a taken label is a name taken error naming the holder`() {
        coEvery { repository.create(label, color) } returns CreateOutcome.Taken(BookTypes.KINDLE)

        val error = runBlocking { assertFailsWith<NameTakenException> { service.create(label, color) } }

        assertEquals(id.toString(), error.existingId)
        assertEquals("Kindle", error.existingName)
        assertEquals("book type", error.resource)
    }

    @Test
    fun `update returns the updated type`() = runBlocking {
        coEvery { repository.update(id, label, null) } returns RenameOutcome.Renamed(BookTypes.KINDLE)

        assertEquals(BookTypes.KINDLE, service.update(id, label, null))
    }

    @Test
    fun `update of an unknown id is a not found error`() {
        coEvery { repository.update(id, null, color) } returns RenameOutcome.NotFound

        runBlocking { assertFailsWith<NotFoundException> { service.update(id, null, color) } }
    }

    @Test
    fun `update onto a taken label is a name taken error naming the holder`() {
        coEvery { repository.update(id, label, color) } returns RenameOutcome.Taken(BookTypes.PAPERBACK)

        val error = runBlocking { assertFailsWith<NameTakenException> { service.update(id, label, color) } }

        assertEquals(BookTypes.PAPERBACK.id.toString(), error.existingId)
        assertEquals("Paperback", error.existingName)
    }

    @Test
    fun `delete of an unused type completes`() = runBlocking {
        coEvery { repository.delete(id) } returns DeleteOutcome.DELETED

        service.delete(id)
    }

    @Test
    fun `delete of an unknown id is a not found error`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.NOT_FOUND

        runBlocking { assertFailsWith<NotFoundException> { service.delete(id) } }
    }

    @Test
    fun `delete of a type still in use is a conflict`() {
        coEvery { repository.delete(id) } returns DeleteOutcome.IN_USE

        runBlocking { assertFailsWith<ConflictException> { service.delete(id) } }
    }
}
