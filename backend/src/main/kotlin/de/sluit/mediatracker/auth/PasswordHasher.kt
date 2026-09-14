package de.sluit.mediatracker.auth

import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Argon2id password hashing (Bouncy Castle), stored as a PHC string:
 * `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` with unpadded base64.
 *
 * Defaults (19 MiB, 2 iterations, 1 lane) are chosen for a Raspberry Pi running with -Xmx192m.
 * Parameters are stored in the string, so they can be raised later without invalidating old hashes.
 */
class PasswordHasher(
    private val memoryKb: Int = 19_456,
    private val iterations: Int = 2,
    private val parallelism: Int = 1,
    private val saltLength: Int = 16,
    private val hashLength: Int = 32,
    private val random: SecureRandom = SecureRandom(),
) {
    fun hash(password: CharArray): String {
        val salt = ByteArray(saltLength).also(random::nextBytes)
        val hash = derive(password, salt, memoryKb, iterations, parallelism, hashLength)
        return buildString {
            append("\$argon2id\$v=").append(Argon2Parameters.ARGON2_VERSION_13)
            append("\$m=").append(memoryKb).append(",t=").append(iterations).append(",p=").append(parallelism)
            append('$').append(b64.encodeToString(salt))
            append('$').append(b64.encodeToString(hash))
        }
    }

    fun hash(password: String): String = hash(password.toCharArray())

    /** Constant-time comparison; returns false (never throws) for malformed stored values. */
    fun verify(password: CharArray, encoded: String): Boolean {
        val parsed = parse(encoded) ?: return false
        val candidate =
            derive(password, parsed.salt, parsed.memoryKb, parsed.iterations, parsed.parallelism, parsed.hash.size)
        return MessageDigest.isEqual(candidate, parsed.hash)
    }

    fun verify(password: String, encoded: String): Boolean = verify(password.toCharArray(), encoded)

    private fun derive(
        password: CharArray,
        salt: ByteArray,
        memoryKb: Int,
        iterations: Int,
        parallelism: Int,
        length: Int,
    ): ByteArray {
        val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
            .withVersion(Argon2Parameters.ARGON2_VERSION_13)
            .withMemoryAsKB(memoryKb)
            .withIterations(iterations)
            .withParallelism(parallelism)
            .withSalt(salt)
            .build()
        val generator = Argon2BytesGenerator().apply { init(params) }
        return ByteArray(length).also { generator.generateBytes(password, it) }
    }

    private class Parsed(
        val memoryKb: Int,
        val iterations: Int,
        val parallelism: Int,
        val salt: ByteArray,
        val hash: ByteArray,
    )

    private fun parse(encoded: String): Parsed? {
        // ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash]
        val parts = encoded.split('$')
        if (parts.size != 6 || parts[0].isNotEmpty() || parts[1] != "argon2id") return null
        if (parts[2] != "v=${Argon2Parameters.ARGON2_VERSION_13}") return null
        val params = HashMap<String, String>()
        for (kv in parts[3].split(',')) {
            val pair = kv.split('=', limit = 2)
            if (pair.size != 2) return null
            params[pair[0]] = pair[1]
        }
        return try {
            Parsed(
                memoryKb = params.getValue("m").toInt(),
                iterations = params.getValue("t").toInt(),
                parallelism = params.getValue("p").toInt(),
                salt = b64d.decode(parts[4]),
                hash = b64d.decode(parts[5]),
            )
        } catch (_: RuntimeException) {
            null
        }
    }

    private companion object {
        val b64: Base64.Encoder = Base64.getEncoder().withoutPadding()
        val b64d: Base64.Decoder = Base64.getDecoder()
    }
}
