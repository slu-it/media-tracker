package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.db.dbQuery
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GamePlatformRepository
import de.sluit.mediatracker.games.domain.HexColor
import de.sluit.mediatracker.games.domain.PlatformLabel
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.uuid.Uuid

/** [GamePlatformRepository] on Exposed/JDBC. The rows are seeded by the migration and essentially static. */
class ExposedGamePlatformRepository : GamePlatformRepository {
    override suspend fun findAll(): List<GamePlatform> = dbQuery {
        GamePlatformsTable.selectAll().orderBy(GamePlatformsTable.label to SortOrder.ASC).map { it.toGamePlatform() }
    }

    override suspend fun findByIds(ids: Set<GamePlatformId>): List<GamePlatform> = dbQuery {
        if (ids.isEmpty()) {
            emptyList()
        } else {
            GamePlatformsTable.selectAll()
                .where { GamePlatformsTable.id inList ids.map { it.toString() } }
                .map { it.toGamePlatform() }
        }
    }

    private fun ResultRow.toGamePlatform() = GamePlatform(
        id = GamePlatformId(Uuid.parseHexDash(this[GamePlatformsTable.id])),
        label = PlatformLabel(this[GamePlatformsTable.label]),
        color = HexColor(this[GamePlatformsTable.associatedColor]),
    )
}
