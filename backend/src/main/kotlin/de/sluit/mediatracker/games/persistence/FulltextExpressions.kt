package de.sluit.mediatracker.games.persistence

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.DoubleColumnType
import org.jetbrains.exposed.v1.core.Function
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.VarCharColumnType

internal const val TITLE_WEIGHT = 2.0
internal const val DESCRIPTION_WEIGHT = 0.75

// On a table with exactly one row, once that row's MATCH ... AGAINST hit is served from the on-disk fulltext
// index rather than MariaDB's in-memory cache (i.e. after a server restart), it evaluates to infinity and any
// arithmetic on it raises "DOUBLE value is out of range". Real relevance values are small fractions far below
// this cap, so it never binds in practice. OPTIMIZE TABLE, FLUSH TABLES and ALTER TABLE ... FORCE do not
// reproduce the condition, only a server restart does, so don't drop this cap just because it fails to
// reproduce locally.
internal const val RELEVANCE_CAP = 1_000_000.0

private fun QueryBuilder.matchAgainst(column: Column<*>, booleanQuery: String) {
    +"MATCH("
    +column
    +") AGAINST("
    registerArgument(VarCharColumnType(), booleanQuery)
    +" IN BOOLEAN MODE)"
}

/** [matchAgainst] clamped to [RELEVANCE_CAP], for use wherever the relevance feeds into arithmetic. */
private fun QueryBuilder.cappedMatchAgainst(column: Column<*>, booleanQuery: String) {
    +"LEAST("
    matchAgainst(column, booleanQuery)
    +", $RELEVANCE_CAP)"
}

/** `MATCH(col) AGAINST(? IN BOOLEAN MODE)` as a predicate: MariaDB treats a non-zero relevance as true. */
internal class MatchesFulltext(private val column: Column<*>, private val booleanQuery: String) : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) = queryBuilder { matchAgainst(column, booleanQuery) }
}

/**
 * `(2.0 * LEAST(MATCH(title) ..., 1000000.0) + 0.75 * LEAST(MATCH(description) ..., 1000000.0))`; both MATCH
 * calls bind the same query text.
 */
internal class WeightedFulltextScore(private val booleanQuery: String) : Function<Double>(DoubleColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) = queryBuilder {
        +"("
        +"$TITLE_WEIGHT * "
        cappedMatchAgainst(GamesTable.title, booleanQuery)
        +" + "
        +"$DESCRIPTION_WEIGHT * "
        cappedMatchAgainst(GamesTable.description, booleanQuery)
        +")"
    }
}
