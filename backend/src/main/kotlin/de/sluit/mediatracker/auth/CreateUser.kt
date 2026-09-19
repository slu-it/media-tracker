package de.sluit.mediatracker.auth

import de.sluit.mediatracker.auth.domain.PasswordHasher
import de.sluit.mediatracker.auth.persistence.ExposedUserRepository
import de.sluit.mediatracker.common.persistence.DatabaseFactory
import de.sluit.mediatracker.config.DatabaseConfig
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.io.PrintStream
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
        exitProcess(run(args, { System.getenv(it) }, ::readPasswordFromConsole, System.out, System.err))
    }

    private class CliFailure(message: String) : RuntimeException(message)

    internal fun run(
        args: Array<String>,
        env: (String) -> String?,
        readPassword: () -> CharArray,
        out: PrintStream,
        err: PrintStream,
        hasher: PasswordHasher = PasswordHasher(),
    ): Int {
        val username = args.firstOrNull { !it.startsWith("--") }?.trim()
        if (username.isNullOrEmpty()) {
            err.println("usage: CreateUser <username> [--reset-password]")
            return 2
        }
        val reset = "--reset-password" in args

        return try {
            val config = DatabaseConfig(
                url = env("DB_URL") ?: fail("DB_URL is not set"),
                user = env("DB_USER"),
                password = env("DB_PASSWORD"),
                // Flyway needs a second connection while it creates its history table on a fresh database.
                maximumPoolSize = 2,
                minimumIdle = 1,
                keepaliveTime = 300_000,
                maxLifetime = 1_500_000,
            )

            DatabaseFactory.connect(config).use { db ->
                val users = ExposedUserRepository()

                val existing = transaction(db.database) { users.findByUsernameBlocking(username) }
                if (existing != null && !reset) {
                    fail("user '$username' already exists (use --reset-password to change the password)")
                }

                val hash = readAndHashPassword(readPassword, hasher)

                transaction(db.database) {
                    if (existing == null) {
                        val id = users.createBlocking(username, hash)
                        out.println("Created user '$username' (id $id)")
                    } else {
                        users.updatePasswordBlocking(existing.id, hash)
                        out.println("Updated password for '$username'")
                    }
                }
            }
            0
        } catch (e: CliFailure) {
            err.println("error: ${e.message}")
            1
        }
    }

    private fun readAndHashPassword(readPassword: () -> CharArray, hasher: PasswordHasher): String {
        val password = readPassword()
        try {
            if (password.size < 8) fail("password must be at least 8 characters")
            return hasher.hash(password)
        } finally {
            password.fill('\u0000')
        }
    }

    private fun readPasswordFromConsole(): CharArray {
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

    private fun fail(message: String): Nothing = throw CliFailure(message)
}
