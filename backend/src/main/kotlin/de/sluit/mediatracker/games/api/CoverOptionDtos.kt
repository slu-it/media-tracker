package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.common.api.toResponse
import de.sluit.mediatracker.games.domain.CoverCandidate
import de.sluit.mediatracker.games.domain.CoverOptions
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** One SteamGridDB game found for a search term. */
@Serializable
data class CoverMatchResponse(val id: Long, val name: String, val releaseYear: Int?, val verified: Boolean)

/** One selectable cover image, in both a thumbnail and its full-size form. */
@Serializable
data class CoverOptionResponse(val thumbnailUrl: String, val imageUrl: String, val width: Int, val height: Int)

/** GET /api/games/cover-options */
@Serializable
data class CoverOptionsResponse(
    val query: String,
    /** Empty on pages after the first when `match` is given. */
    val matches: List<CoverMatchResponse>,
    val selectedMatchId: Long?,
    val type: String,
    val covers: PageResponse<CoverOptionResponse>,
)

/** GET /api/games/title-suggestions */
@Serializable
data class TitleSuggestionsResponse(val suggestions: List<CoverMatchResponse>)

/** Also used by the MCP `find_game_cover` tool's structured content. */
fun CoverCandidate.toResponse() = CoverMatchResponse(
    id = id.value,
    name = name,
    releaseYear = releaseYear?.value,
    verified = verified,
)

fun CoverOptions.toResponse() = CoverOptionsResponse(
    query = query.value,
    matches = matches.map { it.toResponse() },
    selectedMatchId = selectedMatchId?.value,
    type = type.wire,
    covers = covers.toResponse {
        CoverOptionResponse(
            thumbnailUrl = it.thumbnailUrl.value,
            imageUrl = it.imageUrl.value,
            width = it.width,
            height = it.height,
        )
    },
)
