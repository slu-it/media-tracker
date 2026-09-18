package de.sluit.mediatracker.auth

import de.sluit.mediatracker.auth.domain.PasswordHasher
import de.sluit.mediatracker.auth.persistence.ExposedUserRepository
import de.sluit.mediatracker.common.persistence.DatabaseFactory
import de.sluit.mediatracker.common.persistence.freshH2Config
import de.sluit.mediatracker.config.DatabaseConfig
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CreateUserTest {

    private val cheap = PasswordHasher(memoryKb = 1024, iterations = 1)

    private fun cli(
        vararg args: String,
        env: Map<String, String>,
        password: () -> CharArray = { error("password must not be requested") },
    ): Triple<Int, String, String> {
        val outBuf = ByteArrayOutputStream()
        val errBuf = ByteArrayOutputStream()
        val exitCode = CreateUser.run(
            arrayOf(*args),
            env::get,
            password,
            PrintStream(outBuf),
            PrintStream(errBuf),
            cheap,
        )
        return Triple(exitCode, outBuf.toString(), errBuf.toString())
    }

    private fun envFor(cfg: DatabaseConfig) = mapOf(
        "DB_URL" to cfg.url,
        "DB_USER" to (cfg.user ?: "sa"),
        "DB_TIMESTAMP_TYPE" to cfg.timestampType,
    )

    private fun storedUser(cfg: DatabaseConfig, name: String) = DatabaseFactory.connect(cfg).use { db ->
        transaction(db.database) { ExposedUserRepository().findByUsernameBlocking(name) }
    }

    @Test
    fun `prints usage and exits 2 without arguments`() {
        val (code, _, err) = cli(env = mapOf())

        assertEquals(2, code)
        assertTrue(err.contains("usage:"))
    }

    @Test
    fun `prints usage and exits 2 when only the reset flag is given`() {
        val (code, _, err) = cli("--reset-password", env = mapOf())

        assertEquals(2, code)
        assertTrue(err.contains("usage:"))
    }

    @Test
    fun `exits 1 when DB_URL is not set`() {
        val (code, _, err) = cli("bob", env = mapOf())

        assertEquals(1, code)
        assertTrue(err.contains("DB_URL is not set"))
    }

    @Test
    fun `creates the user with a verifiable argon2id hash`() {
        val cfg = freshH2Config("cli")

        val (code, out, _) = cli("bob", env = envFor(cfg), password = { "correct horse".toCharArray() })

        assertEquals(0, code)
        assertTrue(out.contains("Created user 'bob'"))
        val hash = storedUser(cfg, "bob")!!.passwordHash
        assertTrue(hash.startsWith("\$argon2id\$"))
        assertTrue(cheap.verify("correct horse".toCharArray(), hash))
    }

    @Test
    fun `refuses an existing user without reset and does not prompt`() {
        val cfg = freshH2Config("cli")
        cli("bob", env = envFor(cfg), password = { "correct horse".toCharArray() })

        val (code, _, err) = cli("bob", env = envFor(cfg))

        assertEquals(1, code)
        assertTrue(err.contains("already exists"))
    }

    @Test
    fun `resets the password with --reset-password`() {
        val cfg = freshH2Config("cli")
        cli("bob", env = envFor(cfg), password = { "correct horse".toCharArray() })
        val originalId = storedUser(cfg, "bob")!!.id

        val (code, out, _) =
            cli("bob", "--reset-password", env = envFor(cfg), password = { "new password".toCharArray() })

        assertEquals(0, code)
        assertTrue(out.contains("Updated password for 'bob'"))
        val stored = storedUser(cfg, "bob")!!
        assertEquals(originalId, stored.id)
        assertTrue(cheap.verify("new password".toCharArray(), stored.passwordHash))
        assertTrue(!cheap.verify("correct horse".toCharArray(), stored.passwordHash))
    }

    @Test
    fun `rejects a password shorter than 8 characters`() {
        val cfg = freshH2Config("cli")

        val (code, _, err) = cli("bob", env = envFor(cfg), password = { "short".toCharArray() })

        assertEquals(1, code)
        assertTrue(err.contains("at least 8 characters"))
        assertNull(storedUser(cfg, "bob"))
    }
}
