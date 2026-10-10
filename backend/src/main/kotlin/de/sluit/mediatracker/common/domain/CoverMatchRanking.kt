package de.sluit.mediatracker.common.domain

/** A cover-lookup candidate that [selectBestMatch] can rank by name and release year. */
interface RankableMatch {
    val name: String
    val releaseYear: ReleaseYear?
}

/**
 * Picks which candidate the cover picker should show covers for by default, given the search [term] and an
 * optional [releaseYear] (MT-017, ADR 0024; game-independent since the cover lookup no longer requires a stored
 * game). Pure and framework-free: an exact, normalised name match wins; among several exact matches, when a
 * [releaseYear] is given, the one sharing it wins, otherwise the first one found; with no exact match at all the
 * first candidate is used; an empty list has no match.
 */
fun <T : RankableMatch> selectBestMatch(candidates: List<T>, term: SearchTerm, releaseYear: ReleaseYear?): T? {
    if (candidates.isEmpty()) return null

    val normalizedTerm = normalize(term.value)
    val exactMatches = candidates.filter { normalize(it.name) == normalizedTerm }
    if (exactMatches.isEmpty()) return candidates.first()

    return releaseYear?.let { year -> exactMatches.firstOrNull { it.releaseYear == year } } ?: exactMatches.first()
}

private fun normalize(value: String): String = value.trim().lowercase().replace(Regex("\\s+"), " ")
