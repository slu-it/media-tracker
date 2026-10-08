package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.Book
import de.sluit.mediatracker.books.domain.BookAuthorService
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookNarratorService
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesService
import de.sluit.mediatracker.books.domain.BookService
import de.sluit.mediatracker.common.api.intQueryParameter
import de.sluit.mediatracker.common.api.pageRequest
import de.sluit.mediatracker.common.api.searchTerm
import de.sluit.mediatracker.common.api.toResponse
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/**
 * /api/books. Mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes].
 * Handlers only translate HTTP <-> domain and delegate to [BookService]; they never touch persistence. The
 * author, narrator and series vocabularies (`/book-authors`, `/book-narrators`, `/book-series`) are book-independent and mounted at the top level.
 */
fun Route.bookRoutes(
    bookService: BookService,
    bookAuthorService: BookAuthorService,
    bookNarratorService: BookNarratorService,
    bookSeriesService: BookSeriesService,
) {
    route("/books") {
        post {
            val book = bookService.create(call.receive<CreateBookRequest>().toNewBook())
            call.response.header(HttpHeaders.Location, "/api/books/${book.id}")
            call.respond(HttpStatusCode.Created, book.toResponse())
        }
        // Ordered by title, id; with `?search=` titles starting with the term first, then by title relevance.
        // `?typeIds=`/`?ownership=`/`?progress=`/`?releaseYear=` (each repeatable) narrow the listing further
        // and take the same branch as a search.
        get {
            call.respond(
                bookService.list(call.pageRequest(), call.searchTerm(), call.bookFilters())
                    .toResponse(Book::toResponse),
            )
        }
        route("/{id}") {
            patch {
                val id = call.bookId()
                val book = bookService.update(id, call.receive<UpdateBookRequest>().toPatch())
                call.respond(book.toResponse())
            }
            delete {
                bookService.delete(call.bookId())
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
    route("/book-types") {
        get {
            call.respond(bookService.listTypes().map { it.toResponse() })
        }
    }
    route("/books.meta") {
        get {
            call.respond(bookService.meta().toResponse())
        }
    }
    route("/book-authors") {
        get {
            val term = call.searchTerm()
            val limit = call.intQueryParameter(VocabularySearchLimit.FIELD)?.let(::VocabularySearchLimit)
                ?: VocabularySearchLimit.DEFAULT
            call.respond(bookAuthorService.search(term, limit).map { it.toResponse() })
        }
        post {
            val request = call.receive<CreateBookAuthorRequest>()
            val result = bookAuthorService.create(VocabularyName.parse(request.name))
            val status = if (result.created) HttpStatusCode.Created else HttpStatusCode.OK
            call.respond(status, result.entry.toResponse())
        }
    }
    route("/book-narrators") {
        get {
            val term = call.searchTerm()
            val limit = call.intQueryParameter(VocabularySearchLimit.FIELD)?.let(::VocabularySearchLimit)
                ?: VocabularySearchLimit.DEFAULT
            call.respond(bookNarratorService.search(term, limit).map { it.toResponse() })
        }
        post {
            val request = call.receive<CreateBookNarratorRequest>()
            val result = bookNarratorService.create(VocabularyName.parse(request.name))
            val status = if (result.created) HttpStatusCode.Created else HttpStatusCode.OK
            call.respond(status, result.entry.toResponse())
        }
    }
    route("/book-series") {
        get {
            val term = call.searchTerm()
            val limit = call.intQueryParameter(VocabularySearchLimit.FIELD)?.let(::VocabularySearchLimit)
                ?: VocabularySearchLimit.DEFAULT
            call.respond(bookSeriesService.search(term, limit).map { it.toResponse() })
        }
        post {
            val request = call.receive<CreateBookSeriesRequest>()
            val result = bookSeriesService.create(VocabularyName.parse(request.name))
            val status = if (result.created) HttpStatusCode.Created else HttpStatusCode.OK
            call.respond(status, result.entry.toResponse())
        }
        route("/{id}") {
            // Unpaged; ordered by position (unnumbered last), title, id. Unknown series is a 404.
            get("/books") {
                call.respond(bookService.listBySeries(call.bookSeriesId()).map { it.toResponse() })
            }
        }
    }
    route("/book-series.summaries") {
        get {
            call.respond(bookSeriesService.summaries().map { it.toResponse() })
        }
    }
}

internal fun ApplicationCall.bookId(): BookId =
    BookId.parse(parameters["id"] ?: throw InvalidValueException(BookId.FIELD, "is missing"))

private fun ApplicationCall.bookSeriesId(): BookSeriesId =
    BookSeriesId.parse(parameters["id"] ?: throw InvalidValueException(BookSeriesId.FIELD, "is missing"))
