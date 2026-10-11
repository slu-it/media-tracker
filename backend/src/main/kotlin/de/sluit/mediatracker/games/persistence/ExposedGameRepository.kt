package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.SeriesPosition
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.persistence.TitleSearch
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.common.persistence.inListIfAny
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameRepository
import de.sluit.mediatracker.games.domain.GameSeries
import de.sluit.mediatracker.games.domain.GameSeriesEntry
import de.sluit.mediatracker.games.domain.GameSeriesId
import de.sluit.mediatracker.games.domain.GameSort
import de.sluit.mediatracker.games.domain.MissingField
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.UsedGameFilterValues
import de.sluit.mediatracker.games.domain.sortedByNameForGame
import de.sluit.mediatracker.games.domain.sortedForGame
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.compoundAnd
import org.jetbrains.exposed.v1.core.compoundOr
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.inSubQuery
import org.jetbrains.exposed.v1.core.innerJoin
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.isNull
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
            insertDeveloperLinks(game)
            insertSeriesLinks(game)
        }
    }

    override suspend fun findById(id: GameId): Game? = dbQuery {
        GamesTable.selectAll().where { GamesTable.id eq id.toString() }.singleOrNull()?.let { row ->
            row.toGame(
                platformsFor(setOf(id.toString()))[id.toString()].orEmpty().sortedForGame(),
                developersFor(setOf(id.toString()))[id.toString()].orEmpty().sortedByNameForGame(),
                seriesFor(setOf(id.toString()))[id.toString()].orEmpty().sortedByNameForGame(),
            )
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
            GameToDeveloperTable.deleteWhere { GameToDeveloperTable.gameId eq game.id.toString() }
            insertDeveloperLinks(game)
            GameToSeriesTable.deleteWhere { GameToSeriesTable.gameId eq game.id.toString() }
            insertSeriesLinks(game)
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
     * [term]'s title match, if any, by AND as well. Without a [term] (or one that the fulltext parser strips
     * down to nothing, e.g. `"+++"`), the ordering is [sort] alone, [GameSort.TITLE] being title then id, same
     * as [findPage] - filters must not silently vanish in that case, so this falls back to the filtered listing
     * rather than [findPage]. A term matches the title only: a title fulltext hit or a `title LIKE 'term%'` prefix
     * match (escaped, see [TitleSearch]; it finds titles InnoDB does not index, such as those under
     * three characters or stopwords). With a term and the default [sort], prefix hits come first, then fulltext
     * relevance, then title, then id; any other [sort] overrides that ordering entirely, though the match
     * still filters. Fulltext entries become visible once the inserting transaction commits.
     */
    override suspend fun search(
        term: SearchTerm?,
        filters: GameFilters,
        request: PageRequest,
        sort: GameSort,
    ): Page<Game> = dbQuery {
        // Built inside the transaction: LikePattern.ofLiteral reads the current dialect.
        val titleSearch = TitleSearch.of(GamesTable.title, term)
        if (titleSearch == null) {
            // No term (or nothing left of one): the same predicate feeds both the count and the page
            // query, built once here so the two `.where` calls below share the identical Op instance.
            val predicate = filterOp(filters) ?: Op.TRUE
            val total = GamesTable.selectAll().where { predicate }.count()
            val rows = GamesTable.selectAll().where { predicate }
                .orderBy(*orderingFor(sort))
                .limit(request.size.value)
                .offset(request.offset)
                .toList()
            pageOf(rows, request, total)
        } else {
            // matches is an OrOp; compoundAnd() parenthesises it inside the AndOp automatically.
            val predicate = listOfNotNull(titleSearch.matches, filterOp(filters)).compoundAnd()
            val total = GamesTable.selectAll().where { predicate }.count()
            val score = titleSearch.score
            val ordering = if (sort == GameSort.TITLE) {
                (
                    titleSearch.relevanceOrdering() +
                        listOf(GamesTable.title to SortOrder.ASC, GamesTable.id to SortOrder.ASC)
                    ).toTypedArray()
            } else {
                orderingFor(sort)
            }
            val rows = GamesTable.select(GamesTable.columns + score).where { predicate }
                .orderBy(*ordering)
                .limit(request.size.value)
                .offset(request.offset)
                .toList()
            pageOf(rows, request, total)
        }
    }

    /**
     * The ORDER BY clause for a given [GameSort] (used by both branches of [search] once relevance ordering
     * does not apply). [GameSort.RELEASE_ASC]/[GameSort.RELEASE_DESC] order dated games ahead of year-only ones
     * within the same year by ordering on `releaseDate IS NULL` before `releaseDate` itself: MariaDB evaluates
     * that boolean expression as 0 (false, a dated game) or 1 (true, year-only), so ascending puts dated games
     * first and descending puts year-only games first, matching the direction of the release ordering as a
     * whole. `title`/`id` break every remaining tie, as in [findPage].
     */
    private fun orderingFor(sort: GameSort): Array<Pair<Expression<*>, SortOrder>> = when (sort) {
        GameSort.TITLE -> arrayOf(GamesTable.title to SortOrder.ASC, GamesTable.id to SortOrder.ASC)

        GameSort.RELEASE_ASC -> arrayOf(
            GamesTable.releaseYear to SortOrder.ASC,
            GamesTable.releaseDate.isNull() to SortOrder.ASC,
            GamesTable.releaseDate to SortOrder.ASC,
            GamesTable.title to SortOrder.ASC,
            GamesTable.id to SortOrder.ASC,
        )

        GameSort.RELEASE_DESC -> arrayOf(
            GamesTable.releaseYear to SortOrder.DESC,
            GamesTable.releaseDate.isNull() to SortOrder.DESC,
            GamesTable.releaseDate to SortOrder.DESC,
            GamesTable.title to SortOrder.ASC,
            GamesTable.id to SortOrder.ASC,
        )

        GameSort.RATING_DESC -> arrayOf(
            GamesTable.rating to SortOrder.DESC,
            GamesTable.title to SortOrder.ASC,
            GamesTable.id to SortOrder.ASC,
        )
    }

    /**
     * `null` when nothing is filtered; AND across the categories, OR (IN) inside one. The platform filter is an
     * uncorrelated `IN` subquery rather than an `innerJoin`: a game on two selected platforms would otherwise
     * come back twice per matching platform row and corrupt both `count()` and the LIMIT/OFFSET window, and
     * MariaDB can still read the inner side straight off `idx_game_to_platform_platform`. The `missing` category
     * ORs `IS NULL` checks over the listed [MissingField]s instead of an `IN` list. [GameFilters.ratedOnly] adds
     * a plain `rating IS NOT NULL` predicate when set.
     */
    private fun filterOp(filters: GameFilters): Op<Boolean>? = buildList {
        filters.platformIds.takeIf { it.isNotEmpty() }?.let { ids ->
            add(
                GamesTable.id inSubQuery GameToPlatformTable
                    .select(GameToPlatformTable.gameId)
                    .where { GameToPlatformTable.platformId inList ids.map { it.toString() } },
            )
        }
        // inListIfAny skips an empty set: inList(emptyList()) would render FALSE and return zero rows.
        GamesTable.ownership.inListIfAny(filters.ownership.map(Ownership::wire))?.let { add(it) }
        GamesTable.progress.inListIfAny(filters.progress.map(Progress::wire))?.let { add(it) }
        GamesTable.releaseYear.inListIfAny(filters.releaseYears.map { y -> y.value })?.let { add(it) }
        filters.missing.takeIf { it.isNotEmpty() }?.let { fields -> add(fields.map(::missingOp).compoundOr()) }
        if (filters.ratedOnly) add(GamesTable.rating.isNotNull())
    }.takeIf { it.isNotEmpty() }?.compoundAnd()

    /** `IS NULL` is the whole test: `Description` forbids a blank value, so a stored text is never empty. */
    private fun missingOp(field: MissingField): Op<Boolean> = when (field) {
        MissingField.DESCRIPTION -> GamesTable.description.isNull()
        MissingField.COVER_IMAGE_URL -> GamesTable.coverImageUrl.isNull()
    }

    /** One grouped count and three DISTINCT selects in one transaction; see [GameRepository.findUsedFilterValues]. */
    override suspend fun findUsedFilterValues(): UsedGameFilterValues = dbQuery {
        val platformCounts = GameToPlatformTable.select(
            GameToPlatformTable.platformId,
            GameToPlatformTable.platformId.count(),
        )
            .groupBy(GameToPlatformTable.platformId)
            .associate {
                GamePlatformId.parse(it[GameToPlatformTable.platformId]) to
                    it[GameToPlatformTable.platformId.count()].toInt()
            }
        val ownership = GamesTable.select(GamesTable.ownership).withDistinct()
            .map { Ownership.from(it[GamesTable.ownership]) }
            .toSet()
        val progress = GamesTable.select(GamesTable.progress).withDistinct()
            .map { Progress.from(it[GamesTable.progress]) }
            .toSet()
        val releaseYears = GamesTable.select(GamesTable.releaseYear).withDistinct()
            .map { ReleaseYear(it[GamesTable.releaseYear]) }
            .toSet()
        UsedGameFilterValues(platformCounts, ownership, progress, releaseYears)
    }

    /**
     * One SELECT of the developer's games (inner join on the link table) in [GameSort.RELEASE_ASC] order, then
     * the shared batch loaders, so the query count is constant.
     */
    override suspend fun findByDeveloper(developerId: GameDeveloperId): List<Game> = dbQuery {
        val rows = (GamesTable innerJoin GameToDeveloperTable)
            .select(GamesTable.columns)
            .where { GameToDeveloperTable.developerId eq developerId.toString() }
            .orderBy(*orderingFor(GameSort.RELEASE_ASC))
            .toList()
        hydrate(rows)
    }

    /**
     * One SELECT of the series' games (inner join on the link table), ordered by `position IS NULL` first
     * (MariaDB has no `NULLS LAST`; a plain ASC sort puts NULLs first), then position, title and id; then the
     * shared batch loaders, so the query count is constant.
     */
    override suspend fun findBySeries(seriesId: GameSeriesId): List<Game> = dbQuery {
        val rows = (GamesTable innerJoin GameToSeriesTable)
            .select(GamesTable.columns)
            .where { GameToSeriesTable.seriesId eq seriesId.toString() }
            .orderBy(
                GameToSeriesTable.position.isNull() to SortOrder.ASC,
                GameToSeriesTable.position to SortOrder.ASC,
                GamesTable.title to SortOrder.ASC,
                GamesTable.id to SortOrder.ASC,
            )
            .toList()
        hydrate(rows)
    }

    /**
     * Maps a page of rows (with or without the extra `score` column) to a [Page] of [Game], loading platforms
     * and developers with one join query each, regardless of page size.
     */
    private fun pageOf(rows: List<ResultRow>, request: PageRequest, total: Long): Page<Game> =
        Page(hydrate(rows), request.page, request.size, total)

    private fun hydrate(rows: List<ResultRow>): List<Game> {
        val gameIds = rows.map { it[GamesTable.id] }.toSet()
        val platformsByGame = platformsFor(gameIds)
        val developersByGame = developersFor(gameIds)
        val seriesByGame = seriesFor(gameIds)
        return rows.map { row ->
            row.toGame(
                platformsByGame[row[GamesTable.id]].orEmpty().sortedForGame(),
                developersByGame[row[GamesTable.id]].orEmpty().sortedByNameForGame(),
                seriesByGame[row[GamesTable.id]].orEmpty().sortedByNameForGame(),
            )
        }
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

    /** One query for all requested game ids: no N+1 when loading a page of games. */
    private fun developersFor(gameIds: Set<String>): Map<String, List<GameDeveloper>> {
        if (gameIds.isEmpty()) return emptyMap()
        return (GameToDeveloperTable innerJoin GameDevelopersTable)
            .select(GameToDeveloperTable.gameId, GameDevelopersTable.id, GameDevelopersTable.name)
            .where { GameToDeveloperTable.gameId inList gameIds }
            .groupBy({ it[GameToDeveloperTable.gameId] }, { it.toGameDeveloper() })
    }

    /** One query for all requested game ids: no N+1 when loading a page of games. */
    private fun seriesFor(gameIds: Set<String>): Map<String, List<GameSeriesEntry>> {
        if (gameIds.isEmpty()) return emptyMap()
        return (GameToSeriesTable innerJoin GameSeriesTable)
            .select(
                GameToSeriesTable.gameId,
                GameSeriesTable.id,
                GameSeriesTable.name,
                GameToSeriesTable.position,
            )
            .where { GameToSeriesTable.gameId inList gameIds }
            .groupBy({ it[GameToSeriesTable.gameId] }, { it.toGameSeriesEntry() })
    }

    private fun insertPlatformLinks(game: Game) {
        GameToPlatformTable.batchInsert(game.platforms) { platform ->
            this[GameToPlatformTable.gameId] = game.id.toString()
            this[GameToPlatformTable.platformId] = platform.id.toString()
        }
    }

    private fun insertDeveloperLinks(game: Game) {
        GameToDeveloperTable.batchInsert(game.developers) { developer ->
            this[GameToDeveloperTable.gameId] = game.id.toString()
            this[GameToDeveloperTable.developerId] = developer.id.toString()
        }
    }

    private fun insertSeriesLinks(game: Game) {
        GameToSeriesTable.batchInsert(game.series) { entry ->
            this[GameToSeriesTable.gameId] = game.id.toString()
            this[GameToSeriesTable.seriesId] = entry.series.id.toString()
            this[GameToSeriesTable.position] = entry.position?.value?.setScale(SeriesPosition.MAX_SCALE)
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
        this[GamesTable.releaseDate] = game.releaseDate?.value
    }

    private fun ResultRow.toGamePlatform() = GamePlatform(
        id = GamePlatformId(Uuid.parseHexDash(this[GamePlatformsTable.id])),
        label = PlatformLabel(this[GamePlatformsTable.label]),
        color = HexColor(this[GamePlatformsTable.associatedColor]),
    )

    private fun ResultRow.toGameDeveloper() = GameDeveloper(
        id = GameDeveloperId(Uuid.parseHexDash(this[GameDevelopersTable.id])),
        name = VocabularyName(this[GameDevelopersTable.name]),
    )

    private fun ResultRow.toGameSeriesEntry() = GameSeriesEntry(
        series = GameSeries(
            id = GameSeriesId(Uuid.parseHexDash(this[GameSeriesTable.id])),
            name = VocabularyName(this[GameSeriesTable.name]),
        ),
        position = this[GameToSeriesTable.position]?.let(SeriesPosition::of),
    )

    // Re-running the value-object validation on read is intentional: a corrupt row (e.g. one with no
    // junction rows, which fails Game's "at least one platform" check) surfaces as a 400 validation_error
    // instead of leaking invalid data into the domain.
    private fun ResultRow.toGame(
        platforms: List<GamePlatform>,
        developers: List<GameDeveloper>,
        series: List<GameSeriesEntry>,
    ) = Game(
        id = GameId(Uuid.parseHexDash(this[GamesTable.id])),
        title = Title(this[GamesTable.title]),
        releaseYear = ReleaseYear(this[GamesTable.releaseYear]),
        platforms = platforms,
        description = this[GamesTable.description]?.let(::Description),
        rating = this[GamesTable.rating]?.let(::Rating),
        coverImageUrl = this[GamesTable.coverImageUrl]?.let(::CoverImageUrl),
        ownership = Ownership.from(this[GamesTable.ownership]),
        progress = Progress.from(this[GamesTable.progress]),
        releaseDate = this[GamesTable.releaseDate]?.let(::ReleaseDate),
        developers = developers,
        series = series,
        hidden = this[GamesTable.hidden],
    )
}
