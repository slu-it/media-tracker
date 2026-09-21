package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.ktor.server.application.ApplicationCall

/** The most repetitions any one filter category accepts; see [ApplicationCall.gameFilters]. */
const val MAX_FILTER_VALUES = 50

/**
 * Reads the four repeatable `?platformIds=`, `?ownership=`, `?progress=` and `?releaseYear=` query parameters
 * into a validated [GameFilters]. Each is optional and, when present, ORs its repeated values; blank repetitions
 * are dropped and an absent parameter means no filter on that category. A bad value raises
 * [InvalidValueException] through the same parsers the request bodies use ([GamePlatformId.parse],
 * [Ownership.from], [Progress.from]), naming the field it came from, exactly like a bad `?page=` in
 * `common/api/Paging.kt`. Each category is capped at [MAX_FILTER_VALUES] repetitions before parsing, the same
 * way `SearchTerm.MAX_LENGTH` bounds the search term, so an excessive query string cannot build an oversized IN
 * list or waste time parsing thousands of values.
 */
fun ApplicationCall.gameFilters(): GameFilters = GameFilters(
    platformIds = queryValues(GamePlatformId.FIELD).map(GamePlatformId::parse).toSet(),
    ownership = queryValues(Ownership.FIELD).map(Ownership::from).toSet(),
    progress = queryValues(Progress.FIELD).map(Progress::from).toSet(),
    releaseYears = queryValues(ReleaseYear.FIELD).map(::parseReleaseYear).toSet(),
)

private fun ApplicationCall.queryValues(name: String): List<String> {
    val values = request.queryParameters.getAll(name)?.filter { it.isNotBlank() } ?: emptyList()
    requireValid(name, values.size <= MAX_FILTER_VALUES) { "must have at most $MAX_FILTER_VALUES values" }
    return values
}

private fun parseReleaseYear(raw: String): ReleaseYear =
    ReleaseYear(raw.toIntOrNull() ?: throw InvalidValueException(ReleaseYear.FIELD, "must be an integer"))
