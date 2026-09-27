package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameSort
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.ktor.server.application.ApplicationCall

/** The most repetitions any one filter category accepts; see [ApplicationCall.gameFilters]. */
const val MAX_FILTER_VALUES = 50

/**
 * Reads the four repeatable `?platformIds=`, `?ownership=`, `?progress=` and `?releaseYear=` query parameters,
 * plus the single `?rated=` one (MT-026), into a validated [GameFilters]. Each repeatable one is optional and,
 * when present, ORs its repeated values; blank repetitions are dropped and an absent parameter means no filter
 * on that category. `?rated=` is a plain boolean instead: `true` narrows the listing to games that have a
 * rating, `false`, a blank value or an absent parameter means no filter on it. A bad value raises
 * [InvalidValueException] through the same parsers the request bodies use ([GamePlatformId.parse],
 * [Ownership.from], [Progress.from]), naming the field it came from, exactly like a bad `?page=` in
 * `common/api/Paging.kt`. Each repeatable category is capped at [MAX_FILTER_VALUES] repetitions before parsing,
 * the same way `SearchTerm.MAX_LENGTH` bounds the search term, so an excessive query string cannot build an
 * oversized IN list or waste time parsing thousands of values.
 */
fun ApplicationCall.gameFilters(): GameFilters = GameFilters(
    platformIds = queryValues(GamePlatformId.FIELD).map(GamePlatformId::parse).toSet(),
    ownership = queryValues(Ownership.FIELD).map(Ownership::from).toSet(),
    progress = queryValues(Progress.FIELD).map(Progress::from).toSet(),
    releaseYears = queryValues(ReleaseYear.FIELD).map(::parseReleaseYear).toSet(),
    ratedOnly = booleanQueryParameter(GameFilters.RATED_FIELD) ?: false,
)

/**
 * Reads the single `?sort=` query parameter (MT-026) into a validated [GameSort]; an absent or blank value means
 * [GameSort.DEFAULT]. Like `?page=`/`?pageSize=` in `common/api/Paging.kt`, a repeated `sort` parameter silently
 * keeps only the first value rather than erroring: [ApplicationCall.request]'s `queryParameters[name]` access
 * already behaves that way everywhere else in this file, and there is no reason to single `sort` out for
 * stricter treatment.
 */
fun ApplicationCall.gameSort(): GameSort =
    request.queryParameters[GameSort.FIELD]?.takeIf { it.isNotBlank() }?.let(GameSort::from) ?: GameSort.DEFAULT

private fun ApplicationCall.queryValues(name: String): List<String> {
    val values = request.queryParameters.getAll(name)?.filter { it.isNotBlank() } ?: emptyList()
    requireValid(name, values.size <= MAX_FILTER_VALUES) { "must have at most $MAX_FILTER_VALUES values" }
    return values
}

/**
 * Reads a single boolean query parameter; "true"/"false" only, anything else raises [InvalidValueException].
 * A blank value (an empty `?rated=`) means absent, like a blank `?search=` or a blank filter repetition.
 */
private fun ApplicationCall.booleanQueryParameter(name: String): Boolean? =
    request.queryParameters[name]?.takeIf { it.isNotBlank() }?.let {
        it.toBooleanStrictOrNull() ?: throw InvalidValueException(name, "must be true or false")
    }

internal fun parseReleaseYear(raw: String): ReleaseYear =
    ReleaseYear(raw.toIntOrNull() ?: throw InvalidValueException(ReleaseYear.FIELD, "must be an integer"))
