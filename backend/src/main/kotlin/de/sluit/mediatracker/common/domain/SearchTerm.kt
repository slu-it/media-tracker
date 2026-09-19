package de.sluit.mediatracker.common.domain

/**
 * A user-supplied search term (`?search=`): trimmed, non-blank, bounded. What "matching" means is the
 * repository's business.
 */
@JvmInline
value class SearchTerm(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value == value.trim()) { "must not have surrounding whitespace" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "search"
        const val MAX_LENGTH = 200

        /**
         * null for absent or blank input, otherwise the trimmed term; [field] names the offending parameter in
         * the error (REST: `search`, MCP: `query`).
         */
        fun parseOrNull(raw: String?, field: String = FIELD): SearchTerm? {
            val trimmed = raw?.trim()
            if (trimmed.isNullOrEmpty()) return null
            requireValid(field, trimmed.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
            return SearchTerm(trimmed)
        }
    }
}
