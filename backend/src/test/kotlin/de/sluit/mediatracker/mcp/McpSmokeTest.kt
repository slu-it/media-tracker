package de.sluit.mediatracker.mcp

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.auth.api.API_KEY_HEADER
import de.sluit.mediatracker.auth.api.ApiKeysResponse
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.api.GameResponse
import de.sluit.mediatracker.games.persistence.GamesTable
import de.sluit.mediatracker.loginAs
import io.ktor.client.HttpClient
import io.ktor.client.plugins.sse.SSE
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.modelcontextprotocol.kotlin.sdk.client.Client
import io.modelcontextprotocol.kotlin.sdk.client.StreamableHttpClientTransport
import io.modelcontextprotocol.kotlin.sdk.types.Implementation
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/**
 * Smoke tests for the MCP endpoint through the real MCP Kotlin client
 * ([io.modelcontextprotocol.kotlin.sdk.client.Client]) instead of raw JSON-RPC POSTs, against the real `module()`
 * on the Testcontainers MariaDB shared by the test JVM ([appWithUser]). Happy paths only; everything negative
 * lives in [de.sluit.mediatracker.mcp.api.McpRoutesTest].
 */
class McpSmokeTest {
    /** Logs in, mints a primary API key and cleans out the games table. Returns the session client and the key. */
    private suspend fun ApplicationTestBuilder.loggedInClientWithApiKey(): Pair<HttpClient, String> {
        val client = appWithUser("alice", "wonderland-1") { GamesTable.deleteAll() }
        client.loginAs("alice", "wonderland-1")
        val key = client.post("/api/me/api-keys/primary").decodeBody<ApiKeysResponse>().primary
        checkNotNull(key) { "primary key was not minted" }
        return client to key
    }

    /**
     * A second Ktor client for the MCP transport: it needs [SSE] installed because
     * [StreamableHttpClientTransport] probes the optional standalone GET stream after the first notification, and
     * without the plugin the probe fails with something other than the 405 the SDK treats as "streaming disabled".
     */
    private fun ApplicationTestBuilder.mcpTransport(key: String): StreamableHttpClientTransport {
        val sseClient = createClient { install(SSE) }
        return StreamableHttpClientTransport(
            client = sseClient,
            url = "http://localhost/mcp",
            requestBuilder = { header(API_KEY_HEADER, key) },
        )
    }

    @Test
    fun `tools list and list_game_platforms report the seeded platforms`() = testApplication {
        val (_, key) = loggedInClientWithApiKey()
        val mcp = Client(clientInfo = Implementation(name = "smoke-test", version = "0"))
        mcp.connect(mcpTransport(key))

        try {
            val toolNames = mcp.listTools().tools.map { it.name }.toSet()
            assertEquals(setOf("list_game_platforms", "add_game", "search_games", "update_game"), toolNames)

            val result = mcp.callTool("list_game_platforms", emptyMap())
            assertNotEquals(true, result.isError)
            val labels = result.structuredContent!!["platforms"]!!.jsonArray
                .map { it.jsonObject["label"]!!.jsonPrimitive.content }
                .toSet()
            assertEquals(setOf("PC", "PlayStation", "Xbox", "Nintendo"), labels)
        } finally {
            mcp.close()
        }
    }

    @Test
    fun `add_game round trip is visible through GET slash api slash games`() = testApplication {
        val (sessionClient, key) = loggedInClientWithApiKey()
        val mcp = Client(clientInfo = Implementation(name = "smoke-test", version = "0"))
        mcp.connect(mcpTransport(key))

        try {
            val platforms = mcp.callTool("list_game_platforms", emptyMap())
            val pcId = platforms.structuredContent!!["platforms"]!!.jsonArray
                .first { it.jsonObject["label"]!!.jsonPrimitive.content == "PC" }
                .jsonObject["id"]!!.jsonPrimitive.content

            val created = mcp.callTool(
                "add_game",
                mapOf("title" to "Hades", "releaseYear" to 2020, "platformIds" to listOf(pcId)),
            )
            assertNotEquals(true, created.isError)

            val listed = sessionClient.get("/api/games").decodeBody<PageResponse<GameResponse>>()
            assertContains(listed.items.map { it.title }, "Hades")
        } finally {
            mcp.close()
            transaction { GamesTable.deleteAll() }
        }
    }

    @Test
    fun `search_games returns the best matches as structured content`() = testApplication {
        val (_, key) = loggedInClientWithApiKey()
        val mcp = Client(clientInfo = Implementation(name = "smoke-test", version = "0"))
        mcp.connect(mcpTransport(key))

        try {
            val platforms = mcp.callTool("list_game_platforms", emptyMap())
            val pcId = platforms.structuredContent!!["platforms"]!!.jsonArray
                .first { it.jsonObject["label"]!!.jsonPrimitive.content == "PC" }
                .jsonObject["id"]!!.jsonPrimitive.content

            mcp.callTool(
                "add_game",
                mapOf(
                    "title" to "Hades",
                    "releaseYear" to 2020,
                    "platformIds" to listOf(pcId),
                    "description" to "Escape the underworld",
                ),
            )
            mcp.callTool(
                "add_game",
                mapOf(
                    "title" to "Underworld Chronicles",
                    "releaseYear" to 2021,
                    "platformIds" to listOf(pcId),
                    "description" to "A roguelike inspired by Hades",
                ),
            )
            mcp.callTool(
                "add_game",
                mapOf("title" to "Celeste", "releaseYear" to 2018, "platformIds" to listOf(pcId)),
            )

            val result = mcp.callTool("search_games", mapOf("query" to "hades"))

            assertNotEquals(true, result.isError)
            assertEquals(2, result.structuredContent!!["totalMatches"]!!.jsonPrimitive.int)
            val titles = result.structuredContent!!["games"]!!.jsonArray
                .map { it.jsonObject["title"]!!.jsonPrimitive.content }
            assertEquals(listOf("Hades", "Underworld Chronicles"), titles)
        } finally {
            mcp.close()
            transaction { GamesTable.deleteAll() }
        }
    }

    @Test
    fun `search_games narrows the matches by the filters passed alongside the query`() = testApplication {
        val (_, key) = loggedInClientWithApiKey()
        val mcp = Client(clientInfo = Implementation(name = "smoke-test", version = "0"))
        mcp.connect(mcpTransport(key))

        try {
            val platforms = mcp.callTool("list_game_platforms", emptyMap())
            val pcId = platforms.structuredContent!!["platforms"]!!.jsonArray
                .first { it.jsonObject["label"]!!.jsonPrimitive.content == "PC" }
                .jsonObject["id"]!!.jsonPrimitive.content

            mcp.callTool(
                "add_game",
                mapOf("title" to "Hades", "releaseYear" to 2020, "platformIds" to listOf(pcId)),
            )
            mcp.callTool(
                "add_game",
                mapOf(
                    "title" to "Hades II",
                    "releaseYear" to 2024,
                    "platformIds" to listOf(pcId),
                    "ownership" to "owned",
                ),
            )

            val result = mcp.callTool(
                "search_games",
                mapOf("query" to "hades", "ownership" to listOf("owned")),
            )

            assertNotEquals(true, result.isError)
            val titles = result.structuredContent!!["games"]!!.jsonArray
                .map { it.jsonObject["title"]!!.jsonPrimitive.content }
            assertEquals(listOf("Hades II"), titles)
        } finally {
            mcp.close()
            transaction { GamesTable.deleteAll() }
        }
    }

    @Test
    fun `search_games then update_game changes only the fields that were passed`() = testApplication {
        val (sessionClient, key) = loggedInClientWithApiKey()
        val mcp = Client(clientInfo = Implementation(name = "smoke-test", version = "0"))
        mcp.connect(mcpTransport(key))

        try {
            val platforms = mcp.callTool("list_game_platforms", emptyMap())
            val pcId = platforms.structuredContent!!["platforms"]!!.jsonArray
                .first { it.jsonObject["label"]!!.jsonPrimitive.content == "PC" }
                .jsonObject["id"]!!.jsonPrimitive.content

            mcp.callTool(
                "add_game",
                mapOf(
                    "title" to "Hollow Knight Silksong",
                    "releaseYear" to 2024,
                    "platformIds" to listOf(pcId),
                    "description" to "A metroidvania about a bug princess",
                    "rating" to 4.5,
                ),
            )

            val searchResult = mcp.callTool("search_games", mapOf("query" to "Silksong"))
            assertNotEquals(true, searchResult.isError)
            val matches = searchResult.structuredContent!!["games"]!!.jsonArray
            assertEquals(1, matches.size)
            val gameId = matches[0].jsonObject["id"]!!.jsonPrimitive.content

            val updated = mcp.callTool(
                "update_game",
                mapOf(
                    "id" to gameId,
                    "rating" to 5.0,
                    "description" to "Finally released",
                    "ownership" to "owned",
                    "progress" to "playing",
                ),
            )
            assertNotEquals(true, updated.isError)

            val afterUpdate = sessionClient.get("/api/games").decodeBody<PageResponse<GameResponse>>()
                .items.single { it.id == gameId }
            assertEquals("Hollow Knight Silksong", afterUpdate.title)
            assertEquals(2024, afterUpdate.releaseYear)
            assertEquals(listOf(pcId), afterUpdate.platforms.map { it.id })
            assertEquals(5.0, afterUpdate.rating)
            assertEquals("Finally released", afterUpdate.description)
            assertEquals("owned", afterUpdate.ownership)
            assertEquals("playing", afterUpdate.progress)

            val cleared = mcp.callTool("update_game", mapOf("id" to gameId, "rating" to null))
            assertNotEquals(true, cleared.isError)

            val afterClear = sessionClient.get("/api/games").decodeBody<PageResponse<GameResponse>>()
                .items.single { it.id == gameId }
            assertEquals(null, afterClear.rating)
            assertEquals("Finally released", afterClear.description)
        } finally {
            mcp.close()
            transaction { GamesTable.deleteAll() }
        }
    }
}
