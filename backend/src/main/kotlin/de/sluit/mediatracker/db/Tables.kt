package de.sluit.mediatracker.db

import de.sluit.mediatracker.games.persistence.GamePlatformsTable
import de.sluit.mediatracker.games.persistence.GameToPlatformTable
import de.sluit.mediatracker.games.persistence.GamesTable
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.datetime.timestamp

/*
 * These objects are Exposed's view of the schema for queries. The schema itself is defined by the Flyway
 * scripts in src/main/resources/db/migration; every change there must be mirrored here (and vice versa).
 * SchemaDriftTest fails when the two disagree, and DatabaseFactory logs a warning at startup.
 *
 * Feature packages keep their own table objects next to their repositories (e.g.
 * games/persistence/GamesTable.kt); they only have to be registered in [allTables] below.
 */

object Users : Table("users") {
    val id = long("id").autoIncrement()
    val username = varchar("username", 64).uniqueIndex()

    /** PHC-formatted Argon2id string, see [de.sluit.mediatracker.auth.PasswordHasher]. */
    val passwordHash = varchar("password_hash", 255)
    val createdAt = timestamp("created_at")

    override val primaryKey = PrimaryKey(id)
}

/** Server-side sessions. The browser cookie carries only the (signed) `id`. */
object Sessions : Table("sessions") {
    val id = varchar("id", 64)

    // Explicit index on the FK column: MySQL creates one implicitly, H2 too; declaring it keeps both engines
    // and the Kotlin model in agreement for the drift check.
    val userId = long("user_id").references(Users.id, onDelete = ReferenceOption.CASCADE).index()
    val createdAt = timestamp("created_at")
    val expiresAt = timestamp("expires_at").index()

    override val primaryKey = PrimaryKey(id)
}

/** All tables the application maps; used for the schema drift check. */
val allTables = arrayOf(Users, Sessions, GamesTable, GamePlatformsTable, GameToPlatformTable)
