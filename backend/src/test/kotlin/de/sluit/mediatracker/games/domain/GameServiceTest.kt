package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.SeriesPosition
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.developer
import de.sluit.mediatracker.games.game
import de.sluit.mediatracker.games.series
import de.sluit.mediatracker.games.seriesEntry
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.confirmVerified
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

/**
 * Mocks only [GameRepository] and [GamePlatformRepository] (the persistence ports); everything else is real,
 * so these tests exercise the actual id assignment, patch application and platform resolution logic.
 */
class GameServiceTest {
    private val games = mockk<GameRepository>()
    private val platforms = mockk<GamePlatformRepository>()
    private val developers = mockk<GameDeveloperRepository>()
    private val seriesRepository = mockk<GameSeriesRepository>()
    private val service = GameService(games, platforms, developers, seriesRepository)

    @Test
    fun `create assigns a new id and stores the game with its resolved platforms sorted by label`() = runBlocking {
        val newGame = NewGame(
            title = Title("Chrono Trigger"),
            releaseYear = ReleaseYear(1995),
            platformIds = setOf(Platforms.PC.id, Platforms.NINTENDO.id),
        )
        coEvery { platforms.findByIds(setOf(Platforms.PC.id, Platforms.NINTENDO.id)) } returns
            listOf(Platforms.PC, Platforms.NINTENDO)
        val inserted = slot<Game>()
        coEvery { games.insert(capture(inserted)) } just Runs

        val result = service.create(newGame)

        assertEquals(newGame.title, inserted.captured.title)
        assertEquals(newGame.releaseYear, inserted.captured.releaseYear)
        assertEquals(listOf(Platforms.NINTENDO, Platforms.PC), inserted.captured.platforms)
        assertEquals(emptyList(), inserted.captured.developers)
        assertEquals(inserted.captured, result)
        coVerify(exactly = 0) { developers.findByIds(any()) }
    }

    @Test
    fun `create resolves developer ids and stores them sorted by name`() = runBlocking {
        val nintendo = developer("Nintendo EPD")
        val monolith = developer("Monolith Soft")
        val newGame = NewGame(
            title = Title("Xenoblade"),
            releaseYear = ReleaseYear(2010),
            platformIds = setOf(Platforms.NINTENDO.id),
            developerIds = setOf(nintendo.id, monolith.id),
        )
        coEvery { platforms.findByIds(setOf(Platforms.NINTENDO.id)) } returns listOf(Platforms.NINTENDO)
        coEvery { developers.findByIds(setOf(nintendo.id, monolith.id)) } returns listOf(nintendo, monolith)
        val inserted = slot<Game>()
        coEvery { games.insert(capture(inserted)) } just Runs

        service.create(newGame)

        assertEquals(listOf(monolith, nintendo), inserted.captured.developers)
    }

    @Test
    fun `create derives the release year from the release date overriding a contradicting release year`() =
        runBlocking {
            val newGame = NewGame(
                title = Title("Chrono Trigger"),
                releaseYear = ReleaseYear(2020),
                platformIds = setOf(Platforms.PC.id),
                releaseDate = ReleaseDate(LocalDate.of(1995, 3, 11)),
            )
            coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
            val inserted = slot<Game>()
            coEvery { games.insert(capture(inserted)) } just Runs

            service.create(newGame)

            assertEquals(ReleaseYear(1995), inserted.captured.releaseYear)
            assertEquals(ReleaseDate(LocalDate.of(1995, 3, 11)), inserted.captured.releaseDate)
        }

    @Test
    fun `create rejects an unknown developer id naming the developerIds field`() = runBlocking {
        val known = developer("Nintendo EPD")
        val unknown = GameDeveloperId(Uuid.random())
        val newGame = NewGame(
            title = Title("Unknown Game"),
            releaseYear = ReleaseYear(2020),
            platformIds = setOf(Platforms.PC.id),
            developerIds = setOf(known.id, unknown),
        )
        coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
        coEvery { developers.findByIds(setOf(known.id, unknown)) } returns listOf(known)

        val exception = assertFailsWith<InvalidValueException> { service.create(newGame) }

        assertEquals(GameDeveloperId.FIELD, exception.field)
        coVerify(exactly = 0) { games.insert(any()) }
    }

    @Test
    fun `create stores the ownership progress and hidden values from the new game`() = runBlocking {
        val newGame = NewGame(
            title = Title("Hollow Knight"),
            releaseYear = ReleaseYear(2017),
            platformIds = setOf(Platforms.PC.id),
            ownership = Ownership.OWNED,
            progress = Progress.FINISHED,
            hidden = true,
        )
        coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
        val inserted = slot<Game>()
        coEvery { games.insert(capture(inserted)) } just Runs

        service.create(newGame)

        assertEquals(Ownership.OWNED, inserted.captured.ownership)
        assertEquals(Progress.FINISHED, inserted.captured.progress)
        assertTrue(inserted.captured.hidden)
    }

    @Test
    fun `create rejects an unknown platform id naming the platformIds field`() = runBlocking {
        val unknown = GamePlatformId(Uuid.random())
        val newGame = NewGame(
            title = Title("Unknown Game"),
            releaseYear = ReleaseYear(2020),
            platformIds = setOf(Platforms.PC.id, unknown),
        )
        coEvery { platforms.findByIds(setOf(Platforms.PC.id, unknown)) } returns listOf(Platforms.PC)

        val exception = assertFailsWith<InvalidValueException> { service.create(newGame) }

        assertEquals(GamePlatformId.FIELD, exception.field)
        assertTrue(exception.reason.contains(unknown.toString()), exception.reason)
        coVerify(exactly = 0) { games.insert(any()) }
    }

    @Test
    fun `update applies the patch to the current game and saves it`() = runBlocking {
        val id = GameId.new()
        val current = game("Old Title", id = id, description = Description("old desc"))
        coEvery { games.findById(id) } returns current
        val patch = GamePatch(title = Title("New Title"), description = Patch.Change(null))
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        val result = service.update(id, patch)

        val expected = current.copy(title = Title("New Title"), description = null)
        assertEquals(expected, saved.captured)
        assertEquals(expected, result)
    }

    @Test
    fun `update leaves ownership progress and hidden untouched when the patch carries none of them`() = runBlocking {
        val id = GameId.new()
        val current = game(
            "Some Title",
            id = id,
            ownership = Ownership.OWNED,
            progress = Progress.PLAYING,
            hidden = true,
        )
        coEvery { games.findById(id) } returns current
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(title = Title("Renamed")))

        assertEquals(Ownership.OWNED, saved.captured.ownership)
        assertEquals(Progress.PLAYING, saved.captured.progress)
        assertTrue(saved.captured.hidden)
    }

    @Test
    fun `update changes ownership progress and hidden when the patch carries them`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id)
        coEvery { games.findById(id) } returns current
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(ownership = Ownership.OWNED, progress = Progress.COMPLETED, hidden = true))

        assertEquals(Ownership.OWNED, saved.captured.ownership)
        assertEquals(Progress.COMPLETED, saved.captured.progress)
        assertTrue(saved.captured.hidden)
    }

    @Test
    fun `update unhides a hidden game when the patch carries hidden false`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id, hidden = true)
        coEvery { games.findById(id) } returns current
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(hidden = false))

        assertFalse(saved.captured.hidden)
    }

    @Test
    fun `update replaces the platforms when the patch carries platform ids`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id, platforms = listOf(Platforms.PC))
        coEvery { games.findById(id) } returns current
        coEvery { platforms.findByIds(setOf(Platforms.XBOX.id)) } returns listOf(Platforms.XBOX)
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(platformIds = setOf(Platforms.XBOX.id)))

        assertEquals(listOf(Platforms.XBOX), saved.captured.platforms)
    }

    @Test
    fun `update leaves the platforms alone when the patch has none`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id)
        coEvery { games.findById(id) } returns current
        coEvery { games.update(any()) } returns true

        service.update(id, GamePatch(title = Title("Renamed")))

        coVerify(exactly = 0) { platforms.findByIds(any()) }
    }

    @Test
    fun `update replaces the developers when the patch carries developer ids`() = runBlocking {
        val id = GameId.new()
        val nintendo = developer("Nintendo EPD")
        val current = game("Some Title", id = id)
        coEvery { games.findById(id) } returns current
        coEvery { developers.findByIds(setOf(nintendo.id)) } returns listOf(nintendo)
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(developerIds = setOf(nintendo.id)))

        assertEquals(listOf(nintendo), saved.captured.developers)
    }

    @Test
    fun `update leaves the developers alone when the patch has none`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id)
        coEvery { games.findById(id) } returns current
        coEvery { games.update(any()) } returns true

        service.update(id, GamePatch(title = Title("Renamed")))

        coVerify(exactly = 0) { developers.findByIds(any()) }
    }

    @Test
    fun `update rejects an unknown developer id before saving`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id)
        val unknown = GameDeveloperId(Uuid.random())
        coEvery { games.findById(id) } returns current
        coEvery { developers.findByIds(setOf(unknown)) } returns emptyList()

        assertFailsWith<InvalidValueException> { service.update(id, GamePatch(developerIds = setOf(unknown))) }

        coVerify(exactly = 0) { games.update(any()) }
    }

    @Test
    fun `update of an unknown game throws NotFoundException`() = runBlocking {
        val id = GameId.new()
        coEvery { games.findById(id) } returns null

        assertFailsWith<NotFoundException> { service.update(id, GamePatch(title = Title("x"))) }

        coVerify(exactly = 0) { games.update(any()) }
    }

    @Test
    fun `update rejects an unknown platform id before saving`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id)
        val unknown = GamePlatformId(Uuid.random())
        coEvery { games.findById(id) } returns current
        coEvery { platforms.findByIds(setOf(unknown)) } returns emptyList()

        assertFailsWith<InvalidValueException> { service.update(id, GamePatch(platformIds = setOf(unknown))) }

        coVerify(exactly = 0) { games.update(any()) }
    }

    @Test
    fun `update throws NotFoundException when the repository reports the game is gone`() = runBlocking {
        // findById still sees the row, but a concurrent delete wins the race before update() commits.
        val id = GameId.new()
        val current = game("Some Title", id = id)
        coEvery { games.findById(id) } returns current
        coEvery { games.update(any()) } returns false

        val exception = assertFailsWith<NotFoundException> { service.update(id, GamePatch(title = Title("Renamed"))) }

        assertEquals(id.toString(), exception.id)
    }

    @Test
    fun `delete delegates to the repository and ignores the count`() = runBlocking {
        val idA = GameId.new()
        val idB = GameId.new()
        coEvery { games.deleteById(idA) } returns 0
        coEvery { games.deleteById(idB) } returns 1

        service.delete(idA)
        service.delete(idB)

        coVerify { games.deleteById(idA) }
        coVerify { games.deleteById(idB) }
    }

    @Test
    fun `list without a search term or filters asks the repository for the page`() = runBlocking {
        val request = PageRequest(PageNumber(2), PageSize(10))
        val page = Page(listOf(game("Listed")), request.page, request.size, totalItems = 11)
        coEvery { games.findPage(request) } returns page

        val result = service.list(request, null, GameFilters.NONE)

        assertEquals(page, result)
    }

    @Test
    fun `list with a search term asks the repository to search`() = runBlocking {
        val request = PageRequest(PageNumber(2), PageSize(10))
        val term = SearchTerm("zelda")
        val page = Page(listOf(game("The Legend of Zelda")), request.page, request.size, totalItems = 1)
        coEvery { games.search(term, GameFilters.NONE, request) } returns page

        val result = service.list(request, term, GameFilters.NONE)

        assertEquals(page, result)
        coVerify(exactly = 0) { games.findPage(any()) }
    }

    @Test
    fun `list with filters but no search term takes the search branch`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val filters = GameFilters(ownership = setOf(Ownership.OWNED))
        val page = Page(listOf(game("Owned Game")), request.page, request.size, totalItems = 1)
        coEvery { games.search(null, filters, request) } returns page

        val result = service.list(request, null, filters)

        assertEquals(page, result)
        coVerify(exactly = 0) { games.findPage(any()) }
    }

    @Test
    fun `list with only a missing filter takes the search branch`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val filters = GameFilters(missing = setOf(MissingField.DESCRIPTION))
        val page = Page(listOf(game("Incomplete Game")), request.page, request.size, totalItems = 1)
        coEvery { games.search(null, filters, request) } returns page

        val result = service.list(request, null, filters)

        assertEquals(page, result)
        coVerify { games.search(null, filters, request) }
        coVerify(exactly = 0) { games.findPage(any()) }
    }

    @Test
    fun `list with a non-default sort but no search term or filters still takes the search branch`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val page = Page(listOf(game("Hades")), request.page, request.size, totalItems = 1)
        coEvery { games.search(null, GameFilters.NONE, request, GameSort.RATING_DESC) } returns page

        val result = service.list(request, null, GameFilters.NONE, GameSort.RATING_DESC)

        assertEquals(page, result)
        coVerify(exactly = 0) { games.findPage(any()) }
    }

    @Test
    fun `list with the default sort no filters and no search term asks the repository for the page`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val page = Page(listOf(game("Hades")), request.page, request.size, totalItems = 1)
        coEvery { games.findPage(request) } returns page

        val result = service.list(request, null, GameFilters.NONE, GameSort.TITLE)

        assertEquals(page, result)
        coVerify { games.findPage(request) }
        confirmVerified(games)
    }

    @Test
    fun `list with both a search term and filters passes both to the repository`() = runBlocking {
        val request = PageRequest(PageNumber(1), PageSize(10))
        val term = SearchTerm("zelda")
        val filters = GameFilters(progress = setOf(Progress.PLAYING))
        val page = Page(listOf(game("The Legend of Zelda")), request.page, request.size, totalItems = 1)
        coEvery { games.search(term, filters, request) } returns page

        val result = service.list(request, term, filters)

        assertEquals(page, result)
        coVerify { games.search(term, filters, request) }
    }

    @Test
    fun `listPlatforms returns the repository result unchanged`() = runBlocking {
        val all = listOf(Platforms.PC, Platforms.PLAYSTATION, Platforms.XBOX, Platforms.NINTENDO)
        coEvery { platforms.findAll() } returns all

        val result = service.listPlatforms()

        assertEquals(all, result)
    }

    @Test
    fun `meta composes enum order label order and newest-first years from an unordered repository answer`() =
        runBlocking {
            val labelOrdered = listOf(Platforms.NINTENDO, Platforms.PC, Platforms.PLAYSTATION, Platforms.XBOX)
            coEvery { platforms.findAll() } returns labelOrdered
            val used = UsedGameFilterValues(
                platformCounts = mapOf(Platforms.XBOX.id to 3, Platforms.NINTENDO.id to 1),
                ownership = setOf(Ownership.OWNED, Ownership.SUBSCRIPTION, Ownership.WATCHLIST),
                progress = setOf(Progress.ABANDONED, Progress.NOT_STARTED, Progress.PLAYING),
                releaseYears = setOf(ReleaseYear(2020), ReleaseYear(1998), ReleaseYear(2010)),
            )
            coEvery { games.findUsedFilterValues() } returns used

            val result = service.meta()

            assertEquals(listOf(Platforms.NINTENDO, Platforms.XBOX), result.platforms)
            assertEquals(mapOf(Platforms.XBOX.id to 3, Platforms.NINTENDO.id to 1), result.platformCounts)
            assertEquals(listOf(Ownership.WATCHLIST, Ownership.SUBSCRIPTION, Ownership.OWNED), result.ownership)
            assertEquals(listOf(Progress.ABANDONED, Progress.NOT_STARTED, Progress.PLAYING), result.progress)
            assertEquals(listOf(ReleaseYear(2020), ReleaseYear(2010), ReleaseYear(1998)), result.releaseYears)
        }

    @Test
    fun `listByDeveloper of an unknown developer throws NotFoundException without loading games`() {
        runBlocking {
            val unknown = GameDeveloperId.new()
            coEvery { developers.findByIds(setOf(unknown)) } returns emptyList()

            val exception = assertFailsWith<NotFoundException> { service.listByDeveloper(unknown) }

            assertEquals(unknown.toString(), exception.id)
            coVerify(exactly = 0) { games.findByDeveloper(any()) }
        }
    }

    @Test
    fun `listByDeveloper returns the games of a known developer in repository order`() = runBlocking {
        val nintendo = developer("Nintendo EPD")
        val found = listOf(game("One"), game("Two"))
        coEvery { developers.findByIds(setOf(nintendo.id)) } returns listOf(nintendo)
        coEvery { games.findByDeveloper(nintendo.id) } returns found

        assertEquals(found, service.listByDeveloper(nintendo.id))
    }

    @Test
    fun `create resolves series with their positions and stores them sorted by name`() = runBlocking {
        val zelda = series("The Legend of Zelda")
        val mario = series("Mario")
        val positions = mapOf(zelda.id to null, mario.id to SeriesPosition.fromDouble(2.5))
        coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
        coEvery { seriesRepository.findByIds(positions.keys) } returns listOf(zelda, mario)
        val inserted = slot<Game>()
        coEvery { games.insert(capture(inserted)) } just Runs

        service.create(NewGame(Title("Mixed"), ReleaseYear(2000), setOf(Platforms.PC.id), series = positions))

        assertEquals(listOf(seriesEntry(mario, 2.5), seriesEntry(zelda)), inserted.captured.series)
    }

    @Test
    fun `create without series does not touch the series repository`() = runBlocking {
        coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
        coEvery { games.insert(any()) } just Runs

        service.create(NewGame(Title("Plain"), ReleaseYear(2000), setOf(Platforms.PC.id)))

        coVerify(exactly = 0) { seriesRepository.findByIds(any()) }
    }

    @Test
    fun `create rejects an unknown series id naming the series field`() = runBlocking {
        val known = series("Known")
        val unknown = GameSeriesId(Uuid.random())
        val positions = mapOf<GameSeriesId, SeriesPosition?>(known.id to null, unknown to null)
        coEvery { platforms.findByIds(setOf(Platforms.PC.id)) } returns listOf(Platforms.PC)
        coEvery { seriesRepository.findByIds(positions.keys) } returns listOf(known)

        val exception = assertFailsWith<InvalidValueException> {
            service.create(NewGame(Title("Unknown"), ReleaseYear(2020), setOf(Platforms.PC.id), series = positions))
        }

        assertEquals(GameSeriesId.FIELD, exception.field)
        coVerify(exactly = 0) { games.insert(any()) }
    }

    @Test
    fun `update leaves the series alone when the patch has none`() = runBlocking {
        val id = GameId.new()
        val current = game("Some Title", id = id, series = listOf(seriesEntry(series("Old"), 1.0)))
        coEvery { games.findById(id) } returns current
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(hidden = true))

        assertEquals(current.series, saved.captured.series)
        coVerify(exactly = 0) { seriesRepository.findByIds(any()) }
    }

    @Test
    fun `update replaces the series and positions when the patch carries series`() = runBlocking {
        val id = GameId.new()
        val mario = series("Mario")
        coEvery { games.findById(id) } returns game("Some Title", id = id, series = listOf(seriesEntry(series("Old"))))
        val positions = mapOf<GameSeriesId, SeriesPosition?>(mario.id to SeriesPosition.fromDouble(1.0))
        coEvery { seriesRepository.findByIds(positions.keys) } returns listOf(mario)
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(series = positions))

        assertEquals(listOf(seriesEntry(mario, 1.0)), saved.captured.series)
    }

    @Test
    fun `update with an empty series map clears the series`() = runBlocking {
        val id = GameId.new()
        coEvery { games.findById(id) } returns game("Some Title", id = id, series = listOf(seriesEntry(series("Old"))))
        val saved = slot<Game>()
        coEvery { games.update(capture(saved)) } returns true

        service.update(id, GamePatch(series = emptyMap()))

        assertEquals(emptyList(), saved.captured.series)
        coVerify(exactly = 0) { seriesRepository.findByIds(any()) }
    }

    @Test
    fun `update rejects an unknown series id before saving`() = runBlocking {
        val id = GameId.new()
        val unknown = GameSeriesId(Uuid.random())
        coEvery { games.findById(id) } returns game("Some Title", id = id)
        coEvery { seriesRepository.findByIds(setOf(unknown)) } returns emptyList()

        assertFailsWith<InvalidValueException> { service.update(id, GamePatch(series = mapOf(unknown to null))) }

        coVerify(exactly = 0) { games.update(any()) }
    }

    @Test
    fun `listBySeries of an unknown series throws NotFoundException without loading games`() {
        runBlocking {
            val unknown = GameSeriesId.new()
            coEvery { seriesRepository.findByIds(setOf(unknown)) } returns emptyList()

            val exception = assertFailsWith<NotFoundException> { service.listBySeries(unknown) }

            assertEquals(unknown.toString(), exception.id)
            coVerify(exactly = 0) { games.findBySeries(any()) }
        }
    }

    @Test
    fun `listBySeries returns the games of a known series in repository order`() = runBlocking {
        val mario = series("Mario")
        val found = listOf(game("One"), game("Two"))
        coEvery { seriesRepository.findByIds(setOf(mario.id)) } returns listOf(mario)
        coEvery { games.findBySeries(mario.id) } returns found

        assertEquals(found, service.listBySeries(mario.id))
    }
}
