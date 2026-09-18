package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import io.ktor.server.application.ApplicationCall

/** Reads `?page=` and `?pageSize=` (both optional) into a validated [PageRequest]. */
fun ApplicationCall.pageRequest(): PageRequest = PageRequest(
    page = intQueryParameter(PageNumber.FIELD)?.let(::PageNumber) ?: PageNumber.FIRST,
    size = intQueryParameter(PageSize.FIELD)?.let(::PageSize) ?: PageSize.DEFAULT,
)

private fun ApplicationCall.intQueryParameter(name: String): Int? = request.queryParameters[name]?.let {
    it.toIntOrNull() ?: throw InvalidValueException(name, "must be an integer")
}

fun <T, R> Page<T>.toResponse(transform: (T) -> R): PageResponse<R> = PageResponse(
    items = items.map(transform),
    page = page.value,
    pageSize = size.value,
    totalItems = totalItems,
    totalPages = totalPages,
)
