package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.requireValid

/*
 * Domain port and value objects for cover image lookup (MT-017, ADR 0024). One provider (SteamGridDB) exists
 * today, implemented outward in `games.integration`; the domain never imports that package.
 */

/** Id of a game as the cover source knows it; parsed from the `match` query parameter. */
@JvmInline
value class CoverSourceGameId(val value: Long) {
    init {
        requireValid(FIELD, value > 0) { "must be positive" }
    }

    companion object {
        const val FIELD = "match"

        fun parse(raw: String): CoverSourceGameId {
            val value = raw.toLongOrNull() ?: throw InvalidValueException(FIELD, "must be a positive integer")
            return CoverSourceGameId(value)
        }
    }
}

/** One game the cover source found for a search term. */
data class CoverCandidate(
    val id: CoverSourceGameId,
    val name: String,
    val releaseYear: ReleaseYear?,
    val verified: Boolean,
)

/** One selectable cover image, in both a thumbnail and its full-size form. */
data class CoverOption(val thumbnailUrl: CoverImageUrl, val imageUrl: CoverImageUrl, val width: Int, val height: Int)

/** Whether the cover picker asks SteamGridDB for static or animated (APNG/animated WebP) grids. */
enum class CoverType {
    STATIC,
    ANIMATED,
    ;

    val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "type"
        val DEFAULT = STATIC

        fun from(wire: String): CoverType = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}

/** The [CoverSource] port's page size for [CoverSource.findCovers]; every adapter honours it verbatim. */
const val COVER_PAGE_SIZE = 50

/** Outward port to an external cover image provider. Implemented in `games.integration`. */
interface CoverSource {
    suspend fun searchGames(term: SearchTerm): List<CoverCandidate>

    suspend fun findCovers(id: CoverSourceGameId, type: CoverType, page: PageNumber): Page<CoverOption>
}

/** Result of [CoverOptionsService.find]: the candidates for [query], the chosen one, and its covers. */
data class CoverOptions(
    val query: SearchTerm,
    /** The candidates for [query]. Empty on pages after the first when `match` is given. */
    val matches: List<CoverCandidate>,
    val selectedMatchId: CoverSourceGameId?,
    val type: CoverType,
    val covers: Page<CoverOption>,
)
