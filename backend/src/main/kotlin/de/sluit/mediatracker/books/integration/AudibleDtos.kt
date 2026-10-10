package de.sluit.mediatracker.books.integration

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire shapes for the unofficial Audible catalog API (ADR 0039). Internal to [AudibleAudiobookSource]; every field
 * Audible may leave out is nullable or defaulted. Not mirrored in the frontend.
 */
@Serializable
internal data class AudibleResponse(
    @SerialName("total_results") val totalResults: Long? = null,
    val products: List<AudibleProduct> = emptyList(),
)

@Serializable
internal data class AudibleProduct(
    val asin: String? = null,
    val title: String? = null,
    val authors: List<AudibleContributor> = emptyList(),
    val narrators: List<AudibleContributor> = emptyList(),
    @SerialName("release_date") val releaseDate: String? = null,
    /** Keyed by the requested pixel size (`"500"`, `"1024"`). */
    @SerialName("product_images") val productImages: Map<String, String>? = null,
)

@Serializable
internal data class AudibleContributor(val name: String? = null)

/** Lenient Json for the mock-engine clients in tests; production uses the shared `externalHttpClient` default (also lenient). */
internal val audibleJson = Json { ignoreUnknownKeys = true }
