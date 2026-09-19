package de.sluit.mediatracker.mcp.api

import de.sluit.mediatracker.auth.api.API_KEY_HEADER
import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.game
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Handler tests for `POST /mcp`: real plugins and routes through [handlerApp], [GameService] and [ApiKeyService]
 * are MockK mocks (strict), no database is opened. Pins the JSON-RPC HTTP contract (status codes, the `McpJson`
 * encoding guard in [mcpEndpoint]) and the domain values a tool handler hands to the service.
 */
class McpRoutesTest {
    private suspend fun HttpClient.postJsonRpc(key: String?, body: String): HttpResponse = post("/mcp") {
        acceptJsonRpc()
        if (key != null) header(API_KEY_HEADER, key)
        jsonBody(body)
    }

    private fun HttpRequestBuilder.acceptJsonRpc() {
        header(HttpHeaders.Accept, "application/json, text/event-stream")
    }

    @Test
    fun `tools call add_game creates the game through the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.create(any()) } returns game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                |"arguments":{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        coVerify {
            games.create(
                NewGame(
                    title = Title("Hades"),
                    releaseYear = ReleaseYear(2020),
                    platformIds = setOf(GamePlatformId.parse(SeededPlatforms.PC)),
                ),
            )
        }
    }

    @Test
    fun `json rpc replies omit null fields`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.create(any()) } returns game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                |"arguments":{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertFalse(body.contains("\"isError\":null"), body)
        assertFalse(body.contains("\"structuredContent\":null"), body)
    }

    @Test
    fun `mcp without api key is a json 401 with www authenticate`() = testApplication {
        val client = handlerApp()

        val response = client.postJsonRpc(null, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(ErrorResponse("unauthorized"), response.decodeBody<ErrorResponse>())
        assertTrue(response.headers.contains(HttpHeaders.WWWAuthenticate))
    }

    @Test
    fun `mcp with a wrong but well-formed api key is a json 401`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val unknownKey = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d9999"
        coEvery { apiKeys.authenticate(unknownKey) } returns null

        val response = client.postJsonRpc(unknownKey, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(ErrorResponse("unauthorized"), response.decodeBody<ErrorResponse>())
    }

    @Test
    fun `mcp with only a session cookie and no api key is a json 401`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.postJsonRpc(null, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `bearer authorization header authenticates like the api key header`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.post("/mcp") {
            acceptJsonRpc()
            header(HttpHeaders.Authorization, "Bearer $key")
            jsonBody("""{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    @Test
    fun `a blank api key header falls back to the bearer authorization header`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.post("/mcp") {
            acceptJsonRpc()
            header(API_KEY_HEADER, "")
            header(HttpHeaders.Authorization, "Bearer $key")
            jsonBody("""{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    @Test
    fun `mcp without accepting text event-stream is not acceptable`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.post("/mcp") {
            header(HttpHeaders.Accept, "application/json")
            header(API_KEY_HEADER, key)
            jsonBody("""{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
        }

        assertEquals(HttpStatusCode.NotAcceptable, response.status)
    }

    @Test
    fun `mcp with a plain text content type is an unsupported media type`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.post("/mcp") {
            acceptJsonRpc()
            header(API_KEY_HEADER, key)
            contentType(ContentType.Text.Plain)
            setBody("""{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
        }

        assertEquals(HttpStatusCode.UnsupportedMediaType, response.status)
    }

    @Test
    fun `a notification-only body is accepted without a json-rpc result`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(key, """{"jsonrpc":"2.0","method":"notifications/initialized"}""")

        assertEquals(HttpStatusCode.Accepted, response.status)
    }

    @Test
    fun `initialize reports the server name and version`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25",
                |"capabilities":{},"clientInfo":{"name":"test-client","version":"0"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val serverInfo = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["serverInfo"]!!.jsonObject
        assertEquals(MCP_SERVER_NAME, serverInfo["name"]!!.jsonPrimitive.content)
        assertEquals(MCP_SERVER_VERSION, serverInfo["version"]!!.jsonPrimitive.content)
    }

    @Test
    fun `tools list returns exactly the game tools with add_game required fields`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val tools = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
        assertEquals(
            setOf("list_game_platforms", "add_game", "search_games"),
            tools.map {
                it.jsonObject["name"]!!.jsonPrimitive.content
            }.toSet(),
        )
        val addGame = tools.first { it.jsonObject["name"]!!.jsonPrimitive.content == "add_game" }.jsonObject
        val required = addGame["inputSchema"]!!.jsonObject["required"]!!.jsonArray.map { it.jsonPrimitive.content }
        assertEquals(listOf("title", "releaseYear", "platformIds"), required)
    }

    @Test
    fun `tools call add_game with a non-quarter-step rating is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                    |"arguments":{"title":"Hades","releaseYear":2020,"rating":3.3,
                    |"platformIds":["${SeededPlatforms.PC}"]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("rating"), text)
            coVerify(exactly = 0) { games.create(any()) }
        }

    @Test
    fun `tools call add_game without a title is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                |"arguments":{"releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `tools call add_game with an unknown platform id is a tool error`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.create(any()) } throws NotFoundException("game_platform", "unknown-id")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                |"arguments":{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test
    fun `tools call list_game_platforms returns the platforms as structured content`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.listPlatforms() } returns listOf(Platforms.PC, Platforms.XBOX)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_game_platforms","arguments":{}}}""",
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        val platforms = result["structuredContent"]!!.jsonObject["platforms"]!!.jsonArray
        val ids = platforms.map { it.jsonObject["id"]!!.jsonPrimitive.content }.toSet()
        val labels = platforms.map { it.jsonObject["label"]!!.jsonPrimitive.content }.toSet()
        assertEquals(setOf(SeededPlatforms.PC, SeededPlatforms.XBOX), ids)
        assertEquals(setOf("PC", "Xbox"), labels)
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("PC"), text)
        assertTrue(text.contains("Xbox"), text)
    }

    @Test
    fun `tools call search_games asks the service for the first ten matches`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any()) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(10), 0)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        coVerify { games.list(PageRequest(PageNumber.FIRST, PageSize(10)), SearchTerm("hades")) }
    }

    @Test
    fun `tools call search_games returns the games as structured content and text`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val matches = listOf(
            game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020),
            game("Hades II", platforms = listOf(Platforms.PC), releaseYear = 2024),
        )
        coEvery { games.list(any(), any()) } returns Page(matches, PageNumber.FIRST, PageSize(10), 2)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        val titles = result["structuredContent"]!!.jsonObject["games"]!!.jsonArray
            .map { it.jsonObject["title"]!!.jsonPrimitive.content }
        assertEquals(listOf("Hades", "Hades II"), titles)
        assertEquals(2, result["structuredContent"]!!.jsonObject["totalMatches"]!!.jsonPrimitive.content.toInt())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("Hades"), text)
        assertTrue(text.contains("Hades II"), text)
    }

    @Test
    fun `tools call search_games with a blank query is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"query":"  "}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    @Test
    fun `tools call search_games with a non string query is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games","arguments":{"query":42}}}""",
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            assertTrue(
                result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content.contains(
                    "must be a string",
                ),
            )
            coVerify(exactly = 0) { games.list(any(), any()) }
        }

    @Test
    fun `tools call search_games without arguments is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games","arguments":{}}}""",
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    @Test
    fun `get mcp with a valid key is method not allowed`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.get("/mcp") { header(API_KEY_HEADER, key) }

        assertEquals(HttpStatusCode.MethodNotAllowed, response.status)
        assertEquals("POST", response.headers[HttpHeaders.Allow])
        assertEquals(ErrorResponse("method_not_allowed"), response.decodeBody<ErrorResponse>())
    }

    @Test
    fun `delete mcp with a valid key is method not allowed`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.delete("/mcp") { header(API_KEY_HEADER, key) }

        assertEquals(HttpStatusCode.MethodNotAllowed, response.status)
    }
}
