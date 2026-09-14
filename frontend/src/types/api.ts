// Hand-written mirrors of the Kotlin DTOs in backend/src/main/kotlin/de/sluit/mediatracker/api/Dtos.kt.
// Keep the two in sync until a shared KMP module replaces them.

export interface MeResponse {
  username: string;
}

export interface ErrorResponse {
  error: string;
}
