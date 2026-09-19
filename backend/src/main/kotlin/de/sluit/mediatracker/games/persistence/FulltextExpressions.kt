package de.sluit.mediatracker.games.persistence

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.DoubleColumnType
import org.jetbrains.exposed.v1.core.Function
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.VarCharColumnType

internal const val TITLE_WEIGHT = 2.0
internal const val DESCRIPTION_WEIGHT = 0.75

private fun QueryBuilder.matchAgainst(column: Column<*>, booleanQuery: String) {
    +"MATCH("
    +column
    +") AGAINST("
    registerArgument(VarCharColumnType(), booleanQuery)
    +" IN BOOLEAN MODE)"
}

/** `MATCH(col) AGAINST(? IN BOOLEAN MODE)` as a predicate: MariaDB treats a non-zero relevance as true. */
internal class MatchesFulltext(private val column: Column<*>, private val booleanQuery: String) : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) = queryBuilder { matchAgainst(column, booleanQuery) }
}

/** `(2.0 * MATCH(title) ... + 0.75 * MATCH(description) ...)`; both MATCH calls bind the same query text. */
internal class WeightedFulltextScore(private val booleanQuery: String) : Function<Double>(DoubleColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) = queryBuilder {
        +"("
        +"$TITLE_WEIGHT * "
        matchAgainst(GamesTable.title, booleanQuery)
        +" + "
        +"$DESCRIPTION_WEIGHT * "
        matchAgainst(GamesTable.description, booleanQuery)
        +")"
    }
}
