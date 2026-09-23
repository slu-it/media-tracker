plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktor) // applies `application` + Shadow; provides buildFatJar / runFatJar
    alias(libs.plugins.ktlint) // ktlintCheck (part of `check`) and ktlintFormat; style from .editorconfig
    alias(libs.plugins.kover) // coverage reports as part of `check`, see below
}

kotlin {
    jvmToolchain(25)
}

application {
    // Reads src/main/resources/application.yaml (ktor-server-config-yaml) and starts the CIO engine.
    mainClass.set("io.ktor.server.cio.EngineMain")
}

ktor {
    fatJar {
        archiveFileName.set("media-tracker.jar")
    }
}

ktlint {
    version.set(libs.versions.ktlint.asProvider().get())
}

// --- Coverage -----------------------------------------------------------------------------------
// Kover instruments the test JVM and writes HTML + XML reports as part of `check`, so every `./gradlew build`
// refreshes backend/build/reports/kover/. Informational only: no `verify { rule }` threshold (ADR 0011 names the
// trigger for adding one).
kover {
    reports {
        filters {
            excludes {
                // kotlinx.serialization generates one `<Dto>$$serializer` class per @Serializable type.
                classes("*\$\$serializer")
            }
        }
        total {
            html { onCheck = true }
            xml { onCheck = true }
        }
    }
}

// --- Frontend bundle -------------------------------------------------------------------------
// :frontend publishes its Vite output directory as a variant with LibraryElements "frontend-dist".
// We depend on it through a normal dependency scope + resolvable configuration instead of reaching
// into :frontend's task graph, which keeps the build configuration-cache and isolated-projects safe.
val frontendDeps = configurations.dependencyScope("frontend")
val frontendDist = configurations.resolvable("frontendDist") {
    extendsFrom(frontendDeps.get())
    attributes {
        attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE, objects.named("frontend-dist"))
    }
}

dependencies {
    add(frontendDeps.name, project(":frontend"))

    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.json)
    implementation(libs.ktor.server.sessions)
    implementation(libs.ktor.server.auth)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.server.sse)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.java)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.mcp.sdk.server)
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.datetime)
    implementation(libs.exposed.migration.jdbc) // schema drift check at startup and in tests
    implementation(libs.flyway.core)
    implementation(libs.flyway.mysql)
    implementation(libs.hikaricp)
    implementation(libs.mariadb.connector)
    implementation(libs.logback)
    implementation(libs.bouncycastle)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.client.mock)
    testImplementation(kotlin("test"))
    // mocks only above the repository interfaces, see ADR 0011
    testImplementation(libs.mockk)
    testImplementation(libs.mcp.sdk.client)
    testImplementation(platform(libs.testcontainers.bom))
    testImplementation(libs.testcontainers.mariadb)
}

// --- Dev loop (start-dev.sh) --------------------------------------------------------------------
// -Pmt.dev=true switches the backend into the live-reload loop: the Vite dev server serves the SPA, so the
// bundle is neither built nor copied into the resources, and `run` gets Ktor's development-mode flag, which
// enables auto-reload of the module classes. Never set it for `build` / `buildFatJar`. The property is read
// at configuration time; the configuration cache tracks it as an input, so both variants get their own entry.
// (The Ktor Gradle plugin's own `-Pio.ktor.development=true` is not used: in plugin 3.5.2 the second
// `convention()` call on `KtorExtension.development` replaces the first, so only the `-D` form is honoured.)
val mtDev = providers.gradleProperty("mt.dev").map(String::toBoolean).getOrElse(false)

tasks.processResources {
    // The compiled React app lands in the JAR under /app; src/main/resources/app stays empty in git.
    if (!mtDev) {
        from(frontendDist) {
            into("app")
        }
    }
}

tasks.named<JavaExec>("run") {
    if (mtDev) {
        jvmArgs("-Dio.ktor.development=true")
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
    }
}
