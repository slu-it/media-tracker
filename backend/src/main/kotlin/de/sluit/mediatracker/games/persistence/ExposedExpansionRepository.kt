package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.ExpansionRepository
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.domain.Title
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.UpdateBuilder
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.uuid.Uuid

/** [ExpansionRepository] on Exposed/JDBC. Maps rows to domain objects and back; nothing else knows the table. */
class ExposedExpansionRepository : ExpansionRepository {
    override suspend fun findByGame(gameId: GameId): List<Expansion> = dbQuery {
        GameExpansionsTable.selectAll()
            .where { GameExpansionsTable.gameId eq gameId.toString() }
            .orderBy(GameExpansionsTable.sequence to SortOrder.ASC, GameExpansionsTable.id to SortOrder.ASC)
            .map { it.toExpansion() }
    }

    override suspend fun findByGameAndId(gameId: GameId, id: ExpansionId): Expansion? = dbQuery {
        GameExpansionsTable.selectAll()
            .where { (GameExpansionsTable.id eq id.toString()) and (GameExpansionsTable.gameId eq gameId.toString()) }
            .singleOrNull()
            ?.toExpansion()
    }

    override suspend fun insert(expansion: Expansion) {
        dbQuery {
            GameExpansionsTable.insert { it.writeExpansion(expansion) }
        }
    }

    override suspend fun update(expansion: Expansion): Boolean = dbQuery {
        GameExpansionsTable.update({ GameExpansionsTable.id eq expansion.id.toString() }) {
            it.writeExpansion(expansion)
        } == 1
    }

    override suspend fun deleteById(id: ExpansionId): Int = dbQuery {
        GameExpansionsTable.deleteWhere { GameExpansionsTable.id eq id.toString() }
    }

    override suspend fun saveOrder(gameId: GameId, orderedIds: List<ExpansionId>) {
        dbQuery {
            orderedIds.forEachIndexed { index, id ->
                GameExpansionsTable.update({
                    (GameExpansionsTable.id eq id.toString()) and (GameExpansionsTable.gameId eq gameId.toString())
                }) {
                    it[sequence] = index
                }
            }
        }
    }

    private fun UpdateBuilder<*>.writeExpansion(expansion: Expansion) {
        this[GameExpansionsTable.id] = expansion.id.toString()
        this[GameExpansionsTable.gameId] = expansion.gameId.toString()
        this[GameExpansionsTable.sequence] = expansion.sequence.value
        this[GameExpansionsTable.title] = expansion.title.value
        this[GameExpansionsTable.ownership] = expansion.ownership.wire
        this[GameExpansionsTable.progress] = expansion.progress.wire
    }

    private fun ResultRow.toExpansion() = Expansion(
        id = ExpansionId(Uuid.parseHexDash(this[GameExpansionsTable.id])),
        gameId = GameId(Uuid.parseHexDash(this[GameExpansionsTable.gameId])),
        sequence = SequenceNumber(this[GameExpansionsTable.sequence]),
        title = Title(this[GameExpansionsTable.title]),
        ownership = Ownership.from(this[GameExpansionsTable.ownership]),
        progress = Progress.from(this[GameExpansionsTable.progress]),
    )
}
