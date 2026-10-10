package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.persistence.ExposedColoredVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GamePlatformRepository
import de.sluit.mediatracker.games.domain.GamePlatformSummary
import de.sluit.mediatracker.games.domain.PlatformLabel
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.uuid.Uuid

/**
 * [GamePlatformRepository] on Exposed/JDBC. The rows are seeded by the migration and editable by the user; the
 * summaries, create, update and delete logic lives in [ExposedColoredVocabulary], bound here to [GamePlatformsTable].
 */
class ExposedGamePlatformRepository : GamePlatformRepository {
    private val vocabulary = ExposedColoredVocabulary(
        table = GamePlatformsTable,
        id = GamePlatformsTable.id,
        label = GamePlatformsTable.label,
        color = GamePlatformsTable.associatedColor,
        junction = GameToPlatformTable,
        junctionVocabColumn = GameToPlatformTable.platformId,
        toEntity = ::toGamePlatform,
    )

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

    override suspend fun findSummaries(): List<GamePlatformSummary> =
        vocabulary.findSummaries().map { (platform, count) -> GamePlatformSummary(platform, count) }

    override suspend fun create(label: PlatformLabel, color: HexColor): CreateOutcome<GamePlatform> =
        vocabulary.create(label.value, color.value)

    override suspend fun update(
        id: GamePlatformId,
        label: PlatformLabel?,
        color: HexColor?,
    ): RenameOutcome<GamePlatform> = vocabulary.update(id.toString(), label?.value, color?.value)

    override suspend fun delete(id: GamePlatformId): DeleteOutcome = vocabulary.delete(id.toString())

    /** Test seam, see [ExposedColoredVocabulary.create]. */
    internal suspend fun create(
        label: PlatformLabel,
        color: HexColor,
        afterLookup: () -> Unit,
    ): CreateOutcome<GamePlatform> = vocabulary.create(label.value, color.value, afterLookup)

    /** Test seam, see [ExposedColoredVocabulary.update]. */
    internal suspend fun update(
        id: GamePlatformId,
        label: PlatformLabel?,
        color: HexColor?,
        afterLookup: () -> Unit,
    ): RenameOutcome<GamePlatform> = vocabulary.update(id.toString(), label?.value, color?.value, afterLookup)

    private fun ResultRow.toGamePlatform() = toGamePlatform(
        this[GamePlatformsTable.id],
        this[GamePlatformsTable.label],
        this[GamePlatformsTable.associatedColor],
    )
}

private fun toGamePlatform(id: String, label: String, color: String) =
    GamePlatform(GamePlatformId(Uuid.parseHexDash(id)), PlatformLabel(label), HexColor(color))
