package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.SearchTerm
import io.ktor.server.application.ApplicationCall

/**
 * Reads `?search=` into a validated [SearchTerm]; absent or blank means no search. Validation errors name the
 * `search` field.
 */
fun ApplicationCall.searchTerm(): SearchTerm? = SearchTerm.parseOrNull(request.queryParameters[SearchTerm.FIELD])
