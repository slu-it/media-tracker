package de.sluit.mediatracker.games.persistence

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table

/**
 * Exposed view of the `games` table; the schema itself is db/migration/V002__games.sql. Registered in
 * [de.sluit.mediatracker.allTables] for the drift check.
 *
 * The id is the UUID in 36-character hex-dash form: readable in SQL tools (Exposed's `uuid()` column would be
 * BINARY(16) on MariaDB).
 */
object GamesTable : Table("games") {
    val id = char("id", 36)
    val title = varchar("title", 256)
    val releaseYear = integer("release_year")
    val description = text("description").nullable()
    val rating = double("rating").nullable()
    val coverImageUrl = varchar("cover_image_url", 2048).nullable()

    override val primaryKey = PrimaryKey(id)

    init {
        // V004: title-ordered listing. (title, id) so it is not an "excess" twin of ft_games_title for the
        // drift check; InnoDB appends the primary key to every secondary index anyway.
        index("idx_games_title", false, title, id)

        // V005: FULLTEXT indexes for game search. The type is never emitted because the indexes always exist
        // after Flyway and Index.equals ignores indexType.
        index("ft_games_title", false, title, indexType = "FULLTEXT")
        index("ft_games_description", false, description, indexType = "FULLTEXT")
    }
}

/** Exposed view of the `game_platforms` table; the four rows seeded by the migration never change ids. */
object GamePlatformsTable : Table("game_platforms") {
    val id = char("id", 36)
    val label = varchar("label", 64).uniqueIndex("uq_game_platforms_label")
    val associatedColor = char("associated_color", 6)

    override val primaryKey = PrimaryKey(id)
}

/** Junction table for the games <-> game_platforms many-to-many relation. */
object GameToPlatformTable : Table("game_to_platform") {
    val gameId = char("game_id", 36)
        .references(GamesTable.id, onDelete = ReferenceOption.CASCADE, fkName = "fk_game_to_platform_game")
        .index("idx_game_to_platform_game")
    val platformId = char("platform_id", 36)
        .references(GamePlatformsTable.id, fkName = "fk_game_to_platform_platform")
        .index("idx_game_to_platform_platform")

    override val primaryKey = PrimaryKey(gameId, platformId)
}
