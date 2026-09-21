package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FulltextExpressionsTest {

    @Test
    fun `weighted score clamps the title match with LEAST before weighting it`() = withFreshDatabase {
        transaction {
            val sql = WeightedFulltextScore("zelda*").renderToSql()

            assertTrue(sql.contains("$TITLE_WEIGHT * LEAST(MATCH("))
        }
    }

    @Test
    fun `weighted score clamps the description match with LEAST before weighting it`() = withFreshDatabase {
        transaction {
            val sql = WeightedFulltextScore("zelda*").renderToSql()

            assertTrue(sql.contains("$DESCRIPTION_WEIGHT * LEAST(MATCH("))
        }
    }

    @Test
    fun `weighted score caps both matches at the same relevance cap`() = withFreshDatabase {
        transaction {
            val sql = WeightedFulltextScore("zelda*").renderToSql()

            assertEquals(2, Regex(Regex.escape(", $RELEVANCE_CAP)")).findAll(sql).count())
        }
    }

    @Test
    fun `matches fulltext predicate renders without a LEAST clamp`() = withFreshDatabase {
        transaction {
            val sql = MatchesFulltext(GamesTable.title, "zelda*").renderToSql()

            assertFalse(sql.contains("LEAST"))
            assertTrue(sql.contains("MATCH("))
        }
    }

    private fun Expression<*>.renderToSql(): String {
        val queryBuilder = QueryBuilder(prepared = false)
        toQueryBuilder(queryBuilder)
        return queryBuilder.toString()
    }
}
