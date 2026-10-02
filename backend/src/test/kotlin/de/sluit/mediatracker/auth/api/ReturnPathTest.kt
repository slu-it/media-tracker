package de.sluit.mediatracker.auth.api

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReturnPathTest {
    @Test
    fun `plain paths with query and fragment are accepted`() {
        assertEquals("/games/watchlist?search=zelda&page=2", safeReturnPath("/games/watchlist?search=zelda&page=2"))
        assertEquals("/", safeReturnPath("/"))
        assertEquals("/loginx", safeReturnPath("/loginx"))
        assertEquals("/games/overview?search=%C3%BCber", safeReturnPath("/games/overview?search=%C3%BCber"))
    }

    @Test
    fun `null and blank are rejected`() {
        assertNull(safeReturnPath(null))
        assertNull(safeReturnPath(""))
        assertNull(safeReturnPath("  "))
    }

    @Test
    fun `external and protocol relative targets are rejected`() {
        assertNull(safeReturnPath("//evil.example"))
        assertNull(safeReturnPath("https://evil.example"))
        assertNull(safeReturnPath("javascript:alert(1)"))
        assertNull(safeReturnPath("games"))
        assertNull(safeReturnPath("/\\evil.example"))
        assertNull(safeReturnPath("/a\\b"))
    }

    @Test
    fun `control characters are rejected`() {
        assertNull(safeReturnPath("/a\r\nSet-Cookie: x"))
        assertNull(safeReturnPath("/a\tb"))
    }

    @Test
    fun `login and logout targets are rejected`() {
        for (bad in listOf("/login", "/login/", "/login?x=1", "/login#a", "/logout", "/logout?x", "/logout/a")) {
            assertNull(safeReturnPath(bad), bad)
        }
    }

    @Test
    fun `login and logout targets are rejected despite case params and dot segments`() {
        for (bad in listOf(
            "/LOGIN",
            "/Logout",
            "/login;x",
            "/./logout",
            "/%2e/logout",
            "/%2E/logout",
            "/a/../login",
            "/lo%67in",
        )) {
            assertNull(safeReturnPath(bad), bad)
        }
    }

    @Test
    fun `characters outside printable ascii are rejected`() {
        assertNull(safeReturnPath("/a\u2028b"))
        assertNull(safeReturnPath("/\u00fcber"))
        assertNull(safeReturnPath("/a b"))
    }

    @Test
    fun `over long values are rejected`() {
        assertNull(safeReturnPath("/" + "a".repeat(2048)))
    }
}
