package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.persistence.BookAuthorsTable
import de.sluit.mediatracker.books.persistence.BooksBackupSource
import de.sluit.mediatracker.books.persistence.BooksTable
import de.sluit.mediatracker.books.persistence.ExposedBookAuthorRepository
import de.sluit.mediatracker.books.persistence.ExposedBookRepository
import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.game
import de.sluit.mediatracker.games.persistence.ExposedExpansionRepository
import de.sluit.mediatracker.games.persistence.ExposedGameDeveloperRepository
import de.sluit.mediatracker.games.persistence.ExposedGameRepository
import de.sluit.mediatracker.games.persistence.GamesBackupSource
import de.sluit.mediatracker.games.persistence.GamesTable
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
 * class owns no tables of its own. `game_platforms` is never truncated by [withFreshDatabase], so it doubles as
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
