package de.sluit.mediatracker.common.integration

import io.ktor.client.HttpClient
import io.ktor.client.engine.java.Java
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * Ktor client for outbound calls to third-party services: the JDK-backed [Java] engine (JDK trust store, no extra
 * transitive dependency, honours proxy properties), a lenient [json] ContentNegotiation (`ignoreUnknownKeys`),
 * `expectSuccess = false` (adapters read the status code themselves) and a 10 s request timeout so a slow upstream
 * cannot stall a request indefinitely.
 */
fun externalHttpClient(json: Json = Json { ignoreUnknownKeys = true }): HttpClient = HttpClient(Java) {
    expectSuccess = false
    install(ContentNegotiation) {
        json(json)
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 10_000
    }
}
