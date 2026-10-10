package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.confirmVerified
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

/** Mocks only the two ports; ranking and paging logic are real. */
class BookCoverOptionsServiceTest {
    private val works = mockk<BookWorkSource>()
    private val audiobooks = mockk<AudiobookSource>()
    private val service = BookCoverOptionsService(works, audiobooks)

    private val hobbit = SearchTerm("The Hobbit")
    private val size = PageSize(BOOK_COVER_PAGE_SIZE)

    private fun id(n: Int) = BookWorkId("OL${n}W")

    private fun work(name: String, n: Int = 1, year: Int? = null, vararg authors: String, hasCover: Boolean = true) =
        BookWork(id(n), name, authors.toList(), year?.let(::ReleaseYear), hasCover)

    private fun cover(n: Int = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$n.jpg"),
        imageUrl = CoverImageUrl("https://example.org/full-$n.jpg"),
        width = null,
        height = null,
    )

    private fun audiobook(name: String, n: Int = 1, authors: List<String> = listOf("A"), year: Int? = null) = Audiobook(
        asin = "B$n",
        name = name,
        authors = authors,
        narrators = listOf("N"),
        releaseYear = year?.let(::ReleaseYear),
        cover = cover(n),
    )

    private fun coverPage(page: PageNumber, vararg covers: CoverOption) =
        Page(covers.toList(), page, size, covers.size.toLong())

    @Test
    fun `book find ranks the matches and fetches covers of the best one`() = runBlocking {
        val matches = listOf(work("The Hobbit Companion", 1), work("The Hobbit", 2))
        coEvery { works.searchWorks(hobbit) } returns matches
        coEvery { works.findWorkCovers(id(2), PageNumber.FIRST, size) } returns coverPage(PageNumber.FIRST, cover(2))

        val result = service.find(hobbit, null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)

        assertEquals(id(2), result.selectedMatch)
        assertEquals(matches, result.matches)
        assertEquals(listOf(cover(2)), result.covers.items)
        assertEquals(BookCoverSourceKind.BOOK, result.source)
    }

    @Test
    fun `book find prefers works with a cover over an exact title without one`() = runBlocking {
        val matches = listOf(work("The Hobbit Edition", 1), work("Hobbit", 2, hasCover = false))
        val term = SearchTerm("Hobbit")
        coEvery { works.searchWorks(term) } returns matches
        coEvery { works.findWorkCovers(id(1), PageNumber.FIRST, size) } returns coverPage(PageNumber.FIRST, cover(1))

        val result = service.find(term, null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)

        assertEquals(id(1), result.selectedMatch)
    }

    @Test
    fun `book find falls back to all works when none has a cover`() = runBlocking {
        val matches = listOf(work("The Hobbit Edition", 1, hasCover = false), work("Hobbit", 2, hasCover = false))
        val term = SearchTerm("Hobbit")
        coEvery { works.searchWorks(term) } returns matches
        coEvery { works.findWorkCovers(id(2), PageNumber.FIRST, size) } returns coverPage(PageNumber.FIRST)

        val result = service.find(term, null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)

        assertEquals(id(2), result.selectedMatch)
    }

    @Test
    fun `book find uses the release year to break ties`() = runBlocking {
        val matches = listOf(work("The Hobbit", 1, 1937), work("The Hobbit", 2, 1999))
        coEvery { works.searchWorks(hobbit) } returns matches
        coEvery { works.findWorkCovers(id(2), PageNumber.FIRST, size) } returns coverPage(PageNumber.FIRST, cover(2))

        val result = service.find(hobbit, ReleaseYear(1999), BookCoverSourceKind.BOOK, null, PageNumber.FIRST)

        assertEquals(id(2), result.selectedMatch)
    }

    @Test
    fun `an explicit match overrides the ranking but still searches on the first page`() = runBlocking {
        val matches = listOf(work("The Hobbit", 1), work("Other", 2))
        coEvery { works.searchWorks(hobbit) } returns matches
        coEvery { works.findWorkCovers(id(2), PageNumber.FIRST, size) } returns coverPage(PageNumber.FIRST, cover(2))

        val result = service.find(hobbit, null, BookCoverSourceKind.BOOK, id(2), PageNumber.FIRST)

        assertEquals(id(2), result.selectedMatch)
        assertEquals(matches, result.matches)
    }

    @Test
    fun `an explicit match on a later page skips the search`() = runBlocking {
        coEvery { works.findWorkCovers(id(2), PageNumber(2), size) } returns coverPage(PageNumber(2), cover(2))

        val result = service.find(hobbit, null, BookCoverSourceKind.BOOK, id(2), PageNumber(2))

        assertEquals(emptyList(), result.matches)
        assertEquals(id(2), result.selectedMatch)
        coVerify { works.findWorkCovers(id(2), PageNumber(2), size) }
        confirmVerified(works)
    }

    @Test
    fun `book find without matches returns an empty page at the requested number`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns emptyList()

        val result = service.find(hobbit, null, BookCoverSourceKind.BOOK, null, PageNumber(3))

        assertNull(result.selectedMatch)
        assertEquals(0, result.covers.totalItems)
        assertEquals(PageNumber(3), result.covers.page)
        coVerify { works.searchWorks(hobbit) }
        confirmVerified(works)
    }

    @Test
    fun `audiobook find returns the product covers as a flat list without matches`() = runBlocking {
        val products = Page(listOf(audiobook("Der Hobbit", 1), audiobook("Der Hobbit 2", 2)), PageNumber(2), size, 120)
        coEvery { audiobooks.searchAudiobooks(hobbit, PageNumber(2), size) } returns products

        val result = service.find(hobbit, null, BookCoverSourceKind.AUDIOBOOK, null, PageNumber(2))

        assertEquals(emptyList(), result.matches)
        assertNull(result.selectedMatch)
        assertEquals(listOf(cover(1), cover(2)), result.covers.items)
        assertEquals(120, result.covers.totalItems)
        assertEquals(PageNumber(2), result.covers.page)
        confirmVerified(works)
    }

    @Test
    fun `audiobook find with a match is rejected`() {
        runBlocking {
            val e = assertFailsWith<InvalidValueException> {
                service.find(hobbit, null, BookCoverSourceKind.AUDIOBOOK, id(1), PageNumber.FIRST)
            }
            assertEquals(BookWorkId.FIELD, e.field)
            confirmVerified(audiobooks)
        }
    }

    @Test
    fun `findFirstCover for books requests one cover of the best match`() = runBlocking {
        val matches = listOf(work("The Hobbit", 1, 1937, "Tolkien"))
        coEvery { works.searchWorks(hobbit) } returns matches
        coEvery { works.findWorkCovers(id(1), PageNumber.FIRST, PageSize(1)) } returns
            Page(listOf(cover(1)), PageNumber.FIRST, PageSize(1), 1)

        val result = service.findFirstCover(hobbit, null, BookCoverSourceKind.BOOK)

        assertEquals(BookCoverLookup(cover(1), "The Hobbit", listOf("Tolkien"), ReleaseYear(1937)), result)
    }

    @Test
    fun `findFirstCover for books returns null when nothing matches`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns emptyList()

        assertNull(service.findFirstCover(hobbit, null, BookCoverSourceKind.BOOK))
        coVerify { works.searchWorks(hobbit) }
        confirmVerified(works)
    }

    @Test
    fun `findFirstCover for books returns null when the match has no covers`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns listOf(work("The Hobbit", 1))
        coEvery { works.findWorkCovers(id(1), PageNumber.FIRST, PageSize(1)) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(1), 0)

        assertNull(service.findFirstCover(hobbit, null, BookCoverSourceKind.BOOK))
    }

    @Test
    fun `findFirstCover for audiobooks uses the first product`() = runBlocking {
        coEvery { audiobooks.searchAudiobooks(hobbit, PageNumber.FIRST, PageSize(1)) } returns
            Page(listOf(audiobook("Der Hobbit", 1, listOf("Tolkien"), 2012)), PageNumber.FIRST, PageSize(1), 5)

        val result = service.findFirstCover(hobbit, null, BookCoverSourceKind.AUDIOBOOK)

        assertEquals(BookCoverLookup(cover(1), "Der Hobbit", listOf("Tolkien"), ReleaseYear(2012)), result)
    }

    @Test
    fun `findFirstCover for audiobooks returns null without products`() = runBlocking {
        coEvery { audiobooks.searchAudiobooks(hobbit, PageNumber.FIRST, PageSize(1)) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(1), 0)

        assertNull(service.findFirstCover(hobbit, null, BookCoverSourceKind.AUDIOBOOK))
    }

    @Test
    fun `book suggestions carry authors and no narrators`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns listOf(work("The Hobbit", 1, 1937, "Tolkien"))

        val result = service.suggestTitles(hobbit, BookCoverSourceKind.BOOK)

        assertEquals(
            listOf(
                BookTitleSuggestion(
                    "The Hobbit",
                    listOf("Tolkien"),
                    emptyList(),
                    ReleaseYear(1937),
                    BookCoverSourceKind.BOOK,
                ),
            ),
            result,
        )
    }

    @Test
    fun `audiobook suggestions carry narrators`() = runBlocking {
        coEvery { audiobooks.searchAudiobooks(hobbit, PageNumber.FIRST, size) } returns
            Page(listOf(audiobook("Der Hobbit", 1, listOf("Tolkien"), 2012)), PageNumber.FIRST, size, 1)

        val result = service.suggestTitles(hobbit, BookCoverSourceKind.AUDIOBOOK)

        assertEquals(
            listOf(
                BookTitleSuggestion(
                    "Der Hobbit",
                    listOf("Tolkien"),
                    listOf("N"),
                    ReleaseYear(2012),
                    BookCoverSourceKind.AUDIOBOOK,
                ),
            ),
            result,
        )
    }

    @Test
    fun `suggestions are deduplicated by normalised title and first author`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns listOf(
            work("The Hobbit", 1, null, "Tolkien"),
            work("  the  hobbit ", 2, null, "TOLKIEN", "Other"),
            work("The Hobbit", 3, null, "Someone Else"),
        )

        val result = service.suggestTitles(hobbit, BookCoverSourceKind.BOOK)

        assertEquals(listOf("Tolkien", "Someone Else"), result.map { it.authors.first() })
    }

    @Test
    fun `suggestions are capped at the limit`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } returns (1..12).map { work("Hobbit $it", it) }

        val result = service.suggestTitles(hobbit, BookCoverSourceKind.BOOK)

        assertEquals(BookCoverOptionsService.TITLE_SUGGESTION_LIMIT, result.size)
    }

    @Test
    fun `suggestions degrade to an empty list when the book source fails`() = runBlocking {
        coEvery { works.searchWorks(hobbit) } throws ExternalSourceException("open_library", "boom")

        assertEquals(emptyList(), service.suggestTitles(hobbit, BookCoverSourceKind.BOOK))
    }

    @Test
    fun `suggestions degrade to an empty list when the audiobook source fails`() = runBlocking {
        coEvery { audiobooks.searchAudiobooks(hobbit, PageNumber.FIRST, size) } throws
            ExternalSourceException("audible", "boom")

        assertEquals(emptyList(), service.suggestTitles(hobbit, BookCoverSourceKind.AUDIOBOOK))
    }
}
