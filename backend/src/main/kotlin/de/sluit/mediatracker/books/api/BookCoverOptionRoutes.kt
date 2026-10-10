package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.BookCoverOptionsService
import de.sluit.mediatracker.books.domain.BookCoverSourceKind
import de.sluit.mediatracker.books.domain.BookWorkId
import de.sluit.mediatracker.common.api.intQueryParameter
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/**
 * `/cover-options` and `/title-suggestions`, mounted directly under `/books` by [bookRoutes] (before `/{id}`).
 * `?query=` (required) is the search term, `?releaseYear=` breaks ties between exact title matches, `?source=`
 * selects `book` (default, Open Library) or `audiobook` (Audible), `?match=` picks an Open Library work instead of
 * the ranked one (rejected for audiobooks) and `?page=` selects a 1-based page of covers. `/title-suggestions` only
 * takes `?query=` and `?source=` and never fails on upstream errors: it answers `200 { suggestions: [] }`.
 * Handlers only translate HTTP <-> domain and delegate to [BookCoverOptionsService].
 */
fun Route.bookCoverOptionRoutes(service: BookCoverOptionsService) {
    get("/cover-options") {
        val query = call.coverQuery()
        val releaseYear = call.coverReleaseYear()
        val source = call.coverSource()
        val match = call.coverMatch()
        val page = call.coverPage()
        call.respond(service.find(query, releaseYear, source, match, page).toResponse())
    }

    get("/title-suggestions") {
        val query = call.coverQuery()
        val source = call.coverSource()
        call.respond(BookTitleSuggestionsResponse(service.suggestTitles(query, source).map { it.toResponse() }))
    }
}

private const val QUERY_FIELD = "query"

private fun ApplicationCall.coverQuery(): SearchTerm =
    SearchTerm.parseOrNull(request.queryParameters[QUERY_FIELD], field = QUERY_FIELD)
        ?: throw InvalidValueException(QUERY_FIELD, "must not be blank")

private fun ApplicationCall.coverReleaseYear(): ReleaseYear? =
    request.queryParameters[ReleaseYear.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(ReleaseYear::parse)

private fun ApplicationCall.coverSource(): BookCoverSourceKind =
    request.queryParameters[BookCoverSourceKind.FIELD]?.trim()?.takeIf { it.isNotEmpty() }
        ?.let(BookCoverSourceKind::from)
        ?: BookCoverSourceKind.DEFAULT

private fun ApplicationCall.coverMatch(): BookWorkId? =
    request.queryParameters[BookWorkId.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(BookWorkId::parse)

private fun ApplicationCall.coverPage(): PageNumber =
    intQueryParameter(PageNumber.FIELD)?.let(::PageNumber) ?: PageNumber.FIRST
