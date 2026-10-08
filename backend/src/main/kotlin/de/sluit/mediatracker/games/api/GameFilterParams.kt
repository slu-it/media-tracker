package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.MAX_FILTER_VALUES
import de.sluit.mediatracker.common.api.booleanQueryParameter
import de.sluit.mediatracker.common.api.queryValues
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameSort
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import io.ktor.server.application.ApplicationCall

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
    releaseYears = queryValues(ReleaseYear.FIELD).map(ReleaseYear::parse).toSet(),
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
