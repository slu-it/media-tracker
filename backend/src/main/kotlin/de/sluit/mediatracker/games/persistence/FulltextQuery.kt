package de.sluit.mediatracker.games.persistence

/**
 * MariaDB boolean-mode query text for a user term: every word becomes a prefix term (`zel*`), any word may
 * match (OR).
 */
internal object FulltextQuery {
    /**
     * Boolean-mode operators a user must not be able to write (`-hades`, `"exact phrase"`). Replaced by
     * spaces, so `spider-man` becomes `spider* man*`.
     */
    private val OPERATORS = Regex("[+\\-<>()~*\"@]")

    /** null when nothing searchable remains (the input was only operators). */
    fun booleanMode(term: String): String? = term.replace(OPERATORS, " ")
        .split(Regex("\\s+"))
        .filter { it.isNotEmpty() }
        .takeIf { it.isNotEmpty() }
        ?.joinToString(" ") { "$it*" }
}
