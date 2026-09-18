package de.sluit.mediatracker.auth.persistence

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.datetime.timestamp

/** Server-side sessions. The browser cookie carries only the (signed) `id`. */
object SessionsTable : Table("sessions") {
    val id = varchar("id", 64)

    // Explicit index on the FK column: MySQL creates one implicitly, H2 too; declaring it keeps both engines
    // and the Kotlin model in agreement for the drift check.
    val userId = long("user_id").references(UsersTable.id, onDelete = ReferenceOption.CASCADE).index()
    val createdAt = timestamp("created_at")
    val expiresAt = timestamp("expires_at").index()

    override val primaryKey = PrimaryKey(id)
}
