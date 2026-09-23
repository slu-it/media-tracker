package de.sluit.mediatracker.games.domain

/**
 * Picks which [CoverCandidate] the cover picker should show covers for by default, given the game's own
 * [title] and [releaseYear] (MT-017, ADR 0024). Pure and framework-free: an exact, normalised name match wins;
 * among several exact matches the one sharing the game's release year wins, otherwise the first one found; with
 * no exact match at all the first candidate is used; an empty list has no match.
 */
fun selectBestMatch(candidates: List<CoverCandidate>, title: Title, releaseYear: ReleaseYear): CoverCandidate? {
    if (candidates.isEmpty()) return null

    val normalizedTitle = normalize(title.value)
    val exactMatches = candidates.filter { normalize(it.name) == normalizedTitle }
    if (exactMatches.isEmpty()) return candidates.first()

    return exactMatches.firstOrNull { it.releaseYear == releaseYear } ?: exactMatches.first()
}

private fun normalize(value: String): String = value.trim().lowercase().replace(Regex("\\s+"), " ")
