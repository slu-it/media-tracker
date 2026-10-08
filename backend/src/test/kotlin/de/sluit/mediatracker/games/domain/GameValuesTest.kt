package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.games.developer
import de.sluit.mediatracker.games.game
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.uuid.Uuid

class GameValuesTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    private fun platform(label: String, id: Uuid = Uuid.random()) =
        GamePlatform(GamePlatformId(id), PlatformLabel(label), HexColor("757575"))

    @Test
    fun `rating must be a quarter-step between 0_25 and 5_0`() {
        rejects("rating") { Rating(0.0) }
        rejects("rating") { Rating(0.3) }
        rejects("rating") { Rating(5.25) }
        rejects("rating") { Rating(Double.NaN) }
        rejects("rating") { Rating(Double.POSITIVE_INFINITY) }
        assertEquals(0.25, Rating(0.25).value)
        assertEquals(2.5, Rating(2.5).value)
        assertEquals(5.0, Rating(5.0).value)
    }

    @Test
    fun `game platform id parses only the 36-character hex-dash form`() {
        val id = GamePlatformId(Uuid.random())
        assertEquals(id, GamePlatformId.parse(id.toString()))
        rejects("platformIds") { GamePlatformId.parse("nope") }
        rejects("platformIds") { GamePlatformId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `game id parses only the 36-character hex-dash form and round-trips`() {
        val id = GameId.new()
        assertEquals(36, id.toString().length)
        assertEquals(id, GameId.parse(id.toString()))
        rejects("id") { GameId.parse("nope") }
        rejects("id") { GameId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `page number and size have bounds`() {
        rejects("page") { PageNumber(0) }
        rejects("pageSize") { PageSize(0) }
        rejects("pageSize") { PageSize(201) }
        assertEquals(200, PageSize(200).value)
        assertEquals(50, PageSize.DEFAULT.value)
    }

    @Test
    fun `cover source game id parses only positive integers`() {
        assertEquals(42L, CoverSourceGameId.parse("42").value)
        rejects("match") { CoverSourceGameId.parse("abc") }
        rejects("match") { CoverSourceGameId.parse("0") }
        rejects("match") { CoverSourceGameId.parse("-1") }
        rejects("match") { CoverSourceGameId(0) }
        rejects("match") { CoverSourceGameId(-1) }
    }

    @Test
    fun `a game requires at least one platform`() {
        rejects("platformIds") {
            Game(id = GameId.new(), title = Title("Old"), releaseYear = ReleaseYear(1999), platforms = emptyList())
        }
    }

    @Test
    fun `patch applies only the fields it carries`() {
        val pc = platform("PC")
        val playstation = platform("PlayStation")
        val game = Game(
            id = GameId.new(),
            title = Title("Old"),
            releaseYear = ReleaseYear(1999),
            platforms = listOf(pc, playstation).sortedForGame(),
            description = Description("Old description"),
            rating = Rating(3.5),
            coverImageUrl = CoverImageUrl("https://example.org/old.png"),
        )

        val unchanged = GamePatch().applyTo(game, game.platforms, game.developers)
        assertEquals(game, unchanged)

        val retitled = GamePatch(title = Title("New")).applyTo(game, game.platforms, game.developers)
        assertEquals("New", retitled.title.value)
        assertEquals(game.coverImageUrl, retitled.coverImageUrl)

        val xbox = platform("Xbox")
        val replatformed =
            GamePatch(platformIds = setOf(xbox.id)).applyTo(game, listOf(xbox), game.developers)
        assertEquals(listOf(xbox), replatformed.platforms)

        val cleared = GamePatch(
            description = Patch.Change(null),
            rating = Patch.Change(null),
            coverImageUrl = Patch.Change(null),
        ).applyTo(game, game.platforms, game.developers)
        assertNull(cleared.description)
        assertNull(cleared.rating)
        assertNull(cleared.coverImageUrl)

        val recovered = GamePatch(
            description = Patch.Change(Description("New description")),
            rating = Patch.Change(Rating(4.0)),
            coverImageUrl = Patch.Change(CoverImageUrl("https://example.org/n.png")),
        ).applyTo(game, game.platforms, game.developers)
        assertEquals("New description", recovered.description?.value)
        assertEquals(4.0, recovered.rating?.value)
        assertEquals("https://example.org/n.png", recovered.coverImageUrl?.value)
    }

    @Test
    fun `patch replaces developers only when developerIds is present`() {
        val nintendo = developer("Nintendo EPD")
        val game = game("Zelda", developers = listOf(nintendo))

        val unchanged = GamePatch().applyTo(game, game.platforms, game.developers)
        assertEquals(listOf(nintendo), unchanged.developers)

        val monolith = developer("Monolith Soft")
        val replaced =
            GamePatch(developerIds = setOf(monolith.id)).applyTo(game, game.platforms, listOf(monolith))
        assertEquals(listOf(monolith), replaced.developers)

        val cleared = GamePatch(developerIds = emptySet()).applyTo(game, game.platforms, emptyList())
        assertEquals(emptyList(), cleared.developers)
    }

    // release date <-> release year precedence (MT-025, ADR 0029)

    @Test
    fun `a game with a release date requires releaseYear to match its year`() {
        rejects("releaseDate") {
            Game(
                id = GameId.new(),
                title = Title("Zelda"),
                releaseYear = ReleaseYear(2020),
                platforms = listOf(platform("PC")),
                releaseDate = ReleaseDate(LocalDate.of(1995, 11, 21)),
            )
        }
    }

    @Test
    fun `new game effective release year is derived from the date when one is given`() {
        val platformIds = setOf(GamePlatformId(Uuid.random()))
        val withoutDate = NewGame(title = Title("Zelda"), releaseYear = ReleaseYear(2020), platformIds = platformIds)
        assertEquals(ReleaseYear(2020), withoutDate.effectiveReleaseYear)

        val withDate = NewGame(
            title = Title("Zelda"),
            releaseYear = ReleaseYear(2020),
            platformIds = platformIds,
            releaseDate = ReleaseDate(LocalDate.of(1995, 11, 21)),
        )
        assertEquals(ReleaseYear(1995), withDate.effectiveReleaseYear)
    }

    @Test
    fun `patch setting a date forces the year even when a contradicting year is also given`() {
        val game = game("Zelda", releaseYear = 2020)

        val patched = GamePatch(
            releaseYear = ReleaseYear(1999),
            releaseDate = Patch.Change(ReleaseDate(LocalDate.of(1995, 11, 21))),
        ).applyTo(game, game.platforms, game.developers)

        assertEquals(ReleaseYear(1995), patched.releaseYear)
        assertEquals(ReleaseDate(LocalDate.of(1995, 11, 21)), patched.releaseDate)
    }

    @Test
    fun `patch with only a year on a dated game is overridden by the date's year`() {
        val game = game("Zelda", releaseDate = ReleaseDate(LocalDate.of(1995, 11, 21)))

        val patched = GamePatch(releaseYear = ReleaseYear(2020)).applyTo(game, game.platforms, game.developers)

        assertEquals(ReleaseYear(1995), patched.releaseYear)
        assertEquals(ReleaseDate(LocalDate.of(1995, 11, 21)), patched.releaseDate)
    }

    @Test
    fun `patch clearing the date keeps the current year when no year is given`() {
        val game = game("Zelda", releaseDate = ReleaseDate(LocalDate.of(1995, 11, 21)))

        val patched = GamePatch(releaseDate = Patch.Change(null)).applyTo(game, game.platforms, game.developers)

        assertEquals(ReleaseYear(1995), patched.releaseYear)
        assertNull(patched.releaseDate)
    }

    @Test
    fun `patch clearing the date applies a given year instead of keeping the old one`() {
        val game = game("Zelda", releaseDate = ReleaseDate(LocalDate.of(1995, 11, 21)))

        val patched = GamePatch(
            releaseYear = ReleaseYear(2020),
            releaseDate = Patch.Change(null),
        ).applyTo(game, game.platforms, game.developers)

        assertEquals(ReleaseYear(2020), patched.releaseYear)
        assertNull(patched.releaseDate)
    }

    @Test
    fun `game developer id parses only the 36-character hex-dash form`() {
        val id = GameDeveloperId(Uuid.random())
        assertEquals(id, GameDeveloperId.parse(id.toString()))
        rejects("developerIds") { GameDeveloperId.parse("nope") }
    }
}
