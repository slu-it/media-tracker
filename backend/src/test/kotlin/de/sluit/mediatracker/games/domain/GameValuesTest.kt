package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
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
    fun `title must be non-blank and at most 256 characters`() {
        rejects("title") { Title("") }
        rejects("title") { Title("   ") }
        rejects("title") { Title("x".repeat(257)) }
        assertEquals("x".repeat(256), Title("x".repeat(256)).value)
        assertEquals("Zelda", Title("Zelda").toString())
    }

    @Test
    fun `release year is a four-digit number`() {
        rejects("releaseYear") { ReleaseYear(999) }
        rejects("releaseYear") { ReleaseYear(10000) }
        assertEquals(1000, ReleaseYear(1000).value)
        assertEquals(9999, ReleaseYear(9999).value)
    }

    @Test
    fun `description must be non-blank and at most 10000 characters`() {
        rejects("description") { Description("") }
        rejects("description") { Description("   ") }
        rejects("description") { Description("x".repeat(10001)) }
        assertEquals("x".repeat(10000), Description("x".repeat(10000)).value)
    }

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
    fun `hex color must be a 6-digit hex string without a leading hash`() {
        rejects("associatedColor") { HexColor("") }
        rejects("associatedColor") { HexColor("#757575") }
        rejects("associatedColor") { HexColor("75757") }
        rejects("associatedColor") { HexColor("7575759") }
        rejects("associatedColor") { HexColor("GGGGGG") }
        assertEquals("aa00FF", HexColor("aa00FF").value)
    }

    @Test
    fun `game platform id parses only the 36-character hex-dash form`() {
        val id = GamePlatformId(Uuid.random())
        assertEquals(id, GamePlatformId.parse(id.toString()))
        rejects("platformIds") { GamePlatformId.parse("nope") }
        rejects("platformIds") { GamePlatformId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `cover image url must be an absolute http(s) url of bounded length`() {
        rejects("coverImageUrl") { CoverImageUrl("") }
        rejects("coverImageUrl") { CoverImageUrl("/covers/zelda.png") }
        rejects("coverImageUrl") { CoverImageUrl("ftp://example.org/zelda.png") }
        rejects("coverImageUrl") { CoverImageUrl("http://") }
        rejects("coverImageUrl") { CoverImageUrl("not a url") }
        rejects("coverImageUrl") { CoverImageUrl("https://example.org/" + "x".repeat(2048)) }
        assertEquals("https://example.org/z.png", CoverImageUrl("https://example.org/z.png").value)
        assertEquals("http://example.org/z.png", CoverImageUrl("http://example.org/z.png").value)
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

        val unchanged = GamePatch().applyTo(game, game.platforms)
        assertEquals(game, unchanged)

        val retitled = GamePatch(title = Title("New")).applyTo(game, game.platforms)
        assertEquals("New", retitled.title.value)
        assertEquals(game.coverImageUrl, retitled.coverImageUrl)

        val xbox = platform("Xbox")
        val replatformed = GamePatch(platformIds = setOf(xbox.id)).applyTo(game, listOf(xbox))
        assertEquals(listOf(xbox), replatformed.platforms)

        val cleared = GamePatch(
            description = Patch.Change(null),
            rating = Patch.Change(null),
            coverImageUrl = Patch.Change(null),
        ).applyTo(game, game.platforms)
        assertNull(cleared.description)
        assertNull(cleared.rating)
        assertNull(cleared.coverImageUrl)

        val recovered = GamePatch(
            description = Patch.Change(Description("New description")),
            rating = Patch.Change(Rating(4.0)),
            coverImageUrl = Patch.Change(CoverImageUrl("https://example.org/n.png")),
        ).applyTo(game, game.platforms)
        assertEquals("New description", recovered.description?.value)
        assertEquals(4.0, recovered.rating?.value)
        assertEquals("https://example.org/n.png", recovered.coverImageUrl?.value)
    }
}
