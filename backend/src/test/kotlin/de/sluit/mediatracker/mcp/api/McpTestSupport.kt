package de.sluit.mediatracker.mcp.api

import de.sluit.mediatracker.auth.api.API_KEY_HEADER
import de.sluit.mediatracker.jsonBody
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpHeaders

/*
 * JSON-RPC helpers shared by the MCP handler tests of every media kind: they post raw JSON-RPC with the
 * `Accept` header the endpoint requires, so malformed requests stay expressible.
 */

/** Posts [body] to `/mcp` with the `Accept` header and, unless [key] is null, the API key header. */
internal suspend fun HttpClient.postJsonRpc(key: String?, body: String): HttpResponse = post("/mcp") {
    acceptJsonRpc()
    if (key != null) header(API_KEY_HEADER, key)
    jsonBody(body)
}

internal fun HttpRequestBuilder.acceptJsonRpc() {
    header(HttpHeaders.Accept, "application/json, text/event-stream")
}
