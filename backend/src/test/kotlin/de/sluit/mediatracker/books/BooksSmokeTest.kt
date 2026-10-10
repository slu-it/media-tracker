package de.sluit.mediatracker.books

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.books.api.BookAuthorResponse
import de.sluit.mediatracker.books.api.BookAuthorSummaryResponse
import de.sluit.mediatracker.books.api.BookMetaResponse
import de.sluit.mediatracker.books.api.BookNarratorResponse
import de.sluit.mediatracker.books.api.BookResponse
import de.sluit.mediatracker.books.api.BookSeriesResponse
import de.sluit.mediatracker.books.api.BookSeriesSummaryResponse
import de.sluit.mediatracker.books.api.BookTitleSuggestionsResponse
import de.sluit.mediatracker.books.api.BookTypeResponse
import de.sluit.mediatracker.books.persistence.BookAuthorsTable
import de.sluit.mediatracker.books.persistence.BookNarratorsTable
import de.sluit.mediatracker.books.persistence.BookSeriesTable
import de.sluit.mediatracker.books.persistence.BooksTable
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAs
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.jetbrains.exposed.v1.jdbc.deleteAll
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Smoke tests for the books domain: the real `module()` on the Testcontainers MariaDB shared by the test JVM
 * ([appWithUser]), a real login, real SQL; happy paths only, at least one valid request per operation. Everything
 * negative lives in [de.sluit.mediatracker.books.api.BookRoutesTest]. There is no GET by id; persistence is
 * verified through GET /api/books.
 */
class BooksSmokeTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(): HttpClient {
        val client = appWithUser("alice", "wonderland-1") {
            // Books first: the junction rows cascade, and authors, narrators and series are RESTRICTed while a junction row exists.
            BooksTable.deleteAll()
            BookAuthorsTable.deleteAll()
            BookNarratorsTable.deleteAll()
            BookSeriesTable.deleteAll()
        }
        client.loginAs("alice", "wonderland-1")
        return client
    }

    private suspend fun HttpClient.createBook(body: String): HttpResponse = post("/api/books") { jsonBody(body) }

    private suspend fun HttpClient.createdAuthor(name: String): BookAuthorResponse =
        post("/api/book-authors") { jsonBody("""{"name":"$name"}""") }.decodeBody()

    private suspend fun HttpClient.createdNarrator(name: String): BookNarratorResponse =
        post("/api/book-narrators") { jsonBody("""{"name":"$name"}""") }.decodeBody()

    private suspend fun HttpClient.createdSeries(name: String): BookSeriesResponse =
        post("/api/book-series") { jsonBody("""{"name":"$name"}""") }.decodeBody()

    @Test
    fun `create with narrators and series stores them and a patch replaces and clears the series`() = testApplication {
        val client = loggedInClient()
        val narrator = client.createdNarrator("Michael Kramer")
        val mistborn = client.createdSeries("Mistborn")
        val cosmere = client.createdSeries("The Cosmere")

        val created = client.createBook(
            """{"title":"The Final Empire","releaseYear":2006,"narratorIds":["${narrator.id}"],
                    |"series":[{"seriesId":"${cosmere.id}"},{"seriesId":"${mistborn.id}","position":1}]}
            """.trimMargin(),
        ).decodeBody<BookResponse>()

        assertEquals(listOf("Michael Kramer"), created.narrators.map { it.name })
        assertEquals(listOf("Mistborn", "The Cosmere"), created.series.map { it.name })
        assertEquals(listOf(1.0, null), created.series.map { it.position })

        val patched = client.patch("/api/books/${created.id}") {
            jsonBody("""{"series":[{"seriesId":"${mistborn.id}","position":2.5}]}""")
        }.decodeBody<BookResponse>()
        assertEquals(listOf(2.5), patched.series.map { it.position })
        assertEquals(listOf("Michael Kramer"), patched.narrators.map { it.name })

        val cleared = client.patch("/api/books/${created.id}") {
            jsonBody("""{"narratorIds":[],"series":[]}""")
        }.decodeBody<BookResponse>()
        assertEquals(emptyList(), cleared.narrators)
        assertEquals(emptyList(), cleared.series)
    }

    @Test
    fun `author summaries and author books list counts and books in release order`() = testApplication {
        val client = loggedInClient()
        val herbert = client.createdAuthor("Frank Herbert")
        val empty = client.createdAuthor("Another Author")
        listOf("Later" to 2010, "Earlier" to 2005).forEach { (title, year) ->
            client.createBook("""{"title":"$title","releaseYear":$year,"authorIds":["${herbert.id}"]}""")
        }

        val summaries = client.get("/api/book-authors.summaries").decodeBody<List<BookAuthorSummaryResponse>>()
        val books = client.get("/api/book-authors/${herbert.id}/books").decodeBody<List<BookResponse>>()
        val noBooks = client.get("/api/book-authors/${empty.id}/books").decodeBody<List<BookResponse>>()

        assertEquals(listOf("Another Author" to 0, "Frank Herbert" to 2), summaries.map { it.name to it.bookCount })
        assertEquals(listOf("Earlier", "Later"), books.map { it.title })
        assertEquals(emptyList(), noBooks)
    }

    @Test
    fun `series summaries and series books list counts and books in series order`() = testApplication {
        val client = loggedInClient()
        val mistborn = client.createdSeries("Mistborn")
        val empty = client.createdSeries("Another Series")
        listOf("Unnumbered" to null, "Second" to 2, "First" to 1).forEach { (title, position) ->
            val link = """{"seriesId":"${mistborn.id}"${position?.let { ""","position":$it""" }.orEmpty()}}"""
            client.createBook("""{"title":"$title","releaseYear":2006,"series":[$link]}""")
        }

        val summaries = client.get("/api/book-series.summaries").decodeBody<List<BookSeriesSummaryResponse>>()
        val books = client.get("/api/book-series/${mistborn.id}/books").decodeBody<List<BookResponse>>()
        val noBooks = client.get("/api/book-series/${empty.id}/books").decodeBody<List<BookResponse>>()

        assertEquals(listOf("Another Series" to 0, "Mistborn" to 3), summaries.map { it.name to it.bookCount })
        assertEquals(listOf("First", "Second", "Unnumbered"), books.map { it.title })
        assertEquals(emptyList(), noBooks)
    }

    @Test
    fun `book-narrators and book-series search by prefix and create is idempotent`() = testApplication {
        val client = loggedInClient()

        val first = client.post("/api/book-series") { jsonBody("""{"name":"Mistborn"}""") }
        val second = client.post("/api/book-series") { jsonBody("""{"name":"mistborn"}""") }
        val foundSeries = client.get("/api/book-series?search=mist").decodeBody<List<BookSeriesResponse>>()
        client.post("/api/book-narrators") { jsonBody("""{"name":"Michael Kramer"}""") }
        val foundNarrators = client.get("/api/book-narrators?search=mich").decodeBody<List<BookNarratorResponse>>()

        assertEquals(HttpStatusCode.Created, first.status)
        assertEquals(HttpStatusCode.OK, second.status)
        assertEquals(listOf("Mistborn"), foundSeries.map { it.name })
        assertEquals(listOf("Michael Kramer"), foundNarrators.map { it.name })
    }

    @Test
    fun `create with all fields returns the stored book with sorted types and authors`() = testApplication {
        val client = loggedInClient()
        val author = client.createdAuthor("Frank Herbert")

        val created = client.createBook(
            """{"title":"Dune","releaseYear":1965,"description":"Spice.","coverImageUrl":"https://img.example/d.png",
                |"ownership":"owned","progress":"reading",
                |"typeIds":["${SeededBookTypes.KINDLE}","${SeededBookTypes.HARDCOVER}"],"authorIds":["${author.id}"]}
            """.trimMargin(),
        )

        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val book = created.decodeBody<BookResponse>()
        assertEquals("/api/books/${book.id}", created.headers["Location"])
        assertEquals(listOf("Hardcover", "Kindle"), book.types.map { it.label })
        assertEquals(listOf("Frank Herbert"), book.authors.map { it.name })
        assertEquals("owned", book.ownership)
        assertEquals("reading", book.progress)
        assertEquals(1965, book.releaseYear)
    }

    @Test
    fun `create without optional fields stores defaults nulls and no types`() = testApplication {
        val client = loggedInClient()

        val book = client.createBook("""{"title":"Emma","releaseYear":1815}""").decodeBody<BookResponse>()

        assertNull(book.description)
        assertNull(book.coverImageUrl)
        assertNull(book.releaseDate)
        assertEquals("watchlist", book.ownership)
        assertEquals("not_started", book.progress)
        assertEquals(emptyList(), book.types)
        assertEquals(emptyList(), book.authors)
    }

    @Test
    fun `create with a release date only derives the year`() = testApplication {
        val client = loggedInClient()

        val book = client.createBook("""{"title":"Dune","releaseDate":"1965-08-01"}""").decodeBody<BookResponse>()

        assertEquals(1965, book.releaseYear)
        assertEquals("1965-08-01", book.releaseDate)
    }

    @Test
    fun `book-types lists the four seeded types sorted by label`() = testApplication {
        val client = loggedInClient()

        val types = client.get("/api/book-types").decodeBody<List<BookTypeResponse>>()

        assertEquals(listOf("Audible", "Hardcover", "Kindle", "Paperback"), types.map { it.label })
        assertEquals(SeededBookTypes.KINDLE, types.first { it.label == "Kindle" }.id)
        assertEquals("1A73B5", types.first { it.label == "Kindle" }.associatedColor)
    }

    @Test
    fun `book-authors search finds an author by prefix and create is idempotent`() = testApplication {
        val client = loggedInClient()

        val first = client.post("/api/book-authors") { jsonBody("""{"name":"Ursula K. Le Guin"}""") }
        val second = client.post("/api/book-authors") { jsonBody("""{"name":"ursula k. le guin"}""") }
        val found = client.get("/api/book-authors?search=urs").decodeBody<List<BookAuthorResponse>>()

        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        assertEquals(HttpStatusCode.OK, second.status, second.bodyAsText())
        assertEquals(first.decodeBody<BookAuthorResponse>().id, second.decodeBody<BookAuthorResponse>().id)
        assertEquals(listOf("Ursula K. Le Guin"), found.map { it.name })
    }

    @Test
    fun `list returns the books ordered by title with the paging totals`() = testApplication {
        val client = loggedInClient()
        client.createBook("""{"title":"Emma","releaseYear":1815}""")
        client.createBook("""{"title":"Dune","releaseYear":1965}""")

        val page = client.get("/api/books").decodeBody<PageResponse<BookResponse>>()

        assertEquals(listOf("Dune", "Emma"), page.items.map { it.title })
        assertEquals(2, page.totalItems)
        assertEquals(1, page.totalPages)
    }

    @Test
    fun `list with a search term and filters narrows the result`() = testApplication {
        val client = loggedInClient()
        client.createBook("""{"title":"Dune","releaseYear":1965,"ownership":"owned","progress":"reading"}""")
        client.createBook("""{"title":"Dune Messiah","releaseYear":1969}""")
        client.createBook("""{"title":"Emma","releaseYear":1815,"ownership":"owned"}""")

        val matches = client.get("/api/books?search=dune&ownership=owned&progress=reading&releaseYear=1965")
            .decodeBody<PageResponse<BookResponse>>()
        val byType = client.get("/api/books?typeIds=${SeededBookTypes.KINDLE}")
            .decodeBody<PageResponse<BookResponse>>()

        assertEquals(listOf("Dune"), matches.items.map { it.title })
        assertEquals(emptyList(), byType.items)
    }

    @Test
    fun `patch changes fields and the change is visible in the list`() = testApplication {
        val client = loggedInClient()
        val author = client.createdAuthor("Frank Herbert")
        val book = client.createBook("""{"title":"Dune","releaseYear":1965,"description":"Old"}""")
            .decodeBody<BookResponse>()

        val patched = client.patch("/api/books/${book.id}") {
            jsonBody(
                """{"title":"Dune!","description":null,"progress":"finished",
                    |"typeIds":["${SeededBookTypes.PAPERBACK}"],"authorIds":["${author.id}"]}
                """.trimMargin(),
            )
        }

        assertEquals(HttpStatusCode.OK, patched.status, patched.bodyAsText())
        val listed = client.get("/api/books").decodeBody<PageResponse<BookResponse>>().items.single()
        assertEquals("Dune!", listed.title)
        assertNull(listed.description)
        assertEquals("finished", listed.progress)
        assertEquals(listOf("Paperback"), listed.types.map { it.label })
        assertEquals(listOf("Frank Herbert"), listed.authors.map { it.name })
    }

    @Test
    fun `patch with empty type and author lists clears them`() = testApplication {
        val client = loggedInClient()
        val author = client.createdAuthor("Frank Herbert")
        val book = client.createBook(
            """{"title":"Dune","releaseYear":1965,"typeIds":["${SeededBookTypes.KINDLE}"],"authorIds":["${author.id}"]}""",
        ).decodeBody<BookResponse>()

        client.patch("/api/books/${book.id}") { jsonBody("""{"typeIds":[],"authorIds":[]}""") }

        val listed = client.get("/api/books").decodeBody<PageResponse<BookResponse>>().items.single()
        assertEquals(emptyList(), listed.types)
        assertEquals(emptyList(), listed.authors)
    }

    @Test
    fun `delete removes the book from the list`() = testApplication {
        val client = loggedInClient()
        val book = client.createBook("""{"title":"Dune","releaseYear":1965}""").decodeBody<BookResponse>()

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/books/${book.id}").status)

        assertEquals(0, client.get("/api/books").decodeBody<PageResponse<BookResponse>>().totalItems)
    }

    @Test
    fun `books meta lists only the filter values actually in use`() = testApplication {
        val client = loggedInClient()
        client.createBook(
            """{"title":"Dune","releaseYear":1965,"ownership":"owned","progress":"reading",
                |"typeIds":["${SeededBookTypes.KINDLE}"]}
            """.trimMargin(),
        )

        val meta = client.get("/api/books.meta").decodeBody<BookMetaResponse>()

        assertEquals(listOf("Kindle"), meta.types.map { it.label })
        assertEquals(listOf("owned"), meta.ownership)
        assertEquals(listOf("reading"), meta.progress)
        assertEquals(listOf(1965), meta.releaseYears)
    }

    @Test
    fun `title suggestions degrade to an empty list when the providers are unreachable`() = testApplication {
        val client = loggedInClient()

        val book = client.get("/api/books/title-suggestions?query=Hobbit")
        val audiobook = client.get("/api/books/title-suggestions?query=Hobbit&source=audiobook")

        assertEquals(HttpStatusCode.OK, book.status, book.bodyAsText())
        assertEquals(emptyList(), book.decodeBody<BookTitleSuggestionsResponse>().suggestions)
        assertEquals(HttpStatusCode.OK, audiobook.status, audiobook.bodyAsText())
        assertEquals(emptyList(), audiobook.decodeBody<BookTitleSuggestionsResponse>().suggestions)
    }

    @Test
    fun `cover options are 502 with the provider's error code when it is unreachable`() = testApplication {
        val client = loggedInClient()

        val book = client.get("/api/books/cover-options?query=Hobbit")
        val audiobook = client.get("/api/books/cover-options?query=Hobbit&source=audiobook")

        assertEquals(HttpStatusCode.BadGateway, book.status, book.bodyAsText())
        assertEquals("open_library_error", book.decodeBody<ErrorResponse>().error)
        assertEquals(HttpStatusCode.BadGateway, audiobook.status, audiobook.bodyAsText())
        assertEquals("audible_error", audiobook.decodeBody<ErrorResponse>().error)
    }
}
