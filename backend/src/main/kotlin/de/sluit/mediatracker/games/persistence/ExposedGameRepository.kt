package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameRepository
import de.sluit.mediatracker.games.domain.HexColor
import de.sluit.mediatracker.games.domain.MissingField
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.domain.sortedForGame
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.alias
import org.jetbrains.exposed.v1.core.compoundAnd
import org.jetbrains.exposed.v1.core.compoundOr
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.inSubQuery
import org.jetbrains.exposed.v1.core.innerJoin
import org.jetbrains.exposed.v1.core.isNull
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

    override suspend fun exists(id: GameId): Boolean = dbQuery {
        GamesTable.select(GamesTable.id).where { GamesTable.id eq id.toString() }.limit(1).any()
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
     * Three SELECTs like [findPage]: the total match count, the page of games, and one join query that loads
     * every game's platforms at once. [filters] AND across categories, OR (IN) inside one; combined with
     * [term]'s fulltext match, if any, by AND as well. Without a [term] (or one that the fulltext parser strips
     * down to nothing, e.g. `"+++"`), the ordering is title then id, same as [findPage] - filters must not
     * silently vanish in that case, so this falls back to the filtered listing rather than [findPage]. With a
     * term, the ordering is title hit first, then the weighted score, then title, then id, unchanged from before
     * filters existed. Fulltext entries become visible once the inserting transaction commits.
     */
    override suspend fun search(term: SearchTerm?, filters: GameFilters, request: PageRequest): Page<Game> {
        val booleanQuery = term?.let { FulltextQuery.booleanMode(it.value) }
        return dbQuery {
            if (booleanQuery == null) {
                // No term (or nothing left of one): the same predicate feeds both the count and the page
                // query, built once here so the two `.where` calls below share the identical Op instance.
                val predicate = filterOp(filters) ?: Op.TRUE
                val total = GamesTable.selectAll().where { predicate }.count()
                val rows = GamesTable.selectAll().where { predicate }
                    .orderBy(GamesTable.title to SortOrder.ASC, GamesTable.id to SortOrder.ASC)
                    .limit(request.size.value)
                    .offset(request.offset)
                    .toList()
                pageOf(rows, request, total)
            } else {
                val titleMatch = MatchesFulltext(GamesTable.title, booleanQuery)
                val descriptionMatch = MatchesFulltext(GamesTable.description, booleanQuery)
                // matches is an OrOp; compoundAnd() parenthesises it inside the AndOp automatically.
                val matches = titleMatch or descriptionMatch
                val predicate = listOfNotNull(matches, filterOp(filters)).compoundAnd()
                val total = GamesTable.selectAll().where { predicate }.count()
                val score = WeightedFulltextScore(booleanQuery).alias("score")
                val rows = GamesTable.select(GamesTable.columns + score).where { predicate }
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
    }

    /**
     * `null` when nothing is filtered; AND across the categories, OR (IN) inside one. The platform filter is an
     * uncorrelated `IN` subquery rather than an `innerJoin`: a game on two selected platforms would otherwise
     * come back twice per matching platform row and corrupt both `count()` and the LIMIT/OFFSET window, and
     * MariaDB can still read the inner side straight off `idx_game_to_platform_platform`. The `missing` category
     * ORs `IS NULL` checks over the listed [MissingField]s instead of an `IN` list.
     */
    private fun filterOp(filters: GameFilters): Op<Boolean>? = buildList {
        filters.platformIds.takeIf { it.isNotEmpty() }?.let { ids ->
            add(
                GamesTable.id inSubQuery GameToPlatformTable
                    .select(GameToPlatformTable.gameId)
                    .where { GameToPlatformTable.platformId inList ids.map { it.toString() } },
            )
        }
        // The takeIf guards are not cosmetic: Exposed renders inList(emptyList()) as the literal FALSE, so an
        // empty set would silently return zero rows instead of "no filter on this category".
        filters.ownership.takeIf { it.isNotEmpty() }?.let { add(GamesTable.ownership inList it.map(Ownership::wire)) }
        filters.progress.takeIf { it.isNotEmpty() }?.let { add(GamesTable.progress inList it.map(Progress::wire)) }
        filters.releaseYears.takeIf { it.isNotEmpty() }
            ?.let { add(GamesTable.releaseYear inList it.map { y -> y.value }) }
        filters.missing.takeIf { it.isNotEmpty() }?.let { fields -> add(fields.map(::missingOp).compoundOr()) }
    }.takeIf { it.isNotEmpty() }?.compoundAnd()

    /** `IS NULL` is the whole test: `Description` forbids a blank value, so a stored text is never empty. */
    private fun missingOp(field: MissingField): Op<Boolean> = when (field) {
        MissingField.DESCRIPTION -> GamesTable.description.isNull()
        MissingField.COVER_IMAGE_URL -> GamesTable.coverImageUrl.isNull()
    }

    /** Four DISTINCT selects in one transaction; see [GameRepository.findUsedFilterValues]. */
    override suspend fun findUsedFilterValues(): GameFilters = dbQuery {
        val platformIds = GameToPlatformTable.select(GameToPlatformTable.platformId).withDistinct()
            .map { GamePlatformId.parse(it[GameToPlatformTable.platformId]) }
            .toSet()
        val ownership = GamesTable.select(GamesTable.ownership).withDistinct()
            .map { Ownership.from(it[GamesTable.ownership]) }
            .toSet()
        val progress = GamesTable.select(GamesTable.progress).withDistinct()
            .map { Progress.from(it[GamesTable.progress]) }
            .toSet()
        val releaseYears = GamesTable.select(GamesTable.releaseYear).withDistinct()
            .map { ReleaseYear(it[GamesTable.releaseYear]) }
            .toSet()
        GameFilters(platformIds, ownership, progress, releaseYears)
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
