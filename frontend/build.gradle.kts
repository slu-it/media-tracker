import com.github.gradle.node.pnpm.task.PnpmTask

// This project contains no Gradle sources. It wraps pnpm so that `./gradlew build`
// is the single contract for CI and releases. Frontend developers can still use
// `cd frontend && pnpm dev` directly (Node/pnpm come from the Gradle-managed install
// under frontend/.gradle/ or from the machine's own Node 24 + Corepack).

plugins {
    alias(libs.plugins.node)
}

node {
    download = true
    // Keep these literal strings (not providers): node-gradle 7.1.0 has a configuration
    // cache issue when the version is a lazy provider (node-gradle/gradle-node-plugin#350).
    version = "24.21.0"
    pnpmVersion = "10.34.5"
}

val pnpmBuild = tasks.register<PnpmTask>("pnpmBuild") {
    description = "Type-checks and builds the production bundle with Vite into build/dist."
    group = "build"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "build")
    inputs.files(
        "package.json",
        "pnpm-lock.yaml",
        "vite.config.ts",
        "tsconfig.json",
        "tsconfig.app.json",
        "tsconfig.node.json",
        "index.html",
    )
    inputs.dir("src")
    inputs.dir("public")
    outputs.dir(layout.buildDirectory.dir("dist"))
}

val pnpmTest = tasks.register<PnpmTask>("pnpmTest") {
    description = "Runs the Vitest suite once and writes the V8 coverage report to build/coverage."
    group = "verification"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "test")
    inputs.files("package.json", "pnpm-lock.yaml", "vite.config.ts", "tsconfig.json", "tsconfig.app.json")
    inputs.dir("src")
    outputs.dir(layout.buildDirectory.dir("coverage"))
}

val lintInputs = listOf(
    "package.json", "pnpm-lock.yaml", "eslint.config.js", ".prettierrc.json", ".prettierignore",
    "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json", "index.html",
)

val pnpmLint = tasks.register<PnpmTask>("pnpmLint") {
    description = "Runs ESLint over the frontend sources."
    group = "verification"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "lint")
    inputs.files(lintInputs)
    inputs.dir("src")
    outputs.upToDateWhen { false }
}

val pnpmFormatCheck = tasks.register<PnpmTask>("pnpmFormatCheck") {
    description = "Fails if Prettier would change any frontend file."
    group = "verification"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "format:check")
    inputs.files(lintInputs)
    inputs.dir("src")
    outputs.upToDateWhen { false }
}

tasks.register<PnpmTask>("pnpmLintFix") {
    description = "Runs ESLint with --fix."
    group = "formatting"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "lint:fix")
    outputs.upToDateWhen { false }
}

tasks.register<PnpmTask>("pnpmFormat") {
    description = "Rewrites frontend files with Prettier."
    group = "formatting"
    dependsOn(tasks.pnpmInstall)
    args = listOf("run", "format")
    outputs.upToDateWhen { false }
}

// Lifecycle tasks mirroring the base plugin so `./gradlew build` / `check` / `clean` cover this project too.
val check = tasks.register("check") {
    description = "Runs frontend tests, ESLint and the Prettier check."
    group = "verification"
    dependsOn(pnpmTest, pnpmLint, pnpmFormatCheck)
}

tasks.register("build") {
    description = "Builds the frontend bundle and runs its tests."
    group = "build"
    dependsOn(pnpmBuild, check)
}

tasks.register<Delete>("clean") {
    description = "Deletes the frontend build directory (not node_modules)."
    group = "build"
    delete(layout.buildDirectory)
}

// Expose the Vite output directory as a consumable variant so that :backend can depend on it
// through normal dependency resolution instead of reaching into this project's task graph.
// See https://docs.gradle.org/current/userguide/how_to_share_outputs_between_projects.html
val frontendDist = configurations.consumable("frontendDist") {
    attributes {
        attribute(LibraryElements.LIBRARY_ELEMENTS_ATTRIBUTE, objects.named("frontend-dist"))
    }
}

artifacts {
    add(frontendDist.name, layout.buildDirectory.dir("dist")) {
        builtBy(pnpmBuild)
    }
}
