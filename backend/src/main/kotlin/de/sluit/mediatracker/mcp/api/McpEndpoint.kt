package de.sluit.mediatracker.mcp.api

import de.sluit.mediatracker.common.api.ErrorResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.response.ApplicationSendPipeline
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingNode
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.StreamableHttpServerTransport
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import kotlinx.serialization.builtins.ListSerializer

/**
 * `POST /mcp`: a stateless MCP Streamable HTTP endpoint, mounted inside `authenticate(API_KEY_AUTH)` by
 * [de.sluit.mediatracker.mcpRoutes]. [serverFactory] is called once per request and must return a fresh [Server]
 * with its tools already registered (feature packages contribute tools, e.g.
 * [de.sluit.mediatracker.games.api.addGameTools]).
 *
 * The SDK ships `mcpStreamableHttp`/`mcpStatelessStreamableHttp` Ktor helpers, but they open their own top-level
 * `routing { }` block and install their own `ContentNegotiation`, so they cannot be nested inside our
 * `authenticate { }` block and would collide with the application-wide JSON configuration (ADR 0013). This
 * function replicates the SDK's private stateless endpoint (`mcpStatelessStreamableHttpEndpoint` in the SDK's
 * `KtorServer.kt`) with its public building blocks instead: one [StreamableHttpServerTransport] per request with
 * no session id generator, [Server.createSession], [StreamableHttpServerTransport.handleRequest], closing the
 * session in `finally`. A one-shot tool call needs neither an SSE stream nor a session registry, and the
 * Raspberry Pi this runs on keeps no per-client MCP state.
 *
 * DNS-rebinding / `Host` header validation, which the SDK's helpers enable by default, is intentionally left off:
 * the endpoint is reached by hostname on a LAN and is already gated by the API key, so the protection the SDK
 * adds against browser-based `localhost` attacks does not apply here.
 */
fun Route.mcpEndpoint(serverFactory: () -> Server) {
    route("/mcp") {
        // In JSON-response mode the transport answers with `call.respond(jsonRpcMessage)`, which runs through
        // Ktor's application-wide ContentNegotiation. That Json (`plugins/Serialization.kt`) has
        // `explicitNulls = true`, so it would render e.g. `"isError": null`; the SDK requires its own `McpJson`
        // (`explicitNulls = false`, `classDiscriminatorMode = NONE`) instead. ContentNegotiation converts in the
        // `Transform` phase of the send pipeline, and application-level interceptors run before route-level ones
        // within the same phase, so a route-scoped `json(McpJson)` would lose to the app-wide converter. This
        // interceptor therefore runs at `Before` (ahead of `Transform`) and encodes JSON-RPC payloads with
        // `McpJson` into a Ktor `TextContent` (note: Ktor's `io.ktor.http.content.TextContent`, not the MCP
        // SDK's content type of the same name), which the app-wide converter then passes through untouched.
        // `sendPipeline` lives on `ApplicationCallPipeline`, which the `Route` interface itself does not expose;
        // `RoutingNode`, the only implementation, does, and the routing DSL always hands us one. The plugin-API
        // hook for this phase (`BeforeResponseTransform`) is `@InternalAPI` in Ktor 3.5, and
        // `onCallRespond.transformBody` runs in `Transform` and would lose to the application-wide converter.
        (this as RoutingNode).sendPipeline.intercept(ApplicationSendPipeline.Before) { subject ->
            when {
                subject is JSONRPCMessage ->
                    proceedWith(
                        TextContent(
                            McpJson.encodeToString(JSONRPCMessage.serializer(), subject),
                            ContentType.Application.Json,
                        ),
                    )

                subject is List<*> && subject.isNotEmpty() && subject.all { it is JSONRPCMessage } -> {
                    @Suppress("UNCHECKED_CAST")
                    val messages = subject as List<JSONRPCMessage>
                    proceedWith(
                        TextContent(
                            McpJson.encodeToString(ListSerializer(JSONRPCMessage.serializer()), messages),
                            ContentType.Application.Json,
                        ),
                    )
                }

                else -> Unit
            }
        }

        post {
            val transport = StreamableHttpServerTransport(
                StreamableHttpServerTransport.Configuration(enableJsonResponse = true),
            ).also { it.setSessionIdGenerator(null) }
            val server = serverFactory()
            val session = server.createSession(transport)
            try {
                transport.handleRequest(null, call)
            } finally {
                session.close()
            }
        }

        get { call.methodNotAllowed() }
        delete { call.methodNotAllowed() }
    }
}

private suspend fun ApplicationCall.methodNotAllowed() {
    response.header(HttpHeaders.Allow, "POST")
    respond(HttpStatusCode.MethodNotAllowed, ErrorResponse("method_not_allowed"))
}
