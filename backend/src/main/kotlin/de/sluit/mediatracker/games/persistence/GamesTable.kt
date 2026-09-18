package de.sluit.mediatracker.games.persistence

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table

/**
 * Exposed view of the `games` table; the schema itself is db/migration/V2__games.sql. Registered in
 * [de.sluit.mediatracker.allTables] for the drift check.
 *
 * The id is the UUID in 36-character hex-dash form: readable in SQL tools and identical on MySQL and H2
 * (Exposed's `uuid()` would be BINARY(16) on MySQL but UUID on H2 and fail SchemaDriftTest).
 */
object GamesTable : Table("games") {
    val id = char("id", 36)
    val title = varchar("title", 256)
    val releaseYear = integer("release_year")
    val description = text("description").nullable()
    val rating = double("rating").nullable()
    val coverImageUrl = varchar("cover_image_url", 2048).nullable()

    override val primaryKey = PrimaryKey(id)
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
