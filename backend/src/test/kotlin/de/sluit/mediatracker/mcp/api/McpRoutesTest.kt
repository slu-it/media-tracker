package de.sluit.mediatracker.mcp.api

import de.sluit.mediatracker.auth.api.API_KEY_HEADER
import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.api.GameResponse
import de.sluit.mediatracker.games.domain.CoverCandidate
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.CoverLookup
import de.sluit.mediatracker.games.domain.CoverOption
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.ExpansionService
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePatch
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.domain.MissingField
import de.sluit.mediatracker.games.domain.NewExpansion
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.SequenceNumber
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
import io.mockk.confirmVerified
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.serialization.descriptors.elementNames
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
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

    private fun expansion(
        gameId: GameId,
        title: String = "Farewell",
        sequence: Int = 0,
        id: ExpansionId = ExpansionId.new(),
        ownership: Ownership = Ownership.DEFAULT,
        progress: Progress = Progress.DEFAULT,
    ): Expansion = Expansion(
        id = id,
        gameId = gameId,
        sequence = SequenceNumber(sequence),
        title = Title(title),
        ownership = ownership,
        progress = progress,
    )

    private fun coverCandidate(name: String, id: Long = 1, releaseYear: Int? = null, verified: Boolean = true) =
        CoverCandidate(
            id = CoverSourceGameId(id),
            name = name,
            releaseYear = releaseYear?.let(::ReleaseYear),
            verified = verified,
        )

    private fun coverOption(id: Long = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$id.png"),
        imageUrl = CoverImageUrl("https://example.org/full-$id.png"),
        width = 600,
        height = 900,
    )

    /** A [CoverOptionsService] mock whose `isAvailable` reports available, so find_game_cover gets registered. */
    private fun availableCoverOptions(): CoverOptionsService = mockk<CoverOptionsService> {
        every { isAvailable } returns true
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
    fun `tools call add_game sets and echoes the status fields`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val captured = slot<NewGame>()
        coEvery { games.create(capture(captured)) } returns game(
            "Hades",
            platforms = listOf(Platforms.PC),
            releaseYear = 2020,
            ownership = Ownership.OWNED,
            progress = Progress.PLAYING,
            hidden = true,
        )

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                |"arguments":{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],
                |"ownership":"owned","progress":"playing","hidden":true}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        assertEquals(Ownership.OWNED, captured.captured.ownership)
        assertEquals(Progress.PLAYING, captured.captured.progress)
        assertEquals(true, captured.captured.hidden)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        val structuredContent = result["structuredContent"]!!.jsonObject
        assertEquals("owned", structuredContent["ownership"]!!.jsonPrimitive.content)
        assertEquals("playing", structuredContent["progress"]!!.jsonPrimitive.content)
        assertEquals(true, structuredContent["hidden"]!!.jsonPrimitive.content.toBoolean())
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
    fun `tools list returns exactly the game tools with the add_game and update_game schemas`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val tools = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
        assertEquals(
            setOf(
                "list_game_platforms",
                "add_game",
                "search_games",
                "update_game",
                "list_expansions",
                "add_expansion",
            ),
            tools.map {
                it.jsonObject["name"]!!.jsonPrimitive.content
            }.toSet(),
        )
        val addGame = tools.first { it.jsonObject["name"]!!.jsonPrimitive.content == "add_game" }.jsonObject
        val addGameProperties = addGame["inputSchema"]!!.jsonObject["properties"]!!.jsonObject
        val addGameRequired = addGame["inputSchema"]!!.jsonObject["required"]!!.jsonArray.map {
            it.jsonPrimitive.content
        }
        assertEquals(listOf("title", "releaseYear", "platformIds"), addGameRequired)
        assertEquals(
            Ownership.entries.map { it.wire },
            addGameProperties["ownership"]!!.jsonObject["enum"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals(
            Progress.entries.map { it.wire },
            addGameProperties["progress"]!!.jsonObject["enum"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals("boolean", addGameProperties["hidden"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        assertTrue("ownership" !in addGameRequired)
        assertTrue("progress" !in addGameRequired)
        assertTrue("hidden" !in addGameRequired)

        val updateGame = tools.first { it.jsonObject["name"]!!.jsonPrimitive.content == "update_game" }.jsonObject
        val updateGameProperties = updateGame["inputSchema"]!!.jsonObject["properties"]!!.jsonObject
        val updateGameRequired = updateGame["inputSchema"]!!.jsonObject["required"]!!.jsonArray.map {
            it.jsonPrimitive.content
        }
        assertEquals(listOf("id"), updateGameRequired)
        assertEquals(
            listOf("number", "null"),
            updateGameProperties["rating"]!!.jsonObject["type"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals(
            listOf("string", "null"),
            updateGameProperties["description"]!!.jsonObject["type"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals(
            Ownership.entries.map { it.wire },
            updateGameProperties["ownership"]!!.jsonObject["enum"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals(
            Progress.entries.map { it.wire },
            updateGameProperties["progress"]!!.jsonObject["enum"]!!.jsonArray.map { it.jsonPrimitive.content },
        )
        assertEquals("boolean", updateGameProperties["hidden"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        assertTrue("ownership" !in updateGameRequired)
        assertTrue("progress" !in updateGameRequired)
        assertTrue("hidden" !in updateGameRequired)
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
    fun `tools call add_game with an unknown ownership enum value is a tool error not a server error`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_game",
                    |"arguments":{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],
                    |"ownership":"borrowed"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("ownership"), text)
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
        coEvery { games.list(any(), any(), any()) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(10), 0)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        coVerify { games.list(PageRequest(PageNumber.FIRST, PageSize(10)), SearchTerm("hades"), GameFilters.NONE) }
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
        coEvery { games.list(any(), any(), any()) } returns Page(matches, PageNumber.FIRST, PageSize(10), 2)

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
    fun `tools call search_games marks a result that leaves matches behind as truncated`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val matches = listOf(game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020))
        coEvery { games.list(any(), any(), any()) } returns Page(matches, PageNumber.FIRST, PageSize(1), 5)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades","pageSize":1}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val structured = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["structuredContent"]!!
            .jsonObject
        assertEquals(5, structured["totalMatches"]!!.jsonPrimitive.content.toInt())
        assertTrue(structured["truncated"]!!.jsonPrimitive.content.toBoolean(), body)
    }

    @Test
    fun `tools call search_games does not mark a complete result as truncated`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val matches = listOf(game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020))
        coEvery { games.list(any(), any(), any()) } returns Page(matches, PageNumber.FIRST, PageSize(10), 1)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val structured = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["structuredContent"]!!
            .jsonObject
        assertFalse(structured["truncated"]!!.jsonPrimitive.content.toBoolean(), body)
    }

    @Test
    fun `every hasMissing value names a nullable field of the game response`() {
        val fields = GameResponse.serializer().descriptor.elementNames.toSet()
        for (field in MissingField.entries) {
            assertTrue(field.wire in fields, "${field.wire} is not a GameResponse field, it is one of $fields")
        }
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
        coVerify(exactly = 0) { games.list(any(), any(), any()) }
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
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
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
        coVerify(exactly = 0) { games.list(any(), any(), any()) }
    }

    @Test
    fun `tools call search_games with filters passes the exact filters to the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any(), any()) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(10), 0)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades","platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"],
                |"ownership":["owned"],"progress":["playing","paused"],"releaseYears":[2020,2024]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        coVerify {
            games.list(
                PageRequest(PageNumber.FIRST, PageSize(10)),
                SearchTerm("hades"),
                GameFilters(
                    platformIds = setOf(
                        GamePlatformId.parse(SeededPlatforms.PC),
                        GamePlatformId.parse(SeededPlatforms.XBOX),
                    ),
                    ownership = setOf(Ownership.OWNED),
                    progress = setOf(Progress.PLAYING, Progress.PAUSED),
                    releaseYears = setOf(ReleaseYear(2020), ReleaseYear(2024)),
                ),
            )
        }
    }

    @Test
    fun `tools call search_games with filters and no query works`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any(), any()) } returns
            Page(
                listOf(game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)),
                PageNumber.FIRST,
                PageSize(10),
                1,
            )

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"ownership":["owned"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        coVerify {
            games.list(
                PageRequest(PageNumber.FIRST, PageSize(10)),
                null,
                GameFilters(ownership = setOf(Ownership.OWNED)),
            )
        }
    }

    @Test
    fun `tools call search_games with hasMissing passes the exact filter to the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any(), any()) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(10), 0)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades","hasMissing":["description","coverImageUrl"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        coVerify {
            games.list(
                PageRequest(PageNumber.FIRST, PageSize(10)),
                SearchTerm("hades"),
                GameFilters(missing = setOf(MissingField.DESCRIPTION, MissingField.COVER_IMAGE_URL)),
            )
        }
    }

    @Test
    fun `tools call search_games with only hasMissing and no query or other filter works`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any(), any()) } returns
            Page(
                listOf(game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)),
                PageNumber.FIRST,
                PageSize(10),
                1,
            )

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"hasMissing":["description"]}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        coVerify {
            games.list(
                PageRequest(PageNumber.FIRST, PageSize(10)),
                null,
                GameFilters(missing = setOf(MissingField.DESCRIPTION)),
            )
        }
    }

    @Test
    fun `tools call search_games with an unknown hasMissing value is a tool error not a server error`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"query":"hades","hasMissing":["title"]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("hasMissing"), text)
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
        }

    @Test
    fun `tools call search_games with pageSize passes it to the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { games.list(any(), any(), any()) } returns
            Page(emptyList(), PageNumber.FIRST, PageSize(25), 0)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                |"arguments":{"query":"hades","pageSize":25}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        coVerify {
            games.list(PageRequest(PageNumber.FIRST, PageSize(25)), SearchTerm("hades"), GameFilters.NONE)
        }
    }

    @Test
    fun `tools call search_games with a pageSize of 0 is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"query":"hades","pageSize":0}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("pageSize"), text)
        coVerify(exactly = 0) { games.list(any(), any(), any()) }
    }

    @Test
    fun `tools call search_games with a pageSize of 101 is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"query":"hades","pageSize":101}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("pageSize"), text)
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
        }

    @Test
    fun `tools call search_games with neither a query nor a filter is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"platformIds":[]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("query or at least one filter"), text)
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
        }

    @Test
    fun `tools call search_games with an unknown argument name is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"ownerships":["owned"]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("ownerships"), text)
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
        }

    @Test
    fun `tools call search_games with an unknown ownership value is a tool error not a server error`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_games",
                    |"arguments":{"query":"hades","ownership":["borrowed"]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("ownership"), text)
            coVerify(exactly = 0) { games.list(any(), any(), any()) }
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

    // ---- update_game ----

    @Test
    fun `tools call update_game maps the present fields to the domain patch`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val id = GameId.new()
        val capturedId = slot<GameId>()
        val capturedPatch = slot<GamePatch>()
        coEvery { games.update(capture(capturedId), capture(capturedPatch)) } returns
            game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"id":"$id","title":"Hades (Updated)","releaseYear":2021,
                |"platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"],
                |"description":"Updated notes","rating":4.5,"coverImageUrl":"https://img.example/new.png"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        assertEquals(id, capturedId.captured)
        assertEquals(Title("Hades (Updated)"), capturedPatch.captured.title)
        assertEquals(ReleaseYear(2021), capturedPatch.captured.releaseYear)
        assertEquals(
            setOf(GamePlatformId.parse(SeededPlatforms.PC), GamePlatformId.parse(SeededPlatforms.XBOX)),
            capturedPatch.captured.platformIds,
        )
        assertEquals(Patch.Change(Description("Updated notes")), capturedPatch.captured.description)
        assertEquals(Patch.Change(Rating(4.5)), capturedPatch.captured.rating)
        assertEquals(
            Patch.Change(CoverImageUrl("https://img.example/new.png")),
            capturedPatch.captured.coverImageUrl,
        )
    }

    @Test
    fun `tools call update_game leaves omitted fields unchanged`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val capturedPatch = slot<GamePatch>()
        coEvery { games.update(any(), capture(capturedPatch)) } returns
            game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"id":"${GameId.new()}","rating":4.5}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        assertNull(capturedPatch.captured.title)
        assertNull(capturedPatch.captured.releaseYear)
        assertNull(capturedPatch.captured.platformIds)
        assertEquals(Patch.Unchanged, capturedPatch.captured.description)
        assertEquals(Patch.Change(Rating(4.5)), capturedPatch.captured.rating)
        assertEquals(Patch.Unchanged, capturedPatch.captured.coverImageUrl)
    }

    @Test
    fun `tools call update_game with explicit nulls clears the optional fields`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val capturedPatch = slot<GamePatch>()
        coEvery { games.update(any(), capture(capturedPatch)) } returns
            game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"id":"${GameId.new()}","description":null,"rating":null,"coverImageUrl":null}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        assertEquals(Patch.Change(null), capturedPatch.captured.description)
        assertEquals(Patch.Change(null), capturedPatch.captured.rating)
        assertEquals(Patch.Change(null), capturedPatch.captured.coverImageUrl)
    }

    @Test
    fun `tools call update_game with an explicit null ownership is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","ownership":null}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("cannot be cleared"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with an unknown ownership enum value is a tool error not a server error`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","ownership":"borrowed"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("ownership"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game returns a summary of the changed fields and the updated game`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val updated = game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)
        coEvery { games.update(any(), any()) } returns updated

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"id":"${GameId.new()}","description":"Updated notes","rating":4.5}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"])
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertEquals("""Updated description, rating of "Hades" (2020).""", text)
        val structuredContent = result["structuredContent"]!!.jsonObject
        assertEquals(updated.id.toString(), structuredContent["id"]!!.jsonPrimitive.content)
        assertEquals("Hades", structuredContent["title"]!!.jsonPrimitive.content)
    }

    @Test
    fun `tools call update_game without an id is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"title":"Hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertEquals("id: is missing", text)
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `tools call update_game with an id that is not a uuid is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"not-a-uuid","title":"Hades"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("UUID"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with nothing but an id is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("at least one field"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with an unknown field name is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","ratign":4.5}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("unknown"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with a null title is a tool error without calling the service`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                |"arguments":{"id":"${GameId.new()}","title":null}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("cleared"), text)
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `tools call update_game with a non-quarter-step rating is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","rating":3.3}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("rating"), text)
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with a releaseYear that is not a number is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","releaseYear":"soon"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game with an empty platformIds list is a tool error without calling the service`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","platformIds":[]}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            coVerify(exactly = 0) { games.update(any(), any()) }
        }

    @Test
    fun `tools call update_game for an unknown id reports the service's not found exception as a tool error`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
            coEvery { games.update(any(), any()) } throws NotFoundException("game", "unknown")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"update_game",
                    |"arguments":{"id":"${GameId.new()}","title":"Hades"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        }

    @Test
    fun `tools call update_game accepts every field its schema advertises`() = testApplication {
        val games = mockk<GameService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(games = games, apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val id = GameId.new()
        val capturedPatch = slot<GamePatch>()
        coEvery { games.update(any(), capture(capturedPatch)) } returns
            game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

        val listResponse = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
        val tools = Json.parseToJsonElement(listResponse.bodyAsText())
            .jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
        val updateGameSchema = tools.first { it.jsonObject["name"]!!.jsonPrimitive.content == "update_game" }
            .jsonObject["inputSchema"]!!.jsonObject
        val fields = updateGameSchema["properties"]!!.jsonObject.keys - "id"

        // One valid value per field the schema could ever advertise; a schema/DTO drift in either direction (a
        // field the schema lists but the map has no value for, or one the map has but the schema no longer lists)
        // fails this test loudly instead of silently narrowing what gets exercised.
        val validValues: Map<String, JsonElement> = mapOf(
            "title" to JsonPrimitive("Hades (Updated)"),
            "releaseYear" to JsonPrimitive(2021),
            "platformIds" to buildJsonArray { add(SeededPlatforms.PC) },
            "description" to JsonPrimitive("Updated notes"),
            "rating" to JsonPrimitive(4.5),
            "coverImageUrl" to JsonPrimitive("https://img.example/new.png"),
            "ownership" to JsonPrimitive(Ownership.OWNED.wire),
            "progress" to JsonPrimitive(Progress.PLAYING.wire),
            "hidden" to JsonPrimitive(true),
        )
        assertEquals(validValues.keys, fields)

        val arguments = buildJsonObject {
            put("id", id.toString())
            fields.forEach { field -> put(field, validValues.getValue(field)) }
        }
        val requestBody = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", 1)
            put("method", "tools/call")
            putJsonObject("params") {
                put("name", "update_game")
                put("arguments", arguments)
            }
        }

        val response = client.postJsonRpc(key, requestBody.toString())

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        fields.forEach { field ->
            when (field) {
                "title" -> assertNotNull(capturedPatch.captured.title)
                "releaseYear" -> assertNotNull(capturedPatch.captured.releaseYear)
                "platformIds" -> assertTrue(!capturedPatch.captured.platformIds.isNullOrEmpty())
                "description" -> assertTrue(capturedPatch.captured.description is Patch.Change)
                "rating" -> assertTrue(capturedPatch.captured.rating is Patch.Change)
                "coverImageUrl" -> assertTrue(capturedPatch.captured.coverImageUrl is Patch.Change)
                "ownership" -> assertEquals(Ownership.OWNED, capturedPatch.captured.ownership)
                "progress" -> assertEquals(Progress.PLAYING, capturedPatch.captured.progress)
                "hidden" -> assertEquals(true, capturedPatch.captured.hidden)
                else -> error("no expected value wired up for schema field \"$field\"")
            }
        }
    }

    @Test
    fun `tools call update_game rejects an explicit null exactly for fields the schema does not mark clearable`() =
        testApplication {
            val games = mockk<GameService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(games = games, apiKeys = apiKeys)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
            // Stub for the fields the schema marks clearable: their update_game call must actually go through.
            coEvery { games.update(any(), any()) } returns
                game("Hades", platforms = listOf(Platforms.PC), releaseYear = 2020)

            val listResponse = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")
            val tools = Json.parseToJsonElement(listResponse.bodyAsText())
                .jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
            val updateGameSchema = tools.first { it.jsonObject["name"]!!.jsonPrimitive.content == "update_game" }
                .jsonObject["inputSchema"]!!.jsonObject
            val properties = updateGameSchema["properties"]!!.jsonObject
            val fields = properties.keys - "id"

            // The schema marks a field clearable by giving it a `["<type>", "null"]` type array (see
            // UPDATE_GAME_SCHEMA); every other field rejects an explicit null. Driving the expectation off the
            // schema itself, rather than a hardcoded list, means a future PatchField-backed field that is wired
            // into UPDATE_GAME_SCHEMA but forgotten in UPDATE_GAME_CLEARABLE fails this test loudly.
            fields.forEach { field ->
                val type = properties.getValue(field).jsonObject["type"]
                val schemaMarksClearable = type is JsonArray && type.any { it.jsonPrimitive.content == "null" }

                val response = client.postJsonRpc(
                    key,
                    buildJsonObject {
                        put("jsonrpc", "2.0")
                        put("id", 1)
                        put("method", "tools/call")
                        putJsonObject("params") {
                            put("name", "update_game")
                            putJsonObject("arguments") {
                                put("id", GameId.new().toString())
                                put(field, JsonNull)
                            }
                        }
                    }.toString(),
                )

                val body = response.bodyAsText()
                assertEquals(HttpStatusCode.OK, response.status, body)
                val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
                val isError = result["isError"]?.jsonPrimitive?.content?.toBoolean() ?: false
                assertEquals(
                    !schemaMarksClearable,
                    isError,
                    "field \"$field\": expected rejected=${!schemaMarksClearable}, was $isError, body=$body",
                )
            }
        }

    // ---- list_expansions / add_expansion ----

    @Test
    fun `tools call list_expansions returns the expansions and calls the service with the parsed game id`() =
        testApplication {
            val expansions = mockk<ExpansionService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
            val gameId = GameId.new()
            val first = expansion(gameId, title = "First", sequence = 0)
            val second = expansion(gameId, title = "Second", sequence = 1)
            coEvery { expansions.list(gameId) } returns listOf(first, second)

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_expansions",
                    |"arguments":{"gameId":"$gameId"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertNull(result["isError"])
            val returned = result["structuredContent"]!!.jsonObject["expansions"]!!.jsonArray
            assertEquals(listOf("First", "Second"), returned.map { it.jsonObject["title"]!!.jsonPrimitive.content })
            assertEquals(2, result["structuredContent"]!!.jsonObject["count"]!!.jsonPrimitive.content.toInt())
            coVerify { expansions.list(gameId) }
        }

    @Test
    fun `tools call list_expansions for a game with no expansions is not an error`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val gameId = GameId.new()
        coEvery { expansions.list(gameId) } returns emptyList()

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_expansions",
                |"arguments":{"gameId":"$gameId"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        assertEquals(0, result["structuredContent"]!!.jsonObject["count"]!!.jsonPrimitive.content.toInt())
        assertEquals(0, result["structuredContent"]!!.jsonObject["expansions"]!!.jsonArray.size)
    }

    @Test
    fun `tools call list_expansions with a malformed game id is a tool error without calling the service`() =
        testApplication {
            val expansions = mockk<ExpansionService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_expansions",
                    |"arguments":{"gameId":"not-a-uuid"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            coVerify(exactly = 0) { expansions.list(any()) }
        }

    @Test
    fun `tools call list_expansions with an unknown argument name is a tool error without calling the service`() =
        testApplication {
            val expansions = mockk<ExpansionService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_expansions",
                    |"arguments":{"gameid":"${GameId.new()}"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("gameid"), text)
            coVerify(exactly = 0) { expansions.list(any()) }
        }

    @Test
    fun `tools call add_expansion passes the exact new expansion to the service`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val gameId = GameId.new()
        val captured = slot<NewExpansion>()
        coEvery { expansions.create(gameId, capture(captured)) } returns
            expansion(gameId, title = "Farewell", ownership = Ownership.OWNED, progress = Progress.PLAYING)

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_expansion",
                |"arguments":{"gameId":"$gameId","title":"Farewell","ownership":"owned","progress":"playing"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        assertEquals(
            NewExpansion(title = Title("Farewell"), ownership = Ownership.OWNED, progress = Progress.PLAYING),
            captured.captured,
        )
    }

    @Test
    fun `tools call add_expansion without ownership or progress passes the domain defaults`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val gameId = GameId.new()
        val captured = slot<NewExpansion>()
        coEvery { expansions.create(gameId, capture(captured)) } returns expansion(gameId, title = "Farewell")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_expansion",
                |"arguments":{"gameId":"$gameId","title":"Farewell"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        assertEquals(
            NewExpansion(title = Title("Farewell"), ownership = Ownership.DEFAULT, progress = Progress.DEFAULT),
            captured.captured,
        )
    }

    @Test
    fun `tools call add_expansion with an unknown ownership enum value is a tool error not a server error`() =
        testApplication {
            val expansions = mockk<ExpansionService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_expansion",
                    |"arguments":{"gameId":"${GameId.new()}","title":"Farewell","ownership":"borrowed"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("ownership"), text)
            coVerify(exactly = 0) { expansions.create(any(), any()) }
        }

    @Test
    fun `tools call add_expansion for an unknown game reports the service's not found exception as a tool error`() =
        testApplication {
            val expansions = mockk<ExpansionService>()
            val apiKeys = mockk<ApiKeyService>()
            val client = handlerApp(apiKeys = apiKeys, expansions = expansions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
            val gameId = GameId.new()
            coEvery { expansions.create(gameId, any()) } throws NotFoundException("game", gameId.toString())

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_expansion",
                    |"arguments":{"gameId":"$gameId","title":"Farewell"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        }

    // ---- find_game_cover ----

    @Test
    fun `tools list includes find_game_cover when the cover options service is available`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = availableCoverOptions())
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val tools = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
        assertTrue("find_game_cover" in tools.map { it.jsonObject["name"]!!.jsonPrimitive.content }, body)
    }

    @Test
    fun `tools list omits find_game_cover when the cover options service is unavailable`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        // handlerApp's default CoverOptionsService already reports isAvailable = false.
        val client = handlerApp(apiKeys = apiKeys)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(key, """{"jsonrpc":"2.0","id":1,"method":"tools/list"}""")

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val tools = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject["tools"]!!.jsonArray
        assertTrue("find_game_cover" !in tools.map { it.jsonObject["name"]!!.jsonPrimitive.content }, body)
    }

    @Test
    fun `tools call find_game_cover returns the cover url and match as text and structured content`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
            val match = coverCandidate("Hades", id = 1, releaseYear = 2020, verified = true)
            val cover = coverOption(1)
            coEvery { coverOptions.findFirstCover(SearchTerm("Hades"), ReleaseYear(2020)) } returns
                CoverLookup(match, cover)

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"title":"Hades","releaseYear":2020}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertNull(result["isError"], body)
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertEquals("""Cover for "Hades" (2020, verified): ${cover.imageUrl.value}""", text)
            val structuredContent = result["structuredContent"]!!.jsonObject
            assertEquals(true, structuredContent["found"]!!.jsonPrimitive.content.toBoolean())
            assertEquals(cover.imageUrl.value, structuredContent["imageUrl"]!!.jsonPrimitive.content)
            assertEquals(cover.width, structuredContent["width"]!!.jsonPrimitive.content.toInt())
            assertEquals(cover.height, structuredContent["height"]!!.jsonPrimitive.content.toInt())
            val matchJson = structuredContent["match"]!!.jsonObject
            assertEquals("Hades", matchJson["name"]!!.jsonPrimitive.content)
            assertEquals(2020, matchJson["releaseYear"]!!.jsonPrimitive.content.toInt())
            assertEquals(true, matchJson["verified"]!!.jsonPrimitive.content.toBoolean())
            coVerify { coverOptions.findFirstCover(SearchTerm("Hades"), ReleaseYear(2020)) }
        }

    @Test
    fun `tools call find_game_cover without a release year passes a null release year`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val match = coverCandidate("Hades", id = 1)
        coEvery { coverOptions.findFirstCover(SearchTerm("Hades"), null) } returns CoverLookup(match, coverOption(1))

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                |"arguments":{"title":"Hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        coVerify { coverOptions.findFirstCover(SearchTerm("Hades"), null) }
    }

    @Test
    fun `tools call find_game_cover without a title is a tool error without calling the service`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        // findFirstCover takes a ReleaseYear, a value class whose init validates its range; any()'s witness
        // generation would construct one from a random Int and fail about half the time (see the MockK
        // value-class matcher note). Verifying the one call the tool always makes and confirming nothing else
        // touched the mock proves findFirstCover specifically was never called, without that matcher.
        verify { coverOptions.isAvailable }
        confirmVerified(coverOptions)
    }

    @Test
    fun `tools call find_game_cover with a blank title is a tool error without calling the service`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"title":"   "}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            verify { coverOptions.isAvailable }
            confirmVerified(coverOptions)
        }

    @Test
    fun `tools call find_game_cover with an unknown argument name is a tool error without calling the service`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"tilte":"Hades"}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("tilte"), text)
            verify { coverOptions.isAvailable }
            confirmVerified(coverOptions)
        }

    @Test
    fun `tools call find_game_cover with no match is a non-error result saying so`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { coverOptions.findFirstCover(SearchTerm("Hades"), null) } returns null

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                |"arguments":{"title":"Hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertEquals("""No cover found for "Hades".""", text)
    }

    @Test
    fun `tools call find_game_cover reports an upstream failure as a fixed generic tool error`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        coEvery { coverOptions.findFirstCover(SearchTerm("Hades"), null) } throws
            ExternalSourceException("cover_source", "steamgriddb returned status 500 with success=false")

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                |"arguments":{"title":"Hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        // Mirrors StatusPages' wording exactly; the upstream detail (status code, "steamgriddb") is logged, not
        // echoed to the caller.
        assertEquals("cover_source is currently unavailable", text)
        assertFalse(text.contains("500"), text)
        assertFalse(text.contains("steamgriddb"), text)
    }

    @Test
    fun `tools call find_game_cover with a releaseYear of 999 is a tool error without calling the service`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"title":"Hades","releaseYear":999}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("releaseYear"), text)
            verify { coverOptions.isAvailable }
            confirmVerified(coverOptions)
        }

    @Test
    fun `tools call find_game_cover with a releaseYear of 10000 is a tool error without calling the service`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"title":"Hades","releaseYear":10000}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("releaseYear"), text)
            verify { coverOptions.isAvailable }
            confirmVerified(coverOptions)
        }

    @Test
    fun `tools call find_game_cover with a non-integer releaseYear is a tool error without calling the service`() =
        testApplication {
            val apiKeys = mockk<ApiKeyService>()
            val coverOptions = availableCoverOptions()
            val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
            val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
            coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")

            val response = client.postJsonRpc(
                key,
                """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                    |"arguments":{"title":"Hades","releaseYear":2020.5}}}
                """.trimMargin(),
            )

            val body = response.bodyAsText()
            assertEquals(HttpStatusCode.OK, response.status, body)
            val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
            assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
            val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
            assertTrue(text.contains("must be an integer"), text)
            verify { coverOptions.isAvailable }
            confirmVerified(coverOptions)
        }

    @Test
    fun `tools call find_game_cover with a title longer than the maximum length is a tool error`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val tooLong = "a".repeat(SearchTerm.MAX_LENGTH + 1)

        val response = client.postJsonRpc(
            key,
            buildJsonObject {
                put("jsonrpc", "2.0")
                put("id", 1)
                put("method", "tools/call")
                putJsonObject("params") {
                    put("name", "find_game_cover")
                    putJsonObject("arguments") { put("title", tooLong) }
                }
            }.toString(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertTrue(result["isError"]!!.jsonPrimitive.content.toBoolean())
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("title"), text)
        verify { coverOptions.isAvailable }
        confirmVerified(coverOptions)
    }

    @Test
    fun `tools call find_game_cover reports an unverified match with no release year as such`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val coverOptions = availableCoverOptions()
        val client = handlerApp(apiKeys = apiKeys, coverOptions = coverOptions)
        val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        val match = coverCandidate("Hades Clone", id = 1, releaseYear = null, verified = false)
        coEvery { coverOptions.findFirstCover(SearchTerm("Hades"), null) } returns CoverLookup(match, coverOption(1))

        val response = client.postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_game_cover",
                |"arguments":{"title":"Hades"}}}
            """.trimMargin(),
        )

        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        val result = Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
        assertNull(result["isError"], body)
        val text = result["content"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        assertTrue(text.contains("year unknown"), text)
        assertTrue(text.contains("unverified"), text)
        val matchJson = result["structuredContent"]!!.jsonObject["match"]!!.jsonObject
        assertFalse("releaseYear" in matchJson, matchJson.toString())
        assertEquals(false, matchJson["verified"]!!.jsonPrimitive.content.toBoolean())
    }
}
