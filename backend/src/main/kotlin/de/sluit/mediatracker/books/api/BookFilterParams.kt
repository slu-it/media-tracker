package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookSort
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.common.api.MAX_FILTER_VALUES
import de.sluit.mediatracker.common.api.queryValues
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseYear
import io.ktor.server.application.ApplicationCall

/**
 * Reads the four repeatable `?typeIds=`, `?ownership=`, `?progress=` and `?releaseYear=` query parameters into
 * a validated [BookFilters]. Each is optional and, when present, ORs its repeated values; blank repetitions are
 * dropped and an absent parameter means no filter on that category. A bad value raises [InvalidValueException]
 * through the same parsers the request bodies use, naming the field it came from. Each category is capped at
 * [MAX_FILTER_VALUES] repetitions before parsing. The MCP-only `hasMissing` filter is not read from REST.
 */
fun ApplicationCall.bookFilters(): BookFilters = BookFilters(
    typeIds = queryValues(BookTypeId.FIELD).map(BookTypeId::parse).toSet(),
    ownership = queryValues(BookOwnership.FIELD).map(BookOwnership::from).toSet(),
    progress = queryValues(BookProgress.FIELD).map(BookProgress::from).toSet(),
    releaseYears = queryValues(ReleaseYear.FIELD).map(ReleaseYear::parse).toSet(),
)

/**
 * Reads the single `?sort=` query parameter into a validated [BookSort]; an absent or blank value means
 * [BookSort.DEFAULT]. Like `?page=`/`?pageSize=` in `common/api/Paging.kt`, a repeated `sort` parameter silently
 * keeps only the first value rather than erroring.
 */
fun ApplicationCall.bookSort(): BookSort =
    request.queryParameters[BookSort.FIELD]?.takeIf { it.isNotBlank() }?.let(BookSort::from) ?: BookSort.DEFAULT
