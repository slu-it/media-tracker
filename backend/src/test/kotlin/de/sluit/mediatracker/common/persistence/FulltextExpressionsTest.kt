package de.sluit.mediatracker.common.persistence

import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private object TestTitles : Table("test_titles") {
    val title = varchar("title", 256)
}

class FulltextExpressionsTest {

    @Test
    fun `match score clamps the match with LEAST at the relevance cap`() = withFreshDatabase {
        transaction {
            val sql = MatchScore(TestTitles.title, "zelda*").renderToSql()

            assertTrue(sql.contains("LEAST(MATCH("))
            assertTrue(sql.contains(", $RELEVANCE_CAP)"))
        }
    }

    @Test
    fun `matches fulltext predicate renders without a LEAST clamp`() = withFreshDatabase {
        transaction {
            val sql = MatchesFulltext(TestTitles.title, "zelda*").renderToSql()

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
