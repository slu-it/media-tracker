package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import io.ktor.server.application.ApplicationCall

/** The most repetitions any one repeatable filter query parameter accepts; see [queryValues]. */
const val MAX_FILTER_VALUES = 50

/**
 * Reads a repeatable query parameter: blank repetitions are dropped, an absent parameter yields an empty list,
 * and more than [MAX_FILTER_VALUES] repetitions raise [InvalidValueException] before any parsing, so an
 * excessive query string cannot build an oversized IN list.
 */
fun ApplicationCall.queryValues(name: String): List<String> {
    val values = request.queryParameters.getAll(name)?.filter { it.isNotBlank() } ?: emptyList()
    requireValid(name, values.size <= MAX_FILTER_VALUES) { "must have at most $MAX_FILTER_VALUES values" }
    return values
}

/**
 * Reads a single boolean query parameter; "true"/"false" only, anything else raises [InvalidValueException].
 * A blank value (an empty `?rated=`) means absent, like a blank `?search=` or a blank filter repetition.
 */
fun ApplicationCall.booleanQueryParameter(name: String): Boolean? =
    request.queryParameters[name]?.takeIf { it.isNotBlank() }?.let {
        it.toBooleanStrictOrNull() ?: throw InvalidValueException(name, "must be true or false")
    }
