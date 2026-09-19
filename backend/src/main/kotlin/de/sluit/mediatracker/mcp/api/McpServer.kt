package de.sluit.mediatracker.mcp.api

import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.types.Implementation
import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities

/** Reported to MCP clients in the `initialize` handshake. */
const val MCP_SERVER_NAME = "media-tracker"

/** Reported to MCP clients in the `initialize` handshake. */
const val MCP_SERVER_VERSION = "0.1.0"

/**
 * A fresh [Server] with the tools capability enabled and no tools registered yet. [de.sluit.mediatracker.mcpRoutes]
 * calls this once per request and lets every feature add its tools (e.g.
 * [de.sluit.mediatracker.games.api.addGameTools]) before the server is handed to [mcpEndpoint].
 */
fun newMcpServer(): Server = Server(
    serverInfo = Implementation(name = MCP_SERVER_NAME, version = MCP_SERVER_VERSION),
    options = ServerOptions(capabilities = ServerCapabilities(tools = ServerCapabilities.Tools(listChanged = false))),
)
