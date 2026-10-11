package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.persistence.BookAuthorsTable
import de.sluit.mediatracker.books.persistence.BookNarratorsTable
import de.sluit.mediatracker.books.persistence.BookSeriesTable
import de.sluit.mediatracker.books.persistence.BooksBackupSource
import de.sluit.mediatracker.books.persistence.BooksTable
import de.sluit.mediatracker.books.persistence.ExposedBookAuthorRepository
import de.sluit.mediatracker.books.persistence.ExposedBookNarratorRepository
import de.sluit.mediatracker.books.persistence.ExposedBookRepository
import de.sluit.mediatracker.books.persistence.ExposedBookSeriesRepository
import de.sluit.mediatracker.books.persistence.ExposedBookTypeRepository
import de.sluit.mediatracker.books.seriesEntry
import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.game
import de.sluit.mediatracker.games.persistence.ExposedExpansionRepository
import de.sluit.mediatracker.games.persistence.ExposedGameDeveloperRepository
import de.sluit.mediatracker.games.persistence.ExposedGamePlatformRepository
import de.sluit.mediatracker.games.persistence.ExposedGameRepository
import de.sluit.mediatracker.games.persistence.ExposedGameSeriesRepository
import de.sluit.mediatracker.games.persistence.GameSeriesTable
import de.sluit.mediatracker.games.persistence.GamesBackupSource
import de.sluit.mediatracker.games.persistence.GamesTable
import de.sluit.mediatracker.games.seriesEntry
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.uuid.Uuid

/**
 * Tests [ExposedBackupSource] through its only real wiring, [GamesBackupSource] (MT-023, ADR 0027): the generic
 * class owns no tables of its own. `game_platforms` is restored, not truncated, by [withFreshDatabase], so it doubles as
 * the "insert if absent" coverage for the V002-seeded platforms.
 */
class ExposedBackupSourceTest {

    @Test
    fun `export then import after deleting the rows reproduces every field including nulls doubles and booleans`() =
        withFreshDatabase {
            val games = ExposedGameRepository()
            val expansions = ExposedExpansionRepository()
            val withEverything = game(
                "Celeste",
                platforms = listOf(Platforms.PC, Platforms.PLAYSTATION),
                description = Description("A climbing game"),
                rating = Rating(4.5),
                hidden = true,
                ownership = Ownership.OWNED,
                progress = Progress.FINISHED,
            )
            val bareMinimum = game("Hades", platforms = listOf(Platforms.XBOX))
            games.insert(withEverything)
            games.insert(bareMinimum)
            expansions.insert(
                Expansion(
                    id = ExpansionId.new(),
                    gameId = withEverything.id,
                    sequence = SequenceNumber(0),
                    title = Title("Farewell"),
                    ownership = Ownership.OWNED,
                    progress = Progress.FINISHED,
                ),
            )

            val exported = GamesBackupSource.export()

            dbQuery { GamesTable.deleteAll() } // cascades to game_to_platform and game_expansions

            val result = GamesBackupSource.import(exported)

            assertEquals(2, result.getValue("games").inserted)
            assertEquals(0, result.getValue("games").skipped)
            assertEquals(exported, GamesBackupSource.export())
        }

    @Test
    fun `a second import of the same export skips every row`() = withFreshDatabase {
        val games = ExposedGameRepository()
        games.insert(game("Celeste"))
        val exported = GamesBackupSource.export()
        dbQuery { GamesTable.deleteAll() }

        val first = GamesBackupSource.import(exported)
        assertEquals(1, first.getValue("games").inserted)
        assertEquals(0, first.getValue("games").skipped)

        val second = GamesBackupSource.import(exported)
        assertEquals(0, second.getValue("games").inserted)
        assertEquals(1, second.getValue("games").skipped)
        assertEquals(0, second.getValue("game_to_platform").inserted)
        assertEquals(1, second.getValue("game_to_platform").skipped)
    }

    @Test
    fun `importing the seeded platforms skips all four`() = withFreshDatabase {
        val exported = GamesBackupSource.export()

        val result = GamesBackupSource.import(mapOf("game_platforms" to exported.getValue("game_platforms")))

        assertEquals(0, result.getValue("game_platforms").inserted)
        assertEquals(4, result.getValue("game_platforms").skipped)
    }

    @Test
    fun `import rejects a row with an unknown column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("bogus" to "nope")

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a row missing a column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() - "hidden"

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a null value for a non-null column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("hidden" to null)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.hidden", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a string value for a boolean column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("hidden" to "yes")

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.hidden", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects an out-of-range long for an integer column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("release_year" to 99_999_999_999L)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.release_year", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a double value for an integer column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("release_year" to 1.5)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.release_year", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a title longer than the varchar column and writes nothing`() = withFreshDatabase {
        val row = validGameRow(title = "a".repeat(257))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.title", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects an id longer than the char column and writes nothing`() = withFreshDatabase {
        val row = validGameRow(id = "a".repeat(37))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.id", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects two rows sharing a primary key and writes nothing`() = withFreshDatabase {
        val id = Uuid.random().toString()
        val rows = listOf(validGameRow(id = id, title = "Celeste"), validGameRow(id = id, title = "Hades"))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to rows))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `a whole-number json value for a double column round-trips as a double`() = withFreshDatabase {
        val row = validGameRow() + ("rating" to 4L)

        GamesBackupSource.import(mapOf("games" to listOf(row)))

        val exported = GamesBackupSource.export().getValue("games").single()
        assertEquals(4.0, exported["rating"])
    }

    @Test
    fun `importing a row whose primary key differs only by case from an existing row is skipped`() = withFreshDatabase {
        val games = ExposedGameRepository()
        val existing = game("Celeste")
        games.insert(existing)
        val row = validGameRow(id = existing.id.toString().uppercase(), title = "Celeste")

        val result = GamesBackupSource.import(mapOf("games" to listOf(row)))

        assertEquals(0, result.getValue("games").inserted)
        assertEquals(1, result.getValue("games").skipped)
    }

    @Test
    fun `a dangling foreign key rolls back the whole source`() = withFreshDatabase {
        val gameId = Uuid.random().toString()
        val gameRow = validGameRow(id = gameId)
        val danglingLink: BackupRow = mapOf(
            "game_id" to gameId,
            "platform_id" to Uuid.random().toString(), // no such platform
        )

        assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(gameRow), "game_to_platform" to listOf(danglingLink)))
        }

        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    // developers and release date (MT-025, ADR 0029)

    @Test
    fun `export then import reproduces a release date and its developers`() = withFreshDatabase {
        val games = ExposedGameRepository()
        val developers = ExposedGameDeveloperRepository()
        val nintendo = developers.create(VocabularyName("Nintendo EPD")).entry
        val monolith = developers.create(VocabularyName("Monolith Soft")).entry
        val withEverything = game(
            "Chrono Trigger",
            releaseDate = ReleaseDate(LocalDate.of(1995, 3, 11)),
            developers = listOf(nintendo, monolith),
        )
        games.insert(withEverything)

        val exported = GamesBackupSource.export()

        dbQuery { GamesTable.deleteAll() } // cascades to game_to_platform, game_expansions and game_to_developer

        val result = GamesBackupSource.import(exported)

        assertEquals(1, result.getValue("games").inserted)
        assertEquals(0, result.getValue("game_developers").inserted) // already there, never truncated by insert
        assertEquals(2, result.getValue("game_to_developer").inserted)
        assertEquals(exported, GamesBackupSource.export())
        assertEquals(ReleaseDate(LocalDate.of(1995, 3, 11)), games.findById(withEverything.id)?.releaseDate)
    }

    @Test
    fun `importing a game row without a release_date column defaults it to null`() = withFreshDatabase {
        // No "release_date" key at all: what a backup taken before V010 added the column would still contain,
        // and no "game_developers"/"game_to_developer" keys either, as if from before those tables existed.
        val row = validGameRow()

        val result = GamesBackupSource.import(mapOf("games" to listOf(row)))

        assertEquals(1, result.getValue("games").inserted)
        val storedReleaseDate = dbQuery {
            GamesTable.selectAll().where { GamesTable.id eq (row.getValue("id") as String) }
                .single()[GamesTable.releaseDate]
        }
        assertNull(storedReleaseDate)
    }

    // books (ADR 0034)

    @Test
    fun `export then import reproduces a book with its release date types and author`() = withFreshDatabase {
        val books = ExposedBookRepository()
        val herbert = ExposedBookAuthorRepository().create(VocabularyName("Frank Herbert")).entry
        books.insert(
            book(
                "Dune",
                types = listOf(BookTypes.HARDCOVER, BookTypes.KINDLE),
                releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)),
                authors = listOf(herbert),
            ),
        )

        val exported = BooksBackupSource.export()

        // cascades to book_to_type and book_to_author; the seeded book_types stay
        dbQuery {
            BooksTable.deleteAll()
            BookAuthorsTable.deleteAll()
        }

        val result = BooksBackupSource.import(exported)

        assertEquals(1, result.getValue("books").inserted)
        assertEquals(0, result.getValue("book_types").inserted)
        assertEquals(1, result.getValue("book_authors").inserted)
        assertEquals(2, result.getValue("book_to_type").inserted)
        assertEquals(1, result.getValue("book_to_author").inserted)
        assertEquals(exported, BooksBackupSource.export())
    }

    @Test
    fun `export then import reproduces narrators and series with and without a decimal position`() = withFreshDatabase {
        val books = ExposedBookRepository()
        val kramer = ExposedBookNarratorRepository().create(VocabularyName("Michael Kramer")).entry
        val seriesRepo = ExposedBookSeriesRepository()
        val mistborn = seriesRepo.create(VocabularyName("Mistborn")).entry
        val cosmere = seriesRepo.create(VocabularyName("The Cosmere")).entry
        books.insert(
            book(
                "The Final Empire",
                narrators = listOf(kramer),
                series = listOf(seriesEntry(mistborn, 2.5), seriesEntry(cosmere)),
            ),
        )

        val exported = BooksBackupSource.export()

        // the DECIMAL position is dumped as a JSON number, null stays null
        val positions = exported.getValue("book_to_series").associate { it["series_id"] to it["position"] }
        assertEquals(2.5, positions[mistborn.id.toString()])
        assertNull(positions[cosmere.id.toString()])
        dbQuery {
            BooksTable.deleteAll()
            BookNarratorsTable.deleteAll()
            BookSeriesTable.deleteAll()
        }

        val result = BooksBackupSource.import(exported)

        assertEquals(1, result.getValue("book_narrators").inserted)
        assertEquals(1, result.getValue("book_to_narrator").inserted)
        assertEquals(2, result.getValue("book_series").inserted)
        assertEquals(2, result.getValue("book_to_series").inserted)
        assertEquals(exported, BooksBackupSource.export())
    }

    @Test
    fun `import rejects a decimal position that does not fit the column`() {
        val row = mapOf<String, Any?>(
            "book_id" to Uuid.random().toString(),
            "series_id" to Uuid.random().toString(),
        )

        listOf(10000.0, 1.234, "x").forEach { position ->
            assertFailsWith<InvalidValueException> {
                BooksBackupSource.validate(mapOf("book_to_series" to listOf(row + ("position" to position))))
            }
        }
        BooksBackupSource.validate(mapOf("book_to_series" to listOf(row + ("position" to 9999.99))))
        BooksBackupSource.validate(mapOf("book_to_series" to listOf(row)))
    }

    @Test
    fun `export then import reproduces game series with and without a decimal position`() = withFreshDatabase {
        val games = ExposedGameRepository()
        val seriesRepo = ExposedGameSeriesRepository()
        val zelda = seriesRepo.create(VocabularyName("The Legend of Zelda")).entry
        val mario = seriesRepo.create(VocabularyName("Mario")).entry
        games.insert(game("Crossover", series = listOf(seriesEntry(zelda, 2.5), seriesEntry(mario))))

        val exported = GamesBackupSource.export()

        // the DECIMAL position is dumped as a JSON number, null stays null
        val positions = exported.getValue("game_to_series").associate { it["series_id"] to it["position"] }
        assertEquals(2.5, positions[zelda.id.toString()])
        assertNull(positions[mario.id.toString()])
        dbQuery {
            GamesTable.deleteAll()
            GameSeriesTable.deleteAll()
        }

        val result = GamesBackupSource.import(exported)

        assertEquals(2, result.getValue("game_series").inserted)
        assertEquals(2, result.getValue("game_to_series").inserted)
        assertEquals(exported, GamesBackupSource.export())
    }

    @Test
    fun `import rejects a game series position that does not fit the column`() {
        val row = mapOf<String, Any?>(
            "game_id" to Uuid.random().toString(),
            "series_id" to Uuid.random().toString(),
        )

        listOf(10000.0, 1.234, "x").forEach { position ->
            assertFailsWith<InvalidValueException> {
                GamesBackupSource.validate(mapOf("game_to_series" to listOf(row + ("position" to position))))
            }
        }
        GamesBackupSource.validate(mapOf("game_to_series" to listOf(row + ("position" to 9999.99))))
        GamesBackupSource.validate(mapOf("game_to_series" to listOf(row)))
    }

    // editable vocabularies: an existing row is overwritten, `updated` reports it

    @Test
    fun `importing an edited seeded platform and an added one updates and inserts them`() = withFreshDatabase {
        val platforms = ExposedGamePlatformRepository()
        platforms.update(Platforms.PC.id, PlatformLabel("Personal Computer"), HexColor("AABBCC"))
        val added = (platforms.create(PlatformLabel("Switch 2"), HexColor("FF0000")) as CreateOutcome.Created).entry
        val exported = GamesBackupSource.export()
        resetSeededReferenceData()

        val result = GamesBackupSource.import(exported)

        val platformsResult = result.getValue("game_platforms")
        assertEquals(1, platformsResult.inserted)
        assertEquals(3, platformsResult.skipped)
        assertEquals(1, platformsResult.updated)
        assertEquals(exported, GamesBackupSource.export())
        assertEquals(
            setOf("Personal Computer", "Switch 2"),
            platforms.findByIds(setOf(Platforms.PC.id, added.id)).map {
                it.label.value
            }.toSet(),
        )
        assertEquals(0, result.getValue("games").updated)
    }

    @Test
    fun `importing unchanged platforms updates nothing`() = withFreshDatabase {
        val exported = GamesBackupSource.export()

        val result = GamesBackupSource.import(exported)

        assertEquals(4, result.getValue("game_platforms").skipped)
        assertEquals(0, result.getValue("game_platforms").updated)
    }

    @Test
    fun `a platform label held by a different id rolls back the whole source`() = withFreshDatabase {
        val exported = GamesBackupSource.export()
        val clashing = exported.getValue("game_platforms").map {
            if (it["id"] == SeededPlatforms.PC) it + ("label" to "Xbox") else it
        }
        val game = validGameRow()

        assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(
                mapOf("game_platforms" to clashing, "games" to listOf(game)),
            )
        }

        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
        assertEquals("PC", ExposedGamePlatformRepository().findByIds(setOf(Platforms.PC.id)).single().label.value)
    }

    private suspend fun platformLabels(): Map<String, String> =
        GamesBackupSource.export().getValue("game_platforms").associate { it["id"] as String to it["label"] as String }

    private suspend fun relabelled(vararg changes: Pair<String, String>): List<BackupRow> {
        val byId = changes.toMap()
        return GamesBackupSource.export().getValue("game_platforms").map { row ->
            byId[row["id"]]?.let { row + ("label" to it) } ?: row
        }
    }

    @Test
    fun `importing a swap of two platform labels succeeds`() = withFreshDatabase {
        val result = GamesBackupSource.import(
            mapOf(
                "game_platforms" to relabelled(SeededPlatforms.PC to "Xbox", SeededPlatforms.XBOX to "PC"),
            ),
        )

        assertEquals(2, result.getValue("game_platforms").updated)
        assertEquals("Xbox", platformLabels().getValue(SeededPlatforms.PC))
        assertEquals("PC", platformLabels().getValue(SeededPlatforms.XBOX))
    }

    @Test
    fun `importing a chain of platform renames succeeds`() = withFreshDatabase {
        val result = GamesBackupSource.import(
            mapOf(
                "game_platforms" to relabelled(
                    SeededPlatforms.PC to "Xbox",
                    SeededPlatforms.XBOX to "Nintendo",
                    SeededPlatforms.NINTENDO to "Free",
                ),
            ),
        )

        assertEquals(3, result.getValue("game_platforms").updated)
        val labels = platformLabels()
        assertEquals("Xbox", labels.getValue(SeededPlatforms.PC))
        assertEquals("Nintendo", labels.getValue(SeededPlatforms.XBOX))
        assertEquals("Free", labels.getValue(SeededPlatforms.NINTENDO))
    }

    @Test
    fun `a platform renamed to a label of a row outside the update set still fails and changes nothing`() =
        withFreshDatabase {
            val before = GamesBackupSource.export()

            assertFailsWith<InvalidValueException> {
                GamesBackupSource.import(
                    mapOf("game_platforms" to relabelled(SeededPlatforms.PC to "Xbox")),
                )
            }

            assertEquals(before, GamesBackupSource.export())
        }

    @Test
    fun `import rejects an invalid platform label or colour in an updated row and changes nothing`() =
        withFreshDatabase {
            val before = GamesBackupSource.export()
            val invalid = listOf(
                "label" to " padded ",
                "label" to "   ",
                "label" to "x".repeat(65),
                "associated_color" to "GGGGGG",
                "associated_color" to "12345",
            )

            invalid.forEach { (column, value) ->
                val rows = before.getValue("game_platforms").map {
                    if (it["id"] == SeededPlatforms.PC) it + (column to value) else it
                }
                val ex = assertFailsWith<InvalidValueException> {
                    GamesBackupSource.import(mapOf("game_platforms" to rows))
                }
                assertEquals("game_platforms.$column", ex.field)
                assertEquals(before, GamesBackupSource.export())
            }
        }

    @Test
    fun `validate rejects an invalid label or colour in an inserted platform row and book type row`() {
        val platform = mapOf("id" to Uuid.random().toString(), "label" to "Switch 2", "associated_color" to "FF0000")
        val type = mapOf("id" to Uuid.random().toString(), "label" to "Comic", "associated_color" to "FF0000")

        listOf("label" to " Switch ", "associated_color" to "red").forEach { (column, value) ->
            assertFailsWith<InvalidValueException> {
                GamesBackupSource.validate(mapOf("game_platforms" to listOf(platform + (column to value))))
            }
            assertFailsWith<InvalidValueException> {
                BooksBackupSource.validate(mapOf("book_types" to listOf(type + (column to value))))
            }
        }
        GamesBackupSource.validate(mapOf("game_platforms" to listOf(platform)))
        BooksBackupSource.validate(mapOf("book_types" to listOf(type)))
    }

    @Test
    fun `a lowercase colour is stored uppercase on update and on insert`() = withFreshDatabase {
        val added = mapOf("id" to Uuid.random().toString(), "label" to "Switch 2", "associated_color" to "ff00ff")
        val rows = GamesBackupSource.export().getValue("game_platforms").map {
            if (it["id"] == SeededPlatforms.PC) it + ("associated_color" to "aabbcc") else it
        } + added

        GamesBackupSource.import(mapOf("game_platforms" to rows))

        val colors = GamesBackupSource.export().getValue("game_platforms")
            .associate { it["id"] to it["associated_color"] }
        assertEquals("AABBCC", colors[SeededPlatforms.PC])
        assertEquals("FF00FF", colors[added["id"]])
    }

    @Test
    fun `importing an edited seeded book type and an added one updates and inserts them`() = withFreshDatabase {
        val types = ExposedBookTypeRepository()
        types.update(BookTypes.KINDLE.id, BookTypeLabel("E-Book"), HexColor("010203"))
        val added = (types.create(BookTypeLabel("Comic"), HexColor("FF00FF")) as CreateOutcome.Created).entry
        val exported = BooksBackupSource.export()
        resetSeededReferenceData()

        val result = BooksBackupSource.import(exported)

        val typesResult = result.getValue("book_types")
        assertEquals(1, typesResult.inserted)
        assertEquals(3, typesResult.skipped)
        assertEquals(1, typesResult.updated)
        assertEquals(exported, BooksBackupSource.export())
        assertEquals(
            setOf("E-Book", "Comic"),
            types.findByIds(setOf(BookTypes.KINDLE.id, added.id)).map {
                it.label.value
            }.toSet(),
        )
        assertEquals(0, result.getValue("books").updated)
    }

    @Test
    fun `a book type label held by a different id is rejected`() = withFreshDatabase {
        val exported = BooksBackupSource.export()
        val clashing = exported.getValue("book_types").map {
            if (it["id"] == SeededBookTypes.HARDCOVER) it + ("label" to "Kindle") else it
        }

        assertFailsWith<InvalidValueException> { BooksBackupSource.import(mapOf("book_types" to clashing)) }

        assertEquals(
            "Hardcover",
            ExposedBookTypeRepository().findByIds(setOf(BookTypes.HARDCOVER.id)).single().label.value,
        )
    }

    private fun validGameRow(
        id: String = Uuid.random().toString(),
        title: String = "Celeste",
        releaseYear: Long = 2018L,
        description: String? = null,
        rating: Double? = null,
        coverImageUrl: String? = null,
        ownership: String = Ownership.DEFAULT.wire,
        progress: String = Progress.DEFAULT.wire,
        hidden: Boolean = false,
    ): BackupRow = mapOf(
        "id" to id,
        "title" to title,
        "release_year" to releaseYear,
        "description" to description,
        "rating" to rating,
        "cover_image_url" to coverImageUrl,
        "ownership" to ownership,
        "progress" to progress,
        "hidden" to hidden,
    )
}
