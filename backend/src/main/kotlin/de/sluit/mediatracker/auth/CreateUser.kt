package de.sluit.mediatracker.auth

import de.sluit.mediatracker.config.DatabaseConfig
import de.sluit.mediatracker.db.DatabaseFactory
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.system.exitProcess

/**
 * Bootstrap entry point for creating the first user (there is no self-registration).
 *
 * Usage, with the same DB_URL / DB_USER / DB_PASSWORD environment as the server:
 *
 *     java -cp media-tracker.jar de.sluit.mediatracker.auth.CreateUser <username> [--reset-password]
 *
 * The user's existence is checked first; the password is only read (console, not echoed, or stdin when no
 * console is attached) and hashed when it is actually needed, i.e. for a new user or with `--reset-password`.
 *
 * Exit codes: 0 done, 1 failure (including "user already exists" without `--reset-password`), 2 usage.
 */
object CreateUser {
    @JvmStatic
    fun main(args: Array<String>) {
        val username = args.firstOrNull { !it.startsWith("--") }?.trim()
        if (username.isNullOrEmpty()) {
            System.err.println("usage: CreateUser <username> [--reset-password]")
            exitProcess(2)
        }
        val reset = "--reset-password" in args

        val config = DatabaseConfig(
            url = System.getenv("DB_URL") ?: fail("DB_URL is not set"),
            user = System.getenv("DB_USER"),
            password = System.getenv("DB_PASSWORD"),
            maximumPoolSize = 1,
            minimumIdle = 1,
            keepaliveTime = 300_000,
            maxLifetime = 1_500_000,
            timestampType = System.getenv("DB_TIMESTAMP_TYPE") ?: DatabaseConfig.DEFAULT_TIMESTAMP_TYPE,
        )

        DatabaseFactory.connect(config).use { db ->
            val users = UserRepository()

            val existing = transaction(db.database) { users.findByUsernameBlocking(username) }
            if (existing != null && !reset) {
                fail("user '$username' already exists (use --reset-password to change the password)")
            }

            val hash = readAndHashPassword()

            transaction(db.database) {
                if (existing == null) {
                    val id = users.createBlocking(username, hash)
                    println("Created user '$username' (id $id)")
                } else {
                    users.updatePasswordBlocking(existing.id, hash)
                    println("Updated password for '$username'")
                }
            }
        }
    }

    private fun readAndHashPassword(): String {
        val password = readPassword()
        if (password.size < 8) fail("password must be at least 8 characters")
        val hash = PasswordHasher().hash(password)
        password.fill('\u0000')
        return hash
    }

    private fun readPassword(): CharArray {
        val console = System.console()
        if (console != null) {
            val first = console.readPassword("Password: ") ?: fail("no password given")
            val second = console.readPassword("Repeat password: ") ?: fail("no password given")
            if (!first.contentEquals(second)) fail("passwords do not match")
            second.fill('\u0000')
            return first
        }
        return (readlnOrNull() ?: fail("no password on stdin")).toCharArray()
    }

    private fun fail(message: String): Nothing {
        System.err.println("error: $message")
        exitProcess(1)
    }
}
