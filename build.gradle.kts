// Root project: shared coordinates only. No plugins, no sources.
// Build logic lives in backend/build.gradle.kts and frontend/build.gradle.kts;
// all JVM versions come from gradle/libs.versions.toml.

allprojects {
    group = "de.sluit.mediatracker"
    version = "0.1.0-SNAPSHOT"
}
