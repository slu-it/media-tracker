package de.sluit.mediatracker.books.integration

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire shapes for the Open Library REST API (ADR 0039). Internal to [OpenLibraryWorkSource]; every field Open
 * Library may leave out is nullable or defaulted. Not mirrored in the frontend.
 */
@Serializable
internal data class OlSearchResponse(val docs: List<OlSearchDoc> = emptyList())

@Serializable
internal data class OlSearchDoc(
    val key: String? = null,
    val title: String? = null,
    @SerialName("author_name") val authorName: List<String>? = null,
    @SerialName("first_publish_year") val firstPublishYear: Int? = null,
    @SerialName("cover_i") val coverId: Long? = null,
)

/** `/works/{id}.json`; ids can be `-1` for "no cover". */
@Serializable
internal data class OlWork(val covers: List<Long>? = null)

/** `/works/{id}/editions.json`. */
@Serializable
internal data class OlEditions(val entries: List<OlEdition> = emptyList())

@Serializable
internal data class OlEdition(val covers: List<Long>? = null)

/** Lenient Json for the mock-engine clients in tests; production uses the shared `externalHttpClient` default (also lenient). */
internal val openLibraryJson = Json { ignoreUnknownKeys = true }
