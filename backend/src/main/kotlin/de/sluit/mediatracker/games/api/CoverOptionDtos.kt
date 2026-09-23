package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.games.domain.CoverOptions
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** One SteamGridDB game found for a search term. */
@Serializable
data class CoverMatchResponse(val id: Long, val name: String, val releaseYear: Int?, val verified: Boolean)

/** One selectable cover image, in both a thumbnail and its full-size form. */
@Serializable
data class CoverOptionResponse(val thumbnailUrl: String, val imageUrl: String, val width: Int, val height: Int)

/** GET /api/games/{id}/cover-options */
@Serializable
data class CoverOptionsResponse(
    val query: String,
    val matches: List<CoverMatchResponse>,
    val selectedMatchId: Long?,
    val covers: List<CoverOptionResponse>,
)

fun CoverOptions.toResponse() = CoverOptionsResponse(
    query = query.value,
    matches = matches.map {
        CoverMatchResponse(
            id = it.id.value,
            name = it.name,
            releaseYear = it.releaseYear?.value,
            verified = it.verified,
        )
    },
    selectedMatchId = selectedMatchId?.value,
    covers = covers.map {
        CoverOptionResponse(
            thumbnailUrl = it.thumbnailUrl.value,
            imageUrl = it.imageUrl.value,
            width = it.width,
            height = it.height,
        )
    },
)
