package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.SearchTerm
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.ExpressionWithColumnTypeAlias
import org.jetbrains.exposed.v1.core.LikePattern
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.alias
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.or

/**
 * The text-search predicate over one fulltext-indexed [column] (a title or a vocabulary name): a fulltext hit
 * ([MatchesFulltext]) or a `column LIKE '<term>%'` prefix match. The LIKE branch is escaped through
 * [LikePattern.ofLiteral] so a literal `%`, `_` or `\` in the term is no wildcard, and it finds values InnoDB
 * cannot index at all (shorter than `innodb_ft_min_token_size` or a stopword).
 *
 * Ranking: a LIKE-prefix hit first (it is either an exact prefix or nothing, so there is no relevance to weigh
 * it against), then fulltext relevance; callers append their own tie-breakers. [score] must be added to the
 * select list (`table.columns + score`) for [relevanceOrdering] to be usable.
 */
internal class TitleSearch private constructor(column: Column<String>, term: SearchTerm, booleanQuery: String) {
    val prefixMatch: Op<Boolean> = column like (LikePattern.ofLiteral(term.value) + "%")

    /** Fulltext hit OR prefix hit; an `OrOp`, which `compoundAnd()` parenthesises inside an AND automatically. */
    val matches: Op<Boolean> = MatchesFulltext(column, booleanQuery) or prefixMatch

    val score: ExpressionWithColumnTypeAlias<Double> = MatchScore(column, booleanQuery).alias("score")

    /** Prefix hit DESC, then relevance DESC. */
    fun relevanceOrdering(): List<Pair<Expression<*>, SortOrder>> =
        listOf(prefixMatch to SortOrder.DESC, score to SortOrder.DESC)

    companion object {
        /** Call inside a transaction (the LIKE escape reads the dialect). null when there is no [term] or nothing searchable remains of it (see [FulltextQuery.booleanMode]). */
        fun of(column: Column<String>, term: SearchTerm?): TitleSearch? {
            val booleanQuery = term?.let { FulltextQuery.booleanMode(it.value) } ?: return null
            return TitleSearch(column, term, booleanQuery)
        }
    }
}
