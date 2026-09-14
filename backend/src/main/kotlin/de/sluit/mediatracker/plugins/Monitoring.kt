package de.sluit.mediatracker.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.request.path
import org.slf4j.event.Level

fun Application.configureMonitoring() {
    install(CallLogging) {
        level = Level.INFO
        // Logs go to the systemd journal; ANSI colors (via Jansi) would only add noise and a native-access warning.
        disableDefaultColors()
        filter { call -> call.request.path() != "/health" }
    }
}
