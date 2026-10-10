package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.uuid.Uuid

/**
 * Exposed/JDBC logic of a vocabulary the user grows on the fly (MT-025, ADR 0029), e.g. a game's developers:
 * a [table] with a char(36) [id] and a [name] column carrying a unique index, whose uca1400_ai_ci collation
 * already makes an exact-name lookup case-insensitive. [name] must also be fulltext-indexed. [toEntity] builds
 * the kind's entity from a row's id string and name; the kind's repository delegates to this class.
 */
class ExposedNameVocabulary<E>(
    private val table: Table,
    private val id: Column<String>,
    private val name: Column<String>,
    private val toEntity: (String, VocabularyName) -> E,
) {
    /**
     * Fulltext search (MT-025) fails short names outright: InnoDB never indexes a word shorter than
     * `innodb_ft_min_token_size` (3) or a stopword, so "EA" or "2K" can never be found through
     * [MatchesFulltext]/[MatchScore] no matter how the query is phrased. [term]'s own trimmed text is therefore
     * also matched as a `name LIKE '<term>%'` prefix (see [TitleSearch]), which finds a short name fulltext
     * cannot index at all as well as any other name sharing that prefix. Ranked simply: a LIKE-prefix hit first
     * (it is either an exact prefix or nothing, so there is no relevance to weigh it against), then fulltext
     * relevance, then name/id for a stable order among ties. A blank/`null` [term] (or one with nothing
     * searchable left) lists alphabetically.
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<E> = dbQuery {
        val titleSearch = TitleSearch.of(name, term)
        if (titleSearch == null) {
            table.selectAll()
                .orderBy(name to SortOrder.ASC, id to SortOrder.ASC)
                .limit(limit.value)
                .map { it.toEntity() }
        } else {
            table.select(table.columns + titleSearch.score)
                .where { titleSearch.matches }
                .orderBy(
                    titleSearch.prefixMatch to SortOrder.DESC,
                    titleSearch.score to SortOrder.DESC,
                    name to SortOrder.ASC,
                    id to SortOrder.ASC,
                )
                .limit(limit.value)
                .map { it.toEntity() }
        }
    }

    suspend fun findByIds(ids: Set<String>): List<E> = dbQuery {
        if (ids.isEmpty()) {
            emptyList()
        } else {
            table.selectAll()
                .where { id inList ids }
                .map { it.toEntity() }
        }
    }

    /**
     * Selects by name first (the common case: the caller already searched and picked an existing entry),
     * then inserts under [newId]. A concurrent create can still race the unique index between that select and
     * this insert; the loser catches the constraint violation and reads back the winner's row instead of
     * failing. Under the default REPEATABLE READ isolation, a plain `SELECT` reuses the snapshot this
     * transaction's first read established, so a fallback read with the same plain `findByName` would still
     * miss the row the other transaction committed in between and return null - the exact violation it just
     * caught says it must exist. A locking read sidesteps that: it always reads the latest *committed* row
     * regardless of the transaction's snapshot, which is exactly the winner's row here (its insert already
     * committed, or the constraint violation could not have fired). The fallback uses
     * [ForUpdateOption.MariaDB.LockInShareMode] rather than the exclusive `FOR UPDATE`: with three or more
     * concurrent losers, each already holds an implicit shared lock from the unique-index check that failed its
     * own insert, and every one of them then trying to upgrade to an exclusive lock on the same row deadlocks.
     * A shared lock is enough here - the fallback only reads, it never writes - so no loser needs to wait on
     * another loser at all.
     *
     * This is the primary defence; Exposed's `transaction` (`defaultMaxAttempts` = 3) also retries the whole
     * block from scratch on any escaping [java.sql.SQLException], including MariaDB's deadlock/lock-wait-timeout
     * errors, so a deadlocked exclusive lock would eventually resolve through retries too. That retry is only a
     * backstop, not the primary path: it burns whole transaction attempts and still depends on a low enough
     * concurrency that the retries stop racing each other before `defaultMaxAttempts` runs out.
     */
    suspend fun create(name: VocabularyName): VocabularyCreation<E> = create(name) {}

    /**
     * [create] with a test seam: [afterInitialLookup] runs synchronously inside the same transaction right after
     * the initial [findByName] returns null, giving a test a deterministic window to commit a competing insert
     * of the same [name] on another connection before this transaction's own insert and locking fallback run.
     */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<E> = dbQuery {
        findByName(name)?.let { return@dbQuery VocabularyCreation(it, created = false) }
        afterInitialLookup()
        val newId = Uuid.random().toString()
        try {
            table.insert {
                it[id] = newId
                it[this@ExposedNameVocabulary.name] = name.value
            }
            VocabularyCreation(toEntity(newId, name), created = true)
        } catch (e: ExposedSQLException) {
            findByName(name, locked = true)?.let { VocabularyCreation(it, created = false) } ?: throw e
        }
    }

    /**
     * Renames the entry [entryId] to [newName] in one transaction. The row is locked `FOR UPDATE` first, so
     * concurrent renames/merges of it serialise. Another entry (any id but [entryId]) already holding the name
     * is [RenameOutcome.Taken]; the entry's own row is excluded, so a spelling that is only collation-equal to its
     * current name (case, accents) is a plain update. As in [create], a concurrent insert or rename of the same
     * name can still win the unique index between the lookup and the update; the loser's constraint violation is
     * answered by a locking re-read of the other holder (`LOCK IN SHARE MODE`, which sees the latest committed
     * row despite the REPEATABLE READ snapshot) and reported as [RenameOutcome.Taken].
     */
    suspend fun rename(entryId: String, newName: VocabularyName): RenameOutcome<E> = rename(entryId, newName) {}

    /** [rename] with a test seam, see [create]: [afterLookup] runs right after the lookup found no other holder. */
    internal suspend fun rename(entryId: String, newName: VocabularyName, afterLookup: () -> Unit): RenameOutcome<E> =
        dbQuery {
            val row = table.selectAll().where { id eq entryId }.forUpdate().singleOrNull()
                ?: return@dbQuery RenameOutcome.NotFound
            findOtherByName(newName, entryId)?.let { return@dbQuery RenameOutcome.Taken(it) }
            afterLookup()
            try {
                table.update({ id eq entryId }) { it[name] = newName.value }
                RenameOutcome.Renamed(toEntity(row[id], newName))
            } catch (e: ExposedSQLException) {
                if (!e.isDuplicateEntry()) throw e
                findOtherByName(newName, entryId, locked = true)?.let { RenameOutcome.Taken(it) } ?: throw e
            }
        }

    private fun findOtherByName(name: VocabularyName, exceptId: String, locked: Boolean = false): E? =
        table.findRowByLabel(this.name, id, name.value, exceptId, locked)?.toEntity()

    private fun findByName(name: VocabularyName, locked: Boolean = false): E? {
        val query = table.selectAll().where { this.name eq name.value }
        return (if (locked) query.forUpdate(ForUpdateOption.MariaDB.LockInShareMode) else query)
            .singleOrNull()
            ?.toEntity()
    }

    private fun ResultRow.toEntity(): E = toEntity(this[id], VocabularyName(this[name]))
}
