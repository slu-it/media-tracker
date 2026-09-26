package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.games.domain.DeveloperName
import de.sluit.mediatracker.games.domain.DeveloperSearchLimit
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperCreation
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameDeveloperRepository
import org.jetbrains.exposed.v1.core.LikePattern
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.alias
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.uuid.Uuid

/**
 * [GameDeveloperRepository] on Exposed/JDBC: a vocabulary the user grows on the fly (MT-025, ADR 0029), unlike
 * the seeded [GamePlatformsTable]. Its `name` column carries the `uq_game_developers_name` unique index, whose
 * uca1400_ai_ci collation already makes an exact-name lookup case-insensitive.
 */
class ExposedGameDeveloperRepository : GameDeveloperRepository {
    /**
     * Fulltext search (MT-025) fails short studio names outright: InnoDB never indexes a word shorter than
     * `innodb_ft_min_token_size` (3) or a stopword, so "EA" or "2K" can never be found through
     * [MatchesFulltext]/[MatchScore] no matter how the query is phrased. [term]'s own trimmed text is therefore
     * also matched as a `name LIKE '<term>%'` prefix (escaped through [LikePattern.ofLiteral] so a literal `%`,
     * `_` or `\` in the term is not treated as a wildcard), which finds a short name fulltext cannot index at
     * all as well as any other name sharing that prefix. Ranked simply: a LIKE-prefix hit first (it is either
     * an exact prefix or nothing, so there is no relevance to weigh it against), then fulltext relevance, then
     * name/id for a stable order among ties.
     */
    override suspend fun search(term: SearchTerm?, limit: DeveloperSearchLimit): List<GameDeveloper> = dbQuery {
        val booleanQuery = term?.let { FulltextQuery.booleanMode(it.value) }
        if (term == null || booleanQuery == null) {
            GameDevelopersTable.selectAll()
                .orderBy(GameDevelopersTable.name to SortOrder.ASC, GameDevelopersTable.id to SortOrder.ASC)
                .limit(limit.value)
                .map { it.toGameDeveloper() }
        } else {
            val prefixMatch = GameDevelopersTable.name like (LikePattern.ofLiteral(term.value) + "%")
            val matches = MatchesFulltext(GameDevelopersTable.name, booleanQuery)
            val score = MatchScore(GameDevelopersTable.name, booleanQuery).alias("score")
            GameDevelopersTable.select(GameDevelopersTable.columns + score)
                .where { matches or prefixMatch }
                .orderBy(
                    prefixMatch to SortOrder.DESC,
                    score to SortOrder.DESC,
                    GameDevelopersTable.name to SortOrder.ASC,
                    GameDevelopersTable.id to SortOrder.ASC,
                )
                .limit(limit.value)
                .map { it.toGameDeveloper() }
        }
    }

    override suspend fun findByIds(ids: Set<GameDeveloperId>): List<GameDeveloper> = dbQuery {
        if (ids.isEmpty()) {
            emptyList()
        } else {
            GameDevelopersTable.selectAll()
                .where { GameDevelopersTable.id inList ids.map { it.toString() } }
                .map { it.toGameDeveloper() }
        }
    }

    /**
     * Selects by name first (the common case: the caller already searched and picked an existing developer),
     * then inserts. A concurrent create can still race the unique index between that select and this insert; the
     * loser catches the constraint violation and reads back the winner's row instead of failing. Under the
     * default REPEATABLE READ isolation, a plain `SELECT` reuses the snapshot this transaction's first read
     * established, so a fallback read with the same plain `findByName` would still miss the row the other
     * transaction committed in between and return null - the exact violation it just caught says it must exist.
     * A locking read sidesteps that: it always reads the latest *committed* row regardless of the transaction's
     * snapshot, which is exactly the winner's row here (its insert already committed, or the constraint violation
     * could not have fired). The fallback uses [ForUpdateOption.MariaDB.LockInShareMode] rather than the
     * exclusive `FOR UPDATE`: with three or more concurrent losers, each already holds an implicit shared lock
     * from the unique-index check that failed its own insert, and every one of them then trying to upgrade to an
     * exclusive lock on the same row deadlocks. A shared lock is enough here - the fallback only reads, it never
     * writes - so no loser needs to wait on another loser at all.
     *
     * This is the primary defence; Exposed's `transaction` (`defaultMaxAttempts` = 3) also retries the whole
     * block from scratch on any escaping [java.sql.SQLException], including MariaDB's deadlock/lock-wait-timeout
     * errors, so a deadlocked exclusive lock would eventually resolve through retries too. That retry is only a
     * backstop, not the primary path: it burns whole transaction attempts and still depends on a low enough
     * concurrency that the retries stop racing each other before `defaultMaxAttempts` runs out.
     */
    override suspend fun create(name: DeveloperName): GameDeveloperCreation = create(name) {}

    /**
     * [create] with a test seam: [afterInitialLookup] runs synchronously inside the same transaction right after
     * the initial [findByName] returns null, giving a test a deterministic window to commit a competing insert
     * of the same [name] on another connection before this transaction's own insert and locking fallback run.
     */
    internal suspend fun create(name: DeveloperName, afterInitialLookup: () -> Unit): GameDeveloperCreation = dbQuery {
        findByName(name)?.let { return@dbQuery GameDeveloperCreation(it, created = false) }
        afterInitialLookup()
        val id = GameDeveloperId.new()
        try {
            GameDevelopersTable.insert {
                it[GameDevelopersTable.id] = id.toString()
                it[GameDevelopersTable.name] = name.value
            }
            GameDeveloperCreation(GameDeveloper(id, name), created = true)
        } catch (e: ExposedSQLException) {
            findByName(name, locked = true)?.let { GameDeveloperCreation(it, created = false) } ?: throw e
        }
    }

    private fun findByName(name: DeveloperName, locked: Boolean = false): GameDeveloper? {
        val query = GameDevelopersTable.selectAll().where { GameDevelopersTable.name eq name.value }
        return (if (locked) query.forUpdate(ForUpdateOption.MariaDB.LockInShareMode) else query)
            .singleOrNull()
            ?.toGameDeveloper()
    }

    private fun ResultRow.toGameDeveloper() = GameDeveloper(
        id = GameDeveloperId(Uuid.parseHexDash(this[GameDevelopersTable.id])),
        name = DeveloperName(this[GameDevelopersTable.name]),
    )
}
