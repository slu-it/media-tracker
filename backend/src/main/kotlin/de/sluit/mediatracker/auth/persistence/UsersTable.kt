package de.sluit.mediatracker.auth.persistence

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.datetime.timestamp

/*
 * These objects are Exposed's view of the schema for queries. The schema itself is defined by the Flyway
 * scripts in src/main/resources/db/migration; every change there must be mirrored here (and vice versa).
 * SchemaDriftTest fails when the two disagree, and DatabaseFactory logs a warning at startup. Every table
 * object lives next to its repository and is registered in [de.sluit.mediatracker.allTables] (Schema.kt).
 */

object UsersTable : Table("users") {
    val id = long("id").autoIncrement()
    val username = varchar("username", 64).uniqueIndex()

    /** PHC-formatted Argon2id string, see [de.sluit.mediatracker.auth.domain.PasswordHasher]. */
    val passwordHash = varchar("password_hash", 255)
    val createdAt = timestamp("created_at")

    override val primaryKey = PrimaryKey(id)
}
