package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.author
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.Title
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.confirmVerified
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.uuid.Uuid

/**
 * Mocks only [BookRepository], [BookTypeRepository] and [BookAuthorRepository] (the persistence ports);
 * everything else is real, so these tests exercise the actual id assignment, patch application and type/author
 * resolution logic.
 */
class BookServiceTest {
    private val books = mockk<BookRepository>()
    private val types = mockk<BookTypeRepository>()
    private val authors = mockk<BookAuthorRepository>()
    private val service = BookService(books, types, authors)

    @Test
    fun `create assigns a new id and stores the book with its resolved types sorted by label`() = runBlocking {
        val newBook = NewBook(
            title = Title("Dune"),
            releaseYear = ReleaseYear(1965),
            typeIds = setOf(BookTypes.PAPERBACK.id, BookTypes.HARDCOVER.id),
        )
        coEvery { types.findByIds(setOf(BookTypes.PAPERBACK.id, BookTypes.HARDCOVER.id)) } returns
            listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER)
        val inserted = slot<Book>()
        coEvery { books.insert(capture(inserted)) } just Runs

        val result = service.create(newBook)

        assertEquals(newBook.title, inserted.captured.title)
        assertEquals(newBook.releaseYear, inserted.captured.releaseYear)
        assertEquals(listOf(BookTypes.HARDCOVER, BookTypes.PAPERBACK), inserted.captured.types)
        assertEquals(emptyList(), inserted.captured.authors)
        assertEquals(inserted.captured, result)
        coVerify(exactly = 0) { authors.findByIds(any()) }
    }

    @Test
    fun `create without types stores a book with no types and never asks the type repository`() = runBlocking {
        val inserted = slot<Book>()
        coEvery { books.insert(capture(inserted)) } just Runs

        service.create(NewBook(title = Title("Dune"), releaseYear = ReleaseYear(1965)))

        assertEquals(emptyList(), inserted.captured.types)
        coVerify(exactly = 0) { types.findByIds(any()) }
    }

    @Test
    fun `create resolves author ids and stores them sorted by name`() = runBlocking {
        val herbert = author("Frank Herbert")
        val adams = author("Douglas Adams")
        val newBook = NewBook(
            title = Title("Mixed"),
            releaseYear = ReleaseYear(2000),
            authorIds = setOf(herbert.id, adams.id),
        )
        coEvery { authors.findByIds(setOf(herbert.id, adams.id)) } returns listOf(herbert, adams)
        val inserted = slot<Book>()
        coEvery { books.insert(capture(inserted)) } just Runs

        service.create(newBook)

        assertEquals(listOf(adams, herbert), inserted.captured.authors)
    }

    @Test
    fun `create derives the release year from the release date overriding a contradicting release year`() =
        runBlocking {
            val newBook = NewBook(
                title = Title("Dune"),
                releaseYear = ReleaseYear(2020),
                releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)),
            )
            val inserted = slot<Book>()
            coEvery { books.insert(capture(inserted)) } just Runs

            service.create(newBook)

            assertEquals(ReleaseYear(1965), inserted.captured.releaseYear)
            assertEquals(ReleaseDate(LocalDate.of(1965, 8, 1)), inserted.captured.releaseDate)
        }

    @Test
    fun `create stores the ownership and progress values from the new book`() = runBlocking {
        val newBook = NewBook(
            title = Title("Dune"),
            releaseYear = ReleaseYear(1965),
            ownership = BookOwnership.OWNED,
            progress = BookProgress.FINISHED,
        )
        val inserted = slot<Book>()
        coEvery { books.insert(capture(inserted)) } just Runs

        service.create(newBook)

        assertEquals(BookOwnership.OWNED, inserted.captured.ownership)
        assertEquals(BookProgress.FINISHED, inserted.captured.progress)
    }

    @Test
    fun `create rejects an unknown type id naming the typeIds field`() = runBlocking {
        val unknown = BookTypeId(Uuid.random())
        val newBook = NewBook(
            title = Title("Unknown"),
            releaseYear = ReleaseYear(2020),
            typeIds = setOf(BookTypes.KINDLE.id, unknown),
        )
        coEvery { types.findByIds(setOf(BookTypes.KINDLE.id, unknown)) } returns listOf(BookTypes.KINDLE)

        val exception = assertFailsWith<InvalidValueException> { service.create(newBook) }

        assertEquals(BookTypeId.FIELD, exception.field)
        assertEquals(true, exception.reason.contains(unknown.toString()), exception.reason)
        coVerify(exactly = 0) { books.insert(any()) }
    }

    @Test
    fun `create rejects an unknown author id naming the authorIds field`() = runBlocking {
        val known = author("Frank Herbert")
        val unknown = BookAuthorId(Uuid.random())
        val newBook = NewBook(
            title = Title("Unknown"),
            releaseYear = ReleaseYear(2020),
            authorIds = setOf(known.id, unknown),
        )
        coEvery { authors.findByIds(setOf(known.id, unknown)) } returns listOf(known)

        val exception = assertFailsWith<InvalidValueException> { service.create(newBook) }

        assertEquals(BookAuthorId.FIELD, exception.field)
        coVerify(exactly = 0) { books.insert(any()) }
    }

    @Test
    fun `update applies the patch to the current book and saves it`() = runBlocking {
        val id = BookId.new()
        val current = book("Old Title", id = id, description = Description("old desc"))
        coEvery { books.findById(id) } returns current
        val patch = BookPatch(title = Title("New Title"), description = Patch.Change(null))
        val saved = slot<Book>()
        coEvery { books.update(capture(saved)) } returns true

        val result = service.update(id, patch)

        val expected = current.copy(title = Title("New Title"), description = null)
        assertEquals(expected, saved.captured)
        assertEquals(expected, result)
    }

    @Test
    fun `update changes ownership and progress when the patch carries them`() = runBlocking {
        val id = BookId.new()
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        val saved = slot<Book>()
        coEvery { books.update(capture(saved)) } returns true

        service.update(id, BookPatch(ownership = BookOwnership.OWNED, progress = BookProgress.READING))

        assertEquals(BookOwnership.OWNED, saved.captured.ownership)
        assertEquals(BookProgress.READING, saved.captured.progress)
    }

    @Test
    fun `update replaces the types when the patch carries type ids`() = runBlocking {
        val id = BookId.new()
        coEvery { books.findById(id) } returns book("Some Title", id = id, types = listOf(BookTypes.PAPERBACK))
        coEvery { types.findByIds(setOf(BookTypes.KINDLE.id)) } returns listOf(BookTypes.KINDLE)
        val saved = slot<Book>()
        coEvery { books.update(capture(saved)) } returns true

        service.update(id, BookPatch(typeIds = setOf(BookTypes.KINDLE.id)))

        assertEquals(listOf(BookTypes.KINDLE), saved.captured.types)
    }

    @Test
    fun `update clears the types when the patch carries an empty set of type ids`() = runBlocking {
        val id = BookId.new()
        coEvery { books.findById(id) } returns book("Some Title", id = id, types = listOf(BookTypes.PAPERBACK))
        val saved = slot<Book>()
        coEvery { books.update(capture(saved)) } returns true

        service.update(id, BookPatch(typeIds = emptySet()))

        assertEquals(emptyList(), saved.captured.types)
        coVerify(exactly = 0) { types.findByIds(any()) }
    }

    @Test
    fun `update leaves types and authors alone when the patch has none`() = runBlocking {
        val id = BookId.new()
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        coEvery { books.update(any()) } returns true

        service.update(id, BookPatch(title = Title("Renamed")))

        coVerify(exactly = 0) { types.findByIds(any()) }
        coVerify(exactly = 0) { authors.findByIds(any()) }
    }

    @Test
    fun `update replaces the authors when the patch carries author ids`() = runBlocking {
        val id = BookId.new()
        val herbert = author("Frank Herbert")
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        coEvery { authors.findByIds(setOf(herbert.id)) } returns listOf(herbert)
        val saved = slot<Book>()
        coEvery { books.update(capture(saved)) } returns true

        service.update(id, BookPatch(authorIds = setOf(herbert.id)))

        assertEquals(listOf(herbert), saved.captured.authors)
    }

    @Test
    fun `update rejects an unknown type id before saving`() = runBlocking {
        val id = BookId.new()
        val unknown = BookTypeId(Uuid.random())
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        coEvery { types.findByIds(setOf(unknown)) } returns emptyList()

        assertFailsWith<InvalidValueException> { service.update(id, BookPatch(typeIds = setOf(unknown))) }

        coVerify(exactly = 0) { books.update(any()) }
    }

    @Test
    fun `update rejects an unknown author id before saving`() = runBlocking {
        val id = BookId.new()
        val unknown = BookAuthorId(Uuid.random())
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        coEvery { authors.findByIds(setOf(unknown)) } returns emptyList()

        assertFailsWith<InvalidValueException> { service.update(id, BookPatch(authorIds = setOf(unknown))) }

        coVerify(exactly = 0) { books.update(any()) }
    }

    @Test
    fun `update of an unknown book throws NotFoundException`() = runBlocking {
        val id = BookId.new()
        coEvery { books.findById(id) } returns null

        assertFailsWith<NotFoundException> { service.update(id, BookPatch(title = Title("x"))) }

        coVerify(exactly = 0) { books.update(any()) }
    }

    @Test
    fun `update throws NotFoundException when the repository reports the book is gone`() = runBlocking {
        // findById still sees the row, but a concurrent delete wins the race before update() commits.
        val id = BookId.new()
        coEvery { books.findById(id) } returns book("Some Title", id = id)
        coEvery { books.update(any()) } returns false

        val exception = assertFailsWith<NotFoundException> { service.update(id, BookPatch(title = Title("Renamed"))) }

        assertEquals(id.toString(), exception.id)
    }

    @Test
    fun `delete delegates to the repository and ignores the count`() = runBlocking {
        val idA = BookId.new()
        val idB = BookId.new()
        coEvery { books.deleteById(idA) } returns 0
        coEvery { books.deleteById(idB) } returns 1

        service.delete(idA)
        service.delete(idB)

        coVerify { books.deleteById(idA) }
        coVerify { books.deleteById(idB) }
    }

    @Test
    fun `list without a search term or filters asks the repository for the page`() = runBlocking {
        val request = PageRequest(PageNumber(2), PageSize(10))
        val page = Page(listOf(book("Listed")), request.page, request.size, totalItems = 11)
        coEvery { books.findPage(request) } returns page

        val result = service.list(request, null, BookFilters.NONE)

        assertEquals(page, result)
        coVerify { books.findPage(request) }
        confirmVerified(books)
    }

    @Test
    fun `list with a search term asks the repository to search`() = runBlocking {
        val request = PageRequest(PageNumber(2), PageSize(10))
        val term = SearchTerm("dune")
        val page = Page(listOf(book("Dune")), request.page, request.size, totalItems = 1)
        coEvery { books.search(term, BookFilters.NONE, request) } returns page

        val result = service.list(request, term, BookFilters.NONE)

        assertEquals(page, result)
        coVerify(exactly = 0) { books.findPage(any()) }
    }

    @Test
    fun `list with filters but no search term takes the search branch`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val filters = BookFilters(ownership = setOf(BookOwnership.OWNED))
        val page = Page(listOf(book("Owned Book")), request.page, request.size, totalItems = 1)
        coEvery { books.search(null, filters, request) } returns page

        val result = service.list(request, null, filters)

        assertEquals(page, result)
        coVerify(exactly = 0) { books.findPage(any()) }
    }

    @Test
    fun `list with only a missing filter takes the search branch`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val filters = BookFilters(missing = setOf(BookMissingField.DESCRIPTION))
        val page = Page(listOf(book("Incomplete Book")), request.page, request.size, totalItems = 1)
        coEvery { books.search(null, filters, request) } returns page

        val result = service.list(request, null, filters)

        assertEquals(page, result)
        coVerify(exactly = 0) { books.findPage(any()) }
    }

    @Test
    fun `list with both a search term and filters passes both to the repository`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val term = SearchTerm("dune")
        val filters = BookFilters(progress = setOf(BookProgress.READING))
        val page = Page(listOf(book("Dune")), request.page, request.size, totalItems = 1)
        coEvery { books.search(term, filters, request) } returns page

        val result = service.list(request, term, filters)

        assertEquals(page, result)
        coVerify { books.search(term, filters, request) }
    }

    @Test
    fun `listTypes returns the repository result unchanged`() = runBlocking {
        val all = listOf(BookTypes.AUDIBLE, BookTypes.HARDCOVER, BookTypes.KINDLE, BookTypes.PAPERBACK)
        coEvery { types.findAll() } returns all

        assertEquals(all, service.listTypes())
    }

    @Test
    fun `meta composes enum order label order and newest-first years from an unordered repository answer`() =
        runBlocking {
            val labelOrdered = listOf(BookTypes.AUDIBLE, BookTypes.HARDCOVER, BookTypes.KINDLE, BookTypes.PAPERBACK)
            coEvery { types.findAll() } returns labelOrdered
            val used = BookFilters(
                typeIds = setOf(BookTypes.PAPERBACK.id, BookTypes.HARDCOVER.id),
                ownership = setOf(BookOwnership.OWNED, BookOwnership.WATCHLIST),
                progress = setOf(BookProgress.FINISHED, BookProgress.ABANDONED, BookProgress.READING),
                releaseYears = setOf(ReleaseYear(2020), ReleaseYear(1998), ReleaseYear(2010)),
            )
            coEvery { books.findUsedFilterValues() } returns used

            val result = service.meta()

            assertEquals(listOf(BookTypes.HARDCOVER, BookTypes.PAPERBACK), result.types)
            assertEquals(listOf(BookOwnership.WATCHLIST, BookOwnership.OWNED), result.ownership)
            assertEquals(listOf(BookProgress.ABANDONED, BookProgress.READING, BookProgress.FINISHED), result.progress)
            assertEquals(listOf(ReleaseYear(2020), ReleaseYear(2010), ReleaseYear(1998)), result.releaseYears)
        }
}
