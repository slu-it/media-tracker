plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktor) // applies `application` + Shadow; provides buildFatJar / runFatJar
    alias(libs.plugins.ktlint) // ktlintCheck (part of `check`) and ktlintFormat; style from .editorconfig
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
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.datetime)
    implementation(libs.exposed.migration.jdbc) // schema drift check at startup and in tests
    implementation(libs.flyway.core)
    implementation(libs.flyway.mysql)
    implementation(libs.hikaricp)
    implementation(libs.mysql.connector)
    implementation(libs.logback)
    implementation(libs.bouncycastle)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.h2)
    testImplementation(kotlin("test"))
}

tasks.processResources {
    // The compiled React app lands in the JAR under /app; src/main/resources/app stays empty in git.
    from(frontendDist) {
        into("app")
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
    }
}
