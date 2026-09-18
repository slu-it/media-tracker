package de.sluit.mediatracker.auth.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PasswordHasherTest {
    // Small parameters keep the test fast; the format is identical to production.
    private val hasher = PasswordHasher(memoryKb = 1024, iterations = 1)

    @Test
    fun `hash verifies against the same password`() {
        val encoded = hasher.hash("correct horse battery staple")
        assertTrue(encoded.startsWith("\$argon2id\$v=19\$m=1024,t=1,p=1\$"), encoded)
        assertTrue(hasher.verify("correct horse battery staple", encoded))
    }

    @Test
    fun `wrong password is rejected`() {
        val encoded = hasher.hash("secret-1")
        assertFalse(hasher.verify("secret-2", encoded))
    }

    @Test
    fun `two hashes of the same password differ by salt`() {
        val a = hasher.hash("same")
        val b = hasher.hash("same")
        assertTrue(a != b)
        assertTrue(hasher.verify("same", a) && hasher.verify("same", b))
    }

    @Test
    fun `parameters are read from the stored string, not the hasher`() {
        val encoded = PasswordHasher(memoryKb = 2048, iterations = 2).hash("pw")
        assertTrue(hasher.verify("pw", encoded))
    }

    @Test
    fun `malformed values never verify`() {
        assertFalse(hasher.verify("pw", ""))
        assertFalse(hasher.verify("pw", "\$argon2id\$v=19\$m=x,t=1,p=1\$abc\$def"))
        assertFalse(hasher.verify("pw", "\$bcrypt\$whatever"))
    }
}
