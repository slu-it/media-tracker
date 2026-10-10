package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.BookCoverOptions
import de.sluit.mediatracker.books.domain.BookTitleSuggestion
import de.sluit.mediatracker.books.domain.BookWork
import de.sluit.mediatracker.common.api.CoverOptionResponse
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.common.api.toCoverResponse
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** One Open Library work found for a search term. */
@Serializable
data class BookCoverMatchResponse(val id: String, val name: String, val authors: List<String>, val releaseYear: Int?)

/** GET /api/books/cover-options */
@Serializable
data class BookCoverOptionsResponse(
    val query: String,
    /** `book` or `audiobook`. */
    val source: String,
    /** Empty on pages after the first when `match` is given, and for audiobooks. */
    val matches: List<BookCoverMatchResponse>,
    val selectedMatchId: String?,
    val covers: PageResponse<CoverOptionResponse>,
)

/** One title suggestion; [narrators] is empty for the `book` source. */
@Serializable
data class BookTitleSuggestionResponse(
    val name: String,
    val authors: List<String>,
    val narrators: List<String>,
    val releaseYear: Int?,
    val source: String,
)

/** GET /api/books/title-suggestions */
@Serializable
data class BookTitleSuggestionsResponse(val suggestions: List<BookTitleSuggestionResponse>)

fun BookWork.toResponse() = BookCoverMatchResponse(
    id = id.value,
    name = name,
    authors = authors,
    releaseYear = releaseYear?.value,
)

fun BookTitleSuggestion.toResponse() = BookTitleSuggestionResponse(
    name = name,
    authors = authors,
    narrators = narrators,
    releaseYear = releaseYear?.value,
    source = source.wire,
)

fun BookCoverOptions.toResponse() = BookCoverOptionsResponse(
    query = query.value,
    source = source.wire,
    matches = matches.map { it.toResponse() },
    selectedMatchId = selectedMatch?.value,
    covers = covers.toCoverResponse(),
)
