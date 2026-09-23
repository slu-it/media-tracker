package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Picks which [CoverCandidate] the cover picker should show covers for by default, given the search [term] and an
 * optional [releaseYear] (MT-017, ADR 0024; game-independent since the cover lookup no longer requires a stored
 * game). Pure and framework-free: an exact, normalised name match wins; among several exact matches, when a
 * [releaseYear] is given, the one sharing it wins, otherwise the first one found; with no exact match at all the
 * first candidate is used; an empty list has no match.
 */
fun selectBestMatch(candidates: List<CoverCandidate>, term: SearchTerm, releaseYear: ReleaseYear?): CoverCandidate? {
    if (candidates.isEmpty()) return null

    val normalizedTerm = normalize(term.value)
    val exactMatches = candidates.filter { normalize(it.name) == normalizedTerm }
    if (exactMatches.isEmpty()) return candidates.first()

    return releaseYear?.let { year -> exactMatches.firstOrNull { it.releaseYear == year } } ?: exactMatches.first()
}

private fun normalize(value: String): String = value.trim().lowercase().replace(Regex("\\s+"), " ")
