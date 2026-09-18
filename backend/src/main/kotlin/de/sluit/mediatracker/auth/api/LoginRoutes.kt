package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.AuthService
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.http.content.staticResources
import io.ktor.server.request.receiveParameters
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.sessions.clear
import io.ktor.server.sessions.get
import io.ktor.server.sessions.sessions
import io.ktor.server.sessions.set

private const val ERROR_PLACEHOLDER = "<!--ERROR-->"
private const val ERROR_BANNER = """<p class="error" role="alert">Wrong username or password.</p>"""

/** Public tier: the hand-written login page, its stylesheet, and the form handlers. */
fun Route.loginRoutes(authService: AuthService) {
    val template = LoginRoutesMarker::class.java.getResource("/login/login.html")
        ?.readText()
        ?: error("login/login.html missing from classpath")

    staticResources("/login/static", "login")

    route("/login") {
        get {
            if (call.sessions.get<UserSession>() != null) {
                call.respondRedirect("/")
                return@get
            }
            val showError = call.request.queryParameters["error"] != null
            val html = template.replace(ERROR_PLACEHOLDER, if (showError) ERROR_BANNER else "")
            call.respondText(html, ContentType.Text.Html, HttpStatusCode.OK)
        }

        post {
            val params = call.receiveParameters()
            val username = params["username"].orEmpty()
            val password = params["password"].orEmpty().toCharArray()
            if (username.isBlank() || password.isEmpty()) {
                call.respondRedirect("/login?error=1")
                return@post
            }
            val user = authService.login(username, password)
            if (user == null) {
                call.respondRedirect("/login?error=1")
            } else {
                call.sessions.set(UserSession(user.id, user.username))
                call.respondRedirect("/")
            }
        }
    }

    post("/logout") {
        call.sessions.clear<UserSession>()
        call.respondRedirect("/login")
    }
}

private object LoginRoutesMarker
