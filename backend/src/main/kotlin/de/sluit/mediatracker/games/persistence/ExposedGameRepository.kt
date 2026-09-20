package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameRepository
import de.sluit.mediatracker.games.domain.HexColor
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.domain.sortedForGame
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.alias
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.innerJoin
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.statements.UpdateBuilder
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.uuid.Uuid

/** [GameRepository] on Exposed/JDBC. Maps rows to domain objects and back; nothing else knows the table. */
class ExposedGameRepository : GameRepository {
    override suspend fun insert(game: Game) {
        dbQuery {
            GamesTable.insert { it.writeGame(game) }
            insertPlatformLinks(game)
        }
    }

    override suspend fun findById(id: GameId): Game? = dbQuery {
        GamesTable.selectAll().where { GamesTable.id eq id.toString() }.singleOrNull()?.let { row ->
            row.toGame(platformsFor(setOf(id.toString()))[id.toString()].orEmpty().sortedForGame())
        }
    }

    override suspend fun update(game: Game): Boolean = dbQuery {
        val updated = GamesTable.update({ GamesTable.id eq game.id.toString() }) { it.writeGame(game) } == 1
        if (updated) {
            GameToPlatformTable.deleteWhere { GameToPlatformTable.gameId eq game.id.toString() }
            insertPlatformLinks(game)
        }
        updated
    }

    override suspend fun deleteById(id: GameId): Int = dbQuery {
        // The FK on game_to_platform cascades on delete; no explicit junction cleanup needed.
        GamesTable.deleteWhere { GamesTable.id eq id.toString() }
    }

    override suspend fun findPage(request: PageRequest): Page<Game> = dbQuery {
        val total = GamesTable.selectAll().count()
        val rows = GamesTable.selectAll()
            .orderBy(GamesTable.title to SortOrder.ASC, GamesTable.id to SortOrder.ASC)
            .limit(request.size.value)
            .offset(request.offset)
            .toList()
        pageOf(rows, request, total)
    }

    /**
     * Three SELECTs like [findPage]: the total match count, the page of games ordered by title hit first, then
     * the weighted score, then title, then id, and one join query that loads every game's platforms at once.
     * Fulltext entries become visible once the inserting transaction commits.
     */
    override suspend fun search(term: SearchTerm, request: PageRequest): Page<Game> {
        val booleanQuery = FulltextQuery.booleanMode(term.value) ?: return findPage(request)
        return dbQuery {
            val titleMatch = MatchesFulltext(GamesTable.title, booleanQuery)
            val descriptionMatch = MatchesFulltext(GamesTable.description, booleanQuery)
            val matches = titleMatch or descriptionMatch
            val total = GamesTable.selectAll().where { matches }.count()
            val score = WeightedFulltextScore(booleanQuery).alias("score")
            val rows = GamesTable.select(GamesTable.columns + score).where { matches }
                .orderBy(
                    titleMatch to SortOrder.DESC,
                    score to SortOrder.DESC,
                    GamesTable.title to SortOrder.ASC,
                    GamesTable.id to SortOrder.ASC,
                )
                .limit(request.size.value)
                .offset(request.offset)
                .toList()
            pageOf(rows, request, total)
        }
    }

    /**
     * Maps a page of rows (with or without the extra `score` column) to a [Page] of [Game], loading platforms
     * with one join query regardless of page size.
     */
    private fun pageOf(rows: List<ResultRow>, request: PageRequest, total: Long): Page<Game> {
        val platformsByGame = platformsFor(rows.map { it[GamesTable.id] }.toSet())
        val items = rows.map { row -> row.toGame(platformsByGame[row[GamesTable.id]].orEmpty().sortedForGame()) }
        return Page(items, request.page, request.size, total)
    }

    /** One query for all requested game ids: no N+1 when loading a page of games. */
    private fun platformsFor(gameIds: Set<String>): Map<String, List<GamePlatform>> {
        if (gameIds.isEmpty()) return emptyMap()
        return (GameToPlatformTable innerJoin GamePlatformsTable)
            .select(
                GameToPlatformTable.gameId,
                GamePlatformsTable.id,
                GamePlatformsTable.label,
                GamePlatformsTable.associatedColor,
            )
            .where { GameToPlatformTable.gameId inList gameIds }
            .groupBy({ it[GameToPlatformTable.gameId] }, { it.toGamePlatform() })
    }

    private fun insertPlatformLinks(game: Game) {
        GameToPlatformTable.batchInsert(game.platforms) { platform ->
            this[GameToPlatformTable.gameId] = game.id.toString()
            this[GameToPlatformTable.platformId] = platform.id.toString()
        }
    }

    private fun UpdateBuilder<*>.writeGame(game: Game) {
        this[GamesTable.id] = game.id.toString()
        this[GamesTable.title] = game.title.value
        this[GamesTable.releaseYear] = game.releaseYear.value
        this[GamesTable.description] = game.description?.value
        this[GamesTable.rating] = game.rating?.value
        this[GamesTable.coverImageUrl] = game.coverImageUrl?.value
        this[GamesTable.ownership] = game.ownership.wire
        this[GamesTable.progress] = game.progress.wire
        this[GamesTable.hidden] = game.hidden
    }

    private fun ResultRow.toGamePlatform() = GamePlatform(
        id = GamePlatformId(Uuid.parseHexDash(this[GamePlatformsTable.id])),
        label = PlatformLabel(this[GamePlatformsTable.label]),
        color = HexColor(this[GamePlatformsTable.associatedColor]),
    )

    // Re-running the value-object validation on read is intentional: a corrupt row (e.g. one with no
    // junction rows, which fails Game's "at least one platform" check) surfaces as a 400 validation_error
    // instead of leaking invalid data into the domain.
    private fun ResultRow.toGame(platforms: List<GamePlatform>) = Game(
        id = GameId(Uuid.parseHexDash(this[GamesTable.id])),
        title = Title(this[GamesTable.title]),
        releaseYear = ReleaseYear(this[GamesTable.releaseYear]),
        platforms = platforms,
        description = this[GamesTable.description]?.let(::Description),
        rating = this[GamesTable.rating]?.let(::Rating),
        coverImageUrl = this[GamesTable.coverImageUrl]?.let(::CoverImageUrl),
        ownership = Ownership.from(this[GamesTable.ownership]),
        progress = Progress.from(this[GamesTable.progress]),
        hidden = this[GamesTable.hidden],
    )
}
