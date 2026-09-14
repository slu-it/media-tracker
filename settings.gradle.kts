plugins {
    // Resolves JDK toolchains (jvmToolchain(25)) automatically if the local JDK does not match.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "media-tracker"

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

include("backend", "frontend")
