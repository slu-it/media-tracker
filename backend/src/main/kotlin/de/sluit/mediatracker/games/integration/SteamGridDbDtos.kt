package de.sluit.mediatracker.games.integration

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire shapes for the SteamGridDB REST API (MT-017, ADR 0024). Internal to this adapter; [SteamGridDbCoverSource]
 * is the only thing that sees them and maps them to the domain's `CoverCandidate`/`CoverOption`. Not mirrored in
 * the frontend: the SPA only ever sees `games/api/CoverOptionDtos.kt`.
 */
@Serializable
internal data class SgdbEnvelope<T>(val success: Boolean, val data: T? = null, val errors: List<String> = emptyList())

@Serializable
internal data class SgdbGame(
    val id: Long,
    val name: String,
    val verified: Boolean = false,
    @SerialName("release_date") val releaseDate: Long? = null,
)

@Serializable
internal data class SgdbGrid(val url: String, val thumb: String, val width: Int, val height: Int)

/** Lenient Json for the client's ContentNegotiation: SteamGridDB's payloads carry fields we do not model. */
internal val steamGridDbJson = Json { ignoreUnknownKeys = true }
