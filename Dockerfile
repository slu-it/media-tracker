# Runtime image for the fat JAR. Build the JAR first, the Dockerfile does not run Gradle (ADR 0016):
#
#   ./gradlew :backend:buildFatJar && docker build -t media-tracker:local .
#
# Base: distroless Temurin 25 on Debian 13, no shell or package manager, user nonroot (uid/gid 65532),
# ENTRYPOINT is `/usr/bin/java -jar`, so CMD is only the JAR path. .github/workflows/master.yml builds this for
# linux/arm64 and linux/amd64 with buildx (COPY only, no RUN, so no emulation) and pushes it to
# ghcr.io/slu-it/media-tracker; deploy/docker-compose.yml runs it on the Pi.
FROM gcr.io/distroless/java25-debian13:nonroot

# Redundant with the `nonroot` tag, but makes the unprivileged user an invariant of this file: a future base-image
# tag change cannot silently move the app back to root.
USER 65532:65532

# Same flags as deploy/jvm.options (keep both in sync), except that the CDS archive lives in /tmp: it is the only
# writable path in the image, and deploy/docker-compose.yml mounts a volume there so the archive survives restarts.
# JAVA_TOOL_OPTIONS applies to every java start in this image, so a compose `environment:` entry can replace the
# whole set without a rebuild. The launcher prints "Picked up JAVA_TOOL_OPTIONS: ..." to stderr; that is expected.
ENV JAVA_TOOL_OPTIONS="-Xmx192m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:+AutoCreateSharedArchive -XX:SharedArchiveFile=/tmp/media-tracker.jsa -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/./urandom"

# GHCR links the package to the repository through the source label. Note that master.yml passes `--label` via
# metadata-action, which *replaces* these at build time; the description is repeated there so it survives.
LABEL org.opencontainers.image.source="https://github.com/slu-it/media-tracker" \
      org.opencontainers.image.description="Media Tracker: self-hosted media-list tracker (Ktor + React)"

COPY backend/build/libs/media-tracker.jar /app/media-tracker.jar

EXPOSE 8080
CMD ["/app/media-tracker.jar"]
